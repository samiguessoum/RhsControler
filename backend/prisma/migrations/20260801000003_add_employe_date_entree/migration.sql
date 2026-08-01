-- Ajoute la date d'entree dans l'entreprise (utilisee pour le calcul des conges acquis)
ALTER TABLE "Employe" ADD COLUMN "dateEntree" TIMESTAMP(3);

-- Modele RecuperationAccordee present dans schema.prisma mais jamais materialise en base
CREATE TABLE IF NOT EXISTS "RecuperationAccordee" (
  "id"            TEXT NOT NULL,
  "employeId"     TEXT NOT NULL,
  "nbJours"       DOUBLE PRECISION NOT NULL,
  "motif"         TEXT,
  "dateAccordee"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accordeeParId" TEXT,
  "annee"         INTEGER NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecuperationAccordee_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RecuperationAccordee"
  ADD CONSTRAINT "RecuperationAccordee_employeId_fkey"
    FOREIGN KEY ("employeId") REFERENCES "Employe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "RecuperationAccordee_employeId_idx" ON "RecuperationAccordee"("employeId");
CREATE INDEX IF NOT EXISTS "RecuperationAccordee_annee_idx"     ON "RecuperationAccordee"("annee");
