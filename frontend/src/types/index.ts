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

export interface Site {
  id: string;
  clientId: string;
  nom: string;
  adresse?: string;
  contactNom?: string;
  contactFonction?: string;
  tel?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteInput {
  nom: string;
  adresse?: string;
  contactNom?: string;
  contactFonction?: string;
  tel?: string;
  email?: string;
  notes?: string;
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
