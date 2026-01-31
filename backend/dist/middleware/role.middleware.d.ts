import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuthRequest } from './auth.middleware.js';
export declare function requireRole(...allowedRoles: Role[]): (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare function requireMinRole(minRole: Role): (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const permissions: {
    manageUsers: "DIRECTION"[];
    createClient: ("DIRECTION" | "PLANNING")[];
    editClient: ("DIRECTION" | "PLANNING")[];
    deleteClient: "DIRECTION"[];
    createContrat: ("DIRECTION" | "PLANNING")[];
    editContrat: ("DIRECTION" | "PLANNING")[];
    deleteContrat: "DIRECTION"[];
    createIntervention: ("DIRECTION" | "PLANNING" | "EQUIPE")[];
    editIntervention: ("DIRECTION" | "PLANNING" | "EQUIPE")[];
    deleteIntervention: ("DIRECTION" | "PLANNING")[];
    realiserIntervention: ("DIRECTION" | "PLANNING" | "EQUIPE")[];
    importData: ("DIRECTION" | "PLANNING")[];
    exportData: ("DIRECTION" | "PLANNING" | "EQUIPE")[];
    manageSettings: "DIRECTION"[];
    managePrestations: ("DIRECTION" | "PLANNING")[];
};
export declare function canDo(action: keyof typeof permissions): (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=role.middleware.d.ts.map