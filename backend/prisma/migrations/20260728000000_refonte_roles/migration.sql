-- Refonte des rôles utilisateurs
-- ADD VALUE (pas de DROP TYPE) pour éviter les conflits avec les valeurs DEFAULT

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COORDINATEUR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_CHEF_EQUIPE';

-- Migrer les anciens rôles
UPDATE "User" SET "role" = 'SUPER_ADMIN' WHERE "role" = 'DIRECTION';
UPDATE "User" SET "role" = 'COORDINATEUR' WHERE "role" = 'PLANNING';

-- Lien User → Employe pour filtrer les interventions du rôle EQUIPE
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employeId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_employeId_fkey"
  FOREIGN KEY ("employeId") REFERENCES "Employe"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "User_employeId_key" ON "User"("employeId");
