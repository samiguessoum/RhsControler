-- CreateEnum
CREATE TYPE "PipelineVenteStatut" AS ENUM ('VERIFICATION_STOCK', 'COMMANDE_FOURNISSEUR', 'EN_TRANSIT', 'LIVRE', 'A_ENCAISSER', 'PAYE');

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN "pipelineStatut" "PipelineVenteStatut",
ADD COLUMN "livraisonDirect" BOOLEAN NOT NULL DEFAULT false;
