-- Type de dispositif compté ou non dans les statistiques / graphes des rapports de tendances
ALTER TABLE "DeviceTypeConfig" ADD COLUMN "inclureTendances" BOOLEAN NOT NULL DEFAULT true;
UPDATE "DeviceTypeConfig" SET "inclureTendances" = false WHERE "mode" = 'GOLIATH';
