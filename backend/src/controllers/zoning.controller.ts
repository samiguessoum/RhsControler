import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import { AppError } from '../lib/errors.js';
import logger from '../lib/logger.js';

// ─── ZoningVersion ────────────────────────────────────────────────────────────

export const zoningController = {

  // GET /api/sites/:siteId/zoning-versions
  async listVersions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params;
      const versions = await prisma.zoningVersion.findMany({
        where: { siteId },
        include: {
          createdBy: { select: { id: true, nom: true, prenom: true } },
          _count: { select: { zones: true, devices: true } },
        },
        orderBy: { version: 'desc' },
      });
      res.json(versions);
    } catch (err) {
      next(err);
    }
  },

  // GET /api/sites/:siteId/zoning-versions/:id
  async getVersion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const version = await prisma.zoningVersion.findUnique({
        where: { id },
        include: {
          createdBy: { select: { id: true, nom: true, prenom: true } },
          zones: {
            orderBy: { ordre: 'asc' },
            include: {
              devices: { orderBy: [{ type: 'asc' }, { displayNumber: 'asc' }] },
            },
          },
          plans: { orderBy: { ordre: 'asc' } },
        },
      });
      if (!version) throw new AppError(404, 'Version de zoning introuvable');
      res.json(version);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/sites/:siteId/zoning-versions
  async createVersion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params;
      const { nom, notes } = req.body;
      if (!nom) throw new AppError(400, 'Le nom est requis');

      // Incrément version par site
      const last = await prisma.zoningVersion.findFirst({
        where: { siteId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (last?.version ?? 0) + 1;

      const created = await prisma.zoningVersion.create({
        data: { siteId, nom, notes, version: nextVersion, createdById: req.user!.id },
      });
      await createAuditLog(req.user!.id, 'CREATE', 'ZoningVersion', created.id, { after: created });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/zoning-versions/:id
  async updateVersion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { nom, notes, statut, dateActivation, dateFin } = req.body;
      const existing = await prisma.zoningVersion.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Version introuvable');

      // Si on active cette version, on archive l'ancienne ACTIVE du même site
      if (statut === 'ACTIVE' && existing.statut !== 'ACTIVE') {
        await prisma.zoningVersion.updateMany({
          where: { siteId: existing.siteId, statut: 'ACTIVE', id: { not: id } },
          data: { statut: 'ARCHIVED', dateFin: new Date() },
        });
      }

      const updated = await prisma.zoningVersion.update({
        where: { id },
        data: { nom, notes, statut, dateActivation, dateFin },
      });
      await createAuditLog(req.user!.id, 'UPDATE', 'ZoningVersion', id, { before: existing, after: updated });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/zoning-versions/:id — uniquement si DRAFT
  async deleteVersion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.zoningVersion.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Version introuvable');
      if (existing.statut !== 'DRAFT') throw new AppError(400, 'Seules les versions DRAFT peuvent être supprimées');
      await prisma.zoningVersion.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'ZoningVersion', id, { before: existing });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // ─── Zones ──────────────────────────────────────────────────────────────────

  // POST /api/zoning-versions/:versionId/zones
  async createZone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { versionId } = req.params;
      const { nom, description, etage, ordre } = req.body;
      if (!nom) throw new AppError(400, 'Le nom est requis');

      const version = await prisma.zoningVersion.findUnique({ where: { id: versionId } });
      if (!version) throw new AppError(404, 'Version introuvable');

      const zone = await prisma.zone.create({
        data: { zoningVersionId: versionId, nom, description, etage, ordre: ordre ?? 0 },
      });
      res.status(201).json(zone);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/zones/:id
  async updateZone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { nom, description, etage, ordre, actif } = req.body;
      const zone = await prisma.zone.update({
        where: { id },
        data: { nom, description, etage, ordre, actif },
      });
      res.json(zone);
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/zones/:id
  async deleteZone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const hasDevices = await prisma.monitoringDevice.count({ where: { zoneId: id } });
      if (hasDevices > 0) throw new AppError(400, 'Impossible de supprimer une zone avec des dispositifs');
      await prisma.zone.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // ─── Devices ────────────────────────────────────────────────────────────────

  // POST /api/zones/:zoneId/devices
  async createDevice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { zoneId } = req.params;
      const { type, displayNumber, nom, statut, dateInstallation, planId, planX, planY, notes, metadata } = req.body;
      if (!type || !displayNumber) throw new AppError(400, 'type et displayNumber sont requis');

      const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) throw new AppError(404, 'Zone introuvable');

      const device = await prisma.monitoringDevice.create({
        data: {
          zoningVersionId: zone.zoningVersionId,
          zoneId,
          type,
          displayNumber,
          nom,
          statut: statut ?? 'ACTIVE',
          dateInstallation,
          planId,
          planX,
          planY,
          notes,
          metadata,
        },
      });
      res.status(201).json(device);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/devices/:id
  async updateDevice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { nom, statut, displayNumber, zoneId, dateInstallation, dateRetrait, planId, planX, planY, notes, metadata } = req.body;
      const device = await prisma.monitoringDevice.update({
        where: { id },
        data: { nom, statut, displayNumber, zoneId, dateInstallation, dateRetrait, planId, planX, planY, notes, metadata },
      });
      res.json(device);
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/devices/:id
  async deleteDevice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const hasControls = await prisma.deviceControl.count({ where: { deviceId: id } });
      if (hasControls > 0) throw new AppError(400, 'Impossible de supprimer un dispositif avec des contrôles enregistrés');
      await prisma.monitoringDevice.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // GET /api/zoning-versions/:versionId/devices
  async listDevices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { versionId } = req.params;
      const { type, zoneId, statut } = req.query;
      const where: any = { zoningVersionId: versionId };
      if (type) where.type = type;
      if (zoneId) where.zoneId = zoneId;
      if (statut) where.statut = statut;
      const devices = await prisma.monitoringDevice.findMany({
        where,
        include: { zone: { select: { id: true, nom: true, etage: true } } },
        orderBy: [{ type: 'asc' }, { displayNumber: 'asc' }],
      });
      res.json(devices);
    } catch (err) {
      next(err);
    }
  },

  // ─── ControlStatus ──────────────────────────────────────────────────────────

  // GET /api/control-statuses
  async listControlStatuses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const statuses = await prisma.controlStatus.findMany({
        where: { actif: true },
        orderBy: { ordre: 'asc' },
      });
      res.json(statuses);
    } catch (err) {
      next(err);
    }
  },

  // POST /api/control-statuses
  async createControlStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code, label, description, color, ordre } = req.body;
      if (!code || !label) throw new AppError(400, 'code et label sont requis');
      const status = await prisma.controlStatus.create({
        data: { code: code.toUpperCase(), label, description, color, ordre: ordre ?? 0 },
      });
      res.status(201).json(status);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/control-statuses/:id
  async updateControlStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { label, description, color, actif, ordre } = req.body;
      const status = await prisma.controlStatus.update({ where: { id }, data: { label, description, color, actif, ordre } });
      res.json(status);
    } catch (err) {
      next(err);
    }
  },
};
