import { z } from 'zod';

// ============ AUTH ============
export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe minimum 6 caractères'),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email('Email invalide'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  password: z.string().min(6, 'Mot de passe minimum 6 caractères'),
});

// ============ USERS ============
export const createUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe minimum 6 caractères'),
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().min(1, 'Prénom requis'),
  tel: z.string().optional(),
  role: z.enum(['DIRECTION', 'PLANNING', 'EQUIPE', 'LECTURE']),
});

export const updateUserSchema = z.object({
  email: z.string().email('Email invalide').optional(),
  password: z.string().min(6, 'Mot de passe minimum 6 caractères').optional(),
  nom: z.string().min(1, 'Nom requis').optional(),
  prenom: z.string().min(1, 'Prénom requis').optional(),
  tel: z.string().optional(),
  role: z.enum(['DIRECTION', 'PLANNING', 'EQUIPE', 'LECTURE']).optional(),
  actif: z.boolean().optional(),
});

// ============ POSTES / EMPLOYES ============
export const createPosteSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
});

export const updatePosteSchema = z.object({
  nom: z.string().min(1, 'Nom requis').optional(),
  actif: z.boolean().optional(),
});

export const createEmployeSchema = z.object({
  prenom: z.string().min(1, 'Prénom requis'),
  nom: z.string().min(1, 'Nom requis'),
  posteIds: z.array(z.string().uuid('ID poste invalide')).min(1, 'Au moins un poste requis'),
});

export const updateEmployeSchema = z.object({
  prenom: z.string().min(1, 'Prénom requis').optional(),
  nom: z.string().min(1, 'Nom requis').optional(),
  posteIds: z.array(z.string().uuid('ID poste invalide')).min(1, 'Au moins un poste requis').optional(),
});

// ============ CLIENTS ============
export const createClientSchema = z.object({
  nomEntreprise: z.string().min(1, 'Nom d\'entreprise requis'),
  secteur: z.string().optional(),
  siegeNom: z.string().min(1, 'Nom du siège requis'),
  siegeAdresse: z.string().optional(),
  siegeTel: z.string().optional(),
  siegeEmail: z.string().email('Email invalide').optional().or(z.literal('')),
  siegeNotes: z.string().optional(),
  siegeRC: z.string().optional(),
  siegeNIF: z.string().optional(),
  siegeAI: z.string().optional(),
  siegeNIS: z.string().optional(),
  siegeTIN: z.string().optional(),
  siegeContacts: z.array(z.object({
    nom: z.string().optional(),
    fonction: z.string().optional(),
    tel: z.string().optional(),
    email: z.string().email('Email invalide').optional().or(z.literal('')),
  })).optional(),
  sites: z.array(z.object({
    nom: z.string().min(1, 'Nom du site requis'),
    adresse: z.string().optional(),
    contactNom: z.string().optional(),
    contactFonction: z.string().optional(),
    tel: z.string().optional(),
    email: z.string().email('Email invalide').optional().or(z.literal('')),
    notes: z.string().optional(),
  })).min(1, 'Au moins un site requis'),
});

export const updateClientSchema = createClientSchema.partial().extend({
  actif: z.boolean().optional(),
});

// ============ PRESTATIONS ============
export const createPrestationSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  ordre: z.number().int().optional(),
  description: z.string().optional(),
});

export const updatePrestationSchema = z.object({
  nom: z.string().min(1, 'Nom requis').optional(),
  ordre: z.number().int().optional(),
  description: z.string().optional(),
  actif: z.boolean().optional(),
});

// ============ CONTRATS ============
export const frequenceEnum = z.enum([
  'HEBDOMADAIRE',
  'MENSUELLE',
  'TRIMESTRIELLE',
  'SEMESTRIELLE',
  'ANNUELLE',
  'PERSONNALISEE',
]);

