import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import fs from 'node:fs';

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
}

interface CommandeDocument extends DocumentBase {
  dateCommande: Date;
  dateLivraisonSouhaitee?: Date | null;
  statut: string;
}

interface FactureDocument extends DocumentBase {
  dateFacture: Date;
  dateEcheance?: Date | null;
  statut: string;
  totalPaye: number;
  type?: string | null;
}

interface FactureFournisseurDocument {
  ref: string;
  fournisseur: {
    nomEntreprise: string;
    code?: string | null;
  };
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
  fournisseur: {
    nomEntreprise: string;
    code?: string | null;
  };
  dateCommande: Date;
  dateLivraisonSouhaitee?: Date | null;
  statut: string;
}

// Configuration de l'entreprise (à personnaliser)
const COMPANY_INFO = {
  name: process.env.PDF_COMPANY_NAME || 'Rayan Hygiene Services',
  address: process.env.PDF_COMPANY_ADDRESS || '',
  city: process.env.PDF_COMPANY_CITY || '',
  phone: process.env.PDF_COMPANY_PHONE || '',
  email: process.env.PDF_COMPANY_EMAIL || '',
  website: process.env.PDF_COMPANY_WEBSITE || '',
  nif: process.env.PDF_COMPANY_NIF || '',
  nis: process.env.PDF_COMPANY_NIS || '',
  rc: process.env.PDF_COMPANY_RC || '',
  ai: process.env.PDF_COMPANY_AI || '',
  rib: process.env.PDF_COMPANY_RIB || '',
  compte: process.env.PDF_COMPANY_COMPTE || '',
  logoPath: process.env.PDF_COMPANY_LOGO_PATH || process.env.COMPANY_LOGO_PATH || '',
};

// Couleurs
const COLORS = {
  primary: '#1e40af',
  secondary: '#64748b',
  border: '#e2e8f0',
  headerBg: '#f8fafc',
  text: '#1e293b',
  lightText: '#64748b',
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
}

