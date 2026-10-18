-- Types de dispositifs de zoning paramétrables (remplace l'enum DeviceType)
CREATE TABLE "DeviceTypeConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "abreviation" TEXT NOT NULL,
    "emoji" TEXT,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "mode" TEXT NOT NULL DEFAULT 'APPATAGE',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceTypeConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceTypeConfig_code_key" ON "DeviceTypeConfig"("code");

INSERT INTO "DeviceTypeConfig" ("id", "code", "label", "abreviation", "emoji", "color", "mode", "ordre") VALUES
    (gen_random_uuid()::text, 'BAIT_STATION',         'Poste d''appâtage',          'BA', '🐀', '#2563eb', 'APPATAGE', 1),
    (gen_random_uuid()::text, 'MECHANICAL_TRAP',      'Piège mécanique',            'PM', '🪤', '#f97316', 'PIEGE',    2),
    (gen_random_uuid()::text, 'GLUE_TRAP',            'Boîte à colle',              'BC', '⬛', '#9333ea', 'PIEGE',    3),
    (gen_random_uuid()::text, 'FLYING_INSECT_KILLER', 'Destructeur insectes (FK)',  'FK', '⚡', '#16a34a', 'COMPTAGE', 4),
    (gen_random_uuid()::text, 'GOLIATH_GEL',          'Goliath Gel',                'GG', '🪳', '#dc2626', 'GOLIATH',  5);

ALTER TABLE "DeviceTypeConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "MonitoringDevice" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
DROP TYPE "DeviceType";
