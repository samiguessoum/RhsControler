import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const authController: {
    /**
     * POST /api/auth/login
     */
    login(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/auth/me
     */
    me(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/auth/logout
     */
    logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/auth/change-password
     */
    changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
};
export default authController;
//# sourceMappingURL=auth.controller.d.ts.map