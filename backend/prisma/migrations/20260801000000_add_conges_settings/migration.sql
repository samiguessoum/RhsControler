-- Ajout des paramètres de politique de congés dans CompanySettings
ALTER TABLE "CompanySettings"
  ADD COLUMN IF NOT EXISTS "modeAllocationConges" TEXT NOT NULL DEFAULT 'ANNUEL',
  ADD COLUMN IF NOT EXISTS "joursCongesAnnuels" DOUBLE PRECISION NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "joursCongesMensuels" DOUBLE PRECISION NOT NULL DEFAULT 2.5;
