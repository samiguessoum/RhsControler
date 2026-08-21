import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const fieldInterventionController: {
    list(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    get(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    submit(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    validate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    upsertControls(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    upsertProducts(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getSiteAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    listSiteFieldReports(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    generateSiteFieldReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    downloadFieldReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    listSiteDocuments(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createSiteDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteSiteDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=field-intervention.controller.d.ts.map