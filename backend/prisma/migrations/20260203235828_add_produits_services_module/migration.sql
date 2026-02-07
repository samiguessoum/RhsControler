-- CreateEnum
CREATE TYPE "TypeProduit" AS ENUM ('PRODUIT', 'SERVICE');

-- CreateEnum
CREATE TYPE "NatureProduit" AS ENUM ('MATIERE_PREMIERE', 'PRODUIT_FINI', 'PRODUIT_SEMI_FINI', 'CONSOMMABLE', 'PIECE_DETACHEE', 'AUTRE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeMouvement" ADD VALUE 'TRANSFERT';
ALTER TYPE "TypeMouvement" ADD VALUE 'INVENTAIRE';

-- DropForeignKey
ALTER TABLE "MouvementStock" DROP CONSTRAINT "MouvementStock_produitId_fkey";

-- AlterTable
ALTER TABLE "MouvementStock" ADD COLUMN     "entrepotDestId" TEXT,
ADD COLUMN     "entrepotId" TEXT,
ADD COLUMN     "numeroLot" TEXT,
ADD COLUMN     "produitServiceId" TEXT,
ALTER COLUMN "produitId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CategorieProduit" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "couleur" TEXT,
    "icone" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorieProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProduitServiceCategorie" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProduitServiceCategorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entrepot" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "adresse" TEXT,
    "codePostal" TEXT,
    "ville" TEXT,
    "pays" TEXT DEFAULT 'Algérie',
    "responsable" TEXT,
    "tel" TEXT,
    "email" TEXT,
    "estDefaut" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entrepot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEntrepot" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "entrepotId" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emplacement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockEntrepot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProduitService" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "codeBarres" TEXT,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "descriptionLongue" TEXT,
    "type" "TypeProduit" NOT NULL DEFAULT 'PRODUIT',
    "nature" "NatureProduit",
    "unite" TEXT NOT NULL DEFAULT 'unité',
    "uniteAchat" TEXT,
    "ratioUnites" DOUBLE PRECISION DEFAULT 1,
    "prixVenteHT" DOUBLE PRECISION,
    "tauxTVA" DOUBLE PRECISION DEFAULT 19,
    "prixVenteTTC" DOUBLE PRECISION,
    "prixAchatHT" DOUBLE PRECISION,
    "margeParDefaut" DOUBLE PRECISION,
    "aStock" BOOLEAN NOT NULL DEFAULT true,
    "quantite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMinimum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMaximum" DOUBLE PRECISION,
    "lotSuivi" BOOLEAN NOT NULL DEFAULT false,
    "dlcSuivi" BOOLEAN NOT NULL DEFAULT false,
    "dureeService" DOUBLE PRECISION,
    "fournisseurId" TEXT,
    "delaiLivraison" INTEGER,
    "marque" TEXT,
    "modele" TEXT,
    "poids" DOUBLE PRECISION,
    "longueur" DOUBLE PRECISION,
    "largeur" DOUBLE PRECISION,
    "hauteur" DOUBLE PRECISION,
    "compteVente" TEXT,
    "compteAchat" TEXT,
    "notePublique" TEXT,
    "notePrivee" TEXT,
    "urlExterne" TEXT,
    "enVente" BOOLEAN NOT NULL DEFAULT true,
    "enAchat" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProduitService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrixFournisseur" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "refFournisseur" TEXT,
    "prixAchatHT" DOUBLE PRECISION NOT NULL,
    "remise" DOUBLE PRECISION DEFAULT 0,
    "quantiteMin" DOUBLE PRECISION DEFAULT 1,
    "delaiLivraison" INTEGER,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "estDefaut" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrixFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrixClient" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "prixVenteHT" DOUBLE PRECISION NOT NULL,
    "remise" DOUBLE PRECISION DEFAULT 0,
    "quantiteMin" DOUBLE PRECISION DEFAULT 1,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrixClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotProduit" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "numeroLot" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "datePeremption" TIMESTAMP(3),
    "dateFabrication" TIMESTAMP(3),
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotProduit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategorieProduit_code_key" ON "CategorieProduit"("code");

-- CreateIndex
CREATE INDEX "CategorieProduit_parentId_idx" ON "CategorieProduit"("parentId");

-- CreateIndex
CREATE INDEX "CategorieProduit_nom_idx" ON "CategorieProduit"("nom");

-- CreateIndex
CREATE INDEX "ProduitServiceCategorie_produitId_idx" ON "ProduitServiceCategorie"("produitId");

-- CreateIndex
CREATE INDEX "ProduitServiceCategorie_categorieId_idx" ON "ProduitServiceCategorie"("categorieId");

-- CreateIndex
CREATE UNIQUE INDEX "ProduitServiceCategorie_produitId_categorieId_key" ON "ProduitServiceCategorie"("produitId", "categorieId");

-- CreateIndex
CREATE UNIQUE INDEX "Entrepot_code_key" ON "Entrepot"("code");

-- CreateIndex
CREATE INDEX "Entrepot_code_idx" ON "Entrepot"("code");

-- CreateIndex
CREATE INDEX "Entrepot_nom_idx" ON "Entrepot"("nom");

-- CreateIndex
CREATE INDEX "StockEntrepot_produitId_idx" ON "StockEntrepot"("produitId");

-- CreateIndex
CREATE INDEX "StockEntrepot_entrepotId_idx" ON "StockEntrepot"("entrepotId");

-- CreateIndex
CREATE UNIQUE INDEX "StockEntrepot_produitId_entrepotId_key" ON "StockEntrepot"("produitId", "entrepotId");

-- CreateIndex
CREATE UNIQUE INDEX "ProduitService_reference_key" ON "ProduitService"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "ProduitService_codeBarres_key" ON "ProduitService"("codeBarres");

-- CreateIndex
CREATE INDEX "ProduitService_reference_idx" ON "ProduitService"("reference");

-- CreateIndex
CREATE INDEX "ProduitService_codeBarres_idx" ON "ProduitService"("codeBarres");

-- CreateIndex
CREATE INDEX "ProduitService_nom_idx" ON "ProduitService"("nom");

-- CreateIndex
CREATE INDEX "ProduitService_type_idx" ON "ProduitService"("type");

-- CreateIndex
CREATE INDEX "ProduitService_fournisseurId_idx" ON "ProduitService"("fournisseurId");

-- CreateIndex
CREATE INDEX "PrixFournisseur_produitId_idx" ON "PrixFournisseur"("produitId");

-- CreateIndex
CREATE INDEX "PrixFournisseur_fournisseurId_idx" ON "PrixFournisseur"("fournisseurId");

-- CreateIndex
CREATE UNIQUE INDEX "PrixFournisseur_produitId_fournisseurId_key" ON "PrixFournisseur"("produitId", "fournisseurId");

-- CreateIndex
CREATE INDEX "PrixClient_produitId_idx" ON "PrixClient"("produitId");

-- CreateIndex
CREATE INDEX "PrixClient_clientId_idx" ON "PrixClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "PrixClient_produitId_clientId_key" ON "PrixClient"("produitId", "clientId");

-- CreateIndex
CREATE INDEX "LotProduit_produitId_idx" ON "LotProduit"("produitId");

-- CreateIndex
CREATE INDEX "LotProduit_numeroLot_idx" ON "LotProduit"("numeroLot");

-- CreateIndex
CREATE UNIQUE INDEX "LotProduit_produitId_numeroLot_key" ON "LotProduit"("produitId", "numeroLot");

-- CreateIndex
CREATE INDEX "MouvementStock_produitServiceId_idx" ON "MouvementStock"("produitServiceId");

-- CreateIndex
CREATE INDEX "MouvementStock_entrepotId_idx" ON "MouvementStock"("entrepotId");

-- AddForeignKey
ALTER TABLE "CategorieProduit" ADD CONSTRAINT "CategorieProduit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CategorieProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduitServiceCategorie" ADD CONSTRAINT "ProduitServiceCategorie_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "ProduitService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduitServiceCategorie" ADD CONSTRAINT "ProduitServiceCategorie_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategorieProduit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntrepot" ADD CONSTRAINT "StockEntrepot_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "ProduitService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntrepot" ADD CONSTRAINT "StockEntrepot_entrepotId_fkey" FOREIGN KEY ("entrepotId") REFERENCES "Entrepot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduitService" ADD CONSTRAINT "ProduitService_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrixFournisseur" ADD CONSTRAINT "PrixFournisseur_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "ProduitService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrixFournisseur" ADD CONSTRAINT "PrixFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrixClient" ADD CONSTRAINT "PrixClient_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "ProduitService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrixClient" ADD CONSTRAINT "PrixClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotProduit" ADD CONSTRAINT "LotProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "ProduitService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_produitServiceId_fkey" FOREIGN KEY ("produitServiceId") REFERENCES "ProduitService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_entrepotId_fkey" FOREIGN KEY ("entrepotId") REFERENCES "Entrepot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
