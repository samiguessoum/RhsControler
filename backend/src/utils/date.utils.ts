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
 * Période saisonnière (site de contrat ou avenant), répétée chaque année : du jour `debut` au jour
 * `fin` inclus (format "MM-JJ" ; à cheval sur deux années si debut > fin, ex : "11-15" → "02-28"),
 * les passages ont lieu tous les `frequenceJours` jours ou tous les `frequenceMois` mois.
 * Une période ne force aucune date : elle change seulement la fréquence des passages qui tombent
 * dedans (le flux reste continu).
 */
export type PeriodeFrequence = {
  debut: string;
  fin: string;
  frequenceJours: number | null;
  frequenceMois: number | null;
};

const JOURS_PAR_MOIS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** "MM-JJ" valide (29 février accepté) ? */
export function estJourAnnuel(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{2}-\d{2}$/.test(v)) return false;
  const [m, j] = v.split('-').map(Number);
  return m >= 1 && m <= 12 && j >= 1 && j <= JOURS_PAR_MOIS[m - 1];
}

const entierPositif = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);

/**
 * Lit les périodes stockées (JSON) en ignorant toute entrée invalide. Accepte l'ancien format en
 * mois entiers ({ moisDebut, moisFin, frequenceJours }).
 */
export function parsePeriodesFrequence(value: unknown): PeriodeFrequence[] {
  if (!Array.isArray(value)) return [];
  const result: PeriodeFrequence[] = [];
  for (const p of value as any[]) {
    if (!p) continue;
    let debut = p.debut;
    let fin = p.fin;
    if (debut === undefined && Number.isInteger(p.moisDebut) && Number.isInteger(p.moisFin)) {
      debut = `${String(p.moisDebut).padStart(2, '0')}-01`;
      fin = `${String(p.moisFin).padStart(2, '0')}-${JOURS_PAR_MOIS[p.moisFin - 1] ?? 31}`;
    }
    const frequenceMois = entierPositif(p.frequenceMois);
    const frequenceJours = frequenceMois ? null : entierPositif(p.frequenceJours);
    if (estJourAnnuel(debut) && estJourAnnuel(fin) && (frequenceJours || frequenceMois)) {
      result.push({ debut, fin, frequenceJours, frequenceMois });
    }
  }
  return result;
}

/** Jour de l'année au format comparable MMJJ (ex : 5 septembre → 905). */
const cleJour = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate();
const cle = (mmjj: string) => Number(mmjj.replace('-', ''));

/** Période saisonnière couvrant la date (la première qui correspond), sinon null. */
export function periodeALaDate(date: Date, periodes?: PeriodeFrequence[] | null): PeriodeFrequence | null {
  if (!periodes?.length) return null;
  const k = cleJour(date);
  return periodes.find((p) => {
    const d = cle(p.debut);
    const f = cle(p.fin);
    return d <= f ? k >= d && k <= f : k >= d || k <= f;
  }) ?? null;
}

/**
 * Fréquence qui s'applique à un passage à cette date : celle de la période saisonnière qui la
 * couvre, sinon la fréquence normale (mois prioritaire sur jours).
 */
export function frequenceALaDate(
  date: Date,
  jours: number | null | undefined,
  mois: number | null | undefined,
  periodes?: PeriodeFrequence[] | null,
): { jours: number | null; mois: number | null } {
  const p = periodeALaDate(date, periodes);
  if (p) return { jours: p.frequenceMois ? null : p.frequenceJours, mois: p.frequenceMois };
  return { jours: mois ? null : (jours ?? null), mois: mois ?? null };
}

/**
 * Échéance théorique suivante (sans report du week-end). Pour générer une série, avancer sur les
 * dates théoriques et ne reporter que chaque date affichée : sinon les reports s'accumulent
 * (le 5 du mois devient le 7, puis le 9…).
 */
export function prochaineDateTheorique(
  derniereDate: Date,
  jours?: number | null,
  mois?: number | null,
  periodes?: PeriodeFrequence[] | null,
): Date {
  const f = frequenceALaDate(derniereDate, jours, mois, periodes);
  return f.mois ? addMonths(derniereDate, f.mois) : addDays(derniereDate, f.jours || 30);
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
