import { useState, useEffect, useCallback, useRef } from 'react';
import { GeocoderSearch } from '@/components/AddressAutocomplete';
import type { GeoSelection } from '@/components/AddressAutocomplete';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Users,
  UserPlus,
  Truck,
  Search,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  ArrowRightLeft,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  Flame,
  Thermometer,
  Snowflake,
  FileText,
  X,
} from 'lucide-react';

import { tiersApi, referentielsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/store/auth.store';
import type {
  Tiers,
  TypeTiers,
  FormeJuridique,
  CreateTiersInput,
  SiteInput,
  CreateContactInput,
} from '@/types';
import { cn } from '@/lib/utils';

// ============ CONFIGURATION ============
const TYPE_TIERS_CONFIG: Record<TypeTiers, { label: string; icon: any; color: string; bgColor: string; borderColor: string }> = {
  CLIENT: { label: 'Client', icon: Users, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  FOURNISSEUR: { label: 'Fournisseur', icon: Truck, color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  PROSPECT: { label: 'Prospect', icon: UserPlus, color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  CLIENT_FOURNISSEUR: { label: 'Client & Fournisseur', icon: ArrowRightLeft, color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
};

const FORME_JURIDIQUE_OPTIONS: { value: FormeJuridique; label: string }[] = [
  { value: 'SARL', label: 'SARL' },
  { value: 'EURL', label: 'EURL' },
  { value: 'SPA', label: 'SPA' },
  { value: 'SNC', label: 'SNC' },
  { value: 'AUTO_ENTREPRENEUR', label: 'Auto-entrepreneur' },
  { value: 'ASSOCIATION', label: 'Association' },
  { value: 'PARTICULIER', label: 'Particulier' },
  { value: 'AUTRE', label: 'Autre' },
];

const SECTEURS_ACTIVITE = [
  // Industrie
  { groupe: 'Industrie', label: 'Industrie pharmaceutique' },
  { groupe: 'Industrie', label: 'Industrie agroalimentaire' },
  { groupe: 'Industrie', label: 'Industrie chimique & pétrochimique' },
  { groupe: 'Industrie', label: 'Industrie métallurgique & sidérurgie' },
  { groupe: 'Industrie', label: 'Industrie mécanique & automobile' },
  { groupe: 'Industrie', label: 'Industrie électronique & électrique' },
  { groupe: 'Industrie', label: 'Industrie textile & habillement' },
  { groupe: 'Industrie', label: 'Industrie du bois & ameublement' },
  { groupe: 'Industrie', label: 'Industrie plastique & caoutchouc' },
  { groupe: 'Industrie', label: 'Industrie cosmétique & hygiène' },
  { groupe: 'Industrie', label: 'Industrie du verre & céramique' },
  { groupe: 'Industrie', label: 'Industrie papier & imprimerie' },
  { groupe: 'Industrie', label: 'Industrie des matériaux de construction' },
  // BTP & Énergie
  { groupe: 'BTP & Énergie', label: 'Bâtiment & Travaux Publics (BTP)' },
  { groupe: 'BTP & Énergie', label: 'Génie civil & Infrastructure' },
  { groupe: 'BTP & Énergie', label: 'Énergie & Hydrocarbures' },
  { groupe: 'BTP & Énergie', label: 'Mines & Carrières' },
  { groupe: 'BTP & Énergie', label: 'Énergies renouvelables' },
  { groupe: 'BTP & Énergie', label: 'Eau, assainissement & environnement' },
  // Commerce & Distribution
  { groupe: 'Commerce', label: 'Commerce de gros & distribution' },
  { groupe: 'Commerce', label: 'Commerce de détail' },
  { groupe: 'Commerce', label: 'Import / Export' },
  { groupe: 'Commerce', label: 'Grande distribution & supermarchés' },
  // Services
  { groupe: 'Services', label: 'Transport & Logistique' },
  { groupe: 'Services', label: 'Services informatiques & télécom' },
  { groupe: 'Services', label: 'Services financiers & assurances' },
  { groupe: 'Services', label: 'Services de santé & médical' },
  { groupe: 'Services', label: 'Éducation & Formation' },
  { groupe: 'Services', label: 'Hôtellerie & Restauration' },
  { groupe: 'Services', label: 'Tourisme & Voyages' },
  { groupe: 'Services', label: 'Immobilier & Promotion immobilière' },
  { groupe: 'Services', label: 'Audit, conseil & expertise comptable' },
  { groupe: 'Services', label: 'Communication, marketing & médias' },
  { groupe: 'Services', label: 'Sécurité & Gardiennage' },
  { groupe: 'Services', label: 'Nettoyage & Facilities management' },
  { groupe: 'Services', label: 'Bureautique & Fournitures de bureau' },
  // Agriculture
  { groupe: 'Agriculture', label: 'Agriculture & Maraîchage' },
  { groupe: 'Agriculture', label: 'Élevage & Aviculture' },
  { groupe: 'Agriculture', label: 'Pêche & Aquaculture' },
  { groupe: 'Agriculture', label: 'Agro-industrie & transformation agricole' },
  // Autre
  { groupe: 'Autre', label: 'Administration publique & collectivités' },
  { groupe: 'Autre', label: 'Association & ONG' },
  { groupe: 'Autre', label: 'Autre' },
];

function SecteurCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search.trim()
    ? SECTEURS_ACTIVITE.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()))
    : SECTEURS_ACTIVITE;

  const grouped = filtered.reduce<Record<string, string[]>>((acc, s) => {
    if (!acc[s.groupe]) acc[s.groupe] = [];
    acc[s.groupe].push(s.label);
    return acc;
  }, {});

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(''); }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || 'Sélectionner un secteur...'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Rechercher un secteur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {Object.keys(grouped).length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat</p>
            ) : (
              Object.entries(grouped).map(([groupe, items]) => (
                <div key={groupe}>
                  <p className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{groupe}</p>
                  {items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { onChange(item); setOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                        value === item && 'bg-accent font-medium'
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
          {value && (
            <div className="p-2 border-t">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
              >
                ✕ Effacer la sélection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PROSPECT_NIVEAUX = [
  { value: 2, label: 'Chaud', icon: Flame, color: 'text-red-600', bgColor: 'bg-red-100' },
  { value: 1, label: 'Tiède', icon: Thermometer, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  { value: 0, label: 'Froid', icon: Snowflake, color: 'text-blue-600', bgColor: 'bg-blue-100' },
];

function normalizeProspectNiveau(value?: number | null): number | undefined {
  if (typeof value !== 'number') return undefined;
  // Legacy UI used 1..3 while API expects 0..2
  const mapped = value > 2 ? value - 1 : value;
  return Math.max(0, Math.min(2, mapped));
}

function normalizeNulls<T>(input: T): T {
  if (input === null) return undefined as T;
  if (Array.isArray(input)) {
    return input.map((item) => normalizeNulls(item)) as T;
  }
  if (typeof input === 'object' && input !== null) {
    const entries = Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      key,
      normalizeNulls(value),
    ]);
    return Object.fromEntries(entries) as T;
  }
  return input;
}

// ============ COLLAPSIBLE SECTION ============
function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('border rounded-lg bg-white', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0 border-t space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ============ TIERS CARD COMPONENT ============
function TiersCard({
  tiers,
  onView,
  onEdit,
  onDelete,
  onConvert,
  canEdit,
  canDelete,
}: {
  tiers: Tiers;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onConvert?: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const config = TYPE_TIERS_CONFIG[tiers.typeTiers];
  const prospectNiveau = PROSPECT_NIVEAUX.find(n => n.value === tiers.prospectNiveau);
  const initials = tiers.nomEntreprise.slice(0, 2).toUpperCase();

  return (
    <div
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden hover:-translate-y-0.5"
      onClick={onView}
    >
      {/* Top colored bar */}
      <div className={cn('h-1', config.borderColor.replace('border-', 'bg-'))} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm', config.bgColor, config.color)}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 truncate text-sm">{tiers.nomEntreprise}</p>
              {tiers.nomAlias && (
                <p className="text-xs text-gray-400 truncate">{tiers.nomAlias}</p>
              )}
            </div>
          </div>
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0', config.bgColor, config.color)}>
            {config.label}
          </span>
        </div>

        {/* Contact */}
        <div className="space-y-1.5">
          {tiers.siegeVille && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{tiers.siegeVille}</span>
            </div>
          )}
          {tiers.siegeTel && (
            <a href={`tel:${tiers.siegeTel}`} onClick={e => e.stopPropagation()}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-green-600 transition-colors">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span>{tiers.siegeTel}</span>
            </a>
          )}
          {tiers.siegeEmail && (
            <a href={`mailto:${tiers.siegeEmail}`} onClick={e => e.stopPropagation()}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-green-600 transition-colors truncate">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{tiers.siegeEmail}</span>
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            {(tiers.typeTiers === 'CLIENT' || tiers.typeTiers === 'CLIENT_FOURNISSEUR') && (
              <>
                {tiers.sites && tiers.sites.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />{tiers.sites.length} site{tiers.sites.length > 1 ? 's' : ''}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />{tiers._count?.contrats || 0} contrat{(tiers._count?.contrats || 0) > 1 ? 's' : ''}
                </span>
              </>
            )}
            {tiers.typeTiers === 'PROSPECT' && prospectNiveau && (
              <span className={cn('flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full', prospectNiveau.bgColor, prospectNiveau.color)}>
                <prospectNiveau.icon className="h-3 w-3" />{prospectNiveau.label}
              </span>
            )}
          </div>

          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            {tiers.typeTiers === 'PROSPECT' && canEdit && onConvert && (
              <button onClick={onConvert}
                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors">
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </button>
            )}
            {canEdit && (
              <button onClick={onEdit}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                <Edit className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && (
              <button onClick={onDelete}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============
export default function TiersPage() {
  const { canDo } = useAuthStore();
  const canCreate = canDo('createClient');
  const canEdit = canDo('editClient');
  const canDelete = canDo('deleteClient');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTiers, setEditingTiers] = useState<Tiers | null>(null);
  const [viewingTiers, setViewingTiers] = useState<Tiers | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tiers | null>(null);
  const [convertTarget, setConvertTarget] = useState<Tiers | null>(null);
  const [createType, setCreateType] = useState<TypeTiers | 'all'>('all');

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['tiers-stats'],
    queryFn: tiersApi.getStats,
  });

  // Fetch tiers list
  const PAGE_SIZE = 100;
  const typeTiersFilter = activeTab === 'all' ? undefined : activeTab as TypeTiers;
  const { data: tiersData, isLoading } = useQuery({
    queryKey: ['tiers', typeTiersFilter, search, page],
    queryFn: () => tiersApi.list({ typeTiers: typeTiersFilter, search: search || undefined, page, limit: PAGE_SIZE }),
  });

  // Revenir à la page 1 quand le filtre ou la recherche change
  useEffect(() => {
    setPage(1);
  }, [typeTiersFilter, search]);

  // Delete mutation
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['tiers'] });
    queryClient.invalidateQueries({ queryKey: ['tiers-stats'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['clients-active'] });
    queryClient.invalidateQueries({ queryKey: ['contrats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  };

  const deleteMutation = useMutation({
    mutationFn: tiersApi.delete,
    onSuccess: () => {
      invalidateAll();
      setDeleteTarget(null);
    },
  });

  // Convert prospect mutation
  const convertMutation = useMutation({
    mutationFn: tiersApi.convertirProspect,
    onSuccess: () => {
      invalidateAll();
      setConvertTarget(null);
    },
  });

  const tiersList = tiersData?.tiers || [];

  useEffect(() => {
    const viewId = searchParams.get('view');
    if (!viewId) return;
    let isActive = true;
    tiersApi.get(viewId)
      .then((tiers) => {
        if (isActive) setViewingTiers(tiers);
      })
      .catch(() => {
        if (isActive) setViewingTiers(null);
      });
    return () => {
      isActive = false;
    };
  }, [searchParams]);

  const clearViewParam = () => {
    if (!searchParams.get('view')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Tiers</h1>
          <p className="text-sm text-gray-400 mt-0.5">Clients, fournisseurs et prospects</p>
        </div>
        {canCreate && (
          <Button
            className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm shadow-green-200 h-9"
            onClick={() => {
              const type = (activeTab === 'CLIENT' || activeTab === 'FOURNISSEUR' || activeTab === 'PROSPECT')
                ? activeTab : 'CLIENT';
              setCreateType(type as TypeTiers);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau tiers
          </Button>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'CLIENT',      label: 'Clients',      icon: Users,    bar: 'bg-blue-500',   num: 'text-blue-700',   bg: 'bg-blue-50',   ring: 'ring-blue-300',   count: stats?.clients.actifs || 0,      total: stats?.clients.total || 0 },
          { key: 'FOURNISSEUR', label: 'Fournisseurs', icon: Truck,    bar: 'bg-orange-400', num: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-300', count: stats?.fournisseurs.actifs || 0,  total: stats?.fournisseurs.total || 0 },
          { key: 'PROSPECT',    label: 'Prospects',    icon: UserPlus, bar: 'bg-purple-500', num: 'text-purple-700', bg: 'bg-purple-50', ring: 'ring-purple-300', count: stats?.prospects.actifs || 0,     total: stats?.prospects.total || 0 },
        ].map(({ key, label, icon: Icon, bar, num, bg, ring, count, total }) => (
          <div
            key={key}
            onClick={() => setActiveTab(activeTab === key ? 'all' : key)}
            className={cn(
              'relative bg-white rounded-xl p-5 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
              activeTab === key ? `ring-2 ${ring} shadow-sm` : 'shadow-sm'
            )}
          >
            <div className={`absolute bottom-0 left-0 right-0 h-1 ${bar} rounded-b-xl`} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                <p className={`text-4xl font-black tabular-nums leading-none ${num}`}>{count}</p>
                <p className="text-xs text-gray-400 mt-1">{total} au total</p>
              </div>
              <div className={`p-2.5 rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${num}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Barre filtres ── */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { value: 'all',         label: 'Tous' },
            { value: 'CLIENT',      label: 'Clients' },
            { value: 'FOURNISSEUR', label: 'Fournisseurs' },
            { value: 'PROSPECT',    label: 'Prospects' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'h-7 px-3 rounded-md text-xs font-semibold transition-all',
                activeTab === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-52 text-sm border-gray-200"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-2">
                <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-1.5 rounded-md transition-all', viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600')}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={cn('p-1.5 rounded-md transition-all', viewMode === 'cards' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600')}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Contenu ── */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">Chargement...</p>
        </div>
      ) : tiersList.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Building2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">
            {search ? `Aucun résultat pour "${search}"` : 'Aucun tiers enregistré'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {search ? 'Essayez un autre terme de recherche' : 'Créez votre premier tiers pour commencer'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {tiersList.map((tiers) => (
            <TiersCard
              key={tiers.id}
              tiers={tiers}
              onView={() => setViewingTiers(tiers)}
              onEdit={() => setEditingTiers(tiers)}
              onDelete={() => setDeleteTarget(tiers)}
              onConvert={tiers.typeTiers === 'PROSPECT' ? () => setConvertTarget(tiers) : undefined}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* List header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100">
            {['Nom', 'Type', 'Ville', 'Téléphone', 'Email', ''].map(h => (
              <span key={h} className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-gray-50">
            {tiersList.map((tiers) => {
              const config = TYPE_TIERS_CONFIG[tiers.typeTiers];
              const initials = tiers.nomEntreprise.slice(0, 2).toUpperCase();
              return (
                <div
                  key={tiers.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3.5 items-center cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setViewingTiers(tiers)}
                >
                  {/* Nom */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black', config.bgColor, config.color)}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{tiers.nomEntreprise}</p>
                      {tiers.nomAlias && <p className="text-xs text-gray-400 truncate">{tiers.nomAlias}</p>}
                    </div>
                  </div>

                  {/* Type */}
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit', config.bgColor, config.color)}>
                    {config.label}
                  </span>

                  {/* Ville */}
                  <span className="text-sm text-gray-500 truncate">{tiers.siegeVille || <span className="text-gray-300">—</span>}</span>

                  {/* Téléphone */}
                  <div onClick={e => e.stopPropagation()}>
                    {tiers.siegeTel
                      ? <a href={`tel:${tiers.siegeTel}`} className="text-sm text-gray-700 hover:text-green-600 transition-colors">{tiers.siegeTel}</a>
                      : <span className="text-gray-300">—</span>
                    }
                  </div>

                  {/* Email */}
                  <div onClick={e => e.stopPropagation()} className="min-w-0">
                    {tiers.siegeEmail
                      ? <a href={`mailto:${tiers.siegeEmail}`} className="text-sm text-gray-700 hover:text-green-600 transition-colors truncate block">{tiers.siegeEmail}</a>
                      : <span className="text-gray-300">—</span>
                    }
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {tiers.typeTiers === 'PROSPECT' && canEdit && (
                      <button onClick={() => setConvertTarget(tiers)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => setEditingTiers(tiers)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeleteTarget(tiers)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {tiersData?.pagination && tiersData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-4 py-3">
          <p className="text-xs text-gray-400">
            Page {tiersData.pagination.page} sur {tiersData.pagination.totalPages} — {tiersData.pagination.total} résultat{tiersData.pagination.total > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page >= tiersData.pagination.totalPages}
              onClick={() => setPage((p) => Math.min(tiersData.pagination.totalPages, p + 1))}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <TiersFormDialog
        open={showCreateDialog || !!editingTiers}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingTiers(null);
          }
        }}
        tiers={editingTiers}
        initialType={createType}
      />

      {/* View Dialog */}
      <TiersDetailDialog
        open={!!viewingTiers}
        onOpenChange={(open) => {
          if (!open) {
            setViewingTiers(null);
            clearViewParam();
          }
        }}
        tiersId={viewingTiers?.id}
        canEdit={canEdit}
        onEdit={(tiers) => {
          setEditingTiers(tiers);
          setViewingTiers(null);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce tiers ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer <strong>{deleteTarget?.nomEntreprise}</strong> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert Confirmation */}
      <AlertDialog open={!!convertTarget} onOpenChange={(open) => !open && setConvertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convertir en client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous convertir <strong>{convertTarget?.nomEntreprise}</strong> en client ?
              Le prospect deviendra un client actif.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => convertTarget && convertMutation.mutate(convertTarget.id)}
            >
              Convertir en client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  );
}

// ============ UNIFIED FORM DIALOG ============
function TiersFormDialog({
  open,
  onOpenChange,
  tiers,
  initialType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiers: Tiers | null;
  initialType?: TypeTiers | 'all';
}) {
  const queryClient = useQueryClient();
  const isEdit = !!tiers;

  // Charger les données complètes du tiers (avec contacts et sites)
  const { data: fullTiers, isLoading: isLoadingTiers } = useQuery({
    queryKey: ['tiers', tiers?.id],
    queryFn: () => tiersApi.get(tiers!.id),
    enabled: !!tiers?.id && open,
  });

  const [formData, setFormData] = useState<CreateTiersInput>({
    nomEntreprise: '',
    typeTiers: 'CLIENT',
  });

  const [sites, setSites] = useState<SiteInput[]>([]);
  const [contactPrincipal, setContactPrincipal] = useState<CreateContactInput>({
    nom: '',
  });
  const [extraContacts, setExtraContacts] = useState<CreateContactInput[]>([]);

  // Reset form when dialog opens or when full data is loaded
  useEffect(() => {
    if (open) {
      // En mode édition, attendre que fullTiers soit chargé pour avoir les contacts/sites
      if (tiers && !fullTiers) {
        // Attendre le chargement complet
        return;
      }

      // Utiliser fullTiers si disponible (mode édition), sinon tiers
      const tiersData = fullTiers || tiers;
      if (tiersData) {
        const principalContact = tiersData.siegeContacts?.find(c => c.estPrincipal) || tiersData.siegeContacts?.[0];
        const otherContacts = tiersData.siegeContacts?.filter(c => c.id !== principalContact?.id) || [];
        setFormData({
          nomEntreprise: tiersData.nomEntreprise,
          nomAlias: tiersData.nomAlias,
          typeTiers: tiersData.typeTiers,
          formeJuridique: tiersData.formeJuridique,
          siegeRC: tiersData.siegeRC,
          siegeNIF: tiersData.siegeNIF,
          siegeTIN: tiersData.siegeTIN,
          siegeAI: tiersData.siegeAI,
          siegeNIS: tiersData.siegeNIS,
          siegeNIN: tiersData.siegeNIN,
          tvaIntracom: tiersData.tvaIntracom,
          capital: tiersData.capital,
          siegeNom: tiersData.siegeNom,
          siegeAdresse: tiersData.siegeAdresse,
          siegeCodePostal: tiersData.siegeCodePostal,
          siegeVille: tiersData.siegeVille,
          siegePays: tiersData.siegePays || 'Algérie',
          siegeTel: tiersData.siegeTel,
          siegeFax: tiersData.siegeFax,
          siegeEmail: tiersData.siegeEmail,
          siegeWebsite: tiersData.siegeWebsite,
          secteur: tiersData.secteur,
          remiseParDefaut: tiersData.remiseParDefaut,
          encoursMaximum: tiersData.encoursMaximum,
          devise: tiersData.devise || 'DZD',
          notePublique: tiersData.notePublique,
          notePrivee: tiersData.notePrivee,
          prospectNiveau: normalizeProspectNiveau(tiersData.prospectNiveau),
          prospectStatut: tiersData.prospectStatut,
        });
        const loadedSites = tiersData.sites?.map(s => ({
          id: s.id,
          nom: s.nom,
          adresse: s.adresse,
          tel: s.tel,
          email: s.email,
          notes: s.notes,
        })) || [];
        setSites(loadedSites);
        setContactPrincipal(principalContact || { nom: '' });
        setExtraContacts(otherContacts.map(c => ({
          civilite: c.civilite,
          nom: c.nom,
          prenom: c.prenom,
          fonction: c.fonction,
          tel: c.tel,
          telMobile: c.telMobile,
          fax: c.fax,
          email: c.email,
          notes: c.notes,
        })));
      } else {
        setFormData({
          nomEntreprise: '',
          typeTiers: initialType && initialType !== 'all' ? initialType : 'CLIENT',
          siegePays: 'Algérie',
          devise: 'DZD',
          prospectNiveau: 2,
        });
        setSites([{ nom: '', adresse: '', contacts: [] }]);
        setContactPrincipal({ nom: '' });
        setExtraContacts([]);
      }
    }
  }, [open, tiers, fullTiers, initialType]);

  const { data: modesPaiement } = useQuery({
    queryKey: ['modes-paiement'],
    queryFn: referentielsApi.getModesPaiement,
    enabled: open,
  });

  const { data: conditionsPaiement } = useQuery({
    queryKey: ['conditions-paiement'],
    queryFn: referentielsApi.getConditionsPaiement,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: tiersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      queryClient.invalidateQueries({ queryKey: ['tiers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-active'] });
      queryClient.invalidateQueries({ queryKey: ['contrats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      const details = error?.response?.data?.details;
      const firstDetail = Array.isArray(details) && details.length > 0 ? details[0] : null;
      toast.error(firstDetail ? `${firstDetail.field}: ${firstDetail.message}` : 'Erreur lors de la création du tiers');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTiersInput> }) =>
      tiersApi.update(id, data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      queryClient.invalidateQueries({ queryKey: ['tiers-stats'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-active'] });
      queryClient.invalidateQueries({ queryKey: ['contrats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onOpenChange(false);

      // Afficher une notification si des sites n'ont pas pu être supprimés
      const sitesNotDeleted = response?.sitesNotDeleted;
      if (sitesNotDeleted && sitesNotDeleted.length > 0) {
        const siteNames = sitesNotDeleted.map((s: { nom: string; reason: string }) =>
          `"${s.nom}" (${s.reason})`
        ).join(', ');
        toast.warning(
          `Site(s) non supprimé(s) : ${siteNames}`,
          { duration: 6000 }
        );
      }
    },
    onError: (error: any) => {
      const details = error?.response?.data?.details;
      const firstDetail = Array.isArray(details) && details.length > 0 ? details[0] : null;
      toast.error(firstDetail ? `${firstDetail.field}: ${firstDetail.message}` : 'Erreur lors de la mise à jour du tiers');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare data
    const contactsInput = [contactPrincipal, ...extraContacts]
      .filter(c => c.nom && c.nom.trim())
      .map((c, index) => ({
        ...c,
        estPrincipal: index === 0,
      }));

    const isClientLikeType = formData.typeTiers === 'CLIENT' || formData.typeTiers === 'CLIENT_FOURNISSEUR';

    // Filtrer les sites avec un nom valide
    const filteredSites = isClientLikeType
      ? sites.filter(s => s.nom?.trim())
      : [];

    const submitData: CreateTiersInput = {
      ...formData,
      prospectNiveau: normalizeProspectNiveau(formData.prospectNiveau),
      siegeNom: formData.siegeNom || formData.nomEntreprise,
      contacts: contactsInput,
      // Ne pas envoyer sites si le tableau est vide (pour éviter de supprimer les sites existants)
      sites: filteredSites.length > 0 ? filteredSites : undefined,
    };
    const normalizedSubmitData = normalizeNulls(submitData);

    if (isEdit && tiers) {
      updateMutation.mutate({ id: tiers.id, data: normalizedSubmitData });
    } else {
      createMutation.mutate(normalizedSubmitData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || (isEdit && isLoadingTiers);
  const isClient = formData.typeTiers === 'CLIENT' || formData.typeTiers === 'CLIENT_FOURNISSEUR';
  const isFournisseur = formData.typeTiers === 'FOURNISSEUR' || formData.typeTiers === 'CLIENT_FOURNISSEUR';
  const isProspect = formData.typeTiers === 'PROSPECT';

  const addSite = () => {
    setSites(prev => [{ nom: '', adresse: '', pays: 'Algérie', contacts: [] }, ...prev]);
  };

  const removeSite = (index: number) => {
    setSites(prev => prev.filter((_, i) => i !== index));
  };

  const updateSite = (index: number, field: keyof SiteInput, value: string | number) => {
    setSites(prev => prev.map((site, i) =>
      i === index ? { ...site, [field]: value } : site
    ));
  };

  const handleSiteGeoSelect = useCallback((index: number, geo: GeoSelection) => {
    setSites(prev => prev.map((site, i) =>
      i === index ? { ...site, ville: geo.ville, codePostal: geo.codePostal, latitude: geo.latitude, longitude: geo.longitude } : site
    ));
  }, []);

  const addExtraContact = () => {
    setExtraContacts(prev => [...prev, { nom: '' }]);
  };

  const removeExtraContact = (index: number) => {
    setExtraContacts(prev => prev.filter((_, i) => i !== index));
  };

  const updateExtraContact = (index: number, field: keyof CreateContactInput, value: string) => {
    setExtraContacts(prev => prev.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    ));
  };

  const toggleContactSiteIndex = (contactIndex: number, siteIndex: number) => {
    setExtraContacts(prev => prev.map((c, i) => {
      if (i !== contactIndex) return c;
      const current = c.siteIndices ?? [];
      const next = current.includes(siteIndex)
        ? current.filter(s => s !== siteIndex)
        : [...current, siteIndex];
      return { ...c, siteIndices: next };
    }));
  };

  const toggleContactPrincipalSiteIndex = (siteIndex: number) => {
    setContactPrincipal(prev => {
      const current = prev.siteIndices ?? [];
      const next = current.includes(siteIndex)
        ? current.filter(s => s !== siteIndex)
        : [...current, siteIndex];
      return { ...prev, siteIndices: next };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier le tiers' : 'Nouveau tiers'}
          </DialogTitle>
        </DialogHeader>

        {isEdit && isLoadingTiers ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement des données...</p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Type de tiers</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['CLIENT', 'FOURNISSEUR', 'CLIENT_FOURNISSEUR', 'PROSPECT'] as TypeTiers[]).map((type) => {
                const config = TYPE_TIERS_CONFIG[type];
                const Icon = config.icon;
                const isSelected = formData.typeTiers === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, typeTiers: type })}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      isSelected
                        ? `${config.borderColor} ${config.bgColor} border-2`
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <Icon className={cn('h-6 w-6', isSelected ? config.color : 'text-gray-400')} />
                    <span className={cn('text-sm font-medium', isSelected ? config.color : 'text-gray-600')}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Info */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Informations principales
            </h3>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Nom de l'entreprise <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.nomEntreprise}
                  onChange={(e) => setFormData({ ...formData, nomEntreprise: e.target.value })}
                  placeholder="Raison sociale"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Nom commercial / Enseigne</Label>
                <Input
                  value={formData.nomAlias || ''}
                  onChange={(e) => setFormData({ ...formData, nomAlias: e.target.value })}
                  placeholder="Optionnel"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={formData.siegeTel || ''}
                    onChange={(e) => setFormData({ ...formData, siegeTel: e.target.value })}
                    placeholder="+213..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.siegeEmail || ''}
                    onChange={(e) => setFormData({ ...formData, siegeEmail: e.target.value })}
                    placeholder="contact@exemple.dz"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Address Section */}
          <CollapsibleSection title="Adresse" icon={<MapPin className="h-4 w-4" />}>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Textarea
                  value={formData.siegeAdresse || ''}
                  onChange={(e) => setFormData({ ...formData, siegeAdresse: e.target.value })}
                  placeholder="Rue, numéro..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input
                    value={formData.siegeCodePostal || ''}
                    onChange={(e) => setFormData({ ...formData, siegeCodePostal: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input
                    value={formData.siegeVille || ''}
                    onChange={(e) => setFormData({ ...formData, siegeVille: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pays</Label>
                  <Input
                    value={formData.siegePays || ''}
                    onChange={(e) => setFormData({ ...formData, siegePays: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Contact Principal */}
          <CollapsibleSection title="Contact principal" icon={<Users className="h-4 w-4" />}>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={contactPrincipal.nom || ''}
                    onChange={(e) => setContactPrincipal({ ...contactPrincipal, nom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fonction</Label>
                  <Input
                    value={contactPrincipal.fonction || ''}
                    onChange={(e) => setContactPrincipal({ ...contactPrincipal, fonction: e.target.value })}
                    placeholder="Ex: Directeur"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={contactPrincipal.tel || ''}
                    onChange={(e) => setContactPrincipal({ ...contactPrincipal, tel: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={contactPrincipal.email || ''}
                    onChange={(e) => setContactPrincipal({ ...contactPrincipal, email: e.target.value })}
                  />
                </div>
              </div>
              {isClient && sites.filter(s => s.nom?.trim()).length > 0 && (
                <div className="pt-3 border-t space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Rattacher à un site spécifique</Label>
                  <div className="flex flex-col gap-2">
                    {sites.map((s, sIdx) => {
                      const label = s.nom?.trim() || `Site ${sites.length - sIdx}`;
                      const checked = (contactPrincipal.siteIndices ?? []).includes(sIdx);
                      return (
                        <label key={sIdx} className="flex items-center gap-2.5 cursor-pointer group">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleContactPrincipalSiteIndex(sIdx)}
                          />
                          <span className={cn('text-sm', checked ? 'font-medium text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">Sans sélection → contact visible sur tous les sites</p>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Autres contacts */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Autres contacts
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addExtraContact}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un contact
              </Button>
            </div>

            {extraContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun contact supplémentaire</p>
            ) : (
              <div className="space-y-3">
                {extraContacts.map((contact, index) => (
                  <div key={index} className="p-3 bg-white rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Contact {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExtraContact(index)}
                        className="text-red-500 h-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input
                          value={contact.nom || ''}
                          onChange={(e) => updateExtraContact(index, 'nom', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fonction</Label>
                        <Input
                          value={contact.fonction || ''}
                          onChange={(e) => updateExtraContact(index, 'fonction', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input
                          value={contact.tel || ''}
                          onChange={(e) => updateExtraContact(index, 'tel', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={contact.email || ''}
                          onChange={(e) => updateExtraContact(index, 'email', e.target.value)}
                        />
                      </div>
                    </div>
                    {isClient && sites.filter(s => s.nom?.trim()).length > 0 && (
                      <div className="pt-3 border-t space-y-2 col-span-full">
                        <Label className="text-xs font-medium text-muted-foreground">Rattacher à un site spécifique</Label>
                        <div className="flex flex-col gap-2">
                          {sites.map((s, sIdx) => {
                            const label = s.nom?.trim() || `Site ${sites.length - sIdx}`;
                            const checked = (contact.siteIndices ?? []).includes(sIdx);
                            return (
                              <label key={sIdx} className="flex items-center gap-2.5 cursor-pointer group">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleContactSiteIndex(index, sIdx)}
                                />
                                <span className={cn('text-sm', checked ? 'font-medium text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>{label}</span>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">Sans sélection → visible sur tous les sites</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CLIENT: Sites Section */}
          {isClient && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2 text-blue-700">
                  <Building2 className="h-4 w-4" />
                  Sites
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addSite}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter un site
                </Button>
              </div>

              {sites.map((site, index) => (
                <div key={index} className="p-4 bg-white rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Site {sites.length - index}</span>
                    {sites.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSite(index)}
                        className="text-red-500 h-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom du site <span className="text-red-500">*</span></Label>
                      <Input
                        value={site.nom}
                        onChange={(e) => updateSite(index, 'nom', e.target.value)}
                        placeholder="Ex: Usine Oued Smar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code du site</Label>
                      <Input
                        value={site.code || ''}
                        onChange={(e) => updateSite(index, 'code', e.target.value)}
                        placeholder="Ex: SITE001"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Adresse officielle</Label>
                    <Input
                      value={site.adresse || ''}
                      onChange={(e) => updateSite(index, 'adresse', e.target.value)}
                      placeholder="Ex: 147 Avenue Mustapha Ali Khodja, Alger"
                    />
                    <div className="space-y-1">
                      <p className="text-[11px] text-gray-400">Position approximative sur la carte</p>
                      <GeocoderSearch
                        hint={site.adresse}
                        onSelect={(geo) => handleSiteGeoSelect(index, geo)}
                      />
                      {(site as any).latitude && (
                        <p className="text-[11px] text-green-600 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Géolocalisé{site.ville ? ` — ${site.ville}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Complément d'adresse</Label>
                    <Input
                      value={site.complement || ''}
                      onChange={(e) => updateSite(index, 'complement', e.target.value)}
                      placeholder="Bâtiment, étage, zone industrielle..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Code postal</Label>
                      <Input
                        value={site.codePostal || ''}
                        onChange={(e) => updateSite(index, 'codePostal', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ville</Label>
                      <Input
                        value={site.ville || ''}
                        onChange={(e) => updateSite(index, 'ville', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pays</Label>
                      <Input
                        value={site.pays || ''}
                        onChange={(e) => updateSite(index, 'pays', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Téléphone</Label>
                      <Input
                        value={site.tel || ''}
                        onChange={(e) => updateSite(index, 'tel', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fax</Label>
                      <Input
                        value={site.fax || ''}
                        onChange={(e) => updateSite(index, 'fax', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={site.email || ''}
                        onChange={(e) => updateSite(index, 'email', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Horaires d'ouverture</Label>
                      <Input
                        value={site.horairesOuverture || ''}
                        onChange={(e) => updateSite(index, 'horairesOuverture', e.target.value)}
                        placeholder="Ex: Lun-Ven 8h-17h"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Accessibilité</Label>
                      <Input
                        value={site.accessibilite || ''}
                        onChange={(e) => updateSite(index, 'accessibilite', e.target.value)}
                        placeholder="Parking, accès camion..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={site.notes || ''}
                      onChange={(e) => updateSite(index, 'notes', e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PROSPECT: Qualification Section */}
          {isProspect && (
            <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h3 className="font-semibold flex items-center gap-2 text-purple-700">
                <UserPlus className="h-4 w-4" />
                Qualification du prospect
              </h3>

              <div className="space-y-2">
                <Label>Niveau d'intérêt</Label>
                <div className="flex gap-3">
                  {PROSPECT_NIVEAUX.map((niveau) => {
                    const Icon = niveau.icon;
                    const isSelected = formData.prospectNiveau === niveau.value;
                    return (
                      <button
                        key={niveau.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, prospectNiveau: niveau.value })}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all',
                          isSelected
                            ? `${niveau.bgColor} border-current ${niveau.color}`
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <Icon className={cn('h-4 w-4', isSelected ? niveau.color : 'text-gray-400')} />
                        <span className={cn('text-sm font-medium', isSelected ? niveau.color : 'text-gray-600')}>
                          {niveau.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Source / Origine</Label>
                <Input
                  value={formData.prospectStatut || ''}
                  onChange={(e) => setFormData({ ...formData, prospectStatut: e.target.value })}
                  placeholder="Ex: Salon professionnel, Recommandation..."
                />
              </div>
            </div>
          )}

          {/* Legal Info */}
          {(isClient || isFournisseur || isProspect) && (
            <CollapsibleSection
              title="Informations légales"
              icon={<FileText className="h-4 w-4" />}
              defaultOpen={isFournisseur}
            >
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Forme juridique</Label>
                    <Select
                      value={formData.formeJuridique || ''}
                      onValueChange={(v) => setFormData({ ...formData, formeJuridique: v as FormeJuridique })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FORME_JURIDIQUE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Secteur d'activité</Label>
                    <SecteurCombobox
                      value={formData.secteur || ''}
                      onChange={(v) => setFormData({ ...formData, secteur: v })}
                    />
                  </div>
                </div>

                {/* RC / NIF */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Registre du Commerce (RC)</Label>
                    <Input
                      value={formData.siegeRC || ''}
                      onChange={(e) => setFormData({ ...formData, siegeRC: e.target.value })}
                      placeholder="Ex: 16/00-0123456B99"
                    />
                    <p className="text-xs text-muted-foreground">Immatriculation au registre du commerce</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Numéro d'Identification Fiscale (NIF)</Label>
                    <Input
                      value={formData.siegeNIF || ''}
                      onChange={(e) => setFormData({ ...formData, siegeNIF: e.target.value })}
                      placeholder="Ex: 001516123456789"
                    />
                    <p className="text-xs text-muted-foreground">Identifiant fiscal délivré par les impôts</p>
                  </div>
                </div>

                {/* AI / NIS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Article d'Imposition (AI)</Label>
                    <Input
                      value={formData.siegeAI || ''}
                      onChange={(e) => setFormData({ ...formData, siegeAI: e.target.value })}
                      placeholder="Ex: 16123456789"
                    />
                    <p className="text-xs text-muted-foreground">Numéro d'article fiscal pour la TVA</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Numéro d'Identification Statistique (NIS)</Label>
                    <Input
                      value={formData.siegeNIS || ''}
                      onChange={(e) => setFormData({ ...formData, siegeNIS: e.target.value })}
                      placeholder="Ex: 001516123456789123"
                    />
                    <p className="text-xs text-muted-foreground">Identifiant statistique délivré par l'ONS</p>
                  </div>
                </div>

                {/* TIN / NIN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tax Identification Number (TIN)</Label>
                    <Input
                      value={formData.siegeTIN || ''}
                      onChange={(e) => setFormData({ ...formData, siegeTIN: e.target.value })}
                      placeholder="Ex: 123456789"
                    />
                    <p className="text-xs text-muted-foreground">Identifiant fiscal pour les échanges internationaux</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Numéro d'Identification Nationale (NIN)</Label>
                    <Input
                      value={formData.siegeNIN || ''}
                      onChange={(e) => setFormData({ ...formData, siegeNIN: e.target.value })}
                      placeholder="Ex: 123456789012345"
                    />
                    <p className="text-xs text-muted-foreground">NIN du gérant</p>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Commercial (for Fournisseur) */}
          {isFournisseur && (
            <CollapsibleSection title="Conditions commerciales" icon={<CreditCard className="h-4 w-4" />}>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mode de paiement</Label>
                    <Select
                      value={formData.modePaiementId || ''}
                      onValueChange={(v) => setFormData({ ...formData, modePaiementId: v || undefined })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {modesPaiement?.map((mode) => (
                          <SelectItem key={mode.id} value={mode.id}>
                            {mode.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Conditions de paiement</Label>
                    <Select
                      value={formData.conditionPaiementId || ''}
                      onValueChange={(v) => setFormData({ ...formData, conditionPaiementId: v || undefined })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {conditionsPaiement?.map((cond) => (
                          <SelectItem key={cond.id} value={cond.id}>
                            {cond.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Notes */}
          <CollapsibleSection title="Notes" icon={<FileText className="h-4 w-4" />}>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Notes internes</Label>
                <Textarea
                  value={formData.notePrivee || ''}
                  onChange={(e) => setFormData({ ...formData, notePrivee: e.target.value })}
                  placeholder="Notes visibles uniquement en interne..."
                  rows={3}
                />
              </div>
            </div>
          </CollapsibleSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending || !formData.nomEntreprise}>
              {isPending ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer le tiers'}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============ TIERS DETAIL SHEET ============
function TiersDetailDialog({
  open,
  onOpenChange,
  tiersId,
  canEdit,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiersId?: string;
  canEdit: boolean;
  onEdit: (tiers: Tiers) => void;
}) {
  const { data: tiers, isLoading } = useQuery({
    queryKey: ['tiers', tiersId],
    queryFn: () => tiersApi.get(tiersId!),
    enabled: !!tiersId && open,
  });

  if (!tiersId) return null;

  const config = tiers ? TYPE_TIERS_CONFIG[tiers.typeTiers] : null;
  const prospectNiveau = tiers?.typeTiers === 'PROSPECT' && tiers.prospectNiveau
    ? PROSPECT_NIVEAUX.find(n => n.value === tiers.prospectNiveau)
    : null;

  const handleEdit = () => {
    if (tiers) {
      onEdit(tiers);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pr-10">
          <div className="flex items-center justify-between">
            <DialogTitle>Fiche tiers</DialogTitle>
            {canEdit && tiers && (
              <Button size="sm" variant="outline" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
          </div>
          <DialogDescription>
            {tiers ? `Détails de ${tiers.nomEntreprise}` : 'Chargement...'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">Chargement...</div>
        ) : tiers ? (
          <div className="space-y-6 mt-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className={cn('p-3 rounded-lg', config?.bgColor)}>
                <Building2 className={cn('h-8 w-8', config?.color)} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{tiers.nomEntreprise}</h2>
                {tiers.nomAlias && (
                  <p className="text-muted-foreground">{tiers.nomAlias}</p>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge className={cn(config?.bgColor, config?.color)}>
                    {config?.label}
                  </Badge>
                  {tiers.code && tiers.typeTiers !== 'FOURNISSEUR' && (
                    <Badge variant="outline" className="font-mono">
                      {tiers.code}
                    </Badge>
                  )}
                  {!tiers.actif && (
                    <Badge variant="destructive">Inactif</Badge>
                  )}
                  {tiers.typeTiers === 'PROSPECT' && prospectNiveau && (
                    <Badge className={cn(prospectNiveau.bgColor, prospectNiveau.color)}>
                      <prospectNiveau.icon className="h-3 w-3 mr-1" />
                      {prospectNiveau.label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="font-semibold border-b pb-2">Coordonnées</h3>
              {tiers.siegeAdresse && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p>{tiers.siegeAdresse}</p>
                    <p>{tiers.siegeCodePostal} {tiers.siegeVille}</p>
                    <p>{tiers.siegePays}</p>
                  </div>
                </div>
              )}
              {tiers.siegeTel && (
                <a
                  href={`tel:${tiers.siegeTel}`}
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  <span>{tiers.siegeTel}</span>
                </a>
              )}
              {tiers.siegeEmail && (
                <a
                  href={`mailto:${tiers.siegeEmail}`}
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  <span>{tiers.siegeEmail}</span>
                </a>
              )}
            </div>

            {/* Legal Info */}
            {(tiers.formeJuridique || tiers.siegeRC || tiers.siegeNIF || tiers.siegeTIN || tiers.siegeAI || tiers.siegeNIS || tiers.siegeNIN) && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Informations légales</h3>
                <div className="rounded-lg border bg-white p-4 space-y-4">
                  {tiers.formeJuridique && (
                    <div className="flex items-center justify-between gap-3 pb-3 border-b">
                      <span className="text-sm text-muted-foreground">Forme juridique</span>
                      <span className="text-sm font-semibold">{tiers.formeJuridique}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tiers.siegeRC && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-foreground">RC</p>
                        <p className="text-sm text-foreground break-all">{tiers.siegeRC}</p>
                      </div>
                    )}
                    {tiers.siegeNIF && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-foreground">NIF</p>
                        <p className="text-sm text-foreground break-all">{tiers.siegeNIF}</p>
                      </div>
                    )}
                    {tiers.siegeTIN && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-foreground">TIN</p>
                        <p className="text-sm text-foreground break-all">{tiers.siegeTIN}</p>
                      </div>
                    )}
                    {tiers.siegeAI && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-foreground">AI</p>
                        <p className="text-sm text-foreground break-all">{tiers.siegeAI}</p>
                      </div>
                    )}
                    {tiers.siegeNIS && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-foreground">NIS</p>
                        <p className="text-sm text-foreground break-all">{tiers.siegeNIS}</p>
                      </div>
                    )}
                    {tiers.siegeNIN && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-foreground">NIN</p>
                        <p className="text-sm text-foreground break-all">{tiers.siegeNIN}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sites (for clients) */}
            {tiers.sites && tiers.sites.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Sites ({tiers.sites.length})
                </h3>
                <div className="grid gap-3">
                  {tiers.sites.map((site) => (
                    <div key={site.id} className="p-4 bg-gradient-to-r from-blue-50 to-white rounded-lg border border-blue-100">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-blue-900">{site.nom}</div>
                            {site.adresse && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {site.adresse}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {site._count && (
                            <div className="flex gap-2">
                              {site._count.contratSites > 0 && (
                                <Badge variant="outline" className="text-xs bg-white">
                                  {site._count.contratSites} contrat(s)
                                </Badge>
                              )}
                              {site._count.interventions > 0 && (
                                <Badge variant="outline" className="text-xs bg-white">
                                  {site._count.interventions} interv.
                                </Badge>
                              )}
                            </div>
                          )}
                          <Link to={`/sites/${site.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                              Zoning & Terrain
                            </Button>
                          </Link>
                        </div>
                      </div>
                      {(site.tel || site.email) && (
                        <div className="flex gap-4 mt-3 ml-10 text-sm">
                          {site.tel && (
                            <a href={`tel:${site.tel}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                              <Phone className="h-3 w-3" />
                              {site.tel}
                            </a>
                          )}
                          {site.email && (
                            <a href={`mailto:${site.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                              <Mail className="h-3 w-3" />
                              {site.email}
                            </a>
                          )}
                        </div>
                      )}
                      {/* Site contacts */}
                      {site.contacts && site.contacts.length > 0 && (
                        <div className="mt-3 ml-10 pt-3 border-t border-blue-100 space-y-2">
                          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Contact{site.contacts.length > 1 ? 's' : ''} du site
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {site.contacts.map((contact: any) => (
                              <div key={contact.id} className="flex items-start gap-2 bg-white px-3 py-2 rounded-lg border text-sm">
                                <div className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0',
                                  contact.estPrincipal ? 'bg-blue-600' : 'bg-gray-400'
                                )}>
                                  {(contact.prenom?.[0] || contact.nom?.[0] || '?').toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-semibold truncate">{contact.civilite ? `${contact.civilite} ` : ''}{contact.prenom} {contact.nom}</span>
                                    {contact.estPrincipal && <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1 py-0">Principal</Badge>}
                                  </div>
                                  {contact.fonction && <p className="text-xs text-muted-foreground">{contact.fonction}</p>}
                                  <div className="flex flex-col gap-0.5 mt-1">
                                    {contact.tel && (
                                      <a href={`tel:${contact.tel}`} className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                                        <Phone className="h-3 w-3" />{contact.tel}
                                      </a>
                                    )}
                                    {contact.telMobile && contact.telMobile !== contact.tel && (
                                      <a href={`tel:${contact.telMobile}`} className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                                        <Phone className="h-3 w-3" />{contact.telMobile}
                                      </a>
                                    )}
                                    {contact.email && (
                                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-blue-600 hover:underline text-xs truncate">
                                        <Mail className="h-3 w-3 flex-shrink-0" /><span className="truncate">{contact.email}</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contacts siège (tous sites) */}
            {tiers.siegeContacts && tiers.siegeContacts.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Contacts généraux
                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">Tous sites</Badge>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tiers.siegeContacts.map((contact) => (
                    <div key={contact.id} className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
                          contact.estPrincipal ? "bg-primary" : "bg-gray-400"
                        )}>
                          {(contact.prenom?.[0] || contact.nom?.[0] || '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">
                              {contact.civilite ? `${contact.civilite} ` : ''}{contact.prenom} {contact.nom}
                            </span>
                            {contact.estPrincipal && (
                              <Badge className="bg-primary/10 text-primary text-xs">Principal</Badge>
                            )}
                          </div>
                          {contact.fonction && (
                            <p className="text-sm text-muted-foreground">{contact.fonction}</p>
                          )}
                          <div className="flex flex-col gap-1 mt-2 text-sm">
                            {contact.tel && (
                              <a href={`tel:${contact.tel}`} className="flex items-center gap-1 text-primary hover:underline">
                                <Phone className="h-3 w-3" />
                                {contact.tel}
                              </a>
                            )}
                            {contact.telMobile && contact.telMobile !== contact.tel && (
                              <a href={`tel:${contact.telMobile}`} className="flex items-center gap-1 text-primary hover:underline">
                                <Phone className="h-3 w-3" />
                                {contact.telMobile} (mobile)
                              </a>
                            )}
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary hover:underline truncate">
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{contact.email}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bank Accounts */}
            {tiers.comptesBancaires && tiers.comptesBancaires.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Comptes bancaires ({tiers.comptesBancaires.length})
                </h3>
                <div className="grid gap-3">
                  {tiers.comptesBancaires.map((compte) => (
                    <div key={compte.id} className="p-4 bg-gradient-to-r from-purple-50 to-white rounded-lg border border-purple-100">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-purple-900">{compte.libelle}</div>
                            <p className="text-sm text-muted-foreground">
                              {compte.banque} {compte.agence && `- ${compte.agence}`}
                            </p>
                          </div>
                        </div>
                        {compte.estDefaut && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">Par défaut</Badge>
                        )}
                      </div>
                      {(compte.iban || compte.cleRib) && (
                        <div className="mt-3 ml-13 space-y-1 text-sm font-mono bg-white p-2 rounded border">
                          {compte.iban && <p><span className="text-muted-foreground">IBAN:</span> {compte.iban}</p>}
                          {compte.cleRib && <p><span className="text-muted-foreground">RIB:</span> {compte.cleRib}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="space-y-3">
              <h3 className="font-semibold border-b pb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Activité
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-100 text-center">
                  <p className="text-3xl font-bold text-green-700">{tiers.contrats?.length || 0}</p>
                  <p className="text-sm text-green-600 font-medium">Contrats</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-orange-50 to-white rounded-lg border border-orange-100 text-center">
                  <p className="text-3xl font-bold text-orange-700">{tiers.interventions?.length || 0}</p>
                  <p className="text-sm text-orange-600 font-medium">Interventions</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {tiers.notePrivee && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {tiers.notePrivee}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
