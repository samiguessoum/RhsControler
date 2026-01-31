import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const interventionController: {
    /**
     * GET /api/interventions
     */
    list(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/interventions/a-planifier
     */
    aPlanifier(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/interventions/en-retard
     */
    enRetard(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/interventions/semaine
     */
    semaine(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/interventions/:id
     */
    get(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /api/interventions
     */
    create(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * PUT /api/interventions/:id
     */
    update(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * PUT /api/interventions/:id/realiser
     * @body dateRealisee - Date effective de réalisation (optionnel, défaut: date prévue)
     *                      La prochaine intervention sera calculée à partir de cette date
     */
    realiser(req: AuthRequest, res: Response): Promise<void>;
    /**
     * POST /api/interventions/:id/reporter
     */
    reporter(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * DELETE /api/interventions/:id
     */
    delete(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
export default interventionController;
//# sourceMappingURL=intervention.controller.d.ts.map