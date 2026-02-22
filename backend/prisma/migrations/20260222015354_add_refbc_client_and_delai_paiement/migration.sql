-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "refBonCommandeClient" TEXT;

-- AlterTable
ALTER TABLE "Facture" ADD COLUMN     "delaiPaiementJours" INTEGER DEFAULT 45;
