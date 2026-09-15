import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { sendEmail, buildEmailHtml } from '../services/email.service.js';
import { syncProfileInbox, syncAllInboxes } from '../services/imap-sync.service.js';
import { EmailProfileType } from '@prisma/client';

const THREAD_INCLUDE = {
  profile: { select: { id: true, type: true, nom: true, emailFrom: true } },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: { attachments: true, sentBy: { select: { id: true, nom: true, prenom: true } } },
  },
};

export const messerieController = {

  // GET /api/messagerie/threads
  async listThreads(req: Request, res: Response, next: NextFunction) {
    try {
      const { profileType, devisId, factureId, commandeId, interventionId, archived, limit, offset } = req.query;
      const where: any = {};

      if (archived === 'true') where.archived = true;
      else where.archived = false;

      if (profileType) {
        const profile = await prisma.emailProfile.findFirst({ where: { type: profileType as EmailProfileType }, select: { id: true } });
        if (profile) where.profileId = profile.id;
      }
      if (devisId) where.devisId = devisId;
      if (factureId) where.factureId = factureId;
      if (commandeId) where.commandeId = commandeId;
      if (interventionId) where.interventionId = interventionId;

      const [threads, total] = await Promise.all([
        prisma.emailThread.findMany({
          where,
          orderBy: { lastMessageAt: 'desc' },
          take: limit ? Number(limit) : 30,
          skip: offset ? Number(offset) : 0,
          include: {
            profile: { select: { id: true, type: true, nom: true, emailFrom: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, fromEmail: true, fromNom: true, subject: true, bodyText: true, direction: true, createdAt: true, readAt: true },
            },
          },
        }),
        prisma.emailThread.count({ where }),
      ]);
      res.json({ threads, total });
    } catch (err) { next(err); }
  },

  // GET /api/messagerie/threads/:id
  async getThread(req: Request, res: Response, next: NextFunction) {
    try {
      const thread = await prisma.emailThread.findUnique({
        where: { id: req.params.id },
        include: THREAD_INCLUDE,
      });
      if (!thread) return res.status(404).json({ error: 'Thread introuvable' });

      // Marquer tous les messages entrants comme lus
      await prisma.emailMessage.updateMany({
        where: { threadId: thread.id, direction: 'INBOUND', readAt: null },
        data: { readAt: new Date() },
      });
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: { unreadCount: 0 },
      });

      res.json(thread);
    } catch (err) { next(err); }
  },

  // POST /api/messagerie/threads/:id/reply
  async replyToThread(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { body, cc } = req.body;
      const userId = (req as any).user?.id;

      const thread = await prisma.emailThread.findUnique({
        where: { id },
        include: {
          profile: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (!thread) return res.status(404).json({ error: 'Thread introuvable' });

      const lastMsg = thread.messages[0];
      const replyTo = lastMsg?.direction === 'INBOUND' ? lastMsg.fromEmail : lastMsg?.toEmail || '';
      const subject = `Re: ${thread.subject}`;

      const settings = await prisma.companySettings.findFirst();
      const html = buildEmailHtml({ title: subject, body, companyName: settings?.nomEntreprise || 'RHS' });

      // Envoyer via SMTP
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: thread.profile.smtpHost,
        port: thread.profile.smtpPort,
        secure: thread.profile.smtpSecure,
        auth: { user: thread.profile.smtpUser, pass: thread.profile.smtpPass },
      });

      const info = await transporter.sendMail({
        from: `"${thread.profile.nomFrom || thread.profile.nom}" <${thread.profile.emailFrom}>`,
        to: replyTo,
        cc: cc || undefined,
        subject,
        html,
        inReplyTo: lastMsg?.messageId || undefined,
        references: lastMsg?.messageId || undefined,
      });

      // Stocker le message sortant
      const newMsg = await prisma.emailMessage.create({
        data: {
          threadId: id,
          messageId: info.messageId || undefined,
          inReplyTo: lastMsg?.messageId || undefined,
          direction: 'OUTBOUND',
          fromEmail: thread.profile.emailFrom,
          fromNom: thread.profile.nomFrom || thread.profile.nom,
          toEmail: replyTo,
          ccEmail: cc || undefined,
          subject,
          bodyHtml: html,
          bodyText: body,
          readAt: new Date(),
          sentById: userId,
        },
        include: { attachments: true, sentBy: { select: { id: true, nom: true, prenom: true } } },
      });

      await prisma.emailThread.update({
        where: { id },
        data: { lastMessageAt: new Date() },
      });

      res.json(newMsg);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // PATCH /api/messagerie/threads/:id
  async updateThread(req: Request, res: Response, next: NextFunction) {
    try {
      const { archived, devisId, factureId, commandeId, interventionId } = req.body;
      const data: any = {};
      if (archived !== undefined) data.archived = archived;
      if (devisId !== undefined) data.devisId = devisId || null;
      if (factureId !== undefined) data.factureId = factureId || null;
      if (commandeId !== undefined) data.commandeId = commandeId || null;
      if (interventionId !== undefined) data.interventionId = interventionId || null;
      const thread = await prisma.emailThread.update({ where: { id: req.params.id }, data, include: THREAD_INCLUDE });
      res.json(thread);
    } catch (err) { next(err); }
  },

  // DELETE /api/messagerie/threads/:id
  async deleteThread(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.emailThread.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  // POST /api/messagerie/sync
  async syncNow(req: Request, res: Response, next: NextFunction) {
    try {
      const { profileId } = req.body;
      if (profileId) {
        const count = await syncProfileInbox(profileId);
        res.json({ success: true, newMessages: count });
      } else {
        await syncAllInboxes();
        res.json({ success: true });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // GET /api/messagerie/unread-count
  async unreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await prisma.emailThread.aggregate({
        _sum: { unreadCount: true },
        where: { archived: false },
      });
      res.json({ total: count._sum.unreadCount ?? 0 });
    } catch (err) { next(err); }
  },
};
