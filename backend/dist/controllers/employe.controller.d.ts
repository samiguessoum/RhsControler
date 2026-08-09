import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const employeController: {
    /**
     * GET /api/employes
     */
    list(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/employes/:id
     */
    get(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/employes
     */
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/employes/:id
     */
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/employes/:id/interventions-count
     */
    interventionsCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/employes/:id
     */
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
};
export default employeController;
//# sourceMappingURL=employe.controller.d.ts.map