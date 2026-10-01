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

type ContratForMention = {
  nom?: string | null;
  refExterne?: string | null;
  dateDebutConvention?: Date | null;
  numeroBonCommande?: string | null;
  bonsCommandes?: BcForResolution[] | null;
} | null;

const fmtDate = (d: Date) => new Intl.DateTimeFormat('fr-FR').format(new Date(d));

/** Le numéro de BC figure-t-il déjà dans la mention (formats "N° X", "\"X\"", "« X »") ? */
function mentionContientBC(mention: string, numero: string): boolean {
  const esc = numero.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(N°\\s*|["«]\\s*)${esc}(?![A-Za-z0-9])`, 'i').test(mention);
}

/**
 * Mention spéciale finale d'une facture (PDF téléchargé et PDF envoyé par email).
 * - Mention stockée vide → construite depuis le contrat (nom, réf, convention, BCs).
 * - Mention stockée présente → conservée, et complétée par le BC convention / BC site
 *   s'ils n'y figurent pas encore (ex : facture créée avant l'ajout du BC, ou pré-remplie sans).
 * Sans contrat lié, le BC du site est retrouvé s'il est unique pour ce client (jamais de BC ambigu).
 */
export async function construireMentionSpecialeFacture(facture: {
  clientId: string;
  siteId?: string | null;
  mentionSpeciale?: string | null;
  contrat?: ContratForMention;
}): Promise<string | null> {
  const contrat = facture.contrat ?? null;
  const siteId = facture.siteId ?? null;
  const bcs = (contrat?.bonsCommandes ?? []).map((b) => ({ numero: b.numero, date: b.date, sites: b.sites ?? [] }));

  let { bcConvention, bcSite } = resolveBCsPair(bcs, siteId);
  if (!contrat && siteId) {
    const { prisma } = await import('../config/database.js');
    const candidats = await prisma.bonCommande.findMany({
      where: { clientId: facture.clientId, actif: true, sites: { some: { siteId } } },
      select: { numero: true, date: true },
      take: 2,
    });
    if (candidats.length === 1) bcSite = candidats[0];
  }

  const both = bcConvention && bcSite;
  const bcParts: { numero: string; texte: string }[] = [];
  if (bcConvention) {
    const d = bcConvention.date ? ` du ${fmtDate(bcConvention.date)}` : '';
    bcParts.push({ numero: bcConvention.numero, texte: `BC${both ? ' convention' : ''} N° ${bcConvention.numero}${d}` });
  }
  if (bcSite) {
    const d = bcSite.date ? ` du ${fmtDate(bcSite.date)}` : '';
    bcParts.push({ numero: bcSite.numero, texte: `BC${both ? ' site' : ''} N° ${bcSite.numero}${d}` });
  }

  const stockee = facture.mentionSpeciale?.trim();
  if (stockee) {
    const manquants = bcParts.filter((p) => !mentionContientBC(stockee, p.numero)).map((p) => p.texte);
    return manquants.length ? [stockee, ...manquants].join(' — ') : stockee;
  }

  const parts: string[] = [];
  if (contrat?.nom?.trim()) parts.push(`Contrat « ${contrat.nom.trim()} »`);
  if (contrat?.refExterne) parts.push(`Selon le contrat N° ${contrat.refExterne}`);
  if (contrat?.dateDebutConvention) parts.push(`Convention signée le ${fmtDate(contrat.dateDebutConvention)}`);
  parts.push(...bcParts.map((p) => p.texte));
  // Fallback legacy : uniquement si aucun BonCommande entity n'existe
  if (contrat && bcParts.length === 0 && bcs.length === 0 && contrat.numeroBonCommande) {
    parts.push(`Bon de commande N° ${contrat.numeroBonCommande}`);
  }
  return parts.length > 0 ? parts.join(' — ') : null;
}
