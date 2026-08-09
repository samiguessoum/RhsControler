declare class CacheService {
    private cache;
    private defaultTTL;
    /**
     * Récupère une valeur du cache
     */
    get<T>(key: string): T | null;
    /**
     * Stocke une valeur dans le cache
     */
    set<T>(key: string, data: T, ttlMs?: number): void;
    /**
     * Supprime une entrée du cache
     */
    delete(key: string): boolean;
    /**
     * Supprime toutes les entrées correspondant à un pattern
     */
    deletePattern(pattern: string): number;
    /**
     * Vide tout le cache
     */
    clear(): void;
    /**
     * Récupère ou calcule une valeur (pattern cache-aside)
     */
    getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T>;
    /**
     * Nettoie les entrées expirées
     */
    cleanup(): number;
    /**
     * Retourne les statistiques du cache
     */
    getStats(): {
        size: number;
        keys: string[];
    };
}
export declare const CACHE_KEYS: {
    STATS_GLOBAL: (annee: number) => string;
    STATS_TVA: (annee: number, periode: string) => string;
    STATS_MARGES: (annee: number) => string;
    STATS_TRESORERIE: (annee: number) => string;
    STATS_RETARDS: () => string;
    COMMANDES_FACTURABLES: () => string;
};
export declare const CACHE_TTL: {
    SHORT: number;
    MEDIUM: number;
    LONG: number;
    VERY_LONG: number;
};
export declare const cacheService: CacheService;
export default cacheService;
//# sourceMappingURL=cache.service.d.ts.map