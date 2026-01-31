"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
exports.getAuditHistory = getAuditHistory;
const database_js_1 = require("../config/database.js");
/**
 * Crée une entrée dans le log d'audit
 */
async function createAuditLog(userId, action, entity, entityId, diff) {
    try {
        await database_js_1.prisma.auditLog.create({
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
        console.error('Audit log error:', error);
    }
}
/**
 * Récupère l'historique d'audit pour une entité
 */
async function getAuditHistory(entity, entityId) {
    return database_js_1.prisma.auditLog.findMany({
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