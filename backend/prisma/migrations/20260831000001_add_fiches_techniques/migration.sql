-- CreateTable FicheTechnique (plusieurs fiches par produit)
CREATE TABLE "FicheTechnique" (
    "id"        TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "nom"       TEXT NOT NULL,
    "filename"  TEXT NOT NULL,
    "path"      TEXT NOT NULL,
    "taille"    INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FicheTechnique_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FicheTechnique_produitId_idx" ON "FicheTechnique"("produitId");

ALTER TABLE "FicheTechnique"
    ADD CONSTRAINT "FicheTechnique_produitId_fkey"
    FOREIGN KEY ("produitId") REFERENCES "ProduitService"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
