import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const zoningController: {
    listVersions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getVersion(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createVersion(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateVersion(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteVersion(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createZone(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateZone(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteZone(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createDevice(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateDevice(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteDevice(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    listDevices(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    listControlStatuses(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createControlStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateControlStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=zoning.controller.d.ts.map