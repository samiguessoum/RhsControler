import { addDays, addMonths, getDay, startOfDay, endOfDay, startOfWeek, endOfWeek, format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Décale une date au dimanche si elle tombe un vendredi (5) ou samedi (6),
 * week-end algérien. N'affecte que les calculs automatiques — les saisies
 * manuelles contournent cette fonction.
 */
export function skipAlgerianWeekend(d: Date): Date {
  const day = getDay(d);
  if (day === 5) return addDays(d, 2); // vendredi → dimanche
  if (day === 6) return addDays(d, 1); // samedi → dimanche
  return d;
}

/**
 * Période saisonnière d'un site de contrat : du mois `moisDebut` au mois `moisFin` (1-12, inclus),
 * les passages ont lieu tous les `frequenceJours` jours. moisDebut > moisFin = période à cheval
 * sur deux années (ex : novembre → février).
 */
export type PeriodeFrequence = { moisDebut: number; moisFin: number; frequenceJours: number };

/** Lit les périodes stockées (JSON) en ignorant toute entrée invalide. */
export function parsePeriodesFrequence(value: unknown): PeriodeFrequence[] {
  if (!Array.isArray(value)) return [];
  const mois = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 12;
  return value
    .filter((p: any) => p && mois(p.moisDebut) && mois(p.moisFin) && Number.isInteger(p.frequenceJours) && p.frequenceJours > 0)
    .map((p: any) => ({ moisDebut: p.moisDebut, moisFin: p.moisFin, frequenceJours: p.frequenceJours }));
}

/** Période saisonnière couvrant la date (la première qui correspond), sinon null. */
export function periodeALaDate(date: Date, periodes?: PeriodeFrequence[] | null): PeriodeFrequence | null {
  if (!periodes?.length) return null;
  const m = date.getMonth() + 1;
  return periodes.find((p) => (p.moisDebut <= p.moisFin ? m >= p.moisDebut && m <= p.moisFin : m >= p.moisDebut || m <= p.moisFin)) ?? null;
}

/**
 * Fréquence qui s'applique à un passage à cette date : celle de la période saisonnière qui la
 * couvre, sinon la fréquence normale (jours ou mois).
 */
export function frequenceALaDate(
  date: Date,
  jours: number | null | undefined,
  mois: number | null | undefined,
  periodes?: PeriodeFrequence[] | null,
): { jours: number | null; mois: number | null } {
  const p = periodeALaDate(date, periodes);
  if (p) return { jours: p.frequenceJours, mois: null };
  return { jours: mois ? null : (jours ?? null), mois: mois ?? null };
}

/**
 * Calcule la prochaine date d'intervention selon un intervalle en jours ou en mois calendaires.
 * Avec des périodes saisonnières, la fréquence est celle qui s'applique à la date du passage.
 */
export function getProchaineDateIntervention(
  derniereDate: Date,
  jours?: number | null,
  mois?: number | null,
  periodes?: PeriodeFrequence[] | null,
): Date {
  const f = frequenceALaDate(derniereDate, jours, mois, periodes);
  if (f.mois) return skipAlgerianWeekend(addMonths(derniereDate, f.mois));
  return skipAlgerianWeekend(addDays(derniereDate, f.jours || 30));
}

/**
 * Retourne la plus grande des deux dates
 */
export function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

/**
 * Retourne le nombre de jours entre deux dates
 */
export function getDaysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Vérifie si une date est dans le passé (avant aujourd'hui)
 */
export function isOverdue(date: Date): boolean {
  return startOfDay(date) < startOfDay(new Date());
}

/**
 * Vérifie si une date est dans les X prochains jours
 */
export function isWithinDays(date: Date, days: number): boolean {
  const today = startOfDay(new Date());
  const futureDate = addDays(today, days);
  return date >= today && date <= futureDate;
}

/**
 * Retourne les bornes de la semaine courante
 */
export function getCurrentWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: startOfWeek(now, { weekStartsOn: 1 }), // Lundi
    end: endOfWeek(now, { weekStartsOn: 1 }), // Dimanche
  };
}

/**
 * Formate une date pour affichage
 */
export function formatDateFr(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: fr });
}

/**
 * Formate une date pour export ICS (Google Calendar)
 */
export function formatICSDate(date: Date, heure?: string | null): string {
  let d = new Date(date);

  if (heure) {
    const [hours, minutes] = heure.split(':').map(Number);
    d.setHours(hours, minutes, 0, 0);
  }

  // Format: YYYYMMDDTHHMMSS
  return format(d, "yyyyMMdd'T'HHmmss");
}

/**
 * Parse une date depuis différents formats
 */
export function parseDate(dateStr: string): Date | null {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return isNaN(date.getTime()) ? null : date;
  }

  // DD/MM/YYYY — construit explicitement pour éviter l'interprétation MM/DD/YYYY de Date()
  const frMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
  if (frMatch) {
    const [, day, month, year] = frMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return isNaN(date.getTime()) ? null : date;
  }

  // Fallback
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}
