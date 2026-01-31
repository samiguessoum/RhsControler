import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';

export const clientController = {
  /**
   * GET /api/clients
   */
  async list(req: AuthRequest, res: Response) {
    try {
      const { search, actif, page = '1', limit = '20' } = req.query;

      const where: any = {};

      if (actif !== undefined) {
        where.actif = actif === 'true';
      }

      if (search) {
        where.OR = [
          { nomEntreprise: { contains: search as string, mode: 'insensitive' } },
          {
            sites: {
              some: {
                OR: [
                  { nom: { contains: search as string, mode: 'insensitive' } },
                  { adresse: { contains: search as string, mode: 'insensitive' } },
                  { contactNom: { contains: search as string, mode: 'insensitive' } },
                  { email: { contains: search as string, mode: 'insensitive' } },
                  { tel: { contains: search as string, mode: 'insensitive' } },
                ],
              },
            },
          },
          {
            siegeContacts: {
              some: {
                OR: [
                  { nom: { contains: search as string, mode: 'insensitive' } },
                  { fonction: { contains: search as string, mode: 'insensitive' } },
                  { tel: { contains: search as string, mode: 'insensitive' } },
                  { email: { contains: search as string, mode: 'insensitive' } },
                ],
              },
            },
          },
        ];
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 20, 100);
      const skip = (pageNum - 1) * limitNum;

      const [clients, total] = await Promise.all([
        prisma.client.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { nomEntreprise: 'asc' },
          include: {
            siegeContacts: true,
            sites: true,
            _count: {
              select: { contrats: true, interventions: true },
            },
          },
        }),
        prisma.client.count({ where }),
      ]);

      res.json({
        clients,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('List clients error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/clients/:id
   */
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          siegeContacts: true,
          sites: true,
          contrats: {
            orderBy: { dateDebut: 'desc' },
            include: {
              responsablePlanning: {
                select: { id: true, nom: true, prenom: true },
              },
            },
          },
          interventions: {
            orderBy: { datePrevue: 'desc' },
            take: 20,
          },
        },
      });

      if (!client) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }

      res.json({ client });
    } catch (error) {
      console.error('Get client error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/clients
   */
  async create(req: AuthRequest, res: Response) {
    try {
      const data = req.body;

      const client = await prisma.client.create({
        data: {
          nomEntreprise: data.nomEntreprise,
          secteur: data.secteur,
          siegeNom: data.siegeNom,
          siegeAdresse: data.siegeAdresse,
          siegeTel: data.siegeTel,
          siegeEmail: data.siegeEmail || null,
          siegeNotes: data.siegeNotes,
          siegeRC: data.siegeRC,
          siegeNIF: data.siegeNIF,
          siegeAI: data.siegeAI,
          siegeNIS: data.siegeNIS,
          siegeTIN: data.siegeTIN,
          siegeContacts: {
            create: data.siegeContacts || [],
          },
          sites: {
            create: data.sites || [],
          },
        },
        include: { sites: true, siegeContacts: true },
      });

      // Audit log
      await createAuditLog(req.user!.id, 'CREATE', 'Client', client.id, { after: client });

      res.status(201).json({ client });
    } catch (error) {
      console.error('Create client error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/clients/:id
   */
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.client.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }

      const client = await prisma.client.update({
        where: { id },
        data: {
          nomEntreprise: data.nomEntreprise ?? existing.nomEntreprise,
          secteur: data.secteur ?? existing.secteur,
          siegeNom: data.siegeNom ?? existing.siegeNom,
          siegeAdresse: data.siegeAdresse ?? existing.siegeAdresse,
          siegeTel: data.siegeTel ?? existing.siegeTel,
          siegeEmail: data.siegeEmail ?? existing.siegeEmail,
          siegeNotes: data.siegeNotes ?? existing.siegeNotes,
          siegeRC: data.siegeRC ?? existing.siegeRC,
          siegeNIF: data.siegeNIF ?? existing.siegeNIF,
          siegeAI: data.siegeAI ?? existing.siegeAI,
          siegeNIS: data.siegeNIS ?? existing.siegeNIS,
          siegeTIN: data.siegeTIN ?? existing.siegeTIN,
          actif: data.actif ?? existing.actif,
          ...(data.siegeContacts
            ? {
                siegeContacts: {
                  deleteMany: {},
                  create: data.siegeContacts,
                },
              }
            : {}),
          ...(data.sites
            ? {
                sites: {
                  deleteMany: {},
                  create: data.sites,
                },
              }
            : {}),
        },
        include: { sites: true, siegeContacts: true },
      });

      // Audit log
      await createAuditLog(req.user!.id, 'UPDATE', 'Client', client.id, {
        before: existing,
        after: client,
      });

      res.json({ client });
    } catch (error) {
      console.error('Update client error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/clients/:id (désactivation)
   */
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.client.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }

      await prisma.$transaction([
        prisma.intervention.deleteMany({ where: { clientId: id } }),
        prisma.contratSite.deleteMany({ where: { contrat: { clientId: id } } }),
        prisma.contrat.deleteMany({ where: { clientId: id } }),
        prisma.site.deleteMany({ where: { clientId: id } }),
        prisma.siegeContact.deleteMany({ where: { clientId: id } }),
        prisma.client.delete({ where: { id } }),
      ]);

      // Audit log
      await createAuditLog(req.user!.id, 'DELETE', 'Client', id);

      res.json({ message: 'Client supprimé' });
    } catch (error) {
      console.error('Delete client error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default clientController;
