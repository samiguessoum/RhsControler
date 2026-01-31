import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const clientController: {
    /**
     * GET /api/clients
     */
    list(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/clients/:id
     */
    get(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /api/clients
     */
    create(req: AuthRequest, res: Response): Promise<void>;
    /**
     * PUT /api/clients/:id
     */
    update(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * DELETE /api/clients/:id (désactivation)
     */
    delete(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
export default clientController;
//# sourceMappingURL=client.controller.d.ts.map