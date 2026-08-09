import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const facturationStatsController: {
    getGlobalStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    getTVASummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getMarges(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getCommandesFacturables(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getTresorerie(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getFacturesEnRetard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getMensuel(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getTopClients(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getAnneesDisponibles(_req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getG50(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
};
export default facturationStatsController;
//# sourceMappingURL=facturation-stats.controller.d.ts.map