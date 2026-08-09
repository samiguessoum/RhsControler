import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import logger from '../lib/logger.js';
const _jwtRaw = process.env.JWT_SECRET;
if (!_jwtRaw || _jwtRaw === 'dev-secret-change-in-production') {
    throw new Error('FATAL: JWT_SECRET must be set to a strong, unique secret in environment variables');
}
const JWT_SECRET = _jwtRaw;
export function generateToken(user) {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d');
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn });
}
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
export async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Token d\'authentification manquant', timestamp: new Date().toISOString() });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (!decoded) {
            res.status(401).json({ error: 'Token invalide ou expiré', timestamp: new Date().toISOString() });
            return;
        }
        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, nom: true, prenom: true, role: true, actif: true, employeId: true }
        });
        if (!user || !user.actif) {
            res.status(401).json({ error: 'Utilisateur non trouvé ou désactivé', timestamp: new Date().toISOString() });
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
            nom: user.nom,
            prenom: user.prenom,
            role: user.role,
            employeId: user.employeId,
        };
        next();
    }
    catch (error) {
        logger.error({ err: error }, 'Auth middleware error');
        res.status(500).json({ error: 'Erreur d\'authentification', timestamp: new Date().toISOString() });
    }
}
export default authMiddleware;
//# sourceMappingURL=auth.middleware.js.map