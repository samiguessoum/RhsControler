-- CreateEnum
CREATE TYPE "EmailProfileType" AS ENUM ('DEVIS', 'FACTURATION', 'RAPPORT', 'INTERVENTION', 'COMMANDE_FOURNISSEUR');

-- CreateEnum
CREATE TYPE "EmailStatut" AS ENUM ('ENVOYE', 'ERREUR');

-- CreateTable
CREATE TABLE "EmailProfile" (
  "id"         TEXT NOT NULL,
  "type"       "EmailProfileType" NOT NULL,
  "nom"        TEXT NOT NULL,
  "emailFrom"  TEXT NOT NULL,
  "nomFrom"    TEXT,
  "smtpHost"   TEXT NOT NULL,
  "smtpPort"   INTEGER NOT NULL DEFAULT 587,
  "smtpUser"   TEXT NOT NULL,
  "smtpPass"   TEXT NOT NULL,
  "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
  "actif"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
  "id"             TEXT NOT NULL,
  "profileId"      TEXT,
  "to"             TEXT NOT NULL,
  "toNom"          TEXT,
  "cc"             TEXT,
  "subject"        TEXT NOT NULL,
  "statut"         "EmailStatut" NOT NULL DEFAULT 'ENVOYE',
  "errorMessage"   TEXT,
  "devisId"        TEXT,
  "factureId"      TEXT,
  "interventionId" TEXT,
  "commandeId"     TEXT,
  "sentById"       TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailProfile_type_key" ON "EmailProfile"("type");
CREATE INDEX "EmailProfile_type_idx" ON "EmailProfile"("type");
CREATE INDEX "EmailLog_profileId_idx" ON "EmailLog"("profileId");
CREATE INDEX "EmailLog_devisId_idx" ON "EmailLog"("devisId");
CREATE INDEX "EmailLog_factureId_idx" ON "EmailLog"("factureId");
CREATE INDEX "EmailLog_interventionId_idx" ON "EmailLog"("interventionId");
CREATE INDEX "EmailLog_commandeId_idx" ON "EmailLog"("commandeId");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "EmailProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sentById_fkey"
  FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
