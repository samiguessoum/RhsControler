import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export const employeController = {
  /**
   * GET /api/employes
   */
  async list(req: AuthRequest, res: Response) {
    try {
      const employes = await prisma.employe.findMany({
        include: { postes: true },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      });

      res.json({ employes });
    } catch (error) {
      console.error('List employes error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/employes/:id
   */
  async get(req: AuthRequest, res: Response) {
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
      console.error('Get employe error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/employes
   */
  async create(req: AuthRequest, res: Response) {
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
      console.error('Create employe error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/employes/:id
   */
  async update(req: AuthRequest, res: Response) {
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
      console.error('Update employe error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/employes/:id
   */
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const existing = await prisma.employe.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      await prisma.employe.delete({ where: { id } });
      res.json({ message: 'Employé supprimé' });
    } catch (error) {
      console.error('Delete employe error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default employeController;
