-- Migration: Avenant (contrats ponctuels) + lien Intervention.avenantId

-- ============ ALTER TABLE Intervention ============
ALTER TABLE "Intervention" ADD COLUMN "avenantId" TEXT;

-- ============ CREATE TABLE Avenant ============
CREATE TABLE "Avenant" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "dateSignature" TIMESTAMP(3),
    "montantHT" NUMERIC(15,2),
    "nombreOperationsSupplementaires" INTEGER NOT NULL DEFAULT 0,
    "nombreVisitesControleSupplementaires" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avenant_pkey" PRIMARY KEY ("id")
);

-- ============ UNIQUE INDEXES ============
CREATE UNIQUE INDEX "Avenant_contratId_numero_key" ON "Avenant"("contratId", "numero");

-- ============ REGULAR INDEXES ============
CREATE INDEX "Avenant_contratId_idx" ON "Avenant"("contratId");
CREATE INDEX "Intervention_avenantId_idx" ON "Intervention"("avenantId");

-- ============ FOREIGN KEYS ============
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_avenantId_fkey" FOREIGN KEY ("avenantId") REFERENCES "Avenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
