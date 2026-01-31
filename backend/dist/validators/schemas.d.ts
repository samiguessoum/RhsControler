import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const resetPasswordRequestSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
export declare const createUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    nom: z.ZodString;
    prenom: z.ZodString;
    tel: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["DIRECTION", "PLANNING", "EQUIPE", "LECTURE"]>;
}, "strip", z.ZodTypeAny, {
    email: string;
    role: "DIRECTION" | "PLANNING" | "EQUIPE" | "LECTURE";
    password: string;
    nom: string;
    prenom: string;
    tel?: string | undefined;
}, {
    email: string;
    role: "DIRECTION" | "PLANNING" | "EQUIPE" | "LECTURE";
    password: string;
    nom: string;
    prenom: string;
    tel?: string | undefined;
}>;
export declare const updateUserSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    nom: z.ZodOptional<z.ZodString>;
    prenom: z.ZodOptional<z.ZodString>;
    tel: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["DIRECTION", "PLANNING", "EQUIPE", "LECTURE"]>>;
    actif: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    role?: "DIRECTION" | "PLANNING" | "EQUIPE" | "LECTURE" | undefined;
    password?: string | undefined;
    nom?: string | undefined;
    prenom?: string | undefined;
    tel?: string | undefined;
    actif?: boolean | undefined;
}, {
    email?: string | undefined;
    role?: "DIRECTION" | "PLANNING" | "EQUIPE" | "LECTURE" | undefined;
    password?: string | undefined;
    nom?: string | undefined;
    prenom?: string | undefined;
    tel?: string | undefined;
    actif?: boolean | undefined;
}>;
export declare const createClientSchema: z.ZodObject<{
    nomEntreprise: z.ZodString;
    secteur: z.ZodOptional<z.ZodString>;
    siegeNom: z.ZodString;
    siegeAdresse: z.ZodOptional<z.ZodString>;
    siegeTel: z.ZodOptional<z.ZodString>;
    siegeEmail: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    siegeNotes: z.ZodOptional<z.ZodString>;
    siegeRC: z.ZodOptional<z.ZodString>;
    siegeNIF: z.ZodOptional<z.ZodString>;
    siegeAI: z.ZodOptional<z.ZodString>;
    siegeNIS: z.ZodOptional<z.ZodString>;
    siegeTIN: z.ZodOptional<z.ZodString>;
    siegeContacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        nom: z.ZodOptional<z.ZodString>;
        fonction: z.ZodOptional<z.ZodString>;
        tel: z.ZodOptional<z.ZodString>;
        email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    }, "strip", z.ZodTypeAny, {
        email?: string | undefined;
        nom?: string | undefined;
        tel?: string | undefined;
        fonction?: string | undefined;
    }, {
        email?: string | undefined;
        nom?: string | undefined;
        tel?: string | undefined;
        fonction?: string | undefined;
    }>, "many">>;
    sites: z.ZodArray<z.ZodObject<{
        nom: z.ZodString;
        adresse: z.ZodOptional<z.ZodString>;
        contactNom: z.ZodOptional<z.ZodString>;
        contactFonction: z.ZodOptional<z.ZodString>;
        tel: z.ZodOptional<z.ZodString>;
        email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        nom: string;
        email?: string | undefined;
        tel?: string | undefined;
        adresse?: string | undefined;
        contactNom?: string | undefined;
        contactFonction?: string | undefined;
        notes?: string | undefined;
    }, {
        nom: string;
        email?: string | undefined;
        tel?: string | undefined;
        adresse?: string | undefined;
        contactNom?: string | undefined;
        contactFonction?: string | undefined;
        notes?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    nomEntreprise: string;
    siegeNom: string;
    sites: {
        nom: string;
        email?: string | undefined;
        tel?: string | undefined;
        adresse?: string | undefined;
        contactNom?: string | undefined;
        contactFonction?: string | undefined;
        notes?: string | undefined;
    }[];
    secteur?: string | undefined;
    siegeAdresse?: string | undefined;
    siegeTel?: string | undefined;
    siegeEmail?: string | undefined;
    siegeNotes?: string | undefined;
    siegeRC?: string | undefined;
    siegeNIF?: string | undefined;
    siegeAI?: string | undefined;
    siegeNIS?: string | undefined;
    siegeTIN?: string | undefined;
    siegeContacts?: {
        email?: string | undefined;
        nom?: string | undefined;
        tel?: string | undefined;
        fonction?: string | undefined;
    }[] | undefined;
}, {
    nomEntreprise: string;
    siegeNom: string;
    sites: {
        nom: string;
        email?: string | undefined;
        tel?: string | undefined;
        adresse?: string | undefined;
        contactNom?: string | undefined;
        contactFonction?: string | undefined;
        notes?: string | undefined;
    }[];
    secteur?: string | undefined;
    siegeAdresse?: string | undefined;
    siegeTel?: string | undefined;
    siegeEmail?: string | undefined;
    siegeNotes?: string | undefined;
    siegeRC?: string | undefined;
    siegeNIF?: string | undefined;
    siegeAI?: string | undefined;
    siegeNIS?: string | undefined;
    siegeTIN?: string | undefined;
    siegeContacts?: {
        email?: string | undefined;
        nom?: string | undefined;
        tel?: string | undefined;
        fonction?: string | undefined;
    }[] | undefined;
}>;
export declare const updateClientSchema: z.ZodObject<{
    nomEntreprise: z.ZodOptional<z.ZodString>;
    secteur: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    siegeNom: z.ZodOptional<z.ZodString>;
    siegeAdresse: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    siegeTel: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    siegeEmail: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>>;
    siegeNotes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    siegeRC: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    siegeNIF: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    siegeAI: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    siegeNIS: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    siegeTIN: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    siegeContacts: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        nom: z.ZodOptional<z.ZodString>;
        fonction: z.ZodOptional<z.ZodString>;
        tel: z.ZodOptional<z.ZodString>;
        email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    }, "strip", z.ZodTypeAny, {
        email?: string | undefined;
        nom?: string | undefined;
        tel?: string | undefined;
        fonction?: string | undefined;
    }, {
        email?: string | undefined;
        nom?: string | undefined;
        tel?: string | undefined;
        fonction?: string | undefined;
    }>, "many">>>;
    sites: z.ZodOptional<z.ZodArray<z.ZodObject<{
        nom: z.ZodString;
        adresse: z.ZodOptional<z.ZodString>;
        contactNom: z.ZodOptional<z.ZodString>;
        contactFonction: z.ZodOptional<z.ZodString>;
        tel: z.ZodOptional<z.ZodString>;
        email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        nom: string;
        email?: string | undefined;
        tel?: string | undefined;
        adresse?: string | undefined;
        contactNom?: string | undefined;
        contactFonction?: string | undefined;
        notes?: string | undefined;
    }, {
        nom: string;
        email?: string | undefined;
        tel?: string | undefined;
        adresse?: string | undefined;
        contactNom?: string | undefined;
        contactFonction?: string | undefined;
        notes?: string | undefined;
    }>, "many">>;
} & {
    actif: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    actif?: boolean | undefined;
    nomEntreprise?: string | undefined;
    secteur?: string | undefined;
    siegeNom?: string | undefined;
    siegeAdresse?: string | undefined;
    siegeTel?: string | undefined;
    siegeEmail?: string | undefined;
    siegeNotes?: string | undefined;
    siegeRC?: string | undefined;
    siegeNIF?: string | undefined;
    siegeAI?: string | undefined;
    siegeNIS?: string | undefined;
    siegeTIN?: string | undefined;
    siegeContacts?: {
        email?: string | undefined;
        nom?: string | undefined;
        tel?: string | undefined;
        fonction?: string | undefined;
    }[] | undefined;
    sites?: {
        nom: string;
        email?: string | undefined;
        tel?: string | undefined;
        adresse?: string | undefined;
        contactNom?: string | undefined;
        contactFonction?: string | undefined;
        notes?: string | undefined;
    }[] | undefined;
}, {
    actif?: boolean | undefined;
    nomEntreprise?: string | undefined;
    secteur?: string | undefined;
    siegeNom?: string | undefined;
    siegeAdresse?: string | undefined;
    siegeTel?: string | undefined;
    siegeEmail?: string | undefined;
    siegeNotes?: string | undefined;
    siegeRC?: string | undefined;
    siegeNIF?: string | undefined;
    siegeAI?: string | undefined;
    siegeNIS?: string | undefined;
    siegeTIN?: string | undefined;
    siegeContacts?: {
        email?: string | undefined;
        nom?: string | undefined;
        tel?: string | undefined;
        fonction?: string | undefined;
    }[] | undefined;
    sites?: {
        nom: string;
        email?: string | undefined;
        tel?: string | undefined;
        adresse?: string | undefined;
        contactNom?: string | undefined;
        contactFonction?: string | undefined;
        notes?: string | undefined;
    }[] | undefined;
}>;
export declare const createPrestationSchema: z.ZodObject<{
    nom: z.ZodString;
    ordre: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    nom: string;
    ordre?: number | undefined;
    description?: string | undefined;
}, {
    nom: string;
    ordre?: number | undefined;
    description?: string | undefined;
}>;
export declare const updatePrestationSchema: z.ZodObject<{
    nom: z.ZodOptional<z.ZodString>;
    ordre: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    actif: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    nom?: string | undefined;
    actif?: boolean | undefined;
    ordre?: number | undefined;
    description?: string | undefined;
}, {
    nom?: string | undefined;
    actif?: boolean | undefined;
    ordre?: number | undefined;
    description?: string | undefined;
}>;
export declare const frequenceEnum: z.ZodEnum<["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PERSONNALISEE"]>;
export declare const createContratSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    clientId: z.ZodString;
    type: z.ZodEnum<["ANNUEL", "PONCTUEL"]>;
    dateDebut: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>;
    dateFin: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>;
    reconductionAuto: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    prestations: z.ZodArray<z.ZodString, "many">;
    frequenceOperations: z.ZodOptional<z.ZodEnum<["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PERSONNALISEE"]>>;
    frequenceOperationsJours: z.ZodOptional<z.ZodNumber>;
    frequenceControle: z.ZodOptional<z.ZodEnum<["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PERSONNALISEE"]>>;
    frequenceControleJours: z.ZodOptional<z.ZodNumber>;
    premiereDateOperation: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>;
    premiereDateControle: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>;
    responsablePlanningId: z.ZodOptional<z.ZodString>;
    statut: z.ZodDefault<z.ZodOptional<z.ZodEnum<["ACTIF", "SUSPENDU", "TERMINE"]>>>;
    notes: z.ZodOptional<z.ZodString>;
    autoCreerProchaine: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    numeroBonCommande: z.ZodOptional<z.ZodString>;
    nombreOperations: z.ZodOptional<z.ZodNumber>;
    contratSites: z.ZodOptional<z.ZodArray<z.ZodObject<{
        siteId: z.ZodString;
        prestations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        frequenceOperations: z.ZodOptional<z.ZodEnum<["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PERSONNALISEE"]>>;
        frequenceOperationsJours: z.ZodOptional<z.ZodNumber>;
        frequenceControle: z.ZodOptional<z.ZodEnum<["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PERSONNALISEE"]>>;
        frequenceControleJours: z.ZodOptional<z.ZodNumber>;
        premiereDateOperation: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>;
        premiereDateControle: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>;
        nombreOperations: z.ZodOptional<z.ZodNumber>;
        nombreVisitesControle: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: Date | undefined;
        premiereDateControle?: Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }, {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: string | Date | undefined;
        premiereDateControle?: string | Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "ANNUEL" | "PONCTUEL";
    prestations: string[];
    clientId: string;
    dateDebut: Date;
    reconductionAuto: boolean;
    statut: "ACTIF" | "SUSPENDU" | "TERMINE";
    autoCreerProchaine: boolean;
    notes?: string | undefined;
    frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceOperationsJours?: number | undefined;
    frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceControleJours?: number | undefined;
    premiereDateOperation?: Date | undefined;
    premiereDateControle?: Date | undefined;
    nombreOperations?: number | undefined;
    dateFin?: Date | undefined;
    responsablePlanningId?: string | undefined;
    numeroBonCommande?: string | undefined;
    contratSites?: {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: Date | undefined;
        premiereDateControle?: Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }[] | undefined;
}, {
    type: "ANNUEL" | "PONCTUEL";
    prestations: string[];
    clientId: string;
    dateDebut: string | Date;
    notes?: string | undefined;
    frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceOperationsJours?: number | undefined;
    frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceControleJours?: number | undefined;
    premiereDateOperation?: string | Date | undefined;
    premiereDateControle?: string | Date | undefined;
    nombreOperations?: number | undefined;
    dateFin?: string | Date | undefined;
    reconductionAuto?: boolean | undefined;
    responsablePlanningId?: string | undefined;
    statut?: "ACTIF" | "SUSPENDU" | "TERMINE" | undefined;
    autoCreerProchaine?: boolean | undefined;
    numeroBonCommande?: string | undefined;
    contratSites?: {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: string | Date | undefined;
        premiereDateControle?: string | Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }[] | undefined;
}>, {
    type: "ANNUEL" | "PONCTUEL";
    prestations: string[];
    clientId: string;
    dateDebut: Date;
    reconductionAuto: boolean;
    statut: "ACTIF" | "SUSPENDU" | "TERMINE";
    autoCreerProchaine: boolean;
    notes?: string | undefined;
    frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceOperationsJours?: number | undefined;
    frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceControleJours?: number | undefined;
    premiereDateOperation?: Date | undefined;
    premiereDateControle?: Date | undefined;
    nombreOperations?: number | undefined;
    dateFin?: Date | undefined;
    responsablePlanningId?: string | undefined;
    numeroBonCommande?: string | undefined;
    contratSites?: {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: Date | undefined;
        premiereDateControle?: Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }[] | undefined;
}, {
    type: "ANNUEL" | "PONCTUEL";
    prestations: string[];
    clientId: string;
    dateDebut: string | Date;
    notes?: string | undefined;
    frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceOperationsJours?: number | undefined;
    frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceControleJours?: number | undefined;
    premiereDateOperation?: string | Date | undefined;
    premiereDateControle?: string | Date | undefined;
    nombreOperations?: number | undefined;
    dateFin?: string | Date | undefined;
    reconductionAuto?: boolean | undefined;
    responsablePlanningId?: string | undefined;
    statut?: "ACTIF" | "SUSPENDU" | "TERMINE" | undefined;
    autoCreerProchaine?: boolean | undefined;
    numeroBonCommande?: string | undefined;
    contratSites?: {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: string | Date | undefined;
        premiereDateControle?: string | Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }[] | undefined;
}>, {
    type: "ANNUEL" | "PONCTUEL";
    prestations: string[];
    clientId: string;
    dateDebut: Date;
    reconductionAuto: boolean;
    statut: "ACTIF" | "SUSPENDU" | "TERMINE";
    autoCreerProchaine: boolean;
    notes?: string | undefined;
    frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceOperationsJours?: number | undefined;
    frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceControleJours?: number | undefined;
    premiereDateOperation?: Date | undefined;
    premiereDateControle?: Date | undefined;
    nombreOperations?: number | undefined;
    dateFin?: Date | undefined;
    responsablePlanningId?: string | undefined;
    numeroBonCommande?: string | undefined;
    contratSites?: {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: Date | undefined;
        premiereDateControle?: Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }[] | undefined;
}, {
    type: "ANNUEL" | "PONCTUEL";
    prestations: string[];
    clientId: string;
    dateDebut: string | Date;
    notes?: string | undefined;
    frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceOperationsJours?: number | undefined;
    frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
    frequenceControleJours?: number | undefined;
    premiereDateOperation?: string | Date | undefined;
    premiereDateControle?: string | Date | undefined;
    nombreOperations?: number | undefined;
    dateFin?: string | Date | undefined;
    reconductionAuto?: boolean | undefined;
    responsablePlanningId?: string | undefined;
    statut?: "ACTIF" | "SUSPENDU" | "TERMINE" | undefined;
    autoCreerProchaine?: boolean | undefined;
    numeroBonCommande?: string | undefined;
    contratSites?: {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: string | Date | undefined;
        premiereDateControle?: string | Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }[] | undefined;
}>;
export declare const updateContratSchema: z.ZodObject<{
    clientId: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["ANNUEL", "PONCTUEL"]>>;
    dateDebut: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>;
    dateFin: z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>>;
    reconductionAuto: z.ZodOptional<z.ZodBoolean>;
    prestations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    frequenceOperations: z.ZodNullable<z.ZodOptional<z.ZodEnum<["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PERSONNALISEE"]>>>;
    frequenceOperationsJours: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    frequenceControle: z.ZodNullable<z.ZodOptional<z.ZodEnum<["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PERSONNALISEE"]>>>;
    frequenceControleJours: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    premiereDateOperation: z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>>;
    premiereDateControle: z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>>;
    responsablePlanningId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    statut: z.ZodOptional<z.ZodEnum<["ACTIF", "SUSPENDU", "TERMINE"]>>;
    notes: z.ZodOptional<z.ZodString>;
    autoCreerProchaine: z.ZodOptional<z.ZodBoolean>;
    numeroBonCommande: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    nombreOperations: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    contratSites: z.ZodOptional<z.ZodArray<z.ZodObject<{
        siteId: z.ZodString;
        prestations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        frequenceOperations: z.ZodOptional<z.ZodEnum<["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PERSONNALISEE"]>>;
        frequenceOperationsJours: z.ZodOptional<z.ZodNumber>;
        frequenceControle: z.ZodOptional<z.ZodEnum<["HEBDOMADAIRE", "MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PERSONNALISEE"]>>;
        frequenceControleJours: z.ZodOptional<z.ZodNumber>;
        premiereDateOperation: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>;
        premiereDateControle: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>;
        nombreOperations: z.ZodOptional<z.ZodNumber>;
        nombreVisitesControle: z.ZodOptional<z.ZodNumber>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: Date | undefined;
        premiereDateControle?: Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }, {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: string | Date | undefined;
        premiereDateControle?: string | Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type?: "ANNUEL" | "PONCTUEL" | undefined;
    notes?: string | undefined;
    prestations?: string[] | undefined;
    frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | null | undefined;
    frequenceOperationsJours?: number | null | undefined;
    frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | null | undefined;
    frequenceControleJours?: number | null | undefined;
    premiereDateOperation?: Date | null | undefined;
    premiereDateControle?: Date | null | undefined;
    nombreOperations?: number | null | undefined;
    clientId?: string | undefined;
    dateDebut?: Date | undefined;
    dateFin?: Date | null | undefined;
    reconductionAuto?: boolean | undefined;
    responsablePlanningId?: string | null | undefined;
    statut?: "ACTIF" | "SUSPENDU" | "TERMINE" | undefined;
    autoCreerProchaine?: boolean | undefined;
    numeroBonCommande?: string | null | undefined;
    contratSites?: {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: Date | undefined;
        premiereDateControle?: Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }[] | undefined;
}, {
    type?: "ANNUEL" | "PONCTUEL" | undefined;
    notes?: string | undefined;
    prestations?: string[] | undefined;
    frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | null | undefined;
    frequenceOperationsJours?: number | null | undefined;
    frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | null | undefined;
    frequenceControleJours?: number | null | undefined;
    premiereDateOperation?: string | Date | null | undefined;
    premiereDateControle?: string | Date | null | undefined;
    nombreOperations?: number | null | undefined;
    clientId?: string | undefined;
    dateDebut?: string | Date | undefined;
    dateFin?: string | Date | null | undefined;
    reconductionAuto?: boolean | undefined;
    responsablePlanningId?: string | null | undefined;
    statut?: "ACTIF" | "SUSPENDU" | "TERMINE" | undefined;
    autoCreerProchaine?: boolean | undefined;
    numeroBonCommande?: string | null | undefined;
    contratSites?: {
        siteId: string;
        notes?: string | undefined;
        prestations?: string[] | undefined;
        frequenceOperations?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceOperationsJours?: number | undefined;
        frequenceControle?: "HEBDOMADAIRE" | "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PERSONNALISEE" | undefined;
        frequenceControleJours?: number | undefined;
        premiereDateOperation?: string | Date | undefined;
        premiereDateControle?: string | Date | undefined;
        nombreOperations?: number | undefined;
        nombreVisitesControle?: number | undefined;
    }[] | undefined;
}>;
export declare const createInterventionSchema: z.ZodObject<{
    contratId: z.ZodOptional<z.ZodString>;
    clientId: z.ZodString;
    siteId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["OPERATION", "CONTROLE"]>;
    prestation: z.ZodOptional<z.ZodString>;
    datePrevue: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>;
    heurePrevue: z.ZodOptional<z.ZodString>;
    duree: z.ZodOptional<z.ZodNumber>;
    statut: z.ZodDefault<z.ZodOptional<z.ZodEnum<["A_PLANIFIER", "PLANIFIEE", "REALISEE", "REPORTEE", "ANNULEE"]>>>;
    notesTerrain: z.ZodOptional<z.ZodString>;
    responsable: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "OPERATION" | "CONTROLE";
    clientId: string;
    statut: "A_PLANIFIER" | "PLANIFIEE" | "REALISEE" | "REPORTEE" | "ANNULEE";
    datePrevue: Date;
    prestation?: string | undefined;
    siteId?: string | undefined;
    contratId?: string | undefined;
    heurePrevue?: string | undefined;
    duree?: number | undefined;
    notesTerrain?: string | undefined;
    responsable?: string | undefined;
}, {
    type: "OPERATION" | "CONTROLE";
    clientId: string;
    datePrevue: string | Date;
    prestation?: string | undefined;
    siteId?: string | undefined;
    statut?: "A_PLANIFIER" | "PLANIFIEE" | "REALISEE" | "REPORTEE" | "ANNULEE" | undefined;
    contratId?: string | undefined;
    heurePrevue?: string | undefined;
    duree?: number | undefined;
    notesTerrain?: string | undefined;
    responsable?: string | undefined;
}>;
export declare const updateInterventionSchema: z.ZodObject<{
    contratId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    clientId: z.ZodOptional<z.ZodString>;
    siteId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    type: z.ZodOptional<z.ZodEnum<["OPERATION", "CONTROLE"]>>;
    prestation: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    datePrevue: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>;
    heurePrevue: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    duree: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    statut: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodEnum<["A_PLANIFIER", "PLANIFIEE", "REALISEE", "REPORTEE", "ANNULEE"]>>>>;
    notesTerrain: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    responsable: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    prestation?: string | undefined;
    type?: "OPERATION" | "CONTROLE" | undefined;
    siteId?: string | undefined;
    clientId?: string | undefined;
    statut?: "A_PLANIFIER" | "PLANIFIEE" | "REALISEE" | "REPORTEE" | "ANNULEE" | undefined;
    contratId?: string | undefined;
    datePrevue?: Date | undefined;
    heurePrevue?: string | undefined;
    duree?: number | undefined;
    notesTerrain?: string | undefined;
    responsable?: string | undefined;
}, {
    prestation?: string | undefined;
    type?: "OPERATION" | "CONTROLE" | undefined;
    siteId?: string | undefined;
    clientId?: string | undefined;
    statut?: "A_PLANIFIER" | "PLANIFIEE" | "REALISEE" | "REPORTEE" | "ANNULEE" | undefined;
    contratId?: string | undefined;
    datePrevue?: string | Date | undefined;
    heurePrevue?: string | undefined;
    duree?: number | undefined;
    notesTerrain?: string | undefined;
    responsable?: string | undefined;
}>;
export declare const realiserInterventionSchema: z.ZodObject<{
    notesTerrain: z.ZodOptional<z.ZodString>;
    creerProchaine: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    dateRealisee: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>>;
}, "strip", z.ZodTypeAny, {
    creerProchaine: boolean;
    notesTerrain?: string | undefined;
    dateRealisee?: Date | undefined;
}, {
    notesTerrain?: string | undefined;
    creerProchaine?: boolean | undefined;
    dateRealisee?: string | Date | undefined;
}>;
export declare const reporterInterventionSchema: z.ZodObject<{
    nouvelleDatePrevue: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, Date, string | Date>;
    raison: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    nouvelleDatePrevue: Date;
    raison?: string | undefined;
}, {
    nouvelleDatePrevue: string | Date;
    raison?: string | undefined;
}>;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: string | undefined;
    limit?: string | undefined;
}>;
export declare const clientsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
} & {
    search: z.ZodOptional<z.ZodString>;
    actif: z.ZodOptional<z.ZodEffects<z.ZodString, boolean, string>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    search?: string | undefined;
    actif?: boolean | undefined;
}, {
    search?: string | undefined;
    actif?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}>;
