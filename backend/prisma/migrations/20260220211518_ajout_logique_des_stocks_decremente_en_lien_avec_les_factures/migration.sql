-- AlterEnum
ALTER TYPE "FactureType" ADD VALUE 'ACOMPTE';

-- AlterTable
ALTER TABLE "Facture" ADD COLUMN     "factureFinaleId" TEXT;

-- CreateIndex
CREATE INDEX "Facture_factureFinaleId_idx" ON "Facture"("factureFinaleId");

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_factureFinaleId_fkey" FOREIGN KEY ("factureFinaleId") REFERENCES "Facture"("id") ON DELETE SET NULL ON UPDATE CASCADE;
