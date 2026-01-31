import { prisma } from '../config/database.js';

/**
 * Crée une entrée dans le log d'audit
 */
export async function createAuditLog(
  userId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entity: string,
  entityId: string,
  diff?: { before?: any; after?: any }
) {
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
  } catch (error) {
    // Ne pas faire échouer l'opération principale si l'audit échoue
    console.error('Audit log error:', error);
  }
}

/**
 * Récupère l'historique d'audit pour une entité
 */
export async function getAuditHistory(entity: string, entityId: string) {
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
