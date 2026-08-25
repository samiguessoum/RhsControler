import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import { AppError } from '../lib/errors.js';
import logger from '../lib/logger.js';
import planningService from '../services/planning.service.js';

// EQUIPE : vérifie que l'employé lié à req.user est bien affecté à cette intervention terrain.
// Les autres rôles (bureau) ont accès à toutes les interventions.
async function assertFieldInterventionAccess(req: AuthRequest, fieldInterventionId: string) {
  if (req.user!.role !== 'EQUIPE') return;
  if (!req.user!.employeId) throw new AppError(403, 'Compte non lié à une fiche employé');
  const assigned = await prisma.fIApplicateur.findFirst({
    where: { fieldInterventionId, employeId: req.user!.employeId },
    select: { id: true },
  });
  if (!assigned) throw new AppError(403, "Vous n'êtes pas affecté à cette intervention");
}

export const fieldInterventionController = {

  // GET /api/field-interventions?siteId=&clientId=&statut=&dateFrom=&dateTo=&page=&limit=
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { siteId, clientId, statut, type, dateFrom, dateTo, page = '1', limit = '20' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const where: any = {};

      if (siteId) where.siteId = siteId;
      if (clientId) where.clientId = clientId;
      if (statut) where.statut = statut;
      if (type) where.type = type;
      if (dateFrom || dateTo) {
        where.dateIntervention = {};
        if (dateFrom) where.dateIntervention.gte = new Date(dateFrom as string);
        if (dateTo) where.dateIntervention.lte = new Date(dateTo as string);
      }

      // EQUIPE: ne voit que ses propres interventions
      if (req.user!.role === 'EQUIPE' && req.user!.employeId) {
        where.applicateurs = { some: { employeId: req.user!.employeId } };
      }

      const [total, items] = await Promise.all([
        prisma.fieldIntervention.count({ where }),
        prisma.fieldIntervention.findMany({
          where,
          skip,
          take: parseInt(limit as string),
          include: {
            site: { select: { id: true, nom: true, ville: true } },
            client: { select: { id: true, nomEntreprise: true } },
            createdBy: { select: { id: true, nom: true, prenom: true } },
            applicateurs: {
              include: { employe: { select: { id: true, nom: true, prenom: true } } },
            },
            _count: { select: { controls: true, products: true, reports: true } },
          },
          orderBy: { dateIntervention: 'desc' },
        }),
      ]);

      res.json({ total, page: parseInt(page as string), limit: parseInt(limit as string), items });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/field-interventions/:id
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await assertFieldInterventionAccess(req, id);
      const fi = await prisma.fieldIntervention.findUnique({
        where: { id },
        include: {
          site: { select: { id: true, nom: true, ville: true, adresse: true } },
          client: { select: { id: true, nomEntreprise: true } },
          contrat: { select: { id: true, type: true, numeroBonCommande: true } },
          zoningVersion: {
            include: {
              zones: {
                orderBy: { ordre: 'asc' },
                include: { devices: { orderBy: [{ type: 'asc' }, { displayNumber: 'asc' }] } },
              },
            },
          },
          createdBy: { select: { id: true, nom: true, prenom: true } },
          validatedBy: { select: { id: true, nom: true, prenom: true } },
          applicateurs: {
            include: { employe: { select: { id: true, nom: true, prenom: true } } },
          },
          controls: {
            include: {
              device: { include: { zone: { select: { id: true, nom: true } } } },
              insectCounts: true,
              photos: true,
              updatedBy: { select: { id: true, prenom: true, nom: true } },
            },
          },
          simpleChecks: {
            include: { updatedBy: { select: { id: true, prenom: true, nom: true } } },
          },
          products: true,
          reports: {
            include: { generatedBy: { select: { id: true, nom: true, prenom: true } } },
            orderBy: { version: 'desc' },
          },
          documents: true,
        },
      });
      if (!fi) throw new AppError(404, 'Intervention terrain introuvable');
      res.json(fi);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/field-interventions
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role === 'EQUIPE') {
        // EQUIPE ne crée pas d'intervention terrain libre : elle démarre depuis une visite
        // planifiée via POST /interventions/:id/field-report (intervention.controller.ts).
        throw new AppError(403, 'Utilisez une visite planifiée pour démarrer une fiche terrain');
      }
      const {
        siteId, clientId, zoningVersionId, type, dateIntervention,
        heureDebut, heureFin, commentaire, applicateurIds, contratId,
      } = req.body;

      if (!siteId || !clientId || !zoningVersionId || !type || !dateIntervention) {
        throw new AppError(400, 'siteId, clientId, zoningVersionId, type et dateIntervention sont requis');
      }

      const fi = await prisma.fieldIntervention.create({
        data: {
          siteId, clientId, zoningVersionId, type, contratId,
          dateIntervention: new Date(dateIntervention),
          heureDebut, heureFin, commentaire,
          createdById: req.user!.id,
          applicateurs: applicateurIds?.length
            ? { create: applicateurIds.map((eid: string) => ({ employeId: eid })) }
            : undefined,
        },
        include: {
          applicateurs: { include: { employe: { select: { id: true, nom: true, prenom: true } } } },
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'FieldIntervention', fi.id, { after: { siteId, type, dateIntervention } });
      res.status(201).json(fi);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/field-interventions/:id — mise à jour terrain (DRAFT / IN_PROGRESS)
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await assertFieldInterventionAccess(req, id);
      const existing = await prisma.fieldIntervention.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Intervention introuvable');
      if (!['DRAFT', 'IN_PROGRESS'].includes(existing.statut)) {
        throw new AppError(400, 'Cette intervention ne peut plus être modifiée');
      }

      const { heureDebut, heureFin, commentaire, applicateurIds } = req.body;

      const updated = await prisma.$transaction(async (tx) => {
        if (applicateurIds !== undefined) {
          await tx.fIApplicateur.deleteMany({ where: { fieldInterventionId: id } });
          if (applicateurIds.length > 0) {
            await tx.fIApplicateur.createMany({
              data: applicateurIds.map((eid: string) => ({ fieldInterventionId: id, employeId: eid })),
            });
          }
        }
        return tx.fieldIntervention.update({
          where: { id },
          data: {
            heureDebut, heureFin, commentaire,
            statut: 'IN_PROGRESS',
            draftSavedAt: new Date(),
          },
        });
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/field-interventions/:id/submit — applicateur soumet
  async submit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await assertFieldInterventionAccess(req, id);
      const existing = await prisma.fieldIntervention.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Intervention introuvable');
      if (!['DRAFT', 'IN_PROGRESS'].includes(existing.statut)) {
        throw new AppError(400, 'Cette intervention ne peut pas être soumise');
      }

      const updated = await prisma.fieldIntervention.update({
        where: { id },
        data: { statut: 'SUBMITTED', submittedAt: new Date() },
      });

      // Répercute la soumission sur la visite planifiée liée (si présente)
      if (existing.interventionId) {
        try {
          await planningService.marquerRealisee(existing.interventionId, req.user!.id, {
            dateRealisee: existing.dateIntervention,
            notesTerrain: existing.commentaire || undefined,
          });
        } catch (e) {
          logger.warn({ err: e, interventionId: existing.interventionId }, 'Impossible de marquer la visite planning comme réalisée');
        }
      }

      await createAuditLog(req.user!.id, 'UPDATE', 'FieldIntervention', id, { after: { statut: 'SUBMITTED' } });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/field-interventions/:id/validate — bureau valide
  async validate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!['ADMIN', 'DIRECTION', 'SUPER_ADMIN'].includes(req.user!.role)) {
        throw new AppError(403, 'Droits insuffisants');
      }
      const existing = await prisma.fieldIntervention.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Intervention introuvable');
      if (existing.statut !== 'SUBMITTED') throw new AppError(400, "L'intervention doit être soumise avant validation");

      const updated = await prisma.fieldIntervention.update({
        where: { id },
        data: { statut: 'VALIDATED', validatedById: req.user!.id, validatedAt: new Date() },
      });
      await createAuditLog(req.user!.id, 'UPDATE', 'FieldIntervention', id, { after: { statut: 'VALIDATED' } });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/field-interventions/:id/cancel
  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.fieldIntervention.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Intervention introuvable');
      if (existing.statut === 'VALIDATED') throw new AppError(400, 'Une intervention validée ne peut pas être annulée');

      await prisma.fieldIntervention.update({ where: { id }, data: { statut: 'CANCELLED' } });
      await createAuditLog(req.user!.id, 'UPDATE', 'FieldIntervention', id, { after: { statut: 'CANCELLED' } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // ─── Contrôles des dispositifs ─────────────────────────────────────────────

  // PUT /api/field-interventions/:id/controls — upsert batch (formulaire terrain)
  async upsertControls(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await assertFieldInterventionAccess(req, id);
      const { controls } = req.body as {
        controls: Array<{
          deviceId: string;
          statusCode?: string;
          observation?: string;
          insectCounts?: Array<{ espece: string; count: number }>;
        }>;
      };

      if (!Array.isArray(controls)) throw new AppError(400, 'controls doit être un tableau');

      const fi = await prisma.fieldIntervention.findUnique({ where: { id } });
      if (!fi) throw new AppError(404, 'Intervention introuvable');
      if (!['DRAFT', 'IN_PROGRESS'].includes(fi.statut)) {
        throw new AppError(400, 'Cette intervention ne peut plus être modifiée');
      }

      await prisma.$transaction(async (tx) => {
        for (const ctrl of controls) {
          const existing = await tx.deviceControl.findUnique({
            where: { fieldInterventionId_deviceId: { fieldInterventionId: id, deviceId: ctrl.deviceId } },
            select: { id: true, statusCode: true, observation: true },
          });

          const dc = await tx.deviceControl.upsert({
            where: { fieldInterventionId_deviceId: { fieldInterventionId: id, deviceId: ctrl.deviceId } },
            create: {
              fieldInterventionId: id,
              deviceId: ctrl.deviceId,
              statusCode: ctrl.statusCode,
              observation: ctrl.observation,
              updatedById: req.user!.id,
            },
            update: {
              statusCode: ctrl.statusCode,
              observation: ctrl.observation,
              updatedById: req.user!.id,
            },
          });

          if (existing && (existing.statusCode !== (ctrl.statusCode ?? null) || existing.observation !== (ctrl.observation ?? null))) {
            await tx.deviceControlAudit.create({
              data: {
                deviceControlId: dc.id,
                fieldInterventionId: id,
                deviceId: ctrl.deviceId,
                oldStatusCode: existing.statusCode,
                newStatusCode: ctrl.statusCode ?? null,
                oldObservation: existing.observation,
                newObservation: ctrl.observation ?? null,
                changedById: req.user!.id,
              },
            });
          }

          if (ctrl.insectCounts) {
            // Supprime les anciens puis recrée
            await tx.insectCount.deleteMany({ where: { deviceControlId: dc.id } });
            if (ctrl.insectCounts.length > 0) {
              await tx.insectCount.createMany({
                data: ctrl.insectCounts.map((ic) => ({
                  deviceControlId: dc.id,
                  espece: ic.espece,
                  count: ic.count,
                })),
              });
            }
          }
        }

        await tx.fieldIntervention.update({
          where: { id },
          data: { statut: 'IN_PROGRESS', draftSavedAt: new Date() },
        });
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },

  // ─── Contrôles simples (Regards, Goliath, Autre) ──────────────────────────

  // GET /api/field-interventions/:id/simple-checks
  async getSimpleChecks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await assertFieldInterventionAccess(req, id);
      const checks = await prisma.fISimpleCheck.findMany({
        where: { fieldInterventionId: id },
        include: { updatedBy: { select: { id: true, prenom: true, nom: true } } },
      });
      res.json(checks);
    } catch (err) {
      next(err);
    }
  },

  // PUT /api/field-interventions/:id/simple-checks
  async upsertSimpleCheck(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await assertFieldInterventionAccess(req, id);
      const fi = await prisma.fieldIntervention.findUnique({ where: { id } });
      if (!fi) throw new AppError(404, 'Intervention introuvable');
      if (!['DRAFT', 'IN_PROGRESS'].includes(fi.statut)) {
        throw new AppError(400, 'Cette intervention ne peut plus être modifiée');
      }

      const { category, subType, statut, commentaire } = req.body;
      if (!category) throw new AppError(400, 'category est requis');
      const sub = subType ?? '';

      const check = await prisma.fISimpleCheck.upsert({
        where: { fieldInterventionId_category_subType: { fieldInterventionId: id, category, subType: sub } },
        create: { fieldInterventionId: id, category, subType: sub, statut, commentaire, updatedById: req.user!.id },
        update: { statut, commentaire, updatedById: req.user!.id },
        include: { updatedBy: { select: { id: true, prenom: true, nom: true } } },
      });

      await prisma.fieldIntervention.update({
        where: { id },
        data: { statut: 'IN_PROGRESS', draftSavedAt: new Date() },
      });

      res.json(check);
    } catch (err) {
      next(err);
    }
  },

  // ─── Produits ──────────────────────────────────────────────────────────────

  // PUT /api/field-interventions/:id/products — remplace la liste entière
  async upsertProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await assertFieldInterventionAccess(req, id);
      const { products } = req.body as {
        products: Array<{
          produitId?: string; nom: string; lot?: string;
          dateFabrication?: string; datePeremption?: string;
          quantite?: number; unite?: string; notes?: string;
        }>;
      };

      if (!Array.isArray(products)) throw new AppError(400, 'products doit être un tableau');

      await prisma.$transaction(async (tx) => {
        await tx.fIProduct.deleteMany({ where: { fieldInterventionId: id } });
        if (products.length > 0) {
          await tx.fIProduct.createMany({
            data: products.map((p) => ({
              fieldInterventionId: id,
              produitId: p.produitId,
              nom: p.nom,
              lot: p.lot,
              dateFabrication: p.dateFabrication ? new Date(p.dateFabrication) : null,
              datePeremption: p.datePeremption ? new Date(p.datePeremption) : null,
              quantite: p.quantite,
              unite: p.unite,
              notes: p.notes,
            })),
          });
        }
      });

      const updated = await prisma.fIProduct.findMany({ where: { fieldInterventionId: id } });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  // ─── Analytics / Tendances ─────────────────────────────────────────────────

  // GET /api/sites/:siteId/zoning-analytics?zoningVersionId=&dateFrom=&dateTo=
  async getSiteAnalytics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params;
      const { zoningVersionId, dateFrom, dateTo } = req.query;

      const fiWhere: any = { siteId, statut: { in: ['SUBMITTED', 'VALIDATED'] } };
      if (zoningVersionId) fiWhere.zoningVersionId = zoningVersionId;
      if (dateFrom || dateTo) {
        fiWhere.dateIntervention = {};
        if (dateFrom) fiWhere.dateIntervention.gte = new Date(dateFrom as string);
        if (dateTo) fiWhere.dateIntervention.lte = new Date(dateTo as string);
      }

      const interventions = await prisma.fieldIntervention.findMany({
        where: fiWhere,
        include: {
          controls: {
            include: { device: { select: { id: true, type: true, displayNumber: true, zoneId: true } }, insectCounts: true },
          },
        },
        orderBy: { dateIntervention: 'asc' },
      });

      // Agrégations par dispositif
      const deviceStats: Record<string, { interventionCount: number; statusCodes: string[]; insectTotal: number }> = {};
      for (const fi of interventions) {
        for (const ctrl of fi.controls) {
          const key = ctrl.deviceId;
          if (!deviceStats[key]) deviceStats[key] = { interventionCount: 0, statusCodes: [], insectTotal: 0 };
          deviceStats[key].interventionCount++;
          if (ctrl.statusCode) deviceStats[key].statusCodes.push(ctrl.statusCode);
          deviceStats[key].insectTotal += ctrl.insectCounts.reduce((s, ic) => s + ic.count, 0);
        }
      }

      // Tendance insectes par mois
      const insectByMonth: Record<string, number> = {};
      for (const fi of interventions) {
        const month = fi.dateIntervention.toISOString().slice(0, 7);
        for (const ctrl of fi.controls) {
          const total = ctrl.insectCounts.reduce((s, ic) => s + ic.count, 0);
          insectByMonth[month] = (insectByMonth[month] ?? 0) + total;
        }
      }

      res.json({
        totalInterventions: interventions.length,
        deviceStats,
        insectTrend: Object.entries(insectByMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, count]) => ({ month, count })),
      });
    } catch (err) {
      next(err);
    }
  },

  // ─── Rapports (livrable Excel agrégé) ──────────────────────────────────────

  // GET /api/sites/:siteId/field-reports
  async listSiteFieldReports(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params;
      const reports = await prisma.fieldReport.findMany({
        where: { siteId },
        include: { generatedBy: { select: { id: true, nom: true, prenom: true } } },
        orderBy: { generatedAt: 'desc' },
      });
      res.json(reports);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/sites/:siteId/field-reports — génère le rapport Excel agrégé sur une période
  async generateSiteFieldReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params;
      const { dateFrom, dateTo } = req.body;
      if (!dateFrom || !dateTo) throw new AppError(400, 'dateFrom et dateTo sont requis');

      const { fieldReportService } = await import('../services/field-report.service.js');
      const report = await fieldReportService.generateSiteHistoryReport(
        siteId,
        new Date(dateFrom),
        new Date(dateTo),
        req.user!.id,
      );
      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/field-reports/:id/download
  async downloadFieldReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const report = await prisma.fieldReport.findUnique({ where: { id } });
      if (!report?.xlsxPath) throw new AppError(404, 'Rapport introuvable');

      const path = await import('path');
      const absolutePath = path.join(process.cwd(), report.xlsxPath);
      res.download(absolutePath, path.basename(report.xlsxPath));
    } catch (err) {
      next(err);
    }
  },

  // ─── Documents ─────────────────────────────────────────────────────────────

  // GET /api/sites/:siteId/documents
  async listSiteDocuments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params;
      const docs = await prisma.siteDocument.findMany({
        where: { siteId },
        include: { uploadedBy: { select: { id: true, nom: true, prenom: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(docs);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/sites/:siteId/documents
  async createSiteDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params;
      const { titre, type, filename, path, size, mimeType, date, annee, commentaire } = req.body;
      if (!titre || !filename || !path) throw new AppError(400, 'titre, filename et path sont requis');

      const doc = await prisma.siteDocument.create({
        data: {
          siteId, titre, type: type ?? 'autre', filename, path,
          size, mimeType,
          date: date ? new Date(date) : null,
          annee,
          commentaire,
          uploadedById: req.user!.id,
        },
      });
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/site-documents/:id
  async deleteSiteDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.siteDocument.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