function formatCurrency(amount: number, devise?: string | null): string {
  const currency = devise || 'DZD';
  return new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ' + currency;
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
    doc.text(formatCurrency(ligne.prixUnitaireHT, devise), cols.prixUnit.x + 5, y + 5, { width: cols.prixUnit.width - 10, align: 'right' });

    // TVA
    doc.text(`${ligne.tauxTVA}%`, cols.tva.x + 5, y + 5, { width: cols.tva.width - 10, align: 'center' });

    // Remise
    doc.text(ligne.remisePct ? `${ligne.remisePct}%` : '-', cols.remise.x + 5, y + 5, { width: cols.remise.width - 10, align: 'center' });

    // Total
    doc.text(formatCurrency(ligne.totalHT, devise), cols.total.x + 5, y + 5, { width: cols.total.width - 10, align: 'right' });

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
    .text(formatCurrency(totalHT, devise), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
  y += 18;

  // Remise globale
  if ((remiseGlobalPct && remiseGlobalPct > 0) || (remiseGlobalMontant && remiseGlobalMontant > 0)) {
    const remiseText = remiseGlobalPct ? `Remise (${remiseGlobalPct}%):` : 'Remise:';
    doc.fillColor(COLORS.lightText)
      .text(remiseText, boxX, y, { width: boxWidth - 70, align: 'right' });
    doc.fillColor('#dc2626')
      .text('-' + formatCurrency(remiseGlobalMontant || (totalHT * (remiseGlobalPct || 0) / 100), devise), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
    y += 18;
  }

  // TVA
  doc.fillColor(COLORS.lightText)
    .text('TVA:', boxX, y, { width: boxWidth - 70, align: 'right' });
  doc.fillColor(COLORS.text)
    .text(formatCurrency(totalTVA, devise), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
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
  doc.text(formatCurrency(totalTTC, devise), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
  y += 25;

  // Montant payé (pour factures)
  if (totalPaye !== undefined) {
    doc.fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.lightText)
      .text('Déjà payé:', boxX, y, { width: boxWidth - 70, align: 'right' });
    doc.fillColor('#16a34a')
      .text(formatCurrency(totalPaye, devise), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
    y += 18;

    const resteAPayer = totalTTC - totalPaye;
    doc.font('Helvetica-Bold')
      .fillColor(resteAPayer > 0 ? '#dc2626' : '#16a34a')
      .text('Reste à payer:', boxX, y, { width: boxWidth - 70, align: 'right' });
    doc.text(formatCurrency(resteAPayer, devise), boxX + boxWidth - 70, y, { width: 70, align: 'right' });
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

function drawInvoiceHeader(doc: PDFKit.PDFDocument, facture: FactureDocument, title: string) {
  const pageWidth = doc.page.width;
  const margin = 28;
  const logoBoxWidth = 260;
  const rightBoxX = pageWidth - margin - 190;

  if (COMPANY_INFO.logoPath && fs.existsSync(COMPANY_INFO.logoPath)) {
    doc.image(COMPANY_INFO.logoPath, margin, 22, { fit: [logoBoxWidth, 58], align: 'left' });
  } else {
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#0f766e').text(COMPANY_INFO.name, margin, 30, { width: logoBoxWidth });
  }

  doc.font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#0b1b55')
    .text(`${title} ${facture.ref}`, rightBoxX, 28, { width: 190, align: 'right' });

  doc.font('Helvetica')
    .fontSize(9)
    .fillColor('#111827')
    .text(`Date facturation : ${formatDate(facture.dateFacture)}`, rightBoxX, 54, { width: 190, align: 'right' });

  if (facture.dateEcheance) {
    doc.text(`Date echeance : ${formatDate(facture.dateEcheance)}`, rightBoxX, 67, { width: 190, align: 'right' });
  }
}

function drawInvoiceParties(doc: PDFKit.PDFDocument, facture: FactureDocument): number {
  const margin = 28;
  const y = 104;
  const leftW = 230;
  const rightW = doc.page.width - margin * 2 - leftW - 20;
  const rightX = margin + leftW + 20;
  const boxH = 150;

  doc.rect(margin, y, leftW, boxH).fillColor('#e5e7eb').fill();
  doc.rect(rightX, y, rightW, boxH).lineWidth(1).strokeColor('#6b7280').stroke();

  doc.font('Helvetica').fontSize(8).fillColor('#374151').text('Emetteur', margin + 8, y - 12);
  doc.font('Helvetica').fontSize(8).fillColor('#374151').text('Adresse a', rightX + 8, y - 12);

  const leftLines = [
    COMPANY_INFO.name,
    COMPANY_INFO.address,
    COMPANY_INFO.city,
    COMPANY_INFO.nif ? `NIF : ${COMPANY_INFO.nif}` : '',
    COMPANY_INFO.nis ? `NIS : ${COMPANY_INFO.nis}` : '',
    COMPANY_INFO.rc ? `RC : ${COMPANY_INFO.rc}` : '',
    COMPANY_INFO.ai ? `AI : ${COMPANY_INFO.ai}` : '',
    COMPANY_INFO.compte ? `Compte : ${COMPANY_INFO.compte}` : '',
    COMPANY_INFO.rib ? `RIB : ${COMPANY_INFO.rib}` : '',
  ].filter(Boolean);

  doc.font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#0b1b55')
    .text(leftLines[0] || COMPANY_INFO.name, margin + 8, y + 10, { width: leftW - 16 });

  doc.font('Helvetica')
    .fontSize(8)
    .fillColor('#111827')
    .text(leftLines.slice(1).join('\n'), margin + 8, y + 25, { width: leftW - 16, lineGap: 1 });

  const client = facture.client;
  const rightLines = [
    client.nomEntreprise,
    [client.siegeAdresse, client.siegeVille, client.siegePays].filter(Boolean).join(' - '),
    client.siegeRC ? `RC: ${client.siegeRC}` : '',
    client.siegeNIF ? `NIF: ${client.siegeNIF}` : '',
    client.siegeAI ? `AI: ${client.siegeAI}` : '',
    client.siegeNIS ? `NIS: ${client.siegeNIS}` : '',
  ].filter(Boolean);

  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text(rightLines[0] || '-', rightX + 8, y + 10, { width: rightW - 16 });

  doc.font('Helvetica')
    .fontSize(9)
    .fillColor('#111827')
    .text(rightLines.slice(1).join('\n'), rightX + 8, y + 30, { width: rightW - 16, lineGap: 1 });

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

  doc.rect(margin, y, tableW, 22).fillColor('#e5e7eb').fill();
  doc.lineWidth(1).strokeColor('#6b7280').rect(margin, y, tableW, 22).stroke();
  doc.moveTo(x.tva, y).lineTo(x.tva, y + 22).stroke();
  doc.moveTo(x.pu, y).lineTo(x.pu, y + 22).stroke();
  doc.moveTo(x.qte, y).lineTo(x.qte, y + 22).stroke();
  doc.moveTo(x.total, y).lineTo(x.total, y + 22).stroke();

  doc.font('Helvetica')
    .fontSize(8)
    .fillColor('#111827')
    .text('Montants exprimes en Algerie Dinar', x.pu, y + 2, { width: cols.pu + cols.qte + cols.total - 6, align: 'right' });

  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Designation', x.designation + 5, y + 11, { width: cols.designation - 10 });
  doc.text('TVA', x.tva + 5, y + 11, { width: cols.tva - 10, align: 'center' });
  doc.text('P.U HT', x.pu + 5, y + 11, { width: cols.pu - 10, align: 'center' });
  doc.text('Qte', x.qte + 5, y + 11, { width: cols.qte - 10, align: 'center' });
  doc.text('Total HT', x.total + 5, y + 11, { width: cols.total - 10, align: 'right' });

  y += 22;
  const minHeight = 230;
  const tableBodyStart = y;

  for (const ligne of facture.lignes) {
    const desc = `${ligne.libelle}${ligne.description ? `\n${ligne.description}` : ''}`;
    const descHeight = doc.heightOfString(desc, { width: cols.designation - 10 });
    const rowHeight = Math.max(24, descHeight + 8);

    doc.rect(margin, y, tableW, rowHeight).lineWidth(0.8).strokeColor('#9ca3af').stroke();
    doc.moveTo(x.tva, y).lineTo(x.tva, y + rowHeight).stroke();
    doc.moveTo(x.pu, y).lineTo(x.pu, y + rowHeight).stroke();
    doc.moveTo(x.qte, y).lineTo(x.qte, y + rowHeight).stroke();
    doc.moveTo(x.total, y).lineTo(x.total, y + rowHeight).stroke();

    doc.font('Helvetica').fontSize(9).fillColor('#111827').text(desc, x.designation + 5, y + 4, {
      width: cols.designation - 10,
      lineGap: 1,
    });
    doc.text(`${n(ligne.tauxTVA)}%`, x.tva + 5, y + 4, { width: cols.tva - 10, align: 'center' });
    doc.text(formatCurrency(n(ligne.prixUnitaireHT), facture.devise), x.pu + 4, y + 4, { width: cols.pu - 8, align: 'right' });
    doc.text(String(n(ligne.quantite)), x.qte + 5, y + 4, { width: cols.qte - 10, align: 'center' });
    doc.text(formatCurrency(n(ligne.totalHT), facture.devise), x.total + 4, y + 4, { width: cols.total - 8, align: 'right' });

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
    { label: 'Total HT', value: formatCurrency(n(facture.totalHT), facture.devise), bold: false },
    { label: `Total TVA ${n(facture.totalHT) > 0 ? Math.round((n(facture.totalTVA) / n(facture.totalHT)) * 100) : 0}%`, value: formatCurrency(n(facture.totalTVA), facture.devise), bold: false },
    { label: 'Total TTC', value: formatCurrency(n(facture.totalTTC), facture.devise), bold: true },
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

export function generateDevisPDF(devis: DevisDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // En-tête
      drawHeader(doc, 'DEVIS', devis.ref, devis.dateDevis);

      // Infos client
      drawClientInfo(doc, devis.client);

      // Infos document
      const infos = [
        { label: 'Statut', value: getStatusLabel(devis.statut, 'devis') },
        { label: 'Date devis', value: formatDate(devis.dateDevis) },
      ];
      if (devis.dateValidite) {
        infos.push({ label: 'Valide jusqu\'au', value: formatDate(devis.dateValidite) });
      }
      drawDocumentInfo(doc, infos);

      // Tableau des lignes
      const tableEndY = drawLinesTable(doc, devis.lignes, devis.devise);

      // Totaux
      drawTotals(
        doc,
        tableEndY,
        devis.totalHT,
        devis.totalTVA,
        devis.totalTTC,
        devis.devise,
        devis.remiseGlobalPct,
        devis.remiseGlobalMontant
      );

      // Pied de page
      drawFooter(doc, devis.notes, devis.conditions);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export function generateCommandePDF(commande: CommandeDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // En-tête
      drawHeader(doc, 'BON DE COMMANDE', commande.ref, commande.dateCommande);

      // Infos client
      drawClientInfo(doc, commande.client);

      // Infos document
      const infos = [
        { label: 'Statut', value: getStatusLabel(commande.statut, 'commande') },
        { label: 'Date commande', value: formatDate(commande.dateCommande) },
      ];
      if (commande.dateLivraisonSouhaitee) {
        infos.push({ label: 'Livraison souhaitée', value: formatDate(commande.dateLivraisonSouhaitee) });
      }
      drawDocumentInfo(doc, infos);

      // Tableau des lignes
      const tableEndY = drawLinesTable(doc, commande.lignes, commande.devise);

      // Totaux
      drawTotals(
        doc,
        tableEndY,
        commande.totalHT,
        commande.totalTVA,
        commande.totalTTC,
        commande.devise,
        commande.remiseGlobalPct,
        commande.remiseGlobalMontant
      );

      // Pied de page
      drawFooter(doc, commande.notes, commande.conditions);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export function generateFacturePDF(facture: FactureDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 28 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const title = facture.type === 'AVOIR' ? 'AVOIR' : 'FACTURE';
      drawInvoiceHeader(doc, facture, title);
      const afterPartiesY = drawInvoiceParties(doc, facture);

      doc.font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#111827')
        .text(facture.client?.siegeNom ? `Site: ${facture.client.siegeNom}` : `Client: ${facture.client.nomEntreprise}`, 28, afterPartiesY, { width: 420 });
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#111827')
        .text(`Operation du ${formatDate(facture.dateFacture)}`, 28, afterPartiesY + 16, { width: 420 });

      const tableEndY = drawInvoiceLinesTable(doc, facture, afterPartiesY + 38);
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

export function generateCommandeFournisseurPDF(commande: CommandeFournisseurDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // En-tête
      drawHeader(doc, 'COMMANDE FOURNISSEUR', commande.ref, commande.dateCommande);

      // Infos fournisseur
      drawClientInfo(doc, commande.fournisseur, 'Fournisseur');

      // Infos document
      const infos = [
        { label: 'Statut', value: getStatusLabel(commande.statut, 'commande_fournisseur') },
        { label: 'Date commande', value: formatDate(commande.dateCommande) },
      ];
      if (commande.dateLivraisonSouhaitee) {
        infos.push({ label: 'Livraison souhaitée', value: formatDate(commande.dateLivraisonSouhaitee) });
      }
      drawDocumentInfo(doc, infos);

      // Tableau des lignes
      const tableEndY = drawLinesTable(doc, commande.lignes, commande.devise);

      // Totaux
      drawTotals(
        doc,
        tableEndY,
        commande.totalHT,
        commande.totalTVA,
        commande.totalTTC,
        commande.devise,
        commande.remiseGlobalPct,
        commande.remiseGlobalMontant
      );

      // Pied de page
      drawFooter(doc, commande.notes, commande.conditions);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export function generateFactureFournisseurPDF(facture: FactureFournisseurDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // En-tête
      drawHeader(doc, 'FACTURE FOURNISSEUR', facture.ref, facture.dateFacture);

      // Infos fournisseur
      drawClientInfo(doc, facture.fournisseur, 'Fournisseur');

      // Infos document
      const infos = [
        { label: 'Statut', value: getStatusLabel(facture.statut, 'facture_fournisseur') },
        { label: 'Date facture', value: formatDate(facture.dateFacture) },
      ];
      if (facture.refFournisseur) {
        infos.push({ label: 'Réf. fournisseur', value: facture.refFournisseur });
      }
      if (facture.dateReception) {
        infos.push({ label: 'Date réception', value: formatDate(facture.dateReception) });
      }
      if (facture.dateEcheance) {
        infos.push({ label: 'Échéance', value: formatDate(facture.dateEcheance) });
      }
      drawDocumentInfo(doc, infos);

      // Tableau des lignes
      const tableEndY = drawLinesTable(doc, facture.lignes, facture.devise);

      // Totaux
      drawTotals(
        doc,
        tableEndY,
        facture.totalHT,
        facture.totalTVA,
        facture.totalTTC,
        facture.devise,
        facture.remiseGlobalPct,
        facture.remiseGlobalMontant,
        facture.totalPaye
      );

      // Pied de page
      drawFooter(doc, facture.notes, facture.conditions);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
