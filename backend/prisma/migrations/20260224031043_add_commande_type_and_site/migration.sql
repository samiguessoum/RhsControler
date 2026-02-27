-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "siteId" TEXT,
ADD COLUMN     "typeDocument" "TypeProduit";

-- CreateIndex
CREATE INDEX "Commande_siteId_idx" ON "Commande"("siteId");

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
