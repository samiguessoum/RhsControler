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
 *   3. Premier BC du contrat (fallback)
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

  return { numero: bonsCommandes[0].numero, date: bonsCommandes[0].date };
}
