import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuthRequest } from './auth.middleware.js';

// Role hierarchy: DIRECTION > PLANNING > EQUIPE > LECTURE
const roleHierarchy: Record<Role, number> = {
  DIRECTION: 4,
  PLANNING: 3,
  EQUIPE: 2,
  LECTURE: 1,
};

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentification requise' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Accès refusé',
        message: `Rôle requis: ${allowedRoles.join(' ou ')}`
      });
      return;
    }

    next();
  };
}

export function requireMinRole(minRole: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentification requise' });
      return;
    }

    const userLevel = roleHierarchy[req.user.role];
    const requiredLevel = roleHierarchy[minRole];

    if (userLevel < requiredLevel) {
      res.status(403).json({
        error: 'Accès refusé',
        message: `Niveau d'accès insuffisant`
      });
      return;
    }

    next();
  };
}

// Permissions par action
export const permissions = {
  // Users
  manageUsers: [Role.DIRECTION],

  // Clients
  createClient: [Role.DIRECTION, Role.PLANNING],
  editClient: [Role.DIRECTION, Role.PLANNING],
  deleteClient: [Role.DIRECTION],

  // Contrats
  createContrat: [Role.DIRECTION, Role.PLANNING],
  editContrat: [Role.DIRECTION, Role.PLANNING],
  deleteContrat: [Role.DIRECTION],

  // Interventions
  createIntervention: [Role.DIRECTION, Role.PLANNING, Role.EQUIPE],
  editIntervention: [Role.DIRECTION, Role.PLANNING, Role.EQUIPE],
  deleteIntervention: [Role.DIRECTION, Role.PLANNING],
  realiserIntervention: [Role.DIRECTION, Role.PLANNING, Role.EQUIPE],

  // Import/Export
  importData: [Role.DIRECTION, Role.PLANNING],
  exportData: [Role.DIRECTION, Role.PLANNING, Role.EQUIPE],

  // Settings
  manageSettings: [Role.DIRECTION],
  viewEmployes: [Role.DIRECTION, Role.PLANNING, Role.EQUIPE],
  manageEmployes: [Role.DIRECTION],
  viewPostes: [Role.DIRECTION, Role.PLANNING, Role.EQUIPE],
  managePostes: [Role.DIRECTION],
  managePrestations: [Role.DIRECTION, Role.PLANNING],

  // Stock
  manageStock: [Role.DIRECTION, Role.PLANNING],

  // RH
  viewRH: [Role.DIRECTION, Role.PLANNING],
  manageRH: [Role.DIRECTION],

  // Commerce
  manageCommerce: [Role.DIRECTION, Role.PLANNING],

  // Facturation
  viewFacturation: [Role.DIRECTION, Role.PLANNING],
  manageFacturation: [Role.DIRECTION, Role.PLANNING],
};

export function canDo(action: keyof typeof permissions) {
  return requireRole(...permissions[action]);
}
