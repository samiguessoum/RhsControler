import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { formatDateFr as formatDate } from '../utils/date.utils.js';

// ── Polices ───────────────────────────────────────────────────────────────────
// Chargement des polices Liberation (installées via apt fonts-liberation)
const FONT_PATHS = [
  ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 'Liberation'],
  ['/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', 'LiberationBold'],
  // macOS fallback (dev)
  ['/System/Library/Fonts/Helvetica.ttc', 'Liberation'],
  ['/Library/Fonts/Arial.ttf', 'Liberation'],
];
for (const [fp, name] of FONT_PATHS) {
  try { if (fs.existsSync(fp)) GlobalFonts.registerFromPath(fp, name); } catch (_) { /* optionnel */ }
}
const FONT = 'Liberation, Arial, sans-serif';

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
const FALLBACK = ['#4472C4', '#ED7D31', '#70AD47', '#FFC000', '#7030A0', '#FF4444', '#A9D18E'];
const getColor = (key: string, i: number) => COLORS[key] ?? FALLBACK[i % FALLBACK.length];

const ESPECES = ['Mouches', 'Moustiques', 'Abeilles', 'Papillon', 'Autres'] as const;

// ── Légende abréviations ──────────────────────────────────────────────────────
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
const LEGENDE_INSECTES = [
  { code: 'Mouches',    label: 'Mouches',    description: 'Mouches domestiques' },
  { code: 'Moustiques', label: 'Moustiques', description: 'Moustiques (toutes espèces)' },
  { code: 'Abeilles',   label: 'Abeilles',   description: 'Abeilles et espèces apparentées' },
  { code: 'Papillon',   label: 'Papillons',  description: 'Papillons / lépidoptères' },
  { code: 'Autres',     label: 'Autres',     description: 'Autres insectes volants non classifiés' },
];
const LEGENDE_TYPES = [
  { code: 'FK',    label: 'Fly Killer',      description: 'Destructeur d\'insectes volants (lampe UV)' },
  { code: 'Boite', label: 'Boîte appât',     description: 'Station d\'appâtage rodenticide' },
  { code: 'Piège', label: 'Piège mécanique', description: 'Piège à glu ou piège mécanique' },
];

// ── Styles ExcelJS ────────────────────────────────────────────────────────────
const HDR_FILL: ExcelJS.FillPattern  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
const TOT_FILL: ExcelJS.FillPattern  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' } };
const LEG_FILL: ExcelJS.FillPattern  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
const BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFB8CCE4' } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = HDR_FILL;
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 22;
  row.eachCell((c) => { c.border = ALL_BORDERS; });
}

function styleTotal(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FF1F3864' } };
  row.fill = TOT_FILL;
  row.eachCell((c) => { c.border = ALL_BORDERS; });
}

function addTitle(sheet: ExcelJS.Worksheet, title: string, nbCols: number) {
  const row = sheet.addRow([title]);
  row.font = { bold: true, size: 12, color: { argb: 'FF1F3864' } };
  row.height = 20;
  if (nbCols > 1) sheet.mergeCells(row.number, 1, row.number, nbCols);
  sheet.addRow([]);
}

function autosize(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (c) => {
      const len = String(c.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 50);
  });
}

// ── Pivot ─────────────────────────────────────────────────────────────────────
function pivotCount(rows: { zone: string; key: string }[]): Map<string, Map<string, number>> {
  const m = new Map<string, Map<string, number>>();
  for (const { zone, key } of rows) {
    if (!m.has(zone)) m.set(zone, new Map());
    m.get(zone)!.set(key, (m.get(zone)!.get(key) ?? 0) + 1);
  }
  return m;
}

function pivotSum(rows: { zone: string; key: string; value: number }[]): Map<string, Map<string, number>> {
  const m = new Map<string, Map<string, number>>();
  for (const { zone, key, value } of rows) {
    if (!m.has(zone)) m.set(zone, new Map());
    m.get(zone)!.set(key, (m.get(zone)!.get(key) ?? 0) + value);
  }
  return m;
}

// ── Arrondi max vers un "beau" chiffre pour l'axe Y ─────────────────────────
function niceMax(v: number): number {
  if (v <= 0) return 10;
  const exp   = Math.pow(10, Math.floor(Math.log10(v)));
  const coeff = v / exp;
  const nice  = coeff <= 1 ? 1 : coeff <= 2 ? 2 : coeff <= 5 ? 5 : 10;
  return nice * exp;
}

