import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import planningService from '../services/planning.service.js';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

export const interventionController = {
  /**
   * GET /api/interventions
   */
  async list(req: AuthRequest, res: Response) {
    try {
      const {
        clientId,
        contratId,
        type,
        statut,
        prestation,
        dateDebut,
        dateFin,
        page = '1',
        limit = '50',
      } = req.query;

      const where: any = {};

      if (clientId) where.clientId = clientId;
      if (contratId) where.contratId = contratId;
      if (type) where.type = type;
      if (statut) where.statut = statut;
      if (prestation) where.prestation = { contains: prestation as string, mode: 'insensitive' };

      if (dateDebut || dateFin) {
        where.datePrevue = {};
        if (dateDebut) where.datePrevue.gte = startOfDay(parseISO(dateDebut as string));
        if (dateFin) where.datePrevue.lte = endOfDay(parseISO(dateFin as string));
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [interventions, total] = await Promise.all([
        prisma.intervention.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: [{ datePrevue: 'asc' }, { heurePrevue: 'asc' }],
          include: {
            client: {
              select: {
                id: true,
                nomEntreprise: true,
                siegeTel: true,
                siegeEmail: true,
                siegeContacts: {
                  select: { id: true, nom: true, fonction: true, tel: true, email: true },
                },
                sites: {
                  select: {
                    id: true,
                    nom: true,
                    adresse: true,
                    contactNom: true,
                    contactFonction: true,
                    tel: true,
                    email: true,
                    notes: true,
                  },
                },
              },
            },
            site: {
              select: {
                id: true,
                nom: true,
                adresse: true,
                contactNom: true,
                contactFonction: true,
                tel: true,
                email: true,
                notes: true,
              },
            },
            contrat: {
              select: { id: true, type: true, prestations: true },
            },
            createdBy: {
              select: { id: true, nom: true, prenom: true },
            },
            interventionEmployes: {
              include: {
                employe: {
                  include: { postes: true },
                },
                poste: true,
              },
            },
          },
        }),
        prisma.intervention.count({ where }),
      ]);

      res.json({
        interventions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('List interventions error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/interventions/a-planifier
   */
  async aPlanifier(req: AuthRequest, res: Response) {
    try {
      const { days = '7' } = req.query;
      const interventions = await planningService.getAPlanifier(parseInt(days as string));
      res.json({ interventions });
    } catch (error) {
      console.error('A planifier error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/interventions/en-retard
   */
  async enRetard(req: AuthRequest, res: Response) {
    try {
      const interventions = await planningService.getEnRetard();
      res.json({ interventions });
    } catch (error) {
      console.error('En retard error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/interventions/semaine
   */
  async semaine(req: AuthRequest, res: Response) {
    try {
      const interventions = await planningService.getSemaineCourante();
      res.json({ interventions });
    } catch (error) {
      console.error('Semaine error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/interventions/:id
   */
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const intervention = await prisma.intervention.findUnique({
        where: { id },
        include: {
          client: true,
          site: {
            select: {
              id: true,
              nom: true,
              adresse: true,
              contactNom: true,
              contactFonction: true,
              tel: true,
              email: true,
              notes: true,
            },
          },
          contrat: {
            include: {
              responsablePlanning: {
                select: { id: true, nom: true, prenom: true },
              },
              contratSites: true,
            },
          },
          createdBy: {
            select: { id: true, nom: true, prenom: true, email: true },
          },
          updatedBy: {
            select: { id: true, nom: true, prenom: true, email: true },
          },
          interventionEmployes: {
            include: {
              employe: {
                include: { postes: true },
              },
              poste: true,
            },
          },
        },
      });

      if (!intervention) {
        return res.status(404).json({ error: 'Intervention non trouvée' });
      }

      let remainingOperations: number | null = null;
      let remainingControles: number | null = null;
      let freqOps: string | null = null;
      let freqCtrls: string | null = null;

      if (intervention.contrat) {
        const siteId = intervention.siteId || undefined;
        let maxOps: number | null = null;
        let maxCtrls: number | null = null;

        if (siteId && intervention.contrat.contratSites?.length) {
          const cs = intervention.contrat.contratSites.find((s) => s.siteId === siteId);
          if (cs) {
            maxOps = cs.nombreOperations ?? null;
            maxCtrls = cs.nombreVisitesControle ?? null;
            freqOps = (cs.frequenceOperations as any) || null;
            freqCtrls = (cs.frequenceControle as any) || null;
          }
        }

        if (maxOps === null) {
          maxOps = intervention.contrat.nombreOperations ?? null;
        }
        if (maxCtrls === null) {
          maxCtrls = intervention.contrat.nombreVisitesControle ?? null;
        }
        if (freqOps === null) {
          freqOps = (intervention.contrat.frequenceOperations as any) || null;
        }
        if (freqCtrls === null) {
          freqCtrls = (intervention.contrat.frequenceControle as any) || null;
        }

        const doneOps = await prisma.intervention.count({
          where: {
            contratId: intervention.contratId!,
            siteId,
            type: 'OPERATION',
            statut: 'REALISEE',
          },
        });
        if (maxOps !== null) {
          remainingOperations = Math.max(maxOps - doneOps, 0);
        } else {
          remainingOperations = null;
        }

        const doneCtrls = await prisma.intervention.count({
          where: {
            contratId: intervention.contratId!,
            siteId,
            type: 'CONTROLE',
            statut: 'REALISEE',
          },
        });
        if (maxCtrls !== null) {
          remainingControles = Math.max(maxCtrls - doneCtrls, 0);
        } else {
          remainingControles = null;
        }
      }

      // Récupérer les notes de la dernière intervention réalisée pour ce site
      let previousIntervention: {
        id: string;
        type: string;
        dateRealisee: Date | null;
        notesTerrain: string;
      } | null = null;

      if (intervention.siteId) {
        const previous = await prisma.intervention.findFirst({
          where: {
            siteId: intervention.siteId,
            clientId: intervention.clientId,
            statut: 'REALISEE',
            notesTerrain: { not: null },
            id: { not: intervention.id }, // Exclure l'intervention actuelle
            dateRealisee: { not: null },
          },
          orderBy: { dateRealisee: 'desc' },
          select: {
            id: true,
            type: true,
            dateRealisee: true,
            notesTerrain: true,
          },
        });

        if (previous && previous.notesTerrain && previous.notesTerrain.trim() !== '') {
          previousIntervention = {
            id: previous.id,
            type: previous.type,
            dateRealisee: previous.dateRealisee,
            notesTerrain: previous.notesTerrain,
          };
        }
      }

      res.json({
        intervention: {
          ...intervention,
          remainingOperations,
          remainingControles,
          frequenceOperations: freqOps,
          frequenceControle: freqCtrls,
          previousIntervention,
        },
      });
    } catch (error) {
      console.error('Get intervention error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/interventions
   */
  async create(req: AuthRequest, res: Response) {
    try {
      const data = req.body;

      // Vérifier que le client existe
      const client = await prisma.client.findUnique({
        where: { id: data.clientId },
      });

      if (!client) {
        return res.status(400).json({ error: 'Client non trouvé' });
      }

      // Si contratId fourni, vérifier qu'il existe
      if (data.contratId) {
        const contrat = await prisma.contrat.findUnique({
          where: { id: data.contratId },
        });
        if (!contrat) {
          return res.status(400).json({ error: 'Contrat non trouvé' });
        }
        if (contrat.clientId !== data.clientId) {
          return res.status(400).json({ error: 'Le contrat n\'appartient pas à ce client' });
        }
      }

      const intervention = await prisma.intervention.create({
        data: {
          contratId: data.contratId,
          clientId: data.clientId,
          siteId: data.siteId,
          type: data.type,
          prestation: data.prestation,
          datePrevue: data.datePrevue,
          heurePrevue: data.heurePrevue,
          duree: data.duree,
          statut: data.statut ?? 'A_PLANIFIER',
          notesTerrain: data.notesTerrain,
          responsable: data.responsable,
          createdById: req.user!.id,
          interventionEmployes: data.employes?.length
            ? {
                create: data.employes.map((emp: { employeId: string; posteId: string }) => ({
                  employeId: emp.employeId,
                  posteId: emp.posteId,
                })),
              }
            : undefined,
        },
        include: {
          client: {
            select: { id: true, nomEntreprise: true },
          },
          interventionEmployes: {
            include: {
              employe: {
                include: { postes: true },
              },
              poste: true,
            },
          },
        },
      });

      // Audit log
      await createAuditLog(req.user!.id, 'CREATE', 'Intervention', intervention.id, { after: intervention });

      res.status(201).json({ intervention });
    } catch (error) {
      console.error('Create intervention error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/interventions/:id
   */
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.intervention.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Intervention non trouvée' });
      }

      // Si employes fourni, mettre à jour la liste
      if (data.employes !== undefined) {
        await prisma.interventionEmploye.deleteMany({
          where: { interventionId: id },
        });
        if (data.employes?.length) {
          await prisma.interventionEmploye.createMany({
            data: data.employes.map((emp: { employeId: string; posteId: string }) => ({
              interventionId: id,
              employeId: emp.employeId,
              posteId: emp.posteId,
            })),
          });
        }
      }

      const intervention = await prisma.intervention.update({
        where: { id },
        data: {
          contratId: data.contratId !== undefined ? data.contratId : existing.contratId,
          clientId: data.clientId ?? existing.clientId,
          siteId: data.siteId !== undefined ? data.siteId : existing.siteId,
          type: data.type ?? existing.type,
          prestation: data.prestation ?? existing.prestation,
          datePrevue: data.datePrevue ?? existing.datePrevue,
          heurePrevue: data.heurePrevue !== undefined ? data.heurePrevue : existing.heurePrevue,
          duree: data.duree !== undefined ? data.duree : existing.duree,
          statut: data.statut ?? existing.statut,
          notesTerrain: data.notesTerrain ?? existing.notesTerrain,
          responsable: data.responsable !== undefined ? data.responsable : existing.responsable,
          updatedById: req.user!.id,
        },
        include: {
          client: {
            select: { id: true, nomEntreprise: true },
          },
          interventionEmployes: {
            include: {
              employe: {
                include: { postes: true },
              },
              poste: true,
            },
          },
        },
      });

      // Audit log
      await createAuditLog(req.user!.id, 'UPDATE', 'Intervention', intervention.id, {
        before: existing,
        after: intervention,
      });

      res.json({ intervention });
    } catch (error) {
      console.error('Update intervention error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/interventions/:id/realiser
   * @body dateRealisee - Date effective de réalisation (optionnel, défaut: date prévue)
   *                      La prochaine intervention sera calculée à partir de cette date
   */
  async realiser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { notesTerrain, creerProchaine, dateRealisee } = req.body;

      const result = await planningService.marquerRealisee(id, req.user!.id, {
        notesTerrain,
        creerProchaine,
        dateRealisee: dateRealisee ? new Date(dateRealisee) : undefined,
      });

      res.json({
        intervention: result.intervention,
        nextCreated: result.nextCreated,
        nextIntervention: result.nextIntervention,
        suggestedDate: result.suggestedDate,
      });
    } catch (error: any) {
      console.error('Realiser error:', error);
      res.status(400).json({ error: error.message || 'Erreur lors de la réalisation' });
    }
  },

  /**
   * POST /api/interventions/:id/reporter
   */
  async reporter(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { nouvelleDatePrevue, raison } = req.body;

      if (!nouvelleDatePrevue) {
        return res.status(400).json({ error: 'Nouvelle date requise' });
      }

      const intervention = await planningService.reporter(
        id,
        req.user!.id,
        new Date(nouvelleDatePrevue),
        raison
      );

      res.json({ intervention });
    } catch (error: any) {
      console.error('Reporter error:', error);
      res.status(400).json({ error: error.message || 'Erreur lors du report' });
    }
  },

  /**
   * DELETE /api/interventions/:id
   */
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.intervention.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Intervention non trouvée' });
      }

      if (existing.statut === 'REALISEE') {
        return res.status(400).json({
          error: 'Impossible de supprimer une intervention réalisée',
        });
      }

      await prisma.intervention.delete({ where: { id } });

      // Audit log
      await createAuditLog(req.user!.id, 'DELETE', 'Intervention', id);

      res.json({ message: 'Intervention supprimée' });
    } catch (error) {
      console.error('Delete intervention error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/interventions/last-notes/:clientId
   * Récupère les notes terrain de la dernière intervention réalisée pour un client
   * @query siteId - Optionnel, pour filtrer par site
   */
  async getLastNotes(req: AuthRequest, res: Response) {
    try {
      const { clientId } = req.params;
      const { siteId } = req.query;

      const where: any = {
        clientId,
        statut: 'REALISEE',
        notesTerrain: { not: null },
        dateRealisee: { not: null },
      };

      if (siteId) {
        where.siteId = siteId as string;
      }

      const lastIntervention = await prisma.intervention.findFirst({
        where,
        orderBy: { dateRealisee: 'desc' },
        select: {
          id: true,
          type: true,
          dateRealisee: true,
          notesTerrain: true,
          site: {
            select: { id: true, nom: true },
          },
        },
      });

      if (lastIntervention && lastIntervention.notesTerrain?.trim()) {
        res.json({
          previousIntervention: {
            id: lastIntervention.id,
            type: lastIntervention.type,
            dateRealisee: lastIntervention.dateRealisee,
            notesTerrain: lastIntervention.notesTerrain,
            site: lastIntervention.site,
          },
        });
      } else {
        res.json({ previousIntervention: null });
      }
    } catch (error) {
      console.error('Get last notes error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default interventionController;
