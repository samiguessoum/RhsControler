-- AlterTable: snapshot des fiches techniques (nom + url) au moment de la création du document
ALTER TABLE "DevisLigne" ADD COLUMN "fichesTechniques" JSONB;
ALTER TABLE "CommandeLigne" ADD COLUMN "fichesTechniques" JSONB;
ALTER TABLE "FactureLigne" ADD COLUMN "fichesTechniques" JSONB;
