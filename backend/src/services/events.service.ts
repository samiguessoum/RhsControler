import { EventEmitter } from 'events';
import { prisma } from '../config/database.js';

// Types d'événements de facturation
export type FacturationEventType =
  | 'facture.created'
  | 'facture.validated'
  | 'facture.paid'
  | 'facture.partially_paid'
  | 'facture.overdue'
  | 'facture.cancelled'
  | 'facture_fournisseur.created'
  | 'facture_fournisseur.validated'
  | 'facture_fournisseur.paid'
  | 'facture_fournisseur.partially_paid'
  | 'facture_fournisseur.overdue'
  | 'charge.created'
  | 'charge.paid'
  | 'charge.overdue'
  | 'paiement.created'
  | 'paiement.deleted'
  | 'stock.low'
  | 'stock.updated';

export interface FacturationEvent {
  type: FacturationEventType;
  entityId: string;
  entityType: 'Facture' | 'FactureFournisseur' | 'Charge' | 'Paiement' | 'ProduitService';
  data: Record<string, any>;
  userId?: string;
  timestamp: Date;
}

export interface Notification {
  id: string;
  type: FacturationEventType;
  title: string;
  message: string;
  entityId: string;
  entityType: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: Date;
  userId?: string;
}

class FacturationEventEmitter extends EventEmitter {
  private notifications: Notification[] = [];

  constructor() {
    super();
    this.setupListeners();
  }

  private setupListeners() {
    // Factures clients
    this.on('facture.created', this.handleFactureCreated.bind(this));
    this.on('facture.validated', this.handleFactureValidated.bind(this));
    this.on('facture.paid', this.handleFacturePaid.bind(this));
    this.on('facture.overdue', this.handleFactureOverdue.bind(this));

    // Factures fournisseurs
    this.on('facture_fournisseur.overdue', this.handleFactureFournisseurOverdue.bind(this));
    this.on('facture_fournisseur.paid', this.handleFactureFournisseurPaid.bind(this));

    // Charges
    this.on('charge.overdue', this.handleChargeOverdue.bind(this));

    // Stock
    this.on('stock.low', this.handleStockLow.bind(this));
    this.on('stock.updated', this.handleStockUpdated.bind(this));
  }

  emitEvent(event: FacturationEvent) {
    console.log(`[EVENT] ${event.type}:`, event.entityId);
    this.emit(event.type, event);
    this.emit('*', event); // Wildcard pour les listeners globaux
  }

  private createNotification(
    type: FacturationEventType,
    title: string,
    message: string,
    entityId: string,
    entityType: string,
    severity: Notification['severity'],
    userId?: string
  ): Notification {
    const notification: Notification = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      entityId,
      entityType,
      severity,
      read: false,
      createdAt: new Date(),
      userId,
    };
    this.notifications.unshift(notification);
    // Garder seulement les 100 dernières notifications
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }
    return notification;
  }

  getNotifications(userId?: string, unreadOnly = false): Notification[] {
    let filtered = this.notifications;
    if (userId) {
      filtered = filtered.filter(n => !n.userId || n.userId === userId);
    }
    if (unreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }
    return filtered;
  }

  markAsRead(notificationId: string): boolean {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      return true;
    }
    return false;
  }

  markAllAsRead(userId?: string): number {
    let count = 0;
    this.notifications.forEach(n => {
      if (!n.read && (!userId || !n.userId || n.userId === userId)) {
        n.read = true;
        count++;
      }
    });
    return count;
  }

  // Handlers pour les événements

  private handleFactureCreated(event: FacturationEvent) {
    this.createNotification(
      event.type,
      'Nouvelle facture créée',
      `Facture ${event.data.ref} créée pour ${event.data.clientNom}`,
      event.entityId,
      event.entityType,
      'info',
      event.userId
    );
  }

  private handleFactureValidated(event: FacturationEvent) {
    this.createNotification(
      event.type,
      'Facture validée',
      `Facture ${event.data.ref} validée - Montant: ${event.data.totalTTC} DZD`,
      event.entityId,
      event.entityType,
      'success',
      event.userId
    );
  }

  private handleFacturePaid(event: FacturationEvent) {
    this.createNotification(
      event.type,
      'Facture payée',
      `Facture ${event.data.ref} entièrement payée`,
      event.entityId,
      event.entityType,
      'success',
      event.userId
    );
  }

  private handleFactureOverdue(event: FacturationEvent) {
    this.createNotification(
      event.type,
      'Facture en retard',
      `Facture ${event.data.ref} - Retard de ${event.data.joursRetard} jours - Reste à payer: ${event.data.resteAPayer} DZD`,
      event.entityId,
      event.entityType,
      'warning'
    );
  }

  private handleFactureFournisseurOverdue(event: FacturationEvent) {
    this.createNotification(
      event.type,
      'Facture fournisseur en retard',
      `Facture ${event.data.ref} (${event.data.fournisseurNom}) - Retard de ${event.data.joursRetard} jours`,
      event.entityId,
      event.entityType,
      'warning'
    );
  }

  private handleFactureFournisseurPaid(event: FacturationEvent) {
    this.createNotification(
      event.type,
      'Facture fournisseur payée',
      `Facture ${event.data.ref} du fournisseur ${event.data.fournisseurNom} payée`,
      event.entityId,
      event.entityType,
      'success',
      event.userId
    );
  }

  private handleChargeOverdue(event: FacturationEvent) {
    this.createNotification(
      event.type,
      'Charge en retard',
      `Charge ${event.data.ref} (${event.data.libelle}) - Échéance dépassée`,
      event.entityId,
      event.entityType,
      'warning'
    );
  }

  private handleStockLow(event: FacturationEvent) {
    this.createNotification(
      event.type,
      'Stock bas',
      `Produit "${event.data.nom}" - Stock: ${event.data.stockActuel} (seuil: ${event.data.stockMin})`,
      event.entityId,
      event.entityType,
      'warning'
    );
  }

  private handleStockUpdated(event: FacturationEvent) {
    // Log uniquement, pas de notification UI par défaut
    console.log(`[STOCK] ${event.data.produitNom}: ${event.data.mouvement} (nouveau stock: ${event.data.nouveauStock})`);
  }
}

