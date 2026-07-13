-- CreateEnum
CREATE TYPE "BonLivraisonStatut" AS ENUM ('BROUILLON', 'CONFIRME', 'LIVRE', 'ANNULE');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'BON_LIVRAISON';

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "offsetBonLivraison" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prefixBonLivraison" TEXT NOT NULL DEFAULT 'BL';

-- CreateTable
CREATE TABLE "BonLivraison" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "commandeId" TEXT,
    "adresseLivraisonId" TEXT,
    "siteId" TEXT,
    "dateBonLivraison" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLivraisonEffective" TIMESTAMP(3),
    "statut" "BonLivraisonStatut" NOT NULL DEFAULT 'BROUILLON',
    "notes" TEXT,
    "devise" TEXT DEFAULT 'DZD',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonLivraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonLivraisonLigne" (
    "id" TEXT NOT NULL,
    "bonLivraisonId" TEXT NOT NULL,
    "commandeLigneId" TEXT,
    "produitServiceId" TEXT,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "quantiteCommandee" DOUBLE PRECISION,
    "quantiteLivree" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unite" TEXT,
    "prixUnitaireHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tauxTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remisePct" DOUBLE PRECISION DEFAULT 0,
    "totalHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTTC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BonLivraisonLigne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraison_ref_key" ON "BonLivraison"("ref");

-- CreateIndex
CREATE INDEX "BonLivraison_clientId_idx" ON "BonLivraison"("clientId");

-- CreateIndex
CREATE INDEX "BonLivraison_commandeId_idx" ON "BonLivraison"("commandeId");

-- CreateIndex
CREATE INDEX "BonLivraison_siteId_idx" ON "BonLivraison"("siteId");

-- CreateIndex
CREATE INDEX "BonLivraison_statut_idx" ON "BonLivraison"("statut");

-- CreateIndex
CREATE INDEX "BonLivraison_dateBonLivraison_idx" ON "BonLivraison"("dateBonLivraison");

-- CreateIndex
CREATE INDEX "BonLivraison_ref_idx" ON "BonLivraison"("ref");

-- CreateIndex
CREATE INDEX "BonLivraisonLigne_bonLivraisonId_idx" ON "BonLivraisonLigne"("bonLivraisonId");

-- CreateIndex
CREATE INDEX "BonLivraisonLigne_commandeLigneId_idx" ON "BonLivraisonLigne"("commandeLigneId");

-- CreateIndex
CREATE INDEX "BonLivraisonLigne_produitServiceId_idx" ON "BonLivraisonLigne"("produitServiceId");

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_adresseLivraisonId_fkey" FOREIGN KEY ("adresseLivraisonId") REFERENCES "Adresse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraisonLigne" ADD CONSTRAINT "BonLivraisonLigne_bonLivraisonId_fkey" FOREIGN KEY ("bonLivraisonId") REFERENCES "BonLivraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraisonLigne" ADD CONSTRAINT "BonLivraisonLigne_commandeLigneId_fkey" FOREIGN KEY ("commandeLigneId") REFERENCES "CommandeLigne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraisonLigne" ADD CONSTRAINT "BonLivraisonLigne_produitServiceId_fkey" FOREIGN KEY ("produitServiceId") REFERENCES "ProduitService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
