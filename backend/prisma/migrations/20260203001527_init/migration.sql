/*
  Warnings:

  - You are about to drop the column `contactFonction` on the `Site` table. All the data in the column will be lost.
  - You are about to drop the column `contactNom` on the `Site` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `Client` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TypeTiers" AS ENUM ('CLIENT', 'FOURNISSEUR', 'PROSPECT', 'CLIENT_FOURNISSEUR');

-- CreateEnum
CREATE TYPE "FormeJuridique" AS ENUM ('SARL', 'EURL', 'SPA', 'SNC', 'AUTO_ENTREPRENEUR', 'ASSOCIATION', 'PARTICULIER', 'AUTRE');

-- CreateEnum
CREATE TYPE "Civilite" AS ENUM ('M', 'MME', 'MLLE');

-- CreateEnum
CREATE TYPE "TypeAdresse" AS ENUM ('SIEGE', 'FACTURATION', 'LIVRAISON', 'SITE');

-- DropForeignKey
ALTER TABLE "SiegeContact" DROP CONSTRAINT "SiegeContact_clientId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "capital" DOUBLE PRECISION,
ADD COLUMN     "categorie" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "codeComptaClient" TEXT,
ADD COLUMN     "codeComptaFournisseur" TEXT,
ADD COLUMN     "conditionPaiementId" TEXT,
ADD COLUMN     "dateCreation" TIMESTAMP(3),
ADD COLUMN     "devise" TEXT DEFAULT 'DZD',
ADD COLUMN     "encoursMaximum" DOUBLE PRECISION,
ADD COLUMN     "formeJuridique" "FormeJuridique",
ADD COLUMN     "modePaiementId" TEXT,
ADD COLUMN     "nomAlias" TEXT,
ADD COLUMN     "notePrivee" TEXT,
ADD COLUMN     "notePublique" TEXT,
ADD COLUMN     "prospectNiveau" INTEGER DEFAULT 0,
ADD COLUMN     "prospectStatut" TEXT,
ADD COLUMN     "remiseParDefaut" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "siegeCodePostal" TEXT,
ADD COLUMN     "siegeFax" TEXT,
ADD COLUMN     "siegePays" TEXT DEFAULT 'Algérie',
ADD COLUMN     "siegeVille" TEXT,
ADD COLUMN     "siegeWebsite" TEXT,
ADD COLUMN     "tvaIntracom" TEXT,
ADD COLUMN     "typeTiers" "TypeTiers" NOT NULL DEFAULT 'CLIENT';

-- AlterTable
ALTER TABLE "SiegeContact" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "civilite" "Civilite",
ADD COLUMN     "dateNaissance" TIMESTAMP(3),
ADD COLUMN     "estPrincipal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "prenom" TEXT,
ADD COLUMN     "telMobile" TEXT,
ALTER COLUMN "tel" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Site" DROP COLUMN "contactFonction",
DROP COLUMN "contactNom",
ADD COLUMN     "accessibilite" TEXT,
ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "codePostal" TEXT,
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "horairesOuverture" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "pays" TEXT DEFAULT 'Algérie',
ADD COLUMN     "ville" TEXT;

-- CreateTable
CREATE TABLE "ModePaiement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModePaiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionPaiement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "nbJours" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConditionPaiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adresse" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "TypeAdresse" NOT NULL DEFAULT 'SITE',
    "libelle" TEXT,
    "adresse" TEXT,
    "complement" TEXT,
    "codePostal" TEXT,
    "ville" TEXT,
    "pays" TEXT DEFAULT 'Algérie',
    "contactNom" TEXT,
    "contactTel" TEXT,
    "contactEmail" TEXT,
    "estDefaut" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adresse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompteBancaire" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "banque" TEXT NOT NULL,
    "agence" TEXT,
    "codeBanque" TEXT,
    "codeGuichet" TEXT,
    "numeroCompte" TEXT,
    "cleRib" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "titulaire" TEXT,
    "devise" TEXT DEFAULT 'DZD',
    "estDefaut" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompteBancaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteContact" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "civilite" "Civilite",
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "fonction" TEXT,
    "tel" TEXT,
    "telMobile" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "estPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModePaiement_code_key" ON "ModePaiement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionPaiement_code_key" ON "ConditionPaiement"("code");

-- CreateIndex
CREATE INDEX "Adresse_clientId_idx" ON "Adresse"("clientId");

-- CreateIndex
CREATE INDEX "Adresse_type_idx" ON "Adresse"("type");

-- CreateIndex
CREATE INDEX "CompteBancaire_clientId_idx" ON "CompteBancaire"("clientId");

-- CreateIndex
CREATE INDEX "SiteContact_siteId_idx" ON "SiteContact"("siteId");

-- CreateIndex
CREATE INDEX "SiteContact_nom_idx" ON "SiteContact"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- CreateIndex
CREATE INDEX "Client_typeTiers_idx" ON "Client"("typeTiers");

-- CreateIndex
CREATE INDEX "Client_code_idx" ON "Client"("code");

-- CreateIndex
CREATE INDEX "Client_nomEntreprise_idx" ON "Client"("nomEntreprise");

-- CreateIndex
CREATE INDEX "SiegeContact_nom_idx" ON "SiegeContact"("nom");

-- CreateIndex
CREATE INDEX "Site_code_idx" ON "Site"("code");

-- CreateIndex
CREATE INDEX "Site_ville_idx" ON "Site"("ville");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_modePaiementId_fkey" FOREIGN KEY ("modePaiementId") REFERENCES "ModePaiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_conditionPaiementId_fkey" FOREIGN KEY ("conditionPaiementId") REFERENCES "ConditionPaiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiegeContact" ADD CONSTRAINT "SiegeContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adresse" ADD CONSTRAINT "Adresse_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteBancaire" ADD CONSTRAINT "CompteBancaire_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteContact" ADD CONSTRAINT "SiteContact_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
