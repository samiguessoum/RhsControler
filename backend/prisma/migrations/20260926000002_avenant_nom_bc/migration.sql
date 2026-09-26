-- Avenant : libellé et numéro de bon de commande (repris sur la facture)
ALTER TABLE "Avenant" ADD COLUMN "nom" TEXT;
ALTER TABLE "Avenant" ADD COLUMN "numeroBonCommande" TEXT;
