import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { startOfYear, endOfYear, startOfWeek, endOfWeek, addWeeks, isFriday, isSaturday, parseISO, format } from 'date-fns';

export const rhController = {
  // ============ CONGES ============

  /**
   * GET /api/rh/conges
   * Liste des congés avec filtres
   */
  async listConges(req: AuthRequest, res: Response) {
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
      console.error('List conges error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/rh/conges
   * Créer une demande de congé
   */
  async createConge(req: AuthRequest, res: Response) {
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
      console.error('Create conge error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/rh/conges/:id/approuver
   * Approuver ou refuser un congé
   */
  async approuverConge(req: AuthRequest, res: Response) {
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
        await prisma.soldeConge.upsert({
          where: { employeId_annee_type: { employeId: conge.employeId, annee, type: conge.type } },
          update: {
            joursPris: { increment: conge.nbJours },
            joursRestants: { decrement: conge.nbJours },
          },
          create: {
            employeId: conge.employeId,
            annee,
            type: conge.type,
            joursAcquis: 0,
            joursPris: conge.nbJours,
            joursRestants: -conge.nbJours,
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
      console.error('Approuver conge error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/rh/conges/:id
   * Annuler un congé (seulement si en attente ou futur)
   */
  async annulerConge(req: AuthRequest, res: Response) {
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
      console.error('Annuler conge error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ JOURS WEEKEND TRAVAILLES ============

  /**
   * GET /api/rh/weekend-travailles
   * Liste des jours de weekend travaillés
   */
  async listWeekendTravailles(req: AuthRequest, res: Response) {
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
      console.error('List weekend travailles error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/rh/weekend-travailles
   * Enregistrer un jour de weekend travaillé
   */
  async createWeekendTravaille(req: AuthRequest, res: Response) {
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

      // Recalculer les jours de récupération pour cet employé
      await this.recalculerRecuperation(employeId, dateObj.getFullYear());

      res.status(201).json({ jour });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ce jour est déjà enregistré pour cet employé' });
      }
      console.error('Create weekend travaille error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/rh/weekend-travailles/:id
   * Supprimer un jour de weekend travaillé
   */
  async deleteWeekendTravaille(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const jour = await prisma.jourWeekendTravaille.findUnique({ where: { id } });

      if (!jour) {
        return res.status(404).json({ error: 'Jour non trouvé' });
      }

      await prisma.jourWeekendTravaille.delete({ where: { id } });

      // Recalculer les jours de récupération
      await this.recalculerRecuperation(jour.employeId, jour.date.getFullYear());

      res.json({ message: 'Jour supprimé' });
    } catch (error) {
      console.error('Delete weekend travaille error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ SOLDES ============

  /**
   * GET /api/rh/soldes
   * Récupérer les soldes de congés
   */
  async getSoldes(req: AuthRequest, res: Response) {
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
      console.error('Get soldes error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/rh/soldes
   * Mettre à jour ou créer un solde (pour définir les jours acquis)
   */
  async updateSolde(req: AuthRequest, res: Response) {
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
      console.error('Update solde error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ CALCUL RECUPERATION ============

  /**
   * Recalculer les jours de récupération pour un employé
   * Règles:
   * - 1 jour de weekend requis toutes les 2 semaines
   * - Weekend complet travaillé (ven + sam) = 1 jour récup
   * - 2 weekends consécutifs travaillés = 1 jour récup
   */
  async recalculerRecuperation(employeId: string, annee: number) {
    const debut = startOfYear(new Date(annee, 0, 1));
    const fin = endOfYear(new Date(annee, 0, 1));

    // Récupérer tous les jours de weekend travaillés pour cette année
    const jours = await prisma.jourWeekendTravaille.findMany({
      where: {
        employeId,
        date: { gte: debut, lte: fin },
      },
      orderBy: { date: 'asc' },
    });

    // Grouper par semaine (numéro de semaine ISO)
    const parSemaine: Map<string, { vendredi: boolean; samedi: boolean }> = new Map();

    for (const jour of jours) {
      // Clé = année-semaine
      const weekStart = startOfWeek(jour.date, { weekStartsOn: 0 }); // Dimanche
      const weekKey = format(weekStart, 'yyyy-ww');

      if (!parSemaine.has(weekKey)) {
        parSemaine.set(weekKey, { vendredi: false, samedi: false });
      }

      const semaine = parSemaine.get(weekKey)!;
      if (jour.estVendredi) {
        semaine.vendredi = true;
      } else {
        semaine.samedi = true;
      }
    }

    // Calculer les jours de récupération
    let joursRecup = 0;
    const semaines = Array.from(parSemaine.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    // Compteur pour les semaines consécutives travaillées
    let semainesConsecutives = 0;

    for (let i = 0; i < semaines.length; i++) {
      const [weekKey, { vendredi, samedi }] = semaines[i];

      // Weekend complet = 1 jour récup
      if (vendredi && samedi) {
        joursRecup += 1;
        semainesConsecutives = 1; // Reset car on a déjà donné la récup
        continue;
      }

      // Au moins un jour travaillé ce weekend
      if (vendredi || samedi) {
        semainesConsecutives++;

        // Si 2 weekends consécutifs travaillés, 1 jour récup
        // (car normalement c'est 1 weekend sur 2)
        if (semainesConsecutives >= 2) {
          joursRecup += 1;
          semainesConsecutives = 0; // Reset
        }
      }
    }

    // Mettre à jour le solde de récupération
    const joursPris = await prisma.conge.aggregate({
      where: {
        employeId,
        type: 'RECUPERATION',
        statut: 'APPROUVE',
        dateDebut: { gte: debut, lte: fin },
      },
      _sum: { nbJours: true },
    });

    const totalPris = joursPris._sum.nbJours || 0;

    await prisma.soldeConge.upsert({
      where: { employeId_annee_type: { employeId, annee, type: 'RECUPERATION' } },
      update: {
        joursAcquis: joursRecup,
        joursPris: totalPris,
        joursRestants: joursRecup - totalPris,
      },
      create: {
        employeId,
        annee,
        type: 'RECUPERATION',
        joursAcquis: joursRecup,
        joursPris: totalPris,
        joursRestants: joursRecup - totalPris,
      },
    });

    return joursRecup;
  },

  /**
   * GET /api/rh/employes/:id/recap
   * Récapitulatif RH d'un employé
   */
  async getEmployeRecap(req: AuthRequest, res: Response) {
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
      const joursRecupCalcules = await this.recalculerRecuperation(id, anneeNum);

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
      console.error('Get employe recap error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/rh/dashboard
   * Dashboard RH
   */
  async getDashboard(req: AuthRequest, res: Response) {
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
      console.error('Get dashboard RH error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default rhController;
