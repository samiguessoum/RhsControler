import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';


export const prestationController = {
  /**
   * GET /api/prestations
   */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { actif } = req.query;

      const where: any = {};
      if (actif !== undefined) {
        where.actif = actif === 'true';
      }

      const prestations = await prisma.prestation.findMany({
        where,
        orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      });

      res.json({ prestations });
    } catch (error) {
      logger.error({ err: error }, 'List prestations error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/prestations
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { nom, ordre, description } = req.body;

      // Vérifier unicité du nom
      const existing = await prisma.prestation.findUnique({
        where: { nom },
      });

      if (existing) {
        return res.status(400).json({ error: 'Cette prestation existe déjà' });
      }

      // Ordre par défaut = max + 1
      let ordreValue = ordre;
      if (ordreValue === undefined) {
        const maxOrdre = await prisma.prestation.aggregate({
          _max: { ordre: true },
        });
        ordreValue = (maxOrdre._max.ordre || 0) + 1;
      }

      const prestation = await prisma.prestation.create({
        data: { nom, ordre: ordreValue, description },
      });

      res.status(201).json({ prestation });
    } catch (error) {
      logger.error({ err: error }, 'Create prestation error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * PUT /api/prestations/:id
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { nom, ordre, actif, description } = req.body;

      const existing = await prisma.prestation.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Prestation non trouvée' });
      }

      // Vérifier unicité du nom si modifié
      if (nom && nom !== existing.nom) {
        const duplicate = await prisma.prestation.findUnique({
          where: { nom },
        });
        if (duplicate) {
          return res.status(400).json({ error: 'Cette prestation existe déjà' });
        }
      }

      const prestation = await prisma.prestation.update({
        where: { id },
        data: {
          nom: nom ?? existing.nom,
          ordre: ordre ?? existing.ordre,
          actif: actif ?? existing.actif,
          description: description ?? existing.description,
        },
      });

      res.json({ prestation });
    } catch (error) {
      logger.error({ err: error }, 'Update prestation error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/prestations/:id (désactivation)
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const existing = await prisma.prestation.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Prestation non trouvée' });
      }

      await prisma.prestation.delete({
        where: { id },
      });

      res.json({ message: 'Prestation supprimée' });
    } catch (error) {
      logger.error({ err: error }, 'Delete prestation error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default prestationController;
