import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';


export const employeController = {
  /**
   * GET /api/employes
   */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const employes = await prisma.employe.findMany({
        include: { postes: true, _count: { select: { interventionEmployes: true } } },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      });

      res.json({ employes });
    } catch (error) {
      logger.error({ err: error }, 'List employes error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/employes/:id
   */
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const employe = await prisma.employe.findUnique({
        where: { id },
        include: { postes: true },
      });

      if (!employe) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      res.json({ employe });
    } catch (error) {
      logger.error({ err: error }, 'Get employe error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/employes
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { prenom, nom, posteIds } = req.body;

      const employe = await prisma.employe.create({
        data: {
          prenom,
          nom,
          postes: {
            connect: posteIds.map((id: string) => ({ id })),
          },
        },
        include: { postes: true },
      });

      res.status(201).json({ employe });
    } catch (error) {
      logger.error({ err: error }, 'Create employe error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * PUT /api/employes/:id
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { prenom, nom, posteIds } = req.body;

      const existing = await prisma.employe.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      const employe = await prisma.employe.update({
        where: { id },
        data: {
          prenom: prenom ?? existing.prenom,
          nom: nom ?? existing.nom,
          postes: posteIds
            ? {
                set: [],
                connect: posteIds.map((pid: string) => ({ id: pid })),
              }
            : undefined,
        },
        include: { postes: true },
      });

      res.json({ employe });
    } catch (error) {
      logger.error({ err: error }, 'Update employe error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/employes/:id
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.employe.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      await prisma.$transaction(async (tx) => {
        // Nullifier le lien User -> Employe avant suppression
        await tx.user.updateMany({ where: { employeId: id }, data: { employeId: null } });
        // Désaffecter l'employé de toutes ses interventions avant suppression
        await tx.interventionEmploye.deleteMany({ where: { employeId: id } });
        await tx.employe.delete({ where: { id } });
      });
      res.json({ message: 'Employé supprimé' });
    } catch (error) {
      logger.error({ err: error }, 'Delete employe error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default employeController;
