import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { createCanvas } from '@napi-rs/canvas';
import { Chart, registerables } from 'chart.js';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { formatDateFr as formatDate } from '../utils/date.utils.js';

Chart.register(...registerables);

// ── Couleurs ──────────────────────────────────────────────────────────────────
const COLORS: Record<string, string> = {
  Mouches:    '#4472C4',
  Moustiques: '#ED7D31',
  Abeilles:   '#70AD47',
  Papillon:   '#FFC000',
  Autres:     '#7030A0',
  RAS:        '#70AD47',
  CAS:        '#FF4444',
  CON:        '#4472C4',
  EBR:        '#ED7D31',
  INAC:       '#767676',
  RT:         '#A9D18E',
  NT:         '#FFC000',
  SOU:        '#C9C9C9',
};
const FALLBACK_COLORS = ['#4472C4','#ED7D31','#70AD47','#FFC000','#7030A0','#FF4444','#A9D18E','#767676'];
const getColor = (key: string, i: number) => COLORS[key] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];

// ── Référentiel abréviations (légende) ───────────────────────────────────────
const LEGENDE_ETATS = [
  { code: 'RAS',  label: 'Rien à signaler',  description: 'Dispositif en bon état, aucune anomalie' },
  { code: 'CON',  label: 'Consommé',         description: 'Appât consommé totalement' },
  { code: 'EBR',  label: 'Ébréché / Abîmé',  description: 'Dispositif endommagé, nécessite vérification' },
  { code: 'CAS',  label: 'Cassé',            description: 'Dispositif cassé, remplacement nécessaire' },
  { code: 'NT',   label: 'Non trouvé',       description: 'Dispositif introuvable sur site' },
  { code: 'RT',   label: 'Remplacé',         description: 'Dispositif remplacé lors de la visite' },
  { code: 'INAC', label: 'Inactif',          description: 'Dispositif temporairement désactivé' },
  { code: 'SOU',  label: 'Souris',           description: 'Présence de souris détectée dans la boîte' },
];
const LEGENDE_TYPES = [
  { code: 'FK',    label: 'Fly Killer',        description: 'Destructeur d\'insectes volants (lampe UV)' },
  { code: 'Boite', label: 'Boîte appât',       description: 'Station d\'appâtage rodenticide' },
  { code: 'Piège', label: 'Piège mécanique',   description: 'Piège à glu ou piège mécanique' },
];
const LEGENDE_INSECTES = [
  { code: 'Mouches',    label: 'Mouches',     description: 'Mouches domestiques' },
  { code: 'Moustiques', label: 'Moustiques',  description: 'Moustiques (toutes espèces)' },
  { code: 'Abeilles',   label: 'Abeilles',    description: 'Abeilles et espèces apparentées' },
  { code: 'Papillon',   label: 'Papillons',   description: 'Papillons / lépidoptères' },
  { code: 'Autres',     label: 'Autres',      description: 'Autres insectes volants non classifiés' },
];

const ESPECES = ['Mouches', 'Moustiques', 'Abeilles', 'Papillon', 'Autres'] as const;

// ── Styles ExcelJS ────────────────────────────────────────────────────────────
const HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
const TOTAL_FILL: ExcelJS.FillPattern  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' } };
const LEGEND_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
const BORDER: Partial<ExcelJS.Border>  = { style: 'thin', color: { argb: 'FFB8CCE4' } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 22;
  row.eachCell((c) => { c.border = ALL_BORDERS; });
}

function styleTotal(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FF1F3864' } };
  row.fill = TOTAL_FILL;
  row.eachCell((c) => { c.border = ALL_BORDERS; });
}

function addSectionTitle(sheet: ExcelJS.Worksheet, title: string, nbCols: number) {
  const row = sheet.addRow([title]);
  row.font = { bold: true, size: 12, color: { argb: 'FF1F3864' } };
  row.height = 20;
  if (nbCols > 1) sheet.mergeCells(row.number, 1, row.number, nbCols);
  sheet.addRow([]);
}

function autosizeColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 50);
  });
}

