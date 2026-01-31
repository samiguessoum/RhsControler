-- Add legal identifiers to Client siege
ALTER TABLE "Client" ADD COLUMN "siegeRC" TEXT;
ALTER TABLE "Client" ADD COLUMN "siegeNIF" TEXT;
ALTER TABLE "Client" ADD COLUMN "siegeAI" TEXT;
ALTER TABLE "Client" ADD COLUMN "siegeNIS" TEXT;
ALTER TABLE "Client" ADD COLUMN "siegeTIN" TEXT;
