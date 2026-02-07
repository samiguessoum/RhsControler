-- CreateEnum
CREATE TYPE "CommandeFournisseurStatut" AS ENUM ('BROUILLON', 'ENVOYEE', 'CONFIRMEE', 'EN_RECEPTION', 'RECUE', 'ANNULEE');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'COMMANDE_FOURNISSEUR';

-- CreateTable
CREATE TABLE "CommandeFournisseur" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "dateCommande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLivraisonSouhaitee" TIMESTAMP(3),
    "dateLivraison" TIMESTAMP(3),
    "statut" "CommandeFournisseurStatut" NOT NULL DEFAULT 'BROUILLON',
    "remiseGlobalPct" DOUBLE PRECISION DEFAULT 0,
    "remiseGlobalMontant" DOUBLE PRECISION DEFAULT 0,
    "totalHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTTC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT DEFAULT 'DZD',
    "notes" TEXT,
    "conditions" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandeFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeFournisseurLigne" (
    "id" TEXT NOT NULL,
    "commandeFournisseurId" TEXT NOT NULL,
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
    "quantiteRecue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CommandeFournisseurLigne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommandeFournisseur_ref_key" ON "CommandeFournisseur"("ref");

-- CreateIndex
CREATE INDEX "CommandeFournisseur_fournisseurId_idx" ON "CommandeFournisseur"("fournisseurId");

-- CreateIndex
CREATE INDEX "CommandeFournisseur_statut_idx" ON "CommandeFournisseur"("statut");

-- CreateIndex
CREATE INDEX "CommandeFournisseur_ref_idx" ON "CommandeFournisseur"("ref");

-- CreateIndex
CREATE INDEX "CommandeFournisseur_dateCommande_idx" ON "CommandeFournisseur"("dateCommande");

-- CreateIndex
CREATE INDEX "CommandeFournisseurLigne_commandeFournisseurId_idx" ON "CommandeFournisseurLigne"("commandeFournisseurId");

-- CreateIndex
CREATE INDEX "CommandeFournisseurLigne_produitServiceId_idx" ON "CommandeFournisseurLigne"("produitServiceId");

-- AddForeignKey
ALTER TABLE "CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeFournisseurLigne" ADD CONSTRAINT "CommandeFournisseurLigne_commandeFournisseurId_fkey" FOREIGN KEY ("commandeFournisseurId") REFERENCES "CommandeFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeFournisseurLigne" ADD CONSTRAINT "CommandeFournisseurLigne_produitServiceId_fkey" FOREIGN KEY ("produitServiceId") REFERENCES "ProduitService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
