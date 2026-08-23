import { Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import { AppError } from '../lib/errors.js';
import logger from '../lib/logger.js';

const DEVICE_TYPE_MAP: Record<string, string> = {
  BAIT_STATION: 'BAIT_STATION',
  MECHANICAL_TRAP: 'MECHANICAL_TRAP',
  GLUE_TRAP: 'GLUE_TRAP',
  FLYING_INSECT_KILLER: 'FLYING_INSECT_KILLER',
  "Poste d'appâtage": 'BAIT_STATION',
  'Piège mécanique': 'MECHANICAL_TRAP',
  'Boîte à colle': 'GLUE_TRAP',
  'Destructeur insectes': 'FLYING_INSECT_KILLER',
};

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

  // GET /api/zoning-versions/:versionId/import-template
  async downloadImportTemplate(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Zoning');

      ws.columns = [
        { header: 'Zone *', key: 'zone', width: 25 },
        { header: 'Étage / Niveau', key: 'etage', width: 18 },
        { header: 'Type *', key: 'type', width: 24 },
        { header: 'Numéro *', key: 'numero', width: 12 },
        { header: 'Nom libre', key: 'nom', width: 20 },
        { header: 'Notes', key: 'notes', width: 30 },
      ];

      // Header row styling
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

      // Example rows
      const examples = [
        ['Administration', 'RDC', 'BAIT_STATION', '01', '', ''],
        ['Administration', 'RDC', 'BAIT_STATION', '02', '', ''],
        ['Production', '1er étage', 'FLYING_INSECT_KILLER', '01', 'FK-Prod', 'Près de la chaîne'],
        ['Entrepôt', 'RDC', 'GLUE_TRAP', '01', '', ''],
        ['Entrepôt', 'RDC', 'MECHANICAL_TRAP', '01', '', ''],
      ];
      examples.forEach((r) => ws.addRow(r));

      // Legend sheet
      const legend = wb.addWorksheet('Types valides');
      legend.columns = [{ header: 'Code à utiliser', key: 'code', width: 26 }, { header: 'Description', key: 'desc', width: 30 }];
      legend.getRow(1).font = { bold: true };
      [
        ['BAIT_STATION', "Poste d'appâtage"],
        ['MECHANICAL_TRAP', 'Piège mécanique'],
        ['GLUE_TRAP', 'Boîte à colle'],
        ['FLYING_INSECT_KILLER', 'Destructeur insectes volants (FK)'],
      ].forEach((r) => legend.addRow(r));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="template-zoning.xlsx"');
      await wb.xlsx.write(res);
      res.end();
    } catch (err) {
      next(err);
    }
  },

  // POST /api/zoning-versions/:versionId/import
  async importZoning(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { versionId } = req.params;
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) throw new AppError(400, 'Fichier .xlsx requis');

      const version = await prisma.zoningVersion.findUnique({
        where: { id: versionId },
        include: { zones: true },
      });
      if (!version) throw new AppError(404, 'Version de zoning introuvable');

      const wb = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(file.buffer as any);
      const ws = wb.worksheets[0];

      type Row = { zone: string; etage: string; type: string; numero: string; nom: string; notes: string };
      const rows: Row[] = [];
      ws.eachRow((row, i) => {
        if (i === 1) return;
        const zone = String(row.getCell(1).value ?? '').trim();
        const etage = String(row.getCell(2).value ?? '').trim();
        const type = String(row.getCell(3).value ?? '').trim();
        const numero = String(row.getCell(4).value ?? '').trim();
        const nom = String(row.getCell(5).value ?? '').trim();
        const notes = String(row.getCell(6).value ?? '').trim();
        if (zone && type && numero) rows.push({ zone, etage, type, numero, nom, notes });
      });

      const zonesMap = new Map<string, string>(); // nom → zoneId
      // Pre-populate with existing zones
      version.zones.forEach((z) => zonesMap.set(z.nom, z.id));

      let createdZones = 0;
      let createdDevices = 0;
      let skippedRows = 0;

      for (const row of rows) {
        const deviceType = DEVICE_TYPE_MAP[row.type];
        if (!deviceType) { skippedRows++; continue; }

        let zoneId = zonesMap.get(row.zone);
        if (!zoneId) {
          const z = await prisma.zone.create({
            data: { zoningVersionId: versionId, nom: row.zone, etage: row.etage || null },
          });
          zoneId = z.id;
          zonesMap.set(row.zone, zoneId);
          createdZones++;
        }

        await prisma.monitoringDevice.create({
          data: {
            zoningVersionId: versionId,
            zoneId,
            type: deviceType as any,
            displayNumber: row.numero,
            nom: row.nom || null,
            notes: row.notes || null,
            statut: 'ACTIVE',
          },
        });
        createdDevices++;
      }

      logger.info({ versionId, createdZones, createdDevices, skippedRows }, 'zoning import completed');
      res.json({ createdZones, createdDevices, skippedRows });
    } catch (err) {
      next(err);
    }
  },
};
