import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Receipt,
  Upload,
  Settings,
  LogOut,
  AlertTriangle,
  Package,
  UserCog,
  Building2,
  ShoppingBag,
  Wallet,
  ChevronDown,
  ChevronRight,
  Store,
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

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  show: boolean;
  badge?: number;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning';
}

interface NavGroup {
  id: string;
  icon: React.ElementType;
  label: string;
  show: boolean;
  items: NavItem[];
}

export function Sidebar({ stats }: SidebarProps) {
  const { user, logout, canDo } = useAuthStore();
  const location = useLocation();

  // Check which group should be open by default based on current path
  const getDefaultOpenGroups = () => {
    const commercePaths = ['/commerce', '/produits-services', '/stocks'];
    if (commercePaths.some(path => location.pathname.startsWith(path))) {
      return ['commerce'];
    }
    return [];
  };

  const [openGroups, setOpenGroups] = useState<string[]>(getDefaultOpenGroups);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Main navigation items (not grouped)
  const mainNavItems: NavItem[] = [
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
      to: '/tiers',
      icon: Building2,
      label: 'Tiers',
      show: true,
    },
    {
      to: '/contrats',
      icon: FileText,
      label: 'Contrats',
      show: true,
    },
  ];

  // Grouped navigation items
  const navGroups: NavGroup[] = [
    {
      id: 'commerce',
      icon: Store,
      label: 'Commerce & Ventes',
      show: true,
      items: [
        {
          to: '/commerce',
          icon: Receipt,
          label: 'Devis & Factures',
          show: true,
        },
        {
          to: '/produits-services',
          icon: ShoppingBag,
          label: 'Produits & Services',
          show: true,
        },
        {
          to: '/stocks',
          icon: Package,
          label: 'Stocks',
          show: true,
        },
      ],
    },
  ];

  // Bottom navigation items
  const bottomNavItems: NavItem[] = [
    {
      to: '/facturation',
      icon: Wallet,
      label: 'Facturation',
      show: canDo('viewFacturation'),
    },
    {
      to: '/rh',
      icon: UserCog,
      label: 'Ressources Humaines',
      show: canDo('viewRH'),
    },
    {
      to: '/import-export',
      icon: Upload,
      label: 'Import / Export',
      show: canDo('importData') || canDo('exportData'),
    },
    {
      to: '/parametres',
      icon: Settings,
      label: 'Paramètres',
      show: canDo('manageSettings') || canDo('managePrestations'),
    },
  ];

  const renderNavItem = (item: NavItem) => (
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
      <item.icon className="h-5 w-5 flex-shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <Badge variant={item.badgeVariant} className="ml-auto">
          {item.badge}
        </Badge>
      )}
    </NavLink>
  );

  const renderNavGroup = (group: NavGroup) => {
    const isOpen = openGroups.includes(group.id);
    const hasActiveChild = group.items.some(item => location.pathname === item.to);
    const visibleItems = group.items.filter(item => item.show);

    if (visibleItems.length === 0) return null;

    return (
      <div key={group.id} className="space-y-1">
        <button
          onClick={() => toggleGroup(group.id)}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left',
            hasActiveChild && !isOpen
              ? 'bg-primary/10 text-primary'
              : 'text-gray-700 hover:bg-gray-100'
          )}
        >
          <group.icon className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1 truncate">{group.label}</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {isOpen && (
          <div className="ml-4 pl-4 border-l border-gray-200 space-y-1">
            {visibleItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  )
                }
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex flex-col w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-primary">RHS Controler</h1>
        <p className="text-xs text-muted-foreground mt-1">Gestion des interventions</p>
      </div>

      {/* Alertes rapides */}
      {stats && stats.enRetard > 0 && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{stats.enRetard} intervention(s) en retard</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Main items */}
        {mainNavItems.filter(item => item.show).map(renderNavItem)}

        {/* Separator */}
        <div className="py-2">
          <div className="h-px bg-gray-200" />
        </div>

        {/* Grouped items */}
        {navGroups.filter(group => group.show).map(renderNavGroup)}

        {/* Separator */}
        <div className="py-2">
          <div className="h-px bg-gray-200" />
        </div>

        {/* Bottom items */}
        {bottomNavItems.filter(item => item.show).map(renderNavItem)}
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
