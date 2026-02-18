import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import type {
  User,
  Client,
  Contrat,
  Intervention,
  Prestation,
  DashboardStats,
  Alerte,
  LoginResponse,
  ImportPreviewResult,
  CreateClientInput,
  CreateContratInput,
  CreateContratResponse,
  CreateInterventionInput,
  Employe,
  Poste,
  Produit,
  MouvementStock,
  CreateProduitInput,
  CreateMouvementInput,
  StockStats,
  StockAlerte,
  Conge,
  JourWeekendTravaille,
  SoldeConge,
  CreateCongeInput,
  ApprouverCongeInput,
  CreateWeekendTravailleInput,
  UpdateSoldeInput,
  RHDashboard,
  EmployeRecap,
  // Tiers
  Tiers,
  Contact,
  Adresse,
  CompteBancaire,
  ModePaiement,
  ConditionPaiement,
  CreateTiersInput,
  CreateContactInput,
  CreateAdresseInput,
  CreateCompteBancaireInput,
  TiersStats,
  TypeTiers,
  // Produits/Services
  ProduitService,
  CategorieProduit,
  Entrepot,
  PrixFournisseur,
  PrixClient,
  MouvementStockPS,
  CreateProduitServiceInput,
  CreateCategorieProduitInput,
  CreateEntrepotInput,
  CreatePrixFournisseurInput,
  CreatePrixClientInput,
  CreateMouvementPSInput,
  ProduitsServicesStats,
  ProduitServiceAlerte,
  TypeProduit,
  // Commerce
  Devis,
  Commande,
  Facture,
  Paiement,
  CreateDevisInput,
  CreateCommandeInput,
  CreateFactureInput,
  CreatePaiementInput,
  FactureType,
  FactureRelance,
  CreateFactureRelanceInput,
  // Commandes Fournisseurs
  CommandeFournisseur,
  CreateCommandeFournisseurInput,
  ReceptionCommandeFournisseurInput,
  CommandeFournisseurStatut,
  // Facturation
  FactureFournisseur,
  FactureFournisseurStatut,
  CreateFactureFournisseurInput,
  CreatePaiementFournisseurInput,
  Charge,
  TypeCharge,
  ChargeStatut,
  CreateChargeInput,
  CreatePaiementChargeInput,
  PaiementDivers,
  CreatePaiementDiversInput,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============ AUTH ============
export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  me: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data.user;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },
};

// ============ USERS ============
export const usersApi = {
  list: async (): Promise<User[]> => {
    const { data } = await api.get('/users');
    return data.users;
  },

  get: async (id: string): Promise<User> => {
    const { data } = await api.get(`/users/${id}`);
    return data.user;
  },

  create: async (userData: Partial<User> & { password: string }): Promise<User> => {
    const { data } = await api.post('/users', userData);
    return data.user;
  },

  update: async (id: string, userData: Partial<User>): Promise<User> => {
    const { data } = await api.put(`/users/${id}`, userData);
    return data.user;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

// ============ EMPLOYES ============
export const employesApi = {
  list: async (): Promise<Employe[]> => {
    const { data } = await api.get('/employes');
    return data.employes;
  },

  get: async (id: string): Promise<Employe> => {
    const { data } = await api.get(`/employes/${id}`);
    return data.employe;
  },

  create: async (payload: { prenom: string; nom: string; posteIds: string[] }): Promise<Employe> => {
    const { data } = await api.post('/employes', payload);
    return data.employe;
  },

  update: async (id: string, payload: Partial<{ prenom: string; nom: string; posteIds: string[] }>): Promise<Employe> => {
    const { data } = await api.put(`/employes/${id}`, payload);
    return data.employe;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/employes/${id}`);
  },
};

// ============ POSTES ============
export const postesApi = {
  list: async (actif?: boolean): Promise<Poste[]> => {
    const { data } = await api.get('/postes', { params: { actif } });
    return data.postes;
  },

  get: async (id: string): Promise<Poste> => {
    const { data } = await api.get(`/postes/${id}`);
    return data.poste;
  },

  create: async (payload: { nom: string }): Promise<Poste> => {
    const { data } = await api.post('/postes', payload);
    return data.poste;
  },

  update: async (id: string, payload: Partial<{ nom: string; actif: boolean }>): Promise<Poste> => {
    const { data } = await api.put(`/postes/${id}`, payload);
    return data.poste;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/postes/${id}`);
  },
};

// ============ CLIENTS ============
export const clientsApi = {
  list: async (params?: { search?: string; actif?: boolean; page?: number; limit?: number }) => {
    const { data } = await api.get('/clients', { params });
    return { clients: data.clients as Client[], pagination: data.pagination };
  },

  get: async (id: string): Promise<Client> => {
    const { data } = await api.get(`/clients/${id}`);
    return data.client;
  },

  create: async (clientData: CreateClientInput): Promise<Client> => {
    const { data } = await api.post('/clients', clientData);
    return data.client;
  },

  update: async (id: string, clientData: Partial<CreateClientInput & { actif: boolean }>): Promise<Client> => {
    const { data } = await api.put(`/clients/${id}`, clientData);
    return data.client;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/clients/${id}`);
  },
};

// ============ PRESTATIONS ============
export const prestationsApi = {
  list: async (actif?: boolean): Promise<Prestation[]> => {
    const { data } = await api.get('/prestations', { params: { actif } });
    return data.prestations;
  },

  create: async (payload: { nom: string; ordre?: number; description?: string }): Promise<Prestation> => {
    const { data } = await api.post('/prestations', payload);
    return data.prestation;
  },

  update: async (
    id: string,
    updates: { nom?: string; ordre?: number; description?: string; actif?: boolean }
  ): Promise<Prestation> => {
    const { data } = await api.put(`/prestations/${id}`, updates);
    return data.prestation;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/prestations/${id}`);
  },
};

