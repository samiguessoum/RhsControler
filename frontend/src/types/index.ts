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

export interface DashboardStatsExtended {
  // Stats de base
  aPlanifier: number;
  enRetard: number;
  controles30j: number;
  contratsEnAlerte: number;
  ponctuelAlerte: number;
  contratsAnnuelsFinProche: number;
  // Stats aujourd'hui
  interventionsAujourdhui: number;
  realiseeAujourdhui: number;
  // Stats mois
  totalMois: number;
  realiseeMois: number;
  annuleeMois: number;
  enAttenteMois: number;
  tauxRealisationMois: number;
  // Tendances
  tendanceTaux: number;
  tendanceVolume: number;
  // Totaux
  totalClients: number;
  totalContrats: number;
}

export interface JourCalendrier {
  date: string;
  jour: string;
  jourComplet: string;
  count: number;
  isToday: boolean;
}

export interface DashboardStatsExtendedResponse {
  stats: DashboardStatsExtended;
  prochains7Jours: JourCalendrier[];
  moisCourant: string;
}

// Interface pour les interventions d'aujourd'hui avec employés simplifiés
// Note: utilisée par le dashboard, les employés sont inclus via la relation standard

export interface Alerte {
  id: string;
  type: 'CONTRAT_SANS_INTERVENTION' | 'PONCTUEL_FIN_PROCHE' | 'CONTRAT_HORS_VALIDITE' | 'ANNUEL_FIN_PROCHE' | string;
  message: string;
  client: { id: string; nomEntreprise: string };
  contratId: string;
  dateDebut?: string | null;
  dateFin?: string | null;
  prestations: string[];
  numeroBonCommande?: string;
  nextDate?: string | Date;
  count?: number;
  operationsRestantes?: number;
  joursRestants?: number;
  reconductionAuto?: boolean;
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
  noteServiceDefaut?: string;
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
  id?: string; // Pour la mise à jour de sites existants
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

// ============ PRODUITS/SERVICES (Dolibarr-style) ============
export type TypeProduit = 'PRODUIT' | 'SERVICE';
export type NatureProduit = 'CONSOMMABLE' | 'EPI' | 'MATERIEL_ANTI_NUISIBLES';
export type TypeMouvementPS = 'ENTREE' | 'SORTIE' | 'AJUSTEMENT' | 'TRANSFERT' | 'INVENTAIRE';

// Catégorie de produit
export interface CategorieProduit {
  id: string;
  code?: string;
  nom: string;
  description?: string;
  parentId?: string;
  parent?: { id: string; nom: string };
  enfants?: CategorieProduit[];
  couleur?: string;
  icone?: string;
  ordre: number;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    produits: number;
    enfants: number;
  };
}

// Entrepôt
export interface Entrepot {
  id: string;
  code: string;
  nom: string;
  description?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  pays?: string;
  responsable?: string;
  tel?: string;
  email?: string;
  estDefaut: boolean;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    stocks: number;
  };
}

// Stock par entrepôt
export interface StockEntrepot {
  id: string;
  produitId: string;
  entrepotId: string;
  entrepot?: { id: string; code: string; nom: string };
  quantite: number;
  emplacement?: string;
  createdAt: string;
  updatedAt: string;
}

// Produit/Service
export interface ProduitService {
  id: string;
  reference: string;
  codeBarres?: string;
  nom: string;
  description?: string;
  descriptionLongue?: string;

  type: TypeProduit;
  nature?: NatureProduit;

  unite: string;
  uniteAchat?: string;
  ratioUnites?: number;

  prixVenteHT?: number;
  tauxTVA?: number;
  prixVenteTTC?: number;
  prixAchatHT?: number;
  margeParDefaut?: number;

  aStock: boolean;
  quantite: number;
  stockMinimum: number;
  stockMaximum?: number;
  lotSuivi: boolean;
  dlcSuivi: boolean;

  dureeService?: number;

  fournisseurId?: string;
  fournisseur?: { id: string; nomEntreprise: string; code?: string };
  delaiLivraison?: number;

  marque?: string;
  modele?: string;
  poids?: number;
  longueur?: number;
  largeur?: number;
  hauteur?: number;

