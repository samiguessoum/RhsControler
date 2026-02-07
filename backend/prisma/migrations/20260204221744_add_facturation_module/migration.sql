-- CreateEnum
CREATE TYPE "FactureFournisseurStatut" AS ENUM ('BROUILLON', 'VALIDEE', 'EN_RETARD', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeCharge" AS ENUM ('FOURNISSEUR', 'FISCALE', 'SOCIALE', 'DIVERSE');

-- CreateEnum
CREATE TYPE "ChargeStatut" AS ENUM ('A_PAYER', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'FACTURE_FOURNISSEUR';
ALTER TYPE "DocumentType" ADD VALUE 'CHARGE';
ALTER TYPE "DocumentType" ADD VALUE 'PAIEMENT_DIVERS';

-- CreateTable
CREATE TABLE "FactureFournisseur" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "refFournisseur" TEXT,
    "fournisseurId" TEXT NOT NULL,
    "commandeFournisseurId" TEXT,
    "dateFacture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3),
    "dateReception" TIMESTAMP(3),
    "statut" "FactureFournisseurStatut" NOT NULL DEFAULT 'BROUILLON',
    "remiseGlobalPct" DOUBLE PRECISION DEFAULT 0,
    "remiseGlobalMontant" DOUBLE PRECISION DEFAULT 0,
    "totalHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTTC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT DEFAULT 'DZD',
    "notes" TEXT,
    "conditions" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactureFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactureFournisseurLigne" (
    "id" TEXT NOT NULL,
    "factureFournisseurId" TEXT NOT NULL,
    "produitServiceId" TEXT,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "quantite" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unite" TEXT,
    "prixUnitaireHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tauxTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remisePct" DOUBLE PRECISION DEFAULT 0,
    "totalHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTTC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FactureFournisseurLigne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementFournisseur" (
    "id" TEXT NOT NULL,
    "factureFournisseurId" TEXT NOT NULL,
    "modePaiementId" TEXT,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montant" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "banque" TEXT,
    "notes" TEXT,
    "statut" "PaiementStatut" NOT NULL DEFAULT 'RECU',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "typeCharge" "TypeCharge" NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "fournisseurId" TEXT,
    "categorie" TEXT,
    "sousCategorie" TEXT,
    "dateCharge" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3),
    "periodeDebut" TIMESTAMP(3),
    "periodeFin" TIMESTAMP(3),
    "montantHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tauxTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantTTC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantPaye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT DEFAULT 'DZD',
    "statut" "ChargeStatut" NOT NULL DEFAULT 'A_PAYER',
    "estRecurrente" BOOLEAN NOT NULL DEFAULT false,
    "frequenceRecurrence" TEXT,
    "notes" TEXT,
    "pieceJointe" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementCharge" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "modePaiementId" TEXT,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montant" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "banque" TEXT,
    "notes" TEXT,
    "statut" "PaiementStatut" NOT NULL DEFAULT 'RECU',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementDivers" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "typeOperation" TEXT NOT NULL,
    "categorie" TEXT,
    "tiersId" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT DEFAULT 'DZD',
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modePaiementId" TEXT,
    "reference" TEXT,
    "banque" TEXT,
    "notes" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EFFECTUE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaiementDivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FactureFournisseur_ref_key" ON "FactureFournisseur"("ref");

-- CreateIndex
CREATE INDEX "FactureFournisseur_fournisseurId_idx" ON "FactureFournisseur"("fournisseurId");

-- CreateIndex
CREATE INDEX "FactureFournisseur_statut_idx" ON "FactureFournisseur"("statut");

-- CreateIndex
CREATE INDEX "FactureFournisseur_ref_idx" ON "FactureFournisseur"("ref");

-- CreateIndex
CREATE INDEX "FactureFournisseur_dateFacture_idx" ON "FactureFournisseur"("dateFacture");

-- CreateIndex
CREATE INDEX "FactureFournisseurLigne_factureFournisseurId_idx" ON "FactureFournisseurLigne"("factureFournisseurId");

-- CreateIndex
CREATE INDEX "FactureFournisseurLigne_produitServiceId_idx" ON "FactureFournisseurLigne"("produitServiceId");

-- CreateIndex
CREATE INDEX "PaiementFournisseur_factureFournisseurId_idx" ON "PaiementFournisseur"("factureFournisseurId");

-- CreateIndex
CREATE INDEX "PaiementFournisseur_datePaiement_idx" ON "PaiementFournisseur"("datePaiement");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_ref_key" ON "Charge"("ref");

-- CreateIndex
CREATE INDEX "Charge_typeCharge_idx" ON "Charge"("typeCharge");

-- CreateIndex
CREATE INDEX "Charge_categorie_idx" ON "Charge"("categorie");

-- CreateIndex
CREATE INDEX "Charge_dateCharge_idx" ON "Charge"("dateCharge");

-- CreateIndex
CREATE INDEX "Charge_dateEcheance_idx" ON "Charge"("dateEcheance");

-- CreateIndex
CREATE INDEX "Charge_statut_idx" ON "Charge"("statut");

-- CreateIndex
CREATE INDEX "PaiementCharge_chargeId_idx" ON "PaiementCharge"("chargeId");

-- CreateIndex
CREATE INDEX "PaiementCharge_datePaiement_idx" ON "PaiementCharge"("datePaiement");

-- CreateIndex
CREATE UNIQUE INDEX "PaiementDivers_ref_key" ON "PaiementDivers"("ref");

-- CreateIndex
CREATE INDEX "PaiementDivers_typeOperation_idx" ON "PaiementDivers"("typeOperation");

-- CreateIndex
CREATE INDEX "PaiementDivers_categorie_idx" ON "PaiementDivers"("categorie");

-- CreateIndex
CREATE INDEX "PaiementDivers_datePaiement_idx" ON "PaiementDivers"("datePaiement");

-- CreateIndex
CREATE INDEX "PaiementDivers_tiersId_idx" ON "PaiementDivers"("tiersId");

-- AddForeignKey
ALTER TABLE "FactureFournisseur" ADD CONSTRAINT "FactureFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureFournisseur" ADD CONSTRAINT "FactureFournisseur_commandeFournisseurId_fkey" FOREIGN KEY ("commandeFournisseurId") REFERENCES "CommandeFournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureFournisseur" ADD CONSTRAINT "FactureFournisseur_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureFournisseur" ADD CONSTRAINT "FactureFournisseur_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureFournisseurLigne" ADD CONSTRAINT "FactureFournisseurLigne_factureFournisseurId_fkey" FOREIGN KEY ("factureFournisseurId") REFERENCES "FactureFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureFournisseurLigne" ADD CONSTRAINT "FactureFournisseurLigne_produitServiceId_fkey" FOREIGN KEY ("produitServiceId") REFERENCES "ProduitService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementFournisseur" ADD CONSTRAINT "PaiementFournisseur_factureFournisseurId_fkey" FOREIGN KEY ("factureFournisseurId") REFERENCES "FactureFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementFournisseur" ADD CONSTRAINT "PaiementFournisseur_modePaiementId_fkey" FOREIGN KEY ("modePaiementId") REFERENCES "ModePaiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementFournisseur" ADD CONSTRAINT "PaiementFournisseur_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementCharge" ADD CONSTRAINT "PaiementCharge_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementCharge" ADD CONSTRAINT "PaiementCharge_modePaiementId_fkey" FOREIGN KEY ("modePaiementId") REFERENCES "ModePaiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementCharge" ADD CONSTRAINT "PaiementCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementDivers" ADD CONSTRAINT "PaiementDivers_tiersId_fkey" FOREIGN KEY ("tiersId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementDivers" ADD CONSTRAINT "PaiementDivers_modePaiementId_fkey" FOREIGN KEY ("modePaiementId") REFERENCES "ModePaiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementDivers" ADD CONSTRAINT "PaiementDivers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
