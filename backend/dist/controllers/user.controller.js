"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_js_1 = require("../config/database.js");
const audit_controller_js_1 = require("./audit.controller.js");
exports.userController = {
    /**
     * GET /api/users
     */
    async list(req, res) {
        try {
            const users = await database_js_1.prisma.user.findMany({
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
                orderBy: [{ role: 'asc' }, { nom: 'asc' }],
            });
            res.json({ users });
        }
        catch (error) {
            console.error('List users error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * GET /api/users/:id
     */
    async get(req, res) {
        try {
            const { id } = req.params;
            const user = await database_js_1.prisma.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    email: true,
                    nom: true,
                    prenom: true,
                    tel: true,
                    role: true,
                    actif: true,
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
            console.error('Get user error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * POST /api/users
     */
    async create(req, res) {
        try {
            const { email, password, nom, prenom, tel, role } = req.body;
            // Vérifier si email existe déjà
            const existing = await database_js_1.prisma.user.findUnique({
                where: { email: email.toLowerCase() },
            });
            if (existing) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé' });
            }
            const hashedPassword = await bcryptjs_1.default.hash(password, 12);
            const user = await database_js_1.prisma.user.create({
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
            await (0, audit_controller_js_1.createAuditLog)(req.user.id, 'CREATE', 'User', user.id, { after: user });
            res.status(201).json({ user });
        }
        catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * PUT /api/users/:id
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const { email, password, nom, prenom, tel, role, actif } = req.body;
            const existing = await database_js_1.prisma.user.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            // Vérifier email unique si modifié
            if (email && email.toLowerCase() !== existing.email) {
                const emailExists = await database_js_1.prisma.user.findUnique({
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
                updateData.password = await bcryptjs_1.default.hash(password, 12);
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
            const user = await database_js_1.prisma.user.update({
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
                    createdAt: true,
                    updatedAt: true,
                },
            });
            // Audit log
            await (0, audit_controller_js_1.createAuditLog)(req.user.id, 'UPDATE', 'User', user.id, {
                before: { ...existing, password: '[HIDDEN]' },
                after: { ...user, password: '[HIDDEN]' },
            });
            res.json({ user });
        }
        catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * DELETE /api/users/:id (désactivation)
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            // Empêcher de se désactiver soi-même
            if (id === req.user?.id) {
                return res.status(400).json({ error: 'Vous ne pouvez pas vous désactiver vous-même' });
            }
            const existing = await database_js_1.prisma.user.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            await database_js_1.prisma.user.update({
                where: { id },
                data: { actif: false },
            });
            // Audit log
            await (0, audit_controller_js_1.createAuditLog)(req.user.id, 'DELETE', 'User', id);
            res.json({ message: 'Utilisateur désactivé' });
        }
        catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
};
exports.default = exports.userController;
//# sourceMappingURL=user.controller.js.map