  compteVente?: string;
  compteAchat?: string;

  notePublique?: string;
  notePrivee?: string;
  urlExterne?: string;

  enVente: boolean;
  enAchat: boolean;
  actif: boolean;
  createdAt: string;
  updatedAt: string;

  categories?: {
    categorie: { id: string; nom: string; couleur?: string };
  }[];
  fournisseursDefaut?: ProduitFournisseurDefaut[];
  prixFournisseurs?: PrixFournisseur[];
  prixClients?: PrixClient[];
  stocks?: StockEntrepot[];
  lots?: LotProduit[];
  mouvements?: MouvementStockPS[];

  _count?: {
    prixFournisseurs: number;
    prixClients: number;
    stocks: number;
  };
}

// Fournisseur par défaut (avec ordre de préférence)
export interface ProduitFournisseurDefaut {
  id: string;
  produitId: string;
  fournisseurId: string;
  fournisseur?: { id: string; nomEntreprise: string; code?: string };
  ordre: number;
  createdAt: string;
}

// Prix fournisseur
export interface PrixFournisseur {
  id: string;
  produitId: string;
  produit?: { id: string; reference: string; nom: string };
  fournisseurId: string;
  fournisseur?: { id: string; nomEntreprise: string; code?: string };
  refFournisseur?: string;
  prixAchatHT: number;
  remise?: number;
  quantiteMin?: number;
  delaiLivraison?: number;
  dateDebut?: string;
  dateFin?: string;
  estDefaut: boolean;
  notes?: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

// Prix client
export interface PrixClient {
  id: string;
  produitId: string;
  produit?: { id: string; reference: string; nom: string };
  clientId: string;
  client?: { id: string; nomEntreprise: string; code?: string };
  prixVenteHT: number;
  remise?: number;
  quantiteMin?: number;
  dateDebut?: string;
  dateFin?: string;
  notes?: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

// Lot de produit
export interface LotProduit {
  id: string;
  produitId: string;
  numeroLot: string;
  quantite: number;
  datePeremption?: string;
  dateFabrication?: string;
  notes?: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mouvement de stock (nouveau modèle)
export interface MouvementStockPS {
  id: string;
  produitServiceId?: string;
  produitService?: { id: string; reference: string; nom: string; unite: string };
  entrepotId?: string;
  entrepot?: { id: string; code: string; nom: string };
  entrepotDestId?: string;
  type: TypeMouvementPS;
  quantite: number;
  quantiteAvant: number;
  quantiteApres: number;
  motif?: string;
  numeroLot?: string;
  interventionId?: string;
  userId: string;
  user?: { id: string; nom: string; prenom: string };
  createdAt: string;
}

// Inputs
export interface CreateProduitServiceInput {
  reference: string;
  codeBarres?: string;
  nom: string;
  description?: string;
  descriptionLongue?: string;
  type?: TypeProduit;
  nature?: NatureProduit;
  unite?: string;
  uniteAchat?: string;
  ratioUnites?: number;
  prixVenteHT?: number;
  tauxTVA?: number;
  prixAchatHT?: number;
  margeParDefaut?: number;
  aStock?: boolean;
  quantite?: number;
  stockMinimum?: number;
  stockMaximum?: number;
  lotSuivi?: boolean;
  dlcSuivi?: boolean;
  dureeService?: number;
  fournisseurId?: string;  // Deprecated: use fournisseursDefaut
  fournisseursDefaut?: { fournisseurId: string; ordre: number }[];
  delaiLivraison?: number;
  marque?: string;
  modele?: string;
  poids?: number;
  longueur?: number;
  largeur?: number;
  hauteur?: number;
  compteVente?: string;
  compteAchat?: string;
  notePublique?: string;
  notePrivee?: string;
  urlExterne?: string;
  enVente?: boolean;
  enAchat?: boolean;
  categorieIds?: string[];
}

export interface CreateCategorieProduitInput {
  code?: string;
  nom: string;
  description?: string;
  parentId?: string;
  couleur?: string;
  icone?: string;
  ordre?: number;
}

export interface CreateEntrepotInput {
  code: string;
  nom: string;
  description?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  pays?: string;
  responsable?: string;
  tel?: string;
  email?: string;
  estDefaut?: boolean;
}

export interface CreatePrixFournisseurInput {
  produitId: string;
  fournisseurId: string;
  refFournisseur?: string;
  prixAchatHT: number;
  remise?: number;
  quantiteMin?: number;
  delaiLivraison?: number;
  dateDebut?: string;
  dateFin?: string;
  estDefaut?: boolean;
  notes?: string;
}

export interface CreatePrixClientInput {
  produitId: string;
  clientId: string;
  prixVenteHT: number;
  remise?: number;
  quantiteMin?: number;
  dateDebut?: string;
  dateFin?: string;
  notes?: string;
}

export interface CreateMouvementPSInput {
  type: TypeMouvementPS;
  quantite: number;
  entrepotId?: string;
  entrepotDestId?: string;
  motif?: string;
  numeroLot?: string;
  interventionId?: string;
}

// Stats
export interface ProduitsServicesStats {
  totalProduits: number;
  totalServices: number;
  produitsActifs: number;
  servicesActifs: number;
  stockBas: number;
  totalCategories: number;
  totalEntrepots: number;
  mouvementsRecents: number;
}

export interface ProduitServiceAlerte extends ProduitService {
  deficit: number;
}

// ============ COMMERCE ============

export type DevisStatut = 'BROUILLON' | 'VALIDE' | 'SIGNE' | 'REFUSE' | 'EXPIRE' | 'ANNULE';
export type CommandeStatut = 'BROUILLON' | 'VALIDEE' | 'EN_PREPARATION' | 'EXPEDIEE' | 'LIVREE' | 'ANNULEE';
export type FactureStatut = 'BROUILLON' | 'VALIDEE' | 'EN_RETARD' | 'PARTIELLEMENT_PAYEE' | 'PAYEE' | 'ANNULEE';
export type FactureType = 'FACTURE' | 'AVOIR';
export type PaiementStatut = 'RECU' | 'ANNULE';

export interface CommerceLigne {
  id?: string;
  produitServiceId?: string;
  produitService?: { id: string; nom: string; reference?: string };
  libelle: string;
  description?: string;
  quantite: number;
  unite?: string;
  prixUnitaireHT: number;
  tauxTVA: number;
  remisePct?: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  ordre?: number;
}

export type TypeDocument = 'PRODUIT' | 'SERVICE';

export interface Devis {
  id: string;
  ref: string;
  clientId: string;
  client?: { id: string; nomEntreprise: string; code?: string };
  siteId?: string;
  site?: { id: string; nom: string; ville?: string };
  typeDocument?: TypeDocument;
  dateDevis: string;
  dateValidite?: string;
  statut: DevisStatut;
  remiseGlobalPct?: number;
  remiseGlobalMontant?: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  devise?: string;
  notes?: string;
  conditions?: string;
  lignes?: CommerceLigne[];
}

export interface Commande {
  id: string;
  ref: string;
  clientId: string;
  client?: { id: string; nomEntreprise: string; code?: string; siegeAdresse?: string; siegeVille?: string; siegeTel?: string; siegeEmail?: string };
  siteId?: string;
  site?: { id: string; nom: string; ville?: string };
  typeDocument?: TypeDocument;
  devisId?: string;
  devis?: { id: string; ref: string };
  dateCommande: string;
  dateLivraisonSouhaitee?: string;
  refBonCommandeClient?: string;
  statut: CommandeStatut;
  remiseGlobalPct?: number;
  remiseGlobalMontant?: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  devise?: string;
  notes?: string;
  conditions?: string;
  lignes?: CommerceLigne[];
  createdBy?: { id: string; nom: string; prenom: string };
}

export interface Facture {
  id: string;
  ref: string;
  clientId: string;
  client?: { id: string; nomEntreprise: string; code?: string };
  devisId?: string;
  commandeId?: string;
  dateFacture: string;
  dateEcheance?: string;
  delaiPaiementJours?: number;
  type: FactureType;
  statut: FactureStatut;
  remiseGlobalPct?: number;
  remiseGlobalMontant?: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  totalPaye: number;
  devise?: string;
  notes?: string;
  conditions?: string;
  lignes?: CommerceLigne[];
  paiements?: Paiement[];
  relances?: FactureRelance[];
}

export interface Paiement {
  id: string;
  factureId: string;
  modePaiementId?: string;
  datePaiement: string;
  montant: number;
  reference?: string;
  notes?: string;
  statut: PaiementStatut;
}

export interface CreateDevisInput {
  clientId: string;
  siteId?: string;
  typeDocument?: TypeDocument;
  adresseFacturationId?: string;
  adresseLivraisonId?: string;
  dateDevis?: string;
  dateValidite?: string;
  statut?: DevisStatut;
  remiseGlobalPct?: number;
  remiseGlobalMontant?: number;
  devise?: string;
  notes?: string;
  conditions?: string;
  lignes: Array<{
    produitServiceId?: string;
    libelle?: string;
    description?: string;
    quantite: number;
    unite?: string;
    prixUnitaireHT?: number;
    tauxTVA?: number;
    remisePct?: number;
    ordre?: number;
  }>;
}

export type CreateCommandeInput = Omit<CreateDevisInput, 'statut' | 'dateDevis' | 'dateValidite'> & {
  devisId?: string;
  dateCommande?: string;
  dateLivraisonSouhaitee?: string;
  statut?: CommandeStatut;
};

export type CreateFactureInput = Omit<CreateDevisInput, 'statut' | 'dateDevis' | 'dateValidite'> & {
  devisId?: string;
  commandeId?: string;
  dateFacture?: string;
  dateEcheance?: string;
  delaiPaiementJours?: number;
  statut?: FactureStatut;
  type?: FactureType;
};

export interface FactureRelance {
  id: string;
  factureId: string;
  niveau: number;
  canal: 'EMAIL' | 'SMS' | 'COURRIER' | 'APPEL';
  commentaire?: string;
  dateRelance: string;
  createdBy?: { id: string; nom: string; prenom: string };
}

export interface CreateFactureRelanceInput {
  niveau?: number;
  canal: 'EMAIL' | 'SMS' | 'COURRIER' | 'APPEL';
  commentaire?: string;
  dateRelance?: string;
}

export interface CreatePaiementInput {
  factureId: string;
  modePaiementId?: string;
  datePaiement?: string;
  montant: number;
  reference?: string;
  notes?: string;
}

// ============ COMMANDES FOURNISSEURS ============

export type CommandeFournisseurStatut = 'BROUILLON' | 'ENVOYEE' | 'CONFIRMEE' | 'EN_RECEPTION' | 'RECUE' | 'ANNULEE';

export interface CommandeFournisseurLigne {
  id: string;
  commandeFournisseurId: string;
  produitServiceId?: string;
  produitService?: {
    id: string;
    nom: string;
    reference: string;
  };
  libelle: string;
  description?: string;
  quantite: number;
  unite?: string;
  prixUnitaireHT: number;
  tauxTVA: number;
  remisePct?: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  quantiteRecue: number;
  ordre: number;
}

export interface CommandeFournisseur {
  id: string;
  ref: string;
  fournisseurId: string;
  fournisseur?: {
    id: string;
    nomEntreprise: string;
    code?: string;
  };
  dateCommande: string;
  dateLivraisonSouhaitee?: string;
  dateLivraison?: string;
  statut: CommandeFournisseurStatut;
  remiseGlobalPct?: number;
  remiseGlobalMontant?: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  devise?: string;
  notes?: string;
  conditions?: string;
  lignes?: CommandeFournisseurLigne[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    lignes: number;
  };
}

export interface CreateCommandeFournisseurLigneInput {
  produitServiceId?: string;
  libelle?: string;
  description?: string;
  quantite: number;
  unite?: string;
  prixUnitaireHT?: number;
  tauxTVA?: number;
  remisePct?: number;
  quantiteRecue?: number;
  ordre?: number;
}

export interface CreateCommandeFournisseurInput {
  fournisseurId: string;
  dateCommande?: string;
  dateLivraisonSouhaitee?: string;
  statut?: CommandeFournisseurStatut;
  remiseGlobalPct?: number;
  remiseGlobalMontant?: number;
  devise?: string;
  notes?: string;
  conditions?: string;
  lignes: CreateCommandeFournisseurLigneInput[];
}

export interface ReceptionLigneInput {
  id: string;
  quantiteRecue: number;
}

export interface ReceptionCommandeFournisseurInput {
  dateLivraison?: string;
  lignes?: ReceptionLigneInput[];
}

// ============ FACTURATION ============

export type FactureFournisseurStatut = 'BROUILLON' | 'VALIDEE' | 'EN_RETARD' | 'PARTIELLEMENT_PAYEE' | 'PAYEE' | 'ANNULEE';

export interface FactureFournisseurLigne {
  id: string;
  factureFournisseurId: string;
  produitServiceId?: string;
  produitService?: {
    id: string;
    nom: string;
    reference: string;
  };
  libelle: string;
  description?: string;
  quantite: number;
  unite?: string;
  prixUnitaireHT: number;
  tauxTVA: number;
  remisePct?: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  ordre: number;
}

export interface PaiementFournisseur {
  id: string;
  factureFournisseurId: string;
  modePaiementId?: string;
  datePaiement: string;
  montant: number;
  reference?: string;
  banque?: string;
  notes?: string;
  statut: 'RECU' | 'ANNULE';
}

export interface FactureFournisseur {
  id: string;
  ref: string;
  refFournisseur?: string;
  fournisseurId: string;
  fournisseur?: { id: string; nomEntreprise: string; code?: string };
  commandeFournisseurId?: string;
  dateFacture: string;
  dateEcheance?: string;
  dateReception?: string;
  statut: FactureFournisseurStatut;
  remiseGlobalPct?: number;
  remiseGlobalMontant?: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  totalPaye: number;
  devise?: string;
  notes?: string;
  conditions?: string;
  lignes?: FactureFournisseurLigne[];
  paiements?: PaiementFournisseur[];
  _count?: { lignes: number; paiements: number };
}

export interface CreateFactureFournisseurLigneInput {
  produitServiceId?: string;
  libelle?: string;
  description?: string;
  quantite: number;
  unite?: string;
  prixUnitaireHT?: number;
  tauxTVA?: number;
  remisePct?: number;
  ordre?: number;
}

export interface CreateFactureFournisseurInput {
  fournisseurId: string;
  commandeFournisseurId?: string;
  refFournisseur?: string;
  dateFacture?: string;
  dateEcheance?: string;
  dateReception?: string;
  statut?: FactureFournisseurStatut;
  remiseGlobalPct?: number;
  remiseGlobalMontant?: number;
  devise?: string;
  notes?: string;
  conditions?: string;
  lignes: CreateFactureFournisseurLigneInput[];
}

export interface CreatePaiementFournisseurInput {
  modePaiementId?: string;
  datePaiement?: string;
  montant: number;
  reference?: string;
  banque?: string;
  notes?: string;
}

export type TypeCharge = 'FOURNISSEUR' | 'FISCALE' | 'SOCIALE' | 'DIVERSE';
export type ChargeStatut = 'A_PAYER' | 'PARTIELLEMENT_PAYEE' | 'PAYEE' | 'ANNULEE';

export interface Charge {
  id: string;
  ref: string;
  typeCharge: TypeCharge;
  libelle: string;
  description?: string;
  fournisseurId?: string;
  fournisseur?: { id: string; nomEntreprise: string; code?: string };
  categorie?: string;
  sousCategorie?: string;
  dateCharge: string;
  dateEcheance?: string;
  periodeDebut?: string;
  periodeFin?: string;
  montantHT: number;
  tauxTVA: number;
  montantTVA: number;
  montantTTC: number;
  montantPaye: number;
  devise?: string;
  statut: ChargeStatut;
  estRecurrente?: boolean;
  frequenceRecurrence?: string;
  notes?: string;
  paiements?: PaiementCharge[];
}

export interface PaiementCharge {
  id: string;
  chargeId: string;
  modePaiementId?: string;
  datePaiement: string;
  montant: number;
  reference?: string;
  banque?: string;
  notes?: string;
  statut: 'RECU' | 'ANNULE';
}

export interface CreateChargeInput {
  typeCharge: TypeCharge;
  libelle: string;
  description?: string;
  fournisseurId?: string;
  categorie?: string;
  sousCategorie?: string;
  dateCharge?: string;
  dateEcheance?: string;
  periodeDebut?: string;
  periodeFin?: string;
  montantHT?: number;
  tauxTVA?: number;
  devise?: string;
  estRecurrente?: boolean;
  frequenceRecurrence?: string;
  notes?: string;
}

export interface CreatePaiementChargeInput {
  modePaiementId?: string;
  datePaiement?: string;
  montant: number;
  reference?: string;
  banque?: string;
  notes?: string;
}

export type TypePaiementDivers = 'ENCAISSEMENT' | 'DECAISSEMENT';

export interface PaiementDivers {
  id: string;
  ref: string;
  libelle: string;
  description?: string;
  typeOperation: TypePaiementDivers;
  categorie?: string;
  tiersId?: string;
  tiers?: { id: string; nomEntreprise: string; code?: string };
  montant: number;
  devise?: string;
  datePaiement: string;
  modePaiementId?: string;
  reference?: string;
  banque?: string;
  notes?: string;
  statut: string;
}

export interface CreatePaiementDiversInput {
  libelle: string;
  description?: string;
  typeOperation: TypePaiementDivers;
  categorie?: string;
  tiersId?: string;
  montant: number;
  devise?: string;
  datePaiement?: string;
  modePaiementId?: string;
  reference?: string;
  banque?: string;
  notes?: string;
}

// ============ SETTINGS (Company Configuration) ============

export interface CompanySettings {
  id: string;

