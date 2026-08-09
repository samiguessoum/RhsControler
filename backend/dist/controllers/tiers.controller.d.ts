import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const tiersController: {
    /**
     * GET /api/tiers
     * Liste des tiers avec filtres avancés
     */
    list(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/tiers/:id
     * Détail complet d'un tiers
     */
    get(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/tiers
     * Créer un nouveau tiers
     */
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * PUT /api/tiers/:id
     * Mettre à jour un tiers
     */
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/tiers/:id
     */
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/tiers/:id/convertir
     * Convertir un prospect en client
     */
    convertirProspect(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/tiers/:id/contacts
     */
    addContact(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/tiers/:tiersId/contacts/:id
     */
    updateContact(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/tiers/:tiersId/contacts/:id
     */
    deleteContact(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/tiers/:id/adresses
     */
    addAdresse(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/tiers/:tiersId/adresses/:id
     */
    updateAdresse(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/tiers/:tiersId/adresses/:id
     */
    deleteAdresse(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/tiers/:id/comptes-bancaires
     */
    addCompteBancaire(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/tiers/:tiersId/comptes-bancaires/:id
     */
    updateCompteBancaire(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/tiers/:tiersId/comptes-bancaires/:id
     */
    deleteCompteBancaire(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/tiers/:id/sites
     * Liste des sites d'un tiers
     */
    listSites(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/sites/:id
     * Détail d'un site
     */
    getSite(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/tiers/:id/sites
     * Créer un site pour un tiers
     */
    addSite(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/sites/:id
     * Mettre à jour un site
     */
    updateSite(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/sites/:id
     * Supprimer un site
     */
    deleteSite(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/sites/:id/contacts
     * Ajouter un contact à un site
     */
    addSiteContact(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/sites/:siteId/contacts/:id
     * Mettre à jour un contact de site
     */
    updateSiteContact(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/sites/:siteId/contacts/:id
     * Supprimer un contact de site
     */
    deleteSiteContact(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/modes-paiement
     */
    listModesPaiement(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/modes-paiement
     */
    createModePaiement(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/conditions-paiement
     */
    listConditionsPaiement(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/conditions-paiement
     */
    createConditionPaiement(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/tiers/stats
     */
    getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
};
export default tiersController;
//# sourceMappingURL=tiers.controller.d.ts.map