import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
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
export declare function generateToken(user: AuthUser): string;
export declare function verifyToken(token: string): AuthUser | null;
export declare function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export default authMiddleware;
//# sourceMappingURL=auth.middleware.d.ts.map