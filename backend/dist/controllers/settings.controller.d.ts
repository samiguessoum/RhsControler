import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const settingsController: {
    getSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    uploadLogo(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    uploadLogoCarre(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
};
//# sourceMappingURL=settings.controller.d.ts.map