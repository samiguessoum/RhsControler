/**
 * Service de gestion du planning avec logique anti-oubli
 */
export declare const planningService: {
    /**
     * Récupère les statistiques du dashboard
     */
    getStats(): Promise<{
        aPlanifier: number;
        enRetard: number;
        controles30j: number;
        contratsEnAlerte: number;
        ponctuelAlerte: number;
    }>;
    /**
     * Récupère les contrats actifs sans intervention future planifiée
     */
    getContratsEnAlerte(): Promise<({
        client: {
            id: string;
            nomEntreprise: string;
        };
        interventions: {
            prestation: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.InterventionType;
            siteId: string | null;
            clientId: string;
            statut: import(".prisma/client").$Enums.InterventionStatut;
            contratId: string | null;
            datePrevue: Date;
            heurePrevue: string | null;
            duree: number | null;
            notesTerrain: string | null;
            responsable: string | null;
            dateRealisee: Date | null;
            exporteGCal: boolean;
            createdById: string;
            updatedById: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.ContratType;
        notes: string | null;
        prestations: string[];
        frequenceOperations: import(".prisma/client").$Enums.Frequence | null;
        frequenceOperationsJours: number | null;
        frequenceControle: import(".prisma/client").$Enums.Frequence | null;
        frequenceControleJours: number | null;
        premiereDateOperation: Date | null;
        premiereDateControle: Date | null;
        nombreOperations: number | null;
        clientId: string;
        dateDebut: Date;
        dateFin: Date | null;
        reconductionAuto: boolean;
        responsablePlanningId: string | null;
        statut: import(".prisma/client").$Enums.ContratStatut;
        autoCreerProchaine: boolean;
        numeroBonCommande: string | null;
    })[]>;
    /**
     * Récupère les contrats ponctuels avec 1 seule opération restante
     */
    getContratsPonctuelAlerte(): Promise<({
        client: {
            id: string;
            nomEntreprise: string;
        };
        contratSites: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            siteId: string;
            prestations: string[];
            frequenceOperations: import(".prisma/client").$Enums.Frequence | null;
            frequenceOperationsJours: number | null;
            frequenceControle: import(".prisma/client").$Enums.Frequence | null;
            frequenceControleJours: number | null;
            premiereDateOperation: Date | null;
            premiereDateControle: Date | null;
            nombreOperations: number | null;
            nombreVisitesControle: number | null;
            contratId: string;
        }[];
        interventions: {
            prestation: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.InterventionType;
            siteId: string | null;
            clientId: string;
            statut: import(".prisma/client").$Enums.InterventionStatut;
            contratId: string | null;
            datePrevue: Date;
            heurePrevue: string | null;
            duree: number | null;
            notesTerrain: string | null;
            responsable: string | null;
            dateRealisee: Date | null;
            exporteGCal: boolean;
            createdById: string;
            updatedById: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.ContratType;
        notes: string | null;
        prestations: string[];
        frequenceOperations: import(".prisma/client").$Enums.Frequence | null;
        frequenceOperationsJours: number | null;
        frequenceControle: import(".prisma/client").$Enums.Frequence | null;
        frequenceControleJours: number | null;
        premiereDateOperation: Date | null;
        premiereDateControle: Date | null;
        nombreOperations: number | null;
        clientId: string;
        dateDebut: Date;
        dateFin: Date | null;
        reconductionAuto: boolean;
        responsablePlanningId: string | null;
        statut: import(".prisma/client").$Enums.ContratStatut;
        autoCreerProchaine: boolean;
        numeroBonCommande: string | null;
    })[]>;
    /**
     * Récupère les interventions à planifier (dans les X prochains jours)
     */
    getAPlanifier(days?: number): Promise<({
        client: {
            id: string;
            nomEntreprise: string;
            sites: {
                id: string;
                nom: string;
                adresse: string | null;
            }[];
        };
        site: {
            id: string;
            nom: string;
            adresse: string | null;
        } | null;
        contrat: {
            id: string;
            type: import(".prisma/client").$Enums.ContratType;
            prestations: string[];
        } | null;
    } & {
        prestation: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.InterventionType;
        siteId: string | null;
        clientId: string;
        statut: import(".prisma/client").$Enums.InterventionStatut;
        contratId: string | null;
        datePrevue: Date;
        heurePrevue: string | null;
        duree: number | null;
        notesTerrain: string | null;
        responsable: string | null;
        dateRealisee: Date | null;
        exporteGCal: boolean;
        createdById: string;
        updatedById: string | null;
    })[]>;
    /**
     * Récupère les interventions en retard
     */
    getEnRetard(): Promise<({
        client: {
            id: string;
            nomEntreprise: string;
            sites: {
                id: string;
                nom: string;
                adresse: string | null;
            }[];
        };
        site: {
            id: string;
            nom: string;
            adresse: string | null;
        } | null;
        contrat: {
            id: string;
            type: import(".prisma/client").$Enums.ContratType;
            prestations: string[];
        } | null;
    } & {
        prestation: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.InterventionType;
        siteId: string | null;
        clientId: string;
        statut: import(".prisma/client").$Enums.InterventionStatut;
        contratId: string | null;
        datePrevue: Date;
        heurePrevue: string | null;
        duree: number | null;
        notesTerrain: string | null;
        responsable: string | null;
        dateRealisee: Date | null;
        exporteGCal: boolean;
        createdById: string;
        updatedById: string | null;
    })[]>;
    /**
     * Récupère les interventions de la semaine courante
     */
    getSemaineCourante(): Promise<({
        client: {
            id: string;
            nomEntreprise: string;
            sites: {
                id: string;
                nom: string;
                adresse: string | null;
            }[];
        };
        site: {
            id: string;
            nom: string;
            adresse: string | null;
        } | null;
        contrat: {
            id: string;
            type: import(".prisma/client").$Enums.ContratType;
            prestations: string[];
        } | null;
    } & {
        prestation: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.InterventionType;
        siteId: string | null;
        clientId: string;
        statut: import(".prisma/client").$Enums.InterventionStatut;
        contratId: string | null;
        datePrevue: Date;
        heurePrevue: string | null;
        duree: number | null;
        notesTerrain: string | null;
        responsable: string | null;
        dateRealisee: Date | null;
        exporteGCal: boolean;
        createdById: string;
        updatedById: string | null;
    })[]>;
    /**
     * Marque une intervention comme réalisée et gère la création de la prochaine
     * @param dateRealisee - Date effective de réalisation (si différente de datePrevue)
     *                       La prochaine intervention sera calculée à partir de cette date
     */
    marquerRealisee(interventionId: string, userId: string, options?: {
        creerProchaine?: boolean;
        notesTerrain?: string;
        dateRealisee?: Date;
    }): Promise<{
        intervention: {
            client: {
                id: string;
                actif: boolean;
                createdAt: Date;
                updatedAt: Date;
                nomEntreprise: string;
                secteur: string | null;
                siegeNom: string;
                siegeAdresse: string | null;
                siegeTel: string | null;
                siegeEmail: string | null;
                siegeNotes: string | null;
                siegeRC: string | null;
                siegeNIF: string | null;
                siegeAI: string | null;
                siegeNIS: string | null;
                siegeTIN: string | null;
            };
            contrat: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                type: import(".prisma/client").$Enums.ContratType;
                notes: string | null;
                prestations: string[];
                frequenceOperations: import(".prisma/client").$Enums.Frequence | null;
                frequenceOperationsJours: number | null;
                frequenceControle: import(".prisma/client").$Enums.Frequence | null;
                frequenceControleJours: number | null;
                premiereDateOperation: Date | null;
                premiereDateControle: Date | null;
                nombreOperations: number | null;
                clientId: string;
                dateDebut: Date;
                dateFin: Date | null;
                reconductionAuto: boolean;
                responsablePlanningId: string | null;
                statut: import(".prisma/client").$Enums.ContratStatut;
                autoCreerProchaine: boolean;
                numeroBonCommande: string | null;
            } | null;
        } & {
            prestation: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.InterventionType;
            siteId: string | null;
            clientId: string;
            statut: import(".prisma/client").$Enums.InterventionStatut;
            contratId: string | null;
            datePrevue: Date;
            heurePrevue: string | null;
            duree: number | null;
            notesTerrain: string | null;
            responsable: string | null;
            dateRealisee: Date | null;
            exporteGCal: boolean;
            createdById: string;
            updatedById: string | null;
        };
        nextCreated: boolean;
        nextIntervention: null;
        suggestedDate: null;
        operationsRestantes: number;
    } | {
        intervention: {
            client: {
                id: string;
                actif: boolean;
                createdAt: Date;
                updatedAt: Date;
                nomEntreprise: string;
                secteur: string | null;
                siegeNom: string;
                siegeAdresse: string | null;
                siegeTel: string | null;
                siegeEmail: string | null;
                siegeNotes: string | null;
                siegeRC: string | null;
                siegeNIF: string | null;
                siegeAI: string | null;
                siegeNIS: string | null;
                siegeTIN: string | null;
            };
            contrat: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                type: import(".prisma/client").$Enums.ContratType;
                notes: string | null;
                prestations: string[];
                frequenceOperations: import(".prisma/client").$Enums.Frequence | null;
                frequenceOperationsJours: number | null;
                frequenceControle: import(".prisma/client").$Enums.Frequence | null;
                frequenceControleJours: number | null;
                premiereDateOperation: Date | null;
                premiereDateControle: Date | null;
                nombreOperations: number | null;
                clientId: string;
                dateDebut: Date;
                dateFin: Date | null;
                reconductionAuto: boolean;
                responsablePlanningId: string | null;
                statut: import(".prisma/client").$Enums.ContratStatut;
                autoCreerProchaine: boolean;
                numeroBonCommande: string | null;
            } | null;
        } & {
            prestation: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.InterventionType;
            siteId: string | null;
            clientId: string;
            statut: import(".prisma/client").$Enums.InterventionStatut;
            contratId: string | null;
            datePrevue: Date;
            heurePrevue: string | null;
            duree: number | null;
            notesTerrain: string | null;
            responsable: string | null;
            dateRealisee: Date | null;
            exporteGCal: boolean;
            createdById: string;
            updatedById: string | null;
        };
        nextCreated: boolean;
        nextIntervention: ({
            client: {
                id: string;
                actif: boolean;
                createdAt: Date;
                updatedAt: Date;
                nomEntreprise: string;
                secteur: string | null;
                siegeNom: string;
                siegeAdresse: string | null;
                siegeTel: string | null;
                siegeEmail: string | null;
                siegeNotes: string | null;
                siegeRC: string | null;
                siegeNIF: string | null;
                siegeAI: string | null;
                siegeNIS: string | null;
                siegeTIN: string | null;
            };
        } & {
            prestation: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.InterventionType;
            siteId: string | null;
            clientId: string;
            statut: import(".prisma/client").$Enums.InterventionStatut;
            contratId: string | null;
            datePrevue: Date;
            heurePrevue: string | null;
            duree: number | null;
            notesTerrain: string | null;
            responsable: string | null;
            dateRealisee: Date | null;
            exporteGCal: boolean;
            createdById: string;
            updatedById: string | null;
        }) | null;
        suggestedDate: Date | null;
        operationsRestantes?: undefined;
    }>;
    /**
     * Reporter une intervention
     */
    reporter(interventionId: string, userId: string, nouvelleDatePrevue: Date, raison?: string): Promise<{
        client: {
            id: string;
            actif: boolean;
            createdAt: Date;
            updatedAt: Date;
            nomEntreprise: string;
            secteur: string | null;
            siegeNom: string;
            siegeAdresse: string | null;
            siegeTel: string | null;
            siegeEmail: string | null;
            siegeNotes: string | null;
            siegeRC: string | null;
            siegeNIF: string | null;
            siegeAI: string | null;
            siegeNIS: string | null;
            siegeTIN: string | null;
        };
        contrat: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.ContratType;
            notes: string | null;
            prestations: string[];
            frequenceOperations: import(".prisma/client").$Enums.Frequence | null;
            frequenceOperationsJours: number | null;
            frequenceControle: import(".prisma/client").$Enums.Frequence | null;
            frequenceControleJours: number | null;
            premiereDateOperation: Date | null;
            premiereDateControle: Date | null;
            nombreOperations: number | null;
            clientId: string;
            dateDebut: Date;
            dateFin: Date | null;
            reconductionAuto: boolean;
            responsablePlanningId: string | null;
            statut: import(".prisma/client").$Enums.ContratStatut;
            autoCreerProchaine: boolean;
            numeroBonCommande: string | null;
        } | null;
    } & {
        prestation: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.InterventionType;
        siteId: string | null;
        clientId: string;
        statut: import(".prisma/client").$Enums.InterventionStatut;
        contratId: string | null;
        datePrevue: Date;
        heurePrevue: string | null;
        duree: number | null;
        notesTerrain: string | null;
        responsable: string | null;
        dateRealisee: Date | null;
        exporteGCal: boolean;
        createdById: string;
        updatedById: string | null;
    }>;
    /**
     * Génère le planning initial pour un contrat.
     * Appelé automatiquement à la création du contrat.
     * Supporte les ContratSites (fréquences par site) et les contrats ponctuels (par nombre d'opérations).
     */
    genererPlanningContrat(contratId: string, userId: string): Promise<{
        contrat: {
            client: {
                id: string;
                actif: boolean;
                createdAt: Date;
                updatedAt: Date;
                nomEntreprise: string;
                secteur: string | null;
                siegeNom: string;
                siegeAdresse: string | null;
                siegeTel: string | null;
                siegeEmail: string | null;
                siegeNotes: string | null;
                siegeRC: string | null;
                siegeNIF: string | null;
                siegeAI: string | null;
                siegeNIS: string | null;
                siegeTIN: string | null;
            };
            contratSites: ({
                site: {
                    id: string;
                    email: string | null;
                    nom: string;
                    tel: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                    adresse: string | null;
                    contactNom: string | null;
                    contactFonction: string | null;
                    notes: string | null;
                    clientId: string;
                };
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                notes: string | null;
                siteId: string;
                prestations: string[];
                frequenceOperations: import(".prisma/client").$Enums.Frequence | null;
                frequenceOperationsJours: number | null;
                frequenceControle: import(".prisma/client").$Enums.Frequence | null;
                frequenceControleJours: number | null;
                premiereDateOperation: Date | null;
                premiereDateControle: Date | null;
                nombreOperations: number | null;
                nombreVisitesControle: number | null;
                contratId: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.ContratType;
            notes: string | null;
            prestations: string[];
            frequenceOperations: import(".prisma/client").$Enums.Frequence | null;
            frequenceOperationsJours: number | null;
            frequenceControle: import(".prisma/client").$Enums.Frequence | null;
            frequenceControleJours: number | null;
            premiereDateOperation: Date | null;
            premiereDateControle: Date | null;
            nombreOperations: number | null;
            clientId: string;
            dateDebut: Date;
            dateFin: Date | null;
            reconductionAuto: boolean;
            responsablePlanningId: string | null;
            statut: import(".prisma/client").$Enums.ContratStatut;
            autoCreerProchaine: boolean;
            numeroBonCommande: string | null;
        };
        interventionsCreees: any[];
        count: number;
    }>;
};
export default planningService;
//# sourceMappingURL=planning.service.d.ts.map