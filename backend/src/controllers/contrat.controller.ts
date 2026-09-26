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
    frequenceControleJours: cs.frequenceControleJours ?? null,
    frequenceOperationsMois: cs.frequenceOperationsMois ?? null,
    frequenceControleMois: cs.frequenceControleMois ?? null,
    premiereDateOperation: cs.premiereDateOperation ?? null,
    premiereDateControle: cs.premiereDateControle ?? null,
    nombreOperations: cs.nombreOperations ?? null,
    nombreVisitesControle: cs.nombreVisitesControle ?? null,
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
    fCtJ: cs.frequenceControleJours ?? null,
    fCtM: cs.frequenceControleMois ?? null,
    dOp: jour(cs.premiereDateOperation),
    dCt: jour(cs.premiereDateControle),
    nOp: cs.nombreOperations ?? null,
    nCt: cs.nombreVisitesControle ?? null,
  });
  return JSON.stringify({
    type: contrat.type,
    dateFin: jour(contrat.dateFin),
    prestations: [...(contrat.prestations || [])].sort(),
    fOpJ: contrat.frequenceOperationsJours ?? null,
    fCtJ: contrat.frequenceControleJours ?? null,
    dOp: jour(contrat.premiereDateOperation),
    dCt: jour(contrat.premiereDateControle),
    nOp: contrat.nombreOperations ?? null,
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
          interventions: {
            where: { remplaceeParOperation: false },
            orderBy: { datePrevue: 'asc' },
            include: {
              createdBy: {
                select: { id: true, nom: true, prenom: true },
              },
              site: {
                select: { id: true, nom: true, adresse: true },
              },
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

      const contrat = await prisma.contrat.create({
        data: {
          clientId: data.clientId,
          nom: data.nom || null,
          type: data.type,
          dateDebut: data.dateDebut,
          dateFin: data.dateFin,
          reconductionAuto: data.reconductionAuto ?? false,
          prestations: data.prestations,
          frequenceOperationsJours: data.frequenceOperationsJours,
          frequenceControleJours: data.frequenceControleJours,
          premiereDateOperation: data.premiereDateOperation,
          premiereDateControle: data.premiereDateControle,
          responsablePlanningId: data.responsablePlanningId,
          statut: data.statut ?? 'ACTIF',
          notes: data.notes,
          autoCreerProchaine: true,
          numeroBonCommande: data.numeroBonCommande,
          nombreOperations: data.nombreOperations,
          dateDebutConvention: data.dateDebutConvention,
          dateFinConvention: data.dateFinConvention,
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
      if (contrat.statut === 'ACTIF') {
        try {
          planningResult = await planningService.genererPlanningContrat(contrat.id, req.user!.id, siteOverrides(data.contratSites));
        } catch (planningError) {
          logger.error({ err: planningError }, 'Auto-planning generation error');
          // On ne bloque pas la création du contrat si le planning échoue
        }
      }

      res.status(201).json({
        contrat,
        planning: planningResult
          ? { interventionsCreees: planningResult.count }
          : null,
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
          const hasFrequenceCtrl = data.frequenceControleJours ?? existing.frequenceControleJours;
          const hasDateOp = data.premiereDateOperation ?? existing.premiereDateOperation;
          const hasDateCtrl = data.premiereDateControle ?? existing.premiereDateControle;

          if (!hasFrequenceOp && !hasFrequenceCtrl) {
            return res.status(400).json({
              error: 'Un contrat actif nécessite au moins une fréquence (opérations ou contrôle)',
            });
          }

          if (hasFrequenceOp && !hasDateOp) {
            return res.status(400).json({
              error: 'Date de première opération requise pour la fréquence d\'opérations',
            });
          }

          if (hasFrequenceCtrl && !hasDateCtrl) {
            return res.status(400).json({
              error: 'Date de premier contrôle requise pour la fréquence de contrôle',
            });
          }
        }
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
          frequenceControleJours: data.frequenceControleJours !== undefined ? data.frequenceControleJours : existing.frequenceControleJours,
          premiereDateOperation: data.premiereDateOperation !== undefined ? data.premiereDateOperation : existing.premiereDateOperation,
          premiereDateControle: data.premiereDateControle !== undefined ? data.premiereDateControle : existing.premiereDateControle,
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

      if (contrat.statut === 'ACTIF' && planningModifie) {
        try {
          await planningService.regenererPlanningContrat(id, req.user!.id, siteOverrides(data.contratSites));
        } catch (planningError) {
          logger.error({ err: planningError }, 'Auto-planning update error');
        }
      }

      // Audit log
      await createAuditLog(req.user!.id, 'UPDATE', 'Contrat', contrat.id, {
        before: existing,
        after: contrat,
      });

      res.json({ contrat });
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
