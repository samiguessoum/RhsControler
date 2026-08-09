import { prisma } from '../config/database.js';
import { createAuditLog } from './audit.controller.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
const DEFAULT_PREFIX = 'PD';
function parseDate(value) {
    if (!value)
        return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
// Génère une référence au format: PRÉFIXE0000/2026
async function generateReference(date) {
    const annee = date.getFullYear();
    // Récupérer les paramètres de numérotation
    const settings = await prisma.companySettings.findFirst();
    const prefix = DEFAULT_PREFIX; // Pas de préfixe configurable pour paiements divers
    const longueur = settings?.longueurNumero || 4;
    const separateur = settings?.separateur ?? '/';
    const inclureAnnee = settings?.inclureAnnee ?? true;
    const counter = await prisma.compteurDocument.upsert({
        where: { type_annee: { type: 'PAIEMENT_DIVERS', annee } },
        update: { prochainNumero: { increment: 1 } },
        create: { type: 'PAIEMENT_DIVERS', annee, prochainNumero: 2 },
        select: { prochainNumero: true },
    });
    const numero = counter.prochainNumero - 1;
    const numeroFormate = String(numero).padStart(longueur, '0');
    // Format: PRÉFIXE0000/2026 (préfixe + numéro + séparateur + année)
    if (inclureAnnee) {
        return `${prefix}${numeroFormate}${separateur}${annee}`;
    }
    return `${prefix}${numeroFormate}`;
}
export const paiementDiversController = {
    // Liste des paiements divers
    async list(req, res, next) {
        try {
            const { search, typeOperation, categorie, tiersId, dateDebut, dateFin, page = '1', limit = '50', } = req.query;
            const where = {};
            if (typeOperation)
                where.typeOperation = typeOperation;
            if (categorie)
                where.categorie = categorie;
            if (tiersId)
                where.tiersId = tiersId;
            if (search) {
                where.OR = [
                    { ref: { contains: search, mode: 'insensitive' } },
                    { libelle: { contains: search, mode: 'insensitive' } },
                    { tiers: { nomEntreprise: { contains: search, mode: 'insensitive' } } },
                ];
            }
            if (dateDebut || dateFin) {
                where.datePaiement = {};
                if (dateDebut)
                    where.datePaiement.gte = new Date(dateDebut);
                if (dateFin)
                    where.datePaiement.lte = new Date(dateFin);
            }
            const pageNum = parseInt(page) || 1;
            const limitNum = Math.min(parseInt(limit) || 50, 200);
            const skip = (pageNum - 1) * limitNum;
            const [paiements, total] = await Promise.all([
                prisma.paiementDivers.findMany({
                    where,
                    skip,
                    take: limitNum,
                    orderBy: { datePaiement: 'desc' },
                    include: {
                        tiers: { select: { id: true, nomEntreprise: true, code: true } },
                        modePaiement: { select: { id: true, libelle: true } },
                    },
                }),
                prisma.paiementDivers.count({ where }),
            ]);
            res.json({
                paiements,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            });
        }
        catch (error) {
            logger.error({ err: error }, 'List paiements divers error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    // Détail d'un paiement
    async get(req, res, next) {
        try {
            const { id } = req.params;
            const paiement = await prisma.paiementDivers.findUnique({
                where: { id },
                include: {
                    tiers: { select: { id: true, nomEntreprise: true, code: true, siegeEmail: true } },
                    modePaiement: { select: { id: true, libelle: true } },
                },
            });
            if (!paiement) {
                return res.status(404).json({ error: 'Paiement divers non trouvé' });
            }
            res.json({ paiement });
        }
        catch (error) {
            logger.error({ err: error }, 'Get paiement divers error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    // Créer un paiement divers
    async create(req, res, next) {
        try {
            const data = req.body;
            // Vérifier le tiers si fourni
            if (data.tiersId) {
                const tiers = await prisma.client.findUnique({
                    where: { id: data.tiersId },
                });
                if (!tiers || !tiers.actif) {
                    return res.status(400).json({ error: 'Tiers non trouvé ou inactif' });
                }
            }
            const datePaiement = parseDate(data.datePaiement) ?? new Date();
            const ref = data.ref || (await generateReference(datePaiement));
            const paiement = await prisma.paiementDivers.create({
                data: {
                    ref,
                    libelle: data.libelle,
                    description: data.description,
                    typeOperation: data.typeOperation,
                    categorie: data.categorie,
                    tiersId: data.tiersId,
                    montant: Number(data.montant),
                    datePaiement,
                    modePaiementId: data.modePaiementId,
                    reference: data.reference,
                    banque: data.banque,
                    notes: data.notes,
                    createdById: req.user?.id,
                },
                include: {
                    tiers: { select: { id: true, nomEntreprise: true } },
                    modePaiement: { select: { id: true, libelle: true } },
                },
            });
            await createAuditLog(req.user.id, 'CREATE', 'PaiementDivers', paiement.id, { after: paiement });
            res.status(201).json({ paiement });
        }
        catch (error) {
            logger.error({ err: error }, 'Create paiement divers error');
            return next(new AppError(500, 'Erreur lors de la création du paiement divers'));
        }
    },
    // Mettre à jour un paiement divers
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const data = req.body;
            const existing = await prisma.paiementDivers.findUnique({
                where: { id },
            });
            if (!existing) {
                return res.status(404).json({ error: 'Paiement divers non trouvé' });
            }
            // Vérifier le tiers si fourni
            if (data.tiersId) {
                const tiers = await prisma.client.findUnique({
                    where: { id: data.tiersId },
                });
                if (!tiers || !tiers.actif) {
                    return res.status(400).json({ error: 'Tiers non trouvé ou inactif' });
                }
            }
            const paiement = await prisma.paiementDivers.update({
                where: { id },
                data: {
                    libelle: data.libelle,
                    description: data.description,
                    typeOperation: data.typeOperation,
                    categorie: data.categorie,
                    tiersId: data.tiersId,
                    montant: data.montant !== undefined ? Number(data.montant) : undefined,
                    datePaiement: parseDate(data.datePaiement),
                    modePaiementId: data.modePaiementId,
                    reference: data.reference,
                    banque: data.banque,
                    notes: data.notes,
                },
                include: {
                    tiers: { select: { id: true, nomEntreprise: true } },
                    modePaiement: { select: { id: true, libelle: true } },
                },
            });
            await createAuditLog(req.user.id, 'UPDATE', 'PaiementDivers', paiement.id, { after: paiement });
            res.json({ paiement });
        }
        catch (error) {
            logger.error({ err: error }, 'Update paiement divers error');
            return next(new AppError(500, 'Erreur lors de la mise à jour du paiement divers'));
        }
    },
    // Supprimer un paiement divers
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const existing = await prisma.paiementDivers.findUnique({
                where: { id },
            });
            if (!existing) {
                return res.status(404).json({ error: 'Paiement divers non trouvé' });
            }
            await prisma.paiementDivers.delete({ where: { id } });
            await createAuditLog(req.user.id, 'DELETE', 'PaiementDivers', id);
            res.json({ message: 'Paiement divers supprimé' });
        }
        catch (error) {
            logger.error({ err: error }, 'Delete paiement divers error');
            return next(new AppError(500, 'Erreur lors de la suppression du paiement divers'));
        }
    },
    // Liste des catégories distinctes
    async getCategories(req, res, next) {
        try {
            const { typeOperation } = req.query;
            const where = {};
            if (typeOperation)
                where.typeOperation = typeOperation;
            const paiements = await prisma.paiementDivers.findMany({
                where,
                select: { categorie: true },
                distinct: ['categorie'],
            });
            const categories = paiements
                .map((p) => p.categorie)
                .filter(Boolean)
                .sort();
            res.json({ categories });
        }
        catch (error) {
            logger.error({ err: error }, 'Get categories error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    // Statistiques par type et catégorie
    async getStats(req, res, next) {
        try {
            const { annee } = req.query;
            const year = annee ? parseInt(annee) : new Date().getFullYear();
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            // Stats par type d'opération
            const statsByType = await prisma.paiementDivers.groupBy({
                by: ['typeOperation'],
                where: {
                    datePaiement: { gte: startDate, lte: endDate },
                },
                _sum: { montant: true },
                _count: true,
            });
            // Stats par catégorie et type
            const statsByCategorie = await prisma.paiementDivers.groupBy({
                by: ['typeOperation', 'categorie'],
                where: {
                    datePaiement: { gte: startDate, lte: endDate },
                },
                _sum: { montant: true },
                _count: true,
            });
            // Totaux
            const totaux = {
                encaissements: statsByType.find((s) => s.typeOperation === 'ENCAISSEMENT')?._sum.montant || 0,
                decaissements: statsByType.find((s) => s.typeOperation === 'DECAISSEMENT')?._sum.montant || 0,
            };
            res.json({ statsByType, statsByCategorie, totaux, annee: year });
        }
        catch (error) {
            logger.error({ err: error }, 'Get paiement divers stats error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
};
export default paiementDiversController;
//# sourceMappingURL=paiement-divers.controller.js.map