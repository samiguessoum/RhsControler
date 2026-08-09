/**
 * Documentation OpenAPI/Swagger pour le module Facturation
 *
 * Pour utiliser cette documentation, installer swagger-ui-express et swagger-jsdoc:
 * npm install swagger-ui-express swagger-jsdoc
 * npm install -D @types/swagger-ui-express @types/swagger-jsdoc
 */
export declare const swaggerDocument: {
    openapi: string;
    info: {
        title: string;
        version: string;
        description: string;
        contact: {
            name: string;
            email: string;
        };
    };
    servers: {
        url: string;
        description: string;
    }[];
    tags: {
        name: string;
        description: string;
    }[];
    components: {
        securitySchemes: {
            bearerAuth: {
                type: string;
                scheme: string;
                bearerFormat: string;
            };
        };
        schemas: {
            Facture: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    ref: {
                        type: string;
                        example: string;
                    };
                    clientId: {
                        type: string;
                        format: string;
                    };
                    type: {
                        type: string;
                        enum: string[];
                    };
                    statut: {
                        type: string;
                        enum: string[];
                    };
                    dateFacture: {
                        type: string;
                        format: string;
                    };
                    dateEcheance: {
                        type: string;
                        format: string;
                    };
                    totalHT: {
                        type: string;
                    };
                    totalTVA: {
                        type: string;
                    };
                    totalTTC: {
                        type: string;
                    };
                    totalPaye: {
                        type: string;
                    };
                    devise: {
                        type: string;
                        default: string;
                    };
                    lignes: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                    paiements: {
                        type: string;
                        items: {
                            $ref: string;
                        };
                    };
                };
            };
            FactureLigne: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    produitServiceId: {
                        type: string;
                        format: string;
                    };
                    libelle: {
                        type: string;
                    };
                    quantite: {
                        type: string;
                    };
                    unite: {
                        type: string;
                    };
                    prixUnitaireHT: {
                        type: string;
                    };
                    tauxTVA: {
                        type: string;
                    };
                    remisePct: {
                        type: string;
                    };
                    totalHT: {
                        type: string;
                    };
                    totalTVA: {
                        type: string;
                    };
                    totalTTC: {
                        type: string;
                    };
                };
            };
            Paiement: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    montant: {
                        type: string;
                    };
                    datePaiement: {
                        type: string;
                        format: string;
                    };
                    reference: {
                        type: string;
                    };
                    modePaiement: {
                        $ref: string;
                    };
                    statut: {
                        type: string;
                        enum: string[];
                    };
                };
            };
            ModePaiement: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    code: {
                        type: string;
                        example: string;
                    };
                    libelle: {
                        type: string;
                        example: string;
                    };
                };
            };
            FactureFournisseur: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    ref: {
                        type: string;
                        example: string;
                    };
                    refFournisseur: {
                        type: string;
                    };
                    fournisseurId: {
                        type: string;
                        format: string;
                    };
                    statut: {
                        type: string;
                        enum: string[];
                    };
                    dateFacture: {
                        type: string;
                        format: string;
                    };
                    dateEcheance: {
                        type: string;
                        format: string;
                    };
                    totalHT: {
                        type: string;
                    };
                    totalTVA: {
                        type: string;
                    };
                    totalTTC: {
                        type: string;
                    };
                    totalPaye: {
                        type: string;
                    };
                };
            };
            Charge: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    ref: {
                        type: string;
                        example: string;
                    };
                    typeCharge: {
                        type: string;
                        enum: string[];
                    };
                    libelle: {
                        type: string;
                    };
                    categorie: {
                        type: string;
                    };
                    montantHT: {
                        type: string;
                    };
                    tauxTVA: {
                        type: string;
                    };
                    montantTTC: {
                        type: string;
                    };
                    montantPaye: {
                        type: string;
                    };
                    statut: {
                        type: string;
                        enum: string[];
                    };
                };
            };
            PaiementDivers: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    ref: {
                        type: string;
                        example: string;
                    };
                    libelle: {
                        type: string;
                    };
                    typeOperation: {
                        type: string;
                        enum: string[];
                    };
                    montant: {
                        type: string;
                    };
                    categorie: {
                        type: string;
                    };
                    datePaiement: {
                        type: string;
                        format: string;
                    };
                };
            };
            Notification: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    type: {
                        type: string;
                    };
                    title: {
                        type: string;
                    };
                    message: {
                        type: string;
                    };
                    severity: {
                        type: string;
                        enum: string[];
                    };
                    read: {
                        type: string;
                    };
                    createdAt: {
                        type: string;
                        format: string;
                    };
                };
            };
            StatsGlobal: {
                type: string;
                properties: {
                    annee: {
                        type: string;
                    };
                    facturesClients: {
                        type: string;
                        properties: {
                            count: {
                                type: string;
                            };
                            totalHT: {
                                type: string;
                            };
                            totalTVA: {
                                type: string;
                            };
                            totalTTC: {
                                type: string;
                            };
                            totalPaye: {
                                type: string;
                            };
                            resteAPayer: {
                                type: string;
                            };
                        };
                    };
                    facturesFournisseurs: {
                        type: string;
                        properties: {
                            count: {
                                type: string;
                            };
                            totalHT: {
                                type: string;
                            };
                            totalTTC: {
                                type: string;
                            };
                            totalPaye: {
                                type: string;
                            };
                        };
                    };
                    resume: {
                        type: string;
                        properties: {
                            totalVentes: {
                                type: string;
                            };
                            totalAchats: {
                                type: string;
                            };
                            resultatBrut: {
                                type: string;
                            };
                        };
                    };
                };
            };
            Error: {
                type: string;
                properties: {
                    error: {
                        type: string;
                    };
                };
            };
            Pagination: {
                type: string;
                properties: {
                    page: {
                        type: string;
                    };
                    limit: {
                        type: string;
                    };
                    total: {
                        type: string;
                    };
                    totalPages: {
                        type: string;
                    };
                };
            };
            CreateFactureInput: {
                type: string;
                required: string[];
                properties: {
                    clientId: {
                        type: string;
                        format: string;
                    };
                    type: {
                        type: string;
                        enum: string[];
                        default: string;
                    };
                    dateFacture: {
                        type: string;
                        format: string;
                    };
                    dateEcheance: {
                        type: string;
                        format: string;
                    };
                    remiseGlobalPct: {
                        type: string;
                    };
                    remiseGlobalMontant: {
                        type: string;
                    };
                    notes: {
                        type: string;
                    };
                    conditions: {
                        type: string;
                    };
                    lignes: {
                        type: string;
                        items: {
                            type: string;
                            required: string[];
                            properties: {
                                produitServiceId: {
                                    type: string;
                                    format: string;
                                };
                                libelle: {
                                    type: string;
                                };
                                quantite: {
                                    type: string;
                                };
                                prixUnitaireHT: {
                                    type: string;
                                };
                                tauxTVA: {
                                    type: string;
                                    default: number;
                                };
                                remisePct: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
            };
            CreatePaiementInput: {
                type: string;
                required: string[];
                properties: {
                    factureId: {
                        type: string;
                        format: string;
                    };
                    montant: {
                        type: string;
                    };
                    datePaiement: {
                        type: string;
                        format: string;
                    };
                    modePaiementId: {
                        type: string;
                        format: string;
                    };
                    reference: {
                        type: string;
                    };
                    notes: {
                        type: string;
                    };
                };
            };
        };
    };
    security: {
        bearerAuth: never[];
    }[];
    paths: {
        '/commerce/factures': {
            get: {
                tags: string[];
                summary: string;
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        default: number;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        factures: {
                                            type: string;
                                            items: {
                                                $ref: string;
                                            };
                                        };
                                        pagination: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        facture: {
                                            $ref: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                    400: {
                        description: string;
                    };
                    500: {
                        description: string;
                    };
                };
            };
        };
        '/commerce/factures/{id}': {
            get: {
                tags: string[];
                summary: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                    };
                    404: {
                        description: string;
                    };
                };
            };
            put: {
                tags: string[];
                summary: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                    };
                    404: {
                        description: string;
                    };
                };
            };
            delete: {
                tags: string[];
                summary: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                    };
                    404: {
                        description: string;
                    };
                };
            };
        };
        '/commerce/factures/{id}/pdf': {
            get: {
                tags: string[];
                summary: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/pdf': {};
                        };
                    };
                };
            };
        };
        '/commerce/paiements': {
            post: {
                tags: string[];
                summary: string;
                requestBody: {
                    required: boolean;
                    content: {
                        'application/json': {
                            schema: {
                                $ref: string;
                            };
                        };
                    };
                };
                responses: {
                    201: {
                        description: string;
                    };
                    400: {
                        description: string;
                    };
                    404: {
                        description: string;
                    };
                };
            };
        };
        '/factures-fournisseurs': {
            get: {
                tags: string[];
                summary: string;
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        format?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        format: string;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                responses: {
                    201: {
                        description: string;
                    };
                };
            };
        };
        '/charges': {
            get: {
                tags: string[];
                summary: string;
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum?: undefined;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
            post: {
                tags: string[];
                summary: string;
                responses: {
                    201: {
                        description: string;
                    };
                };
            };
        };
        '/paiements-divers': {
            get: {
                tags: string[];
                summary: string;
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum: string[];
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        enum?: undefined;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
        '/facturation/stats/global': {
            get: {
                tags: string[];
                summary: string;
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                    };
                    description?: undefined;
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                    };
                    description: string;
                })[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        '/facturation/stats/tva': {
            get: {
                tags: string[];
                summary: string;
                parameters: ({
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        minimum?: undefined;
                        maximum?: undefined;
                    };
                } | {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                        minimum: number;
                        maximum: number;
                    };
                })[];
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
        '/facturation/stats/tresorerie': {
            get: {
                tags: string[];
                summary: string;
                parameters: {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
        '/facturation/stats/retards': {
            get: {
                tags: string[];
                summary: string;
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
        '/notifications': {
            get: {
                tags: string[];
                summary: string;
                parameters: {
                    name: string;
                    in: string;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                        content: {
                            'application/json': {
                                schema: {
                                    type: string;
                                    properties: {
                                        notifications: {
                                            type: string;
                                            items: {
                                                $ref: string;
                                            };
                                        };
                                        unreadCount: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        '/notifications/{id}/read': {
            put: {
                tags: string[];
                summary: string;
                parameters: {
                    name: string;
                    in: string;
                    required: boolean;
                    schema: {
                        type: string;
                    };
                }[];
                responses: {
                    200: {
                        description: string;
                    };
                    404: {
                        description: string;
                    };
                };
            };
        };
        '/notifications/read-all': {
            put: {
                tags: string[];
                summary: string;
                responses: {
                    200: {
                        description: string;
                    };
                };
            };
        };
    };
};
export default swaggerDocument;
//# sourceMappingURL=swagger.d.ts.map