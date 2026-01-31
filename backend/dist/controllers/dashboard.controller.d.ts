import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const dashboardController: {
    /**
     * GET /api/dashboard/stats
     */
    stats(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/dashboard/alertes
     */
    alertes(req: AuthRequest, res: Response): Promise<void>;
};
export default dashboardController;
//# sourceMappingURL=dashboard.controller.d.ts.map