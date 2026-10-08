-- BC décompté par les opérations d'un avenant
ALTER TABLE "Avenant" ADD COLUMN "bonCommandeId" TEXT;
CREATE INDEX "Avenant_bonCommandeId_idx" ON "Avenant"("bonCommandeId");
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "BonCommande"("id") ON DELETE SET NULL ON UPDATE CASCADE;
