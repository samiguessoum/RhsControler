-- AlterTable
ALTER TABLE "Facture" ADD COLUMN     "siteId" TEXT,
ADD COLUMN     "typeDocument" "TypeProduit";

-- CreateIndex
CREATE INDEX "Facture_siteId_idx" ON "Facture"("siteId");

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
