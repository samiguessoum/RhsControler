import { Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import { AppError } from '../lib/errors.js';
import logger from '../lib/logger.js';

// Anciens libellés acceptés à l'import en plus du code et du libellé configurés
const LEGACY_DEVICE_TYPE_ALIASES: Record<string, string> = {
  'destructeur insectes': 'FLYING_INSECT_KILLER',
};

const DEVICE_TYPE_MODES = ['APPATAGE', 'PIEGE', 'COMPTAGE', 'GOLIATH'];

const normalize = (s: string) => s.trim().toLowerCase();

// Code technique dérivé du libellé : "Station d'humidité" → "STATION_D_HUMIDITE"
const toDeviceTypeCode = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

// Violation de @@unique([zoningVersionId, type, displayNumber]) (ex. ajout simultané par deux utilisateurs)
const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === 'P2002';

const formatNumbers = (nums: string[]) => nums.map((n) => `#${n}`).join(', ');

// Numéros déjà pris pour ce type dans la version (comparaison exacte : "01" ≠ "1")
async function findTakenNumbers(zoningVersionId: string, type: string, numbers: string[], excludeId?: string) {
  const taken = await prisma.monitoringDevice.findMany({
    where: { zoningVersionId, type, displayNumber: { in: numbers }, ...(excludeId && { id: { not: excludeId } }) },
    select: { displayNumber: true },
  });
  return taken.map((d) => d.displayNumber);
}

async function duplicateNumberError(type: string, numbers: string[]) {
  const config = await prisma.deviceTypeConfig.findUnique({ where: { code: type } });
  const label = config?.label ?? type;
  return new AppError(
    409,
    numbers.length === 1
      ? `Le numéro ${formatNumbers(numbers)} existe déjà pour le type « ${label} » dans ce zoning`
      : `Les numéros ${formatNumbers(numbers)} existent déjà pour le type « ${label} » dans ce zoning`
  );
}

async function assertDeviceType(code: string) {
  const exists = await prisma.deviceTypeConfig.findUnique({ where: { code } });
  if (!exists) throw new AppError(400, `Type de dispositif inconnu : ${code}`);
}

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
      await assertDeviceType(type);

      const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) throw new AppError(404, 'Zone introuvable');

      const taken = await findTakenNumbers(zone.zoningVersionId, type, [displayNumber]);
      if (taken.length > 0) throw await duplicateNumberError(type, taken);

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
      if (isUniqueViolation(err)) return next(await duplicateNumberError(req.body.type, [req.body.displayNumber]));
      next(err);
    }
  },

  // POST /api/zones/:zoneId/devices/bulk — ajout en quantité, tout ou rien
  async createDevicesBulk(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { zoneId } = req.params;
      const { type, displayNumbers, nom, notes, statut } = req.body;
      if (!type || !Array.isArray(displayNumbers) || displayNumbers.length === 0) {
        throw new AppError(400, 'type et displayNumbers sont requis');
      }
      const numbers: string[] = displayNumbers.map((n: unknown) => String(n ?? '').trim());
      if (numbers.some((n) => !n)) throw new AppError(400, 'Numéro de dispositif vide');
      if (numbers.length > 500) throw new AppError(400, 'Maximum 500 dispositifs par ajout');
      const dupInRequest = [...new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i))];
      if (dupInRequest.length > 0) throw new AppError(400, `Numéros en double dans la demande : ${formatNumbers(dupInRequest)}`);
      await assertDeviceType(type);

      const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) throw new AppError(404, 'Zone introuvable');

      const taken = await findTakenNumbers(zone.zoningVersionId, type, numbers);
      if (taken.length > 0) throw await duplicateNumberError(type, taken);

      try {
        const result = await prisma.monitoringDevice.createMany({
          data: numbers.map((displayNumber) => ({
            zoningVersionId: zone.zoningVersionId,
            zoneId,
            type,
            displayNumber,
            nom: nom || null,
            notes: notes || null,
            statut: statut ?? 'ACTIVE',
          })),
        });
        res.status(201).json({ created: result.count });
      } catch (err) {
        // Numéro pris entre la vérification et l'insertion : rien n'a été créé (instruction unique)
        if (isUniqueViolation(err)) {
          const nowTaken = await findTakenNumbers(zone.zoningVersionId, type, numbers);
          throw await duplicateNumberError(type, nowTaken.length > 0 ? nowTaken : numbers);
        }
        throw err;
      }
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/devices/:id
  async updateDevice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { nom, statut, displayNumber, zoneId, dateInstallation, dateRetrait, planId, planX, planY, notes, metadata } = req.body;
      const existing = await prisma.monitoringDevice.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Dispositif introuvable');
      if (displayNumber !== undefined && displayNumber !== existing.displayNumber) {
        if (!String(displayNumber).trim()) throw new AppError(400, 'Le numéro est requis');
        const taken = await findTakenNumbers(existing.zoningVersionId, existing.type, [displayNumber], id);
        if (taken.length > 0) throw await duplicateNumberError(existing.type, taken);
      }
      const device = await prisma.monitoringDevice.update({
        where: { id },
        data: { nom, statut, displayNumber, zoneId, dateInstallation, dateRetrait, planId, planX, planY, notes, metadata },
      });
      res.json(device);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const existing = await prisma.monitoringDevice.findUnique({ where: { id: req.params.id } });
        if (existing) return next(await duplicateNumberError(existing.type, [req.body.displayNumber]));
      }
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
  // GET /api/device-types?all=true
  async listDeviceTypes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const all = req.query.all === 'true';
      const types = await prisma.deviceTypeConfig.findMany({
        where: all ? {} : { actif: true },
        orderBy: [{ ordre: 'asc' }, { label: 'asc' }],
      });
      if (!all) return res.json(types);
      const counts = await prisma.monitoringDevice.groupBy({ by: ['type'], _count: { _all: true } });
      const countMap = new Map(counts.map((c) => [c.type, c._count._all]));
      res.json(types.map((t) => ({ ...t, devicesCount: countMap.get(t.code) ?? 0 })));
    } catch (err) {
      next(err);
    }
  },

  // POST /api/device-types
  async createDeviceType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code, label, abreviation, emoji, color, mode, ordre, inclureTendances } = req.body;
      if (!label?.trim() || !abreviation?.trim()) throw new AppError(400, 'Libellé et abréviation sont requis');
      if (mode && !DEVICE_TYPE_MODES.includes(mode)) throw new AppError(400, 'Mode invalide');
      const finalCode = toDeviceTypeCode(code?.trim() || label);
      if (!finalCode) throw new AppError(400, 'Code invalide');
      const existing = await prisma.deviceTypeConfig.findUnique({ where: { code: finalCode } });
      if (existing) throw new AppError(409, `Le code ${finalCode} existe déjà`);
      let finalOrdre = ordre;
      if (finalOrdre == null) {
        const last = await prisma.deviceTypeConfig.aggregate({ _max: { ordre: true } });
        finalOrdre = (last._max.ordre ?? 0) + 1;
      }
      const type = await prisma.deviceTypeConfig.create({
        data: {
          code: finalCode,
          label: label.trim(),
          abreviation: abreviation.trim().toUpperCase().slice(0, 4),
          emoji: emoji?.trim() || null,
          color: color || '#2563eb',
          mode: mode || 'APPATAGE',
          inclureTendances: inclureTendances ?? mode !== 'GOLIATH',
          ordre: finalOrdre,
        },
      });
      await createAuditLog(req.user!.id, 'CREATE', 'DeviceTypeConfig', type.id, { after: type });
      res.status(201).json(type);
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/device-types/:id — le code est immuable (stocké sur les dispositifs)
  async updateDeviceType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { label, abreviation, emoji, color, mode, actif, ordre, inclureTendances } = req.body;
      if (mode !== undefined && !DEVICE_TYPE_MODES.includes(mode)) throw new AppError(400, 'Mode invalide');
      const before = await prisma.deviceTypeConfig.findUnique({ where: { id } });
      if (!before) throw new AppError(404, 'Type de dispositif introuvable');
      const type = await prisma.deviceTypeConfig.update({
        where: { id },
        data: {
          label: label?.trim() || undefined,
          abreviation: abreviation?.trim() ? abreviation.trim().toUpperCase().slice(0, 4) : undefined,
          emoji: emoji !== undefined ? emoji?.trim() || null : undefined,
          color,
          mode,
          inclureTendances: typeof inclureTendances === 'boolean' ? inclureTendances : undefined,
          actif,
          ordre,
        },
      });
      await createAuditLog(req.user!.id, 'UPDATE', 'DeviceTypeConfig', id, { before, after: type });
      res.json(type);
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/device-types/:id — refusé si des dispositifs l'utilisent (désactiver à la place)
  async deleteDeviceType(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const type = await prisma.deviceTypeConfig.findUnique({ where: { id } });
      if (!type) throw new AppError(404, 'Type de dispositif introuvable');
      const used = await prisma.monitoringDevice.count({ where: { type: type.code } });
      if (used > 0) {
        throw new AppError(409, `${used} dispositif(s) utilisent ce type : désactivez-le plutôt que de le supprimer`);
      }
      await prisma.deviceTypeConfig.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'DeviceTypeConfig', id, { before: type });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

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

      const deviceTypes = await prisma.deviceTypeConfig.findMany({ where: { actif: true }, orderBy: { ordre: 'asc' } });

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
      deviceTypes.forEach((t) => legend.addRow([t.code, t.label]));

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

      type Row = { line: number; zone: string; etage: string; type: string; numero: string; nom: string; notes: string };
      const rows: Row[] = [];
      ws.eachRow((row, i) => {
        if (i === 1) return;
        const zone = String(row.getCell(1).value ?? '').trim();
        const etage = String(row.getCell(2).value ?? '').trim();
        const type = String(row.getCell(3).value ?? '').trim();
        const numero = String(row.getCell(4).value ?? '').trim();
        const nom = String(row.getCell(5).value ?? '').trim();
        const notes = String(row.getCell(6).value ?? '').trim();
        if (zone && type && numero) rows.push({ line: i, zone, etage, type, numero, nom, notes });
      });

      // Type accepté par code ou par libellé (insensible à la casse)
      const deviceTypes = await prisma.deviceTypeConfig.findMany({ where: { actif: true } });
      const typeMap = new Map<string, string>();
      for (const [alias, code] of Object.entries(LEGACY_DEVICE_TYPE_ALIASES)) typeMap.set(alias, code);
      for (const t of deviceTypes) {
        typeMap.set(normalize(t.code), t.code);
        typeMap.set(normalize(t.label), t.code);
      }

      // ── 1. Validation complète avant toute écriture ──
      // Lignes ignorées : type inconnu, numéro déjà présent dans le zoning, ou en double dans le fichier
      const existingDevices = await prisma.monitoringDevice.findMany({
        where: { zoningVersionId: versionId },
        select: { type: true, displayNumber: true },
      });
      const takenKeys = new Set(existingDevices.map((d) => `${d.type}\u0000${d.displayNumber}`));
      const fileKeys = new Map<string, number>(); // clé → première ligne du fichier
      const skipped: { line: number; reason: string }[] = [];
      const toCreate: (Row & { deviceType: string })[] = [];

      for (const row of rows) {
        const deviceType = typeMap.get(normalize(row.type));
        if (!deviceType) {
          skipped.push({ line: row.line, reason: `type inconnu « ${row.type} »` });
          continue;
        }
        const key = `${deviceType}\u0000${row.numero}`;
        if (takenKeys.has(key)) {
          skipped.push({ line: row.line, reason: `${row.type} #${row.numero} existe déjà dans ce zoning` });
          continue;
        }
        const firstLine = fileKeys.get(key);
        if (firstLine !== undefined) {
          skipped.push({ line: row.line, reason: `${row.type} #${row.numero} en double (déjà ligne ${firstLine})` });
          continue;
        }
        fileKeys.set(key, row.line);
        toCreate.push({ ...row, deviceType });
      }

      // ── 2. Écriture en transaction : tout ou rien ──
      const zonesMap = new Map<string, string>(); // nom → zoneId
      version.zones.forEach((z) => zonesMap.set(z.nom, z.id));

      let createdZones = 0;
      let createdDevices = 0;
      try {
        await prisma.$transaction(async (tx) => {
          for (const row of toCreate) {
            if (zonesMap.has(row.zone)) continue;
            const z = await tx.zone.create({
              data: { zoningVersionId: versionId, nom: row.zone, etage: row.etage || null },
            });
            zonesMap.set(row.zone, z.id);
            createdZones++;
          }
          if (toCreate.length > 0) {
            const result = await tx.monitoringDevice.createMany({
              data: toCreate.map((row) => ({
                zoningVersionId: versionId,
                zoneId: zonesMap.get(row.zone)!,
                type: row.deviceType,
                displayNumber: row.numero,
                nom: row.nom || null,
                notes: row.notes || null,
                statut: 'ACTIVE' as const,
              })),
            });
            createdDevices = result.count;
          }
        }, { timeout: 60_000 });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new AppError(409, "Des dispositifs ont été ajoutés pendant l'import : rien n'a été importé, relancez l'import");
        }
        throw err;
      }
      const skippedRows = skipped.length;

      logger.info({ versionId, createdZones, createdDevices, skippedRows }, 'zoning import completed');
      res.json({ createdZones, createdDevices, skippedRows, skipped });
    } catch (err) {
      next(err);
    }
  },
};
