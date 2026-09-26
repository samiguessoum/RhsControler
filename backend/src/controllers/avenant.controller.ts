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
        dateSignature,
        montantHT,
        nombreOperationsSupplementaires,
        nombreVisitesControleSupplementaires,
        dateDebut,
        frequenceJours,
        notes,
      } = req.body;

      const contrat = await prisma.contrat.findUnique({ where: { id: contratId } });
      if (!contrat) {
        return next(new AppError(404, 'Contrat non trouvé'));
      }
      if (contrat.type !== 'PONCTUEL') {
        return next(new AppError(400, 'Les avenants ne concernent que les contrats ponctuels'));
      }

      const dernierAvenant = await prisma.avenant.findFirst({
        where: { contratId },
        orderBy: { numero: 'desc' },
      });
      const numero = (dernierAvenant?.numero ?? 0) + 1;

      const nbOps = nombreOperationsSupplementaires ?? 0;
      const nbCtrl = nombreVisitesControleSupplementaires ?? 0;

      const avenant = await prisma.avenant.create({
        data: {
          contratId,
          numero,
          dateSignature: dateSignature ? new Date(dateSignature) : null,
          montantHT: montantHT ?? null,
          nombreOperationsSupplementaires: nbOps,
          nombreVisitesControleSupplementaires: nbCtrl,
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
          nbCtrl,
          { dateDebut, frequenceJours },
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
