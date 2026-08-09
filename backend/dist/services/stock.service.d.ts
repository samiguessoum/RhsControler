import { Prisma, TypeMouvement } from '@prisma/client';
export interface MouvementStockInput {
    produitServiceId: string;
    type: TypeMouvement;
    quantite: number;
    motif?: string;
    reference?: string;
    entrepotId?: string;
    entrepotDestId?: string;
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
export declare const stockService: {
    /**
     * Crée un mouvement de stock et met à jour le stock du produit
     * Prend en compte : type de produit, entrepôts, nature du produit
     */
    createMouvement(input: MouvementStockInput, tx?: Prisma.TransactionClient): Promise<{
        success: boolean;
        nouveauStock?: number;
        error?: string;
    }>;
    /**
     * Met à jour le stock lors de la validation d'une facture client (sortie de stock)
     * Gère les différents types de produits
     */
    processFactureValidation(factureId: string, lignes: LigneFacture[], userId: string, entrepotId?: string, tx?: Prisma.TransactionClient): Promise<{
        success: boolean;
        errors: string[];
    }>;
    /**
     * Annule les mouvements de stock d'une facture (en cas d'annulation)
     */
    reverseFactureMouvements(factureId: string, lignes: LigneFacture[], userId: string, entrepotId?: string, tx?: Prisma.TransactionClient): Promise<{
        success: boolean;
        errors: string[];
    }>;
    /**
     * Met à jour le stock lors de la réception d'une commande fournisseur (entrée de stock)
     */
    processReceptionFournisseur(commandeId: string, lignes: LigneFacture[], userId: string, entrepotId?: string, tx?: Prisma.TransactionClient): Promise<{
        success: boolean;
        errors: string[];
    }>;
    /**
     * Vérifie si le stock est suffisant pour une liste de lignes
     * Prend en compte le type de produit et les entrepôts
     */
    checkStockAvailability(lignes: LigneFacture[], entrepotId?: string): Promise<StockCheckResult>;
    /**
     * Effectue un transfert de stock entre deux entrepôts
     */
    transferStock(produitServiceId: string, quantite: number, entrepotSourceId: string, entrepotDestId: string, userId: string, motif?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Effectue un inventaire (ajustement de stock)
     */
    doInventory(produitServiceId: string, nouvelleQuantite: number, entrepotId: string | undefined, userId: string, motif?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Récupère les produits avec stock bas
     */
    getLowStockProducts(): Promise<Array<{
        id: string;
        nom: string;
        reference: string;
        nature: string | null;
        quantite: number;
        stockMinimum: number;
    }>>;
    /**
     * Récupère l'historique des mouvements d'un produit
     */
    getProductMouvements(produitServiceId: string, options?: {
        entrepotId?: string;
        type?: TypeMouvement;
        dateDebut?: Date;
        dateFin?: Date;
        limit?: number;
    }): Promise<({
        user: {
            id: string;
            nom: string;
            prenom: string;
        };
        entrepot: {
            id: string;
            nom: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        type: import(".prisma/client").$Enums.TypeMouvement;
        quantite: number;
        produitId: string | null;
        motif: string | null;
        interventionId: string | null;
        numeroLot: string | null;
        entrepotId: string | null;
        entrepotDestId: string | null;
        produitServiceId: string | null;
        userId: string;
        quantiteAvant: number;
        quantiteApres: number;
    })[]>;
};
export default stockService;
//# sourceMappingURL=stock.service.d.ts.map