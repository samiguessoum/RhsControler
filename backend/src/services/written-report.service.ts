import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { formatDateFr } from '../utils/date.utils.js';

export const writtenReportService = {
  // Retourne le contexte pour pré-remplir l'éditeur :
  // - contenu du dernier rapport écrit
  // - données auto de la dernière intervention validée (techniciens, produits, checks)
  async getReportContext(siteId: string) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { client: { select: { nomEntreprise: true } } },
    });
    if (!site) throw new AppError(404, 'Site introuvable');

    // Dernier rapport écrit pour ce site
    const lastWritten = await prisma.fieldReport.findFirst({
      where: { siteId, pdfPath: { not: null } },
      orderBy: { generatedAt: 'desc' },
      select: { id: true, titre: true, conclusion: true, generatedAt: true },
    });

    // Dernière intervention validée avec toutes ses données
    const lastFI = await prisma.fieldIntervention.findFirst({
      where: { siteId, statut: { in: ['SUBMITTED', 'VALIDATED'] } },
      orderBy: { dateIntervention: 'desc' },
      include: {
        applicateurs: { include: { employe: { select: { prenom: true, nom: true } } } },
        products: { include: { produitService: { select: { nom: true, unite: true } } } },
        simpleChecks: true,
        controls: {
          select: { statusCode: true, observation: true },
        },
      },
    });

    // Réclamations ouvertes
    const reclamationsOuvertes = await prisma.reclamation.count({
      where: { siteId, statut: 'OUVERT' },
    });

    const context: Record<string, unknown> = {
      site: { nom: site.nom, adresse: [site.adresse, site.codePostal, site.ville].filter(Boolean).join(', ') },
      client: { nom: site.client?.nomEntreprise },
      lastWrittenReport: lastWritten
        ? { id: lastWritten.id, titre: lastWritten.titre, contenu: lastWritten.conclusion, date: lastWritten.generatedAt }
        : null,
      reclamationsOuvertes,
      lastIntervention: null,
    };

    if (lastFI) {
      const nbOK = lastFI.controls.filter((c) => c.statusCode === 'OK' || c.statusCode === 'RAS').length;
      const nbTotal = lastFI.controls.length;
      context.lastIntervention = {
        date: formatDateFr(lastFI.dateIntervention),
        techniciens: lastFI.applicateurs.map((a) => `${a.employe.prenom} ${a.employe.nom}`).join(', '),
        produits: lastFI.products.map((p) => {
          const nom = p.produitService?.nom ?? p.nom;
          const qte = p.quantite ? `${p.quantite} ${p.unite ?? ''}`.trim() : '';
          const lot = p.lot ? `lot ${p.lot}` : '';
          return [nom, qte, lot].filter(Boolean).join(' — ');
        }),
        controles: { nbOK, nbTotal, nbProblemes: nbTotal - nbOK },
        simpleChecks: lastFI.simpleChecks.map((sc) => ({
          category: sc.category,
          statut: sc.statut,
          commentaire: sc.commentaire,
        })),
      };
    }

    return context;
  },

  // Génère un rapport écrit PDF, l'enregistre sur disque, crée FieldReport + SiteDocument
  async generateWrittenReport(siteId: string, titre: string, contenu: string, generatedById: string) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { client: { select: { nomEntreprise: true } } },
    });
    if (!site) throw new AppError(404, 'Site introuvable');

    const settings = await prisma.companySettings.findFirst({ select: { logoPath: true, nomEntreprise: true } });

    const uploadDir = path.join(process.cwd(), 'uploads', 'field-reports', siteId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `rapport-ecrit-${Date.now()}.pdf`;
    const filePath = path.join(uploadDir, filename);
    const relativePath = `uploads/field-reports/${siteId}/${filename}`;

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 60, size: 'A4' });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const BLUE = '#1e40af';
      const GRAY = '#6b7280';
      const pageWidth = doc.page.width - 120;

      // ── En-tête ──────────────────────────────────────────────
      const logoPath = settings?.logoPath ? path.join(process.cwd(), settings.logoPath) : null;
      if (logoPath && fs.existsSync(logoPath)) {
        doc.image(logoPath, 60, 45, { height: 50 });
        doc.moveDown(3);
      }

      doc.fontSize(9).fillColor(GRAY).text(settings?.nomEntreprise || 'RHS Contrôle', { align: 'right' });
      doc.text(`Rapport généré le ${formatDateFr(new Date())}`, { align: 'right' });
      doc.moveDown(0.5);

      // Ligne séparatrice
      doc.moveTo(60, doc.y).lineTo(60 + pageWidth, doc.y).strokeColor(BLUE).lineWidth(2).stroke();
      doc.moveDown(1);

      // ── Titre ────────────────────────────────────────────────
      doc.fontSize(18).fillColor(BLUE).font('Helvetica-Bold').text(titre, { align: 'center' });
      doc.moveDown(0.5);

      // ── Infos site ───────────────────────────────────────────
      doc.fontSize(10).fillColor(GRAY).font('Helvetica').text(
        `Site : ${site.nom}  ·  Client : ${site.client?.nomEntreprise || '—'}`,
        { align: 'center' },
      );
      if (site.adresse || site.ville) {
        doc.text([site.adresse, site.codePostal, site.ville].filter(Boolean).join(', '), { align: 'center' });
      }
      doc.moveDown(1.5);

      // Ligne séparatrice fine
      doc.moveTo(60, doc.y).lineTo(60 + pageWidth, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(1);

      // ── Corps du rapport ─────────────────────────────────────
      doc.fontSize(11).fillColor('#111827').font('Helvetica').text(contenu, {
        lineGap: 4,
        paragraphGap: 8,
        width: pageWidth,
      });

      doc.moveDown(2);

      // ── Pied de page ────────────────────────────────────────
      doc.moveTo(60, doc.y).lineTo(60 + pageWidth, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor(GRAY).text(
        `Document généré automatiquement — ${settings?.nomEntreprise || 'RHS Contrôle'} — ${formatDateFr(new Date())}`,
        { align: 'center' },
      );

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    const existingCount = await prisma.fieldReport.count({ where: { siteId, pdfPath: { not: null } } });

    const report = await prisma.fieldReport.create({
      data: {
        siteId,
        version: existingCount + 1,
        statut: 'FINAL',
        titre,
        conclusion: contenu,
        pdfPath: relativePath,
        generatedById,
      },
      include: { generatedBy: { select: { id: true, prenom: true, nom: true } } },
    });

    await prisma.siteDocument.create({
      data: {
        siteId,
        titre,
        type: 'rapport',
        filename,
        path: relativePath,
        annee: new Date().getFullYear(),
        uploadedById: generatedById,
      },
    });

    return report;
  },
};
