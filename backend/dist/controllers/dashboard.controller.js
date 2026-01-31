"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = void 0;
const planning_service_js_1 = __importDefault(require("../services/planning.service.js"));
exports.dashboardController = {
    /**
     * GET /api/dashboard/stats
     */
    async stats(req, res) {
        try {
            const stats = await planning_service_js_1.default.getStats();
            res.json({ stats });
        }
        catch (error) {
            console.error('Dashboard stats error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * GET /api/dashboard/alertes
     */
    async alertes(req, res) {
        try {
            const [contrats, ponctuelContrats] = await Promise.all([
                planning_service_js_1.default.getContratsEnAlerte(),
                planning_service_js_1.default.getContratsPonctuelAlerte(),
            ]);
            const alertes = contrats.map((c) => ({
                id: c.id,
                type: 'CONTRAT_SANS_INTERVENTION',
                message: `Le contrat avec ${c.client.nomEntreprise} n'a aucune intervention future planifiée`,
                client: c.client,
                contratId: c.id,
                dateDebut: c.dateDebut,
                dateFin: c.dateFin,
                prestations: c.prestations,
            }));
            const ponctuelAlertes = ponctuelContrats.map((c) => ({
                id: `ponctuel-${c.id}`,
                type: 'PONCTUEL_DERNIERE_OPERATION',
                message: `Dernière opération restante pour le contrat ponctuel avec ${c.client.nomEntreprise}`,
                client: c.client,
                contratId: c.id,
                dateDebut: c.dateDebut,
                dateFin: c.dateFin,
                prestations: c.prestations,
                numeroBonCommande: c.numeroBonCommande,
            }));
            res.json({
                alertes: [...alertes, ...ponctuelAlertes],
                count: alertes.length + ponctuelAlertes.length,
            });
        }
        catch (error) {
            console.error('Dashboard alertes error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
};
exports.default = exports.dashboardController;
//# sourceMappingURL=dashboard.controller.js.map