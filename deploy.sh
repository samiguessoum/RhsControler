#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────
# deploy.sh — Déploiement RHS Controler en prod
# Usage : ./deploy.sh
# ─────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Vérifications préalables
[ -f ".env.prod" ] || fail "Fichier .env.prod introuvable. Copie .env.prod.example et complète-le."
[ -f "docker-compose.prod.yml" ] || fail "docker-compose.prod.yml introuvable."
command -v docker &>/dev/null || fail "Docker n'est pas installé."

log "Chargement des variables d'environnement..."
set -a; source .env.prod; set +a

[ -n "${JWT_SECRET:-}" ]       || fail "JWT_SECRET non défini dans .env.prod"
[ -n "${POSTGRES_PASSWORD:-}" ] || fail "POSTGRES_PASSWORD non défini dans .env.prod"

log "Pull du dernier code..."
git pull origin main

log "Build des images Docker..."
docker compose -f docker-compose.prod.yml build --no-cache

log "Arrêt des anciens containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans

log "Démarrage des services..."
docker compose -f docker-compose.prod.yml up -d

log "Attente que la base de données soit prête..."
sleep 5

log "Vérification de l'état des services..."
docker compose -f docker-compose.prod.yml ps

log "Nettoyage des anciennes images..."
docker image prune -f

echo ""
log "Déploiement terminé ! Application disponible sur : http://${DOMAIN:-72.62.188.28}"
