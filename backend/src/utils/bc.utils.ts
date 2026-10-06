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

const fmtDate = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' }).format(new Date(d));

/** Segments que l'ancien pré-remplissage mettait dans la mention spéciale : désormais calculés à part. */
const SEGMENT_AUTO =
  /^(?:Contrat\s+«|Selon\s+le\s+contrat\s+N°|Convention\s+signée\s+le|La\s+convention\b|BC(?:\s+(?:convention|site))?\s+N°|Bon\s+de\s+commande\s+N°|Selon\s+le\s+bon\s+de\s+commande\b)/i;

/** Mention libre saisie par l'utilisateur, sans les segments automatiques des anciennes factures. */
export function mentionLibre(mention?: string | null): string | null {
  const segments = (mention ?? '')
    .split(/\s+—\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !SEGMENT_AUTO.test(s));
  return segments.length ? segments.join(' — ') : null;
}

export type EnTeteFacture = {
  /** « La convention REF du JJ/MM/AAAA » — null sans convention */
  convention: string | null;
  /** « Selon le bon de commande N° X du JJ/MM/AAAA » — null sans BC */
  bonCommande: string | null;
  /** Précisions libres de l'utilisateur (mention spéciale) */
  mention: string | null;
};

/**
 * Lignes d'en-tête d'une facture (PDF téléchargé et PDF envoyé par email), sous la ligne du site :
 *   1. la convention du contrat (référence + date de signature), s'il y en a une ;
 *   2. le bon de commande concerné : celui de l'avenant, sinon le BC rattaché à l'opération
 *      facturée (même site, même jour), sinon le BC du site, sinon le BC du contrat ;
 *   3. la mention spéciale libre.
 */
export async function construireEnTeteFacture(facture: {
  clientId: string;
  siteId?: string | null;
  contratId?: string | null;
  avenantId?: string | null;
  dateOperation?: Date | null;
  mentionSpeciale?: string | null;
  refBonCommandeClient?: string | null;
}): Promise<EnTeteFacture> {
  const { prisma } = await import('../config/database.js');
  const siteId = facture.siteId ?? null;

  const contrat = facture.contratId
    ? await prisma.contrat.findUnique({
        where: { id: facture.contratId },
        select: {
          refExterne: true,
          dateDebutConvention: true,
          numeroBonCommande: true,
          bonsCommandes: {
            where: { actif: true },
            orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, numero: true, date: true, sites: { select: { siteId: true } } },
          },
        },
      })
    : null;

  let convention: string | null = null;
  if (contrat?.refExterne || contrat?.dateDebutConvention) {
    convention = ['La convention', contrat.refExterne, contrat.dateDebutConvention && `du ${fmtDate(contrat.dateDebutConvention)}`]
      .filter(Boolean)
      .join(' ');
  }

  let bc: { numero: string; date: Date | null } | null = null;
  if (facture.avenantId) {
    const av = await prisma.avenant.findUnique({ where: { id: facture.avenantId }, select: { numeroBonCommande: true, dateSignature: true } });
    if (av?.numeroBonCommande?.trim()) bc = { numero: av.numeroBonCommande.trim(), date: av.dateSignature };
  }
  if (!bc && facture.contratId && facture.dateOperation) {
    // BC réellement consommé par l'opération facturée
    const jour = new Date(facture.dateOperation);
    const debut = new Date(Date.UTC(jour.getUTCFullYear(), jour.getUTCMonth(), jour.getUTCDate()));
    const op = await prisma.intervention.findFirst({
      where: {
        contratId: facture.contratId,
        ...(siteId ? { siteId } : {}),
        avenantId: facture.avenantId ?? null,
        statut: 'REALISEE',
        bonCommandeId: { not: null },
        dateRealisee: { gte: debut, lt: new Date(debut.getTime() + 86_400_000) },
      },
      select: { bonCommande: { select: { numero: true, date: true } } },
    });
    if (op?.bonCommande) bc = op.bonCommande;
  }
  if (!bc && !facture.avenantId && contrat) bc = resolverBC(contrat.bonsCommandes, siteId);
  if (!bc && !contrat && siteId) {
    // Sans contrat : le BC du site s'il est unique pour ce client (jamais de BC ambigu)
    const candidats = await prisma.bonCommande.findMany({
      where: { clientId: facture.clientId, actif: true, sites: { some: { siteId } } },
      select: { numero: true, date: true },
      take: 2,
    });
    if (candidats.length === 1) bc = candidats[0];
  }
  if (!bc && !facture.avenantId && contrat?.numeroBonCommande?.trim() && contrat.bonsCommandes.length === 0) {
    bc = { numero: contrat.numeroBonCommande.trim(), date: null }; // champ historique du contrat
  }
  if (!bc && facture.refBonCommandeClient?.trim()) bc = { numero: facture.refBonCommandeClient.trim(), date: null };

  return {
    convention,
    bonCommande: bc ? `Selon le bon de commande N° ${bc.numero}${bc.date ? ` du ${fmtDate(bc.date)}` : ''}` : null,
    mention: mentionLibre(facture.mentionSpeciale),
  };
}
