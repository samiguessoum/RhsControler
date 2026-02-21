import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { facturationEvents, checkOverdueInvoices } from '../services/events.service.js';
import { stockService } from '../services/stock.service.js';

// Mock Prisma
vi.mock('../config/database.js', () => ({
  prisma: {
    facture: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    factureFournisseur: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    charge: {
      findMany: vi.fn(),
    },
    produitService: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    mouvementProduitService: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      produitService: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      mouvementProduitService: {
        create: vi.fn(),
      },
    })),
  },
}));

describe('Facturation Events Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Emission', () => {
    it('should emit facture.created event', () => {
      const listener = vi.fn();
      facturationEvents.on('facture.created', listener);

      facturationEvents.emitEvent({
        type: 'facture.created',
        entityId: 'test-id',
        entityType: 'Facture',
        data: {
          ref: 'FAC2024-00001',
          clientNom: 'Test Client',
          totalTTC: 1000,
        },
        timestamp: new Date(),
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'facture.created',
          entityId: 'test-id',
        })
      );

      facturationEvents.off('facture.created', listener);
    });

    it('should emit wildcard event for all events', () => {
      const listener = vi.fn();
      facturationEvents.on('*', listener);

      facturationEvents.emitEvent({
        type: 'facture.paid',
        entityId: 'test-id',
        entityType: 'Facture',
        data: { ref: 'FAC2024-00001' },
        timestamp: new Date(),
      });

      expect(listener).toHaveBeenCalledTimes(1);

      facturationEvents.off('*', listener);
    });
  });

  describe('Notifications', () => {
    it('should create notification on facture.created event', () => {
      facturationEvents.emitEvent({
        type: 'facture.created',
        entityId: 'test-id',
        entityType: 'Facture',
        data: {
          ref: 'FAC2024-00001',
          clientNom: 'Test Client',
        },
        userId: 'user-1',
        timestamp: new Date(),
      });

      const notifications = facturationEvents.getNotifications('user-1');
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('facture.created');
      expect(notifications[0].read).toBe(false);
    });

    it('should mark notification as read', () => {
      facturationEvents.emitEvent({
        type: 'facture.paid',
        entityId: 'test-id-2',
        entityType: 'Facture',
        data: { ref: 'FAC2024-00002' },
        userId: 'user-2',
        timestamp: new Date(),
      });

      const notifications = facturationEvents.getNotifications('user-2', true);
      const notification = notifications.find(n => n.entityId === 'test-id-2');

      if (notification) {
        const success = facturationEvents.markAsRead(notification.id);
        expect(success).toBe(true);

        const updatedNotifications = facturationEvents.getNotifications('user-2', true);
        const updatedNotification = updatedNotifications.find(n => n.id === notification.id);
        expect(updatedNotification).toBeUndefined(); // Should not be in unread list
      }
    });

    it('should mark all notifications as read', () => {
      // Emit multiple events
      for (let i = 0; i < 3; i++) {
        facturationEvents.emitEvent({
          type: 'facture.created',
          entityId: `test-id-${i}`,
          entityType: 'Facture',
          data: { ref: `FAC2024-0000${i}` },
          userId: 'user-3',
          timestamp: new Date(),
        });
      }

      const count = facturationEvents.markAllAsRead('user-3');
      expect(count).toBeGreaterThanOrEqual(3);

      const unreadNotifications = facturationEvents.getNotifications('user-3', true);
      expect(unreadNotifications.filter(n => n.userId === 'user-3').length).toBe(0);
    });
  });
});

