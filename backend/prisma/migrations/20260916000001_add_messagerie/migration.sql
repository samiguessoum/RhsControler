-- Ajout colonnes IMAP sur EmailProfile
ALTER TABLE "EmailProfile"
  ADD COLUMN IF NOT EXISTS "imapHost"   TEXT,
  ADD COLUMN IF NOT EXISTS "imapPort"   INTEGER DEFAULT 993,
  ADD COLUMN IF NOT EXISTS "imapSecure" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "lastImapUid" INTEGER DEFAULT 0;

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable EmailThread
CREATE TABLE "EmailThread" (
  "id"             TEXT NOT NULL,
  "profileId"      TEXT NOT NULL,
  "subject"        TEXT NOT NULL,
  "devisId"        TEXT,
  "factureId"      TEXT,
  "commandeId"     TEXT,
  "interventionId" TEXT,
  "lastMessageAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unreadCount"    INTEGER NOT NULL DEFAULT 0,
  "archived"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable EmailMessage
CREATE TABLE "EmailMessage" (
  "id"          TEXT NOT NULL,
  "threadId"    TEXT NOT NULL,
  "messageId"   TEXT,
  "inReplyTo"   TEXT,
  "direction"   "MessageDirection" NOT NULL,
  "fromEmail"   TEXT NOT NULL,
  "fromNom"     TEXT,
  "toEmail"     TEXT NOT NULL,
  "ccEmail"     TEXT,
  "subject"     TEXT NOT NULL,
  "bodyHtml"    TEXT,
  "bodyText"    TEXT,
  "imapUid"     INTEGER,
  "readAt"      TIMESTAMP(3),
  "sentById"    TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable EmailMessageAttachment
CREATE TABLE "EmailMessageAttachment" (
  "id"          TEXT NOT NULL,
  "messageId"   TEXT NOT NULL,
  "filename"    TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size"        INTEGER,
  "path"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- Unique + indexes
CREATE UNIQUE INDEX "EmailMessage_messageId_key" ON "EmailMessage"("messageId");
CREATE INDEX "EmailThread_profileId_idx" ON "EmailThread"("profileId");
CREATE INDEX "EmailThread_devisId_idx" ON "EmailThread"("devisId");
CREATE INDEX "EmailThread_factureId_idx" ON "EmailThread"("factureId");
CREATE INDEX "EmailThread_commandeId_idx" ON "EmailThread"("commandeId");
CREATE INDEX "EmailThread_interventionId_idx" ON "EmailThread"("interventionId");
CREATE INDEX "EmailThread_lastMessageAt_idx" ON "EmailThread"("lastMessageAt");
CREATE INDEX "EmailMessage_threadId_idx" ON "EmailMessage"("threadId");
CREATE INDEX "EmailMessage_imapUid_idx" ON "EmailMessage"("imapUid");
CREATE INDEX "EmailMessageAttachment_messageId_idx" ON "EmailMessageAttachment"("messageId");

-- Foreign keys
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "EmailProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_sentById_fkey"
  FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailMessageAttachment" ADD CONSTRAINT "EmailMessageAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
