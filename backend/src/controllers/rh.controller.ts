import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { startOfYear, endOfYear, startOfWeek, endOfWeek, addWeeks, isFriday, isSaturday, parseISO, format } from 'date-fns';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';


async function recalculerRecuperation(employeId: string, annee: number) {
  const debut = startOfYear(new Date(annee, 0, 1));
  const fin = endOfYear(new Date(annee, 0, 1));

  const jours = await prisma.jourWeekendTravaille.findMany({
    where: { employeId, date: { gte: debut, lte: fin } },
    orderBy: { date: 'asc' },
  });

  const parSemaine: Map<string, { vendredi: boolean; samedi: boolean }> = new Map();
  for (const jour of jours) {
    const weekStart = startOfWeek(jour.date, { weekStartsOn: 0 });
    const weekKey = format(weekStart, 'yyyy-ww');
    if (!parSemaine.has(weekKey)) parSemaine.set(weekKey, { vendredi: false, samedi: false });
    const semaine = parSemaine.get(weekKey)!;
    if (jour.estVendredi) semaine.vendredi = true; else semaine.samedi = true;
  }

  let joursRecup = 0;
  const semaines = Array.from(parSemaine.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let semainesConsecutives = 0;
  for (const [, { vendredi, samedi }] of semaines) {
    if (vendredi && samedi) { joursRecup += 1; semainesConsecutives = 1; continue; }
    if (vendredi || samedi) {
      semainesConsecutives++;
      if (semainesConsecutives >= 2) { joursRecup += 1; semainesConsecutives = 0; }
    }
  }

  // Ajouter les jours accordés manuellement
  const accordees = await prisma.recuperationAccordee.aggregate({
    where: { employeId, annee },
    _sum: { nbJours: true },
  });
  const joursAccordes = accordees._sum.nbJours || 0;
  const totalAcquis = joursRecup + joursAccordes;

  const joursPris = await prisma.conge.aggregate({
    where: { employeId, type: 'RECUPERATION', statut: 'APPROUVE', dateDebut: { gte: debut, lte: fin } },
    _sum: { nbJours: true },
  });
  const totalPris = joursPris._sum.nbJours || 0;

  await prisma.soldeConge.upsert({
    where: { employeId_annee_type: { employeId, annee, type: 'RECUPERATION' } },
    update: { joursAcquis: totalAcquis, joursPris: totalPris, joursRestants: totalAcquis - totalPris },
    create: { employeId, annee, type: 'RECUPERATION', joursAcquis: totalAcquis, joursPris: totalPris, joursRestants: totalAcquis - totalPris },
  });

  return totalAcquis;
}

export const rhController = {
  // ============ CONGES ============

  /**
   * GET /api/rh/conges
   * Liste des congés avec filtres
   */
  async listConges(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { employeId, statut, type, dateDebut, dateFin, page = '1', limit = '50' } = req.query;

      const where: any = {};

      if (employeId) where.employeId = employeId;
      if (statut) where.statut = statut;
      if (type) where.type = type;

      if (dateDebut || dateFin) {
        where.dateDebut = {};
        if (dateDebut) where.dateDebut.gte = new Date(dateDebut as string);
        if (dateFin) where.dateDebut.lte = new Date(dateFin as string);
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [conges, total] = await Promise.all([
        prisma.conge.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { dateDebut: 'desc' },
          include: {
            employe: { select: { id: true, nom: true, prenom: true } },
            approuvePar: { select: { id: true, nom: true, prenom: true } },
          },
        }),
        prisma.conge.count({ where }),
      ]);

      res.json({
        conges,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'List conges error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/rh/conges
   * Créer une demande de congé
   */
  async createConge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { employeId, type, dateDebut, dateFin, nbJours, motif } = req.body;

      // Vérifier que l'employé existe
      const employe = await prisma.employe.findUnique({ where: { id: employeId } });
      if (!employe) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      // Vérifier le solde si c'est un congé annuel ou récupération
      if (type === 'ANNUEL' || type === 'RECUPERATION') {
        const annee = new Date(dateDebut).getFullYear();
        const solde = await prisma.soldeConge.findUnique({
          where: { employeId_annee_type: { employeId, annee, type } },
        });

        if (solde && solde.joursRestants < nbJours) {
          return res.status(400).json({
            error: `Solde insuffisant. Disponible: ${solde.joursRestants} jours`,
          });
        }
      }

      const conge = await prisma.conge.create({
        data: {
          employeId,
          type,
          dateDebut: new Date(dateDebut),
          dateFin: new Date(dateFin),
          nbJours,
          motif,
        },
        include: {
          employe: { select: { id: true, nom: true, prenom: true } },
        },
      });

      res.status(201).json({ conge });
    } catch (error) {
      logger.error({ err: error }, 'Create conge error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * PUT /api/rh/conges/:id/approuver
   * Approuver ou refuser un congé
   */
  async approuverConge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { approuve, commentaire } = req.body;

      const conge = await prisma.conge.findUnique({
        where: { id },
        include: { employe: true },
      });

      if (!conge) {
        return res.status(404).json({ error: 'Congé non trouvé' });
      }

      if (conge.statut !== 'EN_ATTENTE') {
        return res.status(400).json({ error: 'Ce congé a déjà été traité' });
      }

      const nouveauStatut = approuve ? 'APPROUVE' : 'REFUSE';

      // Si approuvé, mettre à jour le solde
      if (approuve && (conge.type === 'ANNUEL' || conge.type === 'RECUPERATION')) {
        const annee = conge.dateDebut.getFullYear();
        const soldeActuel = await prisma.soldeConge.findUnique({
          where: { employeId_annee_type: { employeId: conge.employeId, annee, type: conge.type } },
        });
        const soldeApres = (soldeActuel?.joursRestants ?? 0) - conge.nbJours;

        await prisma.soldeConge.upsert({
          where: { employeId_annee_type: { employeId: conge.employeId, annee, type: conge.type } },
          update: {
            joursPris: { increment: conge.nbJours },
            joursRestants: { decrement: conge.nbJours },
          },
          create: {
            employeId: conge.employeId, annee, type: conge.type,
            joursAcquis: 0, joursPris: conge.nbJours, joursRestants: -conge.nbJours,
          },
        });

        await prisma.mouvementConge.create({
          data: {
            employeId: conge.employeId, typeOp: 'CONSOMMATION', sens: 'DEBIT',
            jours: conge.nbJours, soldeApres,
            motif: `Conge approuve du ${conge.dateDebut.toLocaleDateString('fr-FR')} au ${conge.dateFin.toLocaleDateString('fr-FR')}`,
            annee, auteurId: req.user?.id,
          },
        });
      }

      const updated = await prisma.conge.update({
        where: { id },
        data: {
          statut: nouveauStatut,
          approuveParId: req.user!.id,
          dateReponse: new Date(),
          commentaire,
        },
        include: {
          employe: { select: { id: true, nom: true, prenom: true } },
          approuvePar: { select: { id: true, nom: true, prenom: true } },
        },
      });

      res.json({ conge: updated });
    } catch (error) {
      logger.error({ err: error }, 'Approuver conge error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/rh/conges/:id
   * Annuler un congé (seulement si en attente ou futur)
   */
  async annulerConge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const conge = await prisma.conge.findUnique({ where: { id } });

      if (!conge) {
        return res.status(404).json({ error: 'Congé non trouvé' });
      }

      // Si déjà approuvé et passé, on ne peut pas annuler
      if (conge.statut === 'APPROUVE' && conge.dateDebut < new Date()) {
        return res.status(400).json({ error: 'Impossible d\'annuler un congé déjà pris' });
      }

      // Si était approuvé, restaurer le solde
      if (conge.statut === 'APPROUVE' && (conge.type === 'ANNUEL' || conge.type === 'RECUPERATION')) {
        const annee = conge.dateDebut.getFullYear();
        await prisma.soldeConge.update({
          where: { employeId_annee_type: { employeId: conge.employeId, annee, type: conge.type } },
          data: {
            joursPris: { decrement: conge.nbJours },
            joursRestants: { increment: conge.nbJours },
          },
        });
      }

      await prisma.conge.update({
        where: { id },
        data: { statut: 'ANNULE' },
      });

      res.json({ message: 'Congé annulé' });
    } catch (error) {
      logger.error({ err: error }, 'Annuler conge error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  // ============ SOLDES CONGES ============

  /**
   * GET /api/rh/soldes?annee=2026
   * Soldes de congés de tous les employés pour une année
   */
  async listSoldes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const annee = parseInt(req.query.annee as string) || new Date().getFullYear();

      const soldes = await prisma.soldeConge.findMany({
        where: { annee, type: 'ANNUEL' },
        include: { employe: { select: { id: true, nom: true, prenom: true } } },
        orderBy: [{ employe: { nom: 'asc' } }],
      });

      res.json({ soldes, annee });
    } catch (error) {
      logger.error({ err: error }, 'List soldes error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/rh/soldes/crediter-mois
   * Credit 2.5 jours a tous les employes pour un mois donne
   */
  async crediterMois(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { annee, mois } = req.body;
      const anneeNum = annee ? parseInt(annee) : new Date().getFullYear();
      const moisNum = mois ? parseInt(mois) : new Date().getMonth() + 1;

      const settings = await prisma.companySettings.findFirst();
      const joursParMois = settings?.joursCongesMensuels ?? 2.5;

      const employes = await prisma.employe.findMany({ select: { id: true } });
      let credites = 0;

      for (const emp of employes) {
        // Verifier que ce mois n'a pas deja ete credite
        const dejaCredite = await prisma.mouvementConge.findFirst({
          where: { employeId: emp.id, typeOp: 'ACQUISITION', annee: anneeNum, mois: moisNum },
        });
        if (dejaCredite) continue;

        const solde = await prisma.soldeConge.findUnique({
          where: { employeId_annee_type: { employeId: emp.id, annee: anneeNum, type: 'ANNUEL' } },
        });

        const ancienRestant = solde?.joursRestants ?? 0;
        const nouvelAcquis = (solde?.joursAcquis ?? 0) + joursParMois;
        const nouveauRestant = ancienRestant + joursParMois;

        await prisma.soldeConge.upsert({
          where: { employeId_annee_type: { employeId: emp.id, annee: anneeNum, type: 'ANNUEL' } },
          update: { joursAcquis: nouvelAcquis, joursRestants: nouveauRestant },
          create: {
            employeId: emp.id, annee: anneeNum, type: 'ANNUEL',
            joursAcquis: joursParMois, joursRestants: joursParMois,
          },
        });

        await prisma.mouvementConge.create({
          data: {
            employeId: emp.id, typeOp: 'ACQUISITION', sens: 'CREDIT',
            jours: joursParMois, soldeApres: nouveauRestant,
            motif: `Acquisition ${moisNum}/${anneeNum}`,
            annee: anneeNum, mois: moisNum, auteurId: req.user?.id,
          },
        });
        credites++;
      }

      res.json({
        message: `${joursParMois} jours credites pour ${credites} employe(s) - ${moisNum}/${anneeNum}`,
        mois: moisNum, annee: anneeNum, joursCredites: joursParMois, total: credites,
      });
    } catch (error) {
      logger.error({ err: error }, 'Crediter mois error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/rh/soldes/:employeId/ajuster
   * Ajustement manuel du solde d un employe
   */
  async ajusterSolde(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { employeId } = req.params;
      const { jours, sens, motif, annee } = req.body;
      const anneeNum = annee ? parseInt(annee) : new Date().getFullYear();
      const joursNum = parseFloat(jours);

      const solde = await prisma.soldeConge.findUnique({
        where: { employeId_annee_type: { employeId, annee: anneeNum, type: 'ANNUEL' } },
      });

      const ancienRestant = solde?.joursRestants ?? 0;
      const nouveauRestant = sens === 'CREDIT'
        ? ancienRestant + joursNum
        : Math.max(0, ancienRestant - joursNum);

      await prisma.soldeConge.upsert({
        where: { employeId_annee_type: { employeId, annee: anneeNum, type: 'ANNUEL' } },
        update: {
          joursAcquis: sens === 'CREDIT' ? { increment: joursNum } : undefined,
          joursPris: sens === 'DEBIT' ? { increment: joursNum } : undefined,
          joursRestants: nouveauRestant,
        },
        create: {
          employeId, annee: anneeNum, type: 'ANNUEL',
          joursAcquis: sens === 'CREDIT' ? joursNum : 0,
          joursPris: sens === 'DEBIT' ? joursNum : 0,
          joursRestants: nouveauRestant,
        },
      });

      await prisma.mouvementConge.create({
        data: {
          employeId, typeOp: 'AJUSTEMENT', sens,
          jours: joursNum, soldeApres: nouveauRestant,
          motif: motif || 'Ajustement manuel',
          annee: anneeNum, auteurId: req.user?.id,
        },
      });

      res.json({ message: 'Solde ajuste', soldeApres: nouveauRestant });
    } catch (error) {
      logger.error({ err: error }, 'Ajuster solde error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/rh/soldes/cloture-annee
   * Cloture de fin d annee : REPORTER | SUPPRIMER | PAYER
   */
  async cloturerAnnee(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { annee, action } = req.body; // action: REPORTER | SUPPRIMER | PAYER
      const anneeNum = parseInt(annee);
      const anneeNext = anneeNum + 1;

      const soldes = await prisma.soldeConge.findMany({
        where: { annee: anneeNum, type: 'ANNUEL' },
      });

      let traites = 0;

      for (const s of soldes) {
        if (s.joursRestants <= 0) continue;
        const restants = s.joursRestants;

        if (action === 'REPORTER') {
          // Transferer vers l annee suivante
          await prisma.soldeConge.upsert({
            where: { employeId_annee_type: { employeId: s.employeId, annee: anneeNext, type: 'ANNUEL' } },
            update: { joursReportes: { increment: restants }, joursRestants: { increment: restants } },
            create: {
              employeId: s.employeId, annee: anneeNext, type: 'ANNUEL',
              joursReportes: restants, joursRestants: restants,
            },
          });
          await prisma.mouvementConge.createMany({
            data: [
              {
                employeId: s.employeId, typeOp: 'REPORT_SORTANT', sens: 'DEBIT',
                jours: restants, soldeApres: 0, annee: anneeNum,
                motif: `Report vers ${anneeNext}`, auteurId: req.user?.id,
              },
              {
                employeId: s.employeId, typeOp: 'REPORT_ENTRANT', sens: 'CREDIT',
                jours: restants, soldeApres: restants, annee: anneeNext,
                motif: `Report depuis ${anneeNum}`, auteurId: req.user?.id,
              },
            ],
          });
          await prisma.soldeConge.update({
            where: { id: s.id },
            data: { joursRestants: 0 },
          });
        } else if (action === 'SUPPRIMER') {
          await prisma.soldeConge.update({
            where: { id: s.id },
            data: { joursRestants: 0 },
          });
          await prisma.mouvementConge.create({
            data: {
              employeId: s.employeId, typeOp: 'PERTE', sens: 'DEBIT',
              jours: restants, soldeApres: 0, annee: anneeNum,
              motif: `Solde non reporte - cloture ${anneeNum}`, auteurId: req.user?.id,
            },
          });
        } else if (action === 'PAYER') {
          await prisma.soldeConge.update({
            where: { id: s.id },
            data: { joursIndemnises: { increment: restants }, joursRestants: 0 },
          });
          await prisma.mouvementConge.create({
            data: {
              employeId: s.employeId, typeOp: 'PAIEMENT', sens: 'DEBIT',
              jours: restants, soldeApres: 0, annee: anneeNum,
              motif: `Conversion en indemnite - cloture ${anneeNum}`, auteurId: req.user?.id,
            },
          });
        }
        traites++;
      }

      const labels: Record<string, string> = {
        REPORTER: `Report vers ${anneeNext}`,
        SUPPRIMER: 'Suppression',
        PAYER: 'Conversion en indemnite',
      };
      res.json({
        message: `Cloture ${anneeNum} - ${labels[action]} : ${traites} employe(s) traite(s)`,
        annee: anneeNum, action, traites,
      });
    } catch (error) {
      logger.error({ err: error }, 'Cloturer annee error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/rh/soldes/mouvements?employeId=xxx&annee=2026
   */
  async listMouvements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { employeId, annee } = req.query;
      const where: any = {};
      if (employeId) where.employeId = employeId;
      if (annee) where.annee = parseInt(annee as string);

      const mouvements = await prisma.mouvementConge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          employe: { select: { id: true, nom: true, prenom: true } },
          auteur:  { select: { id: true, nom: true, prenom: true } },
        },
        take: 200,
      });

      res.json({ mouvements });
    } catch (error) {
      logger.error({ err: error }, 'List mouvements error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  // ============ JOURS WEEKEND TRAVAILLES ============

  /**
   * GET /api/rh/weekend-travailles
   * Liste des jours de weekend travaillés
   */
  async listWeekendTravailles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { employeId, dateDebut, dateFin } = req.query;

      const where: any = {};

      if (employeId) where.employeId = employeId;

      if (dateDebut || dateFin) {
        where.date = {};
        if (dateDebut) where.date.gte = new Date(dateDebut as string);
        if (dateFin) where.date.lte = new Date(dateFin as string);
      }

      const jours = await prisma.jourWeekendTravaille.findMany({
        where,
        orderBy: { date: 'desc' },
        include: {
          employe: { select: { id: true, nom: true, prenom: true } },
        },
      });

      res.json({ jours });
    } catch (error) {
      logger.error({ err: error }, 'List weekend travailles error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/rh/weekend-travailles
   * Enregistrer un jour de weekend travaillé
   */
  async createWeekendTravaille(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { employeId, date, notes } = req.body;

      const dateObj = new Date(date);

      // Vérifier que c'est bien un vendredi ou samedi
      const estVendredi = isFriday(dateObj);
      const estSamedi = isSaturday(dateObj);

      if (!estVendredi && !estSamedi) {
        return res.status(400).json({ error: 'La date doit être un vendredi ou un samedi' });
      }

      // Vérifier que l'employé existe
      const employe = await prisma.employe.findUnique({ where: { id: employeId } });
      if (!employe) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      const jour = await prisma.jourWeekendTravaille.create({
        data: {
          employeId,
          date: dateObj,
          estVendredi,
          notes,
        },
        include: {
          employe: { select: { id: true, nom: true, prenom: true } },
        },
      });

      // Recalculer les jours de récupération pour cet employé (non-bloquant)
      recalculerRecuperation(employeId, dateObj.getFullYear()).catch((err) => {
        logger.error({ err }, 'recalculerRecuperation failed after weekend create');
      });

      res.status(201).json({ jour });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ce jour est déjà enregistré pour cet employé' });
      }
      logger.error({ err: error }, 'Create weekend travaille error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/rh/weekend-travailles/:id
   * Supprimer un jour de weekend travaillé
   */
  async deleteWeekendTravaille(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const jour = await prisma.jourWeekendTravaille.findUnique({ where: { id } });

      if (!jour) {
        return res.status(404).json({ error: 'Jour non trouvé' });
      }

      await prisma.jourWeekendTravaille.delete({ where: { id } });

      // Recalculer les jours de récupération (non-bloquant)
      recalculerRecuperation(jour.employeId, jour.date.getFullYear()).catch((err) => {
        logger.error({ err }, 'recalculerRecuperation failed after weekend delete');
      });

      res.json({ message: 'Jour supprimé' });
    } catch (error) {
      logger.error({ err: error }, 'Delete weekend travaille error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  // ============ SOLDES ============

  /**
   * GET /api/rh/soldes
   * Récupérer les soldes de congés
   */
  async getSoldes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { employeId, annee } = req.query;

      const where: any = {};

      if (employeId) where.employeId = employeId;
      if (annee) where.annee = parseInt(annee as string);

      const soldes = await prisma.soldeConge.findMany({
        where,
        include: {
          employe: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: [{ annee: 'desc' }, { type: 'asc' }],
      });

      res.json({ soldes });
    } catch (error) {
      logger.error({ err: error }, 'Get soldes error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * PUT /api/rh/soldes
   * Mettre à jour ou créer un solde (pour définir les jours acquis)
   */
  async updateSolde(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { employeId, annee, type, joursAcquis } = req.body;

      // Récupérer le solde existant ou créer
      const existing = await prisma.soldeConge.findUnique({
        where: { employeId_annee_type: { employeId, annee, type } },
      });

      const joursPris = existing?.joursPris || 0;
      const joursRestants = joursAcquis - joursPris;

      const solde = await prisma.soldeConge.upsert({
        where: { employeId_annee_type: { employeId, annee, type } },
        update: {
          joursAcquis,
          joursRestants,
        },
        create: {
          employeId,
          annee,
          type,
          joursAcquis,
          joursPris: 0,
          joursRestants: joursAcquis,
        },
        include: {
          employe: { select: { id: true, nom: true, prenom: true } },
        },
      });

      res.json({ solde });
    } catch (error) {
      logger.error({ err: error }, 'Update solde error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/rh/employes/:id/recap
   * Récapitulatif RH d'un employé
   */
  async getEmployeRecap(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { annee = new Date().getFullYear().toString() } = req.query;
      const anneeNum = parseInt(annee as string);

      const employe = await prisma.employe.findUnique({
        where: { id },
        include: { postes: true },
      });

      if (!employe) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      // Soldes de l'année
      const soldes = await prisma.soldeConge.findMany({
        where: { employeId: id, annee: anneeNum },
      });

      // Congés de l'année
      const conges = await prisma.conge.findMany({
        where: {
          employeId: id,
          dateDebut: {
            gte: startOfYear(new Date(anneeNum, 0, 1)),
            lte: endOfYear(new Date(anneeNum, 0, 1)),
          },
        },
        orderBy: { dateDebut: 'desc' },
      });

      // Jours weekend travaillés de l'année
      const weekendsTravailles = await prisma.jourWeekendTravaille.findMany({
        where: {
          employeId: id,
          date: {
            gte: startOfYear(new Date(anneeNum, 0, 1)),
            lte: endOfYear(new Date(anneeNum, 0, 1)),
          },
        },
        orderBy: { date: 'desc' },
      });

      // Recalculer les récupérations pour être sûr
      const joursRecupCalcules = await recalculerRecuperation(id, anneeNum);

      res.json({
        employe,
        annee: anneeNum,
        soldes,
        conges,
        weekendsTravailles,
        stats: {
          totalWeekendsTravailles: weekendsTravailles.length,
          joursRecupAcquis: joursRecupCalcules,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Get employe recap error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/rh/dashboard
   * Dashboard RH
   */
  async getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const annee = new Date().getFullYear();
      const today = new Date();

      const [
        congesEnAttente,
        congesEnCours,
        employesEnConge,
        totalEmployes,
      ] = await Promise.all([
        // Congés en attente d'approbation
        prisma.conge.count({ where: { statut: 'EN_ATTENTE' } }),

        // Congés en cours aujourd'hui
        prisma.conge.findMany({
          where: {
            statut: 'APPROUVE',
            dateDebut: { lte: today },
            dateFin: { gte: today },
          },
          include: {
            employe: { select: { id: true, nom: true, prenom: true } },
          },
        }),

        // Nombre d'employés en congé
        prisma.conge.groupBy({
          by: ['employeId'],
          where: {
            statut: 'APPROUVE',
            dateDebut: { lte: today },
            dateFin: { gte: today },
          },
        }),

        // Total employés
        prisma.employe.count(),
      ]);

      // Employés avec des jours de récup à prendre
      const soldesRecup = await prisma.soldeConge.findMany({
        where: {
          annee,
          type: 'RECUPERATION',
          joursRestants: { gt: 0 },
        },
        include: {
          employe: { select: { id: true, nom: true, prenom: true } },
        },
      });

      res.json({
        stats: {
          congesEnAttente,
          employesEnConge: employesEnConge.length,
          totalEmployes,
        },
        congesEnCours,
        employesAvecRecup: soldesRecup,
      });
    } catch (error) {
      logger.error({ err: error }, 'Get dashboard RH error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  // ============ RECUPERATIONS ACCORDEES ============

  /**
   * GET /api/rh/recuperations
   * Historique complet des récupérations par employé
   */
  async listRecuperations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { annee = new Date().getFullYear().toString(), employeId } = req.query;
      const anneeNum = parseInt(annee as string);
      const debut = startOfYear(new Date(anneeNum, 0, 1));
      const fin = endOfYear(new Date(anneeNum, 0, 1));

      const whereEmploye = employeId ? { id: employeId as string } : {};

      const employes = await prisma.employe.findMany({
        where: whereEmploye,
        select: { id: true, nom: true, prenom: true, postes: { select: { id: true, nom: true } } },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      });

      const result = await Promise.all(employes.map(async (emp) => {
        const [weekends, accordees, congesRecup, solde] = await Promise.all([
          prisma.jourWeekendTravaille.findMany({
            where: { employeId: emp.id, date: { gte: debut, lte: fin } },
            orderBy: { date: 'desc' },
          }),
          prisma.recuperationAccordee.findMany({
            where: { employeId: emp.id, annee: anneeNum },
            orderBy: { dateAccordee: 'desc' },
          }),
          prisma.conge.findMany({
            where: { employeId: emp.id, type: 'RECUPERATION', dateDebut: { gte: debut, lte: fin } },
            orderBy: { dateDebut: 'desc' },
          }),
          prisma.soldeConge.findFirst({
            where: { employeId: emp.id, annee: anneeNum, type: 'RECUPERATION' },
          }),
        ]);

        return { employe: emp, weekends, accordees, congesRecup, solde };
      }));

      res.json({ recuperations: result, annee: anneeNum });
    } catch (error) {
      logger.error({ err: error }, 'List recuperations error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/rh/recuperations/accorder
   * Accorder des jours de récupération à un employé
   */
  async accorderRecuperation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { employeId, nbJours, motif, annee = new Date().getFullYear() } = req.body;

      if (!employeId || !nbJours || nbJours <= 0) {
        return res.status(400).json({ error: 'employeId et nbJours (> 0) requis' });
      }

      const employe = await prisma.employe.findUnique({ where: { id: employeId } });
      if (!employe) return res.status(404).json({ error: 'Employé non trouvé' });

      const accordee = await prisma.recuperationAccordee.create({
        data: {
          employeId,
          nbJours,
          motif: motif || null,
          accordeeParId: req.user?.id || null,
          annee: parseInt(annee.toString()),
        },
        include: {
          employe: { select: { id: true, nom: true, prenom: true } },
        },
      });

      // Recalculer le solde
      recalculerRecuperation(employeId, parseInt(annee.toString())).catch((err) => {
        logger.error({ err }, 'recalculerRecuperation failed after accord');
      });

      res.status(201).json({ accordee });
    } catch (error) {
      logger.error({ err: error }, 'Accorder recuperation error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/rh/recuperations/accordees/:id
   * Supprimer une récupération accordée
   */
  async deleteRecuperationAccordee(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const accordee = await prisma.recuperationAccordee.findUnique({ where: { id } });
      if (!accordee) return res.status(404).json({ error: 'Récupération non trouvée' });

      await prisma.recuperationAccordee.delete({ where: { id } });

      recalculerRecuperation(accordee.employeId, accordee.annee).catch((err) => {
        logger.error({ err }, 'recalculerRecuperation failed after delete accord');
      });

      res.json({ message: 'Récupération supprimée' });
    } catch (error) {
      logger.error({ err: error }, 'Delete recuperation accordee error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default rhController;
