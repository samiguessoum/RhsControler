import { EventEmitter } from 'events';
import { prisma } from '../config/database.js';
import logger from '../lib/logger.js';
class FacturationEventEmitter extends EventEmitter {
    notifications = [];
    constructor() {
        super();
        this.setupListeners();
    }
    setupListeners() {
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
    emitEvent(event) {
        logger.info({ eventType: event.type, entityId: event.entityId }, '[EVENT]');
        this.emit(event.type, event);
        this.emit('*', event); // Wildcard pour les listeners globaux
    }
    createNotification(type, title, message, entityId, entityType, severity, userId) {
        const notification = {
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
    getNotifications(userId, unreadOnly = false) {
        let filtered = this.notifications;
        if (userId) {
            filtered = filtered.filter(n => !n.userId || n.userId === userId);
        }
        if (unreadOnly) {
            filtered = filtered.filter(n => !n.read);
        }
        return filtered;
    }
    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            return true;
        }
        return false;
    }
    markAllAsRead(userId) {
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
    handleFactureCreated(event) {
        this.createNotification(event.type, 'Nouvelle facture créée', `Facture ${event.data.ref} créée pour ${event.data.clientNom}`, event.entityId, event.entityType, 'info', event.userId);
    }
    handleFactureValidated(event) {
        this.createNotification(event.type, 'Facture validée', `Facture ${event.data.ref} validée - Montant: ${event.data.totalTTC} DZD`, event.entityId, event.entityType, 'success', event.userId);
    }
    handleFacturePaid(event) {
        this.createNotification(event.type, 'Facture payée', `Facture ${event.data.ref} entièrement payée`, event.entityId, event.entityType, 'success', event.userId);
    }
    handleFactureOverdue(event) {
        this.createNotification(event.type, 'Facture en retard', `Facture ${event.data.ref} - Retard de ${event.data.joursRetard} jours - Reste à payer: ${event.data.resteAPayer} DZD`, event.entityId, event.entityType, 'warning');
    }
    handleFactureFournisseurOverdue(event) {
        this.createNotification(event.type, 'Facture fournisseur en retard', `Facture ${event.data.ref} (${event.data.fournisseurNom}) - Retard de ${event.data.joursRetard} jours`, event.entityId, event.entityType, 'warning');
    }
    handleFactureFournisseurPaid(event) {
        this.createNotification(event.type, 'Facture fournisseur payée', `Facture ${event.data.ref} du fournisseur ${event.data.fournisseurNom} payée`, event.entityId, event.entityType, 'success', event.userId);
    }
    handleChargeOverdue(event) {
        this.createNotification(event.type, 'Charge en retard', `Charge ${event.data.ref} (${event.data.libelle}) - Échéance dépassée`, event.entityId, event.entityType, 'warning');
    }
    handleStockLow(event) {
        this.createNotification(event.type, 'Stock bas', `Produit "${event.data.nom}" - Stock: ${event.data.stockActuel} (seuil: ${event.data.stockMin})`, event.entityId, event.entityType, 'warning');
    }
    handleStockUpdated(event) {
        // Log uniquement, pas de notification UI par défaut
        logger.info(`[STOCK] ${event.data.produitNom}: ${event.data.mouvement} (nouveau stock: ${event.data.nouveauStock})`);
    }
}
// Instance singleton
export const facturationEvents = new FacturationEventEmitter();
// Fonction pour vérifier les factures en retard (à appeler périodiquement)
export async function checkOverdueInvoices() {
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
        const joursRetard = Math.floor((today.getTime() - new Date(facture.dateEcheance).getTime()) / (1000 * 60 * 60 * 24));
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
        const joursRetard = Math.floor((today.getTime() - new Date(facture.dateEcheance).getTime()) / (1000 * 60 * 60 * 24));
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
export async function checkLowStock() {
    const tous = await prisma.produitService.findMany({
        where: {
            type: 'PRODUIT',
            aStock: true,
            stockMinimum: { gt: 0 },
        },
        select: { id: true, nom: true, reference: true, quantite: true, stockMinimum: true },
    });
    const produitsStockBas = tous.filter((p) => p.quantite <= p.stockMinimum);
    for (const produit of produitsStockBas) {
        facturationEvents.emitEvent({
            type: 'stock.low',
            entityId: produit.id,
            entityType: 'ProduitService',
            data: {
                nom: produit.nom,
                reference: produit.reference,
                stockActuel: produit.quantite,
                stockMin: produit.stockMinimum,
            },
            timestamp: new Date(),
        });
    }
}
export default facturationEvents;
//# sourceMappingURL=events.service.js.map