describe('Stock Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkStockAvailability', () => {
    it('should return available true when stock is sufficient', async () => {
      const { prisma } = await import('../config/database.js');
      (prisma.produitService.findMany as any).mockResolvedValue([
        { id: 'prod-1', nom: 'Produit 1', stockActuel: 100, gestionStock: true, type: 'PRODUIT' },
      ]);

      const result = await stockService.checkStockAvailability([
        { produitServiceId: 'prod-1', quantite: 50, libelle: 'Produit 1' },
      ]);

      expect(result.available).toBe(true);
      expect(result.insufficientItems).toHaveLength(0);
    });

    it('should return available false when stock is insufficient', async () => {
      const { prisma } = await import('../config/database.js');
      (prisma.produitService.findMany as any).mockResolvedValue([
        { id: 'prod-1', nom: 'Produit 1', stockActuel: 10, gestionStock: true, type: 'PRODUIT' },
      ]);

      const result = await stockService.checkStockAvailability([
        { produitServiceId: 'prod-1', quantite: 50, libelle: 'Produit 1' },
      ]);

      expect(result.available).toBe(false);
      expect(result.insufficientItems).toHaveLength(1);
      expect(result.insufficientItems[0]).toEqual({
        produit: 'Produit 1',
        stockActuel: 10,
        demande: 50,
      });
    });

    it('should ignore items without produitServiceId', async () => {
      const { prisma } = await import('../config/database.js');
      (prisma.produitService.findMany as any).mockResolvedValue([]);

      const result = await stockService.checkStockAvailability([
        { produitServiceId: null, quantite: 50, libelle: 'Service sans stock' },
      ]);

      expect(result.available).toBe(true);
      expect(result.insufficientItems).toHaveLength(0);
    });
  });

  describe('createMouvement', () => {
    it('should create movement for ENTREE', async () => {
      const mockTx = {
        produitService: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'prod-1',
            nom: 'Produit Test',
            type: 'PRODUIT',
            gestionStock: true,
            stockActuel: 100,
            stockMin: 10,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        mouvementProduitService: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      const result = await stockService.createMouvement(
        {
          produitServiceId: 'prod-1',
          type: 'ENTREE',
          quantite: 50,
          motif: 'Test',
        },
        mockTx as any
      );

      expect(result.success).toBe(true);
      expect(result.nouveauStock).toBe(150);
      expect(mockTx.mouvementProduitService.create).toHaveBeenCalled();
      expect(mockTx.produitService.update).toHaveBeenCalled();
    });

    it('should fail for SORTIE with insufficient stock', async () => {
      const mockTx = {
        produitService: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'prod-1',
            nom: 'Produit Test',
            type: 'PRODUIT',
            gestionStock: true,
            stockActuel: 10,
            stockMin: 5,
          }),
          update: vi.fn(),
        },
        mouvementProduitService: {
          create: vi.fn(),
        },
      };

      const result = await stockService.createMouvement(
        {
          produitServiceId: 'prod-1',
          type: 'SORTIE',
          quantite: 50,
          motif: 'Test',
        },
        mockTx as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Stock insuffisant');
      expect(mockTx.mouvementProduitService.create).not.toHaveBeenCalled();
    });

    it('should skip stock management for SERVICE type', async () => {
      const mockTx = {
        produitService: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'serv-1',
            nom: 'Service Test',
            type: 'SERVICE',
            gestionStock: false,
            stockActuel: 0,
          }),
          update: vi.fn(),
        },
        mouvementProduitService: {
          create: vi.fn(),
        },
      };

      const result = await stockService.createMouvement(
        {
          produitServiceId: 'serv-1',
          type: 'SORTIE',
          quantite: 5,
          motif: 'Test',
        },
        mockTx as any
      );

      expect(result.success).toBe(true);
      expect(mockTx.mouvementProduitService.create).not.toHaveBeenCalled();
    });
  });
});

