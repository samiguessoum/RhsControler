-- CreateEnum
CREATE TYPE "TypeConge" AS ENUM ('ANNUEL', 'MALADIE', 'RECUPERATION', 'SANS_SOLDE', 'EXCEPTIONNEL');

-- CreateEnum
CREATE TYPE "StatutConge" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REFUSE', 'ANNULE');

-- CreateTable
CREATE TABLE "Conge" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "type" "TypeConge" NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "nbJours" DOUBLE PRECISION NOT NULL,
    "motif" TEXT,
    "statut" "StatutConge" NOT NULL DEFAULT 'EN_ATTENTE',
    "approuveParId" TEXT,
    "dateReponse" TIMESTAMP(3),
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourWeekendTravaille" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "estVendredi" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourWeekendTravaille_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoldeConge" (
    "id" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "type" "TypeConge" NOT NULL,
    "joursAcquis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "joursPris" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "joursRestants" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoldeConge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conge_employeId_idx" ON "Conge"("employeId");

-- CreateIndex
CREATE INDEX "Conge_dateDebut_idx" ON "Conge"("dateDebut");

-- CreateIndex
CREATE INDEX "Conge_statut_idx" ON "Conge"("statut");

-- CreateIndex
CREATE INDEX "JourWeekendTravaille_employeId_idx" ON "JourWeekendTravaille"("employeId");

-- CreateIndex
CREATE INDEX "JourWeekendTravaille_date_idx" ON "JourWeekendTravaille"("date");

-- CreateIndex
CREATE UNIQUE INDEX "JourWeekendTravaille_employeId_date_key" ON "JourWeekendTravaille"("employeId", "date");

-- CreateIndex
CREATE INDEX "SoldeConge_employeId_idx" ON "SoldeConge"("employeId");

-- CreateIndex
CREATE INDEX "SoldeConge_annee_idx" ON "SoldeConge"("annee");

-- CreateIndex
CREATE UNIQUE INDEX "SoldeConge_employeId_annee_type_key" ON "SoldeConge"("employeId", "annee", "type");

-- AddForeignKey
ALTER TABLE "Conge" ADD CONSTRAINT "Conge_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conge" ADD CONSTRAINT "Conge_approuveParId_fkey" FOREIGN KEY ("approuveParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourWeekendTravaille" ADD CONSTRAINT "JourWeekendTravaille_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoldeConge" ADD CONSTRAINT "SoldeConge_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