const contratSiteSchema = z.object({
  siteId: z.string().uuid('ID site invalide'),
  prestations: z.array(z.string()).min(1, 'Au moins une prestation requise').optional(),
  frequenceOperations: frequenceEnum.optional(),
  frequenceOperationsJours: z.number().int().positive().optional(),
  frequenceControle: frequenceEnum.optional(),
  frequenceControleJours: z.number().int().positive().optional(),
  premiereDateOperation: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  premiereDateControle: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  nombreOperations: z.number().int().positive().optional(),
  nombreVisitesControle: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export const createContratSchema = z.object({
  clientId: z.string().uuid('ID client invalide'),
  type: z.enum(['ANNUEL', 'PONCTUEL']),
  dateDebut: z.string().or(z.date()).transform((val) => new Date(val)),
  dateFin: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  reconductionAuto: z.boolean().optional().default(false),
  prestations: z.array(z.string()).min(1, 'Au moins une prestation requise'),
  frequenceOperations: frequenceEnum.optional(),
  frequenceOperationsJours: z.number().int().positive().optional(),
  frequenceControle: frequenceEnum.optional(),
  frequenceControleJours: z.number().int().positive().optional(),
  premiereDateOperation: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  premiereDateControle: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  responsablePlanningId: z.string().uuid().optional(),
  statut: z.enum(['ACTIF', 'SUSPENDU', 'TERMINE']).optional().default('ACTIF'),
  notes: z.string().optional(),
  autoCreerProchaine: z.boolean().optional().default(true),
  // Champs ponctuel
  numeroBonCommande: z.string().optional(),
  nombreOperations: z.number().int().positive().optional(),
  // Sites du contrat
  contratSites: z.array(contratSiteSchema).optional(),
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

export const updateContratSchema = z.object({
  clientId: z.string().uuid('ID client invalide').optional(),
  type: z.enum(['ANNUEL', 'PONCTUEL']).optional(),
  dateDebut: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  dateFin: z.string().or(z.date()).transform((val) => new Date(val)).optional().nullable(),
  reconductionAuto: z.boolean().optional(),
  prestations: z.array(z.string()).min(1, 'Au moins une prestation requise').optional(),
  frequenceOperations: frequenceEnum.optional().nullable(),
  frequenceOperationsJours: z.number().int().positive().optional().nullable(),
  frequenceControle: frequenceEnum.optional().nullable(),
  frequenceControleJours: z.number().int().positive().optional().nullable(),
  premiereDateOperation: z.string().or(z.date()).transform((val) => new Date(val)).optional().nullable(),
  premiereDateControle: z.string().or(z.date()).transform((val) => new Date(val)).optional().nullable(),
  responsablePlanningId: z.string().uuid().optional().nullable(),
  statut: z.enum(['ACTIF', 'SUSPENDU', 'TERMINE']).optional(),
  notes: z.string().optional(),
  autoCreerProchaine: z.boolean().optional(),
  numeroBonCommande: z.string().optional().nullable(),
  nombreOperations: z.number().int().positive().optional().nullable(),
  contratSites: z.array(contratSiteSchema).optional(),
});

// ============ INTERVENTIONS ============
export const createInterventionSchema = z.object({
  contratId: z.string().uuid().optional(),
  clientId: z.string().uuid('ID client invalide'),
  siteId: z.string().uuid().optional(),
  type: z.enum(['OPERATION', 'CONTROLE']),
  prestation: z.string().optional(),
  datePrevue: z.string().or(z.date()).transform((val) => new Date(val)),
  heurePrevue: z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:MM)').optional(),
  duree: z.number().int().positive().optional(),
  statut: z.enum(['A_PLANIFIER', 'PLANIFIEE', 'REALISEE', 'REPORTEE', 'ANNULEE']).optional().default('A_PLANIFIER'),
  notesTerrain: z.string().optional(),
  responsable: z.string().optional(),
});

export const updateInterventionSchema = createInterventionSchema.partial();

export const realiserInterventionSchema = z.object({
  notesTerrain: z.string().optional(),
  creerProchaine: z.boolean().optional().default(false),
  dateRealisee: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
});

export const reporterInterventionSchema = z.object({
  nouvelleDatePrevue: z.string().or(z.date()).transform((val) => new Date(val)),
  raison: z.string().optional(),
});

// ============ QUERY PARAMS ============
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default('20'),
});

export const clientsQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  actif: z.string().transform((v) => v === 'true').optional(),
});

export const contratsQuerySchema = paginationSchema.extend({
  clientId: z.string().uuid().optional(),
  statut: z.enum(['ACTIF', 'SUSPENDU', 'TERMINE']).optional(),
  type: z.enum(['ANNUEL', 'PONCTUEL']).optional(),
});

export const interventionsQuerySchema = paginationSchema.extend({
  clientId: z.string().uuid().optional(),
  contratId: z.string().uuid().optional(),
  type: z.enum(['OPERATION', 'CONTROLE']).optional(),
  statut: z.enum(['A_PLANIFIER', 'PLANIFIEE', 'REALISEE', 'REPORTEE', 'ANNULEE']).optional(),
  prestation: z.string().optional(),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

// Types exports
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreatePosteInput = z.infer<typeof createPosteSchema>;
export type UpdatePosteInput = z.infer<typeof updatePosteSchema>;
export type CreateEmployeInput = z.infer<typeof createEmployeSchema>;
export type UpdateEmployeInput = z.infer<typeof updateEmployeSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreatePrestationInput = z.infer<typeof createPrestationSchema>;
export type UpdatePrestationInput = z.infer<typeof updatePrestationSchema>;
export type CreateContratInput = z.infer<typeof createContratSchema>;
export type UpdateContratInput = z.infer<typeof updateContratSchema>;
export type CreateInterventionInput = z.infer<typeof createInterventionSchema>;
export type UpdateInterventionInput = z.infer<typeof updateInterventionSchema>;