// Instance singleton
export const facturationEvents = new FacturationEventEmitter();

// Fonction pour vérifier les factures en retard (à appeler périodiquement)
export async function checkOverdueInvoices(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Factures clients en retard
  const facturesEnRetard = await prisma.facture.findMany({
    where: {
      dateEcheance: { lt: today },
      statut: { in: ['VALIDEE', 'PARTIELLEMENT_PAYEE'] },
    },
    include: {
      client: { select: { nomEntreprise: true } },
    },
  });

  for (const facture of facturesEnRetard) {
    const joursRetard = Math.floor((today.getTime() - new Date(facture.dateEcheance!).getTime()) / (1000 * 60 * 60 * 24));

    // Mettre à jour le statut si nécessaire
    if (facture.statut !== 'EN_RETARD') {
      await prisma.facture.update({
        where: { id: facture.id },
        data: { statut: 'EN_RETARD' },
      });
    }

    facturationEvents.emitEvent({
      type: 'facture.overdue',
      entityId: facture.id,
      entityType: 'Facture',
      data: {
        ref: facture.ref,
        clientNom: facture.client.nomEntreprise,
        joursRetard,
        resteAPayer: facture.totalTTC - facture.totalPaye,
      },
      timestamp: new Date(),
    });
  }

  // Factures fournisseurs en retard
  const facturesFournisseurEnRetard = await prisma.factureFournisseur.findMany({
    where: {
      dateEcheance: { lt: today },
      statut: { in: ['VALIDEE', 'PARTIELLEMENT_PAYEE'] },
    },
    include: {
      fournisseur: { select: { nomEntreprise: true } },
    },
  });

  for (const facture of facturesFournisseurEnRetard) {
    const joursRetard = Math.floor((today.getTime() - new Date(facture.dateEcheance!).getTime()) / (1000 * 60 * 60 * 24));

    if (facture.statut !== 'EN_RETARD') {
      await prisma.factureFournisseur.update({
        where: { id: facture.id },
        data: { statut: 'EN_RETARD' },
      });
    }

    facturationEvents.emitEvent({
      type: 'facture_fournisseur.overdue',
      entityId: facture.id,
      entityType: 'FactureFournisseur',
      data: {
        ref: facture.ref,
        fournisseurNom: facture.fournisseur.nomEntreprise,
        joursRetard,
        resteAPayer: facture.totalTTC - facture.totalPaye,
      },
      timestamp: new Date(),
    });
  }

  // Charges en retard
  const chargesEnRetard = await prisma.charge.findMany({
    where: {
      dateEcheance: { lt: today },
      statut: { in: ['A_PAYER', 'PARTIELLEMENT_PAYEE'] },
    },
  });

  for (const charge of chargesEnRetard) {
    facturationEvents.emitEvent({
      type: 'charge.overdue',
      entityId: charge.id,
      entityType: 'Charge',
      data: {
        ref: charge.ref,
        libelle: charge.libelle,
        resteAPayer: charge.montantTTC - charge.montantPaye,
      },
      timestamp: new Date(),
    });
  }
}

// Fonction pour vérifier les stocks bas
export async function checkLowStock(): Promise<void> {
  const produitsStockBas = await prisma.produitService.findMany({
    where: {
      type: 'PRODUIT',
      gestionStock: true,
      stockActuel: { lte: prisma.produitService.fields.stockMin },
    },
  });

  for (const produit of produitsStockBas) {
    if (produit.stockActuel <= (produit.stockMin || 0)) {
      facturationEvents.emitEvent({
        type: 'stock.low',
        entityId: produit.id,
        entityType: 'ProduitService',
        data: {
          nom: produit.nom,
          reference: produit.reference,
          stockActuel: produit.stockActuel,
          stockMin: produit.stockMin,
        },
        timestamp: new Date(),
      });
    }
  }
}

export default facturationEvents;
