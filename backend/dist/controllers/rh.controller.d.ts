import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
export declare const rhController: {
    /**
     * GET /api/rh/conges
     * Liste des congés avec filtres
     */
    listConges(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/rh/conges
     * Créer une demande de congé
     */
    createConge(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * PUT /api/rh/conges/:id/approuver
     * Approuver ou refuser un congé
     */
    approuverConge(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/rh/conges/:id
     * Annuler un congé (seulement si en attente ou futur)
     */
    annulerConge(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/rh/soldes?annee=2026
     * Soldes de congés de tous les employés pour une année
     */
    listSoldes(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/rh/soldes/crediter-mois
     * Credit 2.5 jours a tous les employes pour un mois donne
     */
    crediterMois(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/rh/soldes/:employeId/ajuster
     * Ajustement manuel du solde d un employe
     */
    ajusterSolde(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/rh/soldes/cloture-annee
     * Cloture de fin d annee : REPORTER | SUPPRIMER | PAYER
     */
    cloturerAnnee(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/rh/soldes/mouvements?employeId=xxx&annee=2026
     */
    listMouvements(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/rh/weekend-travailles
     * Liste des jours de weekend travaillés
     */
    listWeekendTravailles(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/rh/weekend-travailles
     * Enregistrer un jour de weekend travaillé
     */
    createWeekendTravaille(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/rh/weekend-travailles/:id
     * Supprimer un jour de weekend travaillé
     */
    deleteWeekendTravaille(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/rh/soldes
     * Récupérer les soldes de congés
     */
    getSoldes(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/rh/soldes
     * Mettre à jour ou créer un solde (pour définir les jours acquis)
     */
    updateSolde(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/rh/employes/:id/recap
     * Récapitulatif RH d'un employé
     */
    getEmployeRecap(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * GET /api/rh/dashboard
     * Dashboard RH
     */
    getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/rh/recuperations
     * Historique complet des récupérations par employé
     */
    listRecuperations(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/rh/recuperations/accorder
     * Accorder des jours de récupération à un employé
     */
    accorderRecuperation(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
    /**
     * DELETE /api/rh/recuperations/accordees/:id
     * Supprimer une récupération accordée
     */
    deleteRecuperationAccordee(req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
};
export default rhController;
//# sourceMappingURL=rh.controller.d.ts.map