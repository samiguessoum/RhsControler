-- Refonte des rôles utilisateurs
-- Ancien : DIRECTION, PLANNING, EQUIPE, LECTURE
-- Nouveau : SUPER_ADMIN, DIRECTION, COORDINATEUR, SUPER_CHEF_EQUIPE, EQUIPE, LECTURE

-- Étape 1 : créer le nouveau type enum
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR', 'SUPER_CHEF_EQUIPE', 'EQUIPE', 'LECTURE');

-- Étape 2 : migrer la colonne en mappant les anciens rôles
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE "role"::text
      WHEN 'DIRECTION' THEN 'SUPER_ADMIN'::"Role_new"
      WHEN 'PLANNING'  THEN 'COORDINATEUR'::"Role_new"
      WHEN 'EQUIPE'    THEN 'EQUIPE'::"Role_new"
      WHEN 'LECTURE'   THEN 'LECTURE'::"Role_new"
      ELSE 'LECTURE'::"Role_new"
    END
  );

-- Étape 3 : supprimer l'ancien enum, renommer le nouveau
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- Étape 4 : mettre à jour la valeur par défaut
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'EQUIPE'::"Role";

-- Étape 5 : lien User → Employe (pour filtrer les interventions du rôle EQUIPE)
ALTER TABLE "User" ADD COLUMN "employeId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "User_employeId_key" ON "User"("employeId");
