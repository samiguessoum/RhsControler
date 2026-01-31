-- AlterTable
ALTER TABLE "ContratSite" ADD COLUMN     "prestations" TEXT[] DEFAULT ARRAY[]::TEXT[];
