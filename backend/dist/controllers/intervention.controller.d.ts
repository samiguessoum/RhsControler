import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const interventionController: {
    /**
     * GET /api/interventions
     */
    list(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/interventions/a-planifier
     */
    aPlanifier(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/interventions/en-retard
     */
    enRetard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/interventions/semaine
     */
    semaine(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/interventions/:id
     */
    get(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/interventions
     */
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * PUT /api/interventions/:id
     */
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * PUT /api/interventions/:id/realiser
     * @body dateRealisee - Date effective de réalisation (optionnel, défaut: date prévue)
     *                      La prochaine intervention sera calculée à partir de cette date
     */
    realiser(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/interventions/:id/reporter
     */
    reporter(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /api/interventions/:id/annuler
     */
    annuler(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * DELETE /api/interventions/:id
     */
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/interventions/:id/attestation-passage.pdf
     */
    exportAttestationPassage(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/interventions/:id/attestation-passage/body
     */
    getAttestationBody(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/interventions/:id/attestation-passage/body
     */
    updateAttestationBody(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /api/interventions/:id/attestation-garantie.pdf
     */
    exportAttestationGarantie(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/interventions/:id/attestation-garantie/body
     */
    getAttestationGarantieBody(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/interventions/:id/attestation-garantie/body
     */
    updateAttestationGarantieBody(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /api/interventions/:id/attestation-controle.pdf
     */
    exportAttestationControle(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/interventions/:id/attestation-controle/body
     */
    getAttestationControleBody(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/interventions/:id/attestation-controle/body
     */
    updateAttestationControleBody(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /api/interventions/last-notes/:clientId
     * Récupère les notes terrain de la dernière intervention réalisée pour un client
     * @query siteId - Optionnel, pour filtrer par site
     */
    getLastNotes(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
};
export default interventionController;
//# sourceMappingURL=intervention.controller.d.ts.map