  // Informations générales
  nomEntreprise: string;
  formeJuridique?: string;
  logoPath?: string;
  logoCarrePath?: string;

  // Coordonnées
  adresse?: string;
  codePostal?: string;
  ville?: string;
  pays?: string;
  telephone?: string;
  fax?: string;
  email?: string;
  siteWeb?: string;

  // Informations légales
  rc?: string;
  nif?: string;
  ai?: string;
  nis?: string;
  compteBancaire?: string;
  rib?: string;
  banque?: string;

  // Paramètres commerciaux
  devisePrincipale: string;
  tauxTVADefaut: number;

  // Préfixes de numérotation - Documents vente
  prefixDevis: string;
  prefixCommande: string;
  prefixFacture: string;
  prefixAvoir: string;

  // Préfixes de numérotation - Documents achat
  prefixCommandeFournisseur: string;
  prefixFactureFournisseur: string;
  prefixCharge: string;

  // Préfixes de numérotation - Tiers
  prefixClient: string;
  prefixFournisseur: string;
  prefixProspect: string;

  // Préfixes de numérotation - Autres
  prefixProduit: string;
  prefixService: string;

  // Format numérotation
  longueurNumero: number;
  inclureAnnee: boolean;
  separateur: string;

  createdAt: string;
  updatedAt: string;
}

export interface UpdateCompanySettingsInput {
  // Informations générales
  nomEntreprise?: string;
  formeJuridique?: string;
  logoPath?: string;
  logoCarrePath?: string;

  // Coordonnées
  adresse?: string;
  codePostal?: string;
  ville?: string;
  pays?: string;
  telephone?: string;
  fax?: string;
  email?: string;
  siteWeb?: string;

  // Informations légales
  rc?: string;
  nif?: string;
  ai?: string;
  nis?: string;
  compteBancaire?: string;
  rib?: string;
  banque?: string;

  // Paramètres commerciaux
  devisePrincipale?: string;
  tauxTVADefaut?: number;

  // Préfixes de numérotation - Documents vente
  prefixDevis?: string;
  prefixCommande?: string;
  prefixFacture?: string;
  prefixAvoir?: string;

  // Préfixes de numérotation - Documents achat
  prefixCommandeFournisseur?: string;
  prefixFactureFournisseur?: string;
  prefixCharge?: string;

  // Préfixes de numérotation - Tiers
  prefixClient?: string;
  prefixFournisseur?: string;
  prefixProspect?: string;

  // Préfixes de numérotation - Autres
  prefixProduit?: string;
  prefixService?: string;

  // Format numérotation
  longueurNumero?: number;
  inclureAnnee?: boolean;
  separateur?: string;
}
