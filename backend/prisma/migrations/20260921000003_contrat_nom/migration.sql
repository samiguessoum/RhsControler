-- Nom/libellé libre du contrat (ex: "Contrat annuel dératisation 2026 - Site Alger")
ALTER TABLE "Contrat" ADD COLUMN IF NOT EXISTS "nom" TEXT;
