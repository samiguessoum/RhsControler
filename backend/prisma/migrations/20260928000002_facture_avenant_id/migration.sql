-- AlterTable: ajouter avenantId sur Facture
ALTER TABLE "Facture" ADD COLUMN "avenantId" TEXT;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_avenantId_fkey" FOREIGN KEY ("avenantId") REFERENCES "Avenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Facture_avenantId_idx" ON "Facture"("avenantId");
