import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';

export const produitsServicesController = {
  // ============ PRODUITS/SERVICES ============

  /**
   * GET /api/produits-services
   * Liste tous les produits et services avec filtres
   */
  async list(req: AuthRequest, res: Response) {
    try {
      const {
        search,
        type,
        categorieId,
        fournisseurId,
        actif,
        stockBas,
        enVente,
        enAchat,
        page = '1',
        limit = '50'
      } = req.query;

      const where: any = {};

      if (actif !== undefined) {
        where.actif = actif === 'true';
      }

      if (type) {
        where.type = type;
      }

      if (fournisseurId) {
        where.fournisseurId = fournisseurId;
      }

      if (enVente !== undefined) {
        where.enVente = enVente === 'true';
      }

      if (enAchat !== undefined) {
        where.enAchat = enAchat === 'true';
      }

      if (search) {
        where.OR = [
          { nom: { contains: search as string, mode: 'insensitive' } },
          { reference: { contains: search as string, mode: 'insensitive' } },
          { codeBarres: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      if (categorieId) {
        where.categories = {
          some: { categorieId: categorieId as string }
        };
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [produits, total] = await Promise.all([
        prisma.produitService.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: [{ nom: 'asc' }],
          include: {
            categories: {
              include: {
                categorie: { select: { id: true, nom: true, couleur: true } }
              }
            },
            fournisseur: { select: { id: true, nomEntreprise: true } },
            fournisseursDefaut: {
              include: {
                fournisseur: { select: { id: true, nomEntreprise: true } }
              },
              orderBy: { ordre: 'asc' }
            },
            _count: {
              select: {
                prixFournisseurs: true,
                prixClients: true,
                stocks: true,
              }
            }
          }
        }),
        prisma.produitService.count({ where })
      ]);

      // Filtrer les produits en stock bas si demandé
      let result = produits;
      if (stockBas === 'true') {
        result = produits.filter((p) => p.aStock && p.quantite <= p.stockMinimum);
      }

      res.json({
        produits: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: stockBas === 'true' ? result.length : total,
          totalPages: Math.ceil((stockBas === 'true' ? result.length : total) / limitNum),
        }
      });
    } catch (error) {
      console.error('List produits-services error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/produits-services/:id
   */
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const produit = await prisma.produitService.findUnique({
        where: { id },
        include: {
          categories: {
            include: {
              categorie: true
            }
          },
          fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
          fournisseursDefaut: {
            include: {
              fournisseur: { select: { id: true, nomEntreprise: true, code: true } }
            },
            orderBy: { ordre: 'asc' }
          },
          prixFournisseurs: {
            where: { actif: true },
            include: {
              fournisseur: { select: { id: true, nomEntreprise: true, code: true } }
            },
            orderBy: { estDefaut: 'desc' }
          },
          prixClients: {
            where: { actif: true },
            include: {
              client: { select: { id: true, nomEntreprise: true, code: true } }
            }
          },
          stocks: {
            include: {
              entrepot: { select: { id: true, code: true, nom: true } }
            }
          },
          lots: {
            where: { actif: true },
            orderBy: { datePeremption: 'asc' }
          },
          mouvements: {
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: {
              user: { select: { id: true, nom: true, prenom: true } },
              entrepot: { select: { id: true, code: true, nom: true } },
            }
          }
        }
      });

      if (!produit) {
        return res.status(404).json({ error: 'Produit/Service non trouvé' });
      }

      res.json({ produit });
    } catch (error) {
      console.error('Get produit-service error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/produits-services
   */
  async create(req: AuthRequest, res: Response) {
    try {
      const {
        reference,
        codeBarres,
        nom,
        description,
        descriptionLongue,
        type,
        nature,
        unite,
        uniteAchat,
        ratioUnites,
        prixVenteHT,
        tauxTVA,
        prixAchatHT,
        margeParDefaut,
        aStock,
        quantite,
        stockMinimum,
        stockMaximum,
        lotSuivi,
        dlcSuivi,
        dureeService,
        fournisseurId,
        fournisseursDefaut,
        delaiLivraison,
        marque,
        modele,
        poids,
        longueur,
        largeur,
        hauteur,
        compteVente,
        compteAchat,
        notePublique,
        notePrivee,
        urlExterne,
        enVente,
        enAchat,
        categorieIds,
      } = req.body;

      // Vérifier que la référence n'existe pas déjà
      const existingRef = await prisma.produitService.findUnique({
        where: { reference },
      });

      if (existingRef) {
        return res.status(400).json({ error: 'Cette référence existe déjà' });
      }

      // Vérifier le code-barres s'il est fourni
      if (codeBarres) {
        const existingBarcode = await prisma.produitService.findUnique({
          where: { codeBarres },
        });
        if (existingBarcode) {
          return res.status(400).json({ error: 'Ce code-barres existe déjà' });
        }
      }

      // Calculer le prix TTC si prix HT et taux TVA fournis
      const calculatedPrixTTC = prixVenteHT && tauxTVA !== undefined
        ? prixVenteHT * (1 + tauxTVA / 100)
        : undefined;

      const produit = await prisma.produitService.create({
        data: {
          reference,
          codeBarres,
          nom,
          description,
          descriptionLongue,
          type: type || 'PRODUIT',
          nature,
          unite: unite || 'unité',
          uniteAchat,
          ratioUnites,
          prixVenteHT,
          tauxTVA: tauxTVA ?? 19,
          prixVenteTTC: calculatedPrixTTC,
          prixAchatHT,
          margeParDefaut,
          aStock: type === 'SERVICE' ? false : (aStock ?? true),
          quantite: quantite || 0,
          stockMinimum: stockMinimum || 0,
          stockMaximum,
          lotSuivi: lotSuivi || false,
          dlcSuivi: dlcSuivi || false,
          dureeService,
          fournisseurId,
          delaiLivraison,
          marque,
          modele,
          poids,
          longueur,
          largeur,
          hauteur,
          compteVente,
          compteAchat,
          notePublique,
          notePrivee,
          urlExterne,
          enVente: enVente ?? true,
          enAchat: enAchat ?? true,
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
        }
      });

      if (fournisseursDefaut && fournisseursDefaut.length > 0) {
        await prisma.produitFournisseurDefaut.createMany({
          data: fournisseursDefaut.map((fd: { fournisseurId: string; ordre?: number }) => ({
            produitId: produit.id,
            fournisseurId: fd.fournisseurId,
            ordre: fd.ordre || 1,
          })),
        });
      }

      // Ajouter les catégories si fournies
      if (categorieIds && categorieIds.length > 0) {
        await prisma.produitServiceCategorie.createMany({
          data: categorieIds.map((catId: string) => ({
            produitId: produit.id,
            categorieId: catId,
          })),
        });
      }

      // Créer un mouvement de stock initial si quantité > 0 et type PRODUIT
      if (quantite && quantite > 0 && produit.aStock) {
        // Trouver l'entrepôt par défaut
        const entrepotDefaut = await prisma.entrepot.findFirst({
          where: { estDefaut: true, actif: true },
        });

        await prisma.mouvementStock.create({
          data: {
            produitServiceId: produit.id,
            entrepotId: entrepotDefaut?.id,
            type: 'ENTREE',
            quantite,
            quantiteAvant: 0,
            quantiteApres: quantite,
            motif: 'Stock initial',
            userId: req.user!.id,
          },
        });

        // Créer le stock dans l'entrepôt par défaut si existe
        if (entrepotDefaut) {
          await prisma.stockEntrepot.create({
            data: {
              produitId: produit.id,
              entrepotId: entrepotDefaut.id,
              quantite,
            },
          });
        }
      }

      await createAuditLog(req.user!.id, 'CREATE', 'ProduitService', produit.id, { after: produit });

      // Récupérer le produit complet avec ses relations
      const produitComplet = await prisma.produitService.findUnique({
        where: { id: produit.id },
        include: {
          categories: {
            include: { categorie: { select: { id: true, nom: true, couleur: true } } }
          },
          fournisseur: { select: { id: true, nomEntreprise: true } },
          fournisseursDefaut: {
            include: { fournisseur: { select: { id: true, nomEntreprise: true } } },
            orderBy: { ordre: 'asc' }
          },
        }
      });

      res.status(201).json({ produit: produitComplet });
    } catch (error) {
      console.error('Create produit-service error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/produits-services/:id
   */
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        reference,
        codeBarres,
        nom,
        description,
        descriptionLongue,
        type,
        nature,
        unite,
        uniteAchat,
        ratioUnites,
        prixVenteHT,
        tauxTVA,
        prixAchatHT,
        margeParDefaut,
        aStock,
        stockMinimum,
        stockMaximum,
        lotSuivi,
        dlcSuivi,
        dureeService,
        fournisseurId,
        fournisseursDefaut,
        delaiLivraison,
        marque,
        modele,
        poids,
        longueur,
        largeur,
        hauteur,
        compteVente,
        compteAchat,
        notePublique,
        notePrivee,
        urlExterne,
        enVente,
        enAchat,
        actif,
        categorieIds,
      } = req.body;

      const existing = await prisma.produitService.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Produit/Service non trouvé' });
      }

      // Vérifier la référence si changée
      if (reference && reference !== existing.reference) {
        const refExists = await prisma.produitService.findUnique({
          where: { reference },
        });
        if (refExists) {
          return res.status(400).json({ error: 'Cette référence existe déjà' });
        }
      }

      // Vérifier le code-barres si changé
      if (codeBarres && codeBarres !== existing.codeBarres) {
        const barcodeExists = await prisma.produitService.findUnique({
          where: { codeBarres },
        });
        if (barcodeExists) {
          return res.status(400).json({ error: 'Ce code-barres existe déjà' });
        }
      }

      // Calculer le prix TTC
      const newPrixVenteHT = prixVenteHT !== undefined ? prixVenteHT : existing.prixVenteHT;
      const newTauxTVA = tauxTVA !== undefined ? tauxTVA : existing.tauxTVA;
      const calculatedPrixTTC = newPrixVenteHT && newTauxTVA !== null
        ? newPrixVenteHT * (1 + (newTauxTVA || 0) / 100)
        : undefined;

      const produit = await prisma.produitService.update({
        where: { id },
        data: {
          reference: reference ?? existing.reference,
          codeBarres: codeBarres !== undefined ? codeBarres : existing.codeBarres,
          nom: nom ?? existing.nom,
          description: description !== undefined ? description : existing.description,
          descriptionLongue: descriptionLongue !== undefined ? descriptionLongue : existing.descriptionLongue,
          type: type ?? existing.type,
          nature: nature !== undefined ? nature : existing.nature,
          unite: unite ?? existing.unite,
          uniteAchat: uniteAchat !== undefined ? uniteAchat : existing.uniteAchat,
          ratioUnites: ratioUnites !== undefined ? ratioUnites : existing.ratioUnites,
          prixVenteHT: prixVenteHT !== undefined ? prixVenteHT : existing.prixVenteHT,
          tauxTVA: tauxTVA !== undefined ? tauxTVA : existing.tauxTVA,
          prixVenteTTC: calculatedPrixTTC,
          prixAchatHT: prixAchatHT !== undefined ? prixAchatHT : existing.prixAchatHT,
          margeParDefaut: margeParDefaut !== undefined ? margeParDefaut : existing.margeParDefaut,
          aStock: aStock !== undefined ? aStock : existing.aStock,
          stockMinimum: stockMinimum !== undefined ? stockMinimum : existing.stockMinimum,
          stockMaximum: stockMaximum !== undefined ? stockMaximum : existing.stockMaximum,
          lotSuivi: lotSuivi !== undefined ? lotSuivi : existing.lotSuivi,
          dlcSuivi: dlcSuivi !== undefined ? dlcSuivi : existing.dlcSuivi,
          dureeService: dureeService !== undefined ? dureeService : existing.dureeService,
          fournisseurId: fournisseurId !== undefined ? fournisseurId : existing.fournisseurId,
          delaiLivraison: delaiLivraison !== undefined ? delaiLivraison : existing.delaiLivraison,
          marque: marque !== undefined ? marque : existing.marque,
          modele: modele !== undefined ? modele : existing.modele,
          poids: poids !== undefined ? poids : existing.poids,
          longueur: longueur !== undefined ? longueur : existing.longueur,
          largeur: largeur !== undefined ? largeur : existing.largeur,
          hauteur: hauteur !== undefined ? hauteur : existing.hauteur,
          compteVente: compteVente !== undefined ? compteVente : existing.compteVente,
          compteAchat: compteAchat !== undefined ? compteAchat : existing.compteAchat,
          notePublique: notePublique !== undefined ? notePublique : existing.notePublique,
          notePrivee: notePrivee !== undefined ? notePrivee : existing.notePrivee,
          urlExterne: urlExterne !== undefined ? urlExterne : existing.urlExterne,
          enVente: enVente !== undefined ? enVente : existing.enVente,
          enAchat: enAchat !== undefined ? enAchat : existing.enAchat,
          actif: actif !== undefined ? actif : existing.actif,
        },
      });

      // Mettre à jour les catégories si fournies
      if (categorieIds !== undefined) {
        // Supprimer les anciennes associations
        await prisma.produitServiceCategorie.deleteMany({
          where: { produitId: id },
        });
        // Créer les nouvelles
        if (categorieIds.length > 0) {
          await prisma.produitServiceCategorie.createMany({
            data: categorieIds.map((catId: string) => ({
              produitId: id,
              categorieId: catId,
            })),
          });
        }
      }

      if (fournisseursDefaut !== undefined) {
        await prisma.produitFournisseurDefaut.deleteMany({
          where: { produitId: id },
        });
        if (fournisseursDefaut.length > 0) {
          await prisma.produitFournisseurDefaut.createMany({
            data: fournisseursDefaut.map((fd: { fournisseurId: string; ordre?: number }) => ({
              produitId: id,
              fournisseurId: fd.fournisseurId,
              ordre: fd.ordre || 1,
            })),
          });
        }
      }

      await createAuditLog(req.user!.id, 'UPDATE', 'ProduitService', produit.id, {
        before: existing,
        after: produit,
      });

      // Récupérer le produit mis à jour avec ses relations
      const produitComplet = await prisma.produitService.findUnique({
        where: { id },
        include: {
          categories: {
            include: { categorie: { select: { id: true, nom: true, couleur: true } } }
          },
          fournisseur: { select: { id: true, nomEntreprise: true } },
          fournisseursDefaut: {
            include: { fournisseur: { select: { id: true, nomEntreprise: true } } },
            orderBy: { ordre: 'asc' }
          },
        }
      });

      res.json({ produit: produitComplet });
    } catch (error) {
      console.error('Update produit-service error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/produits-services/:id
   */
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.produitService.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Produit/Service non trouvé' });
      }

      await prisma.$transaction([
        // Détacher le produit des documents commerciaux pour conserver l'historique
        prisma.devisLigne.updateMany({ where: { produitServiceId: id }, data: { produitServiceId: null } }),
        prisma.commandeLigne.updateMany({ where: { produitServiceId: id }, data: { produitServiceId: null } }),
        prisma.factureLigne.updateMany({ where: { produitServiceId: id }, data: { produitServiceId: null } }),
        prisma.commandeFournisseurLigne.updateMany({ where: { produitServiceId: id }, data: { produitServiceId: null } }),
        prisma.factureFournisseurLigne.updateMany({ where: { produitServiceId: id }, data: { produitServiceId: null } }),
        prisma.mouvementStock.updateMany({ where: { produitServiceId: id }, data: { produitServiceId: null } }),

        // Nettoyage des données internes
        prisma.stockEntrepot.deleteMany({ where: { produitId: id } }),
        prisma.lotProduit.deleteMany({ where: { produitId: id } }),
        prisma.prixFournisseur.deleteMany({ where: { produitId: id } }),
        prisma.prixClient.deleteMany({ where: { produitId: id } }),
        prisma.produitServiceCategorie.deleteMany({ where: { produitId: id } }),
        prisma.produitFournisseurDefaut.deleteMany({ where: { produitId: id } }),

        // Supprimer le produit
        prisma.produitService.delete({ where: { id } }),
      ]);

      await createAuditLog(req.user!.id, 'DELETE', 'ProduitService', id);

      res.json({ message: 'Produit/Service supprimé' });
    } catch (error) {
      console.error('Delete produit-service error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ CATEGORIES ============

  /**
   * GET /api/categories-produits
   */
  async listCategories(req: AuthRequest, res: Response) {
    try {
      const { search, actif, parentId } = req.query;

      const where: any = {};

      if (actif !== undefined) {
        where.actif = actif === 'true';
      }

      if (parentId === 'null') {
        where.parentId = null; // Catégories racines
      } else if (parentId) {
        where.parentId = parentId;
      }

      if (search) {
        where.OR = [
          { nom: { contains: search as string, mode: 'insensitive' } },
          { code: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const categories = await prisma.categorieProduit.findMany({
        where,
        orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
        include: {
          parent: { select: { id: true, nom: true } },
          enfants: { select: { id: true, nom: true, couleur: true } },
          _count: { select: { produits: true, enfants: true } },
        },
      });

      res.json({ categories });
    } catch (error) {
      console.error('List categories error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/categories-produits/:id
   */
  async getCategorie(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const categorie = await prisma.categorieProduit.findUnique({
        where: { id },
        include: {
          parent: true,
          enfants: {
            orderBy: { ordre: 'asc' },
          },
          produits: {
            include: {
              produit: { select: { id: true, reference: true, nom: true, type: true } },
            },
          },
        },
      });

      if (!categorie) {
        return res.status(404).json({ error: 'Catégorie non trouvée' });
      }

      res.json({ categorie });
    } catch (error) {
      console.error('Get categorie error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/categories-produits
   */
  async createCategorie(req: AuthRequest, res: Response) {
    try {
      const { code, nom, description, parentId, couleur, icone, ordre } = req.body;

      // Vérifier le code s'il est fourni
      if (code) {
        const existing = await prisma.categorieProduit.findUnique({ where: { code } });
        if (existing) {
          return res.status(400).json({ error: 'Ce code existe déjà' });
        }
      }

      const categorie = await prisma.categorieProduit.create({
        data: {
          code,
          nom,
          description,
          parentId,
          couleur,
          icone,
          ordre: ordre || 0,
        },
        include: {
          parent: { select: { id: true, nom: true } },
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'CategorieProduit', categorie.id, { after: categorie });

      res.status(201).json({ categorie });
    } catch (error) {
      console.error('Create categorie error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/categories-produits/:id
   */
  async updateCategorie(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { code, nom, description, parentId, couleur, icone, ordre, actif } = req.body;

      const existing = await prisma.categorieProduit.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Catégorie non trouvée' });
      }

      // Vérifier le code si changé
      if (code && code !== existing.code) {
        const codeExists = await prisma.categorieProduit.findUnique({ where: { code } });
        if (codeExists) {
          return res.status(400).json({ error: 'Ce code existe déjà' });
        }
      }

      // Empêcher la catégorie d'être son propre parent
      if (parentId === id) {
        return res.status(400).json({ error: 'Une catégorie ne peut pas être son propre parent' });
      }

      const categorie = await prisma.categorieProduit.update({
        where: { id },
        data: {
          code: code !== undefined ? code : existing.code,
          nom: nom ?? existing.nom,
          description: description !== undefined ? description : existing.description,
          parentId: parentId !== undefined ? parentId : existing.parentId,
          couleur: couleur !== undefined ? couleur : existing.couleur,
          icone: icone !== undefined ? icone : existing.icone,
          ordre: ordre !== undefined ? ordre : existing.ordre,
          actif: actif !== undefined ? actif : existing.actif,
        },
        include: {
          parent: { select: { id: true, nom: true } },
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'CategorieProduit', categorie.id, {
        before: existing,
        after: categorie,
      });

      res.json({ categorie });
    } catch (error) {
      console.error('Update categorie error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/categories-produits/:id
   */
  async deleteCategorie(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.categorieProduit.findUnique({
        where: { id },
        include: { _count: { select: { produits: true, enfants: true } } },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Catégorie non trouvée' });
      }

      // Si des produits ou enfants existent, désactiver plutôt que supprimer
      if (existing._count.produits > 0 || existing._count.enfants > 0) {
        await prisma.categorieProduit.update({
          where: { id },
          data: { actif: false },
        });
        return res.json({ message: 'Catégorie désactivée (contient des éléments)' });
      }

      await prisma.categorieProduit.delete({ where: { id } });

      await createAuditLog(req.user!.id, 'DELETE', 'CategorieProduit', id);

      res.json({ message: 'Catégorie supprimée' });
    } catch (error) {
      console.error('Delete categorie error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ ENTREPOTS ============

  /**
   * GET /api/entrepots
   */
  async listEntrepots(req: AuthRequest, res: Response) {
    try {
      const { search, actif } = req.query;

      const where: any = {};

      if (actif !== undefined) {
        where.actif = actif === 'true';
      }

      if (search) {
        where.OR = [
          { nom: { contains: search as string, mode: 'insensitive' } },
          { code: { contains: search as string, mode: 'insensitive' } },
          { ville: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const entrepots = await prisma.entrepot.findMany({
        where,
        orderBy: [{ estDefaut: 'desc' }, { nom: 'asc' }],
        include: {
          _count: { select: { stocks: true } },
        },
      });

      res.json({ entrepots });
    } catch (error) {
      console.error('List entrepots error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/entrepots/:id
   */
  async getEntrepot(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const entrepot = await prisma.entrepot.findUnique({
        where: { id },
        include: {
          stocks: {
            include: {
              produit: { select: { id: true, reference: true, nom: true, unite: true } },
            },
            orderBy: { produit: { nom: 'asc' } },
          },
        },
      });

      if (!entrepot) {
        return res.status(404).json({ error: 'Entrepôt non trouvé' });
      }

      res.json({ entrepot });
    } catch (error) {
      console.error('Get entrepot error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/entrepots
   */
  async createEntrepot(req: AuthRequest, res: Response) {
    try {
      const { code, nom, description, adresse, codePostal, ville, pays, responsable, tel, email, estDefaut } = req.body;

      // Vérifier le code
      const existing = await prisma.entrepot.findUnique({ where: { code } });
      if (existing) {
        return res.status(400).json({ error: 'Ce code existe déjà' });
      }

      // Si c'est l'entrepôt par défaut, retirer le défaut des autres
      if (estDefaut) {
        await prisma.entrepot.updateMany({
          where: { estDefaut: true },
          data: { estDefaut: false },
        });
      }

      const entrepot = await prisma.entrepot.create({
        data: {
          code,
          nom,
          description,
          adresse,
          codePostal,
          ville,
          pays: pays || 'Algérie',
          responsable,
          tel,
          email,
          estDefaut: estDefaut || false,
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Entrepot', entrepot.id, { after: entrepot });

      res.status(201).json({ entrepot });
    } catch (error) {
      console.error('Create entrepot error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/entrepots/:id
   */
  async updateEntrepot(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { code, nom, description, adresse, codePostal, ville, pays, responsable, tel, email, estDefaut, actif } = req.body;

      const existing = await prisma.entrepot.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Entrepôt non trouvé' });
      }

      // Vérifier le code si changé
      if (code && code !== existing.code) {
        const codeExists = await prisma.entrepot.findUnique({ where: { code } });
        if (codeExists) {
          return res.status(400).json({ error: 'Ce code existe déjà' });
        }
      }

      // Si c'est l'entrepôt par défaut, retirer le défaut des autres
      if (estDefaut && !existing.estDefaut) {
        await prisma.entrepot.updateMany({
          where: { estDefaut: true, id: { not: id } },
          data: { estDefaut: false },
        });
      }

      const entrepot = await prisma.entrepot.update({
        where: { id },
        data: {
          code: code ?? existing.code,
          nom: nom ?? existing.nom,
          description: description !== undefined ? description : existing.description,
          adresse: adresse !== undefined ? adresse : existing.adresse,
          codePostal: codePostal !== undefined ? codePostal : existing.codePostal,
          ville: ville !== undefined ? ville : existing.ville,
          pays: pays !== undefined ? pays : existing.pays,
          responsable: responsable !== undefined ? responsable : existing.responsable,
          tel: tel !== undefined ? tel : existing.tel,
          email: email !== undefined ? email : existing.email,
          estDefaut: estDefaut !== undefined ? estDefaut : existing.estDefaut,
          actif: actif !== undefined ? actif : existing.actif,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Entrepot', entrepot.id, {
        before: existing,
        after: entrepot,
      });

      res.json({ entrepot });
    } catch (error) {
      console.error('Update entrepot error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/entrepots/:id
   */
  async deleteEntrepot(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.entrepot.findUnique({
        where: { id },
        include: { _count: { select: { stocks: true, mouvements: true } } },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Entrepôt non trouvé' });
      }

      if (existing.estDefaut) {
        return res.status(400).json({ error: 'Impossible de supprimer l\'entrepôt par défaut' });
      }

      if (existing._count.stocks > 0 || existing._count.mouvements > 0) {
        await prisma.entrepot.update({
          where: { id },
          data: { actif: false },
        });
        return res.json({ message: 'Entrepôt désactivé (contient des stocks)' });
      }

      await prisma.entrepot.delete({ where: { id } });

      await createAuditLog(req.user!.id, 'DELETE', 'Entrepot', id);

      res.json({ message: 'Entrepôt supprimé' });
    } catch (error) {
      console.error('Delete entrepot error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ PRIX FOURNISSEURS ============

  /**
   * GET /api/prix-fournisseurs
   */
  async listPrixFournisseurs(req: AuthRequest, res: Response) {
    try {
      const { produitId, fournisseurId, actif } = req.query;

      const where: any = {};

      if (produitId) where.produitId = produitId;
      if (fournisseurId) where.fournisseurId = fournisseurId;
      if (actif !== undefined) where.actif = actif === 'true';

      const prix = await prisma.prixFournisseur.findMany({
        where,
        orderBy: [{ estDefaut: 'desc' }, { prixAchatHT: 'asc' }],
        include: {
          produit: { select: { id: true, reference: true, nom: true } },
          fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
        },
      });

      res.json({ prix });
    } catch (error) {
      console.error('List prix fournisseurs error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/prix-fournisseurs
   */
  async createPrixFournisseur(req: AuthRequest, res: Response) {
    try {
      const { produitId, fournisseurId, refFournisseur, prixAchatHT, remise, quantiteMin, delaiLivraison, dateDebut, dateFin, estDefaut, notes } = req.body;

      // Vérifier que le couple produit/fournisseur n'existe pas
      const existing = await prisma.prixFournisseur.findUnique({
        where: { produitId_fournisseurId: { produitId, fournisseurId } },
      });

      if (existing) {
        return res.status(400).json({ error: 'Ce fournisseur a déjà un prix pour ce produit' });
      }

      // Si c'est le prix par défaut, retirer le défaut des autres
      if (estDefaut) {
        await prisma.prixFournisseur.updateMany({
          where: { produitId, estDefaut: true },
          data: { estDefaut: false },
        });
      }

      const prix = await prisma.prixFournisseur.create({
        data: {
          produitId,
          fournisseurId,
          refFournisseur,
          prixAchatHT,
          remise: remise || 0,
          quantiteMin: quantiteMin || 1,
          delaiLivraison,
          dateDebut: dateDebut ? new Date(dateDebut) : undefined,
          dateFin: dateFin ? new Date(dateFin) : undefined,
          estDefaut: estDefaut || false,
          notes,
        },
        include: {
          produit: { select: { id: true, reference: true, nom: true } },
          fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
        },
      });

      res.status(201).json({ prix });
    } catch (error) {
      console.error('Create prix fournisseur error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/prix-fournisseurs/:id
   */
  async updatePrixFournisseur(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { refFournisseur, prixAchatHT, remise, quantiteMin, delaiLivraison, dateDebut, dateFin, estDefaut, notes, actif } = req.body;

      const existing = await prisma.prixFournisseur.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Prix fournisseur non trouvé' });
      }

      // Si c'est le prix par défaut, retirer le défaut des autres
      if (estDefaut && !existing.estDefaut) {
        await prisma.prixFournisseur.updateMany({
          where: { produitId: existing.produitId, estDefaut: true, id: { not: id } },
          data: { estDefaut: false },
        });
      }

      const prix = await prisma.prixFournisseur.update({
        where: { id },
        data: {
          refFournisseur: refFournisseur !== undefined ? refFournisseur : existing.refFournisseur,
          prixAchatHT: prixAchatHT !== undefined ? prixAchatHT : existing.prixAchatHT,
          remise: remise !== undefined ? remise : existing.remise,
          quantiteMin: quantiteMin !== undefined ? quantiteMin : existing.quantiteMin,
          delaiLivraison: delaiLivraison !== undefined ? delaiLivraison : existing.delaiLivraison,
          dateDebut: dateDebut !== undefined ? (dateDebut ? new Date(dateDebut) : null) : existing.dateDebut,
          dateFin: dateFin !== undefined ? (dateFin ? new Date(dateFin) : null) : existing.dateFin,
          estDefaut: estDefaut !== undefined ? estDefaut : existing.estDefaut,
          notes: notes !== undefined ? notes : existing.notes,
          actif: actif !== undefined ? actif : existing.actif,
        },
        include: {
          produit: { select: { id: true, reference: true, nom: true } },
          fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
        },
      });

      res.json({ prix });
    } catch (error) {
      console.error('Update prix fournisseur error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/prix-fournisseurs/:id
   */
  async deletePrixFournisseur(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.prixFournisseur.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Prix fournisseur non trouvé' });
      }

      await prisma.prixFournisseur.delete({ where: { id } });

      res.json({ message: 'Prix fournisseur supprimé' });
    } catch (error) {
      console.error('Delete prix fournisseur error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ PRIX CLIENTS ============

  /**
   * GET /api/prix-clients
   */
  async listPrixClients(req: AuthRequest, res: Response) {
    try {
      const { produitId, clientId, actif } = req.query;

      const where: any = {};

      if (produitId) where.produitId = produitId;
      if (clientId) where.clientId = clientId;
      if (actif !== undefined) where.actif = actif === 'true';

      const prix = await prisma.prixClient.findMany({
        where,
        orderBy: { prixVenteHT: 'asc' },
        include: {
          produit: { select: { id: true, reference: true, nom: true } },
          client: { select: { id: true, nomEntreprise: true, code: true } },
        },
      });

      res.json({ prix });
    } catch (error) {
      console.error('List prix clients error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/prix-clients
   */
  async createPrixClient(req: AuthRequest, res: Response) {
    try {
      const { produitId, clientId, prixVenteHT, remise, quantiteMin, dateDebut, dateFin, notes } = req.body;

      // Vérifier que le couple produit/client n'existe pas
      const existing = await prisma.prixClient.findUnique({
        where: { produitId_clientId: { produitId, clientId } },
      });

      if (existing) {
        return res.status(400).json({ error: 'Ce client a déjà un prix pour ce produit' });
      }

      const prix = await prisma.prixClient.create({
        data: {
          produitId,
          clientId,
          prixVenteHT,
          remise: remise || 0,
          quantiteMin: quantiteMin || 1,
          dateDebut: dateDebut ? new Date(dateDebut) : undefined,
          dateFin: dateFin ? new Date(dateFin) : undefined,
          notes,
        },
        include: {
          produit: { select: { id: true, reference: true, nom: true } },
          client: { select: { id: true, nomEntreprise: true, code: true } },
        },
      });

      res.status(201).json({ prix });
    } catch (error) {
      console.error('Create prix client error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/prix-clients/:id
   */
  async updatePrixClient(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { prixVenteHT, remise, quantiteMin, dateDebut, dateFin, notes, actif } = req.body;

      const existing = await prisma.prixClient.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Prix client non trouvé' });
      }

      const prix = await prisma.prixClient.update({
        where: { id },
        data: {
          prixVenteHT: prixVenteHT !== undefined ? prixVenteHT : existing.prixVenteHT,
          remise: remise !== undefined ? remise : existing.remise,
          quantiteMin: quantiteMin !== undefined ? quantiteMin : existing.quantiteMin,
          dateDebut: dateDebut !== undefined ? (dateDebut ? new Date(dateDebut) : null) : existing.dateDebut,
          dateFin: dateFin !== undefined ? (dateFin ? new Date(dateFin) : null) : existing.dateFin,
          notes: notes !== undefined ? notes : existing.notes,
          actif: actif !== undefined ? actif : existing.actif,
        },
        include: {
          produit: { select: { id: true, reference: true, nom: true } },
          client: { select: { id: true, nomEntreprise: true, code: true } },
        },
      });

      res.json({ prix });
    } catch (error) {
      console.error('Update prix client error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/prix-clients/:id
   */
  async deletePrixClient(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.prixClient.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Prix client non trouvé' });
      }

      await prisma.prixClient.delete({ where: { id } });

      res.json({ message: 'Prix client supprimé' });
    } catch (error) {
      console.error('Delete prix client error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ MOUVEMENTS STOCK (nouveau modèle) ============

  /**
   * POST /api/produits-services/:id/mouvement
   * Créer un mouvement de stock pour un ProduitService
   */
  async createMouvementProduitService(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { type, quantite, entrepotId, entrepotDestId, motif, numeroLot, interventionId } = req.body;

      const produit = await prisma.produitService.findUnique({ where: { id } });

      if (!produit) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }

      if (!produit.aStock) {
        return res.status(400).json({ error: 'Ce produit/service ne gère pas le stock' });
      }

      if (!produit.actif) {
        return res.status(400).json({ error: 'Produit désactivé' });
      }

      if (!quantite || quantite <= 0) {
        return res.status(400).json({ error: 'Quantité invalide' });
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
        case 'INVENTAIRE':
          quantiteApres = quantite;
          break;
        case 'TRANSFERT':
          if (!entrepotId || !entrepotDestId) {
            return res.status(400).json({ error: 'Entrepôts source et destination requis pour un transfert' });
          }
          quantiteApres = quantiteAvant; // Le stock total ne change pas
          break;
        default:
          return res.status(400).json({ error: 'Type de mouvement invalide' });
      }

      // Transaction pour créer le mouvement et mettre à jour le stock
      const [mouvement] = await prisma.$transaction([
        prisma.mouvementStock.create({
          data: {
            produitServiceId: id,
            entrepotId,
            entrepotDestId,
            type,
            quantite: type === 'AJUSTEMENT' || type === 'INVENTAIRE' ? Math.abs(quantiteApres - quantiteAvant) : quantite,
            quantiteAvant,
            quantiteApres,
            motif,
            numeroLot,
            interventionId,
            userId: req.user!.id,
          },
          include: {
            produitService: { select: { id: true, reference: true, nom: true, unite: true } },
            user: { select: { id: true, nom: true, prenom: true } },
            entrepot: { select: { id: true, code: true, nom: true } },
          },
        }),
        prisma.produitService.update({
          where: { id },
          data: { quantite: quantiteApres },
        }),
      ]);

      // Mettre à jour le stock par entrepôt si applicable
      if (entrepotId && type !== 'TRANSFERT') {
        await prisma.stockEntrepot.upsert({
          where: { produitId_entrepotId: { produitId: id, entrepotId } },
          create: {
            produitId: id,
            entrepotId,
            quantite: type === 'ENTREE' ? quantite : (type === 'SORTIE' ? -quantite : quantite),
          },
          update: {
            quantite: type === 'ENTREE'
              ? { increment: quantite }
              : type === 'SORTIE'
                ? { decrement: quantite }
                : quantite,
          },
        });
      }

      // Gérer le transfert entre entrepôts
      if (type === 'TRANSFERT' && entrepotId && entrepotDestId) {
        await Promise.all([
          // Décrémente l'entrepôt source
          prisma.stockEntrepot.update({
            where: { produitId_entrepotId: { produitId: id, entrepotId } },
            data: { quantite: { decrement: quantite } },
          }),
          // Incrémente l'entrepôt destination
          prisma.stockEntrepot.upsert({
            where: { produitId_entrepotId: { produitId: id, entrepotId: entrepotDestId } },
            create: { produitId: id, entrepotId: entrepotDestId, quantite },
            update: { quantite: { increment: quantite } },
          }),
        ]);
      }

      res.status(201).json({ mouvement });
    } catch (error) {
      console.error('Create mouvement produit-service error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ STATS ============

  /**
   * GET /api/produits-services/stats
   */
  async getStats(req: AuthRequest, res: Response) {
    try {
      const [
        totalProduits,
        totalServices,
        produitsActifs,
        servicesActifs,
        totalCategories,
        totalEntrepots,
      ] = await Promise.all([
        prisma.produitService.count({ where: { type: 'PRODUIT' } }),
        prisma.produitService.count({ where: { type: 'SERVICE' } }),
        prisma.produitService.count({ where: { type: 'PRODUIT', actif: true } }),
        prisma.produitService.count({ where: { type: 'SERVICE', actif: true } }),
        prisma.categorieProduit.count({ where: { actif: true } }),
        prisma.entrepot.count({ where: { actif: true } }),
      ]);

      // Stock bas
      const produitsAvecStock = await prisma.produitService.findMany({
        where: { type: 'PRODUIT', actif: true, aStock: true },
        select: { quantite: true, stockMinimum: true },
      });
      const stockBas = produitsAvecStock.filter((p) => p.quantite <= p.stockMinimum).length;

      // Mouvements récents (7 derniers jours)
      const mouvementsRecents = await prisma.mouvementStock.count({
        where: {
          produitServiceId: { not: null },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });

      res.json({
        stats: {
          totalProduits,
          totalServices,
          produitsActifs,
          servicesActifs,
          stockBas,
          totalCategories,
          totalEntrepots,
          mouvementsRecents,
        },
      });
    } catch (error) {
      console.error('Get stats produits-services error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/produits-services/alertes
   * Produits en stock bas
   */
  async getAlertes(req: AuthRequest, res: Response) {
    try {
      const produits = await prisma.produitService.findMany({
        where: {
          type: 'PRODUIT',
          actif: true,
          aStock: true,
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
          categories: {
            include: { categorie: { select: { id: true, nom: true } } }
          },
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
      console.error('Get alertes produits-services error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default produitsServicesController;
