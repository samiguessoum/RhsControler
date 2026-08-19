-- Migration: suppression de l'enum Frequence — on utilise uniquement des nombres de jours

ALTER TABLE "Contrat"
  DROP COLUMN IF EXISTS "frequenceOperations",
  DROP COLUMN IF EXISTS "frequenceControle";

ALTER TABLE "ContratSite"
  DROP COLUMN IF EXISTS "frequenceOperations",
  DROP COLUMN IF EXISTS "frequenceControle";

DROP TYPE IF EXISTS "Frequence";
