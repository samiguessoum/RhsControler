import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import { AppError } from '../lib/errors.js';
import logger from '../lib/logger.js';

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
      const fi = await prisma.fieldIntervention.findUnique({
        where: { id },
        include: {
          site: { select: { id: true, nom: true, ville: true, adresse: true } },
          client: { select: { id: true, nomEntreprise: true } },
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
            },
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
      const {
        siteId, clientId, zoningVersionId, type, dateIntervention,
        heureDebut, heureFin, commentaire, applicateurIds,
      } = req.body;

      if (!siteId || !clientId || !zoningVersionId || !type || !dateIntervention) {
        throw new AppError(400, 'siteId, clientId, zoningVersionId, type et dateIntervention sont requis');
      }

      const fi = await prisma.fieldIntervention.create({
        data: {
          siteId, clientId, zoningVersionId, type,
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
      const existing = await prisma.fieldIntervention.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Intervention introuvable');
      if (!['DRAFT', 'IN_PROGRESS'].includes(existing.statut)) {
        throw new AppError(400, 'Cette intervention ne peut pas être soumise');
      }

      const updated = await prisma.fieldIntervention.update({
        where: { id },
        data: { statut: 'SUBMITTED', submittedAt: new Date() },
      });
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
          const dc = await tx.deviceControl.upsert({
            where: { fieldInterventionId_deviceId: { fieldInterventionId: id, deviceId: ctrl.deviceId } },
            create: {
              fieldInterventionId: id,
              deviceId: ctrl.deviceId,
              statusCode: ctrl.statusCode,
              observation: ctrl.observation,
            },
            update: {
              statusCode: ctrl.statusCode,
              observation: ctrl.observation,
            },
          });

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

  // ─── Produits ──────────────────────────────────────────────────────────────

  // PUT /api/field-interventions/:id/products — remplace la liste entière
  async upsertProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
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
