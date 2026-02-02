import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';

export const stockController = {
  // ============ PRODUITS ============

  /**
   * GET /api/produits
   */
  async listProduits(req: AuthRequest, res: Response) {
    try {
      const { search, actif, stockBas } = req.query;

      const where: any = {};

      if (actif !== undefined) {
        where.actif = actif === 'true';
      }

      if (search) {
        where.OR = [
          { nom: { contains: search as string, mode: 'insensitive' } },
          { reference: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      let produits = await prisma.produit.findMany({
        where,
        orderBy: [{ nom: 'asc' }],
      });

      // Filtrer les produits en stock bas si demandé
      if (stockBas === 'true') {
        produits = produits.filter((p) => p.quantite <= p.stockMinimum);
      }

      res.json({ produits });
    } catch (error) {
      console.error('List produits error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/produits/:id
   */
  async getProduit(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const produit = await prisma.produit.findUnique({
        where: { id },
        include: {
          mouvements: {
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: {
              user: { select: { id: true, nom: true, prenom: true } },
              intervention: {
                select: {
                  id: true,
                  type: true,
                  datePrevue: true,
                  client: { select: { id: true, nomEntreprise: true } },
                },
              },
            },
          },
        },
      });

      if (!produit) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }

      res.json({ produit });
    } catch (error) {
      console.error('Get produit error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/produits
   */
  async createProduit(req: AuthRequest, res: Response) {
    try {
      const { reference, nom, description, unite, quantite, stockMinimum, prixUnitaire } = req.body;

      // Vérifier que la référence n'existe pas déjà
      const existing = await prisma.produit.findUnique({
        where: { reference },
      });

      if (existing) {
        return res.status(400).json({ error: 'Cette référence existe déjà' });
      }

      const produit = await prisma.produit.create({
        data: {
          reference,
          nom,
          description,
          unite: unite || 'unité',
          quantite: quantite || 0,
          stockMinimum: stockMinimum || 0,
          prixUnitaire,
        },
      });

      // Si quantité initiale > 0, créer un mouvement d'entrée
      if (quantite && quantite > 0) {
        await prisma.mouvementStock.create({
          data: {
            produitId: produit.id,
            type: 'ENTREE',
            quantite,
            quantiteAvant: 0,
            quantiteApres: quantite,
            motif: 'Stock initial',
            userId: req.user!.id,
          },
        });
      }

      await createAuditLog(req.user!.id, 'CREATE', 'Produit', produit.id, { after: produit });

      res.status(201).json({ produit });
    } catch (error) {
      console.error('Create produit error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/produits/:id
   */
  async updateProduit(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reference, nom, description, unite, stockMinimum, prixUnitaire, actif } = req.body;

      const existing = await prisma.produit.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }

      // Vérifier que la nouvelle référence n'existe pas déjà (si changée)
      if (reference && reference !== existing.reference) {
        const refExists = await prisma.produit.findUnique({
          where: { reference },
        });
        if (refExists) {
          return res.status(400).json({ error: 'Cette référence existe déjà' });
        }
      }

      const produit = await prisma.produit.update({
        where: { id },
        data: {
          reference: reference ?? existing.reference,
          nom: nom ?? existing.nom,
          description: description !== undefined ? description : existing.description,
          unite: unite ?? existing.unite,
          stockMinimum: stockMinimum !== undefined ? stockMinimum : existing.stockMinimum,
          prixUnitaire: prixUnitaire !== undefined ? prixUnitaire : existing.prixUnitaire,
          actif: actif !== undefined ? actif : existing.actif,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Produit', produit.id, {
        before: existing,
        after: produit,
      });

      res.json({ produit });
    } catch (error) {
      console.error('Update produit error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/produits/:id
   */
  async deleteProduit(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.produit.findUnique({
        where: { id },
        include: { _count: { select: { mouvements: true } } },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }

      // Si des mouvements existent, désactiver plutôt que supprimer
      if (existing._count.mouvements > 0) {
        await prisma.produit.update({
          where: { id },
          data: { actif: false },
        });
        return res.json({ message: 'Produit désactivé (historique conservé)' });
      }

      await prisma.produit.delete({ where: { id } });

      await createAuditLog(req.user!.id, 'DELETE', 'Produit', id);

      res.json({ message: 'Produit supprimé' });
    } catch (error) {
      console.error('Delete produit error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ MOUVEMENTS DE STOCK ============

  /**
   * GET /api/mouvements-stock
   */
  async listMouvements(req: AuthRequest, res: Response) {
    try {
      const { produitId, type, dateDebut, dateFin, page = '1', limit = '50' } = req.query;

      const where: any = {};

      if (produitId) where.produitId = produitId;
      if (type) where.type = type;

      if (dateDebut || dateFin) {
        where.createdAt = {};
        if (dateDebut) where.createdAt.gte = new Date(dateDebut as string);
        if (dateFin) where.createdAt.lte = new Date(dateFin as string);
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [mouvements, total] = await Promise.all([
        prisma.mouvementStock.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            produit: { select: { id: true, reference: true, nom: true, unite: true } },
            user: { select: { id: true, nom: true, prenom: true } },
            intervention: {
              select: {
                id: true,
                type: true,
                datePrevue: true,
                client: { select: { id: true, nomEntreprise: true } },
              },
            },
          },
        }),
        prisma.mouvementStock.count({ where }),
      ]);

      res.json({
        mouvements,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('List mouvements error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/mouvements-stock
   * Créer un mouvement de stock (entrée, sortie, ajustement)
   */
  async createMouvement(req: AuthRequest, res: Response) {
    try {
      const { produitId, type, quantite, motif, interventionId } = req.body;

      if (!produitId || !type || quantite === undefined || quantite <= 0) {
        return res.status(400).json({ error: 'Données invalides' });
      }

      const produit = await prisma.produit.findUnique({ where: { id: produitId } });

      if (!produit) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }

      if (!produit.actif) {
        return res.status(400).json({ error: 'Produit désactivé' });
      }

      const quantiteAvant = produit.quantite;
      let quantiteApres: number;

      switch (type) {
        case 'ENTREE':
          quantiteApres = quantiteAvant + quantite;
          break;
        case 'SORTIE':
          if (quantite > quantiteAvant) {
            return res.status(400).json({
              error: `Stock insuffisant. Disponible: ${quantiteAvant} ${produit.unite}`,
            });
          }
          quantiteApres = quantiteAvant - quantite;
          break;
        case 'AJUSTEMENT':
          quantiteApres = quantite; // L'ajustement définit la nouvelle quantité directement
          break;
        default:
          return res.status(400).json({ error: 'Type de mouvement invalide' });
      }

      // Créer le mouvement et mettre à jour le stock en transaction
      const [mouvement] = await prisma.$transaction([
        prisma.mouvementStock.create({
          data: {
            produitId,
            type,
            quantite: type === 'AJUSTEMENT' ? Math.abs(quantiteApres - quantiteAvant) : quantite,
            quantiteAvant,
            quantiteApres,
            motif,
            interventionId,
            userId: req.user!.id,
          },
          include: {
            produit: { select: { id: true, reference: true, nom: true, unite: true } },
            user: { select: { id: true, nom: true, prenom: true } },
          },
        }),
        prisma.produit.update({
          where: { id: produitId },
          data: { quantite: quantiteApres },
        }),
      ]);

      res.status(201).json({ mouvement });
    } catch (error) {
      console.error('Create mouvement error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ STATS / ALERTES ============

  /**
   * GET /api/stock/alertes
   * Produits en stock bas
   */
  async getAlertes(req: AuthRequest, res: Response) {
    try {
      const produits = await prisma.produit.findMany({
        where: {
          actif: true,
        },
        orderBy: { nom: 'asc' },
      });

      const alertes = produits
        .filter((p) => p.quantite <= p.stockMinimum)
        .map((p) => ({
          ...p,
          deficit: p.stockMinimum - p.quantite,
        }));

      res.json({
        alertes,
        count: alertes.length,
      });
    } catch (error) {
      console.error('Get alertes stock error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/stock/stats
   */
  async getStats(req: AuthRequest, res: Response) {
    try {
      const [totalProduits, produitsActifs, stockBas, mouvementsRecents] = await Promise.all([
        prisma.produit.count(),
        prisma.produit.count({ where: { actif: true } }),
        prisma.produit.count({
          where: {
            actif: true,
            quantite: { lte: prisma.produit.fields.stockMinimum },
          },
        }),
        prisma.mouvementStock.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 derniers jours
            },
          },
        }),
      ]);

      // Recalculer stock bas manuellement car Prisma ne supporte pas la comparaison de champs
      const allProduits = await prisma.produit.findMany({
        where: { actif: true },
        select: { quantite: true, stockMinimum: true },
      });
      const stockBasCount = allProduits.filter((p) => p.quantite <= p.stockMinimum).length;

      res.json({
        stats: {
          totalProduits,
          produitsActifs,
          stockBas: stockBasCount,
          mouvementsRecents,
        },
      });
    } catch (error) {
      console.error('Get stats stock error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default stockController;
