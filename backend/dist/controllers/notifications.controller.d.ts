import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const notificationsController: {
    list(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    checkOverdue(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    checkStock(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
};
export default notificationsController;
//# sourceMappingURL=notifications.controller.d.ts.map