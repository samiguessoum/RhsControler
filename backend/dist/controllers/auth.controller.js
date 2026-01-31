"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_js_1 = require("../config/database.js");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
exports.authController = {
    /**
     * POST /api/auth/login
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const user = await database_js_1.prisma.user.findUnique({
                where: { email: email.toLowerCase() },
            });
            if (!user) {
                return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
            }
            if (!user.actif) {
                return res.status(401).json({ error: 'Compte désactivé' });
            }
            const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
            }
            const token = (0, auth_middleware_js_1.generateToken)({
                id: user.id,
                email: user.email,
                nom: user.nom,
                prenom: user.prenom,
                role: user.role,
            });
            res.json({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    nom: user.nom,
                    prenom: user.prenom,
                    role: user.role,
                },
            });
        }
        catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Erreur de connexion' });
        }
    },
    /**
     * GET /api/auth/me
     */
    async me(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Non authentifié' });
            }
            const user = await database_js_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    email: true,
                    nom: true,
                    prenom: true,
                    tel: true,
                    role: true,
                    createdAt: true,
                },
            });
            if (!user) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            res.json({ user });
        }
        catch (error) {
            console.error('Me error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * POST /api/auth/logout
     */
    async logout(req, res) {
        // Avec JWT, le logout est géré côté client en supprimant le token
        res.json({ message: 'Déconnexion réussie' });
    },
    /**
     * POST /api/auth/change-password
     */
    async changePassword(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Non authentifié' });
            }
            const { currentPassword, newPassword } = req.body;
            const user = await database_js_1.prisma.user.findUnique({
                where: { id: req.user.id },
            });
            if (!user) {
                return res.status(404).json({ error: 'Utilisateur non trouvé' });
            }
            const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.password);
            if (!isValidPassword) {
                return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
            }
            const hashedPassword = await bcryptjs_1.default.hash(newPassword, 12);
            await database_js_1.prisma.user.update({
                where: { id: req.user.id },
                data: { password: hashedPassword },
            });
            res.json({ message: 'Mot de passe modifié avec succès' });
        }
        catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
};
exports.default = exports.authController;
//# sourceMappingURL=auth.controller.js.map