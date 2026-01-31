import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const contratController: {
    /**
     * GET /api/contrats
     */
    list(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/contrats/:id
     */
    get(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /api/contrats
     * Crée le contrat ET génère automatiquement le planning
     */
    create(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * PUT /api/contrats/:id
     */
    update(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * DELETE /api/contrats/:id
     */
    delete(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
export default contratController;
//# sourceMappingURL=contrat.controller.d.ts.map