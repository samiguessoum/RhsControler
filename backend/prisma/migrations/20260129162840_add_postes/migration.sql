-- CreateTable
CREATE TABLE "Employe" (
    "id" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poste" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EmployeToPoste" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Poste_nom_key" ON "Poste"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "_EmployeToPoste_AB_unique" ON "_EmployeToPoste"("A", "B");

-- CreateIndex
CREATE INDEX "_EmployeToPoste_B_index" ON "_EmployeToPoste"("B");

-- AddForeignKey
ALTER TABLE "_EmployeToPoste" ADD CONSTRAINT "_EmployeToPoste_A_fkey" FOREIGN KEY ("A") REFERENCES "Employe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmployeToPoste" ADD CONSTRAINT "_EmployeToPoste_B_fkey" FOREIGN KEY ("B") REFERENCES "Poste"("id") ON DELETE CASCADE ON UPDATE CASCADE;
