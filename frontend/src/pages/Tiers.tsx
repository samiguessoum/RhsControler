import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Users,
  UserPlus,
  Truck,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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

const PROSPECT_NIVEAUX = [
  { value: 3, label: 'Chaud', icon: Flame, color: 'text-red-600', bgColor: 'bg-red-100' },
  { value: 2, label: 'Tiède', icon: Thermometer, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  { value: 1, label: 'Froid', icon: Snowflake, color: 'text-blue-600', bgColor: 'bg-blue-100' },
];

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
  const Icon = config.icon;
  const prospectNiveau = PROSPECT_NIVEAUX.find(n => n.value === tiers.prospectNiveau);

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-all cursor-pointer border-l-4',
        config.borderColor
      )}
      onClick={onView}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', config.bgColor)}>
              <Icon className={cn('h-5 w-5', config.color)} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{tiers.nomEntreprise}</CardTitle>
              {tiers.nomAlias && (
                <p className="text-xs text-muted-foreground truncate">{tiers.nomAlias}</p>
              )}
            </div>
          </div>
          <Badge className={cn(config.bgColor, config.color, 'text-xs')}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Location */}
        {tiers.siegeVille && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{tiers.siegeVille}</span>
          </div>
        )}

        {/* Contact info - clickable */}
        <div className="space-y-1">
          {tiers.siegeTel && (
            <a
              href={`tel:${tiers.siegeTel}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Phone className="h-4 w-4 flex-shrink-0" />
              <span>{tiers.siegeTel}</span>
            </a>
          )}
          {tiers.siegeEmail && (
            <a
              href={`mailto:${tiers.siegeEmail}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors truncate"
            >
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{tiers.siegeEmail}</span>
            </a>
          )}
        </div>

        {/* Type-specific info */}
        <div className="pt-2 border-t">
          {tiers.typeTiers === 'CLIENT' && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {tiers.sites && tiers.sites.length > 0 && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {tiers.sites.length} site(s)
                </span>
              )}
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {tiers._count?.contrats || 0} contrat(s)
              </span>
            </div>
          )}

          {tiers.typeTiers === 'FOURNISSEUR' && (
            <div className="text-xs text-muted-foreground">
              {tiers.siegeRC && <span>RC: {tiers.siegeRC}</span>}
            </div>
          )}

          {tiers.typeTiers === 'PROSPECT' && prospectNiveau && (
            <div className="flex items-center justify-between">
              <Badge className={cn(prospectNiveau.bgColor, prospectNiveau.color, 'text-xs')}>
                <prospectNiveau.icon className="h-3 w-3 mr-1" />
                {prospectNiveau.label}
              </Badge>
              {canEdit && onConvert && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConvert();
                  }}
                >
                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                  Convertir
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
          <Tooltip content="Voir les détails">
            <Button size="sm" variant="ghost" onClick={onView}>
              <Eye className="h-4 w-4" />
            </Button>
          </Tooltip>
          {canEdit && (
            <Tooltip content="Modifier">
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip content="Supprimer">
              <Button size="sm" variant="ghost" className="text-red-500" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ MAIN PAGE ============
export default function TiersPage() {
  const { canDo } = useAuthStore();
  const canCreate = canDo('createClient');
  const canEdit = canDo('editClient');
  const canDelete = canDo('deleteClient');
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTiers, setEditingTiers] = useState<Tiers | null>(null);
  const [viewingTiers, setViewingTiers] = useState<Tiers | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tiers | null>(null);
  const [convertTarget, setConvertTarget] = useState<Tiers | null>(null);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['tiers-stats'],
    queryFn: tiersApi.getStats,
  });

  // Fetch tiers list
  const typeTiersFilter = activeTab === 'all' ? undefined : activeTab as TypeTiers;
  const { data: tiersData, isLoading } = useQuery({
    queryKey: ['tiers', typeTiersFilter, search],
    queryFn: () => tiersApi.list({ typeTiers: typeTiersFilter, search: search || undefined, limit: 100 }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: tiersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      queryClient.invalidateQueries({ queryKey: ['tiers-stats'] });
      setDeleteTarget(null);
    },
  });

  // Convert prospect mutation
  const convertMutation = useMutation({
    mutationFn: tiersApi.convertirProspect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      queryClient.invalidateQueries({ queryKey: ['tiers-stats'] });
      setConvertTarget(null);
    },
  });

  const tiersList = tiersData?.tiers || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tiers</h1>
          <p className="text-muted-foreground">
            Gestion des clients, fournisseurs et prospects
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau tiers
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={cn(
            'cursor-pointer hover:shadow-md transition-all',
            activeTab === 'CLIENT' && 'ring-2 ring-blue-500'
          )}
          onClick={() => setActiveTab('CLIENT')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.clients.actifs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.clients.total || 0} total
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'cursor-pointer hover:shadow-md transition-all',
            activeTab === 'FOURNISSEUR' && 'ring-2 ring-orange-500'
          )}
          onClick={() => setActiveTab('FOURNISSEUR')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fournisseurs</CardTitle>
            <Truck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.fournisseurs.actifs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.fournisseurs.total || 0} total
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'cursor-pointer hover:shadow-md transition-all',
            activeTab === 'PROSPECT' && 'ring-2 ring-purple-500'
          )}
          onClick={() => setActiveTab('PROSPECT')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospects</CardTitle>
            <UserPlus className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.prospects.actifs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.prospects.total || 0} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs, Search and View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="CLIENT">Clients</TabsTrigger>
            <TabsTrigger value="FOURNISSEUR">Fournisseurs</TabsTrigger>
            <TabsTrigger value="PROSPECT">Prospects</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* View Toggle */}
          <div className="flex border rounded-md">
            <Tooltip content="Vue cartes">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Vue liste">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : tiersList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {search ? 'Aucun tiers trouvé pour cette recherche' : 'Aucun tiers enregistré'}
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiersList.map((tiers) => {
                const config = TYPE_TIERS_CONFIG[tiers.typeTiers];
                return (
                  <TableRow key={tiers.id} className="cursor-pointer hover:bg-gray-50">
                    <TableCell>
                      <div>
                        <div className="font-medium">{tiers.nomEntreprise}</div>
                        {tiers.nomAlias && (
                          <div className="text-xs text-muted-foreground">{tiers.nomAlias}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(config.bgColor, config.color)}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{tiers.siegeVille || '-'}</TableCell>
                    <TableCell>
                      {tiers.siegeTel ? (
                        <a
                          href={`tel:${tiers.siegeTel}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {tiers.siegeTel}
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {tiers.siegeEmail ? (
                        <a
                          href={`mailto:${tiers.siegeEmail}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {tiers.siegeEmail}
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip content="Voir">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingTiers(tiers)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        {canEdit && (
                          <Tooltip content="Modifier">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingTiers(tiers)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        )}
                        {tiers.typeTiers === 'PROSPECT' && canEdit && (
                          <Tooltip content="Convertir en client">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600"
                              onClick={() => setConvertTarget(tiers)}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip content="Supprimer">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500"
                              onClick={() => setDeleteTarget(tiers)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
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
      />

      {/* View Sheet */}
      <TiersDetailSheet
        open={!!viewingTiers}
        onOpenChange={(open) => !open && setViewingTiers(null)}
        tiersId={viewingTiers?.id}
        canEdit={canEdit}
        onEdit={() => {
          if (viewingTiers) {
            setEditingTiers(viewingTiers);
            setViewingTiers(null);
          }
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
  );
}

// ============ UNIFIED FORM DIALOG ============
function TiersFormDialog({
  open,
  onOpenChange,
  tiers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiers: Tiers | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!tiers;

  const [formData, setFormData] = useState<CreateTiersInput>({
    nomEntreprise: '',
    typeTiers: 'CLIENT',
  });

  const [sites, setSites] = useState<SiteInput[]>([]);
  const [contactPrincipal, setContactPrincipal] = useState<CreateContactInput>({
    nom: '',
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (tiers) {
        setFormData({
          nomEntreprise: tiers.nomEntreprise,
          nomAlias: tiers.nomAlias,
          typeTiers: tiers.typeTiers,
          formeJuridique: tiers.formeJuridique,
          siegeRC: tiers.siegeRC,
          siegeNIF: tiers.siegeNIF,
          siegeAI: tiers.siegeAI,
          siegeNIS: tiers.siegeNIS,
          tvaIntracom: tiers.tvaIntracom,
          capital: tiers.capital,
          siegeNom: tiers.siegeNom,
          siegeAdresse: tiers.siegeAdresse,
          siegeCodePostal: tiers.siegeCodePostal,
          siegeVille: tiers.siegeVille,
          siegePays: tiers.siegePays || 'Algérie',
          siegeTel: tiers.siegeTel,
          siegeFax: tiers.siegeFax,
          siegeEmail: tiers.siegeEmail,
          siegeWebsite: tiers.siegeWebsite,
          secteur: tiers.secteur,
          remiseParDefaut: tiers.remiseParDefaut,
          encoursMaximum: tiers.encoursMaximum,
          devise: tiers.devise || 'DZD',
          notePublique: tiers.notePublique,
          notePrivee: tiers.notePrivee,
          prospectNiveau: tiers.prospectNiveau,
          prospectStatut: tiers.prospectStatut,
        });
        setSites(tiers.sites?.map(s => ({
          nom: s.nom,
          adresse: s.adresse,
          tel: s.tel,
          email: s.email,
          notes: s.notes,
        })) || []);
        setContactPrincipal(tiers.siegeContacts?.[0] || { nom: '' });
      } else {
        setFormData({
          nomEntreprise: '',
          typeTiers: 'CLIENT',
          siegePays: 'Algérie',
          devise: 'DZD',
          prospectNiveau: 2,
        });
        setSites([{ nom: '', adresse: '', contacts: [] }]);
        setContactPrincipal({ nom: '' });
      }
    }
  }, [open, tiers]);

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
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTiersInput> }) =>
      tiersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      queryClient.invalidateQueries({ queryKey: ['tiers-stats'] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare data
    const submitData: CreateTiersInput = {
      ...formData,
      siegeNom: formData.siegeNom || formData.nomEntreprise,
      contacts: contactPrincipal.nom ? [{ ...contactPrincipal, estPrincipal: true }] : [],
      sites: formData.typeTiers === 'CLIENT'
        ? sites.filter(s => s.nom?.trim())
        : undefined,
    };

    if (isEdit && tiers) {
      updateMutation.mutate({ id: tiers.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isClient = formData.typeTiers === 'CLIENT';
  const isFournisseur = formData.typeTiers === 'FOURNISSEUR';
  const isProspect = formData.typeTiers === 'PROSPECT';

  const addSite = () => {
    setSites(prev => [...prev, { nom: '', adresse: '', contacts: [] }]);
  };

  const removeSite = (index: number) => {
    setSites(prev => prev.filter((_, i) => i !== index));
  };

  const updateSite = (index: number, field: keyof SiteInput, value: string) => {
    setSites(prev => prev.map((site, i) =>
      i === index ? { ...site, [field]: value } : site
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier le tiers' : 'Nouveau tiers'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Type de tiers</Label>
            <div className="grid grid-cols-3 gap-3">
              {(['CLIENT', 'FOURNISSEUR', 'PROSPECT'] as TypeTiers[]).map((type) => {
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-3 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
            </div>
          </CollapsibleSection>

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
                    <span className="text-sm font-medium">Site {index + 1}</span>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom du site <span className="text-red-500">*</span></Label>
                      <Input
                        value={site.nom}
                        onChange={(e) => updateSite(index, 'nom', e.target.value)}
                        placeholder="Ex: Usine Oued Smar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Adresse</Label>
                      <Input
                        value={site.adresse || ''}
                        onChange={(e) => updateSite(index, 'adresse', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Téléphone</Label>
                      <Input
                        value={site.tel || ''}
                        onChange={(e) => updateSite(index, 'tel', e.target.value)}
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

          {/* Legal Info (for Client & Fournisseur) */}
          {(isClient || isFournisseur) && (
            <CollapsibleSection
              title="Informations légales"
              icon={<FileText className="h-4 w-4" />}
              defaultOpen={isFournisseur}
            >
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <Input
                      value={formData.secteur || ''}
                      onChange={(e) => setFormData({ ...formData, secteur: e.target.value })}
                      placeholder="Ex: BTP, Agroalimentaire..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>RC (Registre du Commerce)</Label>
                    <Input
                      value={formData.siegeRC || ''}
                      onChange={(e) => setFormData({ ...formData, siegeRC: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>NIF</Label>
                    <Input
                      value={formData.siegeNIF || ''}
                      onChange={(e) => setFormData({ ...formData, siegeNIF: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>AI (Article d'Imposition)</Label>
                    <Input
                      value={formData.siegeAI || ''}
                      onChange={(e) => setFormData({ ...formData, siegeAI: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>NIS</Label>
                    <Input
                      value={formData.siegeNIS || ''}
                      onChange={(e) => setFormData({ ...formData, siegeNIS: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Commercial (for Fournisseur) */}
          {isFournisseur && (
            <CollapsibleSection title="Conditions commerciales" icon={<CreditCard className="h-4 w-4" />}>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
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
      </DialogContent>
    </Dialog>
  );
}

// ============ TIERS DETAIL SHEET ============
function TiersDetailSheet({
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
  onEdit: () => void;
}) {
  const { data: tiers, isLoading } = useQuery({
    queryKey: ['tiers', tiersId],
    queryFn: () => tiersApi.get(tiersId!),
    enabled: !!tiersId && open,
  });

  if (!tiersId) return null;

  const config = tiers ? TYPE_TIERS_CONFIG[tiers.typeTiers] : null;
  const prospectNiveau = tiers?.prospectNiveau
    ? PROSPECT_NIVEAUX.find(n => n.value === tiers.prospectNiveau)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Fiche tiers</span>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

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
                  {tiers.code && (
                    <Badge variant="outline" className="font-mono">
                      {tiers.code}
                    </Badge>
                  )}
                  {!tiers.actif && (
                    <Badge variant="destructive">Inactif</Badge>
                  )}
                  {prospectNiveau && (
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
            {(tiers.siegeRC || tiers.siegeNIF || tiers.siegeAI || tiers.siegeNIS) && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Informations légales</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {tiers.formeJuridique && (
                    <div>
                      <span className="text-muted-foreground">Forme:</span> {tiers.formeJuridique}
                    </div>
                  )}
                  {tiers.siegeRC && (
                    <div>
                      <span className="text-muted-foreground">RC:</span> {tiers.siegeRC}
                    </div>
                  )}
                  {tiers.siegeNIF && (
                    <div>
                      <span className="text-muted-foreground">NIF:</span> {tiers.siegeNIF}
                    </div>
                  )}
                  {tiers.siegeAI && (
                    <div>
                      <span className="text-muted-foreground">AI:</span> {tiers.siegeAI}
                    </div>
                  )}
                  {tiers.siegeNIS && (
                    <div>
                      <span className="text-muted-foreground">NIS:</span> {tiers.siegeNIS}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sites (for clients) */}
            {tiers.sites && tiers.sites.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Sites ({tiers.sites.length})</h3>
                <div className="space-y-2">
                  {tiers.sites.map((site) => (
                    <div key={site.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="font-medium">{site.nom}</div>
                      {site.adresse && (
                        <p className="text-sm text-muted-foreground">{site.adresse}</p>
                      )}
                      <div className="flex gap-4 mt-1 text-sm">
                        {site.tel && (
                          <a href={`tel:${site.tel}`} className="text-primary hover:underline">
                            {site.tel}
                          </a>
                        )}
                        {site.email && (
                          <a href={`mailto:${site.email}`} className="text-primary hover:underline">
                            {site.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contacts */}
            {tiers.siegeContacts && tiers.siegeContacts.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Contacts</h3>
                <div className="space-y-2">
                  {tiers.siegeContacts.map((contact) => (
                    <div key={contact.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {contact.prenom} {contact.nom}
                        </span>
                        {contact.estPrincipal && (
                          <Badge variant="outline" className="text-xs">Principal</Badge>
                        )}
                      </div>
                      {contact.fonction && (
                        <p className="text-sm text-muted-foreground">{contact.fonction}</p>
                      )}
                      <div className="flex gap-4 mt-1 text-sm">
                        {contact.tel && (
                          <a href={`tel:${contact.tel}`} className="text-primary hover:underline">
                            {contact.tel}
                          </a>
                        )}
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                            {contact.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bank Accounts */}
            {tiers.comptesBancaires && tiers.comptesBancaires.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Comptes bancaires</h3>
                <div className="space-y-2">
                  {tiers.comptesBancaires.map((compte) => (
                    <div key={compte.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{compte.libelle}</span>
                        {compte.estDefaut && (
                          <Badge variant="outline" className="text-xs">Par défaut</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {compte.banque} {compte.agence && `- ${compte.agence}`}
                      </p>
                      {compte.iban && (
                        <p className="text-sm font-mono mt-1">IBAN: {compte.iban}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="space-y-3">
              <h3 className="font-semibold border-b pb-2">Statistiques</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{tiers._count?.contrats || 0}</p>
                  <p className="text-sm text-muted-foreground">Contrats</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{tiers._count?.interventions || 0}</p>
                  <p className="text-sm text-muted-foreground">Interventions</p>
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
      </SheetContent>
    </Sheet>
  );
}
