import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import logger from '../lib/logger.js';
import { createAuditLog } from './audit.controller.js';
import { planningService } from '../services/planning.service.js';

export const avenantController = {
  /**
   * GET /api/contrats/:contratId/avenants
   * Liste les avenants d'un contrat ponctuel, avec leurs interventions
   */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { contratId } = req.params;

      const avenants = await prisma.avenant.findMany({
        where: { contratId },
        include: {
          createdBy: { select: { id: true, nom: true, prenom: true } },
          interventions: {
            where: { remplaceeParOperation: false },
            select: { id: true, type: true, datePrevue: true, statut: true },
            orderBy: { datePrevue: 'asc' },
          },
        },
        orderBy: { numero: 'asc' },
      });

      res.json({ avenants, count: avenants.length });
    } catch (error) {
      logger.error({ err: error }, 'Avenant list error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/contrats/:contratId/avenants
   * Crée un avenant sur un contrat ponctuel et génère les interventions supplémentaires
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { contratId } = req.params;
      const {
        nom,
        numeroBonCommande,
        dateSignature,
        dateExpiration,
        montantHT,
        nombreOperationsSupplementaires,
        nombreVisitesControleEntreOps,
        datesOperations,
        datesControles,
        notes,
      } = req.body;

      const contrat = await prisma.contrat.findUnique({ where: { id: contratId } });
      if (!contrat) {
        return next(new AppError(404, 'Contrat non trouvé'));
      }


      // Garde-fou convention, comme à la création du contrat (les visites après la dernière
      // opération ne sont pas planifiées : elles ne comptent pas)
      const jour = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);
      const debutConvention = jour(contrat.dateDebutConvention) ?? jour(contrat.dateDebut);
      const finConvention = jour(contrat.dateFinConvention);
      const opsPrevues: string[] = (datesOperations || []).map(jour).filter(Boolean);
      if ((datesControles || []).length) {
        const opsExistantes = await prisma.intervention.findMany({
          where: { contratId, type: 'OPERATION', statut: { not: 'ANNULEE' } },
          select: { datePrevue: true },
        });
        opsPrevues.push(...opsExistantes.map((o) => jour(o.datePrevue)!));
      }
      const derniereOp = opsPrevues.reduce((max: string | null, d) => (!max || d > max ? d : max), null);
      const aVerifier = [
        ...(datesOperations || []).map(jour),
        ...(datesControles || []).map(jour).filter((d: string | null) => !derniereOp || d! <= derniereOp),
      ].filter(Boolean) as string[];
      for (const j of aVerifier) {
        if (debutConvention && j < debutConvention) {
          return next(new AppError(400, `Intervention prévue le ${j} avant le début de la convention (${debutConvention})`));
        }
        if (finConvention && j > finConvention) {
          return next(new AppError(400, `Intervention prévue le ${j} après la fin de la convention (${finConvention})`));
        }
      }

      const dernierAvenant = await prisma.avenant.findFirst({
        where: { contratId },
        orderBy: { numero: 'desc' },
      });
      const numero = (dernierAvenant?.numero ?? 0) + 1;

      const nbOps = datesOperations ? datesOperations.length : (nombreOperationsSupplementaires ?? 0);
      const nbCtrlEntreOps = nombreVisitesControleEntreOps ?? 0;

      const avenant = await prisma.avenant.create({
        data: {
          contratId,
          numero,
          nom: nom || null,
          numeroBonCommande: numeroBonCommande || null,
          dateSignature: dateSignature ? new Date(dateSignature) : null,
          dateExpiration: dateExpiration ? new Date(dateExpiration) : null,
          montantHT: montantHT ?? null,
          nombreOperationsSupplementaires: nbOps,
          nombreVisitesControleSupplementaires: datesControles ? datesControles.length : nbCtrlEntreOps,
          notes: notes || null,
          createdById: req.user!.id,
        },
      });

      let interventionsCreees: any[] = [];
      try {
        const result = await planningService.genererInterventionsAvenant(
          contratId,
          avenant.id,
          req.user!.id,
          nbOps,
          nbCtrlEntreOps,
          {
            datesOperations: datesOperations?.map((d: string) => new Date(d)),
            datesControles: datesControles?.map((d: string) => new Date(d)),
          },
        );
        interventionsCreees = result.interventionsCreees;
      } catch (genError: any) {
        // Rien n'a été généré (les fréquences sont vérifiées avant toute création) :
        // on retire l'avenant pour ne pas laisser un avenant vide ni décaler la numérotation.
        await prisma.avenant.delete({ where: { id: avenant.id } });
        return next(new AppError(400, `Impossible de générer les interventions de l'avenant : ${genError.message}`));
      }

      await createAuditLog(req.user!.id, 'CREATE', 'Avenant', avenant.id, {
        after: { ...avenant, interventionsGenerees: interventionsCreees.length },
      });

      res.status(201).json({ avenant, interventionsCreees, count: interventionsCreees.length });
    } catch (error) {
      logger.error({ err: error }, 'Avenant create error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default avenantController;
