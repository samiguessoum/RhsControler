-- Sites du contrat concernés par un avenant (vide = tous les sites du contrat)
ALTER TABLE "Avenant" ADD COLUMN "siteIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
