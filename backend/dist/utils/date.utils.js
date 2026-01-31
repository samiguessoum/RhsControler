"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProchaineDateIntervention = getProchaineDateIntervention;
exports.getDaysBetween = getDaysBetween;
exports.isOverdue = isOverdue;
exports.isWithinDays = isWithinDays;
exports.getCurrentWeekBounds = getCurrentWeekBounds;
exports.formatDateFr = formatDateFr;
exports.formatICSDate = formatICSDate;
exports.parseDate = parseDate;
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
/**
 * Calcule la prochaine date d'intervention selon la fréquence
 */
function getProchaineDateIntervention(derniereDate, frequence, joursPersonnalises) {
    const frequenceMapping = {
        HEBDOMADAIRE: () => (0, date_fns_1.addWeeks)(derniereDate, 1),
        MENSUELLE: () => (0, date_fns_1.addMonths)(derniereDate, 1),
        TRIMESTRIELLE: () => (0, date_fns_1.addMonths)(derniereDate, 3),
        SEMESTRIELLE: () => (0, date_fns_1.addMonths)(derniereDate, 6),
        ANNUELLE: () => (0, date_fns_1.addMonths)(derniereDate, 12),
        PERSONNALISEE: () => (0, date_fns_1.addDays)(derniereDate, joursPersonnalises || 30),
    };
    return frequenceMapping[frequence]();
}
/**
 * Retourne le nombre de jours entre deux dates
 */
function getDaysBetween(date1, date2) {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
/**
 * Vérifie si une date est dans le passé (avant aujourd'hui)
 */
function isOverdue(date) {
    return (0, date_fns_1.startOfDay)(date) < (0, date_fns_1.startOfDay)(new Date());
}
/**
 * Vérifie si une date est dans les X prochains jours
 */
function isWithinDays(date, days) {
    const today = (0, date_fns_1.startOfDay)(new Date());
    const futureDate = (0, date_fns_1.addDays)(today, days);
    return date >= today && date <= futureDate;
}
/**
 * Retourne les bornes de la semaine courante
 */
function getCurrentWeekBounds() {
    const now = new Date();
    return {
        start: (0, date_fns_1.startOfWeek)(now, { weekStartsOn: 1 }), // Lundi
        end: (0, date_fns_1.endOfWeek)(now, { weekStartsOn: 1 }), // Dimanche
    };
}
/**
 * Formate une date pour affichage
 */
function formatDateFr(date) {
    return (0, date_fns_1.format)(date, 'dd/MM/yyyy', { locale: locale_1.fr });
}
/**
 * Formate une date pour export ICS (Google Calendar)
 */
function formatICSDate(date, heure) {
    let d = new Date(date);
    if (heure) {
        const [hours, minutes] = heure.split(':').map(Number);
        d.setHours(hours, minutes, 0, 0);
    }
    // Format: YYYYMMDDTHHMMSS
    return (0, date_fns_1.format)(d, "yyyyMMdd'T'HHmmss");
}
/**
 * Parse une date depuis différents formats
 */
function parseDate(dateStr) {
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
//# sourceMappingURL=date.utils.js.map