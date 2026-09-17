-- Migration: BonCommande, BonCommandeSite, nouveaux champs Contrat/ContratSite/Intervention

-- ============ ALTER TABLE Contrat ============
ALTER TABLE "Contrat" ADD COLUMN "refExterne" TEXT;
ALTER TABLE "Contrat" ADD COLUMN "dateSignature" TIMESTAMP(3);
ALTER TABLE "Contrat" ADD COLUMN "montantHT" DOUBLE PRECISION;
ALTER TABLE "Contrat" ADD COLUMN "dureeType" TEXT;
ALTER TABLE "Contrat" ADD COLUMN "frequenceRegles" TEXT;
ALTER TABLE "Contrat" ADD COLUMN "frequenceReglesControle" TEXT;
ALTER TABLE "Contrat" ADD COLUMN "frequenceOperationsMois" INTEGER;
ALTER TABLE "Contrat" ADD COLUMN "frequenceControleMois" INTEGER;
ALTER TABLE "Contrat" ADD COLUMN "planningAajuster" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contrat" ADD COLUMN "datePriseEnComptePlanification" TIMESTAMP(3);
ALTER TABLE "Contrat" ADD COLUMN "nombrePassagesAnnuels" INTEGER;

-- Unique index on refExterne
CREATE UNIQUE INDEX "Contrat_refExterne_key" ON "Contrat"("refExterne");

-- ============ ALTER TABLE ContratSite ============
ALTER TABLE "ContratSite" ADD COLUMN "montantHT" DOUBLE PRECISION;
ALTER TABLE "ContratSite" ADD COLUMN "frequenceRegles" TEXT;
ALTER TABLE "ContratSite" ADD COLUMN "frequenceOperationsMois" INTEGER;
ALTER TABLE "ContratSite" ADD COLUMN "frequenceControleMois" INTEGER;
ALTER TABLE "ContratSite" ADD COLUMN "nombrePassagesAnnuels" INTEGER;

-- ============ ALTER TABLE Intervention ============
ALTER TABLE "Intervention" ADD COLUMN "bonCommandeId" TEXT;
ALTER TABLE "Intervention" ADD COLUMN "montantApplique" DOUBLE PRECISION;
ALTER TABLE "Intervention" ADD COLUMN "estPassageContractuel" BOOLEAN NOT NULL DEFAULT true;

-- ============ CREATE TABLE BonCommande ============
CREATE TABLE "BonCommande" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contratId" TEXT,
    "quotaPassages" INTEGER,
    "passagesConsommes" INTEGER NOT NULL DEFAULT 0,
    "seuilAlerte" INTEGER NOT NULL DEFAULT 2,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonCommande_pkey" PRIMARY KEY ("id")
);

-- ============ CREATE TABLE BonCommandeSite ============
CREATE TABLE "BonCommandeSite" (
    "id" TEXT NOT NULL,
    "bcId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "BonCommandeSite_pkey" PRIMARY KEY ("id")
);

-- ============ UNIQUE INDEXES ============
CREATE UNIQUE INDEX "BonCommande_numero_clientId_key" ON "BonCommande"("numero", "clientId");
CREATE UNIQUE INDEX "BonCommandeSite_bcId_siteId_key" ON "BonCommandeSite"("bcId", "siteId");

-- ============ REGULAR INDEXES ============
CREATE INDEX "BonCommande_clientId_idx" ON "BonCommande"("clientId");
CREATE INDEX "BonCommandeSite_bcId_idx" ON "BonCommandeSite"("bcId");
CREATE INDEX "BonCommandeSite_siteId_idx" ON "BonCommandeSite"("siteId");
CREATE INDEX "Intervention_bonCommandeId_idx" ON "Intervention"("bonCommandeId");

-- ============ FOREIGN KEYS ============
ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BonCommandeSite" ADD CONSTRAINT "BonCommandeSite_bcId_fkey" FOREIGN KEY ("bcId") REFERENCES "BonCommande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BonCommandeSite" ADD CONSTRAINT "BonCommandeSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "BonCommande"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContratSite" ADD COLUMN IF NOT EXISTS "frequenceReglesControle" TEXT;
