import { addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Calcule la prochaine date d'intervention selon un intervalle en jours
 */
export function getProchaineDateIntervention(
  derniereDate: Date,
  jours: number | null | undefined
): Date {
  return addDays(derniereDate, jours || 30);
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
