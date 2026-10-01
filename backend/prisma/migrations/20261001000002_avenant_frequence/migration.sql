-- Fréquence propre à un avenant et ses périodes saisonnières
ALTER TABLE "Avenant" ADD COLUMN "frequenceOperationsJours" INTEGER;
ALTER TABLE "Avenant" ADD COLUMN "frequenceOperationsMois" INTEGER;
ALTER TABLE "Avenant" ADD COLUMN "periodesFrequence" JSONB NOT NULL DEFAULT '[]';
