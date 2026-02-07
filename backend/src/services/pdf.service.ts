import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  name: 'RHS Controler',
  address: 'Adresse de l\'entreprise',
  city: 'Ville, Algérie',
  phone: '+213 XX XX XX XX',
  email: 'contact@rhscontroler.com',
  nif: 'NIF: XXXXXXXXXX',
  nis: 'NIS: XXXXXXXXXX',
  rc: 'RC: XXXXXXXXXX',
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
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // En-tête
      const title = facture.type === 'AVOIR' ? 'AVOIR' : 'FACTURE';
      drawHeader(doc, title, facture.ref, facture.dateFacture);

      // Infos client
      drawClientInfo(doc, facture.client);

      // Infos document
      const infos = [
        { label: 'Statut', value: getStatusLabel(facture.statut, 'facture') },
        { label: 'Date facture', value: formatDate(facture.dateFacture) },
      ];
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
