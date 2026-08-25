import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

export const reclamationController = {
  // GET /api/sites/:siteId/reclamations
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params;
      const reclamations = await prisma.reclamation.findMany({
        where: { siteId },
        include: { createdBy: { select: { id: true, prenom: true, nom: true } } },
        orderBy: { date: 'desc' },
      });
      res.json({ reclamations });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/sites/:siteId/reclamations
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params;
      const { commentaire, date } = req.body;
      if (!commentaire?.trim()) throw new AppError(400, 'Le commentaire est requis');

      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (!site) throw new AppError(404, 'Site introuvable');

      const reclamation = await prisma.reclamation.create({
        data: {
          siteId,
          commentaire: commentaire.trim(),
          date: date ? new Date(date) : new Date(),
          createdById: req.user!.id,
        },
        include: { createdBy: { select: { id: true, prenom: true, nom: true } } },
      });
      res.status(201).json({ reclamation });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/reclamations/:id
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { commentaire, statut, date } = req.body;

      const existing = await prisma.reclamation.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Réclamation introuvable');

      const reclamation = await prisma.reclamation.update({
        where: { id },
        data: {
          ...(commentaire !== undefined && { commentaire: commentaire.trim() }),
          ...(statut !== undefined && { statut }),
          ...(date !== undefined && { date: new Date(date) }),
        },
        include: { createdBy: { select: { id: true, prenom: true, nom: true } } },
      });
      res.json({ reclamation });
    } catch (err) {
      next(err);
    }
  },

  // DELETE /api/reclamations/:id
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.reclamation.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, 'Réclamation introuvable');
      await prisma.reclamation.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
