import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import planningService from '../services/planning.service.js';

export const dashboardController = {
  /**
   * GET /api/dashboard/stats
   */
  async stats(req: AuthRequest, res: Response) {
    try {
      const stats = await planningService.getStats();
      res.json({ stats });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/dashboard/alertes
   */
  async alertes(req: AuthRequest, res: Response) {
    try {
      const [contrats, ponctuelContrats, contratsHorsValidite] = await Promise.all([
        planningService.getContratsEnAlerte(),
        planningService.getContratsPonctuelAlerte(),
        planningService.getContratsHorsValidite(),
      ]);

      const alertes = contrats.map((c) => ({
        id: c.id,
        type: 'CONTRAT_SANS_INTERVENTION',
        message: `Le contrat avec ${c.client.nomEntreprise} n'a aucune intervention future planifiée`,
        client: c.client,
        contratId: c.id,
        dateDebut: c.dateDebut,
        dateFin: c.dateFin,
        prestations: c.prestations,
      }));

      const ponctuelAlertes = ponctuelContrats.map((c) => ({
        id: `ponctuel-${c.id}`,
        type: 'PONCTUEL_DERNIERE_OPERATION',
        message: `Dernière opération restante pour le contrat ponctuel avec ${c.client.nomEntreprise}`,
        client: c.client,
        contratId: c.id,
        dateDebut: c.dateDebut,
        dateFin: c.dateFin,
        prestations: c.prestations,
        numeroBonCommande: c.numeroBonCommande,
      }));

      const horsValiditeAlertes = contratsHorsValidite.map((c) => ({
        id: `hors-validite-${c.contrat.id}`,
        type: 'CONTRAT_HORS_VALIDITE',
        message: `Interventions planifiées après la date de fin pour ${c.client.nomEntreprise}`,
        client: c.client,
        contratId: c.contrat.id,
        dateDebut: null,
        dateFin: c.contrat.dateFin,
        prestations: c.contrat.prestations,
        nextDate: c.nextDate,
        count: c.count,
      }));

      res.json({
        alertes: [...alertes, ...ponctuelAlertes, ...horsValiditeAlertes],
        count: alertes.length + ponctuelAlertes.length + horsValiditeAlertes.length,
      });
    } catch (error) {
      console.error('Dashboard alertes error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default dashboardController;
