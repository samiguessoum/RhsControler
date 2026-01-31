-- CreateTable
CREATE TABLE "Site" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "adresse" TEXT,
  "contactNom" TEXT,
  "contactFonction" TEXT,
  "tel" TEXT,
  "email" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Site_clientId_idx" ON "Site"("clientId");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing client site/contact data into Site rows
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

INSERT INTO "Site" ("id", "clientId", "nom", "adresse", "contactNom", "contactFonction", "tel", "email", "notes", "createdAt", "updatedAt")
SELECT
  uuid_generate_v4()::text,
  c."id",
  'Site 1',
  c."siteAdresse",
  c."contactNom",
  c."contactFonction",
  c."tel",
  c."email",
  c."notes",
  c."createdAt",
  c."updatedAt"
FROM "Client" c
WHERE c."siteAdresse" IS NOT NULL
   OR c."contactNom" IS NOT NULL
   OR c."contactFonction" IS NOT NULL
   OR c."tel" IS NOT NULL
   OR c."email" IS NOT NULL
   OR c."notes" IS NOT NULL;

-- Drop old columns from Client
ALTER TABLE "Client" DROP COLUMN "siteAdresse";
ALTER TABLE "Client" DROP COLUMN "contactNom";
ALTER TABLE "Client" DROP COLUMN "contactFonction";
ALTER TABLE "Client" DROP COLUMN "tel";
ALTER TABLE "Client" DROP COLUMN "email";
ALTER TABLE "Client" DROP COLUMN "notes";
