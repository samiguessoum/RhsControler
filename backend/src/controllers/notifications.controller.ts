import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { facturationEvents, checkOverdueInvoices, checkLowStock } from '../services/events.service.js';

export const notificationsController = {
  // Liste des notifications
  async list(req: AuthRequest, res: Response) {
    try {
      const { unreadOnly } = req.query;
      const notifications = facturationEvents.getNotifications(
        req.user?.id,
        unreadOnly === 'true'
      );

      res.json({
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
      });
    } catch (error) {
      console.error('List notifications error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Marquer une notification comme lue
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const success = facturationEvents.markAsRead(id);

      if (!success) {
        return res.status(404).json({ error: 'Notification non trouvée' });
      }

      res.json({ message: 'Notification marquée comme lue' });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Marquer toutes les notifications comme lues
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const count = facturationEvents.markAllAsRead(req.user?.id);
      res.json({ message: `${count} notifications marquées comme lues` });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Déclencher manuellement la vérification des retards
  async checkOverdue(req: AuthRequest, res: Response) {
    try {
      await checkOverdueInvoices();
      res.json({ message: 'Vérification des retards effectuée' });
    } catch (error) {
      console.error('Check overdue error:', error);
      res.status(500).json({ error: 'Erreur lors de la vérification' });
    }
  },

  // Déclencher manuellement la vérification des stocks bas
  async checkStock(req: AuthRequest, res: Response) {
    try {
      await checkLowStock();
      res.json({ message: 'Vérification des stocks effectuée' });
    } catch (error) {
      console.error('Check stock error:', error);
      res.status(500).json({ error: 'Erreur lors de la vérification' });
    }
  },
};

export default notificationsController;
