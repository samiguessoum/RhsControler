import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { formatDateFr as formatDate } from '../utils/date.utils.js';

// ── Styles ────────────────────────────────────────────────────────────────────
const HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
const TITLE_FILL: ExcelJS.FillPattern  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
const TOTAL_FILL: ExcelJS.FillPattern  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' } };
const BORDER_THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFB8CCE4' } };
const ALL_BORDERS = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };

const ESPECES = ['Mouches', 'Moustiques', 'Abeilles', 'Papillon', 'Autres'] as const;

// Device type → label court pour la colonne "Type"
const TYPE_LABEL: Record<string, string> = {
  BAIT_STATION:         'Boite',
  MECHANICAL_TRAP:      'Piège',
  GLUE_TRAP:            'Colle',
  FLYING_INSECT_KILLER: 'FK',
};

function styleHeader(row: ExcelJS.Row, dark = false) {
  row.font = { bold: true, color: { argb: dark ? 'FFFFFFFF' : 'FF1F3864' } };
  row.fill = dark ? TITLE_FILL : HEADER_FILL;
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.eachCell((c) => { c.border = ALL_BORDERS; });
}

function styleTotal(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = TOTAL_FILL;
  row.eachCell((c) => { c.border = ALL_BORDERS; });
}

function autosizeColumns(sheet: ExcelJS.Worksheet, minWidth = 10) {
  sheet.columns.forEach((col) => {
    let max = minWidth;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 45);
  });
}

// Pivot : zone → { état/espèce → count }
function buildPivot(rows: { zone: string; key: string }[]): Map<string, Map<string, number>> {
  const pivot = new Map<string, Map<string, number>>();
  for (const { zone, key } of rows) {
    if (!pivot.has(zone)) pivot.set(zone, new Map());
    pivot.get(zone)!.set(key, (pivot.get(zone)!.get(key) ?? 0) + 1);
  }
  return pivot;
}

function buildPivotSum(rows: { zone: string; key: string; value: number }[]): Map<string, Map<string, number>> {
  const pivot = new Map<string, Map<string, number>>();
  for (const { zone, key, value } of rows) {
    if (!pivot.has(zone)) pivot.set(zone, new Map());
    pivot.get(zone)!.set(key, (pivot.get(zone)!.get(key) ?? 0) + value);
  }
  return pivot;
}

