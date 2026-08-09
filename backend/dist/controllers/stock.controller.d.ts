import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const stockController: {
    /**
     * GET /api/produits
     */
    listProduits(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/produits/:id
     */
    getProduit(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * POST /api/produits
     */
    createProduit(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * PUT /api/produits/:id
     */
    updateProduit(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * DELETE /api/produits/:id
     */
    deleteProduit(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /api/mouvements-stock
     */
    listMouvements(req: AuthRequest, res: Response): Promise<void>;
    /**
     * POST /api/mouvements-stock
     * Créer un mouvement de stock (entrée, sortie, ajustement)
     */
    createMouvement(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * GET /api/stock/alertes
     * Produits en stock bas
     */
    getAlertes(req: AuthRequest, res: Response): Promise<void>;
    /**
     * GET /api/stock/stats
     */
    getStats(req: AuthRequest, res: Response): Promise<void>;
};
export default stockController;
//# sourceMappingURL=stock.controller.d.ts.map