import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import planningService from '../services/planning.service.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';

export const planningController = {
  /**
   * POST /api/planning/renouveler
   * Déclenchement manuel de la reconduction automatique des contrats éligibles.
   * Utile pour les tests ou pour déclencher manuellement après un arrêt du serveur.
   */
  async renouveler(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await planningService.renouvelerContratsEligibles(req.user!.id);
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Planning renouveler error');
      return next(new AppError(500, 'Erreur lors de la reconduction automatique'));
    }
  },
};

export default planningController;