// ── Rendu graphique — barres verticales groupées ──────────────────────────────
// X = zones · Y = count · un bâtonnet par série côte à côte
// Canvas adaptatif : s'élargit automatiquement si beaucoup de zones
async function renderVerticalBarChart(
  zones: string[],
  series: { label: string; data: number[] }[],
  title: string,
): Promise<Buffer | null> {
  const activeSeries = series.filter((s) => s.data.some((v) => v > 0));
  if (zones.length === 0 || activeSeries.length === 0) return null;

  const n = zones.length;
  const m = activeSeries.length;

  // ── Layout adaptatif ──
  const PAD_TOP    = 54;
  const PAD_LEFT   = 50;
  const PAD_RIGHT  = 28;
  const CHART_H    = 260;

  // Angle + taille des labels X selon densité
  const labelAngle   = n > 7 ? -55 : -40;
  const labelFontSz  = n > 12 ? 8 : n > 7 ? 9 : 10;
  const labelMaxPx   = n > 7 ? 72 : 90;
  const PAD_LABELS   = n > 7 ? 88 : 70;
  const PAD_LEGEND   = 32;
  const CANVAS_H     = PAD_TOP + CHART_H + PAD_LABELS + PAD_LEGEND;

  // Largeur minimale par groupe pour que les barres restent lisibles
  const MIN_BAR_W  = 7;
  const BAR_GAP    = 2;
  const minGroupW  = m * MIN_BAR_W + (m - 1) * BAR_GAP;
  const minGroupSt = minGroupW / 0.65; // 65 % utilisé par les barres
  const CANVAS_W   = Math.max(820, Math.ceil(PAD_LEFT + PAD_RIGHT + n * minGroupSt));

  const chartW    = CANVAS_W - PAD_LEFT - PAD_RIGHT;
  const groupStep = chartW / n;
  const groupW    = groupStep * 0.65;
  const groupOff  = (groupStep - groupW) / 2;
  const barW      = Math.max(MIN_BAR_W, (groupW - BAR_GAP * (m - 1)) / m);

  const yMax = niceMax(Math.max(...activeSeries.flatMap((s) => s.data), 1));

  // ── Canvas ──
  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  const ctx    = canvas.getContext('2d');

  // Fond global très léger
  ctx.fillStyle = '#F7F9FC';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Zone de graphique blanche avec légère ombre portée simulée
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(PAD_LEFT - 4, PAD_TOP - 4, chartW + 8, CHART_H + 8);

  // ── Titre ──
  ctx.fillStyle    = '#1E3A5F';
  ctx.font         = `bold 13px ${FONT}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, PAD_LEFT + chartW / 2, 27);

  // ── Grille + étiquettes Y ──
  const TICKS = 5;
  for (let t = 0; t <= TICKS; t++) {
    const val = Math.round((yMax * t) / TICKS);
    const y   = PAD_TOP + CHART_H - (t / TICKS) * CHART_H;

    if (t > 0) {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = '#DDE3EC';
      ctx.lineWidth   = 0.8;
      ctx.beginPath(); ctx.moveTo(PAD_LEFT, y); ctx.lineTo(PAD_LEFT + chartW, y); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle    = '#8896A8';
    ctx.font         = `9px ${FONT}`;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(val), PAD_LEFT - 7, y);
  }

  // Axe bas (ligne solide)
  ctx.strokeStyle = '#BDC7D8';
  ctx.lineWidth   = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(PAD_LEFT, PAD_TOP + CHART_H);
  ctx.lineTo(PAD_LEFT + chartW, PAD_TOP + CHART_H);
  ctx.stroke();

  // Axe gauche
  ctx.beginPath();
  ctx.moveTo(PAD_LEFT, PAD_TOP);
  ctx.lineTo(PAD_LEFT, PAD_TOP + CHART_H);
  ctx.stroke();

  // ── Barres ──
  const BASE_Y = PAD_TOP + CHART_H;

  for (let zi = 0; zi < n; zi++) {
    const groupLeft = PAD_LEFT + groupStep * zi + groupOff;
    const groupCX   = PAD_LEFT + groupStep * zi + groupStep / 2;

    for (let si = 0; si < m; si++) {
      const val = activeSeries[si].data[zi] ?? 0;
      if (val === 0) continue;

      const h    = Math.max((val / yMax) * CHART_H, 3);
      const x    = groupLeft + si * (barW + BAR_GAP);
      const r    = Math.min(3, barW / 3, h / 3); // rayon des coins arrondis
      const color = getColor(activeSeries[si].label, si);

      // Barre avec sommet arrondi
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, BASE_Y);
      ctx.lineTo(x, BASE_Y - h + r);
      ctx.quadraticCurveTo(x, BASE_Y - h, x + r, BASE_Y - h);
      ctx.lineTo(x + barW - r, BASE_Y - h);
      ctx.quadraticCurveTo(x + barW, BASE_Y - h, x + barW, BASE_Y - h + r);
      ctx.lineTo(x + barW, BASE_Y);
      ctx.closePath();
      ctx.fill();

      // Valeur au-dessus (seulement si suffisamment de place)
      if (barW >= 14) {
        ctx.fillStyle    = '#3D4B5C';
        ctx.font         = `bold ${Math.min(9, barW - 2)}px ${FONT}`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(val), x + barW / 2, BASE_Y - h - 2);
      }
    }

    // Étiquette zone (angle adaptatif)
    ctx.save();
    ctx.translate(groupCX, BASE_Y + 6);
    ctx.rotate((labelAngle * Math.PI) / 180);
    ctx.fillStyle    = '#556070';
    ctx.font         = `${labelFontSz}px ${FONT}`;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    let label = zones[zi];
    while (label.length > 1 && ctx.measureText(label + '…').width > labelMaxPx)
      label = label.slice(0, -1);
    if (label !== zones[zi]) label += '…';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  // ── Légende centrée ──
  const LEG_Y = PAD_TOP + CHART_H + PAD_LABELS + 6;
  ctx.font = `10px ${FONT}`;
  const items = activeSeries.map((s, i) => ({
    label: s.label,
    color: getColor(s.label, i),
    w: 13 + 5 + ctx.measureText(s.label).width + 14,
  }));
  const totalW = items.reduce((a, b) => a + b.w, 0);
  let lx = PAD_LEFT + Math.max(0, (chartW - totalW) / 2);

  for (const item of items) {
    // Carré coloré arrondi
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(lx, LEG_Y, 11, 11, 2);
    ctx.fill();

    ctx.fillStyle    = '#445060';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, lx + 15, LEG_Y + 5);
    lx += item.w;
    // Retour à la ligne si débordement
    if (lx > PAD_LEFT + chartW - 30) lx = PAD_LEFT;
  }

  return Buffer.from(canvas.toBuffer('image/png'));
}

async function embedChart(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  buf: Buffer | null,
  afterRow: number,
) {
  if (!buf) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgId = workbook.addImage({ buffer: buf as any, extension: 'png' });
  sheet.addImage(imgId, {
    tl: { col: 0, row: afterRow },
    ext: { width: 880, height: 430 },
    editAs: 'oneCell',
  });
  for (let i = 0; i < 22; i++) sheet.addRow([]); // réserver la place
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

    // ── 1. LÉGENDE ────────────────────────────────────────────────────────────
    const shLeg = workbook.addWorksheet('Légende');
    shLeg.properties.tabColor = { argb: 'FF1F3864' };

    addTitle(shLeg, 'LÉGENDE — ÉTATS DES DISPOSITIFS', 3);
    styleHeader(shLeg.addRow(['Code', 'Libellé', 'Description']));
    for (const e of LEGENDE_ETATS) {
      const r = shLeg.addRow([e.code, e.label, e.description]);
      r.getCell(1).font = { bold: true, color: { argb: 'FF1F3864' } };
      r.fill = LEG_FILL; r.eachCell((c) => { c.border = ALL_BORDERS; });
    }
    shLeg.addRow([]);
    addTitle(shLeg, 'ESPÈCES D\'INSECTES (Fly Killers)', 3);
    styleHeader(shLeg.addRow(['Espèce', 'Libellé', 'Description']));
    for (const e of LEGENDE_INSECTES) {
      const r = shLeg.addRow([e.code, e.label, e.description]);
      r.getCell(1).font = { bold: true, color: { argb: 'FF1F3864' } };
      r.fill = LEG_FILL; r.eachCell((c) => { c.border = ALL_BORDERS; });
    }
    shLeg.addRow([]);
    addTitle(shLeg, 'TYPES DE DISPOSITIFS', 3);
    styleHeader(shLeg.addRow(['Code', 'Libellé', 'Description']));
    for (const e of LEGENDE_TYPES) {
      const r = shLeg.addRow([e.code, e.label, e.description]);
      r.getCell(1).font = { bold: true, color: { argb: 'FF1F3864' } };
      r.fill = LEG_FILL; r.eachCell((c) => { c.border = ALL_BORDERS; });
    }
    autosize(shLeg);

    // ── 2. FK — données brutes ────────────────────────────────────────────────
    const shFK = workbook.addWorksheet('FK');
    shFK.properties.tabColor = { argb: 'FF4472C4' };
    addTitle(shFK, 'Contrôle destructeurs d\'insectes', ESPECES.length + 6);
    styleHeader(shFK.addRow(['Opération / visite', 'Date', 'ZONE', 'Type', 'N°', ...ESPECES, 'Observation']));
    for (const r of fkRows) {
      const row = shFK.addRow([r.visite, r.date, r.zone, 'FK', r.num, ...ESPECES.map((e) => r.counts[e] > 0 ? r.counts[e] : 0), r.obs]);
      row.eachCell((c) => { c.border = ALL_BORDERS; c.alignment = { vertical: 'middle' }; });
    }
    if (fkRows.length === 0) shFK.addRow(['— Aucun destructeur d\'insectes sur cette période —']);
    autosize(shFK);

    // ── 3. FK — synthèse + graphique ─────────────────────────────────────────
    const shGFK = workbook.addWorksheet('Graph dynamique FK');
    shGFK.properties.tabColor = { argb: 'FF4472C4' };
    addTitle(shGFK, 'Synthèse par zone — Destructeurs d\'insectes', ESPECES.length + 2);

    const fkPRows: { zone: string; key: string; value: number }[] = [];
    for (const r of fkRows) for (const e of ESPECES) fkPRows.push({ zone: r.zone, key: e, value: r.counts[e] ?? 0 });
    const fkPivot     = pivotSum(fkPRows);
    const fkZones     = [...fkPivot.keys()].sort();
    const fkColTotals: Record<string, number> = {};
    let fkGrandTotal  = 0;

    styleHeader(shGFK.addRow(['Zone', ...ESPECES, 'Total']));
    for (const zone of fkZones) {
      const zm   = fkPivot.get(zone)!;
      const vals = ESPECES.map((e) => zm.get(e) ?? 0);
      const tot  = vals.reduce((a, b) => a + b, 0);
      const row  = shGFK.addRow([zone, ...vals, tot]);
      row.eachCell((c) => { c.border = ALL_BORDERS; c.alignment = { vertical: 'middle' }; });
      ESPECES.forEach((e, i) => { fkColTotals[e] = (fkColTotals[e] ?? 0) + vals[i]; });
      fkGrandTotal += tot;
    }
    if (fkZones.length === 0) shGFK.addRow(['— Aucune donnée FK —']);
    styleTotal(shGFK.addRow(['TOTAL', ...ESPECES.map((e) => fkColTotals[e] ?? 0), fkGrandTotal]));
    autosize(shGFK);

    const fkChart = await renderVerticalBarChart(
      fkZones,
      ESPECES.map((e) => ({ label: e, data: fkZones.map((z) => fkPivot.get(z)?.get(e) ?? 0) })),
      'Destructeurs d\'insectes — captures par zone',
    );
    await embedChart(workbook, shGFK, fkChart, shGFK.rowCount + 1);

    // ── 4. PIÈGES — données brutes ────────────────────────────────────────────
    const shPieges = workbook.addWorksheet('Pièges');
    shPieges.properties.tabColor = { argb: 'FFED7D31' };
    addTitle(shPieges, 'Contrôle des pièges', 7);
    styleHeader(shPieges.addRow(['Opération / visite', 'Date', 'ZONE', 'Type', 'N°', 'État', 'Observation']));
    for (const r of piegeRows) {
      const row = shPieges.addRow([r.visite, r.date, r.zone, r.typeLabel, r.num, r.etat, r.obs]);
      row.eachCell((c) => { c.border = ALL_BORDERS; c.alignment = { vertical: 'middle' }; });
    }
    if (piegeRows.length === 0) shPieges.addRow(['— Aucun piège sur cette période —']);
    autosize(shPieges);

    // ── 5. PIÈGES — synthèse + graphique ─────────────────────────────────────
    const piegeEtats = [...new Set(piegeRows.map((r) => r.etat).filter(Boolean))].sort();
    const shGPieges  = workbook.addWorksheet('Graph dynamique pièges');
    shGPieges.properties.tabColor = { argb: 'FFED7D31' };
    addTitle(shGPieges, 'Synthèse par zone — Pièges', piegeEtats.length + 2);

    const piegePivot   = pivotCount(piegeRows.filter((r) => r.etat).map((r) => ({ zone: r.zone, key: r.etat })));
    const piegeZones   = [...piegePivot.keys()].sort();
    const pColTotals: Record<string, number> = {};
    let pGrandTotal    = 0;

    styleHeader(shGPieges.addRow(['Zone', ...piegeEtats, 'Total']));
    for (const zone of piegeZones) {
      const zm   = piegePivot.get(zone)!;
      const vals = piegeEtats.map((e) => zm.get(e) ?? 0);
      const tot  = vals.reduce((a, b) => a + b, 0);
      const row  = shGPieges.addRow([zone, ...vals, tot]);
      row.eachCell((c) => { c.border = ALL_BORDERS; });
      piegeEtats.forEach((e, i) => { pColTotals[e] = (pColTotals[e] ?? 0) + vals[i]; });
      pGrandTotal += tot;
    }
    if (piegeZones.length === 0) shGPieges.addRow(['— Aucune donnée pièges —']);
    styleTotal(shGPieges.addRow(['TOTAL', ...piegeEtats.map((e) => pColTotals[e] ?? 0), pGrandTotal]));
    autosize(shGPieges);

    const piegeChart = await renderVerticalBarChart(
      piegeZones,
      piegeEtats.map((e) => ({ label: e, data: piegeZones.map((z) => piegePivot.get(z)?.get(e) ?? 0) })),
      'Pièges — états par zone',
    );
    await embedChart(workbook, shGPieges, piegeChart, shGPieges.rowCount + 1);

    // ── 6. BOITES — données brutes ────────────────────────────────────────────
    const shBoites = workbook.addWorksheet('Boites');
    shBoites.properties.tabColor = { argb: 'FF70AD47' };
    addTitle(shBoites, 'Contrôle des boîtes appât', 7);
    styleHeader(shBoites.addRow(['Opération / visite', 'Date', 'ZONE', 'Type', 'N°', 'État', 'Observation']));
    for (const r of boiteRows) {
      const row = shBoites.addRow([r.visite, r.date, r.zone, r.typeLabel, r.num, r.etat, r.obs]);
      row.eachCell((c) => { c.border = ALL_BORDERS; c.alignment = { vertical: 'middle' }; });
    }
    if (boiteRows.length === 0) shBoites.addRow(['— Aucune boîte sur cette période —']);
    autosize(shBoites);

    // ── 7. BOITES — synthèse + graphique ─────────────────────────────────────
    const boiteEtats = [...new Set(boiteRows.map((r) => r.etat).filter(Boolean))].sort();
    const shGBoite   = workbook.addWorksheet('Graph dynamique boite');
    shGBoite.properties.tabColor = { argb: 'FF70AD47' };
    addTitle(shGBoite, 'Synthèse par zone — Boîtes appât', boiteEtats.length + 2);

    const boitePivot   = pivotCount(boiteRows.filter((r) => r.etat).map((r) => ({ zone: r.zone, key: r.etat })));
    const boiteZones   = [...boitePivot.keys()].sort();
    const bColTotals: Record<string, number> = {};
    let bGrandTotal    = 0;

    styleHeader(shGBoite.addRow(['Zone', ...boiteEtats, 'Total']));
    for (const zone of boiteZones) {
      const zm   = boitePivot.get(zone)!;
      const vals = boiteEtats.map((e) => zm.get(e) ?? 0);
      const tot  = vals.reduce((a, b) => a + b, 0);
      const row  = shGBoite.addRow([zone, ...vals, tot]);
      row.eachCell((c) => { c.border = ALL_BORDERS; });
      boiteEtats.forEach((e, i) => { bColTotals[e] = (bColTotals[e] ?? 0) + vals[i]; });
      bGrandTotal += tot;
    }
    if (boiteZones.length === 0) shGBoite.addRow(['— Aucune donnée boîtes —']);
    styleTotal(shGBoite.addRow(['TOTAL', ...boiteEtats.map((e) => bColTotals[e] ?? 0), bGrandTotal]));
    autosize(shGBoite);

    const boiteChart = await renderVerticalBarChart(
      boiteZones,
      boiteEtats.map((e) => ({ label: e, data: boiteZones.map((z) => boitePivot.get(z)?.get(e) ?? 0) })),
      'Boîtes appât — états par zone',
    );
    await embedChart(workbook, shGBoite, boiteChart, shGBoite.rowCount + 1);

    // ── Sauvegarde ────────────────────────────────────────────────────────────
    const uploadDir    = path.join(process.cwd(), 'uploads', 'field-reports', siteId);
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
