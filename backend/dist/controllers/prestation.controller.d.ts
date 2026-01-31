import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const prestationController: {
    /**
     * GET /api/prestations
     */
    list(req: AuthRequest, res: Response): Promise<void>;
    /**
     * POST /api/prestations
     */
    create(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * PUT /api/prestations/:id
     */
    update(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * DELETE /api/prestations/:id (désactivation)
     */
    delete(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
export default prestationController;
//# sourceMappingURL=prestation.controller.d.ts.map