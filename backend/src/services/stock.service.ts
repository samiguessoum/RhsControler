import { prisma } from '../config/database.js';
import { facturationEvents } from './events.service.js';
import { Prisma, TypeMouvement } from '@prisma/client';

export interface MouvementStockInput {
  produitServiceId: string;
  type: TypeMouvement;
  quantite: number;
  motif?: string;
  reference?: string;
  entrepotId?: string;
  entrepotDestId?: string;  // Pour les transferts
  numeroLot?: string;
  interventionId?: string;
  userId: string;
}

export interface LigneFacture {
  produitServiceId?: string | null;
  quantite: number;
  libelle: string;
}

export interface StockCheckResult {
  available: boolean;
  insufficientItems: Array<{
    produit: string;
    reference: string;
    stockActuel: number;
    demande: number;
    entrepotId?: string;
    entrepotNom?: string;
  }>;
}

/**
 * Service de gestion automatique du stock
 * Gère les différents types de produits et les multi-entrepôts
 */
export const stockService = {
  /**
   * Crée un mouvement de stock et met à jour le stock du produit
   * Prend en compte : type de produit, entrepôts, nature du produit
   */
  async createMouvement(
    input: MouvementStockInput,
    tx?: Prisma.TransactionClient
  ): Promise<{ success: boolean; nouveauStock?: number; error?: string }> {
    const db = tx || prisma;

    try {
      // Récupérer le produit avec ses informations
      const produit = await db.produitService.findUnique({
        where: { id: input.produitServiceId },
        include: {
          stocks: input.entrepotId ? {
            where: { entrepotId: input.entrepotId }
          } : true,
        },
      });

      if (!produit) {
        return { success: false, error: 'Produit non trouvé' };
      }

      // Vérifier si le produit nécessite une gestion de stock
      if (produit.type === 'SERVICE') {
        // Les services n'ont pas de stock
        return { success: true, nouveauStock: 0 };
      }

      if (!produit.aStock) {
        // La gestion de stock est désactivée pour ce produit
        return { success: true, nouveauStock: produit.quantite };
      }

      // Déterminer le stock actuel (global ou par entrepôt)
      let stockActuel = produit.quantite;
      let stockEntrepot = null;

      if (input.entrepotId) {
        stockEntrepot = produit.stocks.find(s => s.entrepotId === input.entrepotId);
        stockActuel = stockEntrepot?.quantite ?? 0;
      }

      // Calculer le nouveau stock selon le type de mouvement
      let nouveauStock = stockActuel;
      let nouveauStockGlobal = produit.quantite;

      switch (input.type) {
        case 'ENTREE':
          nouveauStock += input.quantite;
          nouveauStockGlobal += input.quantite;
          break;

        case 'SORTIE':
          nouveauStock -= input.quantite;
          nouveauStockGlobal -= input.quantite;
          if (nouveauStock < 0) {
            return {
              success: false,
              error: `Stock insuffisant pour "${produit.nom}" (ref: ${produit.reference}). ` +
                     `Stock actuel: ${stockActuel}, demandé: ${input.quantite}`
            };
          }
          break;

        case 'AJUSTEMENT':
        case 'INVENTAIRE':
          // Pour ajustement/inventaire, la quantité est le nouveau stock absolu
          const difference = input.quantite - stockActuel;
          nouveauStock = input.quantite;
          nouveauStockGlobal = produit.quantite + difference;
          break;

        case 'TRANSFERT':
          // Sortie de l'entrepôt source
          nouveauStock -= input.quantite;
          if (nouveauStock < 0) {
            return {
              success: false,
              error: `Stock insuffisant dans l'entrepôt source pour "${produit.nom}". ` +
                     `Stock: ${stockActuel}, demandé: ${input.quantite}`
            };
          }
          // Le stock global ne change pas pour un transfert
          nouveauStockGlobal = produit.quantite;
          break;

        default:
          return { success: false, error: `Type de mouvement inconnu: ${input.type}` };
      }

      // Créer le mouvement de stock
      await db.mouvementStock.create({
        data: {
          produitServiceId: input.produitServiceId,
          entrepotId: input.entrepotId,
          entrepotDestId: input.entrepotDestId,
          type: input.type,
          quantite: input.quantite,
          quantiteAvant: stockActuel,
          quantiteApres: nouveauStock,
          motif: input.motif,
          numeroLot: input.numeroLot,
          interventionId: input.interventionId,
          userId: input.userId,
        },
      });

      // Mettre à jour le stock global du produit
      await db.produitService.update({
        where: { id: input.produitServiceId },
        data: { quantite: nouveauStockGlobal },
      });

      // Mettre à jour le stock par entrepôt si applicable
      if (input.entrepotId) {
        if (stockEntrepot) {
          await db.stockEntrepot.update({
            where: { id: stockEntrepot.id },
            data: { quantite: nouveauStock },
          });
        } else {
          // Créer l'entrée de stock pour cet entrepôt
          await db.stockEntrepot.create({
            data: {
              produitId: input.produitServiceId,
              entrepotId: input.entrepotId,
              quantite: nouveauStock,
            },
          });
        }
      }

      // Pour les transferts, mettre à jour l'entrepôt de destination
      if (input.type === 'TRANSFERT' && input.entrepotDestId) {
        const stockDest = await db.stockEntrepot.findFirst({
          where: {
            produitId: input.produitServiceId,
            entrepotId: input.entrepotDestId,
          },
        });

        if (stockDest) {
          await db.stockEntrepot.update({
            where: { id: stockDest.id },
            data: { quantite: stockDest.quantite + input.quantite },
          });
        } else {
          await db.stockEntrepot.create({
            data: {
              produitId: input.produitServiceId,
              entrepotId: input.entrepotDestId,
              quantite: input.quantite,
            },
          });
        }

        // Créer le mouvement d'entrée pour l'entrepôt de destination
        await db.mouvementStock.create({
          data: {
            produitServiceId: input.produitServiceId,
            entrepotId: input.entrepotDestId,
            type: 'ENTREE',
            quantite: input.quantite,
            quantiteAvant: stockDest?.quantite ?? 0,
            quantiteApres: (stockDest?.quantite ?? 0) + input.quantite,
            motif: `Transfert depuis entrepôt ${input.entrepotId}`,
            userId: input.userId,
          },
        });
      }

      // Émettre un événement de mise à jour de stock
      facturationEvents.emitEvent({
        type: 'stock.updated',
        entityId: input.produitServiceId,
        entityType: 'ProduitService',
        data: {
          produitNom: produit.nom,
          reference: produit.reference,
          nature: produit.nature,
          mouvement: input.type === 'SORTIE' ? `-${input.quantite}` : `+${input.quantite}`,
          nouveauStock: nouveauStockGlobal,
          stockMin: produit.stockMinimum,
          entrepotId: input.entrepotId,
        },
        userId: input.userId,
        timestamp: new Date(),
      });

      // Vérifier si le stock est bas (alerte)
      if (produit.stockMinimum && nouveauStockGlobal <= produit.stockMinimum) {
        facturationEvents.emitEvent({
          type: 'stock.low',
          entityId: input.produitServiceId,
          entityType: 'ProduitService',
          data: {
            nom: produit.nom,
            reference: produit.reference,
            nature: produit.nature,
            stockActuel: nouveauStockGlobal,
            stockMin: produit.stockMinimum,
          },
          timestamp: new Date(),
        });
      }

      return { success: true, nouveauStock: nouveauStockGlobal };
    } catch (error) {
      console.error('Erreur création mouvement stock:', error);
      return { success: false, error: 'Erreur lors de la mise à jour du stock' };
    }
  },

  /**
   * Met à jour le stock lors de la validation d'une facture client (sortie de stock)
   * Gère les différents types de produits
   */
  async processFactureValidation(
    factureId: string,
    lignes: LigneFacture[],
    userId: string,
    entrepotId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const db = tx || prisma;

    // Récupérer les infos des produits pour vérifier leurs types
    const produitIds = lignes
      .map(l => l.produitServiceId)
      .filter((id): id is string => !!id);

    if (produitIds.length === 0) {
      return { success: true, errors };
    }

    const produits = await db.produitService.findMany({
      where: { id: { in: produitIds } },
      select: {
        id: true,
        nom: true,
        type: true,
        aStock: true,
        nature: true,
      },
    });

    const produitMap = new Map(produits.map(p => [p.id, p]));

    for (const ligne of lignes) {
      if (!ligne.produitServiceId) continue;

      const produit = produitMap.get(ligne.produitServiceId);
      if (!produit) continue;

      // Ignorer les services et les produits sans gestion de stock
      if (produit.type === 'SERVICE' || !produit.aStock) {
        continue;
      }

      const result = await this.createMouvement(
        {
          produitServiceId: ligne.produitServiceId,
          type: 'SORTIE',
          quantite: ligne.quantite,
          motif: `Facturation client - ${factureId}`,
          reference: factureId,
          entrepotId,
          userId,
        },
        tx
      );

      if (!result.success && result.error) {
        errors.push(result.error);
      }
    }

    return { success: errors.length === 0, errors };
  },

  /**
   * Annule les mouvements de stock d'une facture (en cas d'annulation)
   */
  async reverseFactureMouvements(
    factureId: string,
    lignes: LigneFacture[],
    userId: string,
    entrepotId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const db = tx || prisma;

    const produitIds = lignes
      .map(l => l.produitServiceId)
      .filter((id): id is string => !!id);

    if (produitIds.length === 0) {
      return { success: true, errors };
    }

    const produits = await db.produitService.findMany({
      where: { id: { in: produitIds } },
      select: { id: true, type: true, aStock: true },
    });

    const produitMap = new Map(produits.map(p => [p.id, p]));

    for (const ligne of lignes) {
      if (!ligne.produitServiceId) continue;

      const produit = produitMap.get(ligne.produitServiceId);
      if (!produit || produit.type === 'SERVICE' || !produit.aStock) {
        continue;
      }

      const result = await this.createMouvement(
        {
          produitServiceId: ligne.produitServiceId,
          type: 'ENTREE',
          quantite: ligne.quantite,
          motif: `Annulation facture client - ${factureId}`,
          reference: factureId,
          entrepotId,
          userId,
        },
        tx
      );

      if (!result.success && result.error) {
        errors.push(result.error);
      }
    }

    return { success: errors.length === 0, errors };
  },

  /**
   * Met à jour le stock lors de la réception d'une commande fournisseur (entrée de stock)
   */
  async processReceptionFournisseur(
    commandeId: string,
    lignes: LigneFacture[],
    userId: string,
    entrepotId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const db = tx || prisma;

    const produitIds = lignes
      .map(l => l.produitServiceId)
      .filter((id): id is string => !!id);

    if (produitIds.length === 0) {
      return { success: true, errors };
    }

    const produits = await db.produitService.findMany({
      where: { id: { in: produitIds } },
      select: { id: true, type: true, aStock: true },
    });

    const produitMap = new Map(produits.map(p => [p.id, p]));

    for (const ligne of lignes) {
      if (!ligne.produitServiceId) continue;

      const produit = produitMap.get(ligne.produitServiceId);
      if (!produit || produit.type === 'SERVICE' || !produit.aStock) {
        continue;
      }

      const result = await this.createMouvement(
        {
          produitServiceId: ligne.produitServiceId,
          type: 'ENTREE',
          quantite: ligne.quantite,
          motif: `Réception commande fournisseur - ${commandeId}`,
          reference: commandeId,
          entrepotId,
          userId,
        },
        tx
      );

      if (!result.success && result.error) {
        errors.push(result.error);
      }
    }

    return { success: errors.length === 0, errors };
  },

  /**
   * Vérifie si le stock est suffisant pour une liste de lignes
   * Prend en compte le type de produit et les entrepôts
   */
  async checkStockAvailability(
    lignes: LigneFacture[],
    entrepotId?: string
  ): Promise<StockCheckResult> {
    const insufficientItems: StockCheckResult['insufficientItems'] = [];

    const produitIds = lignes
      .map(l => l.produitServiceId)
      .filter((id): id is string => !!id);

    if (produitIds.length === 0) {
      return { available: true, insufficientItems };
    }

    // Récupérer les produits avec leurs stocks par entrepôt
    const produits = await prisma.produitService.findMany({
      where: {
        id: { in: produitIds },
        type: 'PRODUIT',  // Seuls les produits ont du stock
        aStock: true,     // Avec gestion de stock activée
      },
      include: {
        stocks: entrepotId ? {
          where: { entrepotId },
          include: { entrepot: { select: { nom: true } } },
        } : {
          include: { entrepot: { select: { nom: true } } },
        },
      },
    });

    const produitMap = new Map(produits.map(p => [p.id, p]));

    // Agréger les quantités par produit (une même ligne peut apparaître plusieurs fois)
    const quantitesDemandees = new Map<string, number>();
    for (const ligne of lignes) {
      if (!ligne.produitServiceId) continue;
      const current = quantitesDemandees.get(ligne.produitServiceId) || 0;
      quantitesDemandees.set(ligne.produitServiceId, current + ligne.quantite);
    }

    for (const [produitId, quantiteDemandee] of quantitesDemandees) {
      const produit = produitMap.get(produitId);
      if (!produit) continue;

      // Déterminer le stock disponible
      let stockDisponible: number;
      let entrepotNom: string | undefined;

      if (entrepotId) {
        const stockEntrepot = produit.stocks.find(s => s.entrepotId === entrepotId);
        stockDisponible = stockEntrepot?.quantite ?? 0;
        entrepotNom = stockEntrepot?.entrepot?.nom;
      } else {
        stockDisponible = produit.quantite;
      }

      if (stockDisponible < quantiteDemandee) {
        insufficientItems.push({
          produit: produit.nom,
          reference: produit.reference,
          stockActuel: stockDisponible,
          demande: quantiteDemandee,
          entrepotId,
          entrepotNom,
        });
      }
    }

    return {
      available: insufficientItems.length === 0,
      insufficientItems,
    };
  },

  /**
   * Effectue un transfert de stock entre deux entrepôts
   */
  async transferStock(
    produitServiceId: string,
    quantite: number,
    entrepotSourceId: string,
    entrepotDestId: string,
    userId: string,
    motif?: string
  ): Promise<{ success: boolean; error?: string }> {
    return prisma.$transaction(async (tx) => {
      const result = await this.createMouvement(
        {
          produitServiceId,
          type: 'TRANSFERT',
          quantite,
          entrepotId: entrepotSourceId,
          entrepotDestId,
          motif: motif || 'Transfert inter-entrepôts',
          userId,
        },
        tx
      );

      return result;
    });
  },

  /**
   * Effectue un inventaire (ajustement de stock)
   */
  async doInventory(
    produitServiceId: string,
    nouvelleQuantite: number,
    entrepotId: string | undefined,
    userId: string,
    motif?: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.createMouvement({
      produitServiceId,
      type: 'INVENTAIRE',
      quantite: nouvelleQuantite,
      entrepotId,
      motif: motif || 'Inventaire',
      userId,
    });
  },

  /**
   * Récupère les produits avec stock bas
   */
  async getLowStockProducts(): Promise<Array<{
    id: string;
    nom: string;
    reference: string;
    nature: string | null;
    quantite: number;
    stockMinimum: number;
  }>> {
    return prisma.produitService.findMany({
      where: {
        type: 'PRODUIT',
        aStock: true,
        quantite: { lte: prisma.produitService.fields.stockMinimum },
      },
      select: {
        id: true,
        nom: true,
        reference: true,
        nature: true,
        quantite: true,
        stockMinimum: true,
      },
      orderBy: { quantite: 'asc' },
    });
  },

  /**
   * Récupère l'historique des mouvements d'un produit
   */
  async getProductMouvements(
    produitServiceId: string,
    options?: {
      entrepotId?: string;
      type?: TypeMouvement;
      dateDebut?: Date;
      dateFin?: Date;
      limit?: number;
    }
  ) {
    const where: any = { produitServiceId };

    if (options?.entrepotId) where.entrepotId = options.entrepotId;
    if (options?.type) where.type = options.type;
    if (options?.dateDebut || options?.dateFin) {
      where.createdAt = {};
      if (options.dateDebut) where.createdAt.gte = options.dateDebut;
      if (options.dateFin) where.createdAt.lte = options.dateFin;
    }

    return prisma.mouvementStock.findMany({
      where,
      include: {
        entrepot: { select: { id: true, nom: true } },
        user: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
    });
  },
};

export default stockService;
