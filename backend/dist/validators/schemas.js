"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uuidParamSchema = exports.interventionsQuerySchema = exports.contratsQuerySchema = exports.clientsQuerySchema = exports.paginationSchema = exports.reporterInterventionSchema = exports.realiserInterventionSchema = exports.updateInterventionSchema = exports.createInterventionSchema = exports.updateContratSchema = exports.createContratSchema = exports.frequenceEnum = exports.updatePrestationSchema = exports.createPrestationSchema = exports.updateClientSchema = exports.createClientSchema = exports.updateUserSchema = exports.createUserSchema = exports.resetPasswordSchema = exports.resetPasswordRequestSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
// ============ AUTH ============
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email invalide'),
    password: zod_1.z.string().min(6, 'Mot de passe minimum 6 caractères'),
});
exports.resetPasswordRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email invalide'),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token requis'),
    password: zod_1.z.string().min(6, 'Mot de passe minimum 6 caractères'),
});
// ============ USERS ============
exports.createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email invalide'),
    password: zod_1.z.string().min(6, 'Mot de passe minimum 6 caractères'),
    nom: zod_1.z.string().min(1, 'Nom requis'),
    prenom: zod_1.z.string().min(1, 'Prénom requis'),
    tel: zod_1.z.string().optional(),
    role: zod_1.z.enum(['DIRECTION', 'PLANNING', 'EQUIPE', 'LECTURE']),
});
exports.updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email invalide').optional(),
    password: zod_1.z.string().min(6, 'Mot de passe minimum 6 caractères').optional(),
    nom: zod_1.z.string().min(1, 'Nom requis').optional(),
    prenom: zod_1.z.string().min(1, 'Prénom requis').optional(),
    tel: zod_1.z.string().optional(),
    role: zod_1.z.enum(['DIRECTION', 'PLANNING', 'EQUIPE', 'LECTURE']).optional(),
    actif: zod_1.z.boolean().optional(),
});
// ============ CLIENTS ============
exports.createClientSchema = zod_1.z.object({
    nomEntreprise: zod_1.z.string().min(1, 'Nom d\'entreprise requis'),
    secteur: zod_1.z.string().optional(),
    siegeNom: zod_1.z.string().min(1, 'Nom du siège requis'),
    siegeAdresse: zod_1.z.string().optional(),
    siegeTel: zod_1.z.string().optional(),
    siegeEmail: zod_1.z.string().email('Email invalide').optional().or(zod_1.z.literal('')),
    siegeNotes: zod_1.z.string().optional(),
    siegeRC: zod_1.z.string().optional(),
    siegeNIF: zod_1.z.string().optional(),
    siegeAI: zod_1.z.string().optional(),
    siegeNIS: zod_1.z.string().optional(),
    siegeTIN: zod_1.z.string().optional(),
    siegeContacts: zod_1.z.array(zod_1.z.object({
        nom: zod_1.z.string().optional(),
        fonction: zod_1.z.string().optional(),
        tel: zod_1.z.string().optional(),
        email: zod_1.z.string().email('Email invalide').optional().or(zod_1.z.literal('')),
    })).optional(),
    sites: zod_1.z.array(zod_1.z.object({
        nom: zod_1.z.string().min(1, 'Nom du site requis'),
        adresse: zod_1.z.string().optional(),
        contactNom: zod_1.z.string().optional(),
        contactFonction: zod_1.z.string().optional(),
        tel: zod_1.z.string().optional(),
        email: zod_1.z.string().email('Email invalide').optional().or(zod_1.z.literal('')),
        notes: zod_1.z.string().optional(),
    })).min(1, 'Au moins un site requis'),
});
exports.updateClientSchema = exports.createClientSchema.partial().extend({
    actif: zod_1.z.boolean().optional(),
});
// ============ PRESTATIONS ============
exports.createPrestationSchema = zod_1.z.object({
    nom: zod_1.z.string().min(1, 'Nom requis'),
    ordre: zod_1.z.number().int().optional(),
    description: zod_1.z.string().optional(),
});
exports.updatePrestationSchema = zod_1.z.object({
    nom: zod_1.z.string().min(1, 'Nom requis').optional(),
    ordre: zod_1.z.number().int().optional(),
    description: zod_1.z.string().optional(),
    actif: zod_1.z.boolean().optional(),
});
// ============ CONTRATS ============
exports.frequenceEnum = zod_1.z.enum([
    'HEBDOMADAIRE',
    'MENSUELLE',
    'TRIMESTRIELLE',
    'SEMESTRIELLE',
    'ANNUELLE',
    'PERSONNALISEE',
]);
const contratSiteSchema = zod_1.z.object({
    siteId: zod_1.z.string().uuid('ID site invalide'),
    prestations: zod_1.z.array(zod_1.z.string()).min(1, 'Au moins une prestation requise').optional(),
    frequenceOperations: exports.frequenceEnum.optional(),
    frequenceOperationsJours: zod_1.z.number().int().positive().optional(),
    frequenceControle: exports.frequenceEnum.optional(),
    frequenceControleJours: zod_1.z.number().int().positive().optional(),
    premiereDateOperation: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)).optional(),
    premiereDateControle: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)).optional(),
    nombreOperations: zod_1.z.number().int().positive().optional(),
    nombreVisitesControle: zod_1.z.number().int().positive().optional(),
    notes: zod_1.z.string().optional(),
});
exports.createContratSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid('ID client invalide'),
    type: zod_1.z.enum(['ANNUEL', 'PONCTUEL']),
    dateDebut: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)),
    dateFin: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)).optional(),
    reconductionAuto: zod_1.z.boolean().optional().default(false),
    prestations: zod_1.z.array(zod_1.z.string()).min(1, 'Au moins une prestation requise'),
    frequenceOperations: exports.frequenceEnum.optional(),
    frequenceOperationsJours: zod_1.z.number().int().positive().optional(),
    frequenceControle: exports.frequenceEnum.optional(),
    frequenceControleJours: zod_1.z.number().int().positive().optional(),
    premiereDateOperation: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)).optional(),
    premiereDateControle: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)).optional(),
    responsablePlanningId: zod_1.z.string().uuid().optional(),
    statut: zod_1.z.enum(['ACTIF', 'SUSPENDU', 'TERMINE']).optional().default('ACTIF'),
    notes: zod_1.z.string().optional(),
    autoCreerProchaine: zod_1.z.boolean().optional().default(true),
    // Champs ponctuel
    numeroBonCommande: zod_1.z.string().optional(),
    nombreOperations: zod_1.z.number().int().positive().optional(),
    // Sites du contrat
    contratSites: zod_1.z.array(contratSiteSchema).optional(),
}).refine((data) => {
    // Si contrat ponctuel, il faut un numéro de bon de commande
    if (data.type === 'PONCTUEL' && !data.numeroBonCommande) {
        return false;
    }
    return true;
}, {
    message: 'Un contrat ponctuel nécessite un numéro de bon de commande',
}).refine((data) => {
    // Si le contrat est ACTIF, vérifier les fréquences (au niveau contrat ou sites)
    if (data.statut === 'ACTIF') {
        const hasContratSites = data.contratSites && data.contratSites.length > 0;
        if (hasContratSites) {
            // Si on a des sites, les fréquences sont au niveau site
            return true;
        }
        const hasFrequenceOp = !!data.frequenceOperations;
        const hasFrequenceCtrl = !!data.frequenceControle;
        if (!hasFrequenceOp && !hasFrequenceCtrl) {
            return false;
        }
        if (hasFrequenceOp && !data.premiereDateOperation) {
            return false;
        }
        if (hasFrequenceCtrl && !data.premiereDateControle) {
            return false;
        }
    }
    return true;
}, {
    message: 'Un contrat actif nécessite au moins une fréquence avec sa date de première intervention',
});
exports.updateContratSchema = zod_1.z.object({
    clientId: zod_1.z.string().uuid('ID client invalide').optional(),
    type: zod_1.z.enum(['ANNUEL', 'PONCTUEL']).optional(),
    dateDebut: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)).optional(),
    dateFin: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)).optional().nullable(),
    reconductionAuto: zod_1.z.boolean().optional(),
    prestations: zod_1.z.array(zod_1.z.string()).min(1, 'Au moins une prestation requise').optional(),
    frequenceOperations: exports.frequenceEnum.optional().nullable(),
    frequenceOperationsJours: zod_1.z.number().int().positive().optional().nullable(),
    frequenceControle: exports.frequenceEnum.optional().nullable(),
    frequenceControleJours: zod_1.z.number().int().positive().optional().nullable(),
    premiereDateOperation: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)).optional().nullable(),
    premiereDateControle: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)).optional().nullable(),
    responsablePlanningId: zod_1.z.string().uuid().optional().nullable(),
    statut: zod_1.z.enum(['ACTIF', 'SUSPENDU', 'TERMINE']).optional(),
    notes: zod_1.z.string().optional(),
    autoCreerProchaine: zod_1.z.boolean().optional(),
    numeroBonCommande: zod_1.z.string().optional().nullable(),
    nombreOperations: zod_1.z.number().int().positive().optional().nullable(),
    contratSites: zod_1.z.array(contratSiteSchema).optional(),
});
// ============ INTERVENTIONS ============
exports.createInterventionSchema = zod_1.z.object({
    contratId: zod_1.z.string().uuid().optional(),
    clientId: zod_1.z.string().uuid('ID client invalide'),
    siteId: zod_1.z.string().uuid().optional(),
    type: zod_1.z.enum(['OPERATION', 'CONTROLE']),
    prestation: zod_1.z.string().optional(),
    datePrevue: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)),
    heurePrevue: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:MM)').optional(),
    duree: zod_1.z.number().int().positive().optional(),
    statut: zod_1.z.enum(['A_PLANIFIER', 'PLANIFIEE', 'REALISEE', 'REPORTEE', 'ANNULEE']).optional().default('A_PLANIFIER'),
    notesTerrain: zod_1.z.string().optional(),
    responsable: zod_1.z.string().optional(),
});
exports.updateInterventionSchema = exports.createInterventionSchema.partial();
exports.realiserInterventionSchema = zod_1.z.object({
    notesTerrain: zod_1.z.string().optional(),
    creerProchaine: zod_1.z.boolean().optional().default(false),
    dateRealisee: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)).optional(),
});
exports.reporterInterventionSchema = zod_1.z.object({
    nouvelleDatePrevue: zod_1.z.string().or(zod_1.z.date()).transform((val) => new Date(val)),
    raison: zod_1.z.string().optional(),
});
// ============ QUERY PARAMS ============
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().positive()).optional().default('1'),
    limit: zod_1.z.string().transform(Number).pipe(zod_1.z.number().int().positive().max(100)).optional().default('20'),
});
exports.clientsQuerySchema = exports.paginationSchema.extend({
    search: zod_1.z.string().optional(),
    actif: zod_1.z.string().transform((v) => v === 'true').optional(),
});
exports.contratsQuerySchema = exports.paginationSchema.extend({
    clientId: zod_1.z.string().uuid().optional(),
    statut: zod_1.z.enum(['ACTIF', 'SUSPENDU', 'TERMINE']).optional(),
    type: zod_1.z.enum(['ANNUEL', 'PONCTUEL']).optional(),
});
exports.interventionsQuerySchema = exports.paginationSchema.extend({
    clientId: zod_1.z.string().uuid().optional(),
    contratId: zod_1.z.string().uuid().optional(),
    type: zod_1.z.enum(['OPERATION', 'CONTROLE']).optional(),
    statut: zod_1.z.enum(['A_PLANIFIER', 'PLANIFIEE', 'REALISEE', 'REPORTEE', 'ANNULEE']).optional(),
    prestation: zod_1.z.string().optional(),
    dateDebut: zod_1.z.string().optional(),
    dateFin: zod_1.z.string().optional(),
});
exports.uuidParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('ID invalide'),
});
//# sourceMappingURL=schemas.js.map