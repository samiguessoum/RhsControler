-- Migration: Update NatureProduit enum values
-- Old values: MATIERE_PREMIERE, PRODUIT_FINI, PRODUIT_SEMI_FINI, CONSOMMABLE, PIECE_DETACHEE, AUTRE
-- New values: CONSOMMABLE, EPI, MATERIEL_ANTI_NUISIBLES

-- First, update existing records to use new values
-- Map old values to new ones (CONSOMMABLE stays, others become CONSOMMABLE by default)
UPDATE "ProduitService"
SET "nature" = 'CONSOMMABLE'
WHERE "nature" IN ('MATIERE_PREMIERE', 'PRODUIT_FINI', 'PRODUIT_SEMI_FINI', 'PIECE_DETACHEE', 'AUTRE');

-- Create new enum type
CREATE TYPE "NatureProduit_new" AS ENUM ('CONSOMMABLE', 'EPI', 'MATERIEL_ANTI_NUISIBLES');

-- Alter column to use new enum
ALTER TABLE "ProduitService"
ALTER COLUMN "nature" TYPE "NatureProduit_new"
USING ("nature"::text::"NatureProduit_new");

-- Drop old enum and rename new one
DROP TYPE "NatureProduit";
ALTER TYPE "NatureProduit_new" RENAME TO "NatureProduit";
