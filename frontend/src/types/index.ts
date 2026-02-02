// ============ ENUMS ============
export type Role = 'DIRECTION' | 'PLANNING' | 'EQUIPE' | 'LECTURE';
export type ContratType = 'ANNUEL' | 'PONCTUEL';
export type ContratStatut = 'ACTIF' | 'SUSPENDU' | 'TERMINE';
export type Frequence = 'HEBDOMADAIRE' | 'MENSUELLE' | 'TRIMESTRIELLE' | 'SEMESTRIELLE' | 'ANNUELLE' | 'PERSONNALISEE';
export type InterventionType = 'OPERATION' | 'CONTROLE' | 'RECLAMATION' | 'PREMIERE_VISITE' | 'DEPLACEMENT_COMMERCIAL';
export type InterventionStatut = 'A_PLANIFIER' | 'PLANIFIEE' | 'REALISEE' | 'REPORTEE' | 'ANNULEE';

// ============ USER ============
export interface User {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  tel?: string;
  role: Role;
  actif: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Employe {
  id: string;
  prenom: string;
  nom: string;
  postes: Poste[];
  createdAt: string;
  updatedAt: string;
}

export interface Poste {
  id: string;
  nom: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InterventionEmploye {
  id: string;
  interventionId: string;
  employeId: string;
  employe?: Employe;
  posteId: string;
  poste?: Poste;
  createdAt: string;
}

// ============ CLIENT ============
export interface Client {
  id: string;
  nomEntreprise: string;
  secteur?: string;
  siegeNom: string;
  siegeAdresse?: string;
  siegeTel?: string;
  siegeEmail?: string;
  siegeNotes?: string;
  siegeRC?: string;
  siegeNIF?: string;
  siegeAI?: string;
  siegeNIS?: string;
  siegeTIN?: string;
  siegeContacts?: SiegeContact[];
  sites?: Site[];
  actif: boolean;
  createdAt: string;
  updatedAt: string;
  contrats?: Contrat[];
  interventions?: Intervention[];
  _count?: {
    contrats: number;
    interventions: number;
  };
}

// ============ PRESTATION ============
export interface Prestation {
  id: string;
  nom: string;
  description?: string;
  actif: boolean;
  ordre: number;
  createdAt: string;
}

// ============ CONTRAT SITE ============
export interface ContratSite {
  id: string;
  contratId: string;
  siteId: string;
  site?: Site;
  prestations: string[];
  frequenceOperations?: Frequence;
  frequenceOperationsJours?: number;
  frequenceControle?: Frequence;
  frequenceControleJours?: number;
  premiereDateOperation?: string;
  premiereDateControle?: string;
  nombreOperations?: number;
  nombreVisitesControle?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContratSiteInput {
  siteId: string;
  prestations?: string[];
  frequenceOperations?: Frequence;
  frequenceOperationsJours?: number;
  frequenceControle?: Frequence;
  frequenceControleJours?: number;
  premiereDateOperation?: string;
  premiereDateControle?: string;
  nombreOperations?: number;
  nombreVisitesControle?: number;
  notes?: string;
}

// ============ CONTRAT ============
export interface Contrat {
  id: string;
  clientId: string;
  client?: Client;
  type: ContratType;
  dateDebut: string;
  dateFin?: string;
  reconductionAuto: boolean;
  prestations: string[];
  frequenceOperations?: Frequence;
  frequenceOperationsJours?: number;
  frequenceControle?: Frequence;
  frequenceControleJours?: number;
  premiereDateOperation?: string;
  premiereDateControle?: string;
  responsablePlanningId?: string;
  responsablePlanning?: User;
  statut: ContratStatut;
  notes?: string;
  autoCreerProchaine: boolean;
  // Ponctuel fields
  numeroBonCommande?: string;
  nombreOperations?: number;
  // Sites
  contratSites?: ContratSite[];
  createdAt: string;
  updatedAt: string;
  interventions?: Intervention[];
  _count?: {
    interventions: number;
  };
}

// ============ INTERVENTION ============
export interface PreviousIntervention {
  id: string;
  type: InterventionType;
  dateRealisee: string;
  notesTerrain: string;
}

export interface Intervention {
  id: string;
  contratId?: string;
  contrat?: Contrat;
  clientId: string;
  client?: Client;
  siteId?: string;
  site?: Site;
  type: InterventionType;
  prestation?: string;
  datePrevue: string;
  dateRealisee?: string;
  heurePrevue?: string;
  duree?: number;
  statut: InterventionStatut;
  notesTerrain?: string;
  responsable?: string;
  exporteGCal: boolean;
  createdById: string;
  createdBy?: User;
  updatedById?: string;
  updatedBy?: User;
  createdAt: string;
  updatedAt: string;
  remainingOperations?: number | null;
  remainingControles?: number | null;
  frequenceOperations?: string | null;
  frequenceControle?: string | null;
  interventionEmployes?: InterventionEmploye[];
  previousIntervention?: PreviousIntervention | null;
}

// ============ DASHBOARD ============
export interface DashboardStats {
  aPlanifier: number;
  enRetard: number;
  controles30j: number;
  contratsEnAlerte: number;
  ponctuelAlerte: number;
}

export interface Alerte {
  id: string;
  type: string;
  message: string;
  client: { id: string; nomEntreprise: string };
  contratId: string;
  dateDebut?: string | null;
  dateFin?: string | null;
  prestations: string[];
  numeroBonCommande?: string;
  nextDate?: string | Date;
  count?: number;
}

// ============ PAGINATION ============
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// ============ API RESPONSES ============
export interface ApiError {
  error: string;
  message?: string;
  details?: Array<{ field: string; message: string }>;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ImportPreviewResult {
  success: boolean;
  created: number;
  updated: number;
  errors: Array<{ row: number; field: string; message: string; value?: string }>;
  preview?: any[];
}

export interface CreateContratResponse extends Contrat {
  planning?: {
    interventionsCreees: number;
  };
}

// ============ FORM INPUTS ============
export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateClientInput {
  nomEntreprise: string;
  secteur?: string;
  siegeNom: string;
  siegeAdresse?: string;
  siegeTel?: string;
  siegeEmail?: string;
  siegeNotes?: string;
  siegeRC?: string;
  siegeNIF?: string;
  siegeAI?: string;
  siegeNIS?: string;
  siegeTIN?: string;
  siegeContacts: SiegeContactInput[];
  sites: SiteInput[];
}

export interface SiegeContact {
  id: string;
  clientId: string;
  nom: string;
  fonction: string;
  tel: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiegeContactInput {
  nom: string;
  fonction: string;
  tel: string;
  email: string;
}

export interface SiteContact {
  id: string;
  siteId: string;
  civilite?: Civilite;
  nom: string;
  prenom?: string;
  fonction?: string;
  tel?: string;
  telMobile?: string;
  email?: string;
  notes?: string;
  estPrincipal: boolean;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  clientId: string;
  code?: string;
  nom: string;
  adresse?: string;
  complement?: string;
  codePostal?: string;
  ville?: string;
  pays?: string;
  latitude?: number;
  longitude?: number;
  tel?: string;
  fax?: string;
  email?: string;
  horairesOuverture?: string;
  accessibilite?: string;
  notes?: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
  contacts?: SiteContact[];
  _count?: {
    contratSites: number;
    interventions: number;
  };
}

export interface SiteInput {
  code?: string;
  nom: string;
  adresse?: string;
  complement?: string;
  codePostal?: string;
  ville?: string;
  pays?: string;
  latitude?: number;
  longitude?: number;
  tel?: string;
  fax?: string;
  email?: string;
  horairesOuverture?: string;
  accessibilite?: string;
  notes?: string;
  contacts?: CreateSiteContactInput[];
}

export interface CreateSiteContactInput {
  civilite?: Civilite;
  nom: string;
  prenom?: string;
  fonction?: string;
  tel?: string;
  telMobile?: string;
  email?: string;
  notes?: string;
  estPrincipal?: boolean;
}

export interface CreateContratInput {
  clientId: string;
  type: ContratType;
  dateDebut: string;
  dateFin?: string;
  reconductionAuto?: boolean;
  prestations: string[];
  frequenceOperations?: Frequence;
  frequenceOperationsJours?: number;
  frequenceControle?: Frequence;
  frequenceControleJours?: number;
  premiereDateOperation?: string;
  premiereDateControle?: string;
  responsablePlanningId?: string;
  statut?: ContratStatut;
  notes?: string;
  autoCreerProchaine?: boolean;
  // Ponctuel fields
  numeroBonCommande?: string;
  nombreOperations?: number;
  // Sites
  contratSites?: ContratSiteInput[];
}

export interface InterventionEmployeInput {
  employeId: string;
  posteId: string;
}

export interface CreateInterventionInput {
  contratId?: string;
  clientId: string;
  siteId?: string;
  type: InterventionType;
  prestation?: string;
  datePrevue: string;
  heurePrevue?: string;
  duree?: number;
  statut?: InterventionStatut;
  notesTerrain?: string;
  responsable?: string;
  employes?: InterventionEmployeInput[];
}

// ============ STOCK ============
export type TypeMouvement = 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';

export interface Produit {
  id: string;
  reference: string;
  nom: string;
  description?: string;
  unite: string;
  quantite: number;
  stockMinimum: number;
  prixUnitaire?: number;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
  mouvements?: MouvementStock[];
}

export interface MouvementStock {
  id: string;
  produitId: string;
  produit?: Produit;
  type: TypeMouvement;
  quantite: number;
  quantiteAvant: number;
  quantiteApres: number;
  motif?: string;
  interventionId?: string;
  intervention?: {
    id: string;
    type: InterventionType;
    datePrevue: string;
    client?: { id: string; nomEntreprise: string };
  };
  userId: string;
  user?: { id: string; nom: string; prenom: string };
  createdAt: string;
}

export interface CreateProduitInput {
  reference: string;
  nom: string;
  description?: string;
  unite?: string;
  quantite?: number;
  stockMinimum?: number;
  prixUnitaire?: number;
}

export interface CreateMouvementInput {
  produitId: string;
  type: TypeMouvement;
  quantite: number;
  motif?: string;
  interventionId?: string;
}

export interface StockStats {
  totalProduits: number;
  produitsActifs: number;
  stockBas: number;
  mouvementsRecents: number;
}

export interface StockAlerte extends Produit {
  deficit: number;
}

// ============ RH ============
export type TypeConge = 'ANNUEL' | 'MALADIE' | 'RECUPERATION' | 'SANS_SOLDE' | 'EXCEPTIONNEL';
export type StatutConge = 'EN_ATTENTE' | 'APPROUVE' | 'REFUSE' | 'ANNULE';

export interface Conge {
  id: string;
  employeId: string;
  employe?: { id: string; nom: string; prenom: string };
  type: TypeConge;
  dateDebut: string;
  dateFin: string;
  nbJours: number;
  motif?: string;
  statut: StatutConge;
  approuveParId?: string;
  approuvePar?: { id: string; nom: string; prenom: string };
  dateReponse?: string;
  commentaire?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JourWeekendTravaille {
  id: string;
  employeId: string;
  employe?: { id: string; nom: string; prenom: string };
  date: string;
  estVendredi: boolean;
  notes?: string;
  createdAt: string;
}

export interface SoldeConge {
  id: string;
  employeId: string;
  employe?: { id: string; nom: string; prenom: string };
  annee: number;
  type: TypeConge;
  joursAcquis: number;
  joursPris: number;
  joursRestants: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCongeInput {
  employeId: string;
  type: TypeConge;
  dateDebut: string;
  dateFin: string;
  nbJours: number;
  motif?: string;
}

export interface ApprouverCongeInput {
  approuve: boolean;
  commentaire?: string;
}

export interface CreateWeekendTravailleInput {
  employeId: string;
  date: string;
  notes?: string;
}

export interface UpdateSoldeInput {
  employeId: string;
  annee: number;
  type: TypeConge;
  joursAcquis: number;
}

export interface RHDashboard {
  stats: {
    congesEnAttente: number;
    employesEnConge: number;
    totalEmployes: number;
  };
  congesEnCours: Conge[];
  employesAvecRecup: SoldeConge[];
}

export interface EmployeRecap {
  employe: Employe;
  annee: number;
  soldes: SoldeConge[];
  conges: Conge[];
  weekendsTravailles: JourWeekendTravaille[];
  stats: {
    totalWeekendsTravailles: number;
    joursRecupAcquis: number;
  };
}

// ============ TIERS (Dolibarr-style) ============
export type TypeTiers = 'CLIENT' | 'FOURNISSEUR' | 'PROSPECT' | 'CLIENT_FOURNISSEUR';
export type FormeJuridique = 'SARL' | 'EURL' | 'SPA' | 'SNC' | 'AUTO_ENTREPRENEUR' | 'ASSOCIATION' | 'PARTICULIER' | 'AUTRE';
export type Civilite = 'M' | 'MME' | 'MLLE';
export type TypeAdresse = 'SIEGE' | 'FACTURATION' | 'LIVRAISON' | 'SITE';

export interface ModePaiement {
  id: string;
  code: string;
  libelle: string;
  actif: boolean;
  ordre: number;
  createdAt: string;
}

export interface ConditionPaiement {
  id: string;
  code: string;
  libelle: string;
  nbJours: number;
  actif: boolean;
  ordre: number;
  createdAt: string;
}

export interface Contact {
  id: string;
  clientId: string;
  civilite?: Civilite;
  nom: string;
  prenom?: string;
  fonction: string;
  tel?: string;
  telMobile?: string;
  fax?: string;
  email?: string;
  dateNaissance?: string;
  notes?: string;
  estPrincipal: boolean;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Adresse {
  id: string;
  clientId: string;
  type: TypeAdresse;
  libelle?: string;
  adresse?: string;
  complement?: string;
  codePostal?: string;
  ville?: string;
  pays?: string;
  contactNom?: string;
  contactTel?: string;
  contactEmail?: string;
  estDefaut: boolean;
  notes?: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompteBancaire {
  id: string;
  clientId: string;
  libelle: string;
  banque: string;
  agence?: string;
  codeBanque?: string;
  codeGuichet?: string;
  numeroCompte?: string;
  cleRib?: string;
  iban?: string;
  bic?: string;
  titulaire?: string;
  devise?: string;
  estDefaut: boolean;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tiers {
  id: string;
  code?: string;
  nomEntreprise: string;
  nomAlias?: string;
  typeTiers: TypeTiers;

  // Informations légales
  formeJuridique?: FormeJuridique;
  siegeRC?: string;
  siegeNIF?: string;
  siegeAI?: string;
  siegeNIS?: string;
  siegeTIN?: string;
  tvaIntracom?: string;
  capital?: number;
  dateCreation?: string;

  // Siège social
  siegeNom: string;
  siegeAdresse?: string;
  siegeCodePostal?: string;
  siegeVille?: string;
  siegePays?: string;
  siegeTel?: string;
  siegeFax?: string;
  siegeEmail?: string;
  siegeWebsite?: string;
  siegeNotes?: string;

  // Classification
  secteur?: string;
  categorie?: string;
  codeComptaClient?: string;
  codeComptaFournisseur?: string;

  // Conditions commerciales
  modePaiementId?: string;
  modePaiement?: ModePaiement;
  conditionPaiementId?: string;
  conditionPaiement?: ConditionPaiement;
  remiseParDefaut?: number;
  encoursMaximum?: number;

  // Devises
  devise?: string;

  // Notes
  notePublique?: string;
  notePrivee?: string;

  // Prospect
  prospectNiveau?: number;
  prospectStatut?: string;

  // Statut
  actif: boolean;
  createdAt: string;
  updatedAt: string;

  // Relations
  siegeContacts?: Contact[];
  sites?: Site[];
  adresses?: Adresse[];
  comptesBancaires?: CompteBancaire[];
  contrats?: Contrat[];
  interventions?: Intervention[];

  _count?: {
    contrats: number;
    interventions: number;
    comptesBancaires: number;
  };
}

export interface CreateTiersInput {
  code?: string;
  nomEntreprise: string;
  nomAlias?: string;
  typeTiers?: TypeTiers;

  formeJuridique?: FormeJuridique;
  siegeRC?: string;
  siegeNIF?: string;
  siegeAI?: string;
  siegeNIS?: string;
  siegeTIN?: string;
  tvaIntracom?: string;
  capital?: number;
  dateCreation?: string;

  siegeNom?: string;
  siegeAdresse?: string;
  siegeCodePostal?: string;
  siegeVille?: string;
  siegePays?: string;
  siegeTel?: string;
  siegeFax?: string;
  siegeEmail?: string;
  siegeWebsite?: string;
  siegeNotes?: string;

  secteur?: string;
  categorie?: string;
  codeComptaClient?: string;
  codeComptaFournisseur?: string;

  modePaiementId?: string;
  conditionPaiementId?: string;
  remiseParDefaut?: number;
  encoursMaximum?: number;

  devise?: string;

  notePublique?: string;
  notePrivee?: string;

  prospectNiveau?: number;
  prospectStatut?: string;

  contacts?: CreateContactInput[];
  sites?: SiteInput[];
  adresses?: CreateAdresseInput[];
  comptesBancaires?: CreateCompteBancaireInput[];
}

export interface CreateContactInput {
  civilite?: Civilite;
  nom: string;
  prenom?: string;
  fonction?: string;
  tel?: string;
  telMobile?: string;
  fax?: string;
  email?: string;
  dateNaissance?: string;
  notes?: string;
  estPrincipal?: boolean;
}

export interface CreateAdresseInput {
  type?: TypeAdresse;
  libelle?: string;
  adresse?: string;
  complement?: string;
  codePostal?: string;
  ville?: string;
  pays?: string;
  contactNom?: string;
  contactTel?: string;
  contactEmail?: string;
  estDefaut?: boolean;
  notes?: string;
}

export interface CreateCompteBancaireInput {
  libelle: string;
  banque: string;
  agence?: string;
  codeBanque?: string;
  codeGuichet?: string;
  numeroCompte?: string;
  cleRib?: string;
  iban?: string;
  bic?: string;
  titulaire?: string;
  devise?: string;
  estDefaut?: boolean;
}

export interface TiersStats {
  clients: { total: number; actifs: number };
  fournisseurs: { total: number; actifs: number };
  prospects: { total: number; actifs: number };
}
