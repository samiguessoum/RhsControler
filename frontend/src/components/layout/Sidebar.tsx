import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  Upload,
  Settings,
  LogOut,
  AlertTriangle,
  Package,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  stats?: {
    aPlanifier: number;
    enRetard: number;
  };
}

export function Sidebar({ stats }: SidebarProps) {
  const { user, logout, canDo } = useAuthStore();

  const navItems = [
    {
      to: '/',
      icon: LayoutDashboard,
      label: 'Dashboard',
      show: true,
    },
    {
      to: '/planning',
      icon: Calendar,
      label: 'Planning',
      badge: stats?.aPlanifier ? stats.aPlanifier : undefined,
      badgeVariant: 'warning' as const,
      show: true,
    },
    {
      to: '/clients',
      icon: Users,
      label: 'Clients',
      show: true,
    },
    {
      to: '/contrats',
      icon: FileText,
      label: 'Contrats',
      show: true,
    },
    {
      to: '/stocks',
      icon: Package,
      label: 'Stocks',
      show: true,
    },
    {
      to: '/rh',
      icon: UserCog,
      label: 'RH',
      show: canDo('viewRH'),
    },
    {
      to: '/import-export',
      icon: Upload,
      label: 'Import/Export',
      show: canDo('importData') || canDo('exportData'),
    },
    {
      to: '/parametres',
      icon: Settings,
      label: 'Paramètres',
      show: canDo('manageSettings') || canDo('managePrestations'),
    },
  ];

  return (
    <aside className="flex flex-col w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-primary">RHS Controler</h1>
        <p className="text-xs text-muted-foreground mt-1">Gestion des interventions</p>
      </div>

      {/* Alertes rapides */}
      {stats && (stats.enRetard > 0) && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>{stats.enRetard} intervention(s) en retard</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.filter(item => item.show).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-700 hover:bg-gray-100'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <Badge variant={item.badgeVariant} className="ml-auto">
                {item.badge}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-medium">
              {user?.prenom?.[0]}{user?.nom?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.prenom} {user?.nom}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.role}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-600"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </Button>
      </div>
    </aside>
  );
}
