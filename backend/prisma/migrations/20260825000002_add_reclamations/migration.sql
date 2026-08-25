-- CreateEnum
CREATE TYPE "ReclamationStatut" AS ENUM ('OUVERT', 'RESOLU');

-- CreateTable
CREATE TABLE "Reclamation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentaire" TEXT NOT NULL,
    "statut" "ReclamationStatut" NOT NULL DEFAULT 'OUVERT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reclamation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reclamation_siteId_idx" ON "Reclamation"("siteId");
CREATE INDEX "Reclamation_date_idx" ON "Reclamation"("date");

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
