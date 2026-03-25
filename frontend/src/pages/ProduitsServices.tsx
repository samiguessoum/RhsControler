import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  produitsServicesApi,
  categoriesProduitsApi,
  entrepotsApi,
  tiersApi,
} from '@/services/api';
import {
  ProduitService,
  CategorieProduit,
  Entrepot,
  CreateProduitServiceInput,
  CreateCategorieProduitInput,
  CreateEntrepotInput,
  TypeProduit,
  NatureProduit,
  CreateMouvementPSInput,
  TypeMouvementPS,
} from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Package,
  Wrench,
  FolderTree,
  Warehouse,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Barcode,
  Tag,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Boxes,
  ArrowRight,
  FileText,
  Upload,
  ExternalLink,
  Copy,
  Power,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Paperclip,
  ArrowUpRight,
  Layers,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ CONFIGURATION ============

const TYPE_CONFIG: Record<TypeProduit, { label: string; icon: any; color: string; bgColor: string; borderColor: string }> = {
  PRODUIT: { label: 'Produit', icon: Package, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  SERVICE: { label: 'Service', icon: Wrench, color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
};

const NATURE_LABELS: Record<NatureProduit, string> = {
  CONSOMMABLE: 'Consommable',
  EPI: 'EPI (Équipement de Protection)',
  MATERIEL_ANTI_NUISIBLES: 'Matériel anti-nuisibles',
};

const NATURE_DESCRIPTIONS: Record<NatureProduit, string> = {
  CONSOMMABLE: 'Produits chimiques, consommables divers',
  EPI: 'Gants, masques, combinaisons...',
  MATERIEL_ANTI_NUISIBLES: 'Fly killer, pièges, pics pigeons...',
};

const MOUVEMENT_CONFIG: Record<TypeMouvementPS, { label: string; icon: any; color: string }> = {
  ENTREE: { label: 'Entrée', icon: ArrowDownCircle, color: 'text-green-600' },
  SORTIE: { label: 'Sortie', icon: ArrowUpCircle, color: 'text-red-600' },
  AJUSTEMENT: { label: 'Ajustement', icon: RefreshCw, color: 'text-blue-600' },
  TRANSFERT: { label: 'Transfert', icon: ArrowRight, color: 'text-orange-600' },
  INVENTAIRE: { label: 'Inventaire', icon: Tag, color: 'text-purple-600' },
};

const UNITES_OPTIONS = [
  { value: 'unité', label: 'Unité' },
  { value: 'pièce', label: 'Pièce' },
  { value: 'kg', label: 'Kilogramme (kg)' },
  { value: 'g', label: 'Gramme (g)' },
  { value: 'L', label: 'Litre (L)' },
  { value: 'mL', label: 'Millilitre (mL)' },
  { value: 'm', label: 'Mètre (m)' },
  { value: 'm²', label: 'Mètre carré (m²)' },
  { value: 'h', label: 'Heure (h)' },
  { value: 'jour', label: 'Jour' },
  { value: 'forfait', label: 'Forfait' },
  { value: 'autre', label: 'Autre...' },
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

// ============ PRODUIT CARD ============
function getModeAppro(produit: ProduitService): { label: string; className: string; key: string } | null {
  if (produit.type !== 'PRODUIT') return null;
  const mode = produit.modeGestion || (produit.aStock === false ? 'FLUX_TENDU' : 'MIXTE');
  if (mode === 'FLUX_TENDU') return { key: 'FLUX_TENDU', label: 'Flux tendu', className: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (mode === 'STOCKE') return { key: 'STOCKE', label: 'Stocké', className: 'bg-blue-100 text-blue-700 border-blue-200' };
  return { key: 'MIXTE', label: 'Mixte', className: 'bg-purple-100 text-purple-700 border-purple-200' };
}

function ProduitCard({
  produit,
  onView,
  onEdit,
  onDelete,
  onMouvement,
  canManage,
  fournisseurs,
  onOpenFournisseur,
}: {
  produit: ProduitService;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMouvement: () => void;
  canManage: boolean;
  fournisseurs: { id: string; nomEntreprise: string }[];
  onOpenFournisseur: (id: string) => void;
}) {
  const config = TYPE_CONFIG[produit.type];
  const Icon = config.icon;
  const isStockLow = produit.aStock && produit.quantite <= produit.stockMinimum;
  const modeAppro = getModeAppro(produit);

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-all cursor-pointer border-l-4',
        config.borderColor,
        !produit.actif && 'opacity-50'
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
              <CardTitle className="text-base truncate">{produit.nom}</CardTitle>
              <p className="text-xs text-muted-foreground font-mono">{produit.reference}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {produit.ficheTechniqueUrl && (
              <Paperclip className="h-3.5 w-3.5 text-gray-400" title="Fiche technique disponible" />
            )}
            {!produit.actif && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactif</span>
            )}
            <Badge className={cn(config.bgColor, config.color, 'text-xs')}>
              {config.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Code-barres */}
        {produit.codeBarres && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Barcode className="h-3 w-3" />
            <span className="font-mono">{produit.codeBarres}</span>
          </div>
        )}

        {/* Prix */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Prix HT</span>
          <span className="font-medium">
            {produit.prixVenteHT ? `${produit.prixVenteHT.toFixed(2)} DA` : '-'}
          </span>
        </div>

        {/* Stock */}
        {produit.aStock && (
          <div className={cn('p-2.5 rounded-lg space-y-1.5', isStockLow ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50')}>
            <div className="flex items-center justify-between text-sm">
              <span className={cn('flex items-center gap-1', isStockLow ? 'text-orange-700 font-medium' : 'text-muted-foreground')}>
                {isStockLow ? <AlertTriangle className="h-3 w-3" /> : <Boxes className="h-3 w-3" />}
                Stock
              </span>
              <span className={cn('font-bold', isStockLow ? 'text-orange-700' : 'text-gray-800')}>
                {produit.quantite} <span className="font-normal text-xs text-muted-foreground">{produit.unite}</span>
              </span>
            </div>
            {produit.stockMaximum && produit.stockMaximum > 0 && (
              <div className="space-y-0.5">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', isStockLow ? 'bg-orange-400' : 'bg-emerald-400')}
                    style={{ width: `${Math.min(100, (produit.quantite / produit.stockMaximum) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>min {produit.stockMinimum}</span>
                  <span>max {produit.stockMaximum}</span>
                </div>
              </div>
            )}
            {!produit.stockMaximum && produit.stockMinimum > 0 && (
              <p className="text-xs text-muted-foreground">Seuil min: {produit.stockMinimum} {produit.unite}</p>
            )}
          </div>
        )}
        {/* Mode d'approvisionnement */}
        {modeAppro && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Mode appro.</span>
            <Badge variant="outline" className={cn('text-xs', modeAppro.className)}>
              {modeAppro.label}
            </Badge>
          </div>
        )}

        {/* Catégories */}
        {produit.categories && produit.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {produit.categories.slice(0, 2).map((cat) => (
              <Badge
                key={cat.categorie.id}
                variant="outline"
                className="text-xs"
                style={cat.categorie.couleur ? { borderColor: cat.categorie.couleur, color: cat.categorie.couleur } : {}}
              >
                {cat.categorie.nom}
              </Badge>
            ))}
            {produit.categories.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{produit.categories.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Fournisseurs */}
        {produit.type === 'PRODUIT' && fournisseurs.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Fournisseurs</p>
            <div className="flex flex-wrap gap-1">
              {fournisseurs.map((f, index) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenFournisseur(f.id);
                  }}
                  className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-100 transition-colors"
                  title="Ouvrir la fiche fournisseur"
                >
                  {index + 1}. {f.nomEntreprise}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Statut */}
        <div className="flex gap-1 pt-1">
          {produit.enVente && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-200">Vente</Badge>
          )}
          {produit.enAchat && (
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">Achat</Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
          <Tooltip content="Voir les détails">
            <Button size="sm" variant="ghost" onClick={onView}>
              <Eye className="h-4 w-4" />
            </Button>
          </Tooltip>
          {produit.aStock && canManage && (
            <Tooltip content="Mouvement de stock">
              <Button size="sm" variant="ghost" onClick={onMouvement}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
          {canManage && (
            <>
              <Tooltip content="Modifier">
                <Button size="sm" variant="ghost" onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content="Supprimer">
                <Button size="sm" variant="ghost" className="text-red-500" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Tooltip>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ MAIN COMPONENT ============
export default function ProduitsServices() {
  const { canDo } = useAuthStore();
  const canManage = canDo('manageStock');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('produits');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeProduit | 'all'>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'vente' | 'prestation'>('all');
  const [categorieFilter, setCategorieFilter] = useState<string>('all');
  const [approFilter, setApproFilter] = useState<'all' | 'FLUX_TENDU' | 'MIXTE' | 'STOCKE'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');

  // Modals
  const [showProduitModal, setShowProduitModal] = useState(false);
  const [showCategorieModal, setShowCategorieModal] = useState(false);
  const [showEntrepotModal, setShowEntrepotModal] = useState(false);
  const [showMouvementModal, setShowMouvementModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Edit/Delete state
  const [editingProduit, setEditingProduit] = useState<ProduitService | null>(null);
  const [editingCategorie, setEditingCategorie] = useState<CategorieProduit | null>(null);
  const [editingEntrepot, setEditingEntrepot] = useState<Entrepot | null>(null);
  const [selectedProduit, setSelectedProduit] = useState<ProduitService | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'produit' | 'categorie' | 'entrepot'; item: any } | null>(null);

  // ============ QUERIES ============

  const { data: produitsData, isLoading: loadingProduits } = useQuery({
    queryKey: ['produits-services', search, typeFilter, categorieFilter],
    queryFn: () => produitsServicesApi.list({
      search: search || undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      categorieId: categorieFilter !== 'all' ? categorieFilter : undefined,
      limit: 100,
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['produits-services-stats'],
    queryFn: () => produitsServicesApi.getStats(),
  });

  const { data: alertes } = useQuery({
    queryKey: ['produits-services-alertes'],
    queryFn: () => produitsServicesApi.getAlertes(),
  });

  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ['categories-produits'],
    queryFn: () => categoriesProduitsApi.list({ actif: true }),
  });

  const { data: entrepots } = useQuery({
    queryKey: ['entrepots'],
    queryFn: () => entrepotsApi.list({ actif: true }),
  });

  const { data: fournisseurs } = useQuery({
    queryKey: ['tiers-fournisseurs'],
    queryFn: () => tiersApi.list({ typeTiers: 'FOURNISSEUR', actif: true, limit: 100 }),
  });

  // ============ MUTATIONS ============

  const createProduitMutation = useMutation({
    mutationFn: (data: CreateProduitServiceInput) => produitsServicesApi.create(data),
    onSuccess: async (createdProduit) => {
      if (pendingFicheTechnique) {
        try {
          await produitsServicesApi.uploadFicheTechnique(createdProduit.id, pendingFicheTechnique);
        } catch {
          toast.error('Produit créé, mais erreur lors de l\'upload de la fiche technique');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['produits-services'] });
      queryClient.invalidateQueries({ queryKey: ['produits-services-stats'] });
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      toast.success('Produit/Service créé');
      setShowProduitModal(false);
      resetProduitForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateProduitMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProduitServiceInput & { actif: boolean }> }) =>
      produitsServicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produits-services'] });
      queryClient.invalidateQueries({ queryKey: ['produits-services-stats'] });
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      toast.success('Produit/Service mis à jour');
      setShowProduitModal(false);
      setEditingProduit(null);
      resetProduitForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteProduitMutation = useMutation({
    mutationFn: (id: string) => produitsServicesApi.delete(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['produits-services'] });
      queryClient.invalidateQueries({ queryKey: ['produits-services-stats'] });
      toast.success(data.message);
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const createCategorieMutation = useMutation({
    mutationFn: (data: CreateCategorieProduitInput) => categoriesProduitsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-produits'] });
      toast.success('Catégorie créée');
      setShowCategorieModal(false);
      resetCategorieForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateCategorieMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCategorieProduitInput & { actif: boolean }> }) =>
      categoriesProduitsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-produits'] });
      toast.success('Catégorie mise à jour');
      setShowCategorieModal(false);
      setEditingCategorie(null);
      resetCategorieForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteCategorieMutation = useMutation({
    mutationFn: (id: string) => categoriesProduitsApi.delete(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['categories-produits'] });
      toast.success(data.message);
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const createEntrepotMutation = useMutation({
    mutationFn: (data: CreateEntrepotInput) => entrepotsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      toast.success('Entrepôt créé');
      setShowEntrepotModal(false);
      resetEntrepotForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateEntrepotMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateEntrepotInput & { actif: boolean }> }) =>
      entrepotsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      toast.success('Entrepôt mis à jour');
      setShowEntrepotModal(false);
      setEditingEntrepot(null);
      resetEntrepotForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteEntrepotMutation = useMutation({
    mutationFn: (id: string) => entrepotsApi.delete(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      toast.success(data.message);
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const createMouvementMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateMouvementPSInput }) =>
      produitsServicesApi.createMouvement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produits-services'] });
      queryClient.invalidateQueries({ queryKey: ['produits-services-alertes'] });
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      toast.success('Mouvement enregistré');
      setShowMouvementModal(false);
      setSelectedProduit(null);
      resetMouvementForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    },
  });

  // ============ FORM STATE ============

  const [produitForm, setProduitForm] = useState<CreateProduitServiceInput>({
    reference: '',
    nom: '',
    type: 'PRODUIT',
    unite: 'unité',
    tauxTVA: 19,
  });

  const [uniteCustom, setUniteCustom] = useState('');

  // Mode de gestion du stock: STOCKE (entrepôt), MIXTE (stock minimal + flux tendu), FLUX_TENDU (pas de stock)
  type ModeGestionStock = 'STOCKE' | 'MIXTE' | 'FLUX_TENDU';
  const [modeGestionStock, setModeGestionStock] = useState<ModeGestionStock>('STOCKE');
  const [entrepotInitialId, setEntrepotInitialId] = useState<string>('');
  const [pendingFicheTechnique, setPendingFicheTechnique] = useState<File | null>(null);

  const [categorieForm, setCategorieForm] = useState<CreateCategorieProduitInput>({
    nom: '',
  });

  const [entrepotForm, setEntrepotForm] = useState<CreateEntrepotInput>({
    code: '',
    nom: '',
  });

  const [mouvementForm, setMouvementForm] = useState<CreateMouvementPSInput>({
    type: 'ENTREE',
    quantite: 0,
  });

  const resetProduitForm = () => {
    setProduitForm({
      reference: '',
      nom: '',
      type: 'PRODUIT',
      unite: 'unité',
      tauxTVA: 19,
    });
    setUniteCustom('');
    setModeGestionStock('STOCKE');
    setEntrepotInitialId('');
    setPendingFicheTechnique(null);
  };

  const resetCategorieForm = () => {
    setCategorieForm({ nom: '' });
  };

  const resetEntrepotForm = () => {
    setEntrepotForm({ code: '', nom: '' });
  };

  const resetMouvementForm = () => {
    setMouvementForm({ type: 'ENTREE', quantite: 0 });
  };

  // ============ COMPUTED VALUES ============

  // Preview du nouveau stock
  const newStockPreview = useMemo(() => {
    if (!selectedProduit) return null;
    const current = selectedProduit.quantite || 0;
    const qty = mouvementForm.quantite || 0;

    switch (mouvementForm.type) {
      case 'ENTREE':
        return current + qty;
      case 'SORTIE':
        return current - qty;
      case 'AJUSTEMENT':
      case 'INVENTAIRE':
        return qty;
      default:
        return current;
    }
  }, [selectedProduit, mouvementForm.type, mouvementForm.quantite]);

  // ============ HANDLERS ============

  const handleEditProduit = (produit: ProduitService) => {
    setEditingProduit(produit);
    const unite = produit.unite || 'unité';
    const isCustomUnite = !UNITES_OPTIONS.some(u => u.value === unite);

    setProduitForm({
      reference: produit.reference,
      codeBarres: produit.codeBarres || undefined,
      nom: produit.nom,
      description: produit.description || undefined,
      type: produit.type,
      nature: produit.nature || undefined,
      unite: isCustomUnite ? 'autre' : unite,
      prixVenteHT: produit.prixVenteHT || undefined,
      tauxTVA: produit.tauxTVA || 19,
      prixAchatHT: produit.prixAchatHT || undefined,
      aStock: produit.aStock,
      stockMinimum: produit.stockMinimum,
      stockMaximum: produit.stockMaximum || undefined,
      fournisseurId: produit.fournisseurId || undefined,
      fournisseursDefaut: produit.fournisseursDefaut?.map(fd => ({
        fournisseurId: fd.fournisseurId,
        ordre: fd.ordre,
      })) || [],
      enVente: produit.enVente,
      enAchat: produit.enAchat,
      categorieIds: produit.categories?.map((c) => c.categorie.id) || [],
    });
    setUniteCustom(isCustomUnite ? unite : '');
    // Déterminer le mode de gestion du stock
    if (produit.aStock === false) {
      setModeGestionStock('FLUX_TENDU');
    } else if (produit.stockMaximum === undefined || produit.stockMaximum === null) {
      // Si pas de stock max défini, on considère que c'est du mode mixte (stock minimal)
      setModeGestionStock('MIXTE');
    } else {
      setModeGestionStock('STOCKE');
    }
    setShowProduitModal(true);
  };

  const handleDuplicateProduit = (produit: ProduitService) => {
    setEditingProduit(null);
    const unite = produit.unite || 'unité';
    const isCustomUnite = !UNITES_OPTIONS.some(u => u.value === unite);
    setProduitForm({
      reference: `${produit.reference}-COPIE`,
      nom: `${produit.nom} (copie)`,
      description: produit.description || undefined,
      type: produit.type,
      nature: produit.nature || undefined,
      unite: isCustomUnite ? 'autre' : unite,
      prixVenteHT: produit.prixVenteHT || undefined,
      tauxTVA: produit.tauxTVA || 19,
      prixAchatHT: produit.prixAchatHT || undefined,
      aStock: produit.aStock,
      stockMinimum: produit.stockMinimum,
      stockMaximum: produit.stockMaximum || undefined,
      fournisseurId: produit.fournisseurId || undefined,
      fournisseursDefaut: produit.fournisseursDefaut?.map(fd => ({ fournisseurId: fd.fournisseurId, ordre: fd.ordre })) || [],
      enVente: produit.enVente,
      enAchat: produit.enAchat,
      categorieIds: produit.categories?.map((c) => c.categorie.id) || [],
    });
    setUniteCustom(isCustomUnite ? unite : '');
    if (!produit.aStock) setModeGestionStock('FLUX_TENDU');
    else if (!produit.stockMaximum) setModeGestionStock('MIXTE');
    else setModeGestionStock('STOCKE');
    setShowDetailModal(false);
    setShowProduitModal(true);
  };

  const handleEditCategorie = (categorie: CategorieProduit) => {
    setEditingCategorie(categorie);
    setCategorieForm({
      code: categorie.code || undefined,
      nom: categorie.nom,
      description: categorie.description || undefined,
      parentId: categorie.parentId || undefined,
      couleur: categorie.couleur || undefined,
      ordre: categorie.ordre,
    });
    setShowCategorieModal(true);
  };

  const handleOpenMouvement = (produit: ProduitService) => {
    setSelectedProduit(produit);
    resetMouvementForm();
    setShowMouvementModal(true);
  };

  const handleViewDetail = async (produit: ProduitService) => {
    const detail = await produitsServicesApi.get(produit.id);
    setSelectedProduit(detail);
    setShowDetailModal(true);
  };

  const handleSubmitProduit = () => {
    const finalUnite = produitForm.unite === 'autre' ? uniteCustom : produitForm.unite;
    const submitData = {
      ...produitForm,
      unite: finalUnite,
      modeGestion: modeGestionStock,
      entrepotInitialId: entrepotInitialId || undefined,
    };

    if (editingProduit) {
      updateProduitMutation.mutate({ id: editingProduit.id, data: submitData });
    } else {
      createProduitMutation.mutate(submitData);
    }
  };

  const handleSubmitCategorie = () => {
    if (editingCategorie) {
      updateCategorieMutation.mutate({ id: editingCategorie.id, data: categorieForm });
    } else {
      createCategorieMutation.mutate(categorieForm);
    }
  };

  const handleSubmitEntrepot = () => {
    if (editingEntrepot) {
      updateEntrepotMutation.mutate({ id: editingEntrepot.id, data: entrepotForm });
    } else {
      createEntrepotMutation.mutate(entrepotForm);
    }
  };

  const handleSubmitMouvement = () => {
    if (selectedProduit) {
      createMouvementMutation.mutate({ id: selectedProduit.id, data: mouvementForm });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;

    switch (deleteTarget.type) {
      case 'produit':
        deleteProduitMutation.mutate(deleteTarget.item.id);
        break;
      case 'categorie':
        deleteCategorieMutation.mutate(deleteTarget.item.id);
        break;
      case 'entrepot':
        deleteEntrepotMutation.mutate(deleteTarget.item.id);
        break;
    }
  };

  const produitsAll = produitsData?.produits || [];

  // Filtrage par usage et mode appro
  const produits = useMemo(() => {
    let result = produitsAll;
    if (usageFilter === 'vente') {
      result = result.filter((p: ProduitService) => p.enVente === true);
    } else if (usageFilter === 'prestation') {
      result = result.filter((p: ProduitService) =>
        p.nature === 'CONSOMMABLE' ||
        p.nature === 'EPI' ||
        p.nature === 'MATERIEL_ANTI_NUISIBLES' ||
        p.enVente === false
      );
    }
    if (approFilter !== 'all') {
      result = result.filter((p: ProduitService) => {
        const mode = getModeAppro(p);
        return mode?.key === approFilter;
      });
    }
    return result;
  }, [produitsAll, usageFilter, approFilter]);

  const isProduitPending = createProduitMutation.isPending || updateProduitMutation.isPending;
  const fournisseursById = useMemo(() => {
    const map = new Map<string, { id: string; nomEntreprise: string }>();
    (fournisseurs?.tiers || []).forEach((f) => {
      map.set(f.id, { id: f.id, nomEntreprise: f.nomEntreprise });
    });
    return map;
  }, [fournisseurs]);

  const getFournisseursForProduit = (produit: ProduitService) => {
    const ordered = (produit.fournisseursDefaut || [])
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map((fd) => (
        fournisseursById.get(fd.fournisseurId)
        || (fd.fournisseur ? { id: fd.fournisseur.id, nomEntreprise: fd.fournisseur.nomEntreprise } : null)
        || { id: fd.fournisseurId, nomEntreprise: 'Fournisseur inconnu' }
      ));

    if (ordered.length > 0) return ordered;

    if (produit.fournisseur) {
      return [{ id: produit.fournisseur.id, nomEntreprise: produit.fournisseur.nomEntreprise }];
    }

    if (produit.fournisseurId) {
      return [fournisseursById.get(produit.fournisseurId) || { id: produit.fournisseurId, nomEntreprise: 'Fournisseur inconnu' }];
    }

    return [];
  };

  const handleOpenFournisseur = (fournisseurId: string) => {
    navigate(`/tiers?view=${fournisseurId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produits & Services</h1>
          <p className="text-muted-foreground">
            Gestion du catalogue produits et services
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Produits actifs</p>
                <div className="text-3xl font-bold text-blue-700 mt-1">{stats?.produitsActifs || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  sur <span className="font-medium">{stats?.totalProduits || 0}</span> au total
                  {(stats?.totalProduits || 0) - (stats?.produitsActifs || 0) > 0 && (
                    <span className="ml-1 text-amber-600">· {(stats!.totalProduits - stats!.produitsActifs)} inactif(s)</span>
                  )}
                </p>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Services actifs</p>
                <div className="text-3xl font-bold text-emerald-700 mt-1">{stats?.servicesActifs || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  sur <span className="font-medium">{stats?.totalServices || 0}</span> au total
                </p>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl">
                <Wrench className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          'border-l-4 hover:shadow-md transition-shadow',
          (stats?.stockBas || 0) > 0 ? 'border-l-orange-500 bg-orange-50/30' : 'border-l-gray-200'
        )}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Stock bas</p>
                <div className={cn('text-3xl font-bold mt-1', (stats?.stockBas || 0) > 0 ? 'text-orange-600' : 'text-gray-400')}>
                  {stats?.stockBas || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(stats?.stockBas || 0) > 0
                    ? <span className="text-orange-600 font-medium">Réapprovisionnement requis</span>
                    : 'Aucune alerte'}
                </p>
              </div>
              <div className={cn('p-2.5 rounded-xl', (stats?.stockBas || 0) > 0 ? 'bg-orange-100' : 'bg-gray-100')}>
                <AlertTriangle className={cn('h-6 w-6', (stats?.stockBas || 0) > 0 ? 'text-orange-500' : 'text-gray-400')} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500 hover:shadow-md transition-shadow">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Catégories</p>
                <div className="text-3xl font-bold text-violet-700 mt-1">{stats?.totalCategories || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">{stats?.totalEntrepots || 0}</span> entrepôt{(stats?.totalEntrepots || 0) > 1 ? 's' : ''} configuré{(stats?.totalEntrepots || 0) > 1 ? 's' : ''}
                </p>
              </div>
              <div className="p-2.5 bg-violet-50 rounded-xl">
                <FolderTree className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertes stock bas */}
      {alertes && alertes.count > 0 && (
        <div className="rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
            <span className="font-semibold text-orange-800 text-sm">
              {alertes.count} produit{alertes.count > 1 ? 's' : ''} nécessite{alertes.count > 1 ? 'nt' : ''} un réapprovisionnement
            </span>
            <span className="ml-auto text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
              Action requise
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertes.alertes.slice(0, 6).map((alerte) => (
              <button
                key={alerte.id}
                onClick={() => {
                  const p = produits.find(pp => pp.id === alerte.id);
                  if (p) handleViewDetail(p);
                }}
                className="flex items-center gap-1.5 text-xs bg-white border border-orange-200 text-orange-800 rounded-full px-3 py-1.5 hover:bg-orange-50 hover:border-orange-300 transition-colors shadow-sm font-medium"
              >
                <TrendingDown className="h-3 w-3 text-orange-500" />
                {alerte.nom}
                <span className="text-orange-400 mx-0.5">·</span>
                <span className="text-orange-600">{alerte.quantite}/{alerte.stockMinimum} {alerte.unite}</span>
              </button>
            ))}
            {alertes.count > 6 && (
              <span className="flex items-center text-xs text-orange-600 px-2 py-1 font-medium">
                +{alertes.count - 6} autres
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="produits" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produits & Services
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Catégories
          </TabsTrigger>
        </TabsList>

        {/* TAB: Produits & Services */}
        <TabsContent value="produits" className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeProduit | 'all')}>
                <SelectTrigger className="w-[130px] h-9 text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="PRODUIT">Produits</SelectItem>
                  <SelectItem value="SERVICE">Services</SelectItem>
                </SelectContent>
              </Select>
              <Select value={usageFilter} onValueChange={(v) => setUsageFilter(v as 'all' | 'vente' | 'prestation')}>
                <SelectTrigger className="w-[150px] h-9 text-sm">
                  <SelectValue placeholder="Usage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous usages</SelectItem>
                  <SelectItem value="vente">Vente</SelectItem>
                  <SelectItem value="prestation">Prestations</SelectItem>
                </SelectContent>
              </Select>
              <Select value={approFilter} onValueChange={(v) => setApproFilter(v as typeof approFilter)}>
                <SelectTrigger className="w-[130px] h-9 text-sm">
                  <SelectValue placeholder="Appro." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous modes</SelectItem>
                  <SelectItem value="FLUX_TENDU">Flux tendu</SelectItem>
                  <SelectItem value="MIXTE">Mixte</SelectItem>
                  <SelectItem value="STOCKE">Stocké</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categorieFilter} onValueChange={(v) => setCategorieFilter(v)}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex border rounded-lg overflow-hidden">
                <Tooltip content="Vue cartes">
                  <Button
                    variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none h-9 px-2.5"
                    onClick={() => setViewMode('cards')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Vue liste">
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none h-9 px-2.5 border-l"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </Tooltip>
              </div>

              {canManage && (
                <Button size="sm" className="h-9" onClick={() => { resetProduitForm(); setEditingProduit(null); setShowProduitModal(true); }}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nouveau
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          {loadingProduits ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : produits.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {search ? 'Aucun produit/service trouvé pour cette recherche' : 'Aucun produit/service enregistré'}
              </CardContent>
            </Card>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {produits.map((produit) => (
                <ProduitCard
                  key={produit.id}
                  produit={produit}
                  onView={() => handleViewDetail(produit)}
                  onEdit={() => handleEditProduit(produit)}
                  onDelete={() => setDeleteTarget({ type: 'produit', item: produit })}
                  onMouvement={() => handleOpenMouvement(produit)}
                  canManage={canManage}
                  fournisseurs={getFournisseursForProduit(produit)}
                  onOpenFournisseur={handleOpenFournisseur}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px] text-xs uppercase tracking-wide text-muted-foreground/70">Réf.</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground/70">Nom</TableHead>
                    <TableHead className="w-[90px] text-xs uppercase tracking-wide text-muted-foreground/70">Type</TableHead>
                    <TableHead className="w-[110px] text-xs uppercase tracking-wide text-muted-foreground/70">Appro.</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground/70">Catégories</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground/70">Fournisseurs</TableHead>
                    <TableHead className="text-right w-[110px] text-xs uppercase tracking-wide text-muted-foreground/70">Prix HT</TableHead>
                    <TableHead className="text-right w-[90px] text-xs uppercase tracking-wide text-muted-foreground/70">Stock</TableHead>
                    <TableHead className="w-[110px] text-xs uppercase tracking-wide text-muted-foreground/70">Statut</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produits.map((produit) => {
                    const config = TYPE_CONFIG[produit.type];
                    const Icon = config.icon;
                    const fournisseursOrdered = getFournisseursForProduit(produit);
                    const modeApproBadge = getModeAppro(produit);
                    return (
                      <TableRow
                        key={produit.id}
                        className={cn('cursor-pointer hover:bg-gray-50', !produit.actif && 'opacity-50')}
                        onClick={() => handleViewDetail(produit)}
                      >
                        <TableCell className="text-sm text-muted-foreground">{produit.reference}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className={cn('h-4 w-4', config.color)} />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{produit.nom}</span>
                                {produit.ficheTechniqueUrl && (
                                  <Paperclip className="h-3 w-3 text-gray-400 shrink-0" title="Fiche technique disponible" />
                                )}
                                {!produit.actif && (
                                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactif</span>
                                )}
                              </div>
                              {produit.codeBarres && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Barcode className="h-3 w-3" />
                                  {produit.codeBarres}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(config.bgColor, config.color)}>
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {modeApproBadge ? (
                            <Badge variant="outline" className={cn('text-xs whitespace-nowrap', modeApproBadge.className)}>
                              {modeApproBadge.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {produit.categories?.slice(0, 2).map((cat) => (
                              <Badge
                                key={cat.categorie.id}
                                variant="outline"
                                className="text-xs"
                                style={cat.categorie.couleur ? { borderColor: cat.categorie.couleur, color: cat.categorie.couleur } : {}}
                              >
                                {cat.categorie.nom}
                              </Badge>
                            ))}
                            {(produit.categories?.length || 0) > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{(produit.categories?.length || 0) - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {produit.type === 'PRODUIT' && fournisseursOrdered.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {fournisseursOrdered.map((f, index) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenFournisseur(f.id);
                                  }}
                                  className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-100 transition-colors"
                                  title="Ouvrir la fiche fournisseur"
                                >
                                  {index + 1}. {f.nomEntreprise}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {produit.prixVenteHT ? (
                            <span className="font-medium">{produit.prixVenteHT.toFixed(2)} <span className="text-muted-foreground font-normal text-xs">DA</span></span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {produit.aStock ? (
                            <span className={cn('text-sm', produit.quantite <= produit.stockMinimum ? 'text-orange-500 font-medium' : '')}>
                              {produit.quantite <= produit.stockMinimum && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                              {produit.quantite} <span className="text-muted-foreground font-normal text-xs">{produit.unite}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {produit.enVente && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Vente</Badge>}
                            {produit.enAchat && <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">Achat</Badge>}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetail(produit)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir détail
                              </DropdownMenuItem>
                              {produit.aStock && canManage && (
                                <DropdownMenuItem onClick={() => handleOpenMouvement(produit)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Mouvement stock
                                </DropdownMenuItem>
                              )}
                              {canManage && (
                                <>
                                  <DropdownMenuItem onClick={() => handleEditProduit(produit)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Modifier
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => setDeleteTarget({ type: 'produit', item: produit })}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* TAB: Catégories */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Button onClick={() => { resetCategorieForm(); setEditingCategorie(null); setShowCategorieModal(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle catégorie
              </Button>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Couleur</TableHead>
                  <TableHead className="text-right">Produits</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCategories ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : !categories || categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucune catégorie
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-mono text-sm">{cat.code || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {cat.parentId && <span className="text-muted-foreground">└─</span>}
                          <span className="font-medium">{cat.nom}</span>
                        </div>
                      </TableCell>
                      <TableCell>{cat.parent?.nom || '-'}</TableCell>
                      <TableCell>
                        {cat.couleur && (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: cat.couleur }}
                            />
                            <span className="text-xs text-muted-foreground">{cat.couleur}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{cat._count?.produits || 0}</TableCell>
                      <TableCell>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditCategorie(cat)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setDeleteTarget({ type: 'categorie', item: cat })}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

      </Tabs>

      {/* ============ MODALS ============ */}

      {/* Modal: Produit/Service */}
      <Dialog open={showProduitModal} onOpenChange={setShowProduitModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduit ? 'Modifier le produit/service' : 'Nouveau produit/service'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Type Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Type</Label>
              <div className="grid grid-cols-2 gap-3">
                {(['PRODUIT', 'SERVICE'] as TypeProduit[]).map((type) => {
                  const config = TYPE_CONFIG[type];
                  const Icon = config.icon;
                  const isSelected = produitForm.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setProduitForm({ ...produitForm, type, aStock: type === 'PRODUIT' })}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                        isSelected
                          ? `${config.borderColor} ${config.bgColor}`
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <Icon className={cn('h-6 w-6', isSelected ? config.color : 'text-gray-400')} />
                      <span className={cn('font-medium', isSelected ? config.color : 'text-gray-600')}>
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Informations principales */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Informations principales
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Référence <span className="text-red-500">*</span></Label>
                  <Input
                    value={produitForm.reference}
                    onChange={(e) => setProduitForm({ ...produitForm, reference: e.target.value })}
                    placeholder="REF-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code-barres</Label>
                  <Input
                    value={produitForm.codeBarres || ''}
                    onChange={(e) => setProduitForm({ ...produitForm, codeBarres: e.target.value || undefined })}
                    placeholder="EAN13..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nom <span className="text-red-500">*</span></Label>
                <Input
                  value={produitForm.nom}
                  onChange={(e) => setProduitForm({ ...produitForm, nom: e.target.value })}
                  placeholder="Nom du produit/service"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={produitForm.description || ''}
                  onChange={(e) => setProduitForm({ ...produitForm, description: e.target.value || undefined })}
                  placeholder="Description courte..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Nature - only for PRODUIT */}
                {produitForm.type === 'PRODUIT' && (
                  <div className="space-y-2">
                    <Label>Nature du produit</Label>
                    <Select
                      value={produitForm.nature || ''}
                      onValueChange={(v) => setProduitForm({ ...produitForm, nature: v as NatureProduit || undefined })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(NATURE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            <div>
                              <span>{label}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({NATURE_DESCRIPTIONS[key as NatureProduit]})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unité {produitForm.type === 'SERVICE' ? '(facturation)' : '(vente)'}</Label>
                  <Select
                    value={produitForm.unite || 'unité'}
                    onValueChange={(v) => setProduitForm({ ...produitForm, unite: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITES_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {produitForm.unite === 'autre' && (
                    <Input
                      value={uniteCustom}
                      onChange={(e) => setUniteCustom(e.target.value)}
                      placeholder="Saisir l'unité..."
                      className="mt-2"
                    />
                  )}
                </div>
                {produitForm.type === 'PRODUIT' && (
                  <div className="space-y-2">
                    <Label>Code-barres (optionnel)</Label>
                    <Input
                      value={produitForm.codeBarres || ''}
                      onChange={(e) => setProduitForm({ ...produitForm, codeBarres: e.target.value || undefined })}
                      placeholder="EAN13, UPC..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Prix */}
            <CollapsibleSection title="Prix" icon={<DollarSign className="h-4 w-4" />} defaultOpen>
              <div className="pt-4 space-y-4">
                {produitForm.type === 'SERVICE' ? (
                  <>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        <strong>Service :</strong> Le prix de vente est généralement défini par devis, selon le client et la prestation.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prix indicatif HT (optionnel)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={produitForm.prixVenteHT || ''}
                          onChange={(e) => setProduitForm({ ...produitForm, prixVenteHT: parseFloat(e.target.value) || undefined })}
                          placeholder="Variable selon client"
                        />
                        <p className="text-xs text-muted-foreground">Prix de base, ajustable par client</p>
                      </div>
                      <div className="space-y-2">
                        <Label>TVA %</Label>
                        <Input
                          type="number"
                          value={produitForm.tauxTVA || 19}
                          onChange={(e) => setProduitForm({ ...produitForm, tauxTVA: parseFloat(e.target.value) || 19 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Durée standard (heures)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={produitForm.dureeService || ''}
                        onChange={(e) => setProduitForm({ ...produitForm, dureeService: parseFloat(e.target.value) || undefined })}
                        placeholder="Ex: 2"
                      />
                      <p className="text-xs text-muted-foreground">Durée estimée de la prestation</p>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Prix achat HT</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={produitForm.prixAchatHT || ''}
                        onChange={(e) => setProduitForm({ ...produitForm, prixAchatHT: parseFloat(e.target.value) || undefined })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Prix vente HT</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={produitForm.prixVenteHT || ''}
                        onChange={(e) => setProduitForm({ ...produitForm, prixVenteHT: parseFloat(e.target.value) || undefined })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>TVA %</Label>
                      <Input
                        type="number"
                        value={produitForm.tauxTVA || 19}
                        onChange={(e) => setProduitForm({ ...produitForm, tauxTVA: parseFloat(e.target.value) || 19 })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* Stock (only for PRODUIT) */}
            {produitForm.type === 'PRODUIT' && (
              <CollapsibleSection title="Gestion du stock" icon={<Boxes className="h-4 w-4" />} defaultOpen>
                <div className="pt-4 space-y-4">
                  {/* Mode de gestion */}
                  <div className="space-y-2">
                    <Label>Mode de gestion</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setModeGestionStock('STOCKE');
                          setProduitForm({ ...produitForm, aStock: true });
                        }}
                        className={cn(
                          'p-3 rounded-lg border-2 transition-all text-left',
                          modeGestionStock === 'STOCKE'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Warehouse className="h-4 w-4" />
                          <span className="font-medium text-sm">Stocké</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Conservé en entrepôt
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModeGestionStock('MIXTE');
                          setProduitForm({ ...produitForm, aStock: true });
                        }}
                        className={cn(
                          'p-3 rounded-lg border-2 transition-all text-left',
                          modeGestionStock === 'MIXTE'
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          <span className="font-medium text-sm">Mixte</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Stock minimal + flux tendu
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModeGestionStock('FLUX_TENDU');
                          setProduitForm({ ...produitForm, aStock: false, quantite: 0, stockMinimum: 0, stockMaximum: undefined });
                        }}
                        className={cn(
                          'p-3 rounded-lg border-2 transition-all text-left',
                          modeGestionStock === 'FLUX_TENDU'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4" />
                          <span className="font-medium text-sm">Flux tendu</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Commande à la demande
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Stock fields - for STOCKE mode */}
                  {modeGestionStock === 'STOCKE' && (
                    <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 space-y-4">
                      <p className="text-sm text-blue-800">
                        <strong>Mode stocké :</strong> Gestion complète du stock en entrepôt.
                      </p>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Stock initial</Label>
                          <Input
                            type="number"
                            value={produitForm.quantite || 0}
                            onChange={(e) => setProduitForm({ ...produitForm, quantite: parseFloat(e.target.value) || 0 })}
                            disabled={!!editingProduit}
                          />
                          {editingProduit && (
                            <p className="text-xs text-muted-foreground">Utilisez les mouvements pour modifier</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Stock minimum (alerte)</Label>
                          <Input
                            type="number"
                            value={produitForm.stockMinimum || 0}
                            onChange={(e) => setProduitForm({ ...produitForm, stockMinimum: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Stock maximum</Label>
                          <Input
                            type="number"
                            value={produitForm.stockMaximum || ''}
                            onChange={(e) => setProduitForm({ ...produitForm, stockMaximum: parseFloat(e.target.value) || undefined })}
                            placeholder="Illimité"
                          />
                        </div>
                      </div>
                      {!editingProduit && (produitForm.quantite ?? 0) > 0 && (
                        <div className="space-y-2">
                          <Label>Entrepôt de stockage initial</Label>
                          <Select value={entrepotInitialId} onValueChange={setEntrepotInitialId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Entrepôt par défaut" />
                            </SelectTrigger>
                            <SelectContent>
                              {(entrepots || []).map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.nom}
                                  {e.estDefaut && ' (défaut)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Laissez vide pour utiliser l'entrepôt par défaut</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stock fields - for MIXTE mode */}
                  {modeGestionStock === 'MIXTE' && (
                    <div className="p-4 bg-purple-50/50 rounded-lg border border-purple-100 space-y-4">
                      <p className="text-sm text-purple-800">
                        <strong>Mode mixte :</strong> Vous gardez un petit stock de sécurité, mais commandez principalement à la demande.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Stock actuel</Label>
                          <Input
                            type="number"
                            value={produitForm.quantite || 0}
                            onChange={(e) => setProduitForm({ ...produitForm, quantite: parseFloat(e.target.value) || 0 })}
                            disabled={!!editingProduit}
                          />
                          {editingProduit && (
                            <p className="text-xs text-muted-foreground">Utilisez les mouvements pour modifier</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Stock de sécurité (minimum)</Label>
                          <Input
                            type="number"
                            value={produitForm.stockMinimum || 0}
                            onChange={(e) => setProduitForm({ ...produitForm, stockMinimum: parseFloat(e.target.value) || 0 })}
                            placeholder="Ex: 5"
                          />
                          <p className="text-xs text-muted-foreground">Alerte si stock descend sous ce seuil</p>
                        </div>
                      </div>
                      {!editingProduit && (produitForm.quantite ?? 0) > 0 && (
                        <div className="space-y-2">
                          <Label>Entrepôt de stockage initial</Label>
                          <Select value={entrepotInitialId} onValueChange={setEntrepotInitialId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Entrepôt par défaut" />
                            </SelectTrigger>
                            <SelectContent>
                              {(entrepots || []).map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.nom}
                                  {e.estDefaut && ' (défaut)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Laissez vide pour utiliser l'entrepôt par défaut</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Flux tendu info */}
                  {modeGestionStock === 'FLUX_TENDU' && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-800">
                        <strong>Flux tendu :</strong> Ce produit n'est pas stocké. Lors d'une commande client,
                        vous passez commande auprès du fournisseur pour livraison directe.
                      </p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Classification */}
            <CollapsibleSection title="Classification" icon={<FolderTree className="h-4 w-4" />}>
              <div className="space-y-4 pt-4">
                {/* Fournisseurs par défaut (avec ordre) - only for PRODUIT */}
                {produitForm.type === 'PRODUIT' && (
                  <div className="space-y-2">
                    <Label>Fournisseurs par défaut (par ordre de préférence)</Label>

                    {/* Liste des fournisseurs sélectionnés */}
                    {(produitForm.fournisseursDefaut && produitForm.fournisseursDefaut.length > 0) ? (
                      <div className="space-y-2">
                        {produitForm.fournisseursDefaut
                          .sort((a, b) => a.ordre - b.ordre)
                          .map((fd, index) => {
                            const fournisseurInfo = fournisseurs?.tiers.find(f => f.id === fd.fournisseurId);
                            return (
                              <div key={fd.fournisseurId} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                                  {index + 1}
                                </span>
                                <span className="flex-1 font-medium">{fournisseurInfo?.nomEntreprise || 'Fournisseur inconnu'}</span>
                                <div className="flex items-center gap-1">
                                  <Tooltip content="Monter">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={index === 0}
                                      onClick={() => {
                                        const list = [...(produitForm.fournisseursDefaut || [])].sort((a, b) => a.ordre - b.ordre);
                                        if (index > 0) {
                                          [list[index - 1], list[index]] = [list[index], list[index - 1]];
                                          const updated = list.map((item, i) => ({ ...item, ordre: i + 1 }));
                                          setProduitForm({ ...produitForm, fournisseursDefaut: updated });
                                        }
                                      }}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                  </Tooltip>
                                  <Tooltip content="Descendre">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={index === (produitForm.fournisseursDefaut?.length || 0) - 1}
                                      onClick={() => {
                                        const list = [...(produitForm.fournisseursDefaut || [])].sort((a, b) => a.ordre - b.ordre);
                                        if (index < list.length - 1) {
                                          [list[index], list[index + 1]] = [list[index + 1], list[index]];
                                          const updated = list.map((item, i) => ({ ...item, ordre: i + 1 }));
                                          setProduitForm({ ...produitForm, fournisseursDefaut: updated });
                                        }
                                      }}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </Tooltip>
                                  <Tooltip content="Retirer">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const list = (produitForm.fournisseursDefaut || [])
                                          .filter(f => f.fournisseurId !== fd.fournisseurId)
                                          .sort((a, b) => a.ordre - b.ordre)
                                          .map((item, i) => ({ ...item, ordre: i + 1 }));
                                        setProduitForm({ ...produitForm, fournisseursDefaut: list });
                                      }}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </Tooltip>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground p-3 border border-dashed rounded-lg text-center">
                        Aucun fournisseur sélectionné
                      </p>
                    )}

                    {/* Ajouter un fournisseur */}
                    <Select
                      value="_add_"
                      onValueChange={(v) => {
                        if (v !== '_add_') {
                          const existing = produitForm.fournisseursDefaut || [];
                          if (!existing.some(f => f.fournisseurId === v)) {
                            setProduitForm({
                              ...produitForm,
                              fournisseursDefaut: [...existing, { fournisseurId: v, ordre: existing.length + 1 }]
                            });
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="+ Ajouter un fournisseur..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_add_" disabled>+ Ajouter un fournisseur...</SelectItem>
                        {fournisseurs?.tiers
                          .filter(f => !(produitForm.fournisseursDefaut || []).some(fd => fd.fournisseurId === f.id))
                          .map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.nomEntreprise}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Catégories</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px] bg-white">
                    {categories?.map((cat) => {
                      const isSelected = produitForm.categorieIds?.includes(cat.id);
                      return (
                        <Badge
                          key={cat.id}
                          variant={isSelected ? 'default' : 'outline'}
                          className="cursor-pointer transition-colors"
                          style={cat.couleur && isSelected ? { backgroundColor: cat.couleur, borderColor: cat.couleur } : {}}
                          onClick={() => {
                            const ids = produitForm.categorieIds || [];
                            if (ids.includes(cat.id)) {
                              setProduitForm({ ...produitForm, categorieIds: ids.filter((id) => id !== cat.id) });
                            } else {
                              setProduitForm({ ...produitForm, categorieIds: [...ids, cat.id] });
                            }
                          }}
                        >
                          {cat.nom}
                        </Badge>
                      );
                    })}
                    {(!categories || categories.length === 0) && (
                      <span className="text-sm text-muted-foreground">Aucune catégorie disponible</span>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Statut */}
            <div className="flex gap-6 p-4 bg-gray-50 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={produitForm.enVente ?? true}
                  onCheckedChange={(checked) => setProduitForm({ ...produitForm, enVente: !!checked })}
                />
                <span className="text-sm">En vente</span>
              </label>
              {/* En achat - only for PRODUIT (services are not purchased) */}
              {produitForm.type === 'PRODUIT' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={produitForm.enAchat ?? true}
                    onCheckedChange={(checked) => setProduitForm({ ...produitForm, enAchat: !!checked })}
                  />
                  <span className="text-sm">En achat</span>
                </label>
              )}
            </div>
          </div>

          {/* Fiche technique PDF */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Fiche technique (PDF)
            </p>
            {editingProduit ? (
              editingProduit.ficheTechniqueUrl ? (
                <div className="flex items-center gap-2">
                  <a
                    href={editingProduit.ficheTechniqueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 flex-1"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{editingProduit.ficheTechniqueNom || 'Fiche technique.pdf'}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={async () => {
                      await produitsServicesApi.deleteFicheTechnique(editingProduit.id);
                      setEditingProduit({ ...editingProduit, ficheTechniqueUrl: null, ficheTechniqueNom: null });
                      queryClient.invalidateQueries({ queryKey: ['produits-services'] });
                      toast.success('Fiche technique supprimée');
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const result = await produitsServicesApi.uploadFicheTechnique(editingProduit.id, file);
                        setEditingProduit({ ...editingProduit, ficheTechniqueUrl: result.ficheTechniqueUrl, ficheTechniqueNom: result.ficheTechniqueNom });
                        queryClient.invalidateQueries({ queryKey: ['produits-services'] });
                        toast.success('Fiche technique uploadée');
                      } catch {
                        toast.error('Erreur lors de l\'upload');
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Joindre un PDF
                    </span>
                  </Button>
                </label>
              )
            ) : pendingFicheTechnique ? (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-sm text-blue-700 flex-1 truncate">{pendingFicheTechnique.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => setPendingFicheTechnique(null)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPendingFicheTechnique(file);
                  }}
                />
                <Button type="button" variant="outline" size="sm" asChild>
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Joindre un PDF
                  </span>
                </Button>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProduitModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmitProduit}
              disabled={!produitForm.reference || !produitForm.nom || isProduitPending}
            >
              {isProduitPending ? 'Enregistrement...' : editingProduit ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Catégorie */}
      <Dialog open={showCategorieModal} onOpenChange={setShowCategorieModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategorie ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={categorieForm.code || ''}
                  onChange={(e) => setCategorieForm({ ...categorieForm, code: e.target.value || undefined })}
                  placeholder="CAT01"
                />
              </div>
              <div className="space-y-2">
                <Label>Nom <span className="text-red-500">*</span></Label>
                <Input
                  value={categorieForm.nom}
                  onChange={(e) => setCategorieForm({ ...categorieForm, nom: e.target.value })}
                  placeholder="Nom de la catégorie"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={categorieForm.description || ''}
                onChange={(e) => setCategorieForm({ ...categorieForm, description: e.target.value || undefined })}
                placeholder="Description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie parente</Label>
                <Select
                  value={categorieForm.parentId || '_none_'}
                  onValueChange={(v) => setCategorieForm({ ...categorieForm, parentId: v === '_none_' ? undefined : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune (racine)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Aucune (racine)</SelectItem>
                    {categories?.filter((c) => c.id !== editingCategorie?.id).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={categorieForm.couleur || '#000000'}
                    onChange={(e) => setCategorieForm({ ...categorieForm, couleur: e.target.value })}
                    className="w-12 h-9 p-1"
                  />
                  <Input
                    value={categorieForm.couleur || ''}
                    onChange={(e) => setCategorieForm({ ...categorieForm, couleur: e.target.value || undefined })}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategorieModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmitCategorie}
              disabled={!categorieForm.nom || createCategorieMutation.isPending || updateCategorieMutation.isPending}
            >
              {createCategorieMutation.isPending || updateCategorieMutation.isPending
                ? 'Enregistrement...'
                : editingCategorie ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Entrepôt */}
      <Dialog open={showEntrepotModal} onOpenChange={setShowEntrepotModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntrepot ? 'Modifier l\'entrepôt' : 'Nouvel entrepôt'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code <span className="text-red-500">*</span></Label>
                <Input
                  value={entrepotForm.code}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, code: e.target.value })}
                  placeholder="ENT01"
                />
              </div>
              <div className="space-y-2">
                <Label>Nom <span className="text-red-500">*</span></Label>
                <Input
                  value={entrepotForm.nom}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, nom: e.target.value })}
                  placeholder="Entrepôt principal"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input
                value={entrepotForm.adresse || ''}
                onChange={(e) => setEntrepotForm({ ...entrepotForm, adresse: e.target.value || undefined })}
                placeholder="Adresse"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code postal</Label>
                <Input
                  value={entrepotForm.codePostal || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, codePostal: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input
                  value={entrepotForm.ville || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, ville: e.target.value || undefined })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsable</Label>
                <Input
                  value={entrepotForm.responsable || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, responsable: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={entrepotForm.tel || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, tel: e.target.value || undefined })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={entrepotForm.estDefaut || false}
                onCheckedChange={(checked) => setEntrepotForm({ ...entrepotForm, estDefaut: !!checked })}
              />
              <span className="text-sm">Entrepôt par défaut</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEntrepotModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmitEntrepot}
              disabled={!entrepotForm.code || !entrepotForm.nom || createEntrepotMutation.isPending || updateEntrepotMutation.isPending}
            >
              {createEntrepotMutation.isPending || updateEntrepotMutation.isPending
                ? 'Enregistrement...'
                : editingEntrepot ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Mouvement stock */}
      <Dialog open={showMouvementModal} onOpenChange={setShowMouvementModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mouvement de stock - {selectedProduit?.nom}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Stock actuel et preview */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stock actuel</span>
                <span className="font-medium">{selectedProduit?.quantite} {selectedProduit?.unite}</span>
              </div>
              {newStockPreview !== null && mouvementForm.quantite > 0 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Nouveau stock</span>
                  <span className={cn(
                    'font-bold',
                    newStockPreview < 0 && 'text-red-600',
                    selectedProduit && newStockPreview <= selectedProduit.stockMinimum && newStockPreview >= 0 && 'text-orange-600',
                    selectedProduit && newStockPreview > selectedProduit.stockMinimum && 'text-green-600'
                  )}>
                    {newStockPreview} {selectedProduit?.unite}
                  </span>
                </div>
              )}
              {newStockPreview !== null && newStockPreview < 0 && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Stock insuffisant
                </p>
              )}
              {selectedProduit && newStockPreview !== null && newStockPreview >= 0 && newStockPreview <= selectedProduit.stockMinimum && (
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Passera sous le stock minimum ({selectedProduit.stockMinimum})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Type de mouvement <span className="text-red-500">*</span></Label>
              <Select
                value={mouvementForm.type}
                onValueChange={(v) => setMouvementForm({ ...mouvementForm, type: v as TypeMouvementPS })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MOUVEMENT_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <Icon className={cn('h-4 w-4', config.color)} />
                          {config.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {mouvementForm.type === 'INVENTAIRE'
                  ? 'Quantité comptée (inventaire physique)'
                  : mouvementForm.type === 'AJUSTEMENT'
                    ? 'Quantité après ajustement'
                    : 'Quantité'
                } <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={mouvementForm.quantite}
                onChange={(e) => setMouvementForm({ ...mouvementForm, quantite: parseFloat(e.target.value) || 0 })}
              />
              {mouvementForm.type === 'INVENTAIRE' && (
                <p className="text-xs text-muted-foreground">Résultat d'un comptage physique — met le stock au chiffre réel compté.</p>
              )}
              {mouvementForm.type === 'AJUSTEMENT' && (
                <p className="text-xs text-muted-foreground">Correction manuelle — à utiliser pour corriger une erreur ou une perte.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Motif</Label>
              <Input
                value={mouvementForm.motif || ''}
                onChange={(e) => setMouvementForm({ ...mouvementForm, motif: e.target.value || undefined })}
                placeholder="Raison du mouvement"
              />
            </div>

            {entrepots && entrepots.length > 0 && (
              <div className="space-y-2">
                <Label>{mouvementForm.type === 'TRANSFERT' ? 'Entrepôt source' : 'Entrepôt'}{mouvementForm.type === 'TRANSFERT' && <span className="text-red-500"> *</span>}</Label>
                <Select
                  value={mouvementForm.entrepotId || ''}
                  onValueChange={(v) => setMouvementForm({ ...mouvementForm, entrepotId: v || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {entrepots.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nom} ({e.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mouvementForm.type === 'TRANSFERT' && entrepots && entrepots.length > 0 && (
              <div className="space-y-2">
                <Label>Entrepôt destination <span className="text-red-500">*</span></Label>
                <Select
                  value={mouvementForm.entrepotDestId || ''}
                  onValueChange={(v) => setMouvementForm({ ...mouvementForm, entrepotDestId: v || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {entrepots
                      .filter((e) => e.id !== mouvementForm.entrepotId)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nom} ({e.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMouvementModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmitMouvement}
              disabled={
                mouvementForm.quantite <= 0 ||
                (newStockPreview !== null && newStockPreview < 0) ||
                (mouvementForm.type === 'TRANSFERT' && (!mouvementForm.entrepotId || !mouvementForm.entrepotDestId)) ||
                createMouvementMutation.isPending
              }
            >
              {createMouvementMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Détail produit */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {selectedProduit && (() => {
            const detailConfig = TYPE_CONFIG[selectedProduit.type];
            const DetailIcon = detailConfig.icon;
            const detailModeAppro = getModeAppro(selectedProduit);
            const detailIsStockLow = selectedProduit.aStock && selectedProduit.quantite <= selectedProduit.stockMinimum;
            const detailFournisseurs = getFournisseursForProduit(selectedProduit);
            const stockPct = selectedProduit.stockMaximum && selectedProduit.stockMaximum > 0
              ? Math.min(100, (selectedProduit.quantite / selectedProduit.stockMaximum) * 100)
              : null;
            return (
              <>
                {/* Hero header */}
                <div className={cn('px-6 pt-6 pb-5 border-b', detailConfig.bgColor)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shadow-sm', 'bg-white')}>
                        <DetailIcon className={cn('h-6 w-6', detailConfig.color)} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedProduit.nom}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm font-mono text-gray-500">{selectedProduit.reference}</span>
                          <Badge className={cn(detailConfig.bgColor, detailConfig.color, 'border', detailConfig.borderColor)}>
                            {detailConfig.label}
                          </Badge>
                          {detailModeAppro && (
                            <Badge variant="outline" className={cn('text-xs', detailModeAppro.className)}>
                              {detailModeAppro.label}
                            </Badge>
                          )}
                          {!selectedProduit.actif && (
                            <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-300">
                              Inactif
                            </Badge>
                          )}
                          <div className="flex gap-1">
                            {selectedProduit.enVente && <Badge variant="outline" className="text-xs text-green-700 border-green-200">Vente</Badge>}
                            {selectedProduit.enAchat && <Badge variant="outline" className="text-xs text-blue-700 border-blue-200">Achat</Badge>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">

                  {/* Description */}
                  {selectedProduit.description && (
                    <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">{selectedProduit.description}</p>
                  )}

                  {/* Informations & Prix */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Identité */}
                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Identification</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Référence</p>
                          <p className="font-mono font-medium">{selectedProduit.reference}</p>
                        </div>
                        {selectedProduit.codeBarres && (
                          <div>
                            <p className="text-muted-foreground text-xs">Code-barres</p>
                            <p className="font-mono text-xs">{selectedProduit.codeBarres}</p>
                          </div>
                        )}
                        {selectedProduit.nature && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground text-xs">Nature</p>
                            <p className="font-medium">{NATURE_LABELS[selectedProduit.nature]}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground text-xs">Unité</p>
                          <p className="font-medium">{selectedProduit.unite || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">TVA</p>
                          <p className="font-medium">{selectedProduit.tauxTVA || 19}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Tarification */}
                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarification</p>
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Prix vente HT</span>
                          <span className="font-bold text-gray-900">
                            {selectedProduit.prixVenteHT ? `${selectedProduit.prixVenteHT.toFixed(2)} DA` : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Prix vente TTC</span>
                          <span className="font-bold text-blue-700">
                            {selectedProduit.prixVenteTTC ? `${selectedProduit.prixVenteTTC.toFixed(2)} DA` : '-'}
                          </span>
                        </div>
                        {selectedProduit.prixAchatHT && (
                          <>
                            <div className="border-t my-1" />
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Prix achat HT</span>
                              <span className="font-medium text-gray-600">
                                {selectedProduit.prixAchatHT.toFixed(2)} DA
                              </span>
                            </div>
                            {selectedProduit.prixVenteHT && selectedProduit.prixAchatHT && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Marge brute</span>
                                <span className={cn(
                                  'font-medium text-xs',
                                  selectedProduit.prixVenteHT > selectedProduit.prixAchatHT ? 'text-emerald-600' : 'text-red-600'
                                )}>
                                  {((selectedProduit.prixVenteHT - selectedProduit.prixAchatHT) / selectedProduit.prixVenteHT * 100).toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stock & Approvisionnement */}
                  {selectedProduit.type === 'PRODUIT' && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock & Approvisionnement</p>
                      {selectedProduit.aStock ? (
                        <div className="p-4 border rounded-xl space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div className={cn('p-3 rounded-lg', detailIsStockLow ? 'bg-orange-50 border border-orange-100' : 'bg-emerald-50 border border-emerald-100')}>
                              <p className="text-xs text-muted-foreground mb-1">Stock actuel</p>
                              <p className={cn('text-2xl font-bold', detailIsStockLow ? 'text-orange-600' : 'text-emerald-700')}>
                                {detailIsStockLow && <AlertTriangle className="h-4 w-4 inline mr-1 mb-0.5" />}
                                {selectedProduit.quantite}
                              </p>
                              <p className="text-xs text-muted-foreground">{selectedProduit.unite}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-gray-50 border">
                              <p className="text-xs text-muted-foreground mb-1">Seuil minimum</p>
                              <p className="text-2xl font-bold text-gray-700">{selectedProduit.stockMinimum}</p>
                              <p className="text-xs text-muted-foreground">{selectedProduit.unite}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-gray-50 border">
                              <p className="text-xs text-muted-foreground mb-1">Stock maximum</p>
                              <p className="text-2xl font-bold text-gray-700">{selectedProduit.stockMaximum || '∞'}</p>
                              <p className="text-xs text-muted-foreground">{selectedProduit.stockMaximum ? selectedProduit.unite : 'Illimité'}</p>
                            </div>
                          </div>
                          {stockPct !== null && (
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Niveau de stock</span>
                                <span className={detailIsStockLow ? 'text-orange-600 font-medium' : 'text-emerald-600 font-medium'}>{stockPct.toFixed(0)}%</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full transition-all', detailIsStockLow ? 'bg-orange-400' : stockPct > 60 ? 'bg-emerald-400' : 'bg-amber-400')}
                                  style={{ width: `${stockPct}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Stock par entrepôt */}
                          {selectedProduit.stocks && selectedProduit.stocks.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Répartition par entrepôt</p>
                              <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 border-b">
                                    <tr>
                                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Entrepôt</th>
                                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Quantité</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedProduit.stocks.map((s) => (
                                      <tr key={s.id} className="border-t">
                                        <td className="px-3 py-2">
                                          <span className="font-medium">{s.entrepot?.nom || s.entrepotId}</span>
                                          {s.entrepot?.code && <span className="ml-1 text-xs text-muted-foreground">({s.entrepot.code})</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold">{s.quantite} <span className="text-xs font-normal text-muted-foreground">{selectedProduit.unite}</span></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 flex items-center gap-3">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <ArrowRight className="h-4 w-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-orange-800 text-sm">Mode Flux tendu</p>
                            <p className="text-xs text-orange-600 mt-0.5">Ce produit est commandé à la demande, sans stock préalable.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Classification */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Catégories */}
                    {selectedProduit.categories && selectedProduit.categories.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Catégories</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProduit.categories.map((cat) => (
                            <Badge
                              key={cat.categorie.id}
                              variant="outline"
                              className="text-xs"
                              style={cat.categorie.couleur ? { borderColor: cat.categorie.couleur, color: cat.categorie.couleur } : {}}
                            >
                              {cat.categorie.nom}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fournisseurs */}
                    {selectedProduit.type === 'PRODUIT' && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fournisseurs</p>
                        {detailFournisseurs.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {detailFournisseurs.map((f, index) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => handleOpenFournisseur(f.id)}
                                className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors text-left"
                              >
                                <ArrowUpRight className="h-3 w-3 shrink-0" />
                                <span className="text-blue-500 font-mono text-xs">{index + 1}.</span>
                                {f.nomEntreprise}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Aucun fournisseur défini</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fiche technique */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fiche technique</p>
                    {selectedProduit.ficheTechniqueUrl ? (
                      <a
                        href={selectedProduit.ficheTechniqueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 hover:bg-blue-100 transition-colors group"
                      >
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="flex-1 font-medium truncate">{selectedProduit.ficheTechniqueNom || 'Fiche technique.pdf'}</span>
                        <ExternalLink className="h-4 w-4 opacity-60 group-hover:opacity-100 shrink-0" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>Aucune fiche technique — </span>
                        {canManage && (
                          <button
                            className="text-blue-600 hover:underline"
                            onClick={() => { setShowDetailModal(false); handleEditProduit(selectedProduit); }}
                          >
                            Ajouter via Modifier
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Historique mouvements */}
                  {selectedProduit.mouvements && selectedProduit.mouvements.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Historique mouvements <span className="text-gray-400 font-normal ml-1">(10 derniers)</span>
                      </p>
                      <div className="border rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Date</th>
                              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Qté</th>
                              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Motif</th>
                              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Par</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedProduit.mouvements.slice(0, 10).map((mvt) => {
                              const mvtConfig = MOUVEMENT_CONFIG[mvt.type];
                              const MvtIcon = mvtConfig.icon;
                              return (
                                <tr key={mvt.id} className="border-t hover:bg-gray-50 transition-colors">
                                  <td className="px-3 py-2 text-xs text-muted-foreground">
                                    {new Date(mvt.createdAt).toLocaleDateString('fr-FR')}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant="outline" className="flex items-center gap-1 w-fit text-xs">
                                      <MvtIcon className={cn('h-3 w-3', mvtConfig.color)} />
                                      {mvtConfig.label}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-bold text-sm">
                                    <span className={mvt.type === 'ENTREE' ? 'text-emerald-600' : mvt.type === 'SORTIE' ? 'text-red-600' : 'text-gray-600'}>
                                      {mvt.type === 'ENTREE' ? '+' : mvt.type === 'SORTIE' ? '-' : ''}
                                      {mvt.quantite}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[120px] truncate">
                                    {mvt.motif || '-'}
                                  </td>
                                  <td className="px-3 py-2 text-xs">
                                    {mvt.user ? `${mvt.user.prenom} ${mvt.user.nom}` : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer actions — même pattern que les devis */}
                <DialogFooter className="px-6 py-4 border-t gap-2 flex-wrap">
                  {canManage && (
                    <div className="flex items-center gap-2 mr-auto">
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => { setShowDetailModal(false); setDeleteTarget({ type: 'produit', item: selectedProduit }); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                  )}
                  {canManage && (
                    <>
                      {selectedProduit.aStock && (
                        <Button
                          variant="outline"
                          onClick={() => { setShowDetailModal(false); handleOpenMouvement(selectedProduit); }}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Mouvement stock
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => handleDuplicateProduit(selectedProduit)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Dupliquer
                      </Button>
                      <Button
                        variant="outline"
                        className={cn(selectedProduit.actif ? 'text-amber-700 border-amber-300 hover:bg-amber-50' : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50')}
                        onClick={() => {
                          updateProduitMutation.mutate({ id: selectedProduit.id, data: { actif: !selectedProduit.actif } });
                          setShowDetailModal(false);
                        }}
                      >
                        <Power className="h-4 w-4 mr-2" />
                        {selectedProduit.actif ? 'Désactiver' : 'Activer'}
                      </Button>
                      <Button
                        onClick={() => { setShowDetailModal(false); handleEditProduit(selectedProduit); }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                    Fermer
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmation de suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {deleteTarget?.type === 'produit' ? 'ce produit/service' : deleteTarget?.type === 'categorie' ? 'cette catégorie' : 'cet entrepôt'} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer <strong>{deleteTarget?.item?.nom || deleteTarget?.item?.nomEntreprise}</strong> ?
              Cette action est irréversible.
              {deleteTarget?.type === 'produit' && deleteTarget.item.mouvements?.length > 0 && (
                <span className="block mt-2 text-orange-600">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Ce produit a des mouvements de stock enregistrés.
                </span>
              )}
              {deleteTarget?.type === 'categorie' && deleteTarget.item._count?.produits > 0 && (
                <span className="block mt-2 text-orange-600">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Cette catégorie contient {deleteTarget.item._count.produits} produit(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
