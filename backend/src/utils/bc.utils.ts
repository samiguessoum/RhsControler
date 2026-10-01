type BcForResolution = {
  numero: string;
  date: Date | null;
  sites: { siteId: string }[];
};

/**
 * Résout le BC applicable à un site donné, dans le contexte d'un contrat.
 * Priorité :
 *   1. BC lié explicitement à ce site (scope site)
 *   2. BC sans aucun site lié (scope contrat entier)
 *   3. null — ne jamais mettre un mauvais BC sur une facture
 */
export function resolverBC(
  bonsCommandes: BcForResolution[],
  siteId?: string | null,
): { numero: string; date: Date | null } | null {
  if (!bonsCommandes?.length) return null;

  if (siteId) {
    const bcSite = bonsCommandes.find((bc) => bc.sites.some((s) => s.siteId === siteId));
    if (bcSite) return { numero: bcSite.numero, date: bcSite.date };
  }

  const bcAll = bonsCommandes.find((bc) => bc.sites.length === 0);
  if (bcAll) return { numero: bcAll.numero, date: bcAll.date };

  // Aucun BC ne couvre ce site — ne pas inventer un numéro incorrect sur la facture
  return null;
}

/**
 * Retourne la paire (BC convention, BC site) pour affichage complet sur une facture.
 * - bcConvention : BC sans aucun lien de site (scope contrat entier)
 * - bcSite      : BC lié explicitement au site de la facture
 * Les deux peuvent être null. Si le même BC est à la fois convention et site (cas impossible
 * par construction) bcSite prend la priorité et bcConvention sera null.
 */
export function resolveBCsPair(
  bonsCommandes: BcForResolution[],
  siteId?: string | null,
): { bcConvention: { numero: string; date: Date | null } | null; bcSite: { numero: string; date: Date | null } | null } {
  const raw_bcConvention = bonsCommandes.find((bc) => bc.sites.length === 0) ?? null;
  const raw_bcSite = siteId
    ? (bonsCommandes.find((bc) => bc.sites.some((s) => s.siteId === siteId)) ?? null)
    : null;
  return {
    bcConvention: raw_bcConvention ? { numero: raw_bcConvention.numero, date: raw_bcConvention.date } : null,
    bcSite: raw_bcSite ? { numero: raw_bcSite.numero, date: raw_bcSite.date } : null,
  };
}
