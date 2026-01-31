import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const authController: {
    /**
     * POST /api/auth/login
     */
    login(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /api/auth/me
     */
    me(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /api/auth/logout
     */
    logout(req: AuthRequest, res: Response): Promise<void>;
    /**
     * POST /api/auth/change-password
     */
    changePassword(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
export default authController;
//# sourceMappingURL=auth.controller.d.ts.map