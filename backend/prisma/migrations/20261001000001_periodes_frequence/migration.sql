-- Périodes à fréquence saisonnière par site de contrat
ALTER TABLE "ContratSite" ADD COLUMN "periodesFrequence" JSONB NOT NULL DEFAULT '[]';
