import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const dashboardController: {
    /**
     * GET /api/dashboard/stats
     */
    stats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/dashboard/stats-extended
     * Statistiques enrichies pour le nouveau dashboard
     */
    statsExtended(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/dashboard/aujourdhui
     * Interventions du jour avec détails
     */
    aujourdhui(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/dashboard/alertes
     */
    alertes(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/dashboard/employes-stats
     * Statistiques des employés : charge de travail, missions cette semaine
     */
    employesStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/dashboard/operations-stats
     * Statistiques détaillées des opérations
     */
    operationsStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
};
export default dashboardController;
//# sourceMappingURL=dashboard.controller.d.ts.map