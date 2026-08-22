import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { formatDateFr as formatDate } from '../utils/date.utils.js';

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2E8F0' },
};

function autosizeColumns(sheet: ExcelJS.Worksheet, minWidth = 10) {
  sheet.columns.forEach((col) => {
    let max = minWidth;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 40);
  });
}

export const fieldReportService = {
  // Génère un classeur Excel agrégeant l'historique des contrôles/comptages d'un site sur une période,
  // l'enregistre sur disque et crée l'entrée FieldReport correspondante.
  async generateSiteHistoryReport(siteId: string, dateFrom: Date, dateTo: Date, generatedById: string) {
    const site = await prisma.site.findUnique({ where: { id: siteId }, include: { client: { select: { nomEntreprise: true } } } });
    if (!site) throw new AppError(404, 'Site introuvable');

    const interventions = await prisma.fieldIntervention.findMany({
      where: {
        siteId,
        statut: { in: ['SUBMITTED', 'VALIDATED'] },
        dateIntervention: { gte: dateFrom, lte: dateTo },
      },
      include: {
        applicateurs: { include: { employe: { select: { nom: true, prenom: true } } } },
        controls: {
          include: {
            device: { select: { id: true, type: true, displayNumber: true, nom: true, zoneId: true, zone: { select: { nom: true, ordre: true } } } },
            insectCounts: true,
          },
        },
      },
      orderBy: { dateIntervention: 'asc' },
    });

    if (interventions.length === 0) {
      throw new AppError(400, 'Aucune intervention terrain soumise sur cette période');
    }

    const controlStatuses = await prisma.controlStatus.findMany();
    const statusLabel = new Map(controlStatuses.map((s) => [s.code, s.label]));

    const dates = interventions.map((fi) => fi.dateIntervention);

    // ── Collecte des dispositifs vus sur la période (groupés par zone) ──
    type DeviceRow = { id: string; label: string; zoneNom: string; zoneOrdre: number; type: string };
    const devicesById = new Map<string, DeviceRow>();
    for (const fi of interventions) {
      for (const ctrl of fi.controls) {
        if (!devicesById.has(ctrl.device.id)) {
          devicesById.set(ctrl.device.id, {
            id: ctrl.device.id,
            label: `${ctrl.device.type} ${ctrl.device.displayNumber}${ctrl.device.nom ? ' — ' + ctrl.device.nom : ''}`,
            zoneNom: ctrl.device.zone?.nom || '—',
            zoneOrdre: ctrl.device.zone?.ordre ?? 0,
            type: ctrl.device.type,
          });
        }
      }
    }
    const deviceRows = [...devicesById.values()].sort((a, b) => a.zoneOrdre - b.zoneOrdre || a.label.localeCompare(b.label));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RhsControler';
    workbook.created = new Date();

    // ── Feuille Récapitulatif ──
    const recap = workbook.addWorksheet('Récapitulatif');
    recap.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Statut', key: 'statut', width: 14 },
      { header: 'Applicateurs', key: 'applicateurs', width: 30 },
      { header: 'Commentaire', key: 'commentaire', width: 40 },
    ];
    recap.getRow(1).font = { bold: true };
    recap.getRow(1).fill = HEADER_FILL;
    for (const fi of interventions) {
      recap.addRow({
        date: formatDate(fi.dateIntervention),
        type: fi.type,
        statut: fi.statut,
        applicateurs: fi.applicateurs.map((a) => `${a.employe.prenom} ${a.employe.nom}`).join(', '),
        commentaire: fi.commentaire || '',
      });
    }
    recap.addRow({});
    recap.addRow({ date: 'Site', type: site.nom });
    recap.addRow({ date: 'Client', type: site.client?.nomEntreprise || '' });
    recap.addRow({ date: 'Période', type: `${formatDate(dateFrom)} → ${formatDate(dateTo)}` });

    // ── Feuille Contrôles (tableau croisé : dispositif × date → état) ──
    const controls = workbook.addWorksheet('Contrôles');
    controls.columns = [
      { header: 'Zone', key: 'zone', width: 20 },
      { header: 'Dispositif', key: 'device', width: 30 },
      ...dates.map((d, i) => ({ header: formatDate(d), key: `d${i}`, width: 14 })),
    ];
    controls.getRow(1).font = { bold: true };
    controls.getRow(1).fill = HEADER_FILL;
    for (const dev of deviceRows) {
      const row: Record<string, string> = { zone: dev.zoneNom, device: dev.label };
      interventions.forEach((fi, i) => {
        const ctrl = fi.controls.find((c) => c.device.id === dev.id);
        if (ctrl?.statusCode) {
          row[`d${i}`] = statusLabel.get(ctrl.statusCode) || ctrl.statusCode;
        }
      });
      controls.addRow(row);
    }
    autosizeColumns(controls);

    // ── Feuille Insectes (tableau croisé : dispositif FK × espèce × date → comptage) ──
    const insects = workbook.addWorksheet('Insectes');
    insects.columns = [
      { header: 'Zone', key: 'zone', width: 20 },
      { header: 'Dispositif', key: 'device', width: 30 },
      { header: 'Espèce', key: 'espece', width: 18 },
      ...dates.map((d, i) => ({ header: formatDate(d), key: `d${i}`, width: 14 })),
    ];
    insects.getRow(1).font = { bold: true };
    insects.getRow(1).fill = HEADER_FILL;

    const fkDevices = deviceRows.filter((d) => d.type === 'FLYING_INSECT_KILLER');
    const especesByDevice = new Map<string, Set<string>>();
    for (const fi of interventions) {
      for (const ctrl of fi.controls) {
        if (ctrl.device.type !== 'FLYING_INSECT_KILLER') continue;
        if (!especesByDevice.has(ctrl.device.id)) especesByDevice.set(ctrl.device.id, new Set());
        for (const ic of ctrl.insectCounts) especesByDevice.get(ctrl.device.id)!.add(ic.espece);
      }
    }
    for (const dev of fkDevices) {
      const especes = [...(especesByDevice.get(dev.id) || [])].sort();
      for (const espece of especes) {
        const row: Record<string, string | number> = { zone: dev.zoneNom, device: dev.label, espece };
        interventions.forEach((fi, i) => {
          const ctrl = fi.controls.find((c) => c.device.id === dev.id);
          const ic = ctrl?.insectCounts.find((x) => x.espece === espece);
          if (ic) row[`d${i}`] = ic.count;
        });
        insects.addRow(row);
      }
    }
    autosizeColumns(insects);

    const uploadDir = path.join(process.cwd(), 'uploads', 'field-reports', siteId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `rapport-${dateFrom.toISOString().slice(0, 10)}_${dateTo.toISOString().slice(0, 10)}-${Date.now()}.xlsx`;
    const filePath = path.join(uploadDir, filename);
    await workbook.xlsx.writeFile(filePath);

    const existingCount = await prisma.fieldReport.count({ where: { siteId } });

    const dateFromFr = formatDate(dateFrom);
    const dateToFr = formatDate(dateTo);
    const titre = `Rapport terrain — ${site.nom} — ${dateFromFr} au ${dateToFr}`;
    const relativePath = `uploads/field-reports/${siteId}/${filename}`;

    const report = await prisma.fieldReport.create({
      data: {
        siteId,
        dateDebut: dateFrom,
        dateFin: dateTo,
        version: existingCount + 1,
        statut: 'FINAL',
        titre,
        xlsxPath: relativePath,
        generatedById,
      },
    });

    // Auto-archivage dans les documents du site
    await prisma.siteDocument.create({
      data: {
        siteId,
        titre,
        type: 'rapport',
        filename,
        path: relativePath,
        annee: dateFrom.getFullYear(),
        uploadedById: generatedById,
      },
    });

    return report;
  },
};

export default fieldReportService;
