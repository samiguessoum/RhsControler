import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { facturationEvents, checkOverdueInvoices, checkLowStock } from '../services/events.service.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';


export const notificationsController = {
  // Liste des notifications
  async list(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'List notifications error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  // Marquer une notification comme lue
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const success = facturationEvents.markAsRead(id);

      if (!success) {
        return res.status(404).json({ error: 'Notification non trouvée' });
      }

      res.json({ message: 'Notification marquée comme lue' });
    } catch (error) {
      logger.error({ err: error }, 'Mark notification as read error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  // Marquer toutes les notifications comme lues
  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const count = facturationEvents.markAllAsRead(req.user?.id);
      res.json({ message: `${count} notifications marquées comme lues` });
    } catch (error) {
      logger.error({ err: error }, 'Mark all notifications as read error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  // Déclencher manuellement la vérification des retards
  async checkOverdue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await checkOverdueInvoices();
      res.json({ message: 'Vérification des retards effectuée' });
    } catch (error) {
      logger.error({ err: error }, 'Check overdue error');
      return next(new AppError(500, 'Erreur lors de la vérification'));
    }
  },

  // Déclencher manuellement la vérification des stocks bas
  async checkStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await checkLowStock();
      res.json({ message: 'Vérification des stocks effectuée' });
    } catch (error) {
      logger.error({ err: error }, 'Check stock error');
      return next(new AppError(500, 'Erreur lors de la vérification'));
    }
  },
};

export default notificationsController;
