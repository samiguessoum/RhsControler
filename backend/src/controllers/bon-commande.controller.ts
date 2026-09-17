import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import logger from '../lib/logger.js';
import planningService from '../services/planning.service.js';

export const bonCommandeController = {
  /**
   * GET /api/bons-commandes
   * Liste les BCs avec filtres optionnels
   */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { clientId, actif, enAlerte } = req.query;

      const where: any = {};
      if (clientId) where.clientId = clientId as string;
      if (actif !== undefined) where.actif = actif === 'true';

      const bcs = await prisma.bonCommande.findMany({
        where,
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          contrat: { select: { id: true, type: true, dateDebut: true, dateFin: true } },
          sites: { include: { site: { select: { id: true, nom: true } } } },
          _count: { select: { interventions: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Filtrer les BCs en alerte si demandé
      let result = bcs;
      if (enAlerte === 'true') {
        result = bcs.filter((bc) => {
          if (bc.quotaPassages === null) return false;
          return bc.quotaPassages - bc.passagesConsommes <= bc.seuilAlerte;
        });
      }

      res.json({ bonsCommandes: result, count: result.length });
    } catch (error) {
      logger.error({ err: error }, 'BonCommande list error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/bons-commandes
   * Créer un nouveau BC
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { numero, clientId, contratId, quotaPassages, seuilAlerte, notes, siteIds } = req.body;

      if (!numero?.trim()) {
        return next(new AppError(400, 'Le numéro du BC est requis'));
      }
      if (!clientId) {
        return next(new AppError(400, 'Le clientId est requis'));
      }

      // Vérifier que le client existe
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) {
        return next(new AppError(404, 'Client non trouvé'));
      }

      // Vérifier unicité numero + clientId
      const existing = await prisma.bonCommande.findFirst({
        where: { numero: numero.trim(), clientId },
      });
      if (existing) {
        return next(new AppError(409, `Un BC avec le numéro "${numero}" existe déjà pour ce client`));
      }

      const bc = await prisma.bonCommande.create({
        data: {
          numero: numero.trim(),
          clientId,
          contratId: contratId || null,
          quotaPassages: quotaPassages ? parseInt(quotaPassages) : null,
          seuilAlerte: seuilAlerte !== undefined ? parseInt(seuilAlerte) : 2,
          notes: notes || null,
          ...(siteIds?.length
            ? {
                sites: {
                  create: (siteIds as string[]).map((siteId) => ({ siteId })),
                },
              }
            : {}),
        },
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          sites: { include: { site: { select: { id: true, nom: true } } } },
        },
      });

      res.status(201).json({ bonCommande: bc });
    } catch (error) {
      logger.error({ err: error }, 'BonCommande create error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/bons-commandes/alertes
   * BCs en alerte (peu de passages restants)
   */
  async getAlerts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const bcs = await planningService.getBcsEnAlerte();
      res.json({ bonsCommandes: bcs, count: bcs.length });
    } catch (error) {
      logger.error({ err: error }, 'BonCommande getAlerts error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/bons-commandes/:id
   * Détail d'un BC avec interventions et sites
   */
  async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const bc = await prisma.bonCommande.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          contrat: { select: { id: true, type: true, dateDebut: true, dateFin: true, prestations: true } },
          sites: { include: { site: { select: { id: true, nom: true, adresse: true } } } },
          interventions: {
            include: {
              site: { select: { id: true, nom: true } },
            },
            orderBy: { datePrevue: 'desc' },
            take: 50,
          },
        },
      });

      if (!bc) {
        return next(new AppError(404, 'Bon de commande non trouvé'));
      }

      const passagesRestants = bc.quotaPassages !== null ? bc.quotaPassages - bc.passagesConsommes : null;

      res.json({ bonCommande: { ...bc, passagesRestants } });
    } catch (error) {
      logger.error({ err: error }, 'BonCommande getOne error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * PUT /api/bons-commandes/:id
   * Mettre à jour un BC
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { quotaPassages, notes, seuilAlerte, actif, numero } = req.body;

      const existing = await prisma.bonCommande.findUnique({ where: { id } });
      if (!existing) {
        return next(new AppError(404, 'Bon de commande non trouvé'));
      }

      const bc = await prisma.bonCommande.update({
        where: { id },
        data: {
          ...(numero !== undefined ? { numero: numero.trim() } : {}),
          ...(quotaPassages !== undefined ? { quotaPassages: quotaPassages === null ? null : parseInt(quotaPassages) } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(seuilAlerte !== undefined ? { seuilAlerte: parseInt(seuilAlerte) } : {}),
          ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
        },
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          sites: { include: { site: { select: { id: true, nom: true } } } },
        },
      });

      res.json({ bonCommande: bc });
    } catch (error) {
      logger.error({ err: error }, 'BonCommande update error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/bons-commandes/:id
   * Soft delete (set actif: false)
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const existing = await prisma.bonCommande.findUnique({ where: { id } });
      if (!existing) {
        return next(new AppError(404, 'Bon de commande non trouvé'));
      }

      await prisma.bonCommande.update({
        where: { id },
        data: { actif: false },
      });

      res.json({ message: 'Bon de commande désactivé' });
    } catch (error) {
      logger.error({ err: error }, 'BonCommande delete error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/bons-commandes/:id/sites
   * Ajouter un site au périmètre d'un BC
   */
  async addSite(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { siteId } = req.body;

      if (!siteId) {
        return next(new AppError(400, 'siteId requis'));
      }

      const bc = await prisma.bonCommande.findUnique({ where: { id } });
      if (!bc) {
        return next(new AppError(404, 'Bon de commande non trouvé'));
      }

      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (!site) {
        return next(new AppError(404, 'Site non trouvé'));
      }

      const bcSite = await prisma.bonCommandeSite.upsert({
        where: { bcId_siteId: { bcId: id, siteId } },
        create: { bcId: id, siteId },
        update: {},
        include: { site: { select: { id: true, nom: true } } },
      });

      res.status(201).json({ bonCommandeSite: bcSite });
    } catch (error) {
      logger.error({ err: error }, 'BonCommande addSite error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/bons-commandes/:id/sites/:siteId
   * Retirer un site du périmètre d'un BC
   */
  async removeSite(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id, siteId } = req.params;

      const bcSite = await prisma.bonCommandeSite.findUnique({
        where: { bcId_siteId: { bcId: id, siteId } },
      });
      if (!bcSite) {
        return next(new AppError(404, 'Association BC-Site non trouvée'));
      }

      await prisma.bonCommandeSite.delete({
        where: { bcId_siteId: { bcId: id, siteId } },
      });

      res.json({ message: 'Site retiré du bon de commande' });
    } catch (error) {
      logger.error({ err: error }, 'BonCommande removeSite error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default bonCommandeController;
