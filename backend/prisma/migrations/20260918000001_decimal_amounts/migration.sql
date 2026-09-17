-- Migration: Float → Decimal(15,2) pour les montants métier
ALTER TABLE "Contrat" ALTER COLUMN "montantHT" TYPE NUMERIC(15,2) USING "montantHT"::NUMERIC(15,2);
ALTER TABLE "ContratSite" ALTER COLUMN "montantHT" TYPE NUMERIC(15,2) USING "montantHT"::NUMERIC(15,2);
ALTER TABLE "Intervention" ALTER COLUMN "montantApplique" TYPE NUMERIC(15,2) USING "montantApplique"::NUMERIC(15,2);
