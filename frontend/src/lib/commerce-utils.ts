import { Badge } from '@/components/ui/badge';
import { createElement } from 'react';

// ============ CONFIGURATION ============

export const EMPTY_LINE = {
  produitServiceId: undefined as string | undefined,
  libelle: '',
  description: '',
  quantite: 1,
  unite: '',
  prixUnitaireHT: 0,
  tauxTVA: 19,
  remisePct: 0,
  ordre: 1,
};

export const TVA_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 9, label: '9%' },
  { value: 19, label: '19%' },
];

export const NIVEAU_RELANCE_OPTIONS = [
  { value: 1, label: 'Niveau 1 - Rappel amical', description: 'Premier rappel courtois' },
  { value: 2, label: 'Niveau 2 - Relance ferme', description: 'Deuxième rappel plus insistant' },
  { value: 3, label: 'Niveau 3 - Mise en demeure', description: 'Dernier avertissement avant action' },
];

// ============ HELPERS ============

export interface LigneInput {
  quantite: number;
  prixUnitaireHT?: number;
  tauxTVA?: number;
  remisePct?: number;
}

export interface Totals {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

/**
 * Calculate totals from document lines
 * @param lignes Array of line items
 * @param sign Use -1 for credit notes (avoirs), 1 for regular documents
 */
export function computeTotals(lignes: LigneInput[], sign: number = 1): Totals {
  const totalHT = lignes.reduce((sum, l) => {
    const prix = l.prixUnitaireHT ?? 0;
    const remise = l.remisePct ? (l.remisePct / 100) : 0;
    return sum + l.quantite * prix * (1 - remise);
  }, 0) * sign;

  const totalTVA = lignes.reduce((sum, l) => {
    const prix = l.prixUnitaireHT ?? 0;
    const tva = l.tauxTVA ?? 0;
    const remise = l.remisePct ? (l.remisePct / 100) : 0;
    const ht = l.quantite * prix * (1 - remise);
    return sum + ht * (tva / 100);
  }, 0) * sign;

  return { totalHT, totalTVA, totalTTC: totalHT + totalTVA };
}

/**
 * Format amount in Algerian Dinar
 */
export function formatMontant(montant: number | undefined | null): string {
  if (montant === undefined || montant === null) return '-';
  return new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(montant) + ' DA';
}

/**
 * Format date in French locale
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ============ STATUS MAPPINGS ============

export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive';

export interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

/**
 * Complete mapping of all document statuses
 */
export const STATUS_MAP: Record<string, StatusConfig> = {
  // Common statuses
  BROUILLON: { label: 'Brouillon', variant: 'secondary' },
  VALIDE: { label: 'Validé', variant: 'success' },
  VALIDEE: { label: 'Validée', variant: 'success' },
  ANNULE: { label: 'Annulé', variant: 'destructive' },
  ANNULEE: { label: 'Annulée', variant: 'destructive' },

  // Devis statuses
  SIGNE: { label: 'Signé', variant: 'success' },
  REFUSE: { label: 'Refusé', variant: 'destructive' },
  EXPIRE: { label: 'Expiré', variant: 'warning' },
  ENVOYEE: { label: 'Envoyée', variant: 'default' },

  // Command statuses
  EN_PREPARATION: { label: 'En préparation', variant: 'warning' },
  EXPEDIEE: { label: 'Expédiée', variant: 'warning' },
  LIVREE: { label: 'Livrée', variant: 'success' },
  CONFIRMEE: { label: 'Confirmée', variant: 'success' },
  EN_RECEPTION: { label: 'En réception', variant: 'warning' },
  RECUE: { label: 'Reçue', variant: 'success' },

  // Payment statuses
  EN_RETARD: { label: 'En retard', variant: 'destructive' },
  PARTIELLEMENT_PAYEE: { label: 'Partiellement payée', variant: 'warning' },
  PAYEE: { label: 'Payée', variant: 'success' },
  A_PAYER: { label: 'À payer', variant: 'warning' },
};

/**
 * Get status configuration for a status code
 */
export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status] || { label: status, variant: 'secondary' };
}

/**
 * Create a status badge element
 */
export function statusBadge(status: string) {
  const config = getStatusConfig(status);
  return createElement(Badge, { variant: config.variant }, config.label);
}

// ============ TYPE LABELS ============

export const DOCUMENT_TYPE_LABELS = {
  devis: 'Devis',
  commande: 'Commande',
  facture: 'Facture',
  avoir: 'Avoir',
  commandeFournisseur: 'Commande fournisseur',
  factureFournisseur: 'Facture fournisseur',
} as const;

export const CHARGE_TYPE_LABELS = {
  FOURNISSEUR: 'Fournisseur',
  FISCALE: 'Fiscale',
  SOCIALE: 'Sociale',
  DIVERSE: 'Diverse',
} as const;

export const PAIEMENT_TYPE_LABELS = {
  ENCAISSEMENT: 'Encaissement',
  DECAISSEMENT: 'Décaissement',
} as const;
