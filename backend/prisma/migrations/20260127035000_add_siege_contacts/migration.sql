-- CreateTable
CREATE TABLE "SiegeContact" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "fonction" TEXT NOT NULL,
  "tel" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SiegeContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiegeContact_clientId_idx" ON "SiegeContact"("clientId");

-- AddForeignKey
ALTER TABLE "SiegeContact" ADD CONSTRAINT "SiegeContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing siege contact fields into SiegeContact
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

INSERT INTO "SiegeContact" ("id", "clientId", "nom", "fonction", "tel", "email", "createdAt", "updatedAt")
SELECT
  uuid_generate_v4()::text,
  c."id",
  COALESCE(c."siegeContactNom", 'Contact'),
  COALESCE(c."siegeContactFonction", ''),
  COALESCE(c."siegeTel", ''),
  COALESCE(c."siegeEmail", ''),
  c."createdAt",
  c."updatedAt"
FROM "Client" c
WHERE c."siegeContactNom" IS NOT NULL
   OR c."siegeContactFonction" IS NOT NULL
   OR c."siegeTel" IS NOT NULL
   OR c."siegeEmail" IS NOT NULL;

-- Drop old columns from Client
ALTER TABLE "Client" DROP COLUMN "siegeContactNom";
ALTER TABLE "Client" DROP COLUMN "siegeContactFonction";
