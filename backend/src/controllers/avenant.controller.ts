import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { parsePeriodesFrequence } from '../utils/date.utils.js';
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
        frequenceOperationsJours,
        frequenceOperationsMois,
        periodesFrequence,
        notes,
      } = req.body;
      // Fréquence propre à l'avenant (mois prioritaire sur jours) et ses périodes saisonnières
      const freqMoisAvenant: number | null = frequenceOperationsMois || null;
      const freqJoursAvenant: number | null = freqMoisAvenant ? null : (frequenceOperationsJours || null);
      const periodesAvenant = parsePeriodesFrequence(periodesFrequence);

      const contrat = await prisma.contrat.findUnique({ where: { id: contratId } });
      if (!contrat) {
        return next(new AppError(404, 'Contrat non trouvé'));
      }


      // Garde-fou convention, comme à la création du contrat
      const jour = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);
      const debutConvention = jour(contrat.dateDebutConvention) ?? jour(contrat.dateDebut);
      const finConvention = jour(contrat.dateFinConvention);
      const aVerifier = [...(datesOperations || []), ...(datesControles || [])].map(jour).filter(Boolean) as string[];
      for (const j of aVerifier) {
        if (debutConvention && j < debutConvention) {
          return next(new AppError(400, `Intervention prévue le ${j} avant le début de la convention (${debutConvention})`));
        }
        if (finConvention && j > finConvention) {
          return next(new AppError(400, `Intervention prévue le ${j} après la fin de la convention (${finConvention})`));
        }
      }

      const nbOps = datesOperations ? datesOperations.length : (nombreOperationsSupplementaires ?? 0);
      const nbCtrlEntreOps = nombreVisitesControleEntreOps ?? 0;

      // findFirst + create dans une transaction pour éviter les doublons de numérotation
      const avenant = await prisma.$transaction(async (tx) => {
        const dernierAvenant = await tx.avenant.findFirst({
          where: { contratId },
          orderBy: { numero: 'desc' },
        });
        const numero = (dernierAvenant?.numero ?? 0) + 1;

        return tx.avenant.create({
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
            frequenceOperationsJours: freqJoursAvenant,
            frequenceOperationsMois: freqMoisAvenant,
            periodesFrequence: periodesAvenant,
            notes: notes || null,
            createdById: req.user!.id,
          },
        });
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
            frequence: freqJoursAvenant || freqMoisAvenant ? { jours: freqJoursAvenant, mois: freqMoisAvenant } : undefined,
            periodes: periodesAvenant,
            fin: dateExpiration ? new Date(dateExpiration) : null,
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
  /**
   * PUT /api/contrats/:contratId/avenants/:avenantId
   * Met à jour les métadonnées d'un avenant (pas le planning).
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { contratId, avenantId } = req.params;
      const { nom, numeroBonCommande, dateSignature, dateExpiration, montantHT, notes } = req.body;

      if (dateSignature && isNaN(new Date(dateSignature).getTime())) {
        return next(new AppError(400, 'dateSignature invalide'));
      }
      if (dateExpiration && isNaN(new Date(dateExpiration).getTime())) {
        return next(new AppError(400, 'dateExpiration invalide'));
      }

      const avenant = await prisma.avenant.findUnique({ where: { id: avenantId } });
      if (!avenant || avenant.contratId !== contratId) {
        return next(new AppError(404, 'Avenant non trouvé'));
      }

      const updated = await prisma.avenant.update({
        where: { id: avenantId },
        data: {
          nom: nom !== undefined ? (nom || null) : avenant.nom,
          numeroBonCommande: numeroBonCommande !== undefined ? (numeroBonCommande || null) : avenant.numeroBonCommande,
          dateSignature: dateSignature !== undefined ? (dateSignature ? new Date(dateSignature) : null) : avenant.dateSignature,
          dateExpiration: dateExpiration !== undefined ? (dateExpiration ? new Date(dateExpiration) : null) : avenant.dateExpiration,
          montantHT: montantHT !== undefined ? (montantHT ?? null) : avenant.montantHT,
          notes: notes !== undefined ? (notes || null) : avenant.notes,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Avenant', avenantId, {
        before: avenant,
        after: updated,
      });

      res.json({ avenant: updated });
    } catch (error) {
      logger.error({ err: error }, 'Avenant update error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/contrats/:contratId/avenants/:avenantId
   * Supprime un avenant et ses interventions non réalisées.
   * Bloque si des interventions réalisées existent (données historiques).
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { contratId, avenantId } = req.params;

      const avenant = await prisma.avenant.findUnique({
        where: { id: avenantId },
        include: { interventions: { select: { id: true, statut: true } } },
      });

      if (!avenant || avenant.contratId !== contratId) {
        return next(new AppError(404, 'Avenant non trouvé'));
      }

      const realisees = avenant.interventions.filter((i) => i.statut === 'REALISEE');
      if (realisees.length > 0) {
        return next(new AppError(409, `Impossible de supprimer cet avenant : ${realisees.length} intervention(s) ont déjà été réalisées.`));
      }

      await prisma.$transaction(async (tx) => {
        await tx.intervention.deleteMany({ where: { avenantId } });
        await tx.avenant.delete({ where: { id: avenantId } });
      });

      await createAuditLog(req.user!.id, 'DELETE', 'Avenant', avenantId, {
        before: { contratId, numero: avenant.numero },
      });

      res.json({ message: 'Avenant supprimé' });
    } catch (error) {
      logger.error({ err: error }, 'Avenant delete error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default avenantController;
