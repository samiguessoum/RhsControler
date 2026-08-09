import logger from '../lib/logger.js';
class CacheService {
    cache = new Map();
    defaultTTL = 5 * 60 * 1000; // 5 minutes par défaut
    /**
     * Récupère une valeur du cache
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        // Vérifier si l'entrée a expiré
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    /**
     * Stocke une valeur dans le cache
     */
    set(key, data, ttlMs) {
        const ttl = ttlMs ?? this.defaultTTL;
        const now = Date.now();
        this.cache.set(key, {
            data,
            expiresAt: now + ttl,
            createdAt: now,
        });
    }
    /**
     * Supprime une entrée du cache
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Supprime toutes les entrées correspondant à un pattern
     */
    deletePattern(pattern) {
        let count = 0;
        const regex = new RegExp(pattern.replace('*', '.*'));
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }
    /**
     * Vide tout le cache
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Récupère ou calcule une valeur (pattern cache-aside)
     */
    async getOrSet(key, factory, ttlMs) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }
        const data = await factory();
        this.set(key, data, ttlMs);
        return data;
    }
    /**
     * Nettoie les entrées expirées
     */
    cleanup() {
        const now = Date.now();
        let count = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }
    /**
     * Retourne les statistiques du cache
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }
}
// Clés de cache pour la facturation
export const CACHE_KEYS = {
    STATS_GLOBAL: (annee) => `facturation:stats:global:${annee}`,
    STATS_TVA: (annee, periode) => `facturation:stats:tva:${annee}:${periode}`,
    STATS_MARGES: (annee) => `facturation:stats:marges:${annee}`,
    STATS_TRESORERIE: (annee) => `facturation:stats:tresorerie:${annee}`,
    STATS_RETARDS: () => `facturation:stats:retards`,
    COMMANDES_FACTURABLES: () => `facturation:commandes-facturables`,
};
// Durées de cache
export const CACHE_TTL = {
    SHORT: 1 * 60 * 1000, // 1 minute
    MEDIUM: 5 * 60 * 1000, // 5 minutes
    LONG: 15 * 60 * 1000, // 15 minutes
    VERY_LONG: 60 * 60 * 1000, // 1 heure
};
// Instance singleton
export const cacheService = new CacheService();
// Nettoyage automatique toutes les 10 minutes
setInterval(() => {
    const cleaned = cacheService.cleanup();
    if (cleaned > 0) {
        logger.info(`[CACHE] Nettoyage: ${cleaned} entrées supprimées`);
    }
}, 10 * 60 * 1000);
export default cacheService;
//# sourceMappingURL=cache.service.js.map