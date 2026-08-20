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
            createdById: string;
            exporteGCal: boolean;
            updatedById: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.ContratType;
        notes: string | null;
        prestations: string[];
        frequenceOperationsJours: number | null;
        frequenceControleJours: number | null;
        premiereDateOperation: Date | null;
        premiereDateControle: Date | null;
        nombreOperations: number | null;
        nombreVisitesControle: number | null;
        clientId: string;
        dateDebut: Date;
        dateFin: Date | null;
        reconductionAuto: boolean;
        responsablePlanningId: string | null;
        statut: import(".prisma/client").$Enums.ContratStatut;
        autoCreerProchaine: boolean;
        numeroBonCommande: string | null;
        attestationMessageTemplate: string | null;
        attestationGarantieMessageTemplate: string | null;
        attestationControleMessageTemplate: string | null;
    })[]>;
    /**
     * Récupère les contrats ponctuels avec 2 ou moins opérations restantes
     */
    getContratsPonctuelAlerte(): Promise<{
        operationsRestantes: number;
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
            prixPrestations: import("@prisma/client/runtime/library").JsonValue;
            frequenceOperationsJours: number | null;
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
            createdById: string;
            exporteGCal: boolean;
            updatedById: string | null;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.ContratType;
        notes: string | null;
        prestations: string[];
        frequenceOperationsJours: number | null;
        frequenceControleJours: number | null;
        premiereDateOperation: Date | null;
        premiereDateControle: Date | null;
        nombreOperations: number | null;
        nombreVisitesControle: number | null;
        clientId: string;
        dateDebut: Date;
        dateFin: Date | null;
        reconductionAuto: boolean;
        responsablePlanningId: string | null;
        statut: import(".prisma/client").$Enums.ContratStatut;
        autoCreerProchaine: boolean;
        numeroBonCommande: string | null;
        attestationMessageTemplate: string | null;
        attestationGarantieMessageTemplate: string | null;
        attestationControleMessageTemplate: string | null;
    }[]>;
    /**
     * Récupère les contrats annuels proches de la fin (dans les 60 jours)
     * pour faciliter la reconduction
     */
    getContratsAnnuelsFinProche(joursAvantFin?: number): Promise<{
        joursRestants: number | null;
        client: {
            id: string;
            nomEntreprise: string;
        };
        contratSites: ({
            site: {
                id: string;
                nom: string;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            siteId: string;
            prestations: string[];
            prixPrestations: import("@prisma/client/runtime/library").JsonValue;
            frequenceOperationsJours: number | null;
            frequenceControleJours: number | null;
            premiereDateOperation: Date | null;
            premiereDateControle: Date | null;
            nombreOperations: number | null;
            nombreVisitesControle: number | null;
            contratId: string;
        })[];
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
            createdById: string;
            exporteGCal: boolean;
            updatedById: string | null;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.ContratType;
        notes: string | null;
        prestations: string[];
        frequenceOperationsJours: number | null;
        frequenceControleJours: number | null;
        premiereDateOperation: Date | null;
        premiereDateControle: Date | null;
        nombreOperations: number | null;
        nombreVisitesControle: number | null;
        clientId: string;
        dateDebut: Date;
        dateFin: Date | null;
        reconductionAuto: boolean;
        responsablePlanningId: string | null;
        statut: import(".prisma/client").$Enums.ContratStatut;
        autoCreerProchaine: boolean;
        numeroBonCommande: string | null;
        attestationMessageTemplate: string | null;
        attestationGarantieMessageTemplate: string | null;
        attestationControleMessageTemplate: string | null;
    }[]>;
    /**
     * Récupère les contrats annuels ayant des interventions planifiées au-delà de la date de fin
     */
    getContratsHorsValidite(): Promise<{
        contrat: any;
        client: any;
        count: number;
        nextDate: Date;
    }[]>;
    /**
     * Récupère les interventions à planifier (dans les X prochains jours)
     */
    getAPlanifier(days?: number): Promise<({
        client: {
            id: string;
            nomEntreprise: string;
            sites: {
                adresse: string | null;
                id: string;
                nom: string;
            }[];
        };
        site: {
            adresse: string | null;
            id: string;
            nom: string;
        } | null;
        contrat: {
            id: string;
            type: import(".prisma/client").$Enums.ContratType;
            prestations: string[];
        } | null;
        interventionEmployes: ({
            employe: {
                postes: {
                    id: string;
                    nom: string;
                    actif: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                }[];
            } & {
                id: string;
                nom: string;
                prenom: string;
                createdAt: Date;
                updatedAt: Date;
                salaireBase: number | null;
                dateEntree: Date | null;
            };
            poste: {
                id: string;
                nom: string;
                actif: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            id: string;
            employeId: string;
            createdAt: Date;
            posteId: string;
            interventionId: string;
        })[];
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
        createdById: string;
        exporteGCal: boolean;
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
                adresse: string | null;
                id: string;
                nom: string;
            }[];
        };
        site: {
            adresse: string | null;
            id: string;
            nom: string;
        } | null;
        contrat: {
            id: string;
            type: import(".prisma/client").$Enums.ContratType;
            prestations: string[];
        } | null;
        interventionEmployes: ({
            employe: {
                postes: {
                    id: string;
                    nom: string;
                    actif: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                }[];
            } & {
                id: string;
                nom: string;
                prenom: string;
                createdAt: Date;
                updatedAt: Date;
                salaireBase: number | null;
                dateEntree: Date | null;
            };
            poste: {
                id: string;
                nom: string;
                actif: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            id: string;
            employeId: string;
            createdAt: Date;
            posteId: string;
            interventionId: string;
        })[];
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
        createdById: string;
        exporteGCal: boolean;
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
                adresse: string | null;
                id: string;
                nom: string;
            }[];
        };
        site: {
            adresse: string | null;
            id: string;
            nom: string;
        } | null;
        contrat: {
            id: string;
            type: import(".prisma/client").$Enums.ContratType;
            prestations: string[];
        } | null;
        interventionEmployes: ({
            employe: {
                postes: {
                    id: string;
                    nom: string;
                    actif: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                }[];
            } & {
                id: string;
                nom: string;
                prenom: string;
                createdAt: Date;
                updatedAt: Date;
                salaireBase: number | null;
                dateEntree: Date | null;
            };
            poste: {
                id: string;
                nom: string;
                actif: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            id: string;
            employeId: string;
            createdAt: Date;
            posteId: string;
            interventionId: string;
        })[];
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
        createdById: string;
        exporteGCal: boolean;
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
                code: string | null;
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
                siegeNIN: string | null;
                siegeTIN: string | null;
                devise: string | null;
                nomAlias: string | null;
                typeTiers: import(".prisma/client").$Enums.TypeTiers;
                formeJuridique: import(".prisma/client").$Enums.FormeJuridique | null;
                tvaIntracom: string | null;
                capital: number | null;
                dateCreation: Date | null;
                siegeCodePostal: string | null;
                siegeVille: string | null;
                siegePays: string | null;
                siegeFax: string | null;
                siegeWebsite: string | null;
                categorie: string | null;
                codeComptaClient: string | null;
                codeComptaFournisseur: string | null;
                modePaiementId: string | null;
                conditionPaiementId: string | null;
                remiseParDefaut: number | null;
                encoursMaximum: number | null;
                notePublique: string | null;
                notePrivee: string | null;
                prospectNiveau: number | null;
                prospectStatut: string | null;
            };
            contrat: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                type: import(".prisma/client").$Enums.ContratType;
                notes: string | null;
                prestations: string[];
                frequenceOperationsJours: number | null;
                frequenceControleJours: number | null;
                premiereDateOperation: Date | null;
                premiereDateControle: Date | null;
                nombreOperations: number | null;
                nombreVisitesControle: number | null;
                clientId: string;
                dateDebut: Date;
                dateFin: Date | null;
                reconductionAuto: boolean;
                responsablePlanningId: string | null;
                statut: import(".prisma/client").$Enums.ContratStatut;
                autoCreerProchaine: boolean;
                numeroBonCommande: string | null;
                attestationMessageTemplate: string | null;
                attestationGarantieMessageTemplate: string | null;
                attestationControleMessageTemplate: string | null;
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
            createdById: string;
            exporteGCal: boolean;
            updatedById: string | null;
        };
        nextCreated: boolean;
        nextIntervention: any;
        suggestedDate: Date | null;
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
            code: string | null;
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
            siegeNIN: string | null;
            siegeTIN: string | null;
            devise: string | null;
            nomAlias: string | null;
            typeTiers: import(".prisma/client").$Enums.TypeTiers;
            formeJuridique: import(".prisma/client").$Enums.FormeJuridique | null;
            tvaIntracom: string | null;
            capital: number | null;
            dateCreation: Date | null;
            siegeCodePostal: string | null;
            siegeVille: string | null;
            siegePays: string | null;
            siegeFax: string | null;
            siegeWebsite: string | null;
            categorie: string | null;
            codeComptaClient: string | null;
            codeComptaFournisseur: string | null;
            modePaiementId: string | null;
            conditionPaiementId: string | null;
            remiseParDefaut: number | null;
            encoursMaximum: number | null;
            notePublique: string | null;
            notePrivee: string | null;
            prospectNiveau: number | null;
            prospectStatut: string | null;
        };
        contrat: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.ContratType;
            notes: string | null;
            prestations: string[];
            frequenceOperationsJours: number | null;
            frequenceControleJours: number | null;
            premiereDateOperation: Date | null;
            premiereDateControle: Date | null;
            nombreOperations: number | null;
            nombreVisitesControle: number | null;
            clientId: string;
            dateDebut: Date;
            dateFin: Date | null;
            reconductionAuto: boolean;
            responsablePlanningId: string | null;
            statut: import(".prisma/client").$Enums.ContratStatut;
            autoCreerProchaine: boolean;
            numeroBonCommande: string | null;
            attestationMessageTemplate: string | null;
            attestationGarantieMessageTemplate: string | null;
            attestationControleMessageTemplate: string | null;
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
        createdById: string;
        exporteGCal: boolean;
        updatedById: string | null;
    }>;
    /**
     * Génère le planning initial pour un contrat.
     * Appelé automatiquement à la création du contrat.
     * Supporte les ContratSites (fréquences par site) et les contrats ponctuels (par nombre d'opérations).
     */
    genererPlanningContrat(contratId: string, userId: string, siteOverrides?: Array<{
        siteId: string;
        datesPrevuesOperations?: Date[];
        datesPrevuesControles?: Date[];
    }>): Promise<{
        contrat: {
            client: {
                id: string;
                actif: boolean;
                createdAt: Date;
                updatedAt: Date;
                code: string | null;
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
                siegeNIN: string | null;
                siegeTIN: string | null;
                devise: string | null;
                nomAlias: string | null;
                typeTiers: import(".prisma/client").$Enums.TypeTiers;
                formeJuridique: import(".prisma/client").$Enums.FormeJuridique | null;
                tvaIntracom: string | null;
                capital: number | null;
                dateCreation: Date | null;
                siegeCodePostal: string | null;
                siegeVille: string | null;
                siegePays: string | null;
                siegeFax: string | null;
                siegeWebsite: string | null;
                categorie: string | null;
                codeComptaClient: string | null;
                codeComptaFournisseur: string | null;
                modePaiementId: string | null;
                conditionPaiementId: string | null;
                remiseParDefaut: number | null;
                encoursMaximum: number | null;
                notePublique: string | null;
                notePrivee: string | null;
                prospectNiveau: number | null;
                prospectStatut: string | null;
            };
            contratSites: ({
                site: {
                    adresse: string | null;
                    id: string;
                    email: string | null;
                    nom: string;
                    tel: string | null;
                    actif: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    code: string | null;
                    notes: string | null;
                    clientId: string;
                    fax: string | null;
                    complement: string | null;
                    codePostal: string | null;
                    ville: string | null;
                    pays: string | null;
                    latitude: number | null;
                    longitude: number | null;
                    horairesOuverture: string | null;
                    accessibilite: string | null;
                    noteServiceDefaut: string | null;
                };
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                notes: string | null;
                siteId: string;
                prestations: string[];
                prixPrestations: import("@prisma/client/runtime/library").JsonValue;
                frequenceOperationsJours: number | null;
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
            frequenceOperationsJours: number | null;
            frequenceControleJours: number | null;
            premiereDateOperation: Date | null;
            premiereDateControle: Date | null;
            nombreOperations: number | null;
            nombreVisitesControle: number | null;
            clientId: string;
            dateDebut: Date;
            dateFin: Date | null;
            reconductionAuto: boolean;
            responsablePlanningId: string | null;
            statut: import(".prisma/client").$Enums.ContratStatut;
            autoCreerProchaine: boolean;
            numeroBonCommande: string | null;
            attestationMessageTemplate: string | null;
            attestationGarantieMessageTemplate: string | null;
            attestationControleMessageTemplate: string | null;
        };
        interventionsCreees: any[];
        count: number;
    }>;
};
export default planningService;
//# sourceMappingURL=planning.service.d.ts.map