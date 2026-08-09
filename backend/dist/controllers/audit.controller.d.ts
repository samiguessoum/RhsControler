/**
 * Crée une entrée dans le log d'audit
 */
export declare function createAuditLog(userId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', entity: string, entityId: string, diff?: {
    before?: any;
    after?: any;
}): Promise<void>;
/**
 * Récupère l'historique d'audit pour une entité
 */
export declare function getAuditHistory(entity: string, entityId: string): Promise<({
    user: {
        id: string;
        email: string;
        nom: string;
        prenom: string;
    };
} & {
    id: string;
    createdAt: Date;
    action: string;
    entity: string;
    entityId: string;
    diff: import("@prisma/client/runtime/library").JsonValue | null;
    userId: string;
})[]>;
//# sourceMappingURL=audit.controller.d.ts.map