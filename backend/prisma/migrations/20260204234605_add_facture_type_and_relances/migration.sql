-- CreateEnum
CREATE TYPE "FactureType" AS ENUM ('FACTURE', 'AVOIR');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'FACTURE_AVOIR';

-- AlterTable
ALTER TABLE "Facture" ADD COLUMN     "type" "FactureType" NOT NULL DEFAULT 'FACTURE';

-- CreateTable
CREATE TABLE "FactureRelance" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "niveau" INTEGER NOT NULL DEFAULT 1,
    "canal" TEXT NOT NULL,
    "commentaire" TEXT,
    "dateRelance" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactureRelance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactureRelance_factureId_idx" ON "FactureRelance"("factureId");

-- CreateIndex
CREATE INDEX "FactureRelance_dateRelance_idx" ON "FactureRelance"("dateRelance");

-- CreateIndex
CREATE INDEX "Facture_type_idx" ON "Facture"("type");

-- AddForeignKey
ALTER TABLE "FactureRelance" ADD CONSTRAINT "FactureRelance_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureRelance" ADD CONSTRAINT "FactureRelance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
