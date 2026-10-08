import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { parsePeriodesFrequence } from '../utils/date.utils.js';
import logger from '../lib/logger.js';
import { createAuditLog } from './audit.controller.js';
import { planningService } from '../services/planning.service.js';
import { Prisma } from '@prisma/client';

type NouveauBCAvenant = { numero: string; quotaPassages?: number | null; dateFinValidite?: string | null; siteIds?: string[] };

/** Vérifie le BC choisi pour un avenant (BC existant lié ou nouveau BC). Renvoie l'erreur, ou null. */
async function verifierBCAvenant(
  clientId: string,
  sitesContrat: string[],
  bonCommandeId: string | null | undefined,
  nouveauBC: NouveauBCAvenant | undefined,
): Promise<AppError | null> {
  if (bonCommandeId) {
    const bc = await prisma.bonCommande.findUnique({ where: { id: bonCommandeId }, select: { clientId: true, actif: true } });
    if (!bc || bc.clientId !== clientId) return new AppError(400, 'Bon de commande introuvable pour ce client');
    if (!bc.actif) return new AppError(400, 'Ce bon de commande est inactif');
  }
  if (nouveauBC) {
    if ((nouveauBC.siteIds ?? []).some((s) => !sitesContrat.includes(s))) {
      return new AppError(400, 'Site du BC non rattaché à ce contrat');
    }
    const existant = await prisma.bonCommande.findFirst({ where: { numero: nouveauBC.numero, clientId } });
    if (existant) {
      return new AppError(409, `Un BC n°${nouveauBC.numero} existe déjà pour ce client : liez-le comme BC existant`);
    }
  }
  return null;
}

