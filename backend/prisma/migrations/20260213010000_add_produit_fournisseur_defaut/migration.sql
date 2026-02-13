-- CreateTable
CREATE TABLE "ProduitFournisseurDefaut" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProduitFournisseurDefaut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProduitFournisseurDefaut_produitId_idx" ON "ProduitFournisseurDefaut"("produitId");

-- CreateIndex
CREATE INDEX "ProduitFournisseurDefaut_fournisseurId_idx" ON "ProduitFournisseurDefaut"("fournisseurId");

-- CreateIndex
CREATE INDEX "ProduitFournisseurDefaut_ordre_idx" ON "ProduitFournisseurDefaut"("ordre");

-- CreateIndex
CREATE UNIQUE INDEX "ProduitFournisseurDefaut_produitId_fournisseurId_key" ON "ProduitFournisseurDefaut"("produitId", "fournisseurId");

-- AddForeignKey
ALTER TABLE "ProduitFournisseurDefaut" ADD CONSTRAINT "ProduitFournisseurDefaut_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "ProduitService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduitFournisseurDefaut" ADD CONSTRAINT "ProduitFournisseurDefaut_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing fournisseurId to new table
INSERT INTO "ProduitFournisseurDefaut" ("id", "produitId", "fournisseurId", "ordre", "createdAt")
SELECT gen_random_uuid(), "id", "fournisseurId", 1, NOW()
FROM "ProduitService"
WHERE "fournisseurId" IS NOT NULL;
