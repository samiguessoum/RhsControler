import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const userController: {
    /**
     * GET /api/users
     */
    list(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/users/:id
     */
    get(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /api/users
     */
    create(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * PUT /api/users/:id
     */
    update(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * DELETE /api/users/:id (désactivation)
     */
    delete(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
export default userController;
//# sourceMappingURL=user.controller.d.ts.map