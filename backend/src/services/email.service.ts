import nodemailer from 'nodemailer';
import { prisma } from '../config/database.js';
import { EmailProfileType } from '@prisma/client';

export interface SendEmailOptions {
  profileType: EmailProfileType;
  to: string;
  toNom?: string;
  cc?: string;
  subject: string;
  html: string;
  attachments?: { filename: string; path?: string; content?: Buffer; contentType?: string }[];
  sentById?: string;
  // Références documents
  devisId?: string;
  factureId?: string;
  interventionId?: string;
  commandeId?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const profile = await prisma.emailProfile.findFirst({
    where: { type: opts.profileType, actif: true },
  });
  if (!profile) {
    throw new Error(`Aucun profil email configuré pour ${opts.profileType}. Configurez-le dans Paramètres → Email.`);
  }

  const transporter = nodemailer.createTransport({
    host: profile.smtpHost,
    port: profile.smtpPort,
    secure: profile.smtpSecure,
    auth: { user: profile.smtpUser, pass: profile.smtpPass },
  });

  try {
    await transporter.sendMail({
      from: `"${profile.nomFrom || profile.nom}" <${profile.emailFrom}>`,
      to: opts.to,
      cc: opts.cc || undefined,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments,
    });

    await prisma.emailLog.create({
      data: {
        profileId: profile.id,
        to: opts.to,
        toNom: opts.toNom,
        cc: opts.cc,
        subject: opts.subject,
        statut: 'ENVOYE',
        sentById: opts.sentById,
        devisId: opts.devisId,
        factureId: opts.factureId,
        interventionId: opts.interventionId,
        commandeId: opts.commandeId,
      },
    });
  } catch (err: any) {
    await prisma.emailLog.create({
      data: {
        profileId: profile.id,
        to: opts.to,
        toNom: opts.toNom,
        cc: opts.cc,
        subject: opts.subject,
        statut: 'ERREUR',
        errorMessage: err.message,
        sentById: opts.sentById,
        devisId: opts.devisId,
        factureId: opts.factureId,
        interventionId: opts.interventionId,
        commandeId: opts.commandeId,
      },
    });
    throw err;
  }
}

export async function testSmtpConnection(config: {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });
  await transporter.verify();
}

// Templates HTML réutilisables
export function buildEmailHtml(opts: {
  title: string;
  body: string;
  companyName?: string;
  footerNote?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${opts.companyName || 'RHS'}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;color:#374151;font-size:14px;line-height:1.6;">
            ${opts.body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;font-size:12px;color:#9ca3af;">
            ${opts.footerNote || 'Cet email a été envoyé automatiquement depuis la plateforme RHS Controler. Merci de ne pas y répondre directement.'}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
