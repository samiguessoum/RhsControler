import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';


export const posteController = {
  /**
   * GET /api/postes
   */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { actif } = req.query;

      const where: any = {};
      if (actif !== undefined) {
        where.actif = actif === 'true';
      }

      const postes = await prisma.poste.findMany({
        where,
        orderBy: { nom: 'asc' },
      });

      res.json({ postes });
    } catch (error) {
      logger.error({ err: error }, 'List postes error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/postes/:id
   */
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const poste = await prisma.poste.findUnique({ where: { id } });

      if (!poste) {
        return res.status(404).json({ error: 'Poste non trouvé' });
      }

      res.json({ poste });
    } catch (error) {
      logger.error({ err: error }, 'Get poste error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/postes
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { nom } = req.body;

      const existing = await prisma.poste.findUnique({ where: { nom } });
      if (existing) {
        return res.status(400).json({ error: 'Ce poste existe déjà' });
      }

      const poste = await prisma.poste.create({
        data: { nom },
      });

      res.status(201).json({ poste });
    } catch (error) {
      logger.error({ err: error }, 'Create poste error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * PUT /api/postes/:id
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { nom, actif } = req.body;

      const existing = await prisma.poste.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Poste non trouvé' });
      }

      if (nom && nom !== existing.nom) {
        const duplicate = await prisma.poste.findUnique({ where: { nom } });
        if (duplicate) {
          return res.status(400).json({ error: 'Ce poste existe déjà' });
        }
      }

      const poste = await prisma.poste.update({
        where: { id },
        data: {
          nom: nom ?? existing.nom,
          actif: actif ?? existing.actif,
        },
      });

      res.json({ poste });
    } catch (error) {
      logger.error({ err: error }, 'Update poste error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/postes/:id
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const existing = await prisma.poste.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Poste non trouvé' });
      }

      await prisma.poste.delete({ where: { id } });
      res.json({ message: 'Poste supprimé' });
    } catch (error) {
      logger.error({ err: error }, 'Delete poste error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default posteController;
