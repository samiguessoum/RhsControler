import { NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Upload,
  Settings,
  LogOut,
  AlertTriangle,
  UserCog,
  Building2,
  ShoppingBag,
  Wallet,
  Landmark,
  TrendingUp,
  Warehouse,
  KanbanSquare,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface SidebarProps {
  stats?: {
    aPlanifier: number;
    enRetard: number;
  };
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  show: boolean;
  badge?: number;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning';
}

export function Sidebar({ stats, mobileOpen = false, onMobileClose }: SidebarProps) {
  const { user, logout, canDo } = useAuthStore();
  const queryClient = useQueryClient();

  const handleNavClick = () => {
    queryClient.invalidateQueries();
    onMobileClose?.();
  };

  const renderNavItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={handleNavClick}
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

  const isTeamOnly = user?.role === 'EQUIPE' || user?.role === 'SUPER_CHEF_EQUIPE';

  const topItems: NavItem[] = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', show: !isTeamOnly },
    {
      to: '/planning',
      icon: Calendar,
      label: 'Planning',
      badge: stats?.aPlanifier || undefined,
      badgeVariant: 'warning' as const,
      show: true,
    },
    { to: '/terrain', icon: ClipboardCheck, label: 'Terrain & Rapports', show: true },
    { to: '/tiers', icon: Building2, label: 'Tiers', show: !isTeamOnly },
    { to: '/contrats', icon: FileText, label: 'Contrats', show: !isTeamOnly },
  ];

  const moduleItems: NavItem[] = [
    { to: '/commerce', icon: TrendingUp, label: 'Cycle de vente', show: !isTeamOnly },
    { to: '/suivi-ventes', icon: KanbanSquare, label: 'Suivi des ventes', show: !isTeamOnly },
    { to: '/produits-services', icon: ShoppingBag, label: 'Produits & Services', show: !isTeamOnly },
    { to: '/entrepots', icon: Warehouse, label: 'Entrepôts', show: !isTeamOnly },
    { to: '/facturation', icon: Wallet, label: 'Fournisseurs & Charges', show: canDo('viewFacturation') },
    { to: '/finance', icon: Landmark, label: 'Finance & Trésorerie', show: canDo('viewDashboardFinance') },
  ];

  const bottomItems: NavItem[] = [
    { to: '/rh', icon: UserCog, label: 'Ressources Humaines', show: canDo('viewRH') },
    { to: '/import-export', icon: Upload, label: 'Import / Export', show: canDo('importData') || canDo('exportData') },
    { to: '/parametres', icon: Settings, label: 'Paramètres', show: canDo('manageSettings') || canDo('managePrestations') },
  ];

  const NavBody = () => (
    <>
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
        {topItems.filter(i => i.show).map(renderNavItem)}

        <div className="py-2"><div className="h-px bg-gray-200" /></div>

        {moduleItems.filter(i => i.show).map(renderNavItem)}

        <div className="py-2"><div className="h-px bg-gray-200" /></div>

        {bottomItems.filter(i => i.show).map(renderNavItem)}
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
            <p className="text-sm font-medium truncate">{user?.prenom} {user?.nom}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-600"
          onClick={() => { logout(); onMobileClose?.(); }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0">
        <NavBody />
      </aside>

      {/* Mobile Sheet drawer */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent side="left" className="p-0 w-72 flex flex-col">
          <NavBody />
        </SheetContent>
      </Sheet>
    </>
  );
}
