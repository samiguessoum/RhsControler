-- CreateTable
CREATE TABLE "InterventionEmploye" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "posteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionEmploye_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterventionEmploye_interventionId_idx" ON "InterventionEmploye"("interventionId");

-- CreateIndex
CREATE INDEX "InterventionEmploye_employeId_idx" ON "InterventionEmploye"("employeId");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionEmploye_interventionId_employeId_posteId_key" ON "InterventionEmploye"("interventionId", "employeId", "posteId");

-- AddForeignKey
ALTER TABLE "InterventionEmploye" ADD CONSTRAINT "InterventionEmploye_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionEmploye" ADD CONSTRAINT "InterventionEmploye_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionEmploye" ADD CONSTRAINT "InterventionEmploye_posteId_fkey" FOREIGN KEY ("posteId") REFERENCES "Poste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
