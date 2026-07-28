import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  hasRole: (...roles: Role[]) => boolean;
  canDo: (action: string) => boolean;
}

const permissions: Record<string, Role[]> = {
  // Utilisateurs
  manageUsers: ['SUPER_ADMIN'],

  // Clients / Tiers
  createClient: ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],
  editClient:   ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],
  deleteClient: ['SUPER_ADMIN', 'DIRECTION'],

  // Contrats
  createContrat: ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],
  editContrat:   ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],
  deleteContrat: ['SUPER_ADMIN', 'DIRECTION'],

  // Interventions
  createIntervention:   ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],
  editIntervention:     ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],
  deleteIntervention:   ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],
  realiserIntervention: ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],

  // Import / Export
  importData: ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],
  exportData: ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR', 'SUPER_CHEF_EQUIPE'],

  // Paramètres
  manageSettings:   ['SUPER_ADMIN'],
  managePrestations:['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],

  // Employés
  viewEmployes:   ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR', 'SUPER_CHEF_EQUIPE'],
  manageEmployes: ['SUPER_ADMIN', 'DIRECTION'],
  viewPostes:     ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR', 'SUPER_CHEF_EQUIPE'],
  managePostes:   ['SUPER_ADMIN', 'DIRECTION'],

  // Stock
  manageStock: ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],

  // RH
  viewRH:   ['SUPER_ADMIN', 'DIRECTION'],
  manageRH: ['SUPER_ADMIN', 'DIRECTION'],

  // Commerce
  manageCommerce: ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],

  // Facturation
  manageFacturation:    ['SUPER_ADMIN', 'DIRECTION', 'COORDINATEUR'],
  viewFacturation:      ['SUPER_ADMIN', 'DIRECTION'],
  viewDashboardFinance: ['SUPER_ADMIN', 'DIRECTION'],
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token, user) => {
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },

      hasRole: (...roles) => {
        const user = get().user;
        if (!user) return false;
        return roles.includes(user.role);
      },

      canDo: (action) => {
        const user = get().user;
        if (!user) return false;
        const allowedRoles = permissions[action];
        if (!allowedRoles) return false;
        return allowedRoles.includes(user.role);
      },
    }),
    {
      name: 'rhs-auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
