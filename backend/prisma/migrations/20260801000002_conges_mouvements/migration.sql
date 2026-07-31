-- Ajout des colonnes manquantes sur SoldeConge
ALTER TABLE "SoldeConge"
  ADD COLUMN IF NOT EXISTS "joursReportes"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "joursIndemnises" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Nouveau modele MouvementConge
CREATE TABLE IF NOT EXISTS "MouvementConge" (
  "id"         TEXT NOT NULL,
  "employeId"  TEXT NOT NULL,
  "typeOp"     TEXT NOT NULL,
  "jours"      DOUBLE PRECISION NOT NULL,
  "sens"       TEXT NOT NULL,
  "soldeApres" DOUBLE PRECISION NOT NULL,
  "motif"      TEXT,
  "annee"      INTEGER NOT NULL,
  "mois"       INTEGER,
  "auteurId"   TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MouvementConge_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MouvementConge"
  ADD CONSTRAINT "MouvementConge_employeId_fkey"
    FOREIGN KEY ("employeId") REFERENCES "Employe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MouvementConge"
  ADD CONSTRAINT "MouvementConge_auteurId_fkey"
    FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "MouvementConge_employeId_idx" ON "MouvementConge"("employeId");
CREATE INDEX IF NOT EXISTS "MouvementConge_annee_idx"     ON "MouvementConge"("annee");
