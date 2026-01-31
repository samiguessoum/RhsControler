import { addDays, addWeeks, addMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Frequence } from '@prisma/client';

/**
 * Calcule la prochaine date d'intervention selon la fréquence
 */
export function getProchaineDateIntervention(
  derniereDate: Date,
  frequence: Frequence,
  joursPersonnalises?: number | null
): Date {
  const frequenceMapping: Record<Frequence, () => Date> = {
    HEBDOMADAIRE: () => addWeeks(derniereDate, 1),
    MENSUELLE: () => addMonths(derniereDate, 1),
    TRIMESTRIELLE: () => addMonths(derniereDate, 3),
    SEMESTRIELLE: () => addMonths(derniereDate, 6),
    ANNUELLE: () => addMonths(derniereDate, 12),
    PERSONNALISEE: () => addDays(derniereDate, joursPersonnalises || 30),
  };

  return frequenceMapping[frequence]();
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
  // Essayer plusieurs formats
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
  ];

  for (const fmt of formats) {
    if (fmt.test(dateStr)) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Fallback
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}
