-- Set default true for autoCreerProchaine
ALTER TABLE "Contrat" ALTER COLUMN "autoCreerProchaine" SET DEFAULT true;

-- Force existing rows to true
UPDATE "Contrat" SET "autoCreerProchaine" = true WHERE "autoCreerProchaine" = false OR "autoCreerProchaine" IS NULL;
