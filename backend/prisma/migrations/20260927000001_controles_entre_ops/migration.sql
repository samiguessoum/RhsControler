-- Nouveau champ : nombre de visites de contrôle entre chaque paire d'opérations.
-- Remplace la logique fréquence-contrôle + premiereDateControle dans le formulaire.
-- Les anciens champs sont conservés en base pour la compatibilité des données existantes.
ALTER TABLE "Contrat"     ADD COLUMN IF NOT EXISTS "nombreVisitesControleEntreOps" INTEGER;
ALTER TABLE "ContratSite" ADD COLUMN IF NOT EXISTS "nombreVisitesControleEntreOps" INTEGER;
