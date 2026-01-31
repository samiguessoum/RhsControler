-- AlterTable
ALTER TABLE "Contrat" ADD COLUMN     "nombreOperations" INTEGER,
ADD COLUMN     "numeroBonCommande" TEXT;

-- AlterTable
ALTER TABLE "Intervention" ADD COLUMN     "siteId" TEXT;

-- CreateTable
CREATE TABLE "ContratSite" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "frequenceOperations" "Frequence",
    "frequenceOperationsJours" INTEGER,
    "frequenceControle" "Frequence",
    "frequenceControleJours" INTEGER,
    "premiereDateOperation" TIMESTAMP(3),
    "premiereDateControle" TIMESTAMP(3),
    "nombreOperations" INTEGER,
    "nombreVisitesControle" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContratSite_contratId_idx" ON "ContratSite"("contratId");

-- CreateIndex
CREATE INDEX "ContratSite_siteId_idx" ON "ContratSite"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ContratSite_contratId_siteId_key" ON "ContratSite"("contratId", "siteId");

-- CreateIndex
CREATE INDEX "Intervention_siteId_idx" ON "Intervention"("siteId");

-- AddForeignKey
ALTER TABLE "ContratSite" ADD CONSTRAINT "ContratSite_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratSite" ADD CONSTRAINT "ContratSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
