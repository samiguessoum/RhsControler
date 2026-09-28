import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import planningService from '../services/planning.service.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';


type SiteInput = Record<string, any>;

/** Données d'un ContratSite à enregistrer (identiques en création et en modification). */
function contratSiteData(cs: SiteInput) {
  return {
    siteId: cs.siteId,
    prestations: cs.prestations || [],
    prixPrestations: cs.prixPrestations ?? {},
    frequenceOperationsJours: cs.frequenceOperationsJours ?? null,
    frequenceOperationsMois: cs.frequenceOperationsMois ?? null,
    premiereDateOperation: cs.premiereDateOperation ?? null,
    nombreOperations: cs.nombreOperations ?? null,
    nombreVisitesControleEntreOps: cs.nombreVisitesControleEntreOps ?? null,
    montantHT: cs.montantHT ?? null,
    notes: cs.notes ?? null,
  };
}

/** Dates explicites saisies par site dans le formulaire (prioritaires sur la fréquence). */
function siteOverrides(contratSites?: SiteInput[]) {
  const overrides = (contratSites || [])
    .filter((cs) => cs.datesPrevuesOperations?.length || cs.datesPrevuesControles?.length)
    .map((cs) => ({
      siteId: cs.siteId as string,
      datesPrevuesOperations: cs.datesPrevuesOperations?.map((d: string) => new Date(d)),
      datesPrevuesControles: cs.datesPrevuesControles?.map((d: string) => new Date(d)),
    }));
  return overrides.length ? overrides : undefined;
}

/**
 * Garde-fou : aucune date saisie dans la projection avant la signature de la convention (à défaut,
 * avant le début de la période) ni après la fin de convention. Renvoie le message d'erreur éventuel.
 */
function dateHorsConvention(contrat: Record<string, any>, contratSites?: SiteInput[]): string | null {
  const jour = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const debut = jour(contrat.dateDebutConvention) ?? jour(contrat.dateDebut);
  const fin = jour(contrat.dateFinConvention);
  if (contrat.dateDebutConvention && fin && fin < debut!) return 'La fin de convention est antérieure à sa date de signature';
  for (const cs of contratSites || []) {
    // Les visites après la dernière opération ne sont pas planifiées : elles ne comptent pas
    const ops: string[] = (cs.datesPrevuesOperations || []).map(jour).filter(Boolean);
    const derniereOp = ops.reduce((max: string | null, d) => (!max || d > max ? d : max), null);
    const ctrl: string[] = (cs.datesPrevuesControles || []).map(jour).filter((d: string | null) => d && (!derniereOp || d <= derniereOp));
    for (const j of [...ops, ...ctrl]) {
      if (debut && j < debut) return `Intervention prévue le ${j} avant le début de la convention (${debut})`;
      if (fin && j > fin) return `Intervention prévue le ${j} après la fin de la convention (${fin})`;
    }
  }
  return null;
}

/**
 * Empreinte des paramètres qui déterminent le planning d'un contrat : si elle ne change pas
 * (nom, notes, responsable, BC, convention…), le planning existant n'est pas touché.
 */
function empreintePlanning(contrat: Record<string, any>, sites: SiteInput[]) {
  const jour = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const champsSite = (cs: SiteInput) => ({
    siteId: cs.siteId,
    prestations: [...(cs.prestations || [])].sort(),
    fOpJ: cs.frequenceOperationsJours ?? null,
    fOpM: cs.frequenceOperationsMois ?? null,
    dOp: jour(cs.premiereDateOperation),
    nOp: cs.nombreOperations ?? null,
    nCtEO: cs.nombreVisitesControleEntreOps ?? null,
  });
  return JSON.stringify({
    type: contrat.type,
    dateFin: jour(contrat.dateFin),
    prestations: [...(contrat.prestations || [])].sort(),
    fOpJ: contrat.frequenceOperationsJours ?? null,
    fOpM: contrat.frequenceOperationsMois ?? null,
    dOp: jour(contrat.premiereDateOperation),
    nOp: contrat.nombreOperations ?? null,
    nCtEO: contrat.nombreVisitesControleEntreOps ?? null,
    debutConvention: jour(contrat.dateDebutConvention),
    finConvention: jour(contrat.dateFinConvention),
    dateReprise: jour(contrat.datePriseEnComptePlanification),
    sites: sites.map(champsSite).sort((a, b) => a.siteId.localeCompare(b.siteId)),
  });
}

