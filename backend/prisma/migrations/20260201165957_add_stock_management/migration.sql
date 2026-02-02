-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('ENTREE', 'SORTIE', 'AJUSTEMENT');

-- CreateTable
CREATE TABLE "Produit" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "unite" TEXT NOT NULL DEFAULT 'unité',
    "quantite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMinimum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prixUnitaire" DOUBLE PRECISION,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementStock" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "quantiteAvant" DOUBLE PRECISION NOT NULL,
    "quantiteApres" DOUBLE PRECISION NOT NULL,
    "motif" TEXT,
    "interventionId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Produit_reference_key" ON "Produit"("reference");

-- CreateIndex
CREATE INDEX "Produit_reference_idx" ON "Produit"("reference");

-- CreateIndex
CREATE INDEX "Produit_nom_idx" ON "Produit"("nom");

-- CreateIndex
CREATE INDEX "MouvementStock_produitId_idx" ON "MouvementStock"("produitId");

-- CreateIndex
CREATE INDEX "MouvementStock_interventionId_idx" ON "MouvementStock"("interventionId");

-- CreateIndex
CREATE INDEX "MouvementStock_userId_idx" ON "MouvementStock"("userId");

-- CreateIndex
CREATE INDEX "MouvementStock_createdAt_idx" ON "MouvementStock"("createdAt");

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
