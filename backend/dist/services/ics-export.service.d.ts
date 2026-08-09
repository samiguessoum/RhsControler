export interface ICSExportOptions {
    dateDebut?: Date;
    dateFin?: Date;
    statuts?: string[];
    clientId?: string;
}
/**
 * Service d'export ICS pour Google Calendar
 */
export declare const icsService: {
    /**
     * Génère un fichier ICS pour les interventions
     */
    generateICS(options?: ICSExportOptions): Promise<string>;
    formatStatut(statut: string): string;
    createEvent(params: {
        uid: string;
        summary: string;
        description: string;
        location: string;
        dtstart: string;
        dtend: string;
        status: string;
    }): string;
    wrapCalendar(events: string[]): string;
    /**
     * Marque les interventions comme exportées
     */
    markAsExported(interventionIds: string[]): Promise<void>;
};
export default icsService;
//# sourceMappingURL=ics-export.service.d.ts.map