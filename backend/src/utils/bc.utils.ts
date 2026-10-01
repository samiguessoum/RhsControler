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

const escapeRegex = (v: string) => v.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Référence à un BC dans une mention : "BC N° X", "BC site N° X", "Bon de commande N° X",
 * "bon de commande \"X\"", "« X »"… — exige le préfixe BC / bon de commande pour ne pas confondre
 * avec un autre numéro (ex : "Selon le contrat N° X"). Groupe 1 = référence complète.
 */
function regexReferenceBC(numero: string): RegExp {
  return new RegExp(
    `((?:\\bBC(?:\\s+(?:convention|site))?|bon\\s+de\\s+commande)\\s*(?:N°\\s*)?["«]?\\s*${escapeRegex(numero)}(?![A-Za-z0-9/-])\\s*["»]?)`,
    'i',
  );
}

/** Le numéro de BC figure-t-il déjà dans la mention ? */
function mentionContientBC(mention: string, numero: string): boolean {
  return regexReferenceBC(numero).test(mention);
}

/** Ajoute " du JJ/MM/AAAA" après la référence au BC si la mention ne porte pas encore sa date. */
function completerDateBC(mention: string, numero: string, date: Date | null): string {
  if (!date) return mention;
  const re = regexReferenceBC(numero);
  const m = re.exec(mention);
  if (!m) return mention;
  const fin = m.index + m[0].length;
  if (/^\s*(?:du|signé\s+le|en\s+date\s+du)\s+\d/i.test(mention.slice(fin))) return mention;
  const ref = m[0].replace(/\s+$/, '');
  return `${mention.slice(0, m.index)}${ref} du ${fmtDate(date)}${mention.slice(m.index + ref.length)}`;
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
  const bcParts: { numero: string; date: Date | null; texte: string }[] = [];
  if (bcConvention) {
    const d = bcConvention.date ? ` du ${fmtDate(bcConvention.date)}` : '';
    bcParts.push({ numero: bcConvention.numero, date: bcConvention.date, texte: `BC${both ? ' convention' : ''} N° ${bcConvention.numero}${d}` });
  }
  if (bcSite && bcSite.numero !== bcConvention?.numero) {
    const d = bcSite.date ? ` du ${fmtDate(bcSite.date)}` : '';
    bcParts.push({ numero: bcSite.numero, date: bcSite.date, texte: `BC${both ? ' site' : ''} N° ${bcSite.numero}${d}` });
  }

  const stockee = facture.mentionSpeciale?.trim();
  if (stockee) {
    // BC déjà cité → on lui ajoute sa date de signature si elle manque ; BC absent → ajouté en fin
    let mention = stockee;
    const manquants: string[] = [];
    for (const p of bcParts) {
      if (mentionContientBC(mention, p.numero)) mention = completerDateBC(mention, p.numero, p.date);
      else manquants.push(p.texte);
    }
    return manquants.length ? [mention, ...manquants].join(' — ') : mention;
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
