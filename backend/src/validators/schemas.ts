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
const clientSiteContactSchema = z.object({
  nom: z.string().optional(),
  fonction: z.string().optional(),
  tel: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
});

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
    tel: z.string().optional(),
    email: z.string().email('Email invalide').optional().or(z.literal('')),
    notes: z.string().optional(),
    contacts: z.array(clientSiteContactSchema).optional(),
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
const interventionEmployeSchema = z.object({
  employeId: z.string().uuid('ID employé invalide'),
  posteId: z.string().uuid('ID poste invalide'),
});

export const createInterventionSchema = z.object({
  contratId: z.string().uuid().optional(),
  clientId: z.string().uuid('ID client invalide'),
  siteId: z.string().uuid().optional(),
  type: z.enum(['OPERATION', 'CONTROLE', 'RECLAMATION', 'PREMIERE_VISITE', 'DEPLACEMENT_COMMERCIAL']),
  prestation: z.string().optional(),
  datePrevue: z.string().or(z.date()).transform((val) => new Date(val)),
  heurePrevue: z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:MM)').optional(),
  duree: z.number().int().positive().optional(),
  statut: z.enum(['A_PLANIFIER', 'PLANIFIEE', 'REALISEE', 'REPORTEE', 'ANNULEE']).optional().default('A_PLANIFIER'),
  notesTerrain: z.string().optional(),
  responsable: z.string().optional(),
  employes: z.array(interventionEmployeSchema).optional(),
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
  type: z.enum(['OPERATION', 'CONTROLE', 'RECLAMATION', 'PREMIERE_VISITE', 'DEPLACEMENT_COMMERCIAL']).optional(),
  statut: z.enum(['A_PLANIFIER', 'PLANIFIEE', 'REALISEE', 'REPORTEE', 'ANNULEE']).optional(),
  prestation: z.string().optional(),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

// ============ STOCK ============
export const createProduitSchema = z.object({
  reference: z.string().min(1, 'Référence requise'),
  nom: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  unite: z.string().optional().default('unité'),
  quantite: z.number().min(0, 'Quantité invalide').optional().default(0),
  stockMinimum: z.number().min(0, 'Stock minimum invalide').optional().default(0),
  prixUnitaire: z.number().min(0, 'Prix invalide').optional(),
});

export const updateProduitSchema = z.object({
  reference: z.string().min(1, 'Référence requise').optional(),
  nom: z.string().min(1, 'Nom requis').optional(),
  description: z.string().optional().nullable(),
  unite: z.string().optional(),
  stockMinimum: z.number().min(0, 'Stock minimum invalide').optional(),
  prixUnitaire: z.number().min(0, 'Prix invalide').optional().nullable(),
  actif: z.boolean().optional(),
});

export const createMouvementSchema = z.object({
  produitId: z.string().uuid('ID produit invalide'),
  type: z.enum(['ENTREE', 'SORTIE', 'AJUSTEMENT']),
  quantite: z.number().positive('Quantité doit être positive'),
  motif: z.string().optional(),
  interventionId: z.string().uuid().optional(),
});

// ============ RH (Congés, Récupération) ============
export const typeCongeEnum = z.enum([
  'ANNUEL',
  'MALADIE',
  'RECUPERATION',
  'SANS_SOLDE',
  'EXCEPTIONNEL',
]);

export const statutCongeEnum = z.enum([
  'EN_ATTENTE',
  'APPROUVE',
  'REFUSE',
  'ANNULE',
]);

export const createCongeSchema = z.object({
  employeId: z.string().uuid('ID employé invalide'),
  type: typeCongeEnum,
  dateDebut: z.string().or(z.date()).transform((val) => new Date(val)),
  dateFin: z.string().or(z.date()).transform((val) => new Date(val)),
  nbJours: z.number().positive('Nombre de jours requis'),
  motif: z.string().optional(),
});

export const approuverCongeSchema = z.object({
  approuve: z.boolean(),
  commentaire: z.string().optional(),
});

export const createWeekendTravailleSchema = z.object({
  employeId: z.string().uuid('ID employé invalide'),
  date: z.string().or(z.date()).transform((val) => new Date(val)),
  notes: z.string().optional(),
});

export const updateSoldeSchema = z.object({
  employeId: z.string().uuid('ID employé invalide'),
  annee: z.number().int().min(2020).max(2100),
  type: typeCongeEnum,
  joursAcquis: z.number().min(0, 'Jours acquis invalide'),
});

export const congesQuerySchema = paginationSchema.extend({
  employeId: z.string().uuid().optional(),
  statut: statutCongeEnum.optional(),
  type: typeCongeEnum.optional(),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
});

export const weekendTravailleQuerySchema = z.object({
  employeId: z.string().uuid().optional(),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
});

export const soldesQuerySchema = z.object({
  employeId: z.string().uuid().optional(),
  annee: z.string().transform(Number).pipe(z.number().int()).optional(),
});

// ============ TIERS (Dolibarr-style) ============
export const typeTiersEnum = z.enum([
  'CLIENT',
  'FOURNISSEUR',
  'PROSPECT',
  'CLIENT_FOURNISSEUR',
]);

export const formeJuridiqueEnum = z.enum([
  'SARL',
  'EURL',
  'SPA',
  'SNC',
  'AUTO_ENTREPRENEUR',
  'ASSOCIATION',
  'PARTICULIER',
  'AUTRE',
]);

export const civiliteEnum = z.enum(['M', 'MME', 'MLLE']);

export const typeAdresseEnum = z.enum([
  'SIEGE',
  'FACTURATION',
  'LIVRAISON',
  'SITE',
]);

const contactSchema = z.object({
  civilite: civiliteEnum.optional(),
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().optional(),
  fonction: z.string().optional(),
  tel: z.string().optional(),
  telMobile: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  dateNaissance: z.string().optional(),
  notes: z.string().optional(),
  estPrincipal: z.boolean().optional(),
});

const adresseSchema = z.object({
  type: typeAdresseEnum.optional(),
  libelle: z.string().optional(),
  adresse: z.string().optional(),
  complement: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  pays: z.string().optional(),
  contactNom: z.string().optional(),
  contactTel: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  estDefaut: z.boolean().optional(),
  notes: z.string().optional(),
});

const compteBancaireSchema = z.object({
  libelle: z.string().min(1, 'Libellé requis'),
  banque: z.string().min(1, 'Nom de banque requis'),
  agence: z.string().optional(),
  codeBanque: z.string().optional(),
  codeGuichet: z.string().optional(),
  numeroCompte: z.string().optional(),
  cleRib: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  titulaire: z.string().optional(),
  devise: z.string().optional(),
  estDefaut: z.boolean().optional(),
});

// Contact de site (pour les sites d'intervention)
const siteContactSchema = z.object({
  civilite: civiliteEnum.optional(),
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().optional(),
  fonction: z.string().optional(),
  tel: z.string().optional(),
  telMobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional(),
  estPrincipal: z.boolean().optional(),
});

// Site d'intervention
const siteSchema = z.object({
  code: z.string().optional(),
  nom: z.string().min(1, 'Nom du site requis'),
  adresse: z.string().optional(),
  complement: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  pays: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  tel: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  horairesOuverture: z.string().optional(),
  accessibilite: z.string().optional(),
  notes: z.string().optional(),
  contacts: z.array(siteContactSchema).optional(),
});

export const createTiersSchema = z.object({
  // Identification
  code: z.string().optional(),
  nomEntreprise: z.string().min(1, 'Nom d\'entreprise requis'),
  nomAlias: z.string().optional(),
  typeTiers: typeTiersEnum.optional().default('CLIENT'),

  // Informations légales
  formeJuridique: formeJuridiqueEnum.optional(),
  siegeRC: z.string().optional(),
  siegeNIF: z.string().optional(),
  siegeAI: z.string().optional(),
  siegeNIS: z.string().optional(),
  siegeTIN: z.string().optional(),
  tvaIntracom: z.string().optional(),
  capital: z.number().optional(),
  dateCreation: z.string().optional(),

  // Siège social
  siegeNom: z.string().optional(),
  siegeAdresse: z.string().optional(),
  siegeCodePostal: z.string().optional(),
  siegeVille: z.string().optional(),
  siegePays: z.string().optional(),
  siegeTel: z.string().optional(),
  siegeFax: z.string().optional(),
  siegeEmail: z.string().email().optional().or(z.literal('')),
  siegeWebsite: z.string().optional(),
  siegeNotes: z.string().optional(),

  // Classification
  secteur: z.string().optional(),
  categorie: z.string().optional(),
  codeComptaClient: z.string().optional(),
  codeComptaFournisseur: z.string().optional(),

  // Conditions commerciales
  modePaiementId: z.string().uuid().optional(),
  conditionPaiementId: z.string().uuid().optional(),
  remiseParDefaut: z.number().min(0).max(100).optional(),
  encoursMaximum: z.number().min(0).optional(),

  // Devises
  devise: z.string().optional(),

  // Notes
  notePublique: z.string().optional(),
  notePrivee: z.string().optional(),

  // Prospect
  prospectNiveau: z.number().int().min(0).max(2).optional(),
  prospectStatut: z.string().optional(),

  // Relations
  contacts: z.array(contactSchema).optional(),
  sites: z.array(siteSchema).optional(),
  adresses: z.array(adresseSchema).optional(),
  comptesBancaires: z.array(compteBancaireSchema).optional(),
});

export const updateTiersSchema = createTiersSchema.partial().extend({
  actif: z.boolean().optional(),
});

export const createContactSchema = contactSchema;
export const updateContactSchema = contactSchema.partial().extend({
  actif: z.boolean().optional(),
});

export const createAdresseSchema = adresseSchema.extend({
  type: typeAdresseEnum.optional(),
});
export const updateAdresseSchema = adresseSchema.partial().extend({
  actif: z.boolean().optional(),
});

export const createCompteBancaireSchema = compteBancaireSchema;
export const updateCompteBancaireSchema = compteBancaireSchema.partial().extend({
  actif: z.boolean().optional(),
});

// Site schemas
export const createSiteSchema = siteSchema;
export const updateSiteSchema = siteSchema.partial().extend({
  actif: z.boolean().optional(),
});

// Site contact schemas
export const createSiteContactSchema = siteContactSchema;
export const updateSiteContactSchema = siteContactSchema.partial().extend({
  actif: z.boolean().optional(),
});

export const createModePaiementSchema = z.object({
  code: z.string().min(1, 'Code requis'),
  libelle: z.string().min(1, 'Libellé requis'),
  ordre: z.number().int().optional(),
});

export const createConditionPaiementSchema = z.object({
  code: z.string().min(1, 'Code requis'),
  libelle: z.string().min(1, 'Libellé requis'),
  nbJours: z.number().int().min(0).optional(),
  ordre: z.number().int().optional(),
});

export const tiersQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  typeTiers: typeTiersEnum.optional(),
  actif: z.string().transform((v) => v === 'true').optional(),
  formeJuridique: formeJuridiqueEnum.optional(),
  secteur: z.string().optional(),
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

// ============ PRODUITS/SERVICES (Dolibarr-style) ============
export const typeProduitEnum = z.enum(['PRODUIT', 'SERVICE']);

export const natureProduitEnum = z.enum([
  'MATIERE_PREMIERE',
  'PRODUIT_FINI',
  'PRODUIT_SEMI_FINI',
  'CONSOMMABLE',
  'PIECE_DETACHEE',
  'AUTRE',
]);

export const typeMouvementEnum = z.enum([
  'ENTREE',
  'SORTIE',
  'AJUSTEMENT',
  'TRANSFERT',
  'INVENTAIRE',
]);

// Catégorie de produit
export const createCategorieProduitSchema = z.object({
  code: z.string().optional(),
  nom: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  couleur: z.string().optional(),
  icone: z.string().optional(),
  ordre: z.number().int().optional(),
});

export const updateCategorieProduitSchema = createCategorieProduitSchema.partial().extend({
  actif: z.boolean().optional(),
});

// Entrepôt
export const createEntrepotSchema = z.object({
  code: z.string().min(1, 'Code requis'),
  nom: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  adresse: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  pays: z.string().optional(),
  responsable: z.string().optional(),
  tel: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  estDefaut: z.boolean().optional(),
});

export const updateEntrepotSchema = createEntrepotSchema.partial().extend({
  actif: z.boolean().optional(),
});

// Produit/Service complet
export const createProduitServiceSchema = z.object({
  // Identification
  reference: z.string().min(1, 'Référence requise'),
  codeBarres: z.string().optional(),
  nom: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  descriptionLongue: z.string().optional(),

  // Type et nature
  type: typeProduitEnum.optional().default('PRODUIT'),
  nature: natureProduitEnum.optional(),

  // Unités
  unite: z.string().optional().default('unité'),
  uniteAchat: z.string().optional(),
  ratioUnites: z.number().positive().optional(),

  // Prix de vente
  prixVenteHT: z.number().min(0).optional(),
  tauxTVA: z.number().min(0).max(100).optional().default(19),

  // Prix d'achat
  prixAchatHT: z.number().min(0).optional(),
  margeParDefaut: z.number().min(0).max(100).optional(),

  // Stock
  aStock: z.boolean().optional(),
  quantite: z.number().min(0).optional().default(0),
  stockMinimum: z.number().min(0).optional().default(0),
  stockMaximum: z.number().min(0).optional(),
  lotSuivi: z.boolean().optional(),
  dlcSuivi: z.boolean().optional(),

  // Service
  dureeService: z.number().positive().optional(),

  // Fournisseur
  fournisseurId: z.string().uuid().optional(),
  fournisseursDefaut: z.array(z.object({
    fournisseurId: z.string().uuid('ID fournisseur invalide'),
    ordre: z.number().int().min(1).optional().default(1),
  })).optional(),
  delaiLivraison: z.number().int().positive().optional(),

  // Classification
  marque: z.string().optional(),
  modele: z.string().optional(),
  poids: z.number().positive().optional(),
  longueur: z.number().positive().optional(),
  largeur: z.number().positive().optional(),
  hauteur: z.number().positive().optional(),

  // Comptabilité
  compteVente: z.string().optional(),
  compteAchat: z.string().optional(),

  // Notes
  notePublique: z.string().optional(),
  notePrivee: z.string().optional(),
  urlExterne: z.string().url().optional().or(z.literal('')),

  // Statut
  enVente: z.boolean().optional().default(true),
  enAchat: z.boolean().optional().default(true),

  // Catégories
  categorieIds: z.array(z.string().uuid()).optional(),
});

export const updateProduitServiceSchema = createProduitServiceSchema.partial().extend({
  actif: z.boolean().optional(),
});

// Prix fournisseur
export const createPrixFournisseurSchema = z.object({
  produitId: z.string().uuid('ID produit invalide'),
  fournisseurId: z.string().uuid('ID fournisseur invalide'),
  refFournisseur: z.string().optional(),
  prixAchatHT: z.number().min(0, 'Prix invalide'),
  remise: z.number().min(0).max(100).optional(),
  quantiteMin: z.number().positive().optional(),
  delaiLivraison: z.number().int().positive().optional(),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
  estDefaut: z.boolean().optional(),
  notes: z.string().optional(),
});

export const updatePrixFournisseurSchema = createPrixFournisseurSchema.partial().omit({
  produitId: true,
  fournisseurId: true,
}).extend({
  actif: z.boolean().optional(),
});

// Prix client
export const createPrixClientSchema = z.object({
  produitId: z.string().uuid('ID produit invalide'),
  clientId: z.string().uuid('ID client invalide'),
  prixVenteHT: z.number().min(0, 'Prix invalide'),
  remise: z.number().min(0).max(100).optional(),
  quantiteMin: z.number().positive().optional(),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePrixClientSchema = createPrixClientSchema.partial().omit({
  produitId: true,
  clientId: true,
}).extend({
  actif: z.boolean().optional(),
});

// Lot produit
export const createLotProduitSchema = z.object({
  produitId: z.string().uuid('ID produit invalide'),
  numeroLot: z.string().min(1, 'Numéro de lot requis'),
  quantite: z.number().min(0).optional(),
  datePeremption: z.string().optional(),
  dateFabrication: z.string().optional(),
  notes: z.string().optional(),
});

export const updateLotProduitSchema = createLotProduitSchema.partial().omit({
  produitId: true,
}).extend({
  actif: z.boolean().optional(),
});

// Mouvement de stock (nouveau modèle)
export const createMouvementProduitServiceSchema = z.object({
  type: typeMouvementEnum,
  quantite: z.number().positive('Quantité doit être positive'),
  entrepotId: z.string().uuid().optional(),
  entrepotDestId: z.string().uuid().optional(),
  motif: z.string().optional(),
  numeroLot: z.string().optional(),
  interventionId: z.string().uuid().optional(),
});

// Query schemas
export const produitsServicesQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type: typeProduitEnum.optional(),
  categorieId: z.string().uuid().optional(),
  fournisseurId: z.string().uuid().optional(),
  actif: z.string().transform((v) => v === 'true').optional(),
  stockBas: z.string().transform((v) => v === 'true').optional(),
  enVente: z.string().transform((v) => v === 'true').optional(),
  enAchat: z.string().transform((v) => v === 'true').optional(),
});

export const categoriesProduitsQuerySchema = z.object({
  search: z.string().optional(),
  actif: z.string().transform((v) => v === 'true').optional(),
  parentId: z.string().optional(),
});

export const entrepotsQuerySchema = z.object({
  search: z.string().optional(),
  actif: z.string().transform((v) => v === 'true').optional(),
});

export const prixFournisseursQuerySchema = z.object({
  produitId: z.string().uuid().optional(),
  fournisseurId: z.string().uuid().optional(),
  actif: z.string().transform((v) => v === 'true').optional(),
});

export const prixClientsQuerySchema = z.object({
  produitId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  actif: z.string().transform((v) => v === 'true').optional(),
});

// ============ COMMERCE ============

const commerceLigneSchema = z.object({
  produitServiceId: z.string().uuid().optional(),
  libelle: z.string().min(1, 'Libellé requis').optional(),
  description: z.string().optional(),
  quantite: z.number().positive('Quantité invalide'),
  unite: z.string().optional(),
  prixUnitaireHT: z.number().min(0).optional(),
  tauxTVA: z.number().min(0).max(100).optional(),
  remisePct: z.number().min(0).max(100).optional(),
  ordre: z.number().int().optional(),
});

export const createDevisSchema = z.object({
  clientId: z.string().uuid('ID client invalide'),
  adresseFacturationId: z.string().uuid().optional(),
  adresseLivraisonId: z.string().uuid().optional(),
  dateDevis: z.string().optional(),
  dateValidite: z.string().optional(),
  statut: z.enum(['BROUILLON', 'VALIDE', 'SIGNE', 'REFUSE', 'EXPIRE', 'ANNULE']).optional(),
  remiseGlobalPct: z.number().min(0).max(100).optional(),
  remiseGlobalMontant: z.number().min(0).optional(),
  devise: z.string().optional(),
  notes: z.string().optional(),
  conditions: z.string().optional(),
  lignes: z.array(commerceLigneSchema).min(1, 'Au moins une ligne requise'),
});

export const updateDevisSchema = createDevisSchema.partial().extend({
  lignes: z.array(commerceLigneSchema).optional(),
});

export const createCommandeSchema = z.object({
  clientId: z.string().uuid('ID client invalide'),
  devisId: z.string().uuid().optional(),
  adresseFacturationId: z.string().uuid().optional(),
  adresseLivraisonId: z.string().uuid().optional(),
  dateCommande: z.string().optional(),
  dateLivraisonSouhaitee: z.string().optional(),
  statut: z.enum(['BROUILLON', 'VALIDEE', 'EN_PREPARATION', 'EXPEDIEE', 'LIVREE', 'ANNULEE']).optional(),
  remiseGlobalPct: z.number().min(0).max(100).optional(),
  remiseGlobalMontant: z.number().min(0).optional(),
  devise: z.string().optional(),
  notes: z.string().optional(),
  conditions: z.string().optional(),
  lignes: z.array(commerceLigneSchema).min(1, 'Au moins une ligne requise'),
});

export const updateCommandeSchema = createCommandeSchema.partial().extend({
  lignes: z.array(commerceLigneSchema).optional(),
});

export const createFactureSchema = z.object({
  clientId: z.string().uuid('ID client invalide'),
  devisId: z.string().uuid().optional(),
  commandeId: z.string().uuid().optional(),
  adresseFacturationId: z.string().uuid().optional(),
  adresseLivraisonId: z.string().uuid().optional(),
  dateFacture: z.string().optional(),
  dateEcheance: z.string().optional(),
  statut: z.enum(['BROUILLON', 'VALIDEE', 'EN_RETARD', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE']).optional(),
  type: z.enum(['FACTURE', 'AVOIR']).optional(),
  remiseGlobalPct: z.number().min(0).max(100).optional(),
  remiseGlobalMontant: z.number().min(0).optional(),
  devise: z.string().optional(),
  notes: z.string().optional(),
  conditions: z.string().optional(),
  lignes: z.array(commerceLigneSchema).min(1, 'Au moins une ligne requise'),
});

export const updateFactureSchema = createFactureSchema.partial().extend({
  lignes: z.array(commerceLigneSchema).optional(),
});

// Relances factures clients
export const createFactureRelanceSchema = z.object({
  niveau: z.number().int().min(1).optional(),
  canal: z.enum(['EMAIL', 'SMS', 'COURRIER', 'APPEL']),
  commentaire: z.string().optional(),
  dateRelance: z.string().optional(),
});

export const createPaiementSchema = z.object({
  factureId: z.string().uuid('ID facture invalide'),
  modePaiementId: z.string().uuid().optional(),
  datePaiement: z.string().optional(),
  montant: z.number().positive('Montant invalide'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// ============ COMMANDES FOURNISSEURS ============

const commandeFournisseurLigneSchema = z.object({
  produitServiceId: z.string().uuid().optional(),
  libelle: z.string().optional(),
  description: z.string().optional(),
  quantite: z.number().positive('Quantité invalide'),
  unite: z.string().optional(),
  prixUnitaireHT: z.number().min(0).optional(),
  tauxTVA: z.number().min(0).max(100).optional(),
  remisePct: z.number().min(0).max(100).optional(),
  quantiteRecue: z.number().min(0).optional(),
  ordre: z.number().int().optional(),
});

export const createCommandeFournisseurSchema = z.object({
  fournisseurId: z.string().uuid('ID fournisseur invalide'),
  dateCommande: z.string().optional(),
  dateLivraisonSouhaitee: z.string().optional(),
  statut: z.enum(['BROUILLON', 'ENVOYEE', 'CONFIRMEE', 'EN_RECEPTION', 'RECUE', 'ANNULEE']).optional(),
  remiseGlobalPct: z.number().min(0).max(100).optional(),
  remiseGlobalMontant: z.number().min(0).optional(),
  devise: z.string().optional(),
  notes: z.string().optional(),
  conditions: z.string().optional(),
  lignes: z.array(commandeFournisseurLigneSchema).min(1, 'Au moins une ligne requise'),
});

export const updateCommandeFournisseurSchema = createCommandeFournisseurSchema.partial().extend({
  lignes: z.array(commandeFournisseurLigneSchema).optional(),
  dateLivraison: z.string().optional(),
});

export const receptionCommandeFournisseurSchema = z.object({
  dateLivraison: z.string().optional(),
  lignes: z.array(z.object({
    id: z.string().uuid(),
    quantiteRecue: z.number().min(0),
  })).optional(),
});

// ============ FACTURES FOURNISSEURS ============

export const factureFournisseurStatutEnum = z.enum([
  'BROUILLON', 'VALIDEE', 'EN_RETARD', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE'
]);

const factureFournisseurLigneSchema = z.object({
  produitServiceId: z.string().uuid().optional(),
  libelle: z.string().optional(),
  description: z.string().optional(),
  quantite: z.number().positive('Quantité invalide').default(1),
  unite: z.string().optional(),
  prixUnitaireHT: z.number().min(0).optional(),
  tauxTVA: z.number().min(0).max(100).optional().default(19),
  remisePct: z.number().min(0).max(100).optional(),
  ordre: z.number().int().optional(),
});

export const createFactureFournisseurSchema = z.object({
  fournisseurId: z.string().uuid('ID fournisseur invalide'),
  commandeFournisseurId: z.string().uuid().optional(),
  refFournisseur: z.string().optional(),
  dateFacture: z.string().optional(),
  dateEcheance: z.string().optional(),
  dateReception: z.string().optional(),
  statut: factureFournisseurStatutEnum.optional().default('BROUILLON'),
  remiseGlobalPct: z.number().min(0).max(100).optional(),
  remiseGlobalMontant: z.number().min(0).optional(),
  devise: z.string().optional(),
  notes: z.string().optional(),
  conditions: z.string().optional(),
  lignes: z.array(factureFournisseurLigneSchema).min(1, 'Au moins une ligne requise'),
});

export const updateFactureFournisseurSchema = createFactureFournisseurSchema.partial().extend({
  lignes: z.array(factureFournisseurLigneSchema).optional(),
});

export const createPaiementFournisseurSchema = z.object({
  modePaiementId: z.string().uuid().optional(),
  datePaiement: z.string().optional(),
  montant: z.number().positive('Montant requis'),
  reference: z.string().optional(),
  banque: z.string().optional(),
  notes: z.string().optional(),
});

// ============ CHARGES & DEPENSES ============

export const typeChargeEnum = z.enum(['FOURNISSEUR', 'FISCALE', 'SOCIALE', 'DIVERSE']);
export const chargeStatutEnum = z.enum(['A_PAYER', 'PARTIELLEMENT_PAYEE', 'PAYEE', 'ANNULEE']);

export const createChargeSchema = z.object({
  typeCharge: typeChargeEnum,
  libelle: z.string().min(1, 'Libellé requis'),
  description: z.string().optional(),
  fournisseurId: z.string().uuid().optional(),
  categorie: z.string().optional(),
  sousCategorie: z.string().optional(),
  dateCharge: z.string().optional(),
  dateEcheance: z.string().optional(),
  periodeDebut: z.string().optional(),
  periodeFin: z.string().optional(),
  montantHT: z.number().min(0).default(0),
  tauxTVA: z.number().min(0).max(100).optional().default(0),
  devise: z.string().optional(),
  estRecurrente: z.boolean().optional().default(false),
  frequenceRecurrence: z.string().optional(),
  notes: z.string().optional(),
});

export const updateChargeSchema = createChargeSchema.partial().extend({
  statut: chargeStatutEnum.optional(),
});

export const createPaiementChargeSchema = z.object({
  modePaiementId: z.string().uuid().optional(),
  datePaiement: z.string().optional(),
  montant: z.number().positive('Montant requis'),
  reference: z.string().optional(),
  banque: z.string().optional(),
  notes: z.string().optional(),
});

// ============ PAIEMENTS DIVERS ============

export const createPaiementDiversSchema = z.object({
  libelle: z.string().min(1, 'Libellé requis'),
  description: z.string().optional(),
  typeOperation: z.enum(['ENCAISSEMENT', 'DECAISSEMENT']),
  categorie: z.string().optional(),
  tiersId: z.string().uuid().optional(),
  montant: z.number().positive('Montant requis'),
  devise: z.string().optional(),
  datePaiement: z.string().optional(),
  modePaiementId: z.string().uuid().optional(),
  reference: z.string().optional(),
  banque: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePaiementDiversSchema = createPaiementDiversSchema.partial();

// Types exports
export type CreateProduitServiceInput = z.infer<typeof createProduitServiceSchema>;
export type UpdateProduitServiceInput = z.infer<typeof updateProduitServiceSchema>;
export type CreateCategorieProduitInput = z.infer<typeof createCategorieProduitSchema>;
export type UpdateCategorieProduitInput = z.infer<typeof updateCategorieProduitSchema>;
export type CreateEntrepotInput = z.infer<typeof createEntrepotSchema>;
export type UpdateEntrepotInput = z.infer<typeof updateEntrepotSchema>;
export type CreatePrixFournisseurInput = z.infer<typeof createPrixFournisseurSchema>;
export type UpdatePrixFournisseurInput = z.infer<typeof updatePrixFournisseurSchema>;
export type CreatePrixClientInput = z.infer<typeof createPrixClientSchema>;
export type UpdatePrixClientInput = z.infer<typeof updatePrixClientSchema>;
export type CreateLotProduitInput = z.infer<typeof createLotProduitSchema>;
export type CreateMouvementProduitServiceInput = z.infer<typeof createMouvementProduitServiceSchema>;
export type CreateDevisInput = z.infer<typeof createDevisSchema>;
export type UpdateDevisInput = z.infer<typeof updateDevisSchema>;
export type CreateCommandeInput = z.infer<typeof createCommandeSchema>;
export type UpdateCommandeInput = z.infer<typeof updateCommandeSchema>;
export type CreateFactureInput = z.infer<typeof createFactureSchema>;
export type UpdateFactureInput = z.infer<typeof updateFactureSchema>;
export type CreatePaiementInput = z.infer<typeof createPaiementSchema>;
export type CreateFactureRelanceInput = z.infer<typeof createFactureRelanceSchema>;
export type CreateCommandeFournisseurInput = z.infer<typeof createCommandeFournisseurSchema>;
export type UpdateCommandeFournisseurInput = z.infer<typeof updateCommandeFournisseurSchema>;
export type ReceptionCommandeFournisseurInput = z.infer<typeof receptionCommandeFournisseurSchema>;
export type CreateFactureFournisseurInput = z.infer<typeof createFactureFournisseurSchema>;
export type UpdateFactureFournisseurInput = z.infer<typeof updateFactureFournisseurSchema>;
export type CreatePaiementFournisseurInput = z.infer<typeof createPaiementFournisseurSchema>;
export type CreateChargeInput = z.infer<typeof createChargeSchema>;
export type UpdateChargeInput = z.infer<typeof updateChargeSchema>;
export type CreatePaiementChargeInput = z.infer<typeof createPaiementChargeSchema>;
export type CreatePaiementDiversInput = z.infer<typeof createPaiementDiversSchema>;
export type UpdatePaiementDiversInput = z.infer<typeof updatePaiementDiversSchema>;
