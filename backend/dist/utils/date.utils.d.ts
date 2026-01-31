import { Frequence } from '@prisma/client';
/**
 * Calcule la prochaine date d'intervention selon la fréquence
 */
export declare function getProchaineDateIntervention(derniereDate: Date, frequence: Frequence, joursPersonnalises?: number | null): Date;
/**
 * Retourne le nombre de jours entre deux dates
 */
export declare function getDaysBetween(date1: Date, date2: Date): number;
/**
 * Vérifie si une date est dans le passé (avant aujourd'hui)
 */
export declare function isOverdue(date: Date): boolean;
/**
 * Vérifie si une date est dans les X prochains jours
 */
export declare function isWithinDays(date: Date, days: number): boolean;
/**
 * Retourne les bornes de la semaine courante
 */
export declare function getCurrentWeekBounds(): {
    start: Date;
    end: Date;
};
/**
 * Formate une date pour affichage
 */
export declare function formatDateFr(date: Date): string;
/**
 * Formate une date pour export ICS (Google Calendar)
 */
export declare function formatICSDate(date: Date, heure?: string | null): string;
/**
 * Parse une date depuis différents formats
 */
export declare function parseDate(dateStr: string): Date | null;
//# sourceMappingURL=date.utils.d.ts.map