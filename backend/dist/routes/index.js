"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const role_middleware_js_1 = require("../middleware/role.middleware.js");
const validation_middleware_js_1 = require("../middleware/validation.middleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const auth_controller_js_1 = __importDefault(require("../controllers/auth.controller.js"));
const user_controller_js_1 = __importDefault(require("../controllers/user.controller.js"));
const client_controller_js_1 = __importDefault(require("../controllers/client.controller.js"));
const prestation_controller_js_1 = __importDefault(require("../controllers/prestation.controller.js"));
const contrat_controller_js_1 = __importDefault(require("../controllers/contrat.controller.js"));
const intervention_controller_js_1 = __importDefault(require("../controllers/intervention.controller.js"));
const dashboard_controller_js_1 = __importDefault(require("../controllers/dashboard.controller.js"));
const import_export_controller_js_1 = __importDefault(require("../controllers/import-export.controller.js"));
const router = (0, express_1.Router)();
// ============ AUTH (public) ============
router.post('/auth/login', (0, validation_middleware_js_1.validate)(schemas_js_1.loginSchema), auth_controller_js_1.default.login);
// ============ AUTH (protected) ============
router.get('/auth/me', auth_middleware_js_1.authMiddleware, auth_controller_js_1.default.me);
router.post('/auth/logout', auth_middleware_js_1.authMiddleware, auth_controller_js_1.default.logout);
router.post('/auth/change-password', auth_middleware_js_1.authMiddleware, auth_controller_js_1.default.changePassword);
// ============ USERS (DIRECTION only) ============
router.get('/users', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('manageUsers'), user_controller_js_1.default.list);
router.get('/users/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('manageUsers'), user_controller_js_1.default.get);
router.post('/users', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('manageUsers'), (0, validation_middleware_js_1.validate)(schemas_js_1.createUserSchema), user_controller_js_1.default.create);
router.put('/users/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('manageUsers'), (0, validation_middleware_js_1.validate)(schemas_js_1.updateUserSchema), user_controller_js_1.default.update);
router.delete('/users/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('manageUsers'), user_controller_js_1.default.delete);
// ============ CLIENTS ============
router.get('/clients', auth_middleware_js_1.authMiddleware, client_controller_js_1.default.list);
router.get('/clients/:id', auth_middleware_js_1.authMiddleware, client_controller_js_1.default.get);
router.post('/clients', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('createClient'), (0, validation_middleware_js_1.validate)(schemas_js_1.createClientSchema), client_controller_js_1.default.create);
router.put('/clients/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('editClient'), (0, validation_middleware_js_1.validate)(schemas_js_1.updateClientSchema), client_controller_js_1.default.update);
router.delete('/clients/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('deleteClient'), client_controller_js_1.default.delete);
// ============ PRESTATIONS ============
router.get('/prestations', auth_middleware_js_1.authMiddleware, prestation_controller_js_1.default.list);
router.post('/prestations', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('managePrestations'), (0, validation_middleware_js_1.validate)(schemas_js_1.createPrestationSchema), prestation_controller_js_1.default.create);
router.put('/prestations/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('managePrestations'), (0, validation_middleware_js_1.validate)(schemas_js_1.updatePrestationSchema), prestation_controller_js_1.default.update);
router.delete('/prestations/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('managePrestations'), prestation_controller_js_1.default.delete);
// ============ CONTRATS ============
router.get('/contrats', auth_middleware_js_1.authMiddleware, contrat_controller_js_1.default.list);
router.get('/contrats/:id', auth_middleware_js_1.authMiddleware, contrat_controller_js_1.default.get);
router.post('/contrats', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('createContrat'), (0, validation_middleware_js_1.validate)(schemas_js_1.createContratSchema), contrat_controller_js_1.default.create);
router.put('/contrats/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('editContrat'), (0, validation_middleware_js_1.validate)(schemas_js_1.updateContratSchema), contrat_controller_js_1.default.update);
router.delete('/contrats/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('deleteContrat'), contrat_controller_js_1.default.delete);
// ============ INTERVENTIONS ============
router.get('/interventions', auth_middleware_js_1.authMiddleware, intervention_controller_js_1.default.list);
router.get('/interventions/a-planifier', auth_middleware_js_1.authMiddleware, intervention_controller_js_1.default.aPlanifier);
router.get('/interventions/en-retard', auth_middleware_js_1.authMiddleware, intervention_controller_js_1.default.enRetard);
router.get('/interventions/semaine', auth_middleware_js_1.authMiddleware, intervention_controller_js_1.default.semaine);
router.get('/interventions/:id', auth_middleware_js_1.authMiddleware, intervention_controller_js_1.default.get);
router.post('/interventions', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('createIntervention'), (0, validation_middleware_js_1.validate)(schemas_js_1.createInterventionSchema), intervention_controller_js_1.default.create);
router.put('/interventions/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('editIntervention'), (0, validation_middleware_js_1.validate)(schemas_js_1.updateInterventionSchema), intervention_controller_js_1.default.update);
router.put('/interventions/:id/realiser', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('realiserIntervention'), (0, validation_middleware_js_1.validate)(schemas_js_1.realiserInterventionSchema), intervention_controller_js_1.default.realiser);
router.post('/interventions/:id/reporter', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('editIntervention'), (0, validation_middleware_js_1.validate)(schemas_js_1.reporterInterventionSchema), intervention_controller_js_1.default.reporter);
router.delete('/interventions/:id', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('deleteIntervention'), intervention_controller_js_1.default.delete);
// ============ DASHBOARD ============
router.get('/dashboard/stats', auth_middleware_js_1.authMiddleware, dashboard_controller_js_1.default.stats);
router.get('/dashboard/alertes', auth_middleware_js_1.authMiddleware, dashboard_controller_js_1.default.alertes);
// ============ IMPORT/EXPORT ============
router.get('/export/clients', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('exportData'), import_export_controller_js_1.default.exportClients);
router.get('/export/contrats', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('exportData'), import_export_controller_js_1.default.exportContrats);
router.get('/export/interventions', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('exportData'), import_export_controller_js_1.default.exportInterventions);
router.get('/export/google-calendar', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('exportData'), import_export_controller_js_1.default.exportGoogleCalendar);
router.get('/import/templates/:type', auth_middleware_js_1.authMiddleware, import_export_controller_js_1.default.getTemplate);
router.post('/import/preview', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('importData'), import_export_controller_js_1.default.preview);
router.post('/import/execute', auth_middleware_js_1.authMiddleware, (0, role_middleware_js_1.canDo)('importData'), import_export_controller_js_1.default.execute);
exports.default = router;
//# sourceMappingURL=index.js.map