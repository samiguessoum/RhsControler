import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export const posteController = {
  /**
   * GET /api/postes
   */
  async list(req: AuthRequest, res: Response) {
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
      console.error('List postes error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/postes/:id
   */
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const poste = await prisma.poste.findUnique({ where: { id } });

      if (!poste) {
        return res.status(404).json({ error: 'Poste non trouvé' });
      }

      res.json({ poste });
    } catch (error) {
      console.error('Get poste error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/postes
   */
  async create(req: AuthRequest, res: Response) {
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
      console.error('Create poste error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/postes/:id
   */
  async update(req: AuthRequest, res: Response) {
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
      console.error('Update poste error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/postes/:id
   */
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.poste.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Poste non trouvé' });
      }

      await prisma.poste.delete({ where: { id } });
      res.json({ message: 'Poste supprimé' });
    } catch (error) {
      console.error('Delete poste error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default posteController;
