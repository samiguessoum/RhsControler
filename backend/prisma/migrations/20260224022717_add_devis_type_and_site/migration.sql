-- AlterTable
ALTER TABLE "Devis" ADD COLUMN     "siteId" TEXT,
ADD COLUMN     "typeDocument" "TypeProduit";

-- CreateIndex
CREATE INDEX "Devis_siteId_idx" ON "Devis"("siteId");

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
