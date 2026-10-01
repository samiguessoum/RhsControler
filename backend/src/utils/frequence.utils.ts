import { frequenceALaDate, parsePeriodesFrequence, periodeALaDate, type PeriodeFrequence } from './date.utils.js';

type SourceFrequence = {
  frequenceOperationsJours?: number | null;
  frequenceOperationsMois?: number | null;
  periodesFrequence?: unknown;
} | null | undefined;

const aUneFrequence = (s: SourceFrequence) => !!(s && (s.frequenceOperationsMois || s.frequenceOperationsJours));

/**
 * Fréquence des opérations d'une intervention : celle de son avenant s'il en définit une, sinon
 * celle de son site de contrat, sinon celle du contrat. Les périodes saisonnières suivent la même
 * source (avenant → site).
 */
export function sourceFrequenceOperations(intervention: {
  siteId?: string | null;
  avenant?: SourceFrequence;
  contrat?: (SourceFrequence & { contratSites?: (SourceFrequence & { siteId: string })[] | null }) | null;
}): { jours: number | null; mois: number | null; periodes: PeriodeFrequence[]; source: 'avenant' | 'site' | 'contrat' | null } {
  const cs = intervention.siteId
    ? intervention.contrat?.contratSites?.find((s) => s.siteId === intervention.siteId)
    : undefined;
  const avenant = intervention.avenant;
  const choix: [SourceFrequence, 'avenant' | 'site' | 'contrat'][] = [[avenant, 'avenant'], [cs, 'site'], [intervention.contrat, 'contrat']];
  const trouve = choix.find(([s]) => aUneFrequence(s));
  const src = trouve?.[0];
  const mois = src?.frequenceOperationsMois ?? null;
  // Périodes : celles de l'avenant si sa fréquence s'applique, sinon celles du site
  const periodes = parsePeriodesFrequence(trouve?.[1] === 'avenant' ? avenant?.periodesFrequence : cs?.periodesFrequence);
  return { jours: mois ? null : (src?.frequenceOperationsJours ?? null), mois, periodes, source: trouve?.[1] ?? null };
}

/** Fréquence effective d'un passage à une date donnée (période saisonnière comprise). */
export function frequenceOperationsALaDate(intervention: Parameters<typeof sourceFrequenceOperations>[0], date: Date) {
  const src = sourceFrequenceOperations(intervention);
  return { ...frequenceALaDate(date, src.jours, src.mois, src.periodes), enPeriode: !!periodeALaDate(date, src.periodes), source: src.source };
}
