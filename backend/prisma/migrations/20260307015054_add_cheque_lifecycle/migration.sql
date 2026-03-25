-- AlterEnum
ALTER TYPE "FactureStatut" ADD VALUE 'EN_ATTENTE_ENCAISSEMENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaiementStatut" ADD VALUE 'DEPOSE';
ALTER TYPE "PaiementStatut" ADD VALUE 'ENCAISSE';
ALTER TYPE "PaiementStatut" ADD VALUE 'REJETE';

-- AlterTable
ALTER TABLE "Facture" ADD COLUMN     "totalEnAttente" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Paiement" ADD COLUMN     "banque" TEXT,
ADD COLUMN     "dateDepot" TIMESTAMP(3),
ADD COLUMN     "dateEncaissement" TIMESTAMP(3);
