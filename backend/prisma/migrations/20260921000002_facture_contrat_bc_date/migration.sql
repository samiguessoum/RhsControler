-- Lien Facture → Contrat (pour rattacher une facture à un contrat et afficher les infos contrat sur le PDF)
ALTER TABLE "Facture" ADD COLUMN IF NOT EXISTS "contratId" TEXT;
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_contratId_fkey"
  FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Facture_contratId_idx" ON "Facture"("contratId");

-- Date du bon de commande (pour afficher "Selon le BC X du DATE" sur la facture)
ALTER TABLE "BonCommande" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3);
