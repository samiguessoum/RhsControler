import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from '../config/database.js';
import logger from '../lib/logger.js';

// Détecte les refs de documents dans le sujet d'un email
function detectDocumentRefs(subject: string): {
  devisId?: string; factureId?: string; commandeId?: string; interventionId?: string;
} {
  return {};
}

// Trouve ou crée un thread correspondant à cet email
async function findOrCreateThread(params: {
  profileId: string;
  subject: string;
  inReplyTo?: string | null;
  references?: string | null;
}): Promise<string> {
  const { profileId, subject, inReplyTo, references } = params;

  // Si c'est une réponse, chercher le thread parent via In-Reply-To ou References
  if (inReplyTo || references) {
    const refIds = [inReplyTo, ...(references?.split(/\s+/) || [])].filter(Boolean) as string[];
    const parentMsg = await prisma.emailMessage.findFirst({
      where: { messageId: { in: refIds } },
      select: { threadId: true },
    });
    if (parentMsg) return parentMsg.threadId;
  }

  // Chercher un thread existant avec le même sujet (nettoyé) dans ce profil
  const cleanSubject = subject.replace(/^(re|fwd|fw|tr):\s*/gi, '').trim();
  const existingThread = await prisma.emailThread.findFirst({
    where: {
      profileId,
      subject: { contains: cleanSubject, mode: 'insensitive' },
      archived: false,
    },
    orderBy: { lastMessageAt: 'desc' },
    select: { id: true },
  });
  if (existingThread) return existingThread.id;

  // Détecter liaisons documents
  const docRefs = await resolveDocumentRefs(cleanSubject);

  // Créer un nouveau thread
  const thread = await prisma.emailThread.create({
    data: {
      profileId,
      subject: cleanSubject,
      ...docRefs,
    },
  });
  return thread.id;
}

// Résout les refs en IDs de documents
async function resolveDocumentRefs(subject: string): Promise<{
  devisId?: string; factureId?: string; commandeId?: string;
}> {
  const result: { devisId?: string; factureId?: string; commandeId?: string } = {};

  // Chercher un devis avec une ref qui apparaît dans le sujet
  const devis = await prisma.devis.findFirst({
    where: { ref: { not: '' } },
    select: { id: true, ref: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  // On cherche parmi les 200 derniers documents
  const [allDevis, allFactures, allCommandes] = await Promise.all([
    prisma.devis.findMany({ select: { id: true, ref: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.facture.findMany({ select: { id: true, ref: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.commande.findMany({ select: { id: true, ref: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
  ]);

  for (const d of allDevis) {
    if (subject.toLowerCase().includes(d.ref.toLowerCase())) { result.devisId = d.id; break; }
  }
  for (const f of allFactures) {
    if (subject.toLowerCase().includes(f.ref.toLowerCase())) { result.factureId = f.id; break; }
  }
  for (const c of allCommandes) {
    if (subject.toLowerCase().includes(c.ref.toLowerCase())) { result.commandeId = c.id; break; }
  }

  return result;
}

// Sync IMAP pour un profil donné
export async function syncProfileInbox(profileId: string): Promise<number> {
  const profile = await prisma.emailProfile.findUnique({ where: { id: profileId } });
  if (!profile || !profile.imapHost || !profile.actif) return 0;

  const client = new ImapFlow({
    host: profile.imapHost,
    port: profile.imapPort ?? 993,
    secure: profile.imapSecure,
    auth: { user: profile.smtpUser, pass: profile.smtpPass },
    logger: false,
  });

  let newCount = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const lastUid = profile.lastImapUid ?? 0;
      const searchUid = lastUid > 0 ? `${lastUid + 1}:*` : '1:*';

      let maxUid = lastUid;
      for await (const msg of client.fetch(searchUid, {
        uid: true, envelope: true, bodyStructure: true, source: true,
      }, { uid: true })) {
        if (msg.uid <= lastUid) continue;

        // Éviter les doublons
        const existing = await prisma.emailMessage.findFirst({
          where: { imapUid: msg.uid, thread: { profileId } },
        });
        if (existing) { maxUid = Math.max(maxUid, msg.uid); continue; }

        // Parser l'email complet
        if (!msg.source) { maxUid = Math.max(maxUid, msg.uid); continue; }
        const parsed = await simpleParser(msg.source as Buffer);
        const subject = parsed.subject || '(Sans objet)';
        const fromEmail = (parsed.from?.value?.[0]?.address) || '';
        const fromNom = (parsed.from?.value?.[0]?.name) || undefined;
        const toEmail = (parsed.to as any)?.value?.[0]?.address || profile.emailFrom;
        const ccEmail = (parsed.cc as any)?.value?.map((a: any) => a.address).join(', ') || undefined;
        const messageId = parsed.messageId || undefined;
        const inReplyTo = parsed.inReplyTo || undefined;
        const references = Array.isArray(parsed.references)
          ? parsed.references.join(' ')
          : (parsed.references as string | undefined);

        const threadId = await findOrCreateThread({ profileId, subject, inReplyTo, references });

        // Créer le message
        const newMsg = await prisma.emailMessage.create({
          data: {
            threadId,
            messageId,
            inReplyTo,
            direction: 'INBOUND',
            fromEmail,
            fromNom,
            toEmail,
            ccEmail,
            subject,
            bodyHtml: parsed.html || undefined,
            bodyText: parsed.text || undefined,
            imapUid: msg.uid,
          },
        });

        // Pièces jointes
        if (parsed.attachments?.length) {
          const attachDir = `uploads/email-attachments/${newMsg.id}`;
          const fs = await import('fs');
          const path = await import('path');
          fs.mkdirSync(path.join(process.cwd(), attachDir), { recursive: true });

          for (const att of parsed.attachments) {
            const safeName = att.filename?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment';
            const filePath = path.join(process.cwd(), attachDir, safeName);
            fs.writeFileSync(filePath, att.content);
            await prisma.emailMessageAttachment.create({
              data: {
                messageId: newMsg.id,
                filename: att.filename || safeName,
                contentType: att.contentType,
                size: att.size,
                path: `${attachDir}/${safeName}`,
              },
            });
          }
        }

        // Mettre à jour le thread
        await prisma.emailThread.update({
          where: { id: threadId },
          data: {
            lastMessageAt: parsed.date || new Date(),
            unreadCount: { increment: 1 },
          },
        });

        maxUid = Math.max(maxUid, msg.uid);
        newCount++;
      }

      // Sauvegarder le dernier UID
      if (maxUid > lastUid) {
        await prisma.emailProfile.update({
          where: { id: profileId },
          data: { lastImapUid: maxUid },
        });
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err: any) {
    logger.error({ err, profileId }, 'Erreur IMAP sync');
    try { await client.logout(); } catch {}
  }

  return newCount;
}

// Sync tous les profils actifs avec IMAP configuré
export async function syncAllInboxes(): Promise<void> {
  const profiles = await prisma.emailProfile.findMany({
    where: { actif: true, imapHost: { not: null } },
    select: { id: true, type: true },
  });

  for (const p of profiles) {
    try {
      const count = await syncProfileInbox(p.id);
      if (count > 0) logger.info(`IMAP sync ${p.type}: ${count} nouveaux emails`);
    } catch (err) {
      logger.error({ err }, `Erreur sync profil ${p.type}`);
    }
  }
}
