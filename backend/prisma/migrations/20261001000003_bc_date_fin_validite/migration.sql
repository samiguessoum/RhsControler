-- Fin de validité du bon de commande (alerte à l'approche de l'échéance)
ALTER TABLE "BonCommande" ADD COLUMN IF NOT EXISTS "dateFinValidite" TIMESTAMP(3);
