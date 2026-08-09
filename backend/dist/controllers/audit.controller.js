import { prisma } from '../config/database.js';
import logger from '../lib/logger.js';
/**
 * Crée une entrée dans le log d'audit
 */
export async function createAuditLog(userId, action, entity, entityId, diff) {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entity,
                entityId,
                diff: diff ? JSON.parse(JSON.stringify(diff)) : null,
            },
        });
    }
    catch (error) {
        // Ne pas faire échouer l'opération principale si l'audit échoue
        logger.error({ err: error }, 'Audit log error');
    }
}
/**
 * Récupère l'historique d'audit pour une entité
 */
export async function getAuditHistory(entity, entityId) {
    return prisma.auditLog.findMany({
        where: { entity, entityId },
        include: {
            user: {
                select: { id: true, nom: true, prenom: true, email: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
}
//# sourceMappingURL=audit.controller.js.map