// ── Pivot ─────────────────────────────────────────────────────────────────────
function buildPivotCount(rows: { zone: string; key: string }[]): Map<string, Map<string, number>> {
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

// ── Rendu graphique ───────────────────────────────────────────────────────────
async function renderBarChart(
  zones: string[],
  series: { label: string; data: number[] }[],
  title: string,
): Promise<Buffer> {
  if (zones.length === 0 || series.every((s) => s.data.every((v) => v === 0))) return Buffer.alloc(0);

  const chartWidth  = 900;
  const chartHeight = Math.max(380, zones.length * 36 + 160);

  const canvas = createCanvas(chartWidth, chartHeight);
  const ctx    = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, chartWidth, chartHeight);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chart = new Chart(ctx as any, {
    type: 'bar',
    data: {
      labels: zones,
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.data,
        backgroundColor: getColor(s.label, i) + 'B3',
        borderColor: getColor(s.label, i),
        borderWidth: 1,
      })),
    },
    options: {
      animation: false as unknown as object,
      responsive: false,
      indexAxis: 'y',
      plugins: {
        title: {
          display: !!title,
          text: title,
          font: { size: 13, weight: 'bold' },
          color: '#1F3864',
          padding: { bottom: 12 },
        },
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 16 } },
      },
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 } } },
        y: { stacked: true, ticks: { font: { size: 10 } } },
      },
    },
  });

  const buffer = Buffer.from(canvas.toBuffer('image/png'));
  chart.destroy();
  return buffer;
}

