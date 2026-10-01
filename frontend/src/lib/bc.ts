/**
 * Niveaux d'alerte d'un bon de commande, calculés par le backend (quota, prévision sur les
 * opérations planifiées, fin de validité). Purement informatifs : rien n'est bloqué ni supprimé.
 */
export type NiveauAlerteBC =
  | 'DEPASSE'
  | 'EPUISE'
  | 'EXPIRE'
  | 'DERNIER'
  | 'ALERTE'
  | 'INSUFFISANT'
  | 'EXPIRATION_PROCHE';

export const NIVEAUX_BC: Record<NiveauAlerteBC, { label: string; badge: string; texte: string }> = {
  DEPASSE: { label: 'Quota dépassé', badge: 'bg-red-700 text-white', texte: 'text-red-700' },
  EPUISE: { label: 'Épuisé', badge: 'bg-red-600 text-white', texte: 'text-red-600' },
  EXPIRE: { label: 'Expiré', badge: 'bg-red-600 text-white', texte: 'text-red-600' },
  DERNIER: { label: 'Dernier passage', badge: 'bg-orange-500 text-white', texte: 'text-orange-500' },
  ALERTE: { label: 'Seuil atteint', badge: 'bg-yellow-500 text-white', texte: 'text-yellow-600' },
  INSUFFISANT: { label: 'BC insuffisant', badge: 'bg-amber-600 text-white', texte: 'text-amber-700' },
  EXPIRATION_PROCHE: { label: 'Expire bientôt', badge: 'bg-yellow-500 text-white', texte: 'text-yellow-600' },
};

/** Champs de prévision renvoyés par l'API avec chaque BC. */
export interface PrevisionBC {
  passagesRestants?: number | null;
  operationsPlanifiees?: number;
  operationsNonCouvertes?: number;
  dateEpuisementPrevue?: string | null;
  datePremiereNonCouverte?: string | null;
  joursAvantFinValidite?: number | null;
  niveauAlerte?: NiveauAlerteBC | null;
  motifs?: string[];
}

/** Date stockée à minuit UTC → JJ/MM/AAAA sans décalage de fuseau. */
export const formatDateBC = (d: string) => {
  const [y, m, j] = String(d).slice(0, 10).split('-');
  return `${j}/${m}/${y}`;
};

/** Le BC couvre-t-il ce site ? (sans site = tout le contrat) */
export const bcCouvreSite = (bc: { sites?: { siteId: string }[] }, siteId?: string | null) =>
  !bc.sites?.length || (!!siteId && bc.sites.some((s) => s.siteId === siteId));
