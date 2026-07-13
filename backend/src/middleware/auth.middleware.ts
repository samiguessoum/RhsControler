import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { Role } from '@prisma/client';
import logger from '../lib/logger.js';


export interface AuthUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

const _jwtRaw = process.env.JWT_SECRET;
if (!_jwtRaw || _jwtRaw === 'dev-secret-change-in-production') {
  throw new Error('FATAL: JWT_SECRET must be set to a strong, unique secret in environment variables');
}
const JWT_SECRET: string = _jwtRaw;

export function generateToken(user: AuthUser): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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
      select: { id: true, email: true, nom: true, prenom: true, role: true, actif: true }
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
      role: user.role
    };

    next();
  } catch (error) {
    logger.error({ err: error }, 'Auth middleware error');
    res.status(500).json({ error: 'Erreur d\'authentification', timestamp: new Date().toISOString() });
  }
}

export default authMiddleware;
