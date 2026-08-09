import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { createAuditLog } from './audit.controller.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
export const userController = {
    /**
     * GET /api/users
     */
    async list(req, res, next) {
        try {
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    nom: true,
                    prenom: true,
                    tel: true,
                    role: true,
                    actif: true,
                    employeId: true,
                    createdAt: true,
                },
                orderBy: [{ role: 'asc' }, { nom: 'asc' }],
            });
            res.json({ users });
        }
        catch (error) {
            logger.error({ err: error }, 'List users error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    /**
     * GET /api/users/:id
     */
    async get(req, res, next) {
        try {
            const { id } = req.params;
            const user = await prisma.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    email: true,
                    nom: true,
                    prenom: true,
                    tel: true,
                    role: true,
                    actif: true,
                    employeId: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            if (!user) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            res.json({ user });
        }
        catch (error) {
            logger.error({ err: error }, 'Get user error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    /**
     * POST /api/users
     */
    async create(req, res, next) {
        try {
            const { email, password, nom, prenom, tel, role } = req.body;
            // Vérifier si email existe déjà
            const existing = await prisma.user.findUnique({
                where: { email: email.toLowerCase() },
            });
            if (existing) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé' });
            }
            const hashedPassword = await bcrypt.hash(password, 12);
            const user = await prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    nom,
                    prenom,
                    tel,
                    role,
                },
                select: {
                    id: true,
                    email: true,
                    nom: true,
                    prenom: true,
                    tel: true,
                    role: true,
                    actif: true,
                    createdAt: true,
                },
            });
            // Audit log
            await createAuditLog(req.user.id, 'CREATE', 'User', user.id, { after: user });
            res.status(201).json({ user });
        }
        catch (error) {
            logger.error({ err: error }, 'Create user error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    /**
     * PUT /api/users/:id
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const { email, password, nom, prenom, tel, role, actif, employeId } = req.body;
            const existing = await prisma.user.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            // Vérifier email unique si modifié
            if (email && email.toLowerCase() !== existing.email) {
                const emailExists = await prisma.user.findUnique({
                    where: { email: email.toLowerCase() },
                });
                if (emailExists) {
                    return res.status(400).json({ error: 'Cet email est déjà utilisé' });
                }
            }
            const updateData = {};
            if (email)
                updateData.email = email.toLowerCase();
            if (password)
                updateData.password = await bcrypt.hash(password, 12);
            if (nom)
                updateData.nom = nom;
            if (prenom)
                updateData.prenom = prenom;
            if (tel !== undefined)
                updateData.tel = tel;
            if (role)
                updateData.role = role;
            if (actif !== undefined)
                updateData.actif = actif;
            if (employeId !== undefined)
                updateData.employeId = employeId || null;
            const user = await prisma.user.update({
                where: { id },
                data: updateData,
                select: {
                    id: true,
                    email: true,
                    nom: true,
                    prenom: true,
                    tel: true,
                    role: true,
                    actif: true,
                    employeId: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            // Audit log
            await createAuditLog(req.user.id, 'UPDATE', 'User', user.id, {
                before: { ...existing, password: '[HIDDEN]' },
                after: { ...user, password: '[HIDDEN]' },
            });
            res.json({ user });
        }
        catch (error) {
            logger.error({ err: error }, 'Update user error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    /**
     * DELETE /api/users/:id (désactivation)
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            // Empêcher de se désactiver soi-même
            if (id === req.user?.id) {
                return res.status(400).json({ error: 'Vous ne pouvez pas vous désactiver vous-même' });
            }
            const existing = await prisma.user.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            await prisma.user.update({
                where: { id },
                data: { actif: false },
            });
            // Audit log
            await createAuditLog(req.user.id, 'DELETE', 'User', id);
            res.json({ message: 'Utilisateur désactivé' });
        }
        catch (error) {
            logger.error({ err: error }, 'Delete user error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    /**
     * DELETE /api/users/:id/permanent — suppression définitive (DIRECTION uniquement)
     */
    async permanentDelete(req, res, next) {
        try {
            const { id } = req.params;
            if (id === req.user?.id) {
                return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
            }
            const existing = await prisma.user.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            const adminId = req.user.id;
            await prisma.$transaction(async (tx) => {
                // FK requises (non nullable) → supprimer ou réassigner à l'admin
                await tx.auditLog.deleteMany({ where: { userId: id } });
                await tx.mouvementStock.deleteMany({ where: { userId: id } });
                await tx.intervention.updateMany({ where: { createdById: id }, data: { createdById: adminId } });
                // FK optionnelles → mettre à null
                await tx.intervention.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
                await tx.contrat.updateMany({ where: { responsablePlanningId: id }, data: { responsablePlanningId: null } });
                await tx.conge.updateMany({ where: { approuveParId: id }, data: { approuveParId: null } });
                // Commerce
                await tx.devis.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.devis.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
                await tx.commande.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.commande.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
                await tx.bonLivraison.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.bonLivraison.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
                await tx.facture.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.facture.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
                await tx.paiement.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.factureRelance.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.commandeFournisseur.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.commandeFournisseur.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
                await tx.factureFournisseur.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.factureFournisseur.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
                await tx.paiementFournisseur.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.charge.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.charge.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
                await tx.paiementCharge.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.paiementDivers.updateMany({ where: { createdById: id }, data: { createdById: null } });
                await tx.user.delete({ where: { id } });
            });
            await createAuditLog(adminId, 'DELETE', 'User', id);
            res.json({ message: 'Utilisateur supprimé définitivement' });
        }
        catch (error) {
            logger.error({ err: error }, 'Permanent delete user error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
};
export default userController;
//# sourceMappingURL=user.controller.js.map