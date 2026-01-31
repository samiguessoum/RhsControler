-- Add siege fields to Client
ALTER TABLE "Client" ADD COLUMN "siegeNom" TEXT;
ALTER TABLE "Client" ADD COLUMN "siegeAdresse" TEXT;
ALTER TABLE "Client" ADD COLUMN "siegeContactNom" TEXT;
ALTER TABLE "Client" ADD COLUMN "siegeContactFonction" TEXT;
ALTER TABLE "Client" ADD COLUMN "siegeTel" TEXT;
ALTER TABLE "Client" ADD COLUMN "siegeEmail" TEXT;
ALTER TABLE "Client" ADD COLUMN "siegeNotes" TEXT;

-- Backfill siegeNom for existing rows
UPDATE "Client" SET "siegeNom" = COALESCE("siegeNom", "nomEntreprise") WHERE "siegeNom" IS NULL;

-- Make siegeNom required
ALTER TABLE "Client" ALTER COLUMN "siegeNom" SET NOT NULL;