export const contratController = {
  /**
   * GET /api/contrats
   */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { clientId, statut, type, page = '1', limit = '20' } = req.query;

      const where: any = {};

      if (clientId) where.clientId = clientId;
      if (statut) where.statut = statut;
      if (type) where.type = type;

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 20, 1000);
      const skip = (pageNum - 1) * limitNum;

      const [contrats, total] = await Promise.all([
        prisma.contrat.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { dateDebut: 'desc' },
          include: {
            client: {
              select: {
                id: true,
                nomEntreprise: true,
                sites: { select: { id: true, nom: true, adresse: true } },
              },
            },
            responsablePlanning: {
              select: { id: true, nom: true, prenom: true },
            },
            contratSites: {
              include: {
                site: { select: { id: true, nom: true, adresse: true } },
              },
            },
            _count: {
              select: { interventions: true },
            },
          },
        }),
        prisma.contrat.count({ where }),
      ]);

      res.json({
        contrats,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'List contrats error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/contrats/:id
   */
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const contrat = await prisma.contrat.findUnique({
        where: { id },
        include: {
          client: {
            include: { sites: true },
          },
          responsablePlanning: {
            select: { id: true, nom: true, prenom: true, email: true },
          },
          contratSites: {
            include: {
              site: true,
            },
          },
          bonsCommandes: {
            orderBy: { createdAt: 'desc' },
          },
          avenants: {
            orderBy: { numero: 'asc' },
            include: {
              createdBy: { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
      });

      if (!contrat) {
        return res.status(404).json({ error: 'Contrat non trouvé' });
      }

      res.json({ contrat });
    } catch (error) {
      logger.error({ err: error }, 'Get contrat error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/contrats
   * Crée le contrat ET génère automatiquement le planning
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body;

      // Vérifier que le client existe
      const client = await prisma.client.findUnique({
        where: { id: data.clientId },
      });

      if (!client) {
        return res.status(400).json({ error: 'Client non trouvé' });
      }

      if (!client.actif) {
        return res.status(400).json({ error: 'Impossible de créer un contrat pour un client inactif' });
      }

      const horsConvention = dateHorsConvention(data, data.contratSites);
      if (horsConvention) {
        return res.status(400).json({ error: horsConvention });
      }

      const contrat = await prisma.contrat.create({
        data: {
          clientId: data.clientId,
          nom: data.nom || null,
          type: data.type,
          dateDebut: data.dateDebut,
          dateFin: data.dateFin,
          reconductionAuto: data.reconductionAuto ?? false,
          prestations: data.prestations,
          frequenceOperationsJours: data.frequenceOperationsJours ?? null,
          frequenceOperationsMois: data.frequenceOperationsMois ?? null,
          premiereDateOperation: data.premiereDateOperation ?? null,
          nombreVisitesControleEntreOps: data.nombreVisitesControleEntreOps ?? null,
          montantHT: data.montantHT ?? null,
          planningAajuster: data.planningAajuster ?? false,
          datePriseEnComptePlanification: data.datePriseEnComptePlanification ?? null,
          responsablePlanningId: data.responsablePlanningId ?? null,
          statut: data.statut ?? 'ACTIF',
          notes: data.notes ?? null,
          autoCreerProchaine: true,
          numeroBonCommande: data.numeroBonCommande ?? null,
          nombreOperations: data.nombreOperations ?? null,
          dateDebutConvention: data.dateDebutConvention ?? null,
          dateFinConvention: data.dateFinConvention ?? null,
        },
        include: {
          client: {
            select: { id: true, nomEntreprise: true },
          },
        },
      });

      // Créer les ContratSites si fournis
      for (const cs of data.contratSites || []) {
        await prisma.contratSite.create({ data: { contratId: contrat.id, ...contratSiteData(cs) } });
      }

      // Audit log
      await createAuditLog(req.user!.id, 'CREATE', 'Contrat', contrat.id, { after: contrat });

      // Générer automatiquement le planning si le contrat est ACTIF
      let planningResult = null;
      let planningErreur: string | null = null;
      if (contrat.statut === 'ACTIF') {
        try {
          planningResult = await planningService.genererPlanningContrat(contrat.id, req.user!.id, siteOverrides(data.contratSites));
        } catch (planningError: any) {
          logger.error({ err: planningError }, 'Auto-planning generation error');
          planningErreur = planningError?.message ?? 'Erreur inconnue';
        }
      }

      res.status(201).json({
        contrat,
        planning: planningResult ? { interventionsCreees: planningResult.count } : null,
        planningErreur,
      });
    } catch (error) {
      logger.error({ err: error }, 'Create contrat error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * PUT /api/contrats/:id
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.contrat.findUnique({ where: { id }, include: { contratSites: true } });

      if (!existing) {
        return res.status(404).json({ error: 'Contrat non trouvé' });
      }

      // Validation spéciale si on passe en ACTIF
      if (data.statut === 'ACTIF' && existing.statut !== 'ACTIF') {
        const hasContratSites = data.contratSites && data.contratSites.length > 0;
        if (!hasContratSites) {
          const hasFrequenceOp = data.frequenceOperationsJours ?? existing.frequenceOperationsJours;
          const hasDateOp = data.premiereDateOperation ?? existing.premiereDateOperation;
          if (hasFrequenceOp && !hasDateOp) {
            return res.status(400).json({
              error: 'Date de première opération requise pour la fréquence d\'opérations',
            });
          }
        }
      }

      const horsConvention = dateHorsConvention(
        {
          dateDebut: data.dateDebut ?? existing.dateDebut,
          dateDebutConvention: data.dateDebutConvention !== undefined ? data.dateDebutConvention : existing.dateDebutConvention,
          dateFinConvention: data.dateFinConvention !== undefined ? data.dateFinConvention : existing.dateFinConvention,
        },
        data.contratSites,
      );
      if (horsConvention) {
        return res.status(400).json({ error: horsConvention });
      }

      const contrat = await prisma.contrat.update({
        where: { id },
        data: {
          clientId: data.clientId ?? existing.clientId,
          nom: data.nom !== undefined ? (data.nom || null) : existing.nom,
          type: data.type ?? existing.type,
          dateDebut: data.dateDebut ?? existing.dateDebut,
          dateFin: data.dateFin !== undefined ? data.dateFin : existing.dateFin,
          reconductionAuto: data.reconductionAuto ?? existing.reconductionAuto,
          prestations: data.prestations ?? existing.prestations,
          frequenceOperationsJours: data.frequenceOperationsJours !== undefined ? data.frequenceOperationsJours : existing.frequenceOperationsJours,
          frequenceOperationsMois: data.frequenceOperationsMois !== undefined ? data.frequenceOperationsMois : (existing as any).frequenceOperationsMois,
          premiereDateOperation: data.premiereDateOperation !== undefined ? data.premiereDateOperation : existing.premiereDateOperation,
          nombreVisitesControleEntreOps: data.nombreVisitesControleEntreOps !== undefined ? data.nombreVisitesControleEntreOps : (existing as any).nombreVisitesControleEntreOps,
          montantHT: data.montantHT !== undefined ? data.montantHT : (existing as any).montantHT,
          planningAajuster: data.planningAajuster !== undefined ? data.planningAajuster : (existing as any).planningAajuster,
          datePriseEnComptePlanification: data.datePriseEnComptePlanification !== undefined ? data.datePriseEnComptePlanification : existing.datePriseEnComptePlanification,
          responsablePlanningId: data.responsablePlanningId !== undefined ? data.responsablePlanningId : existing.responsablePlanningId,
          statut: data.statut ?? existing.statut,
          notes: data.notes !== undefined ? (data.notes || null) : existing.notes,
          autoCreerProchaine: true,
          numeroBonCommande: data.numeroBonCommande !== undefined ? data.numeroBonCommande : existing.numeroBonCommande,
          nombreOperations: data.nombreOperations !== undefined ? data.nombreOperations : existing.nombreOperations,
          dateDebutConvention: data.dateDebutConvention !== undefined ? data.dateDebutConvention : existing.dateDebutConvention,
          dateFinConvention: data.dateFinConvention !== undefined ? data.dateFinConvention : existing.dateFinConvention,
        },
        include: {
          client: {
            select: { id: true, nomEntreprise: true },
          },
        },
      });

      // Mettre à jour les ContratSites si fournis
      if (data.contratSites !== undefined) {
        await prisma.contratSite.deleteMany({ where: { contratId: id } });
        for (const cs of data.contratSites || []) {
          await prisma.contratSite.create({ data: { contratId: id, ...contratSiteData(cs) } });
        }
      }

      // Régénérer le planning uniquement si ses paramètres ont changé (ou si le contrat est
      // réactivé, ou si des dates ont été saisies explicitement). Les interventions réalisées,
      // supprimées par un utilisateur, issues d'avenants ou de bons de commande et les autres types
      // (réclamations…) sont conservées, et les échéances déjà réalisées ne sont pas recréées.
      const sitesApres = data.contratSites !== undefined ? data.contratSites : existing.contratSites;
      const planningModifie =
        empreintePlanning(existing, existing.contratSites) !== empreintePlanning(contrat, sitesApres) ||
        existing.statut !== 'ACTIF' ||
        !!siteOverrides(data.contratSites);

      let planningErreurUpdate: string | null = null;
      if (contrat.statut === 'ACTIF' && planningModifie) {
        try {
          await planningService.regenererPlanningContrat(id, req.user!.id, siteOverrides(data.contratSites));
        } catch (planningError: any) {
          logger.error({ err: planningError }, 'Auto-planning update error');
          planningErreurUpdate = planningError?.message ?? 'Erreur inconnue';
        }
      }

      // Audit log
      await createAuditLog(req.user!.id, 'UPDATE', 'Contrat', contrat.id, {
        before: existing,
        after: contrat,
      });

      res.json({ contrat, planningErreur: planningErreurUpdate });
    } catch (error) {
      logger.error({ err: error }, 'Update contrat error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/contrats/:id
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const existing = await prisma.contrat.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Contrat non trouvé' });
      }

      // Supprimer toutes les interventions associées
      await prisma.intervention.deleteMany({
        where: { contratId: id },
      });

      // ContratSites supprimés en cascade (onDelete: Cascade)

      await prisma.contrat.delete({
        where: { id },
      });

      // Audit log
      await createAuditLog(req.user!.id, 'DELETE', 'Contrat', id);

      res.json({ message: 'Contrat supprimé' });
    } catch (error) {
      logger.error({ err: error }, 'Delete contrat error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default contratController;