/** Nouveau BC d'avenant : signé avec l'avenant, valable par défaut jusqu'à son expiration. */
function creerBCAvenant(
  tx: Prisma.TransactionClient,
  nouveauBC: NouveauBCAvenant,
  avenant: { clientId: string; contratId: string; dateSignature: Date | null; dateExpiration: Date | null; quotaDefaut?: number | null },
) {
  return tx.bonCommande.create({
    data: {
      numero: nouveauBC.numero,
      clientId: avenant.clientId,
      contratId: avenant.contratId,
      date: avenant.dateSignature,
      dateFinValidite: nouveauBC.dateFinValidite ? new Date(nouveauBC.dateFinValidite) : avenant.dateExpiration,
      quotaPassages: nouveauBC.quotaPassages ?? avenant.quotaDefaut ?? null,
      ...(nouveauBC.siteIds?.length
        ? { sites: { create: nouveauBC.siteIds.map((siteId) => ({ siteId })) } }
        : {}),
    },
  });
}

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
        siteIds,
        bonCommandeId,
        nouveauBC,
        notes,
      } = req.body;
      // Fréquence propre à l'avenant (mois prioritaire sur jours) et ses périodes saisonnières
      const freqMoisAvenant: number | null = frequenceOperationsMois || null;
      const freqJoursAvenant: number | null = freqMoisAvenant ? null : (frequenceOperationsJours || null);
      const periodesAvenant = parsePeriodesFrequence(periodesFrequence);

      const contrat = await prisma.contrat.findUnique({
        where: { id: contratId },
        include: { contratSites: { select: { siteId: true } } },
      });
      if (!contrat) {
        return next(new AppError(404, 'Contrat non trouvé'));
      }

      // Sites concernés : sous-ensemble des sites du contrat ; tous cochés = tous les sites (liste vide)
      const sitesContrat = contrat.contratSites.map((cs) => cs.siteId);
      const sitesAvenant: string[] = [...new Set((siteIds ?? []) as string[])];
      if (sitesAvenant.some((s) => !sitesContrat.includes(s))) {
        return next(new AppError(400, 'Site non rattaché à ce contrat'));
      }
      const sitesConcernes = sitesAvenant.length === sitesContrat.length ? [] : sitesAvenant;

      // BC de l'avenant : ses opérations le décomptent, il est réservé à l'avenant
      const erreurBC = await verifierBCAvenant(contrat.clientId, sitesContrat, bonCommandeId, nouveauBC);
      if (erreurBC) return next(erreurBC);

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
      const { avenant, bc } = await prisma.$transaction(async (tx) => {
        const dernierAvenant = await tx.avenant.findFirst({
          where: { contratId },
          orderBy: { numero: 'desc' },
        });
        const numero = (dernierAvenant?.numero ?? 0) + 1;

        const bc = nouveauBC
          ? await creerBCAvenant(tx, nouveauBC, {
              clientId: contrat.clientId,
              contratId,
              dateSignature: dateSignature ? new Date(dateSignature) : null,
              dateExpiration: dateExpiration ? new Date(dateExpiration) : null,
            })
          : bonCommandeId
            ? await tx.bonCommande.findUnique({ where: { id: bonCommandeId } })
            : null;

        const avenant = await tx.avenant.create({
          data: {
            contratId,
            numero,
            nom: nom || null,
            bonCommandeId: bc?.id ?? null,
            numeroBonCommande: bc?.numero ?? (numeroBonCommande || null),
            dateSignature: dateSignature ? new Date(dateSignature) : null,
            dateExpiration: dateExpiration ? new Date(dateExpiration) : null,
            montantHT: montantHT ?? null,
            nombreOperationsSupplementaires: nbOps,
            nombreVisitesControleSupplementaires: datesControles ? datesControles.length : nbCtrlEntreOps,
            frequenceOperationsJours: freqJoursAvenant,
            frequenceOperationsMois: freqMoisAvenant,
            periodesFrequence: periodesAvenant,
            siteIds: sitesConcernes,
            notes: notes || null,
            createdById: req.user!.id,
          },
        });
        return { avenant, bc };
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
            siteIds: sitesConcernes,
            bonCommandeId: bc?.id ?? null,
          },
        );
        interventionsCreees = result.interventionsCreees;
      } catch (genError: any) {
        // Rien n'a été généré (les fréquences sont vérifiées avant toute création) :
        // on retire l'avenant pour ne pas laisser un avenant vide ni décaler la numérotation.
        await prisma.avenant.delete({ where: { id: avenant.id } });
        if (nouveauBC && bc) await prisma.bonCommande.delete({ where: { id: bc.id } });
        return next(new AppError(400, `Impossible de générer les interventions de l'avenant : ${genError.message}`));
      }

      await createAuditLog(req.user!.id, 'CREATE', 'Avenant', avenant.id, {
        after: { ...avenant, interventionsGenerees: interventionsCreees.length },
      });

      res.status(201).json({ avenant, bonCommande: bc, interventionsCreees, count: interventionsCreees.length });
    } catch (error) {
      logger.error({ err: error }, 'Avenant create error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
  /**
   * PUT /api/contrats/:contratId/avenants/:avenantId
   * Met à jour les métadonnées d'un avenant (pas le planning) et, au besoin, son BC :
   * bonCommandeId (id = BC existant, null = plus de BC) ou nouveauBC. Le nouveau BC est posé sur
   * les opérations non réalisées de l'avenant ; les opérations réalisées gardent le BC qu'elles ont décompté.
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { contratId, avenantId } = req.params;
      const { nom, numeroBonCommande, dateSignature, dateExpiration, montantHT, notes, bonCommandeId, nouveauBC } = req.body;

      if (dateSignature && isNaN(new Date(dateSignature).getTime())) {
        return next(new AppError(400, 'dateSignature invalide'));
      }
      if (dateExpiration && isNaN(new Date(dateExpiration).getTime())) {
        return next(new AppError(400, 'dateExpiration invalide'));
      }

      const avenant = await prisma.avenant.findUnique({
        where: { id: avenantId },
        include: { contrat: { select: { clientId: true, contratSites: { select: { siteId: true } } } } },
      });
      if (!avenant || avenant.contratId !== contratId) {
        return next(new AppError(404, 'Avenant non trouvé'));
      }
      const { contrat, ...avenantAvant } = avenant;

      const changeBC = (bonCommandeId !== undefined && bonCommandeId !== avenant.bonCommandeId) || !!nouveauBC;
      const sitesContrat = contrat.contratSites.map((cs) => cs.siteId);
      if (changeBC) {
        const erreurBC = await verifierBCAvenant(contrat.clientId, sitesContrat, bonCommandeId, nouveauBC);
        if (erreurBC) return next(erreurBC);
      }

      const nouvDateSignature = dateSignature !== undefined ? (dateSignature ? new Date(dateSignature) : null) : avenant.dateSignature;
      const nouvDateExpiration = dateExpiration !== undefined ? (dateExpiration ? new Date(dateExpiration) : null) : avenant.dateExpiration;
      // Opérations de l'avenant qui décompteront le BC : celles qui ne sont pas encore réalisées
      const opsRestantes: Prisma.InterventionWhereInput = { avenantId, statut: { notIn: ['REALISEE', 'ANNULEE'] } };

      const { updated, bc } = await prisma.$transaction(async (tx) => {
        let bc: { id: string; numero: string } | null = null;
        if (nouveauBC) {
          const quotaDefaut = await tx.intervention.count({ where: { ...opsRestantes, type: 'OPERATION', remplaceeParOperation: false } });
          bc = await creerBCAvenant(
            tx,
            // Sites couverts par défaut : ceux de l'avenant (tous ceux du contrat s'il les concerne tous)
            { ...nouveauBC, siteIds: nouveauBC.siteIds ?? (avenant.siteIds.length ? avenant.siteIds : sitesContrat) },
            { clientId: contrat.clientId, contratId, dateSignature: nouvDateSignature, dateExpiration: nouvDateExpiration, quotaDefaut: quotaDefaut || null },
          );
        } else if (changeBC && bonCommandeId) {
          bc = await tx.bonCommande.findUnique({ where: { id: bonCommandeId }, select: { id: true, numero: true } });
        }

        if (changeBC) {
          await tx.intervention.updateMany({
            where: { ...opsRestantes, type: 'OPERATION' },
            data: { bonCommandeId: bc?.id ?? null },
          });
        }

        const bcFinal = changeBC ? bc : null;
        const updated = await tx.avenant.update({
          where: { id: avenantId },
          data: {
            nom: nom !== undefined ? (nom || null) : avenant.nom,
            ...(changeBC ? { bonCommandeId: bc?.id ?? null } : {}),
            // Avec un BC lié, son numéro est repris sur l'avenant (en-tête facture)
            numeroBonCommande: bcFinal
              ? bcFinal.numero
              : numeroBonCommande !== undefined ? (numeroBonCommande || null) : avenant.numeroBonCommande,
            dateSignature: nouvDateSignature,
            dateExpiration: nouvDateExpiration,
            montantHT: montantHT !== undefined ? (montantHT ?? null) : avenant.montantHT,
            notes: notes !== undefined ? (notes || null) : avenant.notes,
          },
        });
        return { updated, bc: bcFinal };
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Avenant', avenantId, {
        before: avenantAvant,
        after: updated,
      });

      res.json({ avenant: updated, bonCommande: bc });
    } catch (error) {
      logger.error({ err: error }, 'Avenant update error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/contrats/:contratId/avenants/:avenantId
   * Supprime un avenant et ses interventions non réalisées.
   * Bloque si des interventions réalisées existent (données historiques).
   * ?supprimerBC=1 : supprime aussi son BC (désactivé, comme une suppression de BC), sauf s'il
   * est encore lié à un autre avenant. Sinon le BC est libéré et redevient un BC du contrat.
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

      const supprimerBC = req.query.supprimerBC === '1' || req.query.supprimerBC === 'true';

      const bcSupprime = await prisma.$transaction(async (tx) => {
        await tx.intervention.deleteMany({ where: { avenantId } });
        await tx.avenant.delete({ where: { id: avenantId } });

        if (!supprimerBC || !avenant.bonCommandeId) return false;
        const autresAvenants = await tx.avenant.count({ where: { bonCommandeId: avenant.bonCommandeId } });
        if (autresAvenants > 0) return false;
        // Même effet que la suppression d'un BC : dissocié des interventions non réalisées, puis désactivé
        await tx.intervention.updateMany({
          where: { bonCommandeId: avenant.bonCommandeId, statut: { notIn: ['REALISEE', 'ANNULEE'] } },
          data: { bonCommandeId: null },
        });
        await tx.bonCommande.update({ where: { id: avenant.bonCommandeId }, data: { actif: false } });
        return true;
      });

      await createAuditLog(req.user!.id, 'DELETE', 'Avenant', avenantId, {
        before: { contratId, numero: avenant.numero, bonCommandeId: avenant.bonCommandeId, bcSupprime },
      });

      res.json({
        message: bcSupprime ? 'Avenant et bon de commande supprimés' : 'Avenant supprimé',
        bcSupprime,
        ...(supprimerBC && avenant.bonCommandeId && !bcSupprime
          ? { warning: 'BC conservé : il est encore lié à un autre avenant' }
          : {}),
      });
    } catch (error) {
      logger.error({ err: error }, 'Avenant delete error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default avenantController;
