import { EventEmitter } from 'events';
export type FacturationEventType = 'facture.created' | 'facture.validated' | 'facture.paid' | 'facture.partially_paid' | 'facture.overdue' | 'facture.cancelled' | 'facture_fournisseur.created' | 'facture_fournisseur.validated' | 'facture_fournisseur.paid' | 'facture_fournisseur.partially_paid' | 'facture_fournisseur.overdue' | 'charge.created' | 'charge.paid' | 'charge.overdue' | 'paiement.created' | 'paiement.deleted' | 'stock.low' | 'stock.updated';
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
declare class FacturationEventEmitter extends EventEmitter {
    private notifications;
    constructor();
    private setupListeners;
    emitEvent(event: FacturationEvent): void;
    private createNotification;
    getNotifications(userId?: string, unreadOnly?: boolean): Notification[];
    markAsRead(notificationId: string): boolean;
    markAllAsRead(userId?: string): number;
    private handleFactureCreated;
    private handleFactureValidated;
    private handleFacturePaid;
    private handleFactureOverdue;
    private handleFactureFournisseurOverdue;
    private handleFactureFournisseurPaid;
    private handleChargeOverdue;
    private handleStockLow;
    private handleStockUpdated;
}
export declare const facturationEvents: FacturationEventEmitter;
export declare function checkOverdueInvoices(): Promise<void>;
export declare function checkLowStock(): Promise<void>;
export default facturationEvents;
//# sourceMappingURL=events.service.d.ts.map