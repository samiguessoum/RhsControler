-- Visites de contrôle masquées car couvertes par une opération (réversible)
ALTER TABLE "Intervention" ADD COLUMN "remplaceeParOperation" BOOLEAN NOT NULL DEFAULT false;
