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
  manageUsers: ['DIRECTION'],
  createClient: ['DIRECTION', 'PLANNING'],
  editClient: ['DIRECTION', 'PLANNING'],
  deleteClient: ['DIRECTION'],
  createContrat: ['DIRECTION', 'PLANNING'],
  editContrat: ['DIRECTION', 'PLANNING'],
  deleteContrat: ['DIRECTION'],
  createIntervention: ['DIRECTION', 'PLANNING', 'EQUIPE'],
  editIntervention: ['DIRECTION', 'PLANNING', 'EQUIPE'],
  deleteIntervention: ['DIRECTION', 'PLANNING'],
  realiserIntervention: ['DIRECTION', 'PLANNING', 'EQUIPE'],
  importData: ['DIRECTION', 'PLANNING'],
  exportData: ['DIRECTION', 'PLANNING', 'EQUIPE'],
  manageSettings: ['DIRECTION'],
  viewEmployes: ['DIRECTION', 'PLANNING', 'EQUIPE'],
  manageEmployes: ['DIRECTION'],
  viewPostes: ['DIRECTION', 'PLANNING', 'EQUIPE'],
  managePostes: ['DIRECTION'],
  managePrestations: ['DIRECTION', 'PLANNING'],
  manageStock: ['DIRECTION', 'PLANNING'],
  viewRH: ['DIRECTION', 'PLANNING'],
  manageRH: ['DIRECTION'],
  manageCommerce: ['DIRECTION', 'PLANNING'],
  viewFacturation: ['DIRECTION', 'PLANNING'],
  manageFacturation: ['DIRECTION', 'PLANNING'],
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