// ============ CONTRATS ============
export const contratsApi = {
  list: async (params?: { clientId?: string; statut?: string; type?: string; page?: number; limit?: number }) => {
    const { data } = await api.get('/contrats', { params });
    return { contrats: data.contrats as Contrat[], pagination: data.pagination };
  },

  get: async (id: string): Promise<Contrat> => {
    const { data } = await api.get(`/contrats/${id}`);
    return data.contrat;
  },

  create: async (contratData: CreateContratInput): Promise<CreateContratResponse> => {
    const { data } = await api.post('/contrats', contratData);
    return { ...data.contrat, planning: data.planning };
  },

  update: async (id: string, contratData: Partial<CreateContratInput>): Promise<Contrat> => {
    const { data } = await api.put(`/contrats/${id}`, contratData);
    return data.contrat;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/contrats/${id}`);
  },
};

// ============ INTERVENTIONS ============
export const interventionsApi = {
  list: async (params?: {
    clientId?: string;
    contratId?: string;
    type?: string;
    statut?: string;
    prestation?: string;
    dateDebut?: string;
    dateFin?: string;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get('/interventions', { params });
    return { interventions: data.interventions as Intervention[], pagination: data.pagination };
  },

  aPlanifier: async (days?: number): Promise<Intervention[]> => {
    const { data } = await api.get('/interventions/a-planifier', { params: { days } });
    return data.interventions;
  },

  enRetard: async (): Promise<Intervention[]> => {
    const { data } = await api.get('/interventions/en-retard');
    return data.interventions;
  },

  semaine: async (): Promise<Intervention[]> => {
    const { data } = await api.get('/interventions/semaine');
    return data.interventions;
  },

  get: async (id: string): Promise<Intervention> => {
    const { data } = await api.get(`/interventions/${id}`);
    return data.intervention;
  },

  create: async (interventionData: CreateInterventionInput): Promise<Intervention> => {
    const { data } = await api.post('/interventions', interventionData);
    return data.intervention;
  },

  update: async (id: string, interventionData: Partial<CreateInterventionInput>): Promise<Intervention> => {
    const { data } = await api.put(`/interventions/${id}`, interventionData);
    return data.intervention;
  },

  realiser: async (id: string, options?: { notesTerrain?: string; creerProchaine?: boolean; dateRealisee?: string }) => {
    const { data } = await api.put(`/interventions/${id}/realiser`, options);
    return data;
  },

  reporter: async (id: string, nouvelleDatePrevue: string, raison?: string) => {
    const { data } = await api.post(`/interventions/${id}/reporter`, { nouvelleDatePrevue, raison });
    return data.intervention;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/interventions/${id}`);
  },

  getLastNotes: async (clientId: string, siteId?: string): Promise<{
    previousIntervention: {
      id: string;
      type: string;
      dateRealisee: string;
      notesTerrain: string;
      site?: { id: string; nom: string };
    } | null;
  }> => {
    const { data } = await api.get(`/interventions/last-notes/${clientId}`, {
      params: siteId ? { siteId } : undefined,
    });
    return data;
  },
};

