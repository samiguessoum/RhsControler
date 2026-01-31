-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DIRECTION', 'PLANNING', 'EQUIPE', 'LECTURE');

-- CreateEnum
CREATE TYPE "ContratType" AS ENUM ('ANNUEL', 'PONCTUEL');

-- CreateEnum
CREATE TYPE "ContratStatut" AS ENUM ('ACTIF', 'SUSPENDU', 'TERMINE');

-- CreateEnum
CREATE TYPE "Frequence" AS ENUM ('HEBDOMADAIRE', 'MENSUELLE', 'TRIMESTRIELLE', 'SEMESTRIELLE', 'ANNUELLE', 'PERSONNALISEE');

-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('OPERATION', 'CONTROLE');

-- CreateEnum
CREATE TYPE "InterventionStatut" AS ENUM ('A_PLANIFIER', 'PLANIFIEE', 'REALISEE', 'REPORTEE', 'ANNULEE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "tel" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EQUIPE',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nomEntreprise" TEXT NOT NULL,
    "siteAdresse" TEXT,
    "secteur" TEXT,
    "contactNom" TEXT,
    "contactFonction" TEXT,
    "tel" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrat" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ContratType" NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "reconductionAuto" BOOLEAN NOT NULL DEFAULT false,
    "prestations" TEXT[],
    "frequenceOperations" "Frequence",
    "frequenceOperationsJours" INTEGER,
    "frequenceControle" "Frequence",
    "frequenceControleJours" INTEGER,
    "premiereDateOperation" TIMESTAMP(3),
    "premiereDateControle" TIMESTAMP(3),
    "responsablePlanningId" TEXT,
    "statut" "ContratStatut" NOT NULL DEFAULT 'ACTIF',
    "notes" TEXT,
    "autoCreerProchaine" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "contratId" TEXT,
    "clientId" TEXT NOT NULL,
    "type" "InterventionType" NOT NULL,
    "prestation" TEXT,
    "datePrevue" TIMESTAMP(3) NOT NULL,
    "heurePrevue" TEXT,
    "duree" INTEGER,
    "statut" "InterventionStatut" NOT NULL DEFAULT 'A_PLANIFIER',
    "notesTerrain" TEXT,
    "responsable" TEXT,
    "exporteGCal" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prestation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Contrat_clientId_idx" ON "Contrat"("clientId");

-- CreateIndex
CREATE INDEX "Contrat_statut_idx" ON "Contrat"("statut");

-- CreateIndex
CREATE INDEX "Intervention_clientId_idx" ON "Intervention"("clientId");

-- CreateIndex
CREATE INDEX "Intervention_contratId_idx" ON "Intervention"("contratId");

-- CreateIndex
CREATE INDEX "Intervention_datePrevue_idx" ON "Intervention"("datePrevue");

-- CreateIndex
CREATE INDEX "Intervention_statut_idx" ON "Intervention"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Prestation_nom_key" ON "Prestation"("nom");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_responsablePlanningId_fkey" FOREIGN KEY ("responsablePlanningId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
