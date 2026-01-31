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
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
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

export default api;