// ============ DASHBOARD ============
export const dashboardApi = {
  stats: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/dashboard/stats');
    return data.stats;
  },

  alertes: async (): Promise<{ alertes: Alerte[]; count: number }> => {
    const { data } = await api.get('/dashboard/alertes');
    return data;
  },
};

// ============ IMPORT/EXPORT ============
export const importExportApi = {
  exportClients: () => `${API_URL}/export/clients`,
  exportContrats: () => `${API_URL}/export/contrats`,
  exportInterventions: (params?: { dateDebut?: string; dateFin?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.dateDebut) searchParams.set('dateDebut', params.dateDebut);
    if (params?.dateFin) searchParams.set('dateFin', params.dateFin);
    return `${API_URL}/export/interventions${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
  },
  exportEmployes: () => `${API_URL}/export/employes`,
  exportGoogleCalendar: (params?: { dateDebut?: string; dateFin?: string; statuts?: string[]; clientId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.dateDebut) searchParams.set('dateDebut', params.dateDebut);
    if (params?.dateFin) searchParams.set('dateFin', params.dateFin);
    if (params?.statuts) searchParams.set('statuts', params.statuts.join(','));
    if (params?.clientId) searchParams.set('clientId', params.clientId);
    return `${API_URL}/export/google-calendar${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
  },

  getTemplate: (type: 'clients' | 'contrats' | 'interventions' | 'employes') => `${API_URL}/import/templates/${type}`,

  preview: async (type: string, content: string): Promise<ImportPreviewResult> => {
    const { data } = await api.post('/import/preview', { type, content });
    return data;
  },

  execute: async (type: string, content: string) => {
    const { data } = await api.post('/import/execute', { type, content });
    return data;
  },
};

// ============ STOCK ============
export const stockApi = {
  // Produits
  listProduits: async (params?: { search?: string; actif?: boolean; stockBas?: boolean }): Promise<Produit[]> => {
    const { data } = await api.get('/produits', { params });
    return data.produits;
  },

  getProduit: async (id: string): Promise<Produit> => {
    const { data } = await api.get(`/produits/${id}`);
    return data.produit;
  },

  createProduit: async (produitData: CreateProduitInput): Promise<Produit> => {
    const { data } = await api.post('/produits', produitData);
    return data.produit;
  },

  updateProduit: async (id: string, produitData: Partial<CreateProduitInput & { actif: boolean }>): Promise<Produit> => {
    const { data } = await api.put(`/produits/${id}`, produitData);
    return data.produit;
  },

  deleteProduit: async (id: string): Promise<void> => {
    await api.delete(`/produits/${id}`);
  },

  // Mouvements
  listMouvements: async (params?: {
    produitId?: string;
    type?: string;
    dateDebut?: string;
    dateFin?: string;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get('/mouvements-stock', { params });
    return { mouvements: data.mouvements as MouvementStock[], pagination: data.pagination };
  },

  createMouvement: async (mouvementData: CreateMouvementInput): Promise<MouvementStock> => {
    const { data } = await api.post('/mouvements-stock', mouvementData);
    return data.mouvement;
  },

  // Stats & Alertes
  getStats: async (): Promise<StockStats> => {
    const { data } = await api.get('/stock/stats');
    return data.stats;
  },

  getAlertes: async (): Promise<{ alertes: StockAlerte[]; count: number }> => {
    const { data } = await api.get('/stock/alertes');
    return data;
  },
};

// ============ RH ============
export const rhApi = {
  // Dashboard
  getDashboard: async (): Promise<RHDashboard> => {
    const { data } = await api.get('/rh/dashboard');
    return data;
  },

  // Congés
  listConges: async (params?: {
    employeId?: string;
    statut?: string;
    type?: string;
    dateDebut?: string;
    dateFin?: string;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get('/rh/conges', { params });
    return { conges: data.conges as Conge[], pagination: data.pagination };
  },

  createConge: async (congeData: CreateCongeInput): Promise<{ conge: Conge }> => {
    const { data } = await api.post('/rh/conges', congeData);
    return data;
  },

  approuverConge: async (id: string, payload: ApprouverCongeInput): Promise<{ conge: Conge }> => {
    const { data } = await api.put(`/rh/conges/${id}/approuver`, payload);
    return data;
  },

  annulerConge: async (id: string): Promise<void> => {
    await api.delete(`/rh/conges/${id}`);
  },

  // Weekend travaillés
  listWeekendTravailles: async (params?: {
    employeId?: string;
    dateDebut?: string;
    dateFin?: string;
  }): Promise<{ jours: JourWeekendTravaille[] }> => {
    const { data } = await api.get('/rh/weekend-travailles', { params });
    return data;
  },

  createWeekendTravaille: async (payload: CreateWeekendTravailleInput): Promise<{ jour: JourWeekendTravaille }> => {
    const { data } = await api.post('/rh/weekend-travailles', payload);
    return data;
  },

  deleteWeekendTravaille: async (id: string): Promise<void> => {
    await api.delete(`/rh/weekend-travailles/${id}`);
  },

  // Soldes
  getSoldes: async (params?: { employeId?: string; annee?: number }): Promise<{ soldes: SoldeConge[] }> => {
    const { data } = await api.get('/rh/soldes', { params });
    return data;
  },

  updateSolde: async (payload: UpdateSoldeInput): Promise<{ solde: SoldeConge }> => {
    const { data } = await api.put('/rh/soldes', payload);
    return data;
  },

  // Récap employé
  getEmployeRecap: async (employeId: string, annee?: number): Promise<EmployeRecap> => {
    const { data } = await api.get(`/rh/employes/${employeId}/recap`, { params: { annee } });
    return data;
  },
};

// ============ TIERS ============
export const tiersApi = {
  // Liste et CRUD
  list: async (params?: {
    search?: string;
    typeTiers?: TypeTiers;
    actif?: boolean;
    formeJuridique?: string;
    secteur?: string;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get('/tiers', { params });
    return { tiers: data.tiers as Tiers[], pagination: data.pagination };
  },

  get: async (id: string): Promise<Tiers> => {
    const { data } = await api.get(`/tiers/${id}`);
    return data.tiers;
  },

  create: async (tiersData: CreateTiersInput): Promise<{ tiers: Tiers }> => {
    const { data } = await api.post('/tiers', tiersData);
    return data;
  },

  update: async (id: string, tiersData: Partial<CreateTiersInput & { actif: boolean }>): Promise<{ tiers: Tiers }> => {
    const { data } = await api.put(`/tiers/${id}`, tiersData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tiers/${id}`);
  },

  convertirProspect: async (id: string): Promise<{ tiers: Tiers; message: string }> => {
    const { data } = await api.post(`/tiers/${id}/convertir`);
    return data;
  },

  getStats: async (): Promise<TiersStats> => {
    const { data } = await api.get('/tiers/stats');
    return data.stats;
  },

  // Contacts
  addContact: async (tiersId: string, contact: CreateContactInput): Promise<{ contact: Contact }> => {
    const { data } = await api.post(`/tiers/${tiersId}/contacts`, contact);
    return data;
  },

  updateContact: async (tiersId: string, contactId: string, contact: Partial<CreateContactInput & { actif: boolean }>): Promise<{ contact: Contact }> => {
    const { data } = await api.put(`/tiers/${tiersId}/contacts/${contactId}`, contact);
    return data;
  },

  deleteContact: async (tiersId: string, contactId: string): Promise<void> => {
    await api.delete(`/tiers/${tiersId}/contacts/${contactId}`);
  },

  // Adresses
  addAdresse: async (tiersId: string, adresse: CreateAdresseInput): Promise<{ adresse: Adresse }> => {
    const { data } = await api.post(`/tiers/${tiersId}/adresses`, adresse);
    return data;
  },

  updateAdresse: async (tiersId: string, adresseId: string, adresse: Partial<CreateAdresseInput & { actif: boolean }>): Promise<{ adresse: Adresse }> => {
    const { data } = await api.put(`/tiers/${tiersId}/adresses/${adresseId}`, adresse);
    return data;
  },

  deleteAdresse: async (tiersId: string, adresseId: string): Promise<void> => {
    await api.delete(`/tiers/${tiersId}/adresses/${adresseId}`);
  },

  // Comptes bancaires
  addCompteBancaire: async (tiersId: string, compte: CreateCompteBancaireInput): Promise<{ compte: CompteBancaire }> => {
    const { data } = await api.post(`/tiers/${tiersId}/comptes-bancaires`, compte);
    return data;
  },

  updateCompteBancaire: async (tiersId: string, compteId: string, compte: Partial<CreateCompteBancaireInput & { actif: boolean }>): Promise<{ compte: CompteBancaire }> => {
    const { data } = await api.put(`/tiers/${tiersId}/comptes-bancaires/${compteId}`, compte);
    return data;
  },

  deleteCompteBancaire: async (tiersId: string, compteId: string): Promise<void> => {
    await api.delete(`/tiers/${tiersId}/comptes-bancaires/${compteId}`);
  },
};

// ============ RÉFÉRENTIELS ============
export const referentielsApi = {
  getModesPaiement: async (): Promise<ModePaiement[]> => {
    const { data } = await api.get('/modes-paiement');
    return data.modes;
  },

  createModePaiement: async (mode: { code: string; libelle: string; ordre?: number }): Promise<{ mode: ModePaiement }> => {
    const { data } = await api.post('/modes-paiement', mode);
    return data;
  },

  getConditionsPaiement: async (): Promise<ConditionPaiement[]> => {
    const { data } = await api.get('/conditions-paiement');
    return data.conditions;
  },

  createConditionPaiement: async (condition: { code: string; libelle: string; nbJours?: number; ordre?: number }): Promise<{ condition: ConditionPaiement }> => {
    const { data } = await api.post('/conditions-paiement', condition);
    return data;
  },
};

// ============ PRODUITS/SERVICES (Dolibarr-style) ============
export const produitsServicesApi = {
  // Produits/Services
  list: async (params?: {
    search?: string;
    type?: TypeProduit;
    categorieId?: string;
    fournisseurId?: string;
    actif?: boolean;
    stockBas?: boolean;
    enVente?: boolean;
    enAchat?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get('/produits-services', { params });
    return { produits: data.produits as ProduitService[], pagination: data.pagination };
  },

  get: async (id: string): Promise<ProduitService> => {
    const { data } = await api.get(`/produits-services/${id}`);
    return data.produit;
  },

  create: async (produitData: CreateProduitServiceInput): Promise<ProduitService> => {
    const { data } = await api.post('/produits-services', produitData);
    return data.produit;
  },

  update: async (id: string, produitData: Partial<CreateProduitServiceInput & { actif: boolean }>): Promise<ProduitService> => {
    const { data } = await api.put(`/produits-services/${id}`, produitData);
    return data.produit;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/produits-services/${id}`);
    return data;
  },

  createMouvement: async (id: string, mouvementData: CreateMouvementPSInput): Promise<MouvementStockPS> => {
    const { data } = await api.post(`/produits-services/${id}/mouvement`, mouvementData);
    return data.mouvement;
  },

  getStats: async (): Promise<ProduitsServicesStats> => {
    const { data } = await api.get('/produits-services/stats');
    return data.stats;
  },

  getAlertes: async (): Promise<{ alertes: ProduitServiceAlerte[]; count: number }> => {
    const { data } = await api.get('/produits-services/alertes');
    return data;
  },
};

// ============ CATEGORIES PRODUITS ============
export const categoriesProduitsApi = {
  list: async (params?: { search?: string; actif?: boolean; parentId?: string }): Promise<CategorieProduit[]> => {
    const { data } = await api.get('/categories-produits', { params });
    return data.categories;
  },

  get: async (id: string): Promise<CategorieProduit> => {
    const { data } = await api.get(`/categories-produits/${id}`);
    return data.categorie;
  },

  create: async (categorieData: CreateCategorieProduitInput): Promise<CategorieProduit> => {
    const { data } = await api.post('/categories-produits', categorieData);
    return data.categorie;
  },

  update: async (id: string, categorieData: Partial<CreateCategorieProduitInput & { actif: boolean }>): Promise<CategorieProduit> => {
    const { data } = await api.put(`/categories-produits/${id}`, categorieData);
    return data.categorie;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/categories-produits/${id}`);
    return data;
  },
};

// ============ ENTREPOTS ============
export const entrepotsApi = {
  list: async (params?: { search?: string; actif?: boolean }): Promise<Entrepot[]> => {
    const { data } = await api.get('/entrepots', { params });
    return data.entrepots;
  },

  get: async (id: string): Promise<Entrepot> => {
    const { data } = await api.get(`/entrepots/${id}`);
    return data.entrepot;
  },

  create: async (entrepotData: CreateEntrepotInput): Promise<Entrepot> => {
    const { data } = await api.post('/entrepots', entrepotData);
    return data.entrepot;
  },

  update: async (id: string, entrepotData: Partial<CreateEntrepotInput & { actif: boolean }>): Promise<Entrepot> => {
    const { data } = await api.put(`/entrepots/${id}`, entrepotData);
    return data.entrepot;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/entrepots/${id}`);
    return data;
  },
};

// ============ PRIX FOURNISSEURS ============
export const prixFournisseursApi = {
  list: async (params?: { produitId?: string; fournisseurId?: string; actif?: boolean }): Promise<PrixFournisseur[]> => {
    const { data } = await api.get('/prix-fournisseurs', { params });
    return data.prix;
  },

  create: async (prixData: CreatePrixFournisseurInput): Promise<PrixFournisseur> => {
    const { data } = await api.post('/prix-fournisseurs', prixData);
    return data.prix;
  },

  update: async (id: string, prixData: Partial<Omit<CreatePrixFournisseurInput, 'produitId' | 'fournisseurId'> & { actif: boolean }>): Promise<PrixFournisseur> => {
    const { data } = await api.put(`/prix-fournisseurs/${id}`, prixData);
    return data.prix;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/prix-fournisseurs/${id}`);
    return data;
  },
};

// ============ PRIX CLIENTS ============
export const prixClientsApi = {
  list: async (params?: { produitId?: string; clientId?: string; actif?: boolean }): Promise<PrixClient[]> => {
    const { data } = await api.get('/prix-clients', { params });
    return data.prix;
  },

  create: async (prixData: CreatePrixClientInput): Promise<PrixClient> => {
    const { data } = await api.post('/prix-clients', prixData);
    return data.prix;
  },

  update: async (id: string, prixData: Partial<Omit<CreatePrixClientInput, 'produitId' | 'clientId'> & { actif: boolean }>): Promise<PrixClient> => {
    const { data } = await api.put(`/prix-clients/${id}`, prixData);
    return data.prix;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/prix-clients/${id}`);
    return data;
  },
};

// ============ COMMERCE ============
export const commerceApi = {
  // Devis
  listDevis: async (params?: { search?: string; clientId?: string; statut?: string; page?: number; limit?: number }) => {
    const { data } = await api.get('/commerce/devis', { params });
    return { devis: data.devis as Devis[], pagination: data.pagination };
  },
  getDevis: async (id: string): Promise<Devis> => {
    const { data } = await api.get(`/commerce/devis/${id}`);
    return data.devis;
  },
  createDevis: async (payload: CreateDevisInput): Promise<Devis> => {
    const { data } = await api.post('/commerce/devis', payload);
    return data.devis;
  },
  updateDevis: async (id: string, payload: Partial<CreateDevisInput & { statut: string }>): Promise<Devis> => {
    const { data } = await api.put(`/commerce/devis/${id}`, payload);
    return data.devis;
  },
  deleteDevis: async (id: string): Promise<void> => {
    await api.delete(`/commerce/devis/${id}`);
  },
  convertirDevisCommande: async (id: string): Promise<{ commande: Commande; message: string }> => {
    const { data } = await api.post(`/commerce/devis/${id}/convertir-commande`);
    return data;
  },

  // Commandes
  listCommandes: async (params?: { search?: string; clientId?: string; statut?: string; page?: number; limit?: number }) => {
    const { data } = await api.get('/commerce/commandes', { params });
    return { commandes: data.commandes as Commande[], pagination: data.pagination };
  },
  getCommande: async (id: string): Promise<Commande> => {
    const { data } = await api.get(`/commerce/commandes/${id}`);
    return data.commande;
  },
  createCommande: async (payload: CreateCommandeInput): Promise<Commande> => {
    const { data } = await api.post('/commerce/commandes', payload);
    return data.commande;
  },
  updateCommande: async (id: string, payload: Partial<CreateCommandeInput & { statut: string }>): Promise<Commande> => {
    const { data } = await api.put(`/commerce/commandes/${id}`, payload);
    return data.commande;
  },
  deleteCommande: async (id: string): Promise<void> => {
    await api.delete(`/commerce/commandes/${id}`);
  },
  convertirCommandeFacture: async (id: string): Promise<{ facture: Facture; message: string }> => {
    const { data } = await api.post(`/commerce/commandes/${id}/convertir-facture`);
    return data;
  },

  // Factures
  listFactures: async (params?: { search?: string; clientId?: string; statut?: string; page?: number; limit?: number }) => {
    const { data } = await api.get('/commerce/factures', { params });
    return { factures: data.factures as Facture[], pagination: data.pagination };
  },
  getFacture: async (id: string): Promise<Facture> => {
    const { data } = await api.get(`/commerce/factures/${id}`);
    return data.facture;
  },
  createFacture: async (payload: CreateFactureInput): Promise<Facture> => {
    const { data } = await api.post('/commerce/factures', payload);
    return data.facture;
  },
  updateFacture: async (id: string, payload: Partial<CreateFactureInput & { statut: string; type: FactureType }>): Promise<Facture> => {
    const { data } = await api.put(`/commerce/factures/${id}`, payload);
    return data.facture;
  },
  deleteFacture: async (id: string): Promise<void> => {
    await api.delete(`/commerce/factures/${id}`);
  },
  listRelances: async (id: string): Promise<FactureRelance[]> => {
    const { data } = await api.get(`/commerce/factures/${id}/relances`);
    return data.relances;
  },
  createRelance: async (id: string, payload: CreateFactureRelanceInput): Promise<FactureRelance> => {
    const { data } = await api.post(`/commerce/factures/${id}/relances`, payload);
    return data.relance;
  },

  // Paiements
  createPaiement: async (payload: CreatePaiementInput): Promise<Paiement> => {
    const { data } = await api.post('/commerce/paiements', payload);
    return data.paiement;
  },
  deletePaiement: async (id: string): Promise<void> => {
    await api.delete(`/commerce/paiements/${id}`);
  },

  // PDF exports
  downloadDevisPdf: async (id: string): Promise<void> => {
    const response = await api.get(`/commerce/devis/${id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  },
  downloadCommandePdf: async (id: string): Promise<void> => {
    const response = await api.get(`/commerce/commandes/${id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  },
  downloadFacturePdf: async (id: string): Promise<void> => {
    const response = await api.get(`/commerce/factures/${id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  },
};

// ============ COMMANDES FOURNISSEURS ============
export const commandesFournisseursApi = {
  list: async (params?: {
    search?: string;
    fournisseurId?: string;
    statut?: CommandeFournisseurStatut;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get('/commandes-fournisseurs', { params });
    return { commandes: data.commandes as CommandeFournisseur[], pagination: data.pagination };
  },

  get: async (id: string): Promise<CommandeFournisseur> => {
    const { data } = await api.get(`/commandes-fournisseurs/${id}`);
    return data.commande;
  },

  create: async (payload: CreateCommandeFournisseurInput): Promise<CommandeFournisseur> => {
    const { data } = await api.post('/commandes-fournisseurs', payload);
    return data.commande;
  },

  update: async (id: string, payload: Partial<CreateCommandeFournisseurInput & { statut: CommandeFournisseurStatut }>): Promise<CommandeFournisseur> => {
    const { data } = await api.put(`/commandes-fournisseurs/${id}`, payload);
    return data.commande;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/commandes-fournisseurs/${id}`);
  },

  reception: async (id: string, payload: ReceptionCommandeFournisseurInput): Promise<{ commande: CommandeFournisseur; message: string }> => {
    const { data } = await api.post(`/commandes-fournisseurs/${id}/reception`, payload);
    return data;
  },

  downloadPdf: async (id: string): Promise<void> => {
    const response = await api.get(`/commandes-fournisseurs/${id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  },
};

// ============ FACTURATION ============
export const facturesFournisseursApi = {
  list: async (params?: { search?: string; fournisseurId?: string; statut?: FactureFournisseurStatut; page?: number; limit?: number }) => {
    const { data } = await api.get('/factures-fournisseurs', { params });
    return { factures: data.factures as FactureFournisseur[], pagination: data.pagination };
  },
  get: async (id: string): Promise<FactureFournisseur> => {
    const { data } = await api.get(`/factures-fournisseurs/${id}`);
    return data.facture;
  },
  create: async (payload: CreateFactureFournisseurInput): Promise<FactureFournisseur> => {
    const { data } = await api.post('/factures-fournisseurs', payload);
    return data.facture;
  },
  update: async (id: string, payload: Partial<CreateFactureFournisseurInput & { statut: FactureFournisseurStatut }>): Promise<FactureFournisseur> => {
    const { data } = await api.put(`/factures-fournisseurs/${id}`, payload);
    return data.facture;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/factures-fournisseurs/${id}`);
  },
  createPaiement: async (id: string, payload: CreatePaiementFournisseurInput): Promise<void> => {
    await api.post(`/factures-fournisseurs/${id}/paiements`, payload);
  },
  deletePaiement: async (id: string, paiementId: string): Promise<void> => {
    await api.delete(`/factures-fournisseurs/${id}/paiements/${paiementId}`);
  },
  convertirDepuisCommande: async (commandeId: string): Promise<FactureFournisseur> => {
    const { data } = await api.post(`/factures-fournisseurs/convertir-commande/${commandeId}`);
    return data.facture;
  },
  downloadPdf: async (id: string): Promise<void> => {
    const response = await api.get(`/factures-fournisseurs/${id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  },
};

export const chargesApi = {
  list: async (params?: { search?: string; typeCharge?: TypeCharge; categorie?: string; statut?: ChargeStatut; page?: number; limit?: number }) => {
    const { data } = await api.get('/charges', { params });
    return { charges: data.charges as Charge[], pagination: data.pagination };
  },
  get: async (id: string): Promise<Charge> => {
    const { data } = await api.get(`/charges/${id}`);
    return data.charge;
  },
  create: async (payload: CreateChargeInput): Promise<Charge> => {
    const { data } = await api.post('/charges', payload);
    return data.charge;
  },
  update: async (id: string, payload: Partial<CreateChargeInput & { statut: ChargeStatut }>): Promise<Charge> => {
    const { data } = await api.put(`/charges/${id}`, payload);
    return data.charge;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/charges/${id}`);
  },
  annuler: async (id: string): Promise<Charge> => {
    const { data } = await api.post(`/charges/${id}/annuler`);
    return data.charge;
  },
  createPaiement: async (id: string, payload: CreatePaiementChargeInput): Promise<void> => {
    await api.post(`/charges/${id}/paiements`, payload);
  },
  deletePaiement: async (id: string, paiementId: string): Promise<void> => {
    await api.delete(`/charges/${id}/paiements/${paiementId}`);
  },
  getCategories: async (): Promise<string[]> => {
    const { data } = await api.get('/charges/categories');
    return data.categories;
  },
  getStats: async (): Promise<any> => {
    const { data } = await api.get('/charges/stats');
    return data.stats;
  },
};

export const paiementsDiversApi = {
  list: async (params?: { search?: string; typeOperation?: string; categorie?: string; tiersId?: string; page?: number; limit?: number }) => {
    const { data } = await api.get('/paiements-divers', { params });
    return { paiements: data.paiements as PaiementDivers[], pagination: data.pagination };
  },
  get: async (id: string): Promise<PaiementDivers> => {
    const { data } = await api.get(`/paiements-divers/${id}`);
    return data.paiement;
  },
  create: async (payload: CreatePaiementDiversInput): Promise<PaiementDivers> => {
    const { data } = await api.post('/paiements-divers', payload);
    return data.paiement;
  },
  update: async (id: string, payload: Partial<CreatePaiementDiversInput>): Promise<PaiementDivers> => {
    const { data } = await api.put(`/paiements-divers/${id}`, payload);
    return data.paiement;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/paiements-divers/${id}`);
  },
  getCategories: async (): Promise<string[]> => {
    const { data } = await api.get('/paiements-divers/categories');
    return data.categories;
  },
  getStats: async (): Promise<any> => {
    const { data } = await api.get('/paiements-divers/stats');
    return data.stats;
  },
};

export const facturationStatsApi = {
  getGlobal: async (annee?: number): Promise<any> => {
    const { data } = await api.get('/facturation/stats/global', { params: { annee } });
    return data.stats;
  },
  getTva: async (annee?: number): Promise<any> => {
    const { data } = await api.get('/facturation/stats/tva', { params: { annee } });
    return data.stats;
  },
  getMarges: async (annee?: number): Promise<any> => {
    const { data } = await api.get('/facturation/stats/marges', { params: { annee } });
    return data.stats;
  },
  getCommandesFacturables: async (): Promise<any> => {
    const { data } = await api.get('/facturation/stats/commandes-facturables');
    return data.data;
  },
  getTresorerie: async (annee?: number): Promise<any> => {
    const { data } = await api.get('/facturation/stats/tresorerie', { params: { annee } });
    return data.stats;
  },
  getRetards: async (): Promise<any> => {
    const { data } = await api.get('/facturation/stats/retards');
    return data.data;
  },
};

export default api;
