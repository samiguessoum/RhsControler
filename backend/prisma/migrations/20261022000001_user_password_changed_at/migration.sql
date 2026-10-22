-- Date du dernier changement de mot de passe : invalide les sessions (JWT) émises avant
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