export const fieldReportService = {
  async generateSiteHistoryReport(siteId: string, dateFrom: Date, dateTo: Date, generatedById: string) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { client: { select: { nomEntreprise: true } } },
    });
    if (!site) throw new AppError(404, 'Site introuvable');

    const interventions = await prisma.fieldIntervention.findMany({
      where: {
        siteId,
        statut: { in: ['SUBMITTED', 'VALIDATED'] },
        dateIntervention: { gte: dateFrom, lte: dateTo },
      },
      include: {
        controls: {
          include: {
            device: {
              select: {
                id: true, type: true, displayNumber: true, nom: true,
                zone: { select: { nom: true, ordre: true } },
              },
            },
            insectCounts: true,
          },
        },
      },
      orderBy: { dateIntervention: 'asc' },
    });

    const reclamations = await prisma.reclamation.findMany({
      where: { siteId, date: { gte: dateFrom, lte: dateTo } },
      include: { createdBy: { select: { prenom: true, nom: true } } },
      orderBy: { date: 'asc' },
    });

    if (interventions.length === 0 && reclamations.length === 0) {
      throw new AppError(400, 'Aucune donnée sur cette période');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RhsControler';
    workbook.created = new Date();

    // ─────────────────────────────────────────────────────────────────────────
    // Collecte des lignes brutes par catégorie de dispositif
    // ─────────────────────────────────────────────────────────────────────────
    type RawFK    = { visite: string; date: string; zone: string; num: string; counts: Record<string, number>; obs: string };
    type RawCtrl  = { visite: string; date: string; zone: string; typeLabel: string; num: string; etat: string; obs: string };

    const fkRows:    RawFK[]   = [];
    const boiteRows: RawCtrl[] = [];
    const piegeRows: RawCtrl[] = [];

    for (const fi of interventions) {
      const dateStr  = formatDate(fi.dateIntervention);
      const visite   = 'Visite de contrôle';

      for (const ctrl of fi.controls) {
        const zone = ctrl.device.zone?.nom ?? '—';
        const num  = String(ctrl.device.displayNumber ?? '');
        const obs  = ctrl.observation ?? '';
        const type = ctrl.device.type;
        const typeLabel = TYPE_LABEL[type] ?? type;

        if (type === 'FLYING_INSECT_KILLER') {
          const counts: Record<string, number> = {};
          for (const espece of ESPECES) counts[espece] = 0;
          for (const ic of ctrl.insectCounts) {
            if (counts[ic.espece] !== undefined) counts[ic.espece] = ic.count;
            else counts['Autres'] = (counts['Autres'] ?? 0) + ic.count;
          }
          fkRows.push({ visite, date: dateStr, zone, num, counts, obs });
        } else if (type === 'BAIT_STATION') {
          boiteRows.push({ visite, date: dateStr, zone, typeLabel, num, etat: ctrl.statusCode ?? '', obs });
        } else {
          // MECHANICAL_TRAP, GLUE_TRAP → Pièges
          piegeRows.push({ visite, date: dateStr, zone, typeLabel, num, etat: ctrl.statusCode ?? '', obs });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers pour créer une feuille titre + données brutes
    // ─────────────────────────────────────────────────────────────────────────
    const addTitleRow = (sheet: ExcelJS.Worksheet, title: string, nbCols: number) => {
      const row = sheet.addRow([title]);
      row.font = { bold: true, size: 13, color: { argb: 'FF1F3864' } };
      sheet.mergeCells(row.number, 1, row.number, nbCols);
      sheet.addRow([]); // ligne vide
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Feuille "Graph dynamique FK"
    // ─────────────────────────────────────────────────────────────────────────
    const graphFK = workbook.addWorksheet('Graph dynamique FK');
    addTitleRow(graphFK, 'Graph dynamique destructeurs d\'insectes :', ESPECES.length + 2);

    // Pivot : zone → somme par espèce
    const fkPivotRows: { zone: string; key: string; value: number }[] = [];
    for (const r of fkRows) {
      for (const espece of ESPECES) {
        fkPivotRows.push({ zone: r.zone, key: espece, value: r.counts[espece] ?? 0 });
      }
    }
    const fkPivot = buildPivotSum(fkPivotRows);
    const allFkZones = [...fkPivot.keys()].sort();

    const fkHeaderRow = graphFK.addRow(['Étiquettes de lignes', ...ESPECES.map((e) => `Somme de ${e}`), 'Total général']);
    styleHeader(fkHeaderRow, true);

    const fkTotals: Record<string, number> = {};
    for (const espece of ESPECES) fkTotals[espece] = 0;
    let fkGrandTotal = 0;

    for (const zone of allFkZones) {
      const zMap = fkPivot.get(zone)!;
      const vals = ESPECES.map((e) => zMap.get(e) ?? 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const row = graphFK.addRow([zone, ...vals, total]);
      row.eachCell((c) => { c.border = ALL_BORDERS; });
      ESPECES.forEach((e, i) => { fkTotals[e] = (fkTotals[e] ?? 0) + vals[i]; });
      fkGrandTotal += total;
    }

    const fkTotalRow = graphFK.addRow(['Total général', ...ESPECES.map((e) => fkTotals[e] ?? 0), fkGrandTotal]);
    styleTotal(fkTotalRow);
    autosizeColumns(graphFK);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Feuille "FK" (données brutes)
    // ─────────────────────────────────────────────────────────────────────────
    const sheetFK = workbook.addWorksheet('FK');
    addTitleRow(sheetFK, 'Contrôle destructeurs :', ESPECES.length + 6);

    const fkDataHeader = sheetFK.addRow(['Opération/visite', 'Date', 'ZONE', 'Type', 'N°', ...ESPECES, 'Observation']);
    styleHeader(fkDataHeader, true);

    for (const r of fkRows) {
      const row = sheetFK.addRow([r.visite, r.date, r.zone, 'FK', r.num, ...ESPECES.map((e) => r.counts[e] || ''), r.obs]);
      row.eachCell((c) => { c.border = ALL_BORDERS; });
    }
    autosizeColumns(sheetFK);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Feuille "Graph dynamique pièges"
    // ─────────────────────────────────────────────────────────────────────────
    const allPiegeEtats = [...new Set(piegeRows.map((r) => r.etat).filter(Boolean))].sort();
    const graphPieges = workbook.addWorksheet('Graph dynamique pièges');
    addTitleRow(graphPieges, 'Graph dynamique pièges :', allPiegeEtats.length + 3);

    const piegePivot = buildPivot(piegeRows.filter((r) => r.etat).map((r) => ({ zone: r.zone, key: r.etat })));
    const allPiegeZones = [...piegePivot.keys()].sort();

    const piegeHeaderRow = graphPieges.addRow(['Étiquettes de lignes', ...allPiegeEtats, 'Total général']);
    styleHeader(piegeHeaderRow, true);

    const piegeTotals: Record<string, number> = {};
    let piegeGrandTotal = 0;
    for (const zone of allPiegeZones) {
      const zMap = piegePivot.get(zone)!;
      const vals = allPiegeEtats.map((e) => zMap.get(e) ?? 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const row = graphPieges.addRow([zone, ...vals, total]);
      row.eachCell((c) => { c.border = ALL_BORDERS; });
      allPiegeEtats.forEach((e, i) => { piegeTotals[e] = (piegeTotals[e] ?? 0) + vals[i]; });
      piegeGrandTotal += total;
    }
    const piegeTotalRow = graphPieges.addRow(['Total général', ...allPiegeEtats.map((e) => piegeTotals[e] ?? 0), piegeGrandTotal]);
    styleTotal(piegeTotalRow);
    autosizeColumns(graphPieges);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Feuille "Pièges" (données brutes)
    // ─────────────────────────────────────────────────────────────────────────
    const sheetPieges = workbook.addWorksheet('Pièges');
    addTitleRow(sheetPieges, 'Contrôle pièges :', 7);

    const piegesDataHeader = sheetPieges.addRow(['Opération/visite', 'Date', 'ZONE', 'Type', 'N°', 'Etat', 'Observation']);
    styleHeader(piegesDataHeader, true);

    for (const r of piegeRows) {
      const row = sheetPieges.addRow([r.visite, r.date, r.zone, r.typeLabel, r.num, r.etat, r.obs]);
      row.eachCell((c) => { c.border = ALL_BORDERS; });
    }
    autosizeColumns(sheetPieges);

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Feuille "Graph dynamique boite"
    // ─────────────────────────────────────────────────────────────────────────
    const allBoiteEtats = [...new Set(boiteRows.map((r) => r.etat).filter(Boolean))].sort();
    const graphBoite = workbook.addWorksheet('Graph dynamique boite');
    addTitleRow(graphBoite, 'Graph dynamique boites :', allBoiteEtats.length + 3);

    const boitePivot = buildPivot(boiteRows.filter((r) => r.etat).map((r) => ({ zone: r.zone, key: r.etat })));
    const allBoiteZones = [...boitePivot.keys()].sort();

    const boiteHeaderRow = graphBoite.addRow(['Étiquettes de lignes', ...allBoiteEtats, 'Total général']);
    styleHeader(boiteHeaderRow, true);

    const boiteTotals: Record<string, number> = {};
    let boiteGrandTotal = 0;
    for (const zone of allBoiteZones) {
      const zMap = boitePivot.get(zone)!;
      const vals = allBoiteEtats.map((e) => zMap.get(e) ?? 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const row = graphBoite.addRow([zone, ...vals, total]);
      row.eachCell((c) => { c.border = ALL_BORDERS; });
      allBoiteEtats.forEach((e, i) => { boiteTotals[e] = (boiteTotals[e] ?? 0) + vals[i]; });
      boiteGrandTotal += total;
    }
    const boiteTotalRow = graphBoite.addRow(['Total général', ...allBoiteEtats.map((e) => boiteTotals[e] ?? 0), boiteGrandTotal]);
    styleTotal(boiteTotalRow);
    autosizeColumns(graphBoite);

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Feuille "Boites" (données brutes)
    // ─────────────────────────────────────────────────────────────────────────
    const sheetBoites = workbook.addWorksheet('Boites');
    addTitleRow(sheetBoites, 'Contrôle des boites :', 7);

    const boitesDataHeader = sheetBoites.addRow(['Opération/visite', 'Date', 'ZONE', 'Type', 'N°', 'Etat', 'Observation']);
    styleHeader(boitesDataHeader, true);

    for (const r of boiteRows) {
      const row = sheetBoites.addRow([r.visite, r.date, r.zone, r.typeLabel, r.num, r.etat, r.obs]);
      row.eachCell((c) => { c.border = ALL_BORDERS; });
    }
    autosizeColumns(sheetBoites);

    // ─────────────────────────────────────────────────────────────────────────
    // Sauvegarde
    // ─────────────────────────────────────────────────────────────────────────
    const uploadDir = path.join(process.cwd(), 'uploads', 'field-reports', siteId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `rapport-${dateFrom.toISOString().slice(0, 10)}_${dateTo.toISOString().slice(0, 10)}-${Date.now()}.xlsx`;
    const filePath = path.join(uploadDir, filename);
    await workbook.xlsx.writeFile(filePath);

    const existingCount = await prisma.fieldReport.count({ where: { siteId } });
    const dateFromFr = formatDate(dateFrom);
    const dateToFr   = formatDate(dateTo);
    const titre = `Rapport tendance — ${site.nom} — ${dateFromFr} au ${dateToFr}`;
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
