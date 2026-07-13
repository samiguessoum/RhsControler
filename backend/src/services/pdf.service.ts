import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import logger from '../lib/logger.js';


const prisma = new PrismaClient();

// Types pour les documents
interface DocumentLigne {
  libelle: string;
  description?: string | null;
  quantite: number;
  unite?: string | null;
  prixUnitaireHT: number;
  tauxTVA: number;
  remisePct?: number | null;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

interface DocumentBase {
  ref: string;
  client: {
    nomEntreprise: string;
    code?: string | null;
    siegeNom?: string | null;
    siegeAdresse?: string | null;
    siegeVille?: string | null;
    siegePays?: string | null;
    siegeRC?: string | null;
    siegeNIF?: string | null;
    siegeAI?: string | null;
    siegeNIS?: string | null;
    siegeNIN?: string | null;
  };
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  remiseGlobalPct?: number | null;
  remiseGlobalMontant?: number | null;
  devise?: string | null;
  notes?: string | null;
  conditions?: string | null;
  lignes: DocumentLigne[];
}

interface DevisDocument extends DocumentBase {
  dateDevis: Date;
  dateValidite?: Date | null;
  statut: string;
  typeDocument?: string | null;
  site?: {
    nom: string;
    ville?: string | null;
    adresse?: string | null;
  } | null;
}

interface CommandeDocument extends DocumentBase {
  dateCommande: Date;
  dateLivraisonSouhaitee?: Date | null;
  refBonCommandeClient?: string | null;
  statut: string;
  typeDocument?: string | null;
  site?: {
    nom: string;
    ville?: string | null;
    adresse?: string | null;
  } | null;
}

interface FactureDocument extends DocumentBase {
  dateFacture: Date;
  dateEcheance?: Date | null;
  statut: string;
  totalPaye: number;
  type?: string | null;
  typeDocument?: string | null;
  refBonCommandeClient?: string | null;
  mentionSpeciale?: string | null;
  dateOperation?: Date | null;
  site?: {
    nom: string;
    ville?: string | null;
    adresse?: string | null;
  } | null;
}

interface FournisseurInfo {
  nomEntreprise: string;
  code?: string | null;
  siegeAdresse?: string | null;
  siegeVille?: string | null;
  siegePays?: string | null;
  siegeRC?: string | null;
  siegeNIF?: string | null;
  siegeAI?: string | null;
  siegeNIS?: string | null;
  siegeNIN?: string | null;
  siegeTel?: string | null;
  siegeEmail?: string | null;
}

interface FactureFournisseurDocument {
  ref: string;
  fournisseur: FournisseurInfo;
  refFournisseur?: string | null;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  remiseGlobalPct?: number | null;
  remiseGlobalMontant?: number | null;
  devise?: string | null;
  notes?: string | null;
  conditions?: string | null;
  lignes: DocumentLigne[];
  dateFacture: Date;
  dateEcheance?: Date | null;
  dateReception?: Date | null;
  statut: string;
  totalPaye: number;
}

interface CommandeFournisseurDocument extends DocumentBase {
  fournisseur: FournisseurInfo;
  dateCommande: Date;
  dateLivraisonSouhaitee?: Date | null;
  statut: string;
}

interface AttestationPassageDocument {
  ville: string;
  dateReferenceFr: string;
  operationsLabel: string;
  clientNom: string;
  clientDisplayName: string;
  prestataireNom: string;
  garantieMois: number;
  garantieMoisLabel: string;
  garantieJours: number;
  garantieJoursLabel: string;
  dateProchaineOperationFr: string;
  bodyText: string;
  title: string;
  showSignatures: boolean;
  showGuaranteeSection: boolean;
}

// Configuration de l'entreprise (fallback si pas en DB)
const COMPANY_INFO_DEFAULT = {
  name: process.env.PDF_COMPANY_NAME || 'Rayan Hygiene Services',
  address: process.env.PDF_COMPANY_ADDRESS || '',
  city: process.env.PDF_COMPANY_CITY || '',
  pays: process.env.PDF_COMPANY_PAYS || 'Algérie',
  phone: process.env.PDF_COMPANY_PHONE || '',
  email: process.env.PDF_COMPANY_EMAIL || '',
  website: process.env.PDF_COMPANY_WEBSITE || '',
  nif: process.env.PDF_COMPANY_NIF || '',
  nis: process.env.PDF_COMPANY_NIS || '',
  rc: process.env.PDF_COMPANY_RC || '',
  ai: process.env.PDF_COMPANY_AI || '',
  nin: process.env.PDF_COMPANY_NIN || '',
  rib: process.env.PDF_COMPANY_RIB || '',
  compte: process.env.PDF_COMPANY_COMPTE || '',
  banque: process.env.PDF_COMPANY_BANQUE || '',
  logoPath: process.env.PDF_COMPANY_LOGO_PATH || process.env.COMPANY_LOGO_PATH || '',
};

// Variable mutable pour stocker les infos entreprise (mise à jour depuis la DB)
let COMPANY_INFO = { ...COMPANY_INFO_DEFAULT };

// Fonction pour récupérer les paramètres de l'entreprise depuis la DB
export async function getCompanySettings() {
  try {
    const settings = await prisma.companySettings.findFirst();
    if (settings) {
      return {
        name: settings.nomEntreprise || COMPANY_INFO_DEFAULT.name,
        address: settings.adresse || COMPANY_INFO_DEFAULT.address,
        city: [settings.codePostal, settings.ville].filter(Boolean).join(' ') || COMPANY_INFO_DEFAULT.city,
        pays: settings.pays || COMPANY_INFO_DEFAULT.pays,
        phone: settings.telephone || COMPANY_INFO_DEFAULT.phone,
        email: settings.email || COMPANY_INFO_DEFAULT.email,
        website: settings.siteWeb || COMPANY_INFO_DEFAULT.website,
        nif: settings.nif || COMPANY_INFO_DEFAULT.nif,
        nis: settings.nis || COMPANY_INFO_DEFAULT.nis,
        rc: settings.rc || COMPANY_INFO_DEFAULT.rc,
        ai: settings.ai || COMPANY_INFO_DEFAULT.ai,
        nin: settings.nin || COMPANY_INFO_DEFAULT.nin,
        rib: settings.rib || COMPANY_INFO_DEFAULT.rib,
        compte: settings.compteBancaire || COMPANY_INFO_DEFAULT.compte,
        logoPath: settings.logoPath || COMPANY_INFO_DEFAULT.logoPath,
        banque: settings.banque || '',
      };
    }
    return COMPANY_INFO_DEFAULT;
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la récupération des paramètres entreprise');
    return COMPANY_INFO_DEFAULT;
  }
}

// Fonction pour mettre à jour COMPANY_INFO avec les données de la DB
export async function refreshCompanyInfo() {
  const settings = await getCompanySettings();
  COMPANY_INFO = { ...settings };
  return COMPANY_INFO;
}

// Couleurs
const COLORS = {
  primary: '#1e40af',
  secondary: '#64748b',
  border: '#e2e8f0',
  headerBg: '#f8fafc',
  text: '#1e293b',
  lightText: '#64748b',
};

function resolveAttestationLogoPath(): string | null {
  const candidates = [
    COMPANY_INFO.logoPath,
    path.resolve(process.cwd(), 'logo-RHS.png'),
    path.resolve(process.cwd(), '../logo-RHS.png'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function parseSimpleRichText(input: string): Array<{ text: string; bold: boolean; underline: boolean }> {
  const segments: Array<{ text: string; bold: boolean; underline: boolean }> = [];
  let bold = false;
  let underline = false;
  let buffer = '';

  const pushBuffer = () => {
    if (!buffer) return;
    segments.push({ text: buffer, bold, underline });
    buffer = '';
  };

  for (let i = 0; i < input.length; i += 1) {
    const next2 = input.slice(i, i + 2);
    if (next2 === '**') {
      pushBuffer();
      bold = !bold;
      i += 1;
      continue;
    }
    if (next2 === '__') {
      pushBuffer();
      underline = !underline;
      i += 1;
      continue;
    }
    buffer += input[i];
  }
  pushBuffer();
  return segments;
}

function drawRichParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  xStart: number,
  yStart: number,
  maxWidth: number,
  fontSize: number
): number {
  const segments = parseSimpleRichText(text);
  const styledWords: Array<{ text: string; bold: boolean; underline: boolean }> = [];

  for (const seg of segments) {
    const words = seg.text.split(/\s+/).filter(Boolean);
    for (const word of words) {
      styledWords.push({ text: word, bold: seg.bold, underline: seg.underline });
    }
  }

  let x = xStart;
  let y = yStart;
  const lineHeight = fontSize + 5;
  const maxX = xStart + maxWidth;

  for (let i = 0; i < styledWords.length; i += 1) {
    const part = styledWords[i];
    const token = i < styledWords.length - 1 ? `${part.text} ` : part.text;
    doc.font(part.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    const tokenWidth = doc.widthOfString(token);

    if (x + tokenWidth > maxX && x > xStart) {
      x = xStart;
      y += lineHeight;
    }

    doc.text(token, x, y, {
      lineBreak: false,
      underline: part.underline,
    });
    x += tokenWidth;
  }

  return y + lineHeight;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
}

function formatCurrency(amount: number, devise?: string | null): string {
  const currency = devise || 'DZD';
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  // Remplacer les espaces insécables (U+202F, U+00A0) par des espaces normaux pour PDFKit
  return formatted.replace(/[\u202F\u00A0]/g, ' ') + ' ' + currency;
}

// Format montant sans devise (pour devis où on indique déjà "Montants exprimés en Dinar Algérien")
function formatMontant(amount: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  // Remplacer les espaces insécables (U+202F, U+00A0) par des espaces normaux pour PDFKit
  return formatted.replace(/[\u202F\u00A0]/g, ' ');
}

function getStatusLabel(statut: string, type: 'devis' | 'commande' | 'facture' | 'commande_fournisseur' | 'facture_fournisseur'): string {
  const labels: Record<string, Record<string, string>> = {
    devis: {
      BROUILLON: 'Brouillon',
      VALIDE: 'Validé',
      SIGNE: 'Signé',
      REFUSE: 'Refusé',
      EXPIRE: 'Expiré',
      ANNULE: 'Annulé',
    },
    commande: {
      BROUILLON: 'Brouillon',
      VALIDEE: 'Validée',
      EN_PREPARATION: 'En préparation',
      EXPEDIEE: 'Expédiée',
      LIVREE: 'Livrée',
      ANNULEE: 'Annulée',
    },
    facture: {
      BROUILLON: 'Brouillon',
      VALIDEE: 'Validée',
      EN_RETARD: 'En retard',
      PARTIELLEMENT_PAYEE: 'Partiellement payée',
      PAYEE: 'Payée',
      ANNULEE: 'Annulée',
    },
    facture_fournisseur: {
      BROUILLON: 'Brouillon',
      VALIDEE: 'Validée',
      EN_RETARD: 'En retard',
      PARTIELLEMENT_PAYEE: 'Partiellement payée',
      PAYEE: 'Payée',
      ANNULEE: 'Annulée',
    },
    commande_fournisseur: {
      BROUILLON: 'Brouillon',
      ENVOYEE: 'Envoyée',
      CONFIRMEE: 'Confirmée',
      EN_RECEPTION: 'En réception',
      RECUE: 'Reçue',
      ANNULEE: 'Annulée',
    },
  };
  return labels[type]?.[statut] || statut;
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, ref: string, date: Date) {
  const pageWidth = doc.page.width;
  const margin = 50;

  // Logo / Nom entreprise
  doc.fontSize(20)
    .fillColor(COLORS.primary)
    .text(COMPANY_INFO.name, margin, 40, { width: 200 });

  doc.fontSize(9)
    .fillColor(COLORS.lightText)
    .text(COMPANY_INFO.address, margin, 65)
    .text(COMPANY_INFO.city, margin, 77)
    .text(`Tél: ${COMPANY_INFO.phone}`, margin, 89)
    .text(COMPANY_INFO.email, margin, 101);

  // Titre du document
  doc.fontSize(24)
    .fillColor(COLORS.text)
    .text(title, pageWidth - margin - 200, 40, { width: 200, align: 'right' });

  doc.fontSize(12)
    .fillColor(COLORS.primary)
    .text(ref, pageWidth - margin - 200, 70, { width: 200, align: 'right' });

  doc.fontSize(10)
    .fillColor(COLORS.lightText)
    .text(`Date: ${formatDate(date)}`, pageWidth - margin - 200, 90, { width: 200, align: 'right' });

  // Ligne de séparation
  doc.moveTo(margin, 130)
    .lineTo(pageWidth - margin, 130)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke();
}

function drawClientInfo(doc: PDFKit.PDFDocument, client: { nomEntreprise: string; code?: string | null }, label: string = 'Client') {
  const pageWidth = doc.page.width;
  const margin = 50;

  doc.fontSize(10)
    .fillColor(COLORS.lightText)
    .text(label, pageWidth - margin - 200, 145);

  doc.fontSize(12)
    .fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .text(client.nomEntreprise, pageWidth - margin - 200, 160);

  if (client.code) {
    doc.fontSize(9)
      .font('Helvetica')
      .fillColor(COLORS.lightText)
      .text(`Code: ${client.code}`, pageWidth - margin - 200, 177);
  }

  doc.font('Helvetica');
}

function drawDocumentInfo(doc: PDFKit.PDFDocument, infos: Array<{ label: string; value: string }>) {
  const margin = 50;
  let y = 145;

  infos.forEach((info) => {
    doc.fontSize(9)
      .fillColor(COLORS.lightText)
      .text(info.label + ':', margin, y);
    doc.fontSize(10)
      .fillColor(COLORS.text)
      .text(info.value, margin + 100, y);
    y += 15;
  });
}

function drawLinesTable(doc: PDFKit.PDFDocument, lignes: DocumentLigne[], devise?: string | null) {
  const margin = 50;
  const pageWidth = doc.page.width;
  const tableWidth = pageWidth - 2 * margin;

  // Colonnes
  const cols = {
    description: { x: margin, width: tableWidth * 0.35 },
    quantite: { x: margin + tableWidth * 0.35, width: tableWidth * 0.1 },
    prixUnit: { x: margin + tableWidth * 0.45, width: tableWidth * 0.15 },
    tva: { x: margin + tableWidth * 0.60, width: tableWidth * 0.1 },
    remise: { x: margin + tableWidth * 0.70, width: tableWidth * 0.1 },
    total: { x: margin + tableWidth * 0.80, width: tableWidth * 0.2 },
  };

  let y = 220;

  // "Montants exprimés en Dinar Algérien" au-dessus du tableau, aligné à droite
  doc.font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.lightText)
    .text('Montants exprimés en Dinar Algérien', margin, y, { width: tableWidth, align: 'right' });
  y += 14;

  // En-tête du tableau
  doc.rect(margin, y, tableWidth, 25)
    .fillColor(COLORS.headerBg)
    .fill();

  doc.fontSize(9)
    .fillColor(COLORS.text)
    .font('Helvetica-Bold');

  doc.text('Description', cols.description.x + 5, y + 8, { width: cols.description.width - 10 });
  doc.text('Qté', cols.quantite.x + 5, y + 8, { width: cols.quantite.width - 10, align: 'center' });
  doc.text('P.U. HT', cols.prixUnit.x + 5, y + 8, { width: cols.prixUnit.width - 10, align: 'right' });
  doc.text('TVA %', cols.tva.x + 5, y + 8, { width: cols.tva.width - 10, align: 'center' });
  doc.text('Rem. %', cols.remise.x + 5, y + 8, { width: cols.remise.width - 10, align: 'center' });
  doc.text('Total HT', cols.total.x + 5, y + 8, { width: cols.total.width - 10, align: 'right' });

  doc.font('Helvetica');
  y += 25;

  // Lignes
  lignes.forEach((ligne, index) => {
    const rowHeight = ligne.description ? 35 : 22;

    // Alternance de couleur
    if (index % 2 === 0) {
      doc.rect(margin, y, tableWidth, rowHeight)
        .fillColor('#fafafa')
        .fill();
    }

    doc.fillColor(COLORS.text)
      .fontSize(9);

    // Description
    doc.font('Helvetica-Bold')
      .text(ligne.libelle, cols.description.x + 5, y + 5, { width: cols.description.width - 10 });
    if (ligne.description) {
      doc.font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.lightText)
        .text(ligne.description, cols.description.x + 5, y + 18, { width: cols.description.width - 10 });
    }

    doc.font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.text);

    // Quantité
    const qteText = ligne.unite ? `${ligne.quantite} ${ligne.unite}` : String(ligne.quantite);
    doc.text(qteText, cols.quantite.x + 5, y + 5, { width: cols.quantite.width - 10, align: 'center' });

    // Prix unitaire
    doc.text(formatMontant(ligne.prixUnitaireHT), cols.prixUnit.x + 5, y + 5, { width: cols.prixUnit.width - 10, align: 'right' });

    // TVA
    doc.text(`${ligne.tauxTVA}%`, cols.tva.x + 5, y + 5, { width: cols.tva.width - 10, align: 'center' });

    // Remise
    doc.text(ligne.remisePct ? `${ligne.remisePct}%` : '-', cols.remise.x + 5, y + 5, { width: cols.remise.width - 10, align: 'center' });

    // Total HT — valeur numérique sans devise
    doc.text(formatMontant(ligne.totalHT), cols.total.x + 5, y + 5, { width: cols.total.width - 10, align: 'right' });

    // Ligne de séparation
    doc.moveTo(margin, y + rowHeight)
      .lineTo(pageWidth - margin, y + rowHeight)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    y += rowHeight;

    // Nouvelle page si nécessaire
    if (y > doc.page.height - 200) {
      doc.addPage();
      y = 50;
    }
  });

  return y;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  startY: number,
  totalHT: number,
  totalTVA: number,
  totalTTC: number,
  devise?: string | null,
  remiseGlobalPct?: number | null,
  remiseGlobalMontant?: number | null,
  totalPaye?: number
) {
  const pageWidth = doc.page.width;
  const margin = 50;
  const boxWidth = 200;
  const boxX = pageWidth - margin - boxWidth;
  let y = startY + 20;

  // Sous-total HT
  doc.fontSize(10)
    .fillColor(COLORS.lightText)
    .text('Sous-total HT:', boxX, y, { width: boxWidth - 70, align: 'right' });
  doc.fillColor(COLORS.text)
    .text(formatMontant(totalHT), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
  y += 18;

  // Remise globale
  if ((remiseGlobalPct && remiseGlobalPct > 0) || (remiseGlobalMontant && remiseGlobalMontant > 0)) {
    const remiseText = remiseGlobalPct ? `Remise (${remiseGlobalPct}%):` : 'Remise:';
    doc.fillColor(COLORS.lightText)
      .text(remiseText, boxX, y, { width: boxWidth - 70, align: 'right' });
    doc.fillColor('#dc2626')
      .text('-' + formatMontant(remiseGlobalMontant || (totalHT * (remiseGlobalPct || 0) / 100)), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
    y += 18;
  }

  // TVA
  doc.fillColor(COLORS.lightText)
    .text('TVA:', boxX, y, { width: boxWidth - 70, align: 'right' });
  doc.fillColor(COLORS.text)
    .text(formatMontant(totalTVA), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
  y += 18;

  // Ligne de séparation
  doc.moveTo(boxX, y)
    .lineTo(pageWidth - margin, y)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke();
  y += 10;

  // Total TTC
  doc.fontSize(12)
    .font('Helvetica-Bold')
    .fillColor(COLORS.primary)
    .text('Total TTC:', boxX, y, { width: boxWidth - 70, align: 'right' });
  doc.text(formatMontant(totalTTC), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
  y += 25;

  // Montant payé (pour factures)
  if (totalPaye !== undefined) {
    doc.fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.lightText)
      .text('Déjà payé:', boxX, y, { width: boxWidth - 70, align: 'right' });
    doc.fillColor('#16a34a')
      .text(formatMontant(totalPaye), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
    y += 18;

    const resteAPayer = totalTTC - totalPaye;
    doc.font('Helvetica-Bold')
      .fillColor(resteAPayer > 0 ? '#dc2626' : '#16a34a')
      .text('Reste à payer:', boxX, y, { width: boxWidth - 70, align: 'right' });
    doc.text(formatMontant(resteAPayer), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
  }

  doc.font('Helvetica');
  return y;
}

function drawFooter(doc: PDFKit.PDFDocument, notes?: string | null, conditions?: string | null) {
  const margin = 50;
  const pageHeight = doc.page.height;
  let y = pageHeight - 120;

  if (notes || conditions) {
    doc.moveTo(margin, y)
      .lineTo(doc.page.width - margin, y)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();
    y += 10;

    if (notes) {
      doc.fontSize(8)
        .fillColor(COLORS.lightText)
        .text('Notes:', margin, y);
      y += 12;
      doc.fillColor(COLORS.text)
        .text(notes, margin, y, { width: 250 });
    }

    if (conditions) {
      doc.fontSize(8)
        .fillColor(COLORS.lightText)
        .text('Conditions:', doc.page.width / 2, y - 12);
      doc.fillColor(COLORS.text)
        .text(conditions, doc.page.width / 2, y, { width: 250 });
    }
  }

  // Informations légales en bas
  doc.fontSize(7)
    .fillColor(COLORS.lightText)
    .text(`${COMPANY_INFO.nif} | ${COMPANY_INFO.nis} | ${COMPANY_INFO.rc}`, margin, pageHeight - 30, {
      width: doc.page.width - 2 * margin,
      align: 'center',
    });
}

function n(v: unknown): number {
  const num = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(num) ? num : 0;
}

function convertUnderHundredFr(num: number): string {
  const units = ['zero', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

  if (num < 10) return units[num];
  if (num < 20) return teens[num - 10];
  if (num < 70) {
    const t = Math.floor(num / 10);
    const u = num % 10;
    if (u === 0) return tens[t];
    if (u === 1) return `${tens[t]} et un`;
    return `${tens[t]}-${units[u]}`;
  }
  if (num < 80) {
    if (num === 71) return 'soixante et onze';
    return `soixante-${teens[num - 70]}`;
  }
  if (num === 80) return 'quatre-vingts';
  if (num < 90) return `quatre-vingt-${units[num - 80]}`;
  return `quatre-vingt-${teens[num - 90]}`;
}

function convertUnderThousandFr(num: number): string {
  if (num < 100) return convertUnderHundredFr(num);
  const hundreds = Math.floor(num / 100);
  const rest = num % 100;
  const hundredPart = hundreds === 1 ? 'cent' : `${convertUnderHundredFr(hundreds)} cent`;
  if (rest === 0) return hundreds > 1 ? `${hundredPart}s` : hundredPart;
  return `${hundredPart} ${convertUnderHundredFr(rest)}`;
}

function numberToWordsFr(num: number): string {
  if (num === 0) return 'zero';
  const millions = Math.floor(num / 1_000_000);
  const thousands = Math.floor((num % 1_000_000) / 1_000);
  const rest = num % 1_000;
  const parts: string[] = [];

  if (millions > 0) {
    parts.push(millions === 1 ? 'un million' : `${convertUnderThousandFr(millions)} millions`);
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${convertUnderThousandFr(thousands)} mille`);
  }
  if (rest > 0) {
    parts.push(convertUnderThousandFr(rest));
  }
  return parts.join(' ');
}

function amountToWordsDZD(amount: number): string {
  const value = Math.round(n(amount) * 100) / 100;
  const intPart = Math.floor(value);
  const cents = Math.round((value - intPart) * 100);
  const intText = numberToWordsFr(Math.abs(intPart));
  if (cents > 0) {
    return `${intText} dinars et ${numberToWordsFr(cents)} centimes`;
  }
  return `${intText} dinars`;
}

function drawInvoiceHeader(doc: PDFKit.PDFDocument, facture: FactureDocument, title: string): number {
  const pageWidth = doc.page.width;
  const margin = 28;
  const logoBoxWidth = 260;
  const rightBoxX = pageWidth - margin - 190;

  if (COMPANY_INFO.logoPath && fs.existsSync(COMPANY_INFO.logoPath)) {
    doc.image(COMPANY_INFO.logoPath, margin, 22, { fit: [logoBoxWidth, 58] });
  } else {
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#0f766e').text(COMPANY_INFO.name, margin, 30, { width: logoBoxWidth });
  }

  doc.font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#0b1b55')
    .text(`${title}`, rightBoxX, 28, { width: 190, align: 'right' });

  doc.font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#0b1b55')
    .text(facture.ref, rightBoxX, 50, { width: 190, align: 'right' });

  let dateY = 70;
  if (facture.typeDocument) {
    const typeLabel = facture.typeDocument === 'SERVICE' ? 'Prestation de service' : 'Vente de produits';
    doc.font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0b1b55')
      .text(`Type : ${typeLabel}`, rightBoxX, dateY, { width: 190, align: 'right' });
    dateY += 14;
  }

  doc.font('Helvetica')
    .fontSize(9)
    .fillColor('#111827')
    .text(`Date facturation : ${formatDate(facture.dateFacture)}`, rightBoxX, dateY, { width: 190, align: 'right' });

  dateY += 13;
  if (facture.dateEcheance) {
    doc.text(`Date echeance : ${formatDate(facture.dateEcheance)}`, rightBoxX, dateY, { width: 190, align: 'right' });
    dateY += 13;
  }

  return dateY;
}

// Affiche une liste de champs "Label : valeur" avec le label en gras et la valeur en police normale,
// pour une lecture plus rapide des identifiants légaux dans les rectangles Émetteur / Adressé à.
function drawLabeledFields(
  doc: PDFKit.PDFDocument,
  fields: Array<{ label: string; value?: string | null }>,
  x: number,
  startY: number,
  width: number,
  fontSize = 8,
  lineHeight = 11
): number {
  let curY = startY;
  for (const f of fields) {
    if (!f.value) continue;
    doc.font('Helvetica').fontSize(fontSize);
    const textHeight = doc.heightOfString(`${f.label} : ${f.value}`, { width, lineGap: 1 });
    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#111827')
      .text(`${f.label} : `, x, curY, { continued: true, width, lineGap: 1 });
    doc.font('Helvetica').fontSize(fontSize).fillColor('#111827')
      .text(f.value, { width, lineGap: 1 });
    curY += Math.max(lineHeight, textHeight + 2);
  }
  return curY;
}

function buildCompteLabel(): string {
  return COMPANY_INFO.banque ? `Compte ${COMPANY_INFO.banque}` : 'Compte';
}

function drawInvoiceParties(doc: PDFKit.PDFDocument, facture: FactureDocument, startY: number): number {
  const margin = 28;
  const y = Math.max(104, startY + 10);
  const leftW = 230;
  const rightW = doc.page.width - margin * 2 - leftW - 20;
  const rightX = margin + leftW + 20;
  const boxH = 165;

  doc.rect(margin, y, leftW, boxH).fillColor('#e5e7eb').fill();
  doc.rect(rightX, y, rightW, boxH).lineWidth(1).strokeColor('#6b7280').stroke();

  doc.font('Helvetica').fontSize(8).fillColor('#374151').text('Émetteur', margin + 8, y - 12);
  doc.font('Helvetica').fontSize(8).fillColor('#374151').text('Adressé à', rightX + 8, y - 12);

  doc.font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#0b1b55')
    .text(COMPANY_INFO.name, margin + 8, y + 10, { width: leftW - 16 });

  doc.font('Helvetica')
    .fontSize(8)
    .fillColor('#111827')
    .text([COMPANY_INFO.address, [COMPANY_INFO.city, COMPANY_INFO.pays].filter(Boolean).join(', ')].filter(Boolean).join('\n'), margin + 8, y + 25, { width: leftW - 16, lineGap: 1 });

  drawLabeledFields(doc, [
    { label: 'RC', value: COMPANY_INFO.rc },
    { label: 'NIF', value: COMPANY_INFO.nif },
    { label: 'AI', value: COMPANY_INFO.ai },
    { label: 'NIS', value: COMPANY_INFO.nis },
    { label: 'NIN', value: (COMPANY_INFO as any).nin },
    { label: buildCompteLabel(), value: COMPANY_INFO.compte },
    { label: 'RIB', value: COMPANY_INFO.rib },
  ], margin + 8, y + 53, leftW - 16);

  const client = facture.client;
  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text(client.nomEntreprise || '-', rightX + 8, y + 10, { width: rightW - 16 });

  doc.font('Helvetica')
    .fontSize(9)
    .fillColor('#111827')
    .text([client.siegeAdresse, client.siegeVille, client.siegePays].filter(Boolean).join(' - '), rightX + 8, y + 30, { width: rightW - 16, lineGap: 1 });

  drawLabeledFields(doc, [
    { label: 'RC', value: client.siegeRC },
    { label: 'NIF', value: client.siegeNIF },
    { label: 'AI', value: client.siegeAI },
    { label: 'NIS', value: client.siegeNIS },
    { label: 'NIN', value: client.siegeNIN },
  ], rightX + 8, y + 55, rightW - 16, 9, 13);

  return y + boxH + 16;
}

function drawInvoiceLinesTable(doc: PDFKit.PDFDocument, facture: FactureDocument, startY: number): number {
  const margin = 28;
  const tableW = doc.page.width - margin * 2;
  const cols = {
    designation: 285,
    tva: 40,
    pu: 70,
    qte: 40,
    total: 60,
  };

  const x = {
    designation: margin,
    tva: margin + cols.designation,
    pu: margin + cols.designation + cols.tva,
    qte: margin + cols.designation + cols.tva + cols.pu,
    total: margin + cols.designation + cols.tva + cols.pu + cols.qte,
  };

  let y = startY;

  // "Montants exprimés en Dinar Algérien" au-dessus du tableau, aligné à droite
  doc.font('Helvetica')
    .fontSize(8)
    .fillColor('#6b7280')
    .text('Montants exprimés en Dinar Algérien', margin, y, { width: tableW, align: 'right' });
  y += 14;

  doc.rect(margin, y, tableW, 22).fillColor('#e5e7eb').fill();
  doc.lineWidth(1).strokeColor('#6b7280').rect(margin, y, tableW, 22).stroke();
  doc.moveTo(x.tva, y).lineTo(x.tva, y + 22).stroke();
  doc.moveTo(x.pu, y).lineTo(x.pu, y + 22).stroke();
  doc.moveTo(x.qte, y).lineTo(x.qte, y + 22).stroke();
  doc.moveTo(x.total, y).lineTo(x.total, y + 22).stroke();

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
  doc.text('Designation', x.designation + 5, y + 7, { width: cols.designation - 10 });
  doc.text('TVA', x.tva + 5, y + 7, { width: cols.tva - 10, align: 'center' });
  doc.text('P.U HT', x.pu + 5, y + 7, { width: cols.pu - 10, align: 'center' });
  doc.text('Qte', x.qte + 5, y + 7, { width: cols.qte - 10, align: 'center' });
  doc.text('Total HT', x.total + 5, y + 7, { width: cols.total - 10, align: 'right' });

  y += 22;
  const minHeight = 230;
  const tableBodyStart = y;

  for (const ligne of facture.lignes) {
    doc.font('Helvetica-Bold').fontSize(9);
    const libelleHeight = doc.heightOfString(ligne.libelle, { width: cols.designation - 10, lineGap: 1 });
    let descHeight = 0;
    if (ligne.description) {
      doc.font('Helvetica').fontSize(8);
      descHeight = doc.heightOfString(ligne.description, { width: cols.designation - 10, lineGap: 1 });
    }
    const rowHeight = Math.max(28, libelleHeight + descHeight + 22);

    doc.rect(margin, y, tableW, rowHeight).lineWidth(0.8).strokeColor('#9ca3af').stroke();
    doc.moveTo(x.tva, y).lineTo(x.tva, y + rowHeight).stroke();
    doc.moveTo(x.pu, y).lineTo(x.pu, y + rowHeight).stroke();
    doc.moveTo(x.qte, y).lineTo(x.qte, y + rowHeight).stroke();
    doc.moveTo(x.total, y).lineTo(x.total, y + rowHeight).stroke();

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(ligne.libelle, x.designation + 5, y + 7, {
      width: cols.designation - 10,
    });
    if (ligne.description) {
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(ligne.description, x.designation + 5, y + 7 + libelleHeight + 2, {
        width: cols.designation - 10,
        lineGap: 1,
      });
    }

    doc.font('Helvetica').fontSize(9).fillColor('#111827');
    doc.text(`${n(ligne.tauxTVA)}%`, x.tva + 5, y + 7, { width: cols.tva - 10, align: 'center' });
    doc.text(formatMontant(n(ligne.prixUnitaireHT)), x.pu + 4, y + 7, { width: cols.pu - 8, align: 'right' });
    doc.text(String(n(ligne.quantite)), x.qte + 5, y + 7, { width: cols.qte - 10, align: 'center' });
    doc.text(formatMontant(n(ligne.totalHT)), x.total + 4, y + 7, { width: cols.total - 8, align: 'right' });

    y += rowHeight;
  }

  if (y < tableBodyStart + minHeight) {
    const remaining = tableBodyStart + minHeight - y;
    doc.rect(margin, y, tableW, remaining).lineWidth(0.8).strokeColor('#9ca3af').stroke();
    doc.moveTo(x.tva, y).lineTo(x.tva, y + remaining).stroke();
    doc.moveTo(x.pu, y).lineTo(x.pu, y + remaining).stroke();
    doc.moveTo(x.qte, y).lineTo(x.qte, y + remaining).stroke();
    doc.moveTo(x.total, y).lineTo(x.total, y + remaining).stroke();
    y += remaining;
  }

  return y;
}

function drawInvoiceTotals(doc: PDFKit.PDFDocument, facture: FactureDocument, y: number): number {
  const margin = 28;
  const rightW = 220;
  const x = doc.page.width - margin - rightW;
  let curY = y + 4;

  const rows = [
    { label: 'Total HT', value: formatMontant(n(facture.totalHT)), bold: false },
    { label: `Total TVA ${n(facture.totalHT) > 0 ? Math.round((n(facture.totalTVA) / n(facture.totalHT)) * 100) : 0}%`, value: formatMontant(n(facture.totalTVA)), bold: false },
    { label: 'Total TTC', value: formatMontant(n(facture.totalTTC)), bold: true },
  ];

  for (const row of rows) {
    doc.rect(x, curY, rightW, 16).fillColor(row.bold ? '#dbeafe' : '#e5e7eb').fill();
    doc.font(row.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor('#111827')
      .text(row.label, x + 6, curY + 4, { width: 120 });
    doc.text(row.value, x + 126, curY + 4, { width: rightW - 132, align: 'right' });
    curY += 16;
  }

  return curY;
}

function drawInvoiceFooter(doc: PDFKit.PDFDocument) {
  const margin = 28;
  const pageY = doc.page.height - 36;
  const legalLine = [
    COMPANY_INFO.name,
    COMPANY_INFO.phone ? `Tel : ${COMPANY_INFO.phone}` : '',
    COMPANY_INFO.email ? `Email : ${COMPANY_INFO.email}` : '',
    COMPANY_INFO.website ? `Web : ${COMPANY_INFO.website}` : '',
  ].filter(Boolean).join('  |  ');

  doc.moveTo(margin, pageY - 14).lineTo(doc.page.width - margin, pageY - 14).lineWidth(0.7).strokeColor('#d1d5db').stroke();
  doc.font('Helvetica').fontSize(7).fillColor('#374151').text(legalLine, margin, pageY - 8, {
    width: doc.page.width - margin * 2 - 50,
    align: 'center',
  });
  doc.text(`1/1`, doc.page.width - margin - 24, pageY - 8, { width: 24, align: 'right' });
}

// ============ Fonctions publiques ============

// ============ Nouveau template professionnel pour Devis ============

function drawDevisHeader(doc: PDFKit.PDFDocument, title: string, ref: string, date: Date, extraLine?: string, typeLabel?: string): number {
  const pageWidth = doc.page.width;
  const margin = 28;
  const logoBoxWidth = 260;
  const rightBoxX = pageWidth - margin - 190;

  // Logo - chercher le logo à la racine ou dans le chemin configuré
  const logoPath = resolveAttestationLogoPath();
  if (logoPath) {
    doc.image(logoPath, margin, 22, { fit: [logoBoxWidth, 58] });
  }

  // Titre et référence
  doc.font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#0b1b55')
    .text(title, rightBoxX, 28, { width: 190, align: 'right' });

  doc.font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#0b1b55')
    .text(`Réf. : ${ref}`, rightBoxX, 52, { width: 190, align: 'right' });

  let dateY = 70;
  if (typeLabel) {
    doc.font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0b1b55')
      .text(`Type : ${typeLabel}`, rightBoxX, dateY, { width: 190, align: 'right' });
    dateY += 14;
  }

  doc.font('Helvetica')
    .fontSize(9)
    .fillColor('#111827')
    .text(`Date : ${formatDate(date)}`, rightBoxX, dateY, { width: 190, align: 'right' });

  dateY += 13;
  if (extraLine) {
    doc.text(extraLine, rightBoxX, dateY, { width: 190, align: 'right' });
    dateY += 13;
  }

  return dateY;
}

function drawDevisParties(doc: PDFKit.PDFDocument, devis: DocumentBase, startY: number): number {
  const margin = 28;
  const y = Math.max(104, startY + 10);
  const leftW = 230;
  const rightW = doc.page.width - margin * 2 - leftW - 20;
  const rightX = margin + leftW + 20;
  const boxH = 165;

  // Box Émetteur (fond gris)
  doc.rect(margin, y, leftW, boxH).fillColor('#e5e7eb').fill();
  // Box Client (bordure)
  doc.rect(rightX, y, rightW, boxH).lineWidth(1).strokeColor('#6b7280').stroke();

  // Labels
  doc.font('Helvetica').fontSize(8).fillColor('#374151').text('Émetteur', margin + 8, y - 12);
  doc.font('Helvetica').fontSize(8).fillColor('#374151').text('Adressé à', rightX + 8, y - 12);

  // Infos émetteur
  doc.font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#0b1b55')
    .text(COMPANY_INFO.name, margin + 8, y + 10, { width: leftW - 16 });

  doc.font('Helvetica')
    .fontSize(8)
    .fillColor('#111827')
    .text([COMPANY_INFO.address, [COMPANY_INFO.city, COMPANY_INFO.pays].filter(Boolean).join(', ')].filter(Boolean).join('\n'), margin + 8, y + 25, { width: leftW - 16, lineGap: 1 });

  drawLabeledFields(doc, [
    { label: 'RC', value: COMPANY_INFO.rc },
    { label: 'NIF', value: COMPANY_INFO.nif },
    { label: 'AI', value: COMPANY_INFO.ai },
    { label: 'NIS', value: COMPANY_INFO.nis },
    { label: 'NIN', value: (COMPANY_INFO as any).nin },
    { label: buildCompteLabel(), value: COMPANY_INFO.compte },
    { label: 'RIB', value: COMPANY_INFO.rib },
  ], margin + 8, y + 53, leftW - 16);

  // Infos client
  const client = devis.client;
  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text(client.nomEntreprise || '-', rightX + 8, y + 10, { width: rightW - 16 });

  doc.font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#111827')
    .text([client.siegeAdresse, client.siegeVille, client.siegePays].filter(Boolean).join(' - '), rightX + 8, y + 30, { width: rightW - 16, lineGap: 1 });

  drawLabeledFields(doc, [
    { label: 'RC', value: client.siegeRC },
    { label: 'NIF', value: client.siegeNIF },
    { label: 'AI', value: client.siegeAI },
    { label: 'NIS', value: client.siegeNIS },
    { label: 'NIN', value: client.siegeNIN },
  ], rightX + 8, y + 55, rightW - 16, 9, 13);

  return y + boxH + 16;
}

function drawFournisseurParties(doc: PDFKit.PDFDocument, fournisseur: FournisseurInfo, startY: number): number {
  const margin = 28;
  const y = Math.max(104, startY + 10);
  const leftW = 230;
  const rightW = doc.page.width - margin * 2 - leftW - 20;
  const rightX = margin + leftW + 20;
  const boxH = 165;

  // Box Émetteur (fond gris)
  doc.rect(margin, y, leftW, boxH).fillColor('#e5e7eb').fill();
  // Box Fournisseur (bordure)
  doc.rect(rightX, y, rightW, boxH).lineWidth(1).strokeColor('#6b7280').stroke();

  // Labels
  doc.font('Helvetica').fontSize(8).fillColor('#374151').text('Émetteur', margin + 8, y - 12);
  doc.font('Helvetica').fontSize(8).fillColor('#374151').text('Fournisseur', rightX + 8, y - 12);

  // Infos émetteur (notre entreprise)
  doc.font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#0b1b55')
    .text(COMPANY_INFO.name, margin + 8, y + 10, { width: leftW - 16 });

  doc.font('Helvetica')
    .fontSize(8)
    .fillColor('#111827')
    .text([COMPANY_INFO.address, [COMPANY_INFO.city, COMPANY_INFO.pays].filter(Boolean).join(', ')].filter(Boolean).join('\n'), margin + 8, y + 25, { width: leftW - 16, lineGap: 1 });

  drawLabeledFields(doc, [
    { label: 'RC', value: COMPANY_INFO.rc },
    { label: 'NIF', value: COMPANY_INFO.nif },
    { label: 'AI', value: COMPANY_INFO.ai },
    { label: 'NIS', value: COMPANY_INFO.nis },
    { label: 'NIN', value: (COMPANY_INFO as any).nin },
    { label: buildCompteLabel(), value: COMPANY_INFO.compte },
    { label: 'RIB', value: COMPANY_INFO.rib },
  ], margin + 8, y + 53, leftW - 16);

  // Infos fournisseur
  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text(fournisseur.nomEntreprise || '-', rightX + 8, y + 10, { width: rightW - 16 });

  const adresseLine = [fournisseur.siegeAdresse, fournisseur.siegeVille, fournisseur.siegePays].filter(Boolean).join(' - ');
  if (adresseLine) {
    doc.font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#111827')
      .text(adresseLine, rightX + 8, y + 30, { width: rightW - 16, lineGap: 1 });
  }

  drawLabeledFields(doc, [
    { label: 'RC', value: fournisseur.siegeRC },
    { label: 'NIF', value: fournisseur.siegeNIF },
    { label: 'AI', value: fournisseur.siegeAI },
    { label: 'NIS', value: fournisseur.siegeNIS },
    { label: 'NIN', value: fournisseur.siegeNIN },
  ], rightX + 8, y + 55, rightW - 16, 9, 13);

  return y + boxH + 16;
}

function renderFournisseurDocumentPDF(opts: {
  title: string;
  ref: string;
  date: Date;
  extraHeaderLine?: string;
  fournisseur: FournisseurInfo;
  document: {
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    remiseGlobalPct?: number | null;
    remiseGlobalMontant?: number | null;
    notes?: string | null;
    conditions?: string | null;
    lignes: DocumentLigne[];
  };
  amountLeadText: string;
}): Promise<Buffer> {
  const { title, ref, date, extraHeaderLine, fournisseur, document, amountLeadText } = opts;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 28 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const headerEndY = drawDevisHeader(doc, title, ref, date, extraHeaderLine);
      const afterPartiesY = drawFournisseurParties(doc, fournisseur, headerEndY);
      const tableEndY = drawDevisLinesTable(doc, document.lignes, afterPartiesY);
      const totalsEndY = drawDevisTotals(doc, document as any, tableEndY);

      const amountWords = amountToWordsDZD(n(document.totalTTC));
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#111827')
        .text(amountLeadText, 28, totalsEndY + 12, { width: 480 });
      doc.font('Helvetica-Bold')
        .fontSize(9)
        .text(`${amountWords.charAt(0).toUpperCase() + amountWords.slice(1)} en toutes taxes comprises.`, 28, totalsEndY + 26, { width: 520 });

      let notesY = totalsEndY + 50;
      if (document.notes) {
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor('#374151')
          .text(`Notes : ${document.notes}`, 28, notesY, { width: 520 });
        notesY = doc.y + 10;
      }
      if (document.conditions) {
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor('#374151')
          .text(`Conditions : ${document.conditions}`, 28, notesY, { width: 520 });
      }

      drawDevisFooter(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function drawDevisLinesTable(doc: PDFKit.PDFDocument, lignes: DocumentLigne[], startY: number): number {
  const margin = 28;
  const tableW = doc.page.width - margin * 2;
  const cols = {
    designation: 280,
    tva: 35,
    pu: 75,
    qte: 40,
    total: 85,
  };

  const x = {
    designation: margin,
    tva: margin + cols.designation,
    pu: margin + cols.designation + cols.tva,
    qte: margin + cols.designation + cols.tva + cols.pu,
    total: margin + cols.designation + cols.tva + cols.pu + cols.qte,
  };

  let y = startY;

  // "Montants exprimés en Dinar Algérien" au-dessus du tableau, aligné à droite
  doc.font('Helvetica')
    .fontSize(8)
    .fillColor('#111827')
    .text('Montants exprimés en Dinar Algérien', margin, y, { width: tableW, align: 'right' });
  y += 14;

  // En-tête du tableau
  doc.rect(margin, y, tableW, 22).fillColor('#e5e7eb').fill();
  doc.lineWidth(1).strokeColor('#6b7280').rect(margin, y, tableW, 22).stroke();
  doc.moveTo(x.tva, y).lineTo(x.tva, y + 22).stroke();
  doc.moveTo(x.pu, y).lineTo(x.pu, y + 22).stroke();
  doc.moveTo(x.qte, y).lineTo(x.qte, y + 22).stroke();
  doc.moveTo(x.total, y).lineTo(x.total, y + 22).stroke();

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
  doc.text('Désignation', x.designation + 5, y + 7, { width: cols.designation - 10 });
  doc.text('TVA', x.tva + 5, y + 7, { width: cols.tva - 10, align: 'center' });
  doc.text('P.U. HT', x.pu + 5, y + 7, { width: cols.pu - 10, align: 'center' });
  doc.text('Qté', x.qte + 5, y + 7, { width: cols.qte - 10, align: 'center' });
  doc.text('Total HT', x.total + 5, y + 7, { width: cols.total - 10, align: 'right' });

  y += 22;
  const minHeight = 200;
  const tableBodyStart = y;

  // Lignes du tableau
  for (const ligne of lignes) {
    // Calculer la hauteur nécessaire pour le libellé (gras) et la description (petit/gris)
    doc.font('Helvetica-Bold').fontSize(9);
    const libelleHeight = doc.heightOfString(ligne.libelle, { width: cols.designation - 10 });
    let descHeight = 0;
    if (ligne.description) {
      doc.font('Helvetica').fontSize(8);
      descHeight = doc.heightOfString(ligne.description, { width: cols.designation - 10 });
    }
    const rowHeight = Math.max(24, libelleHeight + descHeight + 10);

    doc.rect(margin, y, tableW, rowHeight).lineWidth(0.8).strokeColor('#9ca3af').stroke();
    doc.moveTo(x.tva, y).lineTo(x.tva, y + rowHeight).stroke();
    doc.moveTo(x.pu, y).lineTo(x.pu, y + rowHeight).stroke();
    doc.moveTo(x.qte, y).lineTo(x.qte, y + rowHeight).stroke();
    doc.moveTo(x.total, y).lineTo(x.total, y + rowHeight).stroke();

    // Libellé en gras
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(ligne.libelle, x.designation + 5, y + 4, {
      width: cols.designation - 10,
    });
    // Description en plus petit et gris (si présente)
    if (ligne.description) {
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(ligne.description, x.designation + 5, y + 4 + libelleHeight + 2, {
        width: cols.designation - 10,
        lineGap: 1,
      });
    }

    doc.font('Helvetica').fontSize(9).fillColor('#111827');
    doc.text(`${n(ligne.tauxTVA)}%`, x.tva + 5, y + 4, { width: cols.tva - 10, align: 'center' });
    doc.text(formatMontant(n(ligne.prixUnitaireHT)), x.pu + 5, y + 4, { width: cols.pu - 10, align: 'right' });
    doc.text(String(n(ligne.quantite)), x.qte + 5, y + 4, { width: cols.qte - 10, align: 'center' });
    doc.text(formatMontant(n(ligne.totalHT)), x.total + 5, y + 4, { width: cols.total - 10, align: 'right' });

    y += rowHeight;

    // Nouvelle page si nécessaire
    if (y > doc.page.height - 180) {
      doc.addPage();
      y = 50;
    }
  }

  // Remplir l'espace minimum
  if (y < tableBodyStart + minHeight) {
    const remaining = tableBodyStart + minHeight - y;
    doc.rect(margin, y, tableW, remaining).lineWidth(0.8).strokeColor('#9ca3af').stroke();
    doc.moveTo(x.tva, y).lineTo(x.tva, y + remaining).stroke();
    doc.moveTo(x.pu, y).lineTo(x.pu, y + remaining).stroke();
    doc.moveTo(x.qte, y).lineTo(x.qte, y + remaining).stroke();
    doc.moveTo(x.total, y).lineTo(x.total, y + remaining).stroke();
    y += remaining;
  }

  return y;
}

function drawDevisTotals(doc: PDFKit.PDFDocument, document: DocumentBase, y: number): number {
  const margin = 28;
  const rightW = 220;
  const x = doc.page.width - margin - rightW;
  let curY = y + 4;

  // Calcul du taux TVA moyen pour affichage
  const tvaRate = n(document.totalHT) > 0 ? Math.round((n(document.totalTVA) / n(document.totalHT)) * 100) : 19;

  const rows = [
    { label: 'Total HT', value: formatMontant(n(document.totalHT)), bold: false },
    { label: `Total TVA ${tvaRate}%`, value: formatMontant(n(document.totalTVA)), bold: false },
    { label: 'Total TTC', value: formatMontant(n(document.totalTTC)), bold: true },
  ];

  for (const row of rows) {
    doc.rect(x, curY, rightW, 16).fillColor(row.bold ? '#dbeafe' : '#e5e7eb').fill();
    doc.font(row.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor('#111827')
      .text(row.label, x + 6, curY + 4, { width: 120 });
    doc.text(row.value, x + 126, curY + 4, { width: rightW - 132, align: 'right' });
    curY += 16;
  }

  return curY;
}

function drawDevisFooter(doc: PDFKit.PDFDocument) {
  const margin = 28;
  const pageY = doc.page.height - 36;
  const legalLine = [
    COMPANY_INFO.name,
    COMPANY_INFO.phone ? `Tél : ${COMPANY_INFO.phone}` : '',
    COMPANY_INFO.email ? `Email : ${COMPANY_INFO.email}` : '',
    COMPANY_INFO.website ? `Web : ${COMPANY_INFO.website}` : '',
  ].filter(Boolean).join('  |  ');

  doc.moveTo(margin, pageY - 14).lineTo(doc.page.width - margin, pageY - 14).lineWidth(0.7).strokeColor('#d1d5db').stroke();
  doc.font('Helvetica').fontSize(7).fillColor('#374151').text(legalLine, margin, pageY - 8, {
    width: doc.page.width - margin * 2 - 50,
    align: 'center',
  });
  doc.text('1/1', doc.page.width - margin - 24, pageY - 8, { width: 24, align: 'right' });
}

function renderStandardDocumentPDF(opts: {
  title: string;
  ref: string;
  date: Date;
  extraHeaderLine?: string;
  document: DocumentBase & { site?: DevisDocument['site']; typeDocument?: string | null; refBonCommandeClient?: string | null };
  amountLeadText: string;
}): Promise<Buffer> {
  const { title, ref, date, extraHeaderLine, document, amountLeadText } = opts;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 28 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // En-tête avec logo et référence
      const typeLabel = document.typeDocument ? (document.typeDocument === 'SERVICE' ? 'Prestation de service' : 'Vente de produits') : undefined;
      const headerEndY = drawDevisHeader(doc, title, ref, date, extraHeaderLine, typeLabel);

      // Blocs Émetteur / Client
      const afterPartiesY = drawDevisParties(doc, document, headerEndY);

      // Info sur le site si disponible
      let tableStartY = afterPartiesY;
      if (document.site) {
        doc.font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#111827')
          .text(`Site d'intervention : ${document.site.nom}${document.site.ville ? ` - ${document.site.ville}` : ''}`, 28, afterPartiesY);
        if (document.site.adresse) {
          doc.font('Helvetica')
            .fontSize(9)
            .text(document.site.adresse, 28, afterPartiesY + 14);
          tableStartY = afterPartiesY + 32;
        } else {
          tableStartY = afterPartiesY + 20;
        }
      }

      // Mention du bon de commande client
      if (document.refBonCommandeClient) {
        doc.font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#111827')
          .text(`Selon le bon de commande "${document.refBonCommandeClient}"`, 28, tableStartY);
        tableStartY += 18;
      }

      // Tableau des lignes
      const tableEndY = drawDevisLinesTable(doc, document.lignes, tableStartY);

      // Totaux
      const totalsEndY = drawDevisTotals(doc, document, tableEndY);

      // Montant en lettres
      const amountWords = amountToWordsDZD(n(document.totalTTC));
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#111827')
        .text(amountLeadText, 28, totalsEndY + 12, { width: 480 });
      doc.font('Helvetica-Bold')
        .fontSize(9)
        .text(`${amountWords.charAt(0).toUpperCase() + amountWords.slice(1)} en toutes taxes comprises.`, 28, totalsEndY + 26, { width: 520 });

      // Notes et conditions
      let notesY = totalsEndY + 50;
      if (document.notes) {
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor('#374151')
          .text(`Notes : ${document.notes}`, 28, notesY, { width: 520 });
        notesY = doc.y + 10;
      }

      if (document.conditions) {
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor('#374151')
          .text(`Conditions : ${document.conditions}`, 28, notesY, { width: 520 });
      }

      // Pied de page
      drawDevisFooter(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function generateDevisPDF(devis: DevisDocument): Promise<Buffer> {
  // Rafraîchir les infos entreprise depuis la DB
  await refreshCompanyInfo();

  return renderStandardDocumentPDF({
    title: 'Devis',
    ref: devis.ref,
    date: devis.dateDevis,
    extraHeaderLine: devis.dateValidite ? `Date de fin de validité : ${formatDate(devis.dateValidite)}` : undefined,
    document: devis,
    amountLeadText: 'Arrêté le présent devis à la somme de :',
  });
}

export async function generateCommandePDF(commande: CommandeDocument): Promise<Buffer> {
  // Rafraîchir les infos entreprise depuis la DB
  await refreshCompanyInfo();

  return renderStandardDocumentPDF({
    title: 'Bon de commande',
    ref: commande.ref,
    date: commande.dateCommande,
    extraHeaderLine: commande.dateLivraisonSouhaitee ? `Livraison souhaitée : ${formatDate(commande.dateLivraisonSouhaitee)}` : undefined,
    document: commande,
    amountLeadText: 'Arrêté le présent bon de commande à la somme de :',
  });
}

export async function generateFacturePDF(facture: FactureDocument): Promise<Buffer> {
  // Rafraîchir les infos entreprise depuis la DB
  await refreshCompanyInfo();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 28 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const title = facture.type === 'AVOIR' ? 'AVOIR' : 'FACTURE';
      const headerEndY = drawInvoiceHeader(doc, facture, title);
      const afterPartiesY = drawInvoiceParties(doc, facture, headerEndY);

      if (facture.site) {
        doc.font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#111827')
          .text(`Site : ${facture.site.nom}${facture.site.ville ? ` — ${facture.site.ville}` : ''}`, 28, afterPartiesY, { width: 420 });
      }
      let mentionY = afterPartiesY + (facture.site ? 16 : 0);
      if (facture.mentionSpeciale) {
        doc.font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#111827')
          .text(facture.mentionSpeciale, 28, mentionY, { width: 420 });
        mentionY += 14;
      }

      // Date de l'opération : utilise la date réelle de l'opération (renseignée depuis le Planning)
      // si disponible, sinon tente de l'extraire de la description de la 1ère ligne, sinon la date de facture.
      let dateOperationStr: string;
      if (facture.dateOperation) {
        dateOperationStr = formatDate(facture.dateOperation);
      } else {
        const firstLigneDesc = facture.lignes?.[0]?.description ?? '';
        const dateMatch = firstLigneDesc.match(/(\d{2}\/\d{2}\/\d{4})/);
        dateOperationStr = dateMatch ? dateMatch[1] : formatDate(facture.dateFacture);
      }

      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111827')
        .text(`Opération du ${dateOperationStr}`, 28, mentionY, { width: 420 });
      mentionY += 16;

      let factureTableStartY = mentionY + 6;
      if (facture.refBonCommandeClient) {
        doc.font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#111827')
          .text(`Selon le bon de commande "${facture.refBonCommandeClient}"`, 28, factureTableStartY, { width: 420 });
        factureTableStartY += 16;
      }

      const tableEndY = drawInvoiceLinesTable(doc, facture, factureTableStartY);
      const totalsEndY = drawInvoiceTotals(doc, facture, tableEndY);

      const amountWords = amountToWordsDZD(n(facture.totalTTC));
      doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#111827')
        .text('Arretee la presente facture a la somme de :', 28, totalsEndY + 12, { width: 480 });
      doc.font('Helvetica-Bold')
        .fontSize(9)
        .text(`${amountWords} en toutes taxes comprises.`, 28, totalsEndY + 26, { width: 520 });

      if (facture.notes) {
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor('#374151')
          .text(`Notes: ${facture.notes}`, 28, totalsEndY + 46, { width: 520 });
      }

      drawInvoiceFooter(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function generateCommandeFournisseurPDF(commande: CommandeFournisseurDocument): Promise<Buffer> {
  await refreshCompanyInfo();

  const extraLine = commande.dateLivraisonSouhaitee
    ? `Livraison souhaitée : ${formatDate(commande.dateLivraisonSouhaitee)}`
    : undefined;

  return renderFournisseurDocumentPDF({
    title: 'Commande Fournisseur',
    ref: commande.ref,
    date: commande.dateCommande,
    extraHeaderLine: extraLine,
    fournisseur: commande.fournisseur,
    document: commande,
    amountLeadText: 'Arrêté la présente commande fournisseur à la somme de :',
  });
}

export async function generateFactureFournisseurPDF(facture: FactureFournisseurDocument): Promise<Buffer> {
  await refreshCompanyInfo();

  const extraLines: string[] = [];
  if (facture.refFournisseur) extraLines.push(`Réf. fournisseur : ${facture.refFournisseur}`);
  if (facture.dateEcheance) extraLines.push(`Échéance : ${formatDate(facture.dateEcheance)}`);

  return renderFournisseurDocumentPDF({
    title: 'Facture Fournisseur',
    ref: facture.ref,
    date: facture.dateFacture,
    extraHeaderLine: extraLines.join('  |  ') || undefined,
    fournisseur: facture.fournisseur,
    document: facture,
    amountLeadText: 'Arrêtée la présente facture fournisseur à la somme de :',
  });
}

export async function generateAttestationPassagePDF(attestation: AttestationPassageDocument): Promise<Buffer> {
  // Rafraîchir les infos entreprise depuis la DB
  await refreshCompanyInfo();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      const margin = 36;
      const contentWidth = doc.page.width - margin * 2;

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = 24;
      const logoPath = resolveAttestationLogoPath();
      if (logoPath) {
        try {
          doc.image(logoPath, margin, y, { fit: [contentWidth, 120], align: 'center' });
          y += 120 + 14;
        } catch {
          doc.font('Helvetica-Bold')
            .fontSize(24)
            .fillColor('#0b1b55')
            .text(attestation.prestataireNom, margin, y, { width: contentWidth, align: 'center' });
          y += 44;
        }
      } else {
        doc.font('Helvetica-Bold')
          .fontSize(24)
          .fillColor('#0b1b55')
          .text(attestation.prestataireNom, margin, y, { width: contentWidth, align: 'center' });
        y += 44;
      }

      doc.font('Helvetica')
        .fontSize(12)
        .fillColor('#111827')
        .text(`${attestation.ville}, le ${attestation.dateReferenceFr}`, margin, y, {
          width: contentWidth,
          align: 'right',
        });
      y += 48;

      doc.font('Helvetica-Bold')
        .fontSize(20)
        .fillColor('#111827')
        .text(attestation.title || 'ATTESTATION DE PASSAGE', margin, y, {
          width: contentWidth,
          align: 'center',
        });
      y += 44;

      doc.fontSize(13).fillColor('#111827');

      const body = attestation.bodyText?.trim() || '';
      if (!body) {
        doc.font('Helvetica').text('-', margin, y, { width: contentWidth, align: 'left', lineGap: 3 });
      } else {
        const lines = body.split('\n');
        for (const line of lines) {
          if (!line.trim()) {
            y += 14;
            continue;
          }
          y = drawRichParagraph(doc, line, margin, y, contentWidth, 13);
        }
      }
      y += 12;

      if (attestation.showGuaranteeSection) {
        doc.text(
          `Les opérations citées ci-dessus sont garanties pour une période de ${attestation.garantieJoursLabel} jours à compter de la date d’exécution des opérations.`,
          margin,
          y,
          { width: contentWidth, align: 'justify', lineGap: 3 }
        );
        y = doc.y + 20;

        doc.text(
          `La prochaine opération est recommandée pour le ${attestation.dateProchaineOperationFr}.`,
          margin,
          y,
          { width: contentWidth, align: 'justify' }
        );
      }

      if (attestation.showSignatures) {
        const signatureTopGap = 36;
        let signatureY = doc.y + signatureTopGap;
        const signatureBlockHeight = 40;
        const maxSignatureY = doc.page.height - 80 - signatureBlockHeight;

        // Keep signatures visually close to text while avoiding overflow at page bottom.
        if (signatureY > maxSignatureY) {
          doc.addPage();
          signatureY = 90;
        }

        const gap = 28;
        const signWidth = (contentWidth - gap) / 2;

        doc.font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#111827')
          .text(attestation.prestataireNom, margin, signatureY, { width: signWidth, align: 'left' })
          .text(attestation.clientDisplayName, margin + signWidth + gap, signatureY, { width: signWidth, align: 'right' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ── Bon de Livraison PDF ──────────────────────────────────────────────────────

interface BonLivraisonClientDoc {
  nomEntreprise: string;
  code?: string | null;
  siegeAdresse?: string | null;
  siegeVille?: string | null;
  siegePays?: string | null;
  siegeRC?: string | null;
  siegeNIF?: string | null;
  siegeAI?: string | null;
  siegeNIS?: string | null;
  siegeNIN?: string | null;
}

interface BonLivraisonLigneDoc {
  libelle: string;
  description?: string | null;
  quantiteCommandee?: number;
  quantiteLivree: number;
  unite?: string | null;
  prixUnitaireHT: number;
  tauxTVA: number;
}

interface BonLivraisonDoc {
  ref: string;
  client: BonLivraisonClientDoc;
  commande?: { ref: string; refBonCommandeClient?: string | null; typeDocument?: string | null } | null;
  site?: { nom: string; ville?: string | null; adresse?: string | null } | null;
  dateBonLivraison: Date;
  dateLivraisonEffective?: Date | null;
  statut: string;
  notes?: string | null;
  lignes: BonLivraisonLigneDoc[];
  adresseLivraison?: { adresse?: string; ville?: string; codePostal?: string } | null;
}

function getStatutBLLabel(statut: string): string {
  const labels: Record<string, string> = {
    BROUILLON: 'Brouillon',
    CONFIRME: 'Confirmé',
    LIVRE: 'Livré',
    ANNULE: 'Annulé',
  };
  return labels[statut] || statut;
}

export async function generateBonLivraisonPDF(bl: BonLivraisonDoc): Promise<Buffer> {
  await refreshCompanyInfo();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 28 });
      const chunks: Buffer[] = [];
      const margin = 28;
      const pageW = doc.page.width;
      const tableW = pageW - margin * 2;

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── En-tête ──────────────────────────────────────────────────────────────
      const logoPath = resolveAttestationLogoPath();
      const logoBoxW = 260;
      const rightBoxX = pageW - margin - 190;

      if (logoPath) {
        doc.image(logoPath, margin, 22, { fit: [logoBoxW, 58] });
      } else {
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#0b1b55')
          .text(COMPANY_INFO.name, margin, 30, { width: logoBoxW });
      }

      doc.font('Helvetica-Bold').fontSize(18).fillColor('#0b1b55')
        .text('BON DE LIVRAISON', rightBoxX, 28, { width: 190, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#374151')
        .text(`Réf. : ${bl.ref}`, rightBoxX, 54, { width: 190, align: 'right' });

      let blHeaderY = 74;
      if (bl.commande?.typeDocument) {
        const typeLabel = bl.commande.typeDocument === 'SERVICE' ? 'Prestation de service' : 'Vente de produits';
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0b1b55')
          .text(`Type : ${typeLabel}`, rightBoxX, blHeaderY, { width: 190, align: 'right' });
        blHeaderY += 14;
      }

      doc.font('Helvetica').fontSize(9).fillColor('#111827')
        .text(`Date BL : ${formatDate(bl.dateBonLivraison)}`, rightBoxX, blHeaderY, { width: 190, align: 'right' });
      blHeaderY += 13;

      if (bl.commande) {
        doc.text(`Commande : ${bl.commande.ref}`, rightBoxX, blHeaderY, { width: 190, align: 'right' });
        blHeaderY += 13;
      }
      if (bl.dateLivraisonEffective) {
        doc.text(`Livraison : ${formatDate(bl.dateLivraisonEffective)}`, rightBoxX, blHeaderY, { width: 190, align: 'right' });
        blHeaderY += 13;
      }

      // ── Blocs Émetteur / Client ──────────────────────────────────────────────
      const y = Math.max(118, blHeaderY + 16);
      const leftW = 230;
      const rightW = tableW - leftW - 20;
      const rightX = margin + leftW + 20;
      const boxH = 165;

      doc.rect(margin, y, leftW, boxH).fillColor('#e5e7eb').fill();
      doc.rect(rightX, y, rightW, boxH).lineWidth(1).strokeColor('#6b7280').stroke();

      doc.font('Helvetica').fontSize(8).fillColor('#374151')
        .text('Émetteur', margin + 8, y - 12)
        .text('Adressé à', rightX + 8, y - 12);

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0b1b55')
        .text(COMPANY_INFO.name, margin + 8, y + 10, { width: leftW - 16 });
      doc.font('Helvetica').fontSize(8).fillColor('#111827')
        .text([COMPANY_INFO.address, [COMPANY_INFO.city, COMPANY_INFO.pays].filter(Boolean).join(', ')].filter(Boolean).join('\n'), margin + 8, y + 25, { width: leftW - 16, lineGap: 1 });

      drawLabeledFields(doc, [
        { label: 'RC', value: COMPANY_INFO.rc },
        { label: 'NIF', value: COMPANY_INFO.nif },
        { label: 'AI', value: COMPANY_INFO.ai },
        { label: 'NIS', value: COMPANY_INFO.nis },
        { label: 'NIN', value: (COMPANY_INFO as any).nin },
        { label: buildCompteLabel(), value: COMPANY_INFO.compte },
        { label: 'RIB', value: COMPANY_INFO.rib },
      ], margin + 8, y + 53, leftW - 16);

      const client = bl.client;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827')
        .text(client.nomEntreprise || '-', rightX + 8, y + 10, { width: rightW - 16 });
      doc.font('Helvetica').fontSize(9).fillColor('#111827')
        .text([client.siegeAdresse, client.siegeVille, client.siegePays].filter(Boolean).join(' - '), rightX + 8, y + 30, { width: rightW - 16, lineGap: 1 });

      drawLabeledFields(doc, [
        { label: 'RC', value: client.siegeRC },
        { label: 'NIF', value: client.siegeNIF },
        { label: 'AI', value: client.siegeAI },
        { label: 'NIS', value: client.siegeNIS },
        { label: 'NIN', value: client.siegeNIN },
      ], rightX + 8, y + 55, rightW - 16, 9, 13);

      let afterPartiesY = y + boxH + 8;

      // ── Site / Adresse de livraison ──────────────────────────────────────────
      if (bl.site || bl.adresseLivraison) {
        const infoLigne = bl.site
          ? `Site : ${bl.site.nom}${bl.site.ville ? ` — ${bl.site.ville}` : ''}${bl.site.adresse ? `, ${bl.site.adresse}` : ''}`
          : `Adresse de livraison : ${[bl.adresseLivraison?.adresse, bl.adresseLivraison?.codePostal, bl.adresseLivraison?.ville].filter(Boolean).join(', ')}`;
        doc.font('Helvetica').fontSize(9).fillColor('#374151')
          .text(infoLigne, margin, afterPartiesY, { width: tableW });
        afterPartiesY = doc.y + 6;
      }

      if (bl.commande?.refBonCommandeClient) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827')
          .text(`Selon le bon de commande "${bl.commande.refBonCommandeClient}"`, margin, afterPartiesY, { width: tableW });
        afterPartiesY = doc.y + 6;
      }

      // ── Tableau des lignes ───────────────────────────────────────────────────
      // Colonnes : Désignation | Qté commandée | Qté ce BL | Restant | Unité
      const cols = { designation: 270, qteCmd: 65, qteLiv: 65, qteRest: 65, unite: tableW - 270 - 65 - 65 - 65 };
      const xCols = {
        designation: margin,
        qteCmd: margin + cols.designation,
        qteLiv: margin + cols.designation + cols.qteCmd,
        qteRest: margin + cols.designation + cols.qteCmd + cols.qteLiv,
        unite: margin + cols.designation + cols.qteCmd + cols.qteLiv + cols.qteRest,
      };

      let tableY = afterPartiesY + 10;

      doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
        .text('Quantités exprimées en unités contractuelles', margin, tableY, { width: tableW, align: 'right' });
      tableY += 14;

      // En-tête tableau
      doc.rect(margin, tableY, tableW, 22).fillColor('#e5e7eb').fill();
      doc.lineWidth(1).strokeColor('#6b7280').rect(margin, tableY, tableW, 22).stroke();
      doc.moveTo(xCols.qteCmd, tableY).lineTo(xCols.qteCmd, tableY + 22).stroke();
      doc.moveTo(xCols.qteLiv, tableY).lineTo(xCols.qteLiv, tableY + 22).stroke();
      doc.moveTo(xCols.qteRest, tableY).lineTo(xCols.qteRest, tableY + 22).stroke();
      doc.moveTo(xCols.unite, tableY).lineTo(xCols.unite, tableY + 22).stroke();

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
      doc.text('Désignation', xCols.designation + 5, tableY + 7, { width: cols.designation - 10 });
      doc.text('Qté cmd.', xCols.qteCmd + 5, tableY + 7, { width: cols.qteCmd - 10, align: 'center' });
      doc.text('Qté livrée', xCols.qteLiv + 5, tableY + 7, { width: cols.qteLiv - 10, align: 'center' });
      doc.text('Restant', xCols.qteRest + 5, tableY + 7, { width: cols.qteRest - 10, align: 'center' });
      doc.text('Unité', xCols.unite + 5, tableY + 7, { width: cols.unite - 10, align: 'center' });

      tableY += 22;
      const minTableH = 180;
      const tableBodyStart = tableY;

      for (const ligne of bl.lignes) {
        doc.font('Helvetica-Bold').fontSize(9);
        const libelleH = doc.heightOfString(ligne.libelle, { width: cols.designation - 10, lineGap: 1 });
        let descH = 0;
        if (ligne.description) {
          doc.font('Helvetica').fontSize(8);
          descH = doc.heightOfString(ligne.description, { width: cols.designation - 10, lineGap: 1 });
        }
        const rowH = Math.max(28, libelleH + descH + 16);

        doc.rect(margin, tableY, tableW, rowH).lineWidth(0.8).strokeColor('#9ca3af').stroke();
        doc.moveTo(xCols.qteCmd, tableY).lineTo(xCols.qteCmd, tableY + rowH).stroke();
        doc.moveTo(xCols.qteLiv, tableY).lineTo(xCols.qteLiv, tableY + rowH).stroke();
        doc.moveTo(xCols.qteRest, tableY).lineTo(xCols.qteRest, tableY + rowH).stroke();
        doc.moveTo(xCols.unite, tableY).lineTo(xCols.unite, tableY + rowH).stroke();

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827')
          .text(ligne.libelle, xCols.designation + 5, tableY + 7, { width: cols.designation - 10 });
        if (ligne.description) {
          doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
            .text(ligne.description, xCols.designation + 5, tableY + 7 + libelleH + 2, { width: cols.designation - 10 });
        }

        const qteCmd = ligne.quantiteCommandee ?? ligne.quantiteLivree;
        const qteRestante = Math.max(0, qteCmd - n(ligne.quantiteLivree));

        doc.font('Helvetica').fontSize(9).fillColor('#111827');
        doc.text(qteCmd != null ? String(n(qteCmd)) : '—', xCols.qteCmd + 5, tableY + 7, { width: cols.qteCmd - 10, align: 'center' });
        doc.font('Helvetica-Bold').fillColor('#0b1b55')
          .text(String(n(ligne.quantiteLivree)), xCols.qteLiv + 5, tableY + 7, { width: cols.qteLiv - 10, align: 'center' });
        doc.font('Helvetica').fillColor(qteRestante === 0 ? '#16a34a' : '#6b7280')
          .text(String(qteRestante), xCols.qteRest + 5, tableY + 7, { width: cols.qteRest - 10, align: 'center' });
        doc.fillColor('#111827')
          .text(ligne.unite || '—', xCols.unite + 5, tableY + 7, { width: cols.unite - 10, align: 'center' });

        tableY += rowH;

        if (tableY > doc.page.height - 160) {
          doc.addPage();
          tableY = 50;
        }
      }

      // Remplir hauteur minimale
      if (tableY < tableBodyStart + minTableH) {
        const remaining = tableBodyStart + minTableH - tableY;
        doc.rect(margin, tableY, tableW, remaining).lineWidth(0.8).strokeColor('#9ca3af').stroke();
        doc.moveTo(xCols.qteCmd, tableY).lineTo(xCols.qteCmd, tableY + remaining).stroke();
        doc.moveTo(xCols.qteLiv, tableY).lineTo(xCols.qteLiv, tableY + remaining).stroke();
        doc.moveTo(xCols.qteRest, tableY).lineTo(xCols.qteRest, tableY + remaining).stroke();
        doc.moveTo(xCols.unite, tableY).lineTo(xCols.unite, tableY + remaining).stroke();
        tableY += remaining;
      }

      // ── Notes ────────────────────────────────────────────────────────────────
      if (bl.notes) {
        tableY += 10;
        doc.font('Helvetica').fontSize(8).fillColor('#374151')
          .text(`Notes : ${bl.notes}`, margin, tableY, { width: tableW });
        tableY = doc.y + 12;
      } else {
        tableY += 16;
      }

      // ── Zones de signature ───────────────────────────────────────────────────
      const signH = 70;
      const signGap = 20;
      const signW = (tableW - signGap) / 2;
      const maxSignY = doc.page.height - signH - 50;

      if (tableY + signH > maxSignY) {
        doc.addPage();
        tableY = 50;
      }

      const signY = Math.min(tableY + 10, maxSignY);

      // Boîte Émetteur
      doc.rect(margin, signY, signW, signH).lineWidth(0.8).strokeColor('#9ca3af').stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
        .text('Signature Émetteur', margin + 8, signY + 6, { width: signW - 16 });
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
        .text(COMPANY_INFO.name, margin + 8, signY + 20, { width: signW - 16 });
      doc.text('Date : _______________', margin + 8, signY + signH - 18, { width: signW - 16 });

      // Boîte Récepteur
      const signRX = margin + signW + signGap;
      doc.rect(signRX, signY, signW, signH).lineWidth(0.8).strokeColor('#9ca3af').stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
        .text('Signature Récepteur', signRX + 8, signY + 6, { width: signW - 16 });
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
        .text(bl.client.nomEntreprise, signRX + 8, signY + 20, { width: signW - 16 });
      doc.text('Date : _______________', signRX + 8, signY + signH - 18, { width: signW - 16 });

      // ── Pied de page ─────────────────────────────────────────────────────────
      const pageY = doc.page.height - 36;
      const legalLine = [
        COMPANY_INFO.name,
        COMPANY_INFO.phone ? `Tél : ${COMPANY_INFO.phone}` : '',
        COMPANY_INFO.email ? `Email : ${COMPANY_INFO.email}` : '',
      ].filter(Boolean).join('  |  ');

      doc.moveTo(margin, pageY - 14).lineTo(pageW - margin, pageY - 14).lineWidth(0.7).strokeColor('#d1d5db').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#374151')
        .text(legalLine, margin, pageY - 8, { width: pageW - margin * 2 - 50, align: 'center' });
      doc.text('1/1', pageW - margin - 24, pageY - 8, { width: 24, align: 'right' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