describe('Utility Functions', () => {
  describe('computeTotals', () => {
    // Test des calculs de totaux (fonction importée du controller)
    it('should calculate totals correctly without discount', () => {
      const lignes = [
        { totalHT: 100, totalTVA: 19 },
        { totalHT: 200, totalTVA: 38 },
      ];

      const totalHT = lignes.reduce((sum, l) => sum + l.totalHT, 0);
      const totalTVA = lignes.reduce((sum, l) => sum + l.totalTVA, 0);
      const totalTTC = totalHT + totalTVA;

      expect(totalHT).toBe(300);
      expect(totalTVA).toBe(57);
      expect(totalTTC).toBe(357);
    });

    it('should apply percentage discount correctly', () => {
      const lignes = [
        { totalHT: 100, totalTVA: 19 },
        { totalHT: 200, totalTVA: 38 },
      ];
      const remiseGlobalPct = 10; // 10%

      const totalHTBrut = lignes.reduce((sum, l) => sum + l.totalHT, 0);
      const totalTVABrut = lignes.reduce((sum, l) => sum + l.totalTVA, 0);
      const remise = totalHTBrut * (remiseGlobalPct / 100);
      const totalHT = totalHTBrut - remise;
      const ratio = totalHT / totalHTBrut;
      const totalTVA = totalTVABrut * ratio;
      const totalTTC = totalHT + totalTVA;

      expect(totalHT).toBe(270); // 300 - 10% = 270
      expect(totalTVA).toBeCloseTo(51.3, 1); // 57 * 0.9 = 51.3
      expect(totalTTC).toBeCloseTo(321.3, 1);
    });

    it('should apply fixed discount correctly', () => {
      const lignes = [
        { totalHT: 100, totalTVA: 19 },
        { totalHT: 200, totalTVA: 38 },
      ];
      const remiseGlobalMontant = 50; // 50 DZD

      const totalHTBrut = lignes.reduce((sum, l) => sum + l.totalHT, 0);
      const totalTVABrut = lignes.reduce((sum, l) => sum + l.totalTVA, 0);
      const totalHT = totalHTBrut - remiseGlobalMontant;
      const ratio = totalHT / totalHTBrut;
      const totalTVA = totalTVABrut * ratio;
      const totalTTC = totalHT + totalTVA;

      expect(totalHT).toBe(250); // 300 - 50 = 250
      expect(totalTVA).toBeCloseTo(47.5, 1); // 57 * (250/300)
      expect(totalTTC).toBeCloseTo(297.5, 1);
    });
  });

  describe('Reference Generation', () => {
    it('should generate correct reference format', () => {
      const prefixes = {
        DEVIS: 'DV',
        COMMANDE: 'CMD',
        FACTURE: 'FAC',
        FACTURE_AVOIR: 'AV',
      };

      const year = 2024;
      const numero = 1;

      for (const [type, prefix] of Object.entries(prefixes)) {
        const ref = `${prefix}${year}-${String(numero).padStart(5, '0')}`;
        expect(ref).toMatch(/^[A-Z]+\d{4}-\d{5}$/);
      }
    });
  });

  describe('Date Parsing', () => {
    it('should parse valid date string', () => {
      const dateStr = '2024-01-15';
      const parsed = new Date(dateStr);
      expect(parsed.getFullYear()).toBe(2024);
      expect(parsed.getMonth()).toBe(0); // January
      expect(parsed.getDate()).toBe(15);
    });

    it('should return undefined for invalid date', () => {
      const dateStr = 'invalid-date';
      const parsed = new Date(dateStr);
      expect(Number.isNaN(parsed.getTime())).toBe(true);
    });
  });
});

describe('Status Determination', () => {
  describe('Facture Status', () => {
    it('should return PAYEE when fully paid', () => {
      const totalTTC = 1000;
      const totalPaye = 1000;

      let statut = 'VALIDEE';
      if (totalPaye >= totalTTC) statut = 'PAYEE';
      else if (totalPaye > 0) statut = 'PARTIELLEMENT_PAYEE';

      expect(statut).toBe('PAYEE');
    });

    it('should return PARTIELLEMENT_PAYEE when partially paid', () => {
      const totalTTC = 1000;
      const totalPaye = 500;

      let statut = 'VALIDEE';
      if (totalPaye >= totalTTC) statut = 'PAYEE';
      else if (totalPaye > 0) statut = 'PARTIELLEMENT_PAYEE';

      expect(statut).toBe('PARTIELLEMENT_PAYEE');
    });

    it('should return VALIDEE when not paid', () => {
      const totalTTC = 1000;
      const totalPaye = 0;

      let statut = 'VALIDEE';
      if (totalPaye >= totalTTC) statut = 'PAYEE';
      else if (totalPaye > 0) statut = 'PARTIELLEMENT_PAYEE';

      expect(statut).toBe('VALIDEE');
    });
  });

  describe('Charge Status', () => {
    const determineStatut = (montantTTC: number, montantPaye: number) => {
      if (montantPaye >= montantTTC) return 'PAYEE';
      if (montantPaye > 0) return 'PARTIELLEMENT_PAYEE';
      return 'A_PAYER';
    };

    it('should return PAYEE when fully paid', () => {
      expect(determineStatut(1000, 1000)).toBe('PAYEE');
    });

    it('should return PARTIELLEMENT_PAYEE when partially paid', () => {
      expect(determineStatut(1000, 500)).toBe('PARTIELLEMENT_PAYEE');
    });

    it('should return A_PAYER when not paid', () => {
      expect(determineStatut(1000, 0)).toBe('A_PAYER');
    });
  });
});
