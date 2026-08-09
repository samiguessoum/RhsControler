import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const prestationController: {
    /**
     * GET /api/prestations
     */
    list(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/prestations
     */
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * PUT /api/prestations/:id
     */
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/prestations/:id (désactivation)
     */
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
};
export default prestationController;
//# sourceMappingURL=prestation.controller.d.ts.map