export declare const contratsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
} & {
    clientId: z.ZodOptional<z.ZodString>;
    statut: z.ZodOptional<z.ZodEnum<["ACTIF", "SUSPENDU", "TERMINE"]>>;
    type: z.ZodOptional<z.ZodEnum<["ANNUEL", "PONCTUEL"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    type?: "ANNUEL" | "PONCTUEL" | undefined;
    clientId?: string | undefined;
    statut?: "ACTIF" | "SUSPENDU" | "TERMINE" | undefined;
}, {
    type?: "ANNUEL" | "PONCTUEL" | undefined;
    clientId?: string | undefined;
    statut?: "ACTIF" | "SUSPENDU" | "TERMINE" | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}>;
export declare const interventionsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
} & {
    clientId: z.ZodOptional<z.ZodString>;
    contratId: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["OPERATION", "CONTROLE"]>>;
    statut: z.ZodOptional<z.ZodEnum<["A_PLANIFIER", "PLANIFIEE", "REALISEE", "REPORTEE", "ANNULEE"]>>;
    prestation: z.ZodOptional<z.ZodString>;
    dateDebut: z.ZodOptional<z.ZodString>;
    dateFin: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    prestation?: string | undefined;
    type?: "OPERATION" | "CONTROLE" | undefined;
    clientId?: string | undefined;
    dateDebut?: string | undefined;
    dateFin?: string | undefined;
    statut?: "A_PLANIFIER" | "PLANIFIEE" | "REALISEE" | "REPORTEE" | "ANNULEE" | undefined;
    contratId?: string | undefined;
}, {
    prestation?: string | undefined;
    type?: "OPERATION" | "CONTROLE" | undefined;
    clientId?: string | undefined;
    dateDebut?: string | undefined;
    dateFin?: string | undefined;
    statut?: "A_PLANIFIER" | "PLANIFIEE" | "REALISEE" | "REPORTEE" | "ANNULEE" | undefined;
    contratId?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}>;
export declare const uuidParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreatePrestationInput = z.infer<typeof createPrestationSchema>;
export type UpdatePrestationInput = z.infer<typeof updatePrestationSchema>;
export type CreateContratInput = z.infer<typeof createContratSchema>;
export type UpdateContratInput = z.infer<typeof updateContratSchema>;
export type CreateInterventionInput = z.infer<typeof createInterventionSchema>;
export type UpdateInterventionInput = z.infer<typeof updateInterventionSchema>;
//# sourceMappingURL=schemas.d.ts.map