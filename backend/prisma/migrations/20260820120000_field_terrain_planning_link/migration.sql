-- DropForeignKey
ALTER TABLE "FieldReport" DROP CONSTRAINT "FieldReport_fieldInterventionId_fkey";

-- DropIndex
DROP INDEX "FieldReport_fieldInterventionId_version_key";

-- AlterTable
ALTER TABLE "FieldIntervention" ADD COLUMN     "contratId" TEXT,
ADD COLUMN     "interventionId" TEXT;

-- AlterTable
ALTER TABLE "FieldReport" ADD COLUMN     "dateDebut" TIMESTAMP(3),
ADD COLUMN     "dateFin" TIMESTAMP(3),
ADD COLUMN     "siteId" TEXT,
ALTER COLUMN "fieldInterventionId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "FieldIntervention_interventionId_key" ON "FieldIntervention"("interventionId");

-- CreateIndex
CREATE INDEX "FieldIntervention_contratId_idx" ON "FieldIntervention"("contratId");

-- CreateIndex
CREATE INDEX "FieldReport_siteId_idx" ON "FieldReport"("siteId");

-- AddForeignKey
ALTER TABLE "FieldIntervention" ADD CONSTRAINT "FieldIntervention_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldIntervention" ADD CONSTRAINT "FieldIntervention_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_fieldInterventionId_fkey" FOREIGN KEY ("fieldInterventionId") REFERENCES "FieldIntervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

