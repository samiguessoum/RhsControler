"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissions = void 0;
exports.requireRole = requireRole;
exports.requireMinRole = requireMinRole;
exports.canDo = canDo;
const client_1 = require("@prisma/client");
// Role hierarchy: DIRECTION > PLANNING > EQUIPE > LECTURE
const roleHierarchy = {
    DIRECTION: 4,
    PLANNING: 3,
    EQUIPE: 2,
    LECTURE: 1,
};
function requireRole(...allowedRoles) {
    return (req, res, next) => {
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
function requireMinRole(minRole) {
    return (req, res, next) => {
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
exports.permissions = {
    // Users
    manageUsers: [client_1.Role.DIRECTION],
    // Clients
    createClient: [client_1.Role.DIRECTION, client_1.Role.PLANNING],
    editClient: [client_1.Role.DIRECTION, client_1.Role.PLANNING],
    deleteClient: [client_1.Role.DIRECTION],
    // Contrats
    createContrat: [client_1.Role.DIRECTION, client_1.Role.PLANNING],
    editContrat: [client_1.Role.DIRECTION, client_1.Role.PLANNING],
    deleteContrat: [client_1.Role.DIRECTION],
    // Interventions
    createIntervention: [client_1.Role.DIRECTION, client_1.Role.PLANNING, client_1.Role.EQUIPE],
    editIntervention: [client_1.Role.DIRECTION, client_1.Role.PLANNING, client_1.Role.EQUIPE],
    deleteIntervention: [client_1.Role.DIRECTION, client_1.Role.PLANNING],
    realiserIntervention: [client_1.Role.DIRECTION, client_1.Role.PLANNING, client_1.Role.EQUIPE],
    // Import/Export
    importData: [client_1.Role.DIRECTION, client_1.Role.PLANNING],
    exportData: [client_1.Role.DIRECTION, client_1.Role.PLANNING, client_1.Role.EQUIPE],
    // Settings
    manageSettings: [client_1.Role.DIRECTION],
    managePrestations: [client_1.Role.DIRECTION, client_1.Role.PLANNING],
};
function canDo(action) {
    return requireRole(...exports.permissions[action]);
}
//# sourceMappingURL=role.middleware.js.map