import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { sendEmail, testSmtpConnection, buildEmailHtml } from '../services/email.service.js';
import { EmailProfileType } from '@prisma/client';

const CLIENT_SELECT = {
  id: true, nomEntreprise: true, code: true,
  siegeAdresse: true, siegeVille: true, siegePays: true,
  siegeRC: true, siegeNIF: true, siegeAI: true, siegeNIS: true, siegeNIN: true,
  email: true, telephone: true,
};

const SITE_SELECT = { nom: true, ville: true, adresse: true };

// ── Profils SMTP ──────────────────────────────────────────────

export const emailController = {

  async listProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      const profiles = await prisma.emailProfile.findMany({
        orderBy: { type: 'asc' },
        select: {
          id: true, type: true, nom: true, emailFrom: true, nomFrom: true,
          smtpHost: true, smtpPort: true, smtpSecure: true, smtpUser: true,
          actif: true, createdAt: true, updatedAt: true,
        },
      });
      res.json(profiles);
    } catch (err) { next(err); }
  },

  async upsertProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, nom, emailFrom, nomFrom, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = req.body;
      if (!type || !nom || !emailFrom || !smtpHost || !smtpUser || !smtpPass) {
        return res.status(400).json({ error: 'Champs requis : type, nom, emailFrom, smtpHost, smtpUser, smtpPass' });
      }
      const profile = await prisma.emailProfile.upsert({
        where: { type: type as EmailProfileType },
        create: { type, nom, emailFrom, nomFrom, smtpHost, smtpPort: smtpPort ?? 587, smtpSecure: smtpSecure ?? false, smtpUser, smtpPass },
        update: { nom, emailFrom, nomFrom, smtpHost, smtpPort: smtpPort ?? 587, smtpSecure: smtpSecure ?? false, smtpUser, smtpPass, actif: true },
        select: {
          id: true, type: true, nom: true, emailFrom: true, nomFrom: true,
          smtpHost: true, smtpPort: true, smtpSecure: true, smtpUser: true,
          actif: true, updatedAt: true,
        },
      });
      res.json(profile);
    } catch (err) { next(err); }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { nom, emailFrom, nomFrom, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, actif } = req.body;
      const data: any = {};
      if (nom !== undefined) data.nom = nom;
      if (emailFrom !== undefined) data.emailFrom = emailFrom;
      if (nomFrom !== undefined) data.nomFrom = nomFrom;
      if (smtpHost !== undefined) data.smtpHost = smtpHost;
      if (smtpPort !== undefined) data.smtpPort = smtpPort;
      if (smtpSecure !== undefined) data.smtpSecure = smtpSecure;
      if (smtpUser !== undefined) data.smtpUser = smtpUser;
      if (smtpPass !== undefined) data.smtpPass = smtpPass;
      if (actif !== undefined) data.actif = actif;
      const profile = await prisma.emailProfile.update({
        where: { id }, data,
        select: {
          id: true, type: true, nom: true, emailFrom: true, nomFrom: true,
          smtpHost: true, smtpPort: true, smtpSecure: true, smtpUser: true,
          actif: true, updatedAt: true,
        },
      });
      res.json(profile);
    } catch (err) { next(err); }
  },

  async deleteProfile(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.emailProfile.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async testProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await prisma.emailProfile.findUnique({ where: { id: req.params.id } });
      if (!profile) return res.status(404).json({ error: 'Profil introuvable' });
      await testSmtpConnection({
        smtpHost: profile.smtpHost, smtpPort: profile.smtpPort,
        smtpSecure: profile.smtpSecure, smtpUser: profile.smtpUser, smtpPass: profile.smtpPass,
      });
      res.json({ success: true, message: 'Connexion SMTP OK' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Connexion SMTP échouée' });
    }
  },

  // ── Envoi ────────────────────────────────────────────────────

  async sendDevis(req: Request, res: Response, next: NextFunction) {
    try {
      const { devisId } = req.params;
      const { to, toNom, cc, subject, body } = req.body;
      const userId = (req as any).user?.id;

      const devis = await prisma.devis.findUnique({
        where: { id: devisId },
        include: { client: { select: CLIENT_SELECT }, site: { select: SITE_SELECT }, lignes: { orderBy: { ordre: 'asc' } } },
      });
      if (!devis) return res.status(404).json({ error: 'Devis introuvable' });

      const { generateDevisPDF } = await import('../services/pdf.service.js');
      const pdfBuffer = await generateDevisPDF(devis as any);

      const settings = await prisma.companySettings.findFirst();
      const html = buildEmailHtml({ title: subject, body, companyName: settings?.nomEntreprise || 'RHS' });

      await sendEmail({
        profileType: 'DEVIS', to, toNom, cc, subject, html,
        attachments: [{ filename: `${devis.ref.replace(/\//g, '-')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
        sentById: userId, devisId,
      });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  async sendFacture(req: Request, res: Response, next: NextFunction) {
    try {
      const { factureId } = req.params;
      const { to, toNom, cc, subject, body } = req.body;
      const userId = (req as any).user?.id;

      const facture = await prisma.facture.findUnique({
        where: { id: factureId },
        include: { client: { select: CLIENT_SELECT }, site: { select: SITE_SELECT }, lignes: { orderBy: { ordre: 'asc' } } },
      });
      if (!facture) return res.status(404).json({ error: 'Facture introuvable' });

      const { generateFacturePDF } = await import('../services/pdf.service.js');
      const pdfBuffer = await generateFacturePDF(facture as any);

      const settings = await prisma.companySettings.findFirst();
      const html = buildEmailHtml({ title: subject, body, companyName: settings?.nomEntreprise || 'RHS' });

      await sendEmail({
        profileType: 'FACTURATION', to, toNom, cc, subject, html,
        attachments: [{ filename: `${facture.ref.replace(/\//g, '-')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
        sentById: userId, factureId,
      });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  async sendIntervention(req: Request, res: Response, next: NextFunction) {
    try {
      const { interventionId } = req.params;
      const { to, toNom, cc, subject, body } = req.body;
      const userId = (req as any).user?.id;

      const settings = await prisma.companySettings.findFirst();
      const html = buildEmailHtml({ title: subject, body, companyName: settings?.nomEntreprise || 'RHS' });
      await sendEmail({ profileType: 'INTERVENTION', to, toNom, cc, subject, html, sentById: userId, interventionId });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  async sendCommande(req: Request, res: Response, next: NextFunction) {
    try {
      const { commandeId } = req.params;
      const { to, toNom, cc, subject, body } = req.body;
      const userId = (req as any).user?.id;

      const commande = await prisma.commande.findUnique({
        where: { id: commandeId },
        include: { client: { select: CLIENT_SELECT }, site: { select: SITE_SELECT }, lignes: { orderBy: { ordre: 'asc' } } },
      });
      if (!commande) return res.status(404).json({ error: 'Commande introuvable' });

      const { generateCommandePDF } = await import('../services/pdf.service.js');
      const pdfBuffer = await generateCommandePDF(commande as any);

      const settings = await prisma.companySettings.findFirst();
      const html = buildEmailHtml({ title: subject, body, companyName: settings?.nomEntreprise || 'RHS' });

      await sendEmail({
        profileType: 'COMMANDE_FOURNISSEUR', to, toNom, cc, subject, html,
        attachments: [{ filename: `${commande.ref.replace(/\//g, '-')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
        sentById: userId, commandeId,
      });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  async sendCommandeFournisseur(req: Request, res: Response, next: NextFunction) {
    try {
      const { commandeId } = req.params;
      const { to, toNom, cc, subject, body } = req.body;
      const userId = (req as any).user?.id;

      const commande = await prisma.commandeFournisseur.findUnique({
        where: { id: commandeId },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true, code: true, siegeAdresse: true, siegeVille: true, siegePays: true } },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });
      if (!commande) return res.status(404).json({ error: 'Commande fournisseur introuvable' });

      const { generateCommandeFournisseurPDF } = await import('../services/pdf.service.js');
      const pdfBuffer = await generateCommandeFournisseurPDF(commande as any);

      const settings = await prisma.companySettings.findFirst();
      const html = buildEmailHtml({ title: subject, body, companyName: settings?.nomEntreprise || 'RHS' });

      await sendEmail({
        profileType: 'COMMANDE_FOURNISSEUR', to, toNom, cc, subject, html,
        attachments: [{ filename: `${commande.ref.replace(/\//g, '-')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
        sentById: userId, commandeId,
      });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  async sendRapport(req: Request, res: Response, next: NextFunction) {
    try {
      const { to, toNom, cc, subject, body, fieldInterventionId } = req.body;
      const userId = (req as any).user?.id;

      const settings = await prisma.companySettings.findFirst();
      const html = buildEmailHtml({ title: subject, body, companyName: settings?.nomEntreprise || 'RHS' });
      await sendEmail({ profileType: 'RAPPORT', to, toNom, cc, subject, html, sentById: userId });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  // ── Logs ─────────────────────────────────────────────────────

  async listLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { devisId, factureId, interventionId, commandeId, limit } = req.query;
      const where: any = {};
      if (devisId) where.devisId = devisId;
      if (factureId) where.factureId = factureId;
      if (interventionId) where.interventionId = interventionId;
      if (commandeId) where.commandeId = commandeId;

      const logs = await prisma.emailLog.findMany({
        where,
        take: limit ? Number(limit) : 50,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: { select: { nom: true, emailFrom: true } },
          sentBy: { select: { nom: true, prenom: true } },
        },
      });
      res.json(logs);
    } catch (err) { next(err); }
  },
};
