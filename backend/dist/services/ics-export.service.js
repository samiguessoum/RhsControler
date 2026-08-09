import { prisma } from '../config/database.js';
import { formatICSDate } from '../utils/date.utils.js';
import { addMinutes } from 'date-fns';
/**
 * Service d'export ICS pour Google Calendar
 */
export const icsService = {
    /**
     * Génère un fichier ICS pour les interventions
     */
    async generateICS(options = {}) {
        const where = {};
        if (options.dateDebut || options.dateFin) {
            where.datePrevue = {};
            if (options.dateDebut)
                where.datePrevue.gte = options.dateDebut;
            if (options.dateFin)
                where.datePrevue.lte = options.dateFin;
        }
        if (options.statuts && options.statuts.length > 0) {
            where.statut = { in: options.statuts };
        }
        if (options.clientId) {
            where.clientId = options.clientId;
        }
        const interventions = await prisma.intervention.findMany({
            where,
            include: {
                client: {
                    select: { nomEntreprise: true, sites: { select: { adresse: true, tel: true } } },
                },
                contrat: {
                    select: { type: true },
                },
            },
            orderBy: { datePrevue: 'asc' },
        });
        const events = interventions.map((intervention) => {
            const duree = intervention.duree || 60; // Durée par défaut: 1h
            const startDate = intervention.datePrevue;
            const endDate = addMinutes(startDate, duree);
            // Parse l'heure si fournie
            let startHour = '09:00';
            if (intervention.heurePrevue) {
                startHour = intervention.heurePrevue;
            }
            const [hours, minutes] = startHour.split(':').map(Number);
            startDate.setHours(hours, minutes, 0, 0);
            endDate.setHours(hours, minutes + duree, 0, 0);
            const typeEmojiMap = {
                'OPERATION': '🔧',
                'CONTROLE': '🔍',
                'RECLAMATION': '⚠️',
                'PREMIERE_VISITE': '🏢',
                'DEPLACEMENT_COMMERCIAL': '📦',
            };
            const typeLabelMap = {
                'OPERATION': 'Opération',
                'CONTROLE': 'Contrôle',
                'RECLAMATION': 'Réclamation',
                'PREMIERE_VISITE': 'Première visite',
                'DEPLACEMENT_COMMERCIAL': 'Déplacement commercial',
            };
            const typeEmoji = typeEmojiMap[intervention.type] || '📋';
            const typeLabel = typeLabelMap[intervention.type] || intervention.type;
            const summary = `${typeEmoji} ${intervention.client.nomEntreprise}${intervention.prestation ? ` - ${intervention.prestation}` : ''}`;
            const description = [
                `Type: ${typeLabel}`,
                intervention.prestation ? `Prestation: ${intervention.prestation}` : null,
                intervention.responsable ? `Responsable: ${intervention.responsable}` : null,
                intervention.notesTerrain ? `Notes: ${intervention.notesTerrain}` : null,
                intervention.client.sites?.[0]?.tel ? `Tél client: ${intervention.client.sites[0].tel}` : null,
                '',
                `Statut: ${this.formatStatut(intervention.statut)}`,
            ].filter(Boolean).join('\\n');
            const location = intervention.client.sites?.[0]?.adresse || '';
            return this.createEvent({
                uid: `${intervention.id}@rhs-planning`,
                summary,
                description,
                location,
                dtstart: formatICSDate(startDate, intervention.heurePrevue),
                dtend: formatICSDate(endDate, intervention.heurePrevue),
                status: intervention.statut === 'PLANIFIEE' ? 'CONFIRMED' : 'TENTATIVE',
            });
        });
        return this.wrapCalendar(events);
    },
    formatStatut(statut) {
        const map = {
            A_PLANIFIER: 'À planifier',
            PLANIFIEE: 'Planifiée',
            REALISEE: 'Réalisée',
            REPORTEE: 'Reportée',
            ANNULEE: 'Annulée',
        };
        return map[statut] || statut;
    },
    createEvent(params) {
        // Escape des caractères spéciaux ICS
        const escape = (str) => str
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,');
        return `BEGIN:VEVENT
UID:${params.uid}
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${params.dtstart}
DTEND:${params.dtend}
SUMMARY:${escape(params.summary)}
DESCRIPTION:${params.description}
LOCATION:${escape(params.location)}
STATUS:${params.status}
END:VEVENT`;
    },
    wrapCalendar(events) {
        return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//RHS Controler//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:RHS Controler - Interventions
X-WR-TIMEZONE:Africa/Algiers
${events.join('\n')}
END:VCALENDAR`;
    },
    /**
     * Marque les interventions comme exportées
     */
    async markAsExported(interventionIds) {
        await prisma.intervention.updateMany({
            where: { id: { in: interventionIds } },
            data: { exporteGCal: true },
        });
    },
};
export default icsService;
//# sourceMappingURL=ics-export.service.js.map