async function embedChart(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  buffer: Buffer,
  startRow: number,
) {
  if (!buffer || buffer.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageId = workbook.addImage({ buffer: buffer as any, extension: 'png' });
  sheet.addImage(imageId, {
    tl: { col: 0, row: startRow },
    ext: { width: 900, height: Math.max(380, buffer.length > 0 ? 380 : 0) },
    editAs: 'oneCell',
  });
  // Réserver des lignes pour l'image (≈ 20 lignes à hauteur standard)
  for (let i = 0; i < 22; i++) sheet.addRow([]);
}

// ── Service principal ─────────────────────────────────────────────────────────
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
                zone: { select: { nom: true } },
              },
            },
            insectCounts: true,
          },
        },
      },
      orderBy: { dateIntervention: 'asc' },
    });

    if (interventions.length === 0) throw new AppError(400, 'Aucune donnée sur cette période');

    // ── Collecte brute ────────────────────────────────────────────────────────
    type RawFK   = { visite: string; date: string; zone: string; num: string; counts: Record<string, number>; obs: string };
    type RawCtrl = { visite: string; date: string; zone: string; typeLabel: string; num: string; etat: string; obs: string };

    const fkRows:    RawFK[]   = [];
    const boiteRows: RawCtrl[] = [];
    const piegeRows: RawCtrl[] = [];

    for (const fi of interventions) {
      const dateStr = formatDate(fi.dateIntervention);
      const visite  = 'Visite de contrôle';

      for (const ctrl of fi.controls) {
        const zone      = ctrl.device.zone?.nom ?? '—';
        const num       = String(ctrl.device.displayNumber ?? '');
        const obs       = ctrl.observation ?? '';
        const type      = ctrl.device.type;
        const typeLabel = type === 'BAIT_STATION' ? 'Boite' : type === 'MECHANICAL_TRAP' ? 'Piège' : type === 'GLUE_TRAP' ? 'Colle' : 'FK';

        if (type === 'FLYING_INSECT_KILLER') {
          const counts: Record<string, number> = { Mouches: 0, Moustiques: 0, Abeilles: 0, Papillon: 0, Autres: 0 };
          for (const ic of ctrl.insectCounts) {
            if (ic.espece in counts) counts[ic.espece] = ic.count;
            else counts['Autres'] += ic.count;
          }
          fkRows.push({ visite, date: dateStr, zone, num, counts, obs });
        } else if (type === 'BAIT_STATION') {
          boiteRows.push({ visite, date: dateStr, zone, typeLabel, num, etat: ctrl.statusCode ?? '', obs });
        } else {
          piegeRows.push({ visite, date: dateStr, zone, typeLabel, num, etat: ctrl.statusCode ?? '', obs });
        }
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RhsControler';
    workbook.created = new Date();

    // ── 1. FEUILLE LÉGENDE ────────────────────────────────────────────────────
    const sheetLeg = workbook.addWorksheet('Légende');
    sheetLeg.properties.tabColor = { argb: 'FF1F3864' };

    addSectionTitle(sheetLeg, '📋 LÉGENDE — ÉTATS DES DISPOSITIFS', 3);
    const legH1 = sheetLeg.addRow(['Code', 'Libellé', 'Description']);
    styleHeader(legH1);
    for (const e of LEGENDE_ETATS) {
      const row = sheetLeg.addRow([e.code, e.label, e.description]);
      row.getCell(1).font = { bold: true, color: { argb: 'FF1F3864' } };
      row.fill = LEGEND_FILL;
      row.eachCell((c) => { c.border = ALL_BORDERS; });
    }

    sheetLeg.addRow([]);
    addSectionTitle(sheetLeg, '🦟 ESPÈCES D\'INSECTES (FK — Destructeurs)', 3);
    const legH2 = sheetLeg.addRow(['Espèce', 'Libellé', 'Description']);
    styleHeader(legH2);
    for (const e of LEGENDE_INSECTES) {
      const row = sheetLeg.addRow([e.code, e.label, e.description]);
      row.getCell(1).font = { bold: true, color: { argb: 'FF1F3864' } };
      row.fill = LEGEND_FILL;
      row.eachCell((c) => { c.border = ALL_BORDERS; });
    }

    sheetLeg.addRow([]);
    addSectionTitle(sheetLeg, '📦 TYPES DE DISPOSITIFS', 3);
    const legH3 = sheetLeg.addRow(['Code', 'Libellé', 'Description']);
    styleHeader(legH3);
    for (const e of LEGENDE_TYPES) {
      const row = sheetLeg.addRow([e.code, e.label, e.description]);
      row.getCell(1).font = { bold: true, color: { argb: 'FF1F3864' } };
      row.fill = LEGEND_FILL;
      row.eachCell((c) => { c.border = ALL_BORDERS; });
    }
    autosizeColumns(sheetLeg);

    // ── 2. FEUILLE FK (données brutes) ────────────────────────────────────────
    const sheetFK = workbook.addWorksheet('FK');
    sheetFK.properties.tabColor = { argb: 'FF4472C4' };
    addSectionTitle(sheetFK, 'Contrôle destructeurs d\'insectes', ESPECES.length + 6);
    const fkHeader = sheetFK.addRow(['Opération / visite', 'Date', 'ZONE', 'Type', 'N°', ...ESPECES, 'Observation']);
    styleHeader(fkHeader);
    for (const r of fkRows) {
      const row = sheetFK.addRow([r.visite, r.date, r.zone, 'FK', r.num, ...ESPECES.map((e) => r.counts[e] || ''), r.obs]);
      row.eachCell((c) => { c.border = ALL_BORDERS; c.alignment = { vertical: 'middle' }; });
    }
    if (fkRows.length === 0) sheetFK.addRow(['— Aucun destructeur d\'insectes enregistré sur cette période —']);
    autosizeColumns(sheetFK);

    // ── 3. FEUILLE GRAPH FK (pivot + graphique) ───────────────────────────────
    const graphFK = workbook.addWorksheet('Graph dynamique FK');
    graphFK.properties.tabColor = { argb: 'FF4472C4' };
    addSectionTitle(graphFK, 'Synthèse par zone — Destructeurs d\'insectes', ESPECES.length + 2);

    // Pivot FK
    const fkPivotRows: { zone: string; key: string; value: number }[] = [];
    for (const r of fkRows) for (const e of ESPECES) fkPivotRows.push({ zone: r.zone, key: e, value: r.counts[e] ?? 0 });
    const fkPivot     = buildPivotSum(fkPivotRows);
    const allFkZones  = [...fkPivot.keys()].sort();

    const fkPivotHeader = graphFK.addRow(['Zone', ...ESPECES.map((e) => `${e}`), 'Total']);
    styleHeader(fkPivotHeader);
    const fkColTotals: Record<string, number> = {};
    for (const e of ESPECES) fkColTotals[e] = 0;
    let fkGrandTotal = 0;

    for (const zone of allFkZones) {
      const zMap = fkPivot.get(zone)!;
      const vals = ESPECES.map((e) => zMap.get(e) ?? 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const row = graphFK.addRow([zone, ...vals, total]);
      row.eachCell((c) => { c.border = ALL_BORDERS; c.alignment = { vertical: 'middle' }; });
      ESPECES.forEach((e, i) => { fkColTotals[e] += vals[i]; });
      fkGrandTotal += total;
    }
    if (allFkZones.length === 0) graphFK.addRow(['— Aucune donnée FK —']);
    const fkTotalRow = graphFK.addRow(['TOTAL', ...ESPECES.map((e) => fkColTotals[e]), fkGrandTotal]);
    styleTotal(fkTotalRow);
    autosizeColumns(graphFK);

    // Graphique FK
    const fkChartBuffer = await renderBarChart(
      allFkZones,
      ESPECES.map((e) => ({ label: e, data: allFkZones.map((z) => fkPivot.get(z)?.get(e) ?? 0) })),
      'Destructeurs d\'insectes — captures par zone',
    );
    await embedChart(workbook, graphFK, fkChartBuffer, graphFK.rowCount + 1);

    // ── 4. FEUILLE PIÈGES (données brutes) ───────────────────────────────────
    const sheetPieges = workbook.addWorksheet('Pièges');
    sheetPieges.properties.tabColor = { argb: 'FFED7D31' };
    addSectionTitle(sheetPieges, 'Contrôle des pièges', 7);
    const piegesHeader = sheetPieges.addRow(['Opération / visite', 'Date', 'ZONE', 'Type', 'N°', 'État', 'Observation']);
    styleHeader(piegesHeader);
    for (const r of piegeRows) {
      const row = sheetPieges.addRow([r.visite, r.date, r.zone, r.typeLabel, r.num, r.etat, r.obs]);
      row.eachCell((c) => { c.border = ALL_BORDERS; c.alignment = { vertical: 'middle' }; });
    }
    if (piegeRows.length === 0) sheetPieges.addRow(['— Aucun piège enregistré sur cette période —']);
    autosizeColumns(sheetPieges);

    // ── 5. FEUILLE GRAPH PIÈGES (pivot + graphique) ───────────────────────────
    const allPiegeEtats = [...new Set(piegeRows.map((r) => r.etat).filter(Boolean))].sort();
    const graphPieges   = workbook.addWorksheet('Graph dynamique pièges');
    graphPieges.properties.tabColor = { argb: 'FFED7D31' };
    addSectionTitle(graphPieges, 'Synthèse par zone — Pièges', allPiegeEtats.length + 3);

    const piegePivot    = buildPivotCount(piegeRows.filter((r) => r.etat).map((r) => ({ zone: r.zone, key: r.etat })));
    const allPiegeZones = [...piegePivot.keys()].sort();

    const piegesGHeader = graphPieges.addRow(['Zone', ...allPiegeEtats, 'Total']);
    styleHeader(piegesGHeader);
    const piegeColTotals: Record<string, number> = {};
    let piegeGrandTotal = 0;

    for (const zone of allPiegeZones) {
      const zMap = piegePivot.get(zone)!;
      const vals = allPiegeEtats.map((e) => zMap.get(e) ?? 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const row = graphPieges.addRow([zone, ...vals, total]);
      row.eachCell((c) => { c.border = ALL_BORDERS; });
      allPiegeEtats.forEach((e, i) => { piegeColTotals[e] = (piegeColTotals[e] ?? 0) + vals[i]; });
      piegeGrandTotal += total;
    }
    if (allPiegeZones.length === 0) graphPieges.addRow(['— Aucune donnée pièges —']);
    const piegesTotalRow = graphPieges.addRow(['TOTAL', ...allPiegeEtats.map((e) => piegeColTotals[e] ?? 0), piegeGrandTotal]);
    styleTotal(piegesTotalRow);
    autosizeColumns(graphPieges);

    const piegesChartBuffer = await renderBarChart(
      allPiegeZones,
      allPiegeEtats.map((e) => ({ label: e, data: allPiegeZones.map((z) => piegePivot.get(z)?.get(e) ?? 0) })),
      'Pièges — états par zone',
    );
    await embedChart(workbook, graphPieges, piegesChartBuffer, graphPieges.rowCount + 1);

    // ── 6. FEUILLE BOITES (données brutes) ───────────────────────────────────
    const sheetBoites = workbook.addWorksheet('Boites');
    sheetBoites.properties.tabColor = { argb: 'FF70AD47' };
    addSectionTitle(sheetBoites, 'Contrôle des boîtes appât', 7);
    const boitesHeader = sheetBoites.addRow(['Opération / visite', 'Date', 'ZONE', 'Type', 'N°', 'État', 'Observation']);
    styleHeader(boitesHeader);
    for (const r of boiteRows) {
      const row = sheetBoites.addRow([r.visite, r.date, r.zone, r.typeLabel, r.num, r.etat, r.obs]);
      row.eachCell((c) => { c.border = ALL_BORDERS; c.alignment = { vertical: 'middle' }; });
    }
    if (boiteRows.length === 0) sheetBoites.addRow(['— Aucune boîte enregistrée sur cette période —']);
    autosizeColumns(sheetBoites);

    // ── 7. FEUILLE GRAPH BOITES (pivot + graphique) ───────────────────────────
    const allBoiteEtats = [...new Set(boiteRows.map((r) => r.etat).filter(Boolean))].sort();
    const graphBoite    = workbook.addWorksheet('Graph dynamique boite');
    graphBoite.properties.tabColor = { argb: 'FF70AD47' };
    addSectionTitle(graphBoite, 'Synthèse par zone — Boîtes appât', allBoiteEtats.length + 3);

    const boitePivot    = buildPivotCount(boiteRows.filter((r) => r.etat).map((r) => ({ zone: r.zone, key: r.etat })));
    const allBoiteZones = [...boitePivot.keys()].sort();

    const boiteGHeader = graphBoite.addRow(['Zone', ...allBoiteEtats, 'Total']);
    styleHeader(boiteGHeader);
    const boiteColTotals: Record<string, number> = {};
    let boiteGrandTotal = 0;

    for (const zone of allBoiteZones) {
      const zMap = boitePivot.get(zone)!;
      const vals = allBoiteEtats.map((e) => zMap.get(e) ?? 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const row = graphBoite.addRow([zone, ...vals, total]);
      row.eachCell((c) => { c.border = ALL_BORDERS; });
      allBoiteEtats.forEach((e, i) => { boiteColTotals[e] = (boiteColTotals[e] ?? 0) + vals[i]; });
      boiteGrandTotal += total;
    }
    if (allBoiteZones.length === 0) graphBoite.addRow(['— Aucune donnée boîtes —']);
    const boiteTotalRow = graphBoite.addRow(['TOTAL', ...allBoiteEtats.map((e) => boiteColTotals[e] ?? 0), boiteGrandTotal]);
    styleTotal(boiteTotalRow);
    autosizeColumns(graphBoite);

    const boiteChartBuffer = await renderBarChart(
      allBoiteZones,
      allBoiteEtats.map((e) => ({ label: e, data: allBoiteZones.map((z) => boitePivot.get(z)?.get(e) ?? 0) })),
      'Boîtes appât — états par zone',
    );
    await embedChart(workbook, graphBoite, boiteChartBuffer, graphBoite.rowCount + 1);

    // ── Sauvegarde ────────────────────────────────────────────────────────────
    const uploadDir = path.join(process.cwd(), 'uploads', 'field-reports', siteId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const filename     = `rapport-${dateFrom.toISOString().slice(0, 10)}_${dateTo.toISOString().slice(0, 10)}-${Date.now()}.xlsx`;
    const filePath     = path.join(uploadDir, filename);
    await workbook.xlsx.writeFile(filePath);

    const existingCount = await prisma.fieldReport.count({ where: { siteId } });
    const titre         = `Rapport tendance — ${site.nom} — ${formatDate(dateFrom)} au ${formatDate(dateTo)}`;
    const relativePath  = `uploads/field-reports/${siteId}/${filename}`;

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
