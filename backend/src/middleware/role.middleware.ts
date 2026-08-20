import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuthRequest } from './auth.middleware.js';

// Hiérarchie : SUPER_ADMIN > DIRECTION > COORDINATEUR > SUPER_CHEF_EQUIPE > EQUIPE > LECTURE
const roleHierarchy: Record<Role, number> = {
  SUPER_ADMIN:       6,
  DIRECTION:         5,
  COORDINATEUR:      4,
  SUPER_CHEF_EQUIPE: 3,
  EQUIPE:            2,
  LECTURE:           1,
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
        details: `Rôle requis: ${allowedRoles.join(' ou ')}`,
        timestamp: new Date().toISOString(),
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
        details: `Niveau d'accès insuffisant`,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next();
  };
}

// ─── Permissions par action ───────────────────────────────────────────────────
export const permissions = {
  // ── Utilisateurs (SUPER_ADMIN uniquement) ──
  manageUsers: [Role.SUPER_ADMIN],

  // ── Clients / Tiers ──
  createClient: [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],
  editClient:   [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],
  deleteClient: [Role.SUPER_ADMIN, Role.DIRECTION],

  // ── Contrats ──
  createContrat: [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],
  editContrat:   [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],
  deleteContrat: [Role.SUPER_ADMIN, Role.DIRECTION],

  // ── Interventions ──
  createIntervention:  [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],
  editIntervention:    [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],
  deleteIntervention:  [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],
  realiserIntervention:[Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR, Role.SUPER_CHEF_EQUIPE, Role.EQUIPE],
  // viewInterventions : tous les rôles authentifiés (le filtre EQUIPE se fait dans le controller)

  // ── Zoning / Interventions terrain ──
  manageInterventions: [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],

  // ── Import / Export ──
  importData: [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],
  exportData: [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR, Role.SUPER_CHEF_EQUIPE],

  // ── Paramètres (SUPER_ADMIN uniquement) ──
  manageSettings:  [Role.SUPER_ADMIN],
  managePrestations:[Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],

  // ── Employés ──
  viewEmployes:   [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR, Role.SUPER_CHEF_EQUIPE],
  manageEmployes: [Role.SUPER_ADMIN, Role.DIRECTION],
  viewPostes:     [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR, Role.SUPER_CHEF_EQUIPE],
  managePostes:   [Role.SUPER_ADMIN, Role.DIRECTION],

  // ── Stock ──
  manageStock: [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],

  // ── RH (congés, etc.) ──
  viewRH:   [Role.SUPER_ADMIN, Role.DIRECTION],
  manageRH: [Role.SUPER_ADMIN, Role.DIRECTION],

  // ── Commerce ──
  manageCommerce: [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],

  // ── Facturation ──
  // COORDINATEUR peut créer/gérer des factures mais pas voir le dashboard finance
  manageFacturation: [Role.SUPER_ADMIN, Role.DIRECTION, Role.COORDINATEUR],
  // Dashboard finance / stats CA : SUPER_ADMIN + DIRECTION uniquement
  viewFacturation:   [Role.SUPER_ADMIN, Role.DIRECTION],
  viewDashboardFinance: [Role.SUPER_ADMIN, Role.DIRECTION],
} as const;

export function canDo(action: keyof typeof permissions) {
  return requireRole(...(permissions[action] as unknown as Role[]));
}
