import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const produitsServicesController: {
    /**
     * GET /api/produits-services
     * Liste tous les produits et services avec filtres
     */
    list(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/produits-services/:id
     */
    get(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/produits-services
     */
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * PUT /api/produits-services/:id
     */
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/produits-services/:id
     */
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/categories-produits
     */
    listCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/categories-produits/:id
     */
    getCategorie(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/categories-produits
     */
    createCategorie(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * PUT /api/categories-produits/:id
     */
    updateCategorie(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/categories-produits/:id
     */
    deleteCategorie(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/entrepots
     */
    listEntrepots(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/entrepots/:id
     */
    getEntrepot(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/entrepots
     */
    createEntrepot(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * PUT /api/entrepots/:id
     */
    updateEntrepot(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/entrepots/:id
     */
    deleteEntrepot(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/prix-fournisseurs
     */
    listPrixFournisseurs(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/prix-fournisseurs
     */
    createPrixFournisseur(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * PUT /api/prix-fournisseurs/:id
     */
    updatePrixFournisseur(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/prix-fournisseurs/:id
     */
    deletePrixFournisseur(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/prix-clients
     */
    listPrixClients(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/prix-clients
     */
    createPrixClient(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * PUT /api/prix-clients/:id
     */
    updatePrixClient(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/prix-clients/:id
     */
    deletePrixClient(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * POST /api/produits-services/:id/mouvement
     * Créer un mouvement de stock pour un ProduitService
     */
    createMouvementProduitService(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/produits-services/stats
     */
    getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/produits-services/alertes
     * Produits en stock bas
     */
    getAlertes(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/produits-services/:id/fiche-technique
     * Upload d'un PDF fiche technique pour un produit
     */
    uploadFicheTechnique(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/produits-services/:id/fiche-technique
     * Supprime la fiche technique d'un produit
     */
    deleteFicheTechnique(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
};
export default produitsServicesController;
//# sourceMappingURL=produits-services.controller.d.ts.map