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
  senderName?: string;
  footerNote?: string;
}): string {
  const company = opts.companyName || 'RHS Controler';
  const sender = opts.senderName || company;
  const footer = opts.footerNote || `Pour toute question, vous pouvez répondre directement à cet email. Notre équipe vous répondra dans les plus brefs délais.`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.07);">

        <!-- Bande verte top -->
        <tr>
          <td style="background:#16a34a;height:5px;font-size:0;">&nbsp;</td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="padding:28px 36px 20px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:18px;font-weight:700;color:#15803d;letter-spacing:-0.3px;">${company}</span>
                </td>
                <td align="right">
                  <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">${sender}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Séparateur -->
        <tr>
          <td style="padding:0 36px;">
            <div style="height:1px;background:#e5e7eb;"></div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 36px 32px 36px;color:#1f2937;font-size:14px;line-height:1.75;">
            ${opts.body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#6b7280;line-height:1.5;">
                  ${footer}
                </td>
              </tr>
              <tr>
                <td style="padding-top:10px;font-size:11px;color:#9ca3af;">
                  ${company} — Gestion des interventions et services
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Bande verte bottom -->
        <tr>
          <td style="background:#16a34a;height:3px;font-size:0;">&nbsp;</td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
