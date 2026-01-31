"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_js_1 = require("../config/database.js");
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
function generateToken(user) {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d');
    return jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn });
}
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Token d\'authentification manquant' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (!decoded) {
            res.status(401).json({ error: 'Token invalide ou expiré' });
            return;
        }
        // Verify user still exists and is active
        const user = await database_js_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, nom: true, prenom: true, role: true, actif: true }
        });
        if (!user || !user.actif) {
            res.status(401).json({ error: 'Utilisateur non trouvé ou désactivé' });
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
            nom: user.nom,
            prenom: user.prenom,
            role: user.role
        };
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Erreur d\'authentification' });
    }
}
exports.default = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map