import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const importExportController: {
    /**
     * GET /api/export/clients
     */
    exportClients(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/export/contrats
     */
    exportContrats(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/export/interventions
     */
    exportInterventions(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/export/google-calendar
     */
    exportGoogleCalendar(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/import/templates/:type
     */
    getTemplate(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /api/import/preview
     */
    preview(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /api/import/execute
     */
    execute(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
export default importExportController;
//# sourceMappingURL=import-export.controller.d.ts.map