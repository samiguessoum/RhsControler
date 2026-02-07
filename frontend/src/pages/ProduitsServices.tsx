import { useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
} from 'lucide-react';

const TYPE_LABELS: Record<TypeProduit, string> = {
  PRODUIT: 'Produit',
  SERVICE: 'Service',
};

const NATURE_LABELS: Record<NatureProduit, string> = {
  MATIERE_PREMIERE: 'Matiere premiere',
  PRODUIT_FINI: 'Produit fini',
  PRODUIT_SEMI_FINI: 'Produit semi-fini',
  CONSOMMABLE: 'Consommable',
  PIECE_DETACHEE: 'Piece detachee',
  AUTRE: 'Autre',
};

const MOUVEMENT_LABELS: Record<TypeMouvementPS, string> = {
  ENTREE: 'Entree',
  SORTIE: 'Sortie',
  AJUSTEMENT: 'Ajustement',
  TRANSFERT: 'Transfert',
  INVENTAIRE: 'Inventaire',
};

export default function ProduitsServices() {
  const { canDo } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('produits');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeProduit | 'all'>('all');

  // Modals
  const [showProduitModal, setShowProduitModal] = useState(false);
  const [showCategorieModal, setShowCategorieModal] = useState(false);
  const [showEntrepotModal, setShowEntrepotModal] = useState(false);
  const [showMouvementModal, setShowMouvementModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Edit state
  const [editingProduit, setEditingProduit] = useState<ProduitService | null>(null);
  const [editingCategorie, setEditingCategorie] = useState<CategorieProduit | null>(null);
  const [editingEntrepot, setEditingEntrepot] = useState<Entrepot | null>(null);
  const [selectedProduit, setSelectedProduit] = useState<ProduitService | null>(null);

  // ============ QUERIES ============

  const { data: produitsData, isLoading: loadingProduits } = useQuery({
    queryKey: ['produits-services', search, typeFilter],
    queryFn: () => produitsServicesApi.list({
      search: search || undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
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

  const { data: entrepots, isLoading: loadingEntrepots } = useQuery({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produits-services'] });
      queryClient.invalidateQueries({ queryKey: ['produits-services-stats'] });
      toast.success('Produit/Service cree');
      setShowProduitModal(false);
      resetProduitForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la creation');
    },
  });

  const updateProduitMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProduitServiceInput & { actif: boolean }> }) =>
      produitsServicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produits-services'] });
      queryClient.invalidateQueries({ queryKey: ['produits-services-stats'] });
      toast.success('Produit/Service mis a jour');
      setShowProduitModal(false);
      setEditingProduit(null);
      resetProduitForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise a jour');
    },
  });

  const deleteProduitMutation = useMutation({
    mutationFn: (id: string) => produitsServicesApi.delete(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['produits-services'] });
      queryClient.invalidateQueries({ queryKey: ['produits-services-stats'] });
      toast.success(data.message);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const createCategorieMutation = useMutation({
    mutationFn: (data: CreateCategorieProduitInput) => categoriesProduitsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-produits'] });
      toast.success('Categorie creee');
      setShowCategorieModal(false);
      resetCategorieForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la creation');
    },
  });

  const updateCategorieMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCategorieProduitInput & { actif: boolean }> }) =>
      categoriesProduitsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-produits'] });
      toast.success('Categorie mise a jour');
      setShowCategorieModal(false);
      setEditingCategorie(null);
      resetCategorieForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise a jour');
    },
  });

  const deleteCategorieMutation = useMutation({
    mutationFn: (id: string) => categoriesProduitsApi.delete(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['categories-produits'] });
      toast.success(data.message);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const createEntrepotMutation = useMutation({
    mutationFn: (data: CreateEntrepotInput) => entrepotsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      toast.success('Entrepot cree');
      setShowEntrepotModal(false);
      resetEntrepotForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la creation');
    },
  });

  const updateEntrepotMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateEntrepotInput & { actif: boolean }> }) =>
      entrepotsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      toast.success('Entrepot mis a jour');
      setShowEntrepotModal(false);
      setEditingEntrepot(null);
      resetEntrepotForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise a jour');
    },
  });

  const deleteEntrepotMutation = useMutation({
    mutationFn: (id: string) => entrepotsApi.delete(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      toast.success(data.message);
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
      toast.success('Mouvement enregistre');
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
    unite: 'unite',
    tauxTVA: 19,
  });

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
      unite: 'unite',
      tauxTVA: 19,
    });
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

  // ============ HANDLERS ============

  const handleEditProduit = (produit: ProduitService) => {
    setEditingProduit(produit);
    setProduitForm({
      reference: produit.reference,
      codeBarres: produit.codeBarres || undefined,
      nom: produit.nom,
      description: produit.description || undefined,
      type: produit.type,
      nature: produit.nature || undefined,
      unite: produit.unite,
      prixVenteHT: produit.prixVenteHT || undefined,
      tauxTVA: produit.tauxTVA || 19,
      prixAchatHT: produit.prixAchatHT || undefined,
      aStock: produit.aStock,
      stockMinimum: produit.stockMinimum,
      stockMaximum: produit.stockMaximum || undefined,
      fournisseurId: produit.fournisseurId || undefined,
      enVente: produit.enVente,
      enAchat: produit.enAchat,
      categorieIds: produit.categories?.map((c) => c.categorie.id) || [],
    });
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

  const handleEditEntrepot = (entrepot: Entrepot) => {
    setEditingEntrepot(entrepot);
    setEntrepotForm({
      code: entrepot.code,
      nom: entrepot.nom,
      description: entrepot.description || undefined,
      adresse: entrepot.adresse || undefined,
      codePostal: entrepot.codePostal || undefined,
      ville: entrepot.ville || undefined,
      responsable: entrepot.responsable || undefined,
      tel: entrepot.tel || undefined,
      email: entrepot.email || undefined,
      estDefaut: entrepot.estDefaut,
    });
    setShowEntrepotModal(true);
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
    if (editingProduit) {
      updateProduitMutation.mutate({ id: editingProduit.id, data: produitForm });
    } else {
      createProduitMutation.mutate(produitForm);
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

  const produits = produitsData?.produits || [];

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produits</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.produitsActifs || 0}</div>
            <p className="text-xs text-muted-foreground">
              sur {stats?.totalProduits || 0} au total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.servicesActifs || 0}</div>
            <p className="text-xs text-muted-foreground">
              sur {stats?.totalServices || 0} au total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock bas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats?.stockBas || 0}</div>
            <p className="text-xs text-muted-foreground">produits en alerte</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCategories || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalEntrepots || 0} entrepots
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertes stock bas */}
      {alertes && alertes.count > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertes stock bas ({alertes.count})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {alertes.alertes.slice(0, 5).map((alerte) => (
                <Badge key={alerte.id} variant="outline" className="border-orange-300 text-orange-700">
                  {alerte.nom}: {alerte.quantite}/{alerte.stockMinimum} {alerte.unite}
                </Badge>
              ))}
              {alertes.count > 5 && (
                <Badge variant="outline" className="border-orange-300 text-orange-700">
                  +{alertes.count - 5} autres
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
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
            Categories
          </TabsTrigger>
          <TabsTrigger value="entrepots" className="flex items-center gap-2">
            <Warehouse className="h-4 w-4" />
            Entrepots
          </TabsTrigger>
        </TabsList>

        {/* TAB: Produits & Services */}
        <TabsContent value="produits" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeProduit | 'all')}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="PRODUIT">Produits</SelectItem>
                  <SelectItem value="SERVICE">Services</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canDo('manageStock') && (
              <Button onClick={() => { resetProduitForm(); setEditingProduit(null); setShowProduitModal(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau
              </Button>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead className="text-right">Prix HT</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProduits ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : produits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucun produit/service trouve
                    </TableCell>
                  </TableRow>
                ) : (
                  produits.map((produit) => (
                    <TableRow key={produit.id} className={!produit.actif ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-sm">{produit.reference}</TableCell>
                      <TableCell>
                        <div className="font-medium">{produit.nom}</div>
                        {produit.codeBarres && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Barcode className="h-3 w-3" />
                            {produit.codeBarres}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={produit.type === 'PRODUIT' ? 'default' : 'secondary'}>
                          {TYPE_LABELS[produit.type]}
                        </Badge>
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
                      <TableCell className="text-right">
                        {produit.prixVenteHT ? `${produit.prixVenteHT.toFixed(2)} DA` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {produit.aStock ? (
                          <span className={produit.quantite <= produit.stockMinimum ? 'text-orange-500 font-medium' : ''}>
                            {produit.quantite} {produit.unite}
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
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetail(produit)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir detail
                            </DropdownMenuItem>
                            {produit.aStock && canDo('manageStock') && (
                              <DropdownMenuItem onClick={() => handleOpenMouvement(produit)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Mouvement stock
                              </DropdownMenuItem>
                            )}
                            {canDo('manageStock') && (
                              <>
                                <DropdownMenuItem onClick={() => handleEditProduit(produit)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    if (confirm('Supprimer ce produit/service ?')) {
                                      deleteProduitMutation.mutate(produit.id);
                                    }
                                  }}
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
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB: Categories */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            {canDo('manageStock') && (
              <Button onClick={() => { resetCategorieForm(); setEditingCategorie(null); setShowCategorieModal(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle categorie
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
                      Aucune categorie
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-mono text-sm">{cat.code || '-'}</TableCell>
                      <TableCell className="font-medium">{cat.nom}</TableCell>
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
                        {canDo('manageStock') && (
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
                                onClick={() => {
                                  if (confirm('Supprimer cette categorie ?')) {
                                    deleteCategorieMutation.mutate(cat.id);
                                  }
                                }}
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

        {/* TAB: Entrepots */}
        <TabsContent value="entrepots" className="space-y-4">
          <div className="flex justify-end">
            {canDo('manageStock') && (
              <Button onClick={() => { resetEntrepotForm(); setEditingEntrepot(null); setShowEntrepotModal(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvel entrepot
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loadingEntrepots ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">Chargement...</div>
            ) : !entrepots || entrepots.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">Aucun entrepot</div>
            ) : (
              entrepots.map((entrepot) => (
                <Card key={entrepot.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Warehouse className="h-4 w-4" />
                          {entrepot.nom}
                          {entrepot.estDefaut && (
                            <Badge variant="secondary" className="text-xs">Defaut</Badge>
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-mono">{entrepot.code}</p>
                      </div>
                      {canDo('manageStock') && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditEntrepot(entrepot)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (confirm('Supprimer cet entrepot ?')) {
                                  deleteEntrepotMutation.mutate(entrepot.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {entrepot.adresse && <p>{entrepot.adresse}</p>}
                    {entrepot.ville && <p>{entrepot.codePostal} {entrepot.ville}</p>}
                    {entrepot.responsable && (
                      <p className="text-muted-foreground">Responsable: {entrepot.responsable}</p>
                    )}
                    <p className="text-muted-foreground">
                      {entrepot._count?.stocks || 0} produits stockes
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal: Produit/Service */}
      <Dialog open={showProduitModal} onOpenChange={setShowProduitModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduit ? 'Modifier le produit/service' : 'Nouveau produit/service'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Type et Reference */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type *</label>
                <Select
                  value={produitForm.type}
                  onValueChange={(v) => setProduitForm({ ...produitForm, type: v as TypeProduit, aStock: v === 'PRODUIT' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUIT">Produit</SelectItem>
                    <SelectItem value="SERVICE">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reference *</label>
                <Input
                  value={produitForm.reference}
                  onChange={(e) => setProduitForm({ ...produitForm, reference: e.target.value })}
                  placeholder="REF-001"
                />
              </div>
            </div>

            {/* Nom et Code-barres */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom *</label>
                <Input
                  value={produitForm.nom}
                  onChange={(e) => setProduitForm({ ...produitForm, nom: e.target.value })}
                  placeholder="Nom du produit/service"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Code-barres</label>
                <Input
                  value={produitForm.codeBarres || ''}
                  onChange={(e) => setProduitForm({ ...produitForm, codeBarres: e.target.value || undefined })}
                  placeholder="EAN13..."
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={produitForm.description || ''}
                onChange={(e) => setProduitForm({ ...produitForm, description: e.target.value || undefined })}
                placeholder="Description courte"
              />
            </div>

            {/* Nature et Unite */}
            <div className="grid grid-cols-2 gap-4">
              {produitForm.type === 'PRODUIT' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nature</label>
                  <Select
                    value={produitForm.nature || ''}
                    onValueChange={(v) => setProduitForm({ ...produitForm, nature: v as NatureProduit || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NATURE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Unite</label>
                <Input
                  value={produitForm.unite || 'unite'}
                  onChange={(e) => setProduitForm({ ...produitForm, unite: e.target.value })}
                  placeholder="unite, L, Kg, h..."
                />
              </div>
            </div>

            {/* Prix */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Prix vente HT</label>
                <Input
                  type="number"
                  step="0.01"
                  value={produitForm.prixVenteHT || ''}
                  onChange={(e) => setProduitForm({ ...produitForm, prixVenteHT: parseFloat(e.target.value) || undefined })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prix achat HT</label>
                <Input
                  type="number"
                  step="0.01"
                  value={produitForm.prixAchatHT || ''}
                  onChange={(e) => setProduitForm({ ...produitForm, prixAchatHT: parseFloat(e.target.value) || undefined })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">TVA %</label>
                <Input
                  type="number"
                  value={produitForm.tauxTVA || 19}
                  onChange={(e) => setProduitForm({ ...produitForm, tauxTVA: parseFloat(e.target.value) || 19 })}
                />
              </div>
            </div>

            {/* Stock */}
            {produitForm.type === 'PRODUIT' && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Stock initial</label>
                  <Input
                    type="number"
                    value={produitForm.quantite || 0}
                    onChange={(e) => setProduitForm({ ...produitForm, quantite: parseFloat(e.target.value) || 0 })}
                    disabled={!!editingProduit}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Stock minimum</label>
                  <Input
                    type="number"
                    value={produitForm.stockMinimum || 0}
                    onChange={(e) => setProduitForm({ ...produitForm, stockMinimum: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Stock maximum</label>
                  <Input
                    type="number"
                    value={produitForm.stockMaximum || ''}
                    onChange={(e) => setProduitForm({ ...produitForm, stockMaximum: parseFloat(e.target.value) || undefined })}
                    placeholder="Illimite"
                  />
                </div>
              </div>
            )}

            {/* Fournisseur */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fournisseur par defaut</label>
              <Select
                value={produitForm.fournisseurId || '_none_'}
                onValueChange={(v) => setProduitForm({ ...produitForm, fournisseurId: v === '_none_' ? undefined : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner un fournisseur..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Aucun</SelectItem>
                  {fournisseurs?.tiers.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nomEntreprise}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Categories</label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
                {categories?.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant={produitForm.categorieIds?.includes(cat.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    style={cat.couleur && produitForm.categorieIds?.includes(cat.id) ? { backgroundColor: cat.couleur } : {}}
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
                ))}
              </div>
            </div>

            {/* Statut vente/achat */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={produitForm.enVente ?? true}
                  onChange={(e) => setProduitForm({ ...produitForm, enVente: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">En vente</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={produitForm.enAchat ?? true}
                  onChange={(e) => setProduitForm({ ...produitForm, enAchat: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">En achat</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProduitModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmitProduit}
              disabled={!produitForm.reference || !produitForm.nom || createProduitMutation.isPending || updateProduitMutation.isPending}
            >
              {editingProduit ? 'Mettre a jour' : 'Creer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Categorie */}
      <Dialog open={showCategorieModal} onOpenChange={setShowCategorieModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategorie ? 'Modifier la categorie' : 'Nouvelle categorie'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input
                  value={categorieForm.code || ''}
                  onChange={(e) => setCategorieForm({ ...categorieForm, code: e.target.value || undefined })}
                  placeholder="CAT01"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom *</label>
                <Input
                  value={categorieForm.nom}
                  onChange={(e) => setCategorieForm({ ...categorieForm, nom: e.target.value })}
                  placeholder="Nom de la categorie"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={categorieForm.description || ''}
                onChange={(e) => setCategorieForm({ ...categorieForm, description: e.target.value || undefined })}
                placeholder="Description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Categorie parente</label>
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
                <label className="text-sm font-medium">Couleur</label>
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
              {editingCategorie ? 'Mettre a jour' : 'Creer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Entrepot */}
      <Dialog open={showEntrepotModal} onOpenChange={setShowEntrepotModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntrepot ? 'Modifier l\'entrepot' : 'Nouvel entrepot'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code *</label>
                <Input
                  value={entrepotForm.code}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, code: e.target.value })}
                  placeholder="ENT01"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom *</label>
                <Input
                  value={entrepotForm.nom}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, nom: e.target.value })}
                  placeholder="Entrepot principal"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Adresse</label>
              <Input
                value={entrepotForm.adresse || ''}
                onChange={(e) => setEntrepotForm({ ...entrepotForm, adresse: e.target.value || undefined })}
                placeholder="Adresse"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code postal</label>
                <Input
                  value={entrepotForm.codePostal || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, codePostal: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ville</label>
                <Input
                  value={entrepotForm.ville || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, ville: e.target.value || undefined })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Responsable</label>
                <Input
                  value={entrepotForm.responsable || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, responsable: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Telephone</label>
                <Input
                  value={entrepotForm.tel || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, tel: e.target.value || undefined })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={entrepotForm.estDefaut || false}
                onChange={(e) => setEntrepotForm({ ...entrepotForm, estDefaut: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Entrepot par defaut</span>
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
              {editingEntrepot ? 'Mettre a jour' : 'Creer'}
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

          <div className="grid gap-4">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm">
                Stock actuel: <strong>{selectedProduit?.quantite} {selectedProduit?.unite}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type de mouvement *</label>
              <Select
                value={mouvementForm.type}
                onValueChange={(v) => setMouvementForm({ ...mouvementForm, type: v as TypeMouvementPS })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTREE">
                    <span className="flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-green-500" />
                      Entree
                    </span>
                  </SelectItem>
                  <SelectItem value="SORTIE">
                    <span className="flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-red-500" />
                      Sortie
                    </span>
                  </SelectItem>
                  <SelectItem value="AJUSTEMENT">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-blue-500" />
                      Ajustement
                    </span>
                  </SelectItem>
                  <SelectItem value="INVENTAIRE">
                    <span className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-purple-500" />
                      Inventaire
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {mouvementForm.type === 'AJUSTEMENT' || mouvementForm.type === 'INVENTAIRE'
                  ? 'Nouvelle quantite *'
                  : 'Quantite *'
                }
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={mouvementForm.quantite}
                onChange={(e) => setMouvementForm({ ...mouvementForm, quantite: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Motif</label>
              <Input
                value={mouvementForm.motif || ''}
                onChange={(e) => setMouvementForm({ ...mouvementForm, motif: e.target.value || undefined })}
                placeholder="Raison du mouvement"
              />
            </div>

            {entrepots && entrepots.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Entrepot</label>
                <Select
                  value={mouvementForm.entrepotId || ''}
                  onValueChange={(v) => setMouvementForm({ ...mouvementForm, entrepotId: v || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectionner..." />
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMouvementModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmitMouvement}
              disabled={mouvementForm.quantite <= 0 || createMouvementMutation.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Detail produit */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProduit?.type === 'PRODUIT' ? <Package className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
              {selectedProduit?.nom}
            </DialogTitle>
          </DialogHeader>

          {selectedProduit && (
            <div className="space-y-6">
              {/* Infos generales */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Reference</p>
                  <p className="font-mono">{selectedProduit.reference}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <Badge variant={selectedProduit.type === 'PRODUIT' ? 'default' : 'secondary'}>
                    {TYPE_LABELS[selectedProduit.type]}
                  </Badge>
                </div>
                {selectedProduit.codeBarres && (
                  <div>
                    <p className="text-sm text-muted-foreground">Code-barres</p>
                    <p className="font-mono">{selectedProduit.codeBarres}</p>
                  </div>
                )}
                {selectedProduit.nature && (
                  <div>
                    <p className="text-sm text-muted-foreground">Nature</p>
                    <p>{NATURE_LABELS[selectedProduit.nature]}</p>
                  </div>
                )}
              </div>

              {selectedProduit.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p>{selectedProduit.description}</p>
                </div>
              )}

              {/* Prix */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Prix vente HT</p>
                  <p className="text-lg font-bold">
                    {selectedProduit.prixVenteHT ? `${selectedProduit.prixVenteHT.toFixed(2)} DA` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prix vente TTC</p>
                  <p className="text-lg font-bold">
                    {selectedProduit.prixVenteTTC ? `${selectedProduit.prixVenteTTC.toFixed(2)} DA` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prix achat HT</p>
                  <p className="text-lg font-bold">
                    {selectedProduit.prixAchatHT ? `${selectedProduit.prixAchatHT.toFixed(2)} DA` : '-'}
                  </p>
                </div>
              </div>

              {/* Stock */}
              {selectedProduit.aStock && (
                <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Stock actuel</p>
                    <p className={`text-lg font-bold ${selectedProduit.quantite <= selectedProduit.stockMinimum ? 'text-orange-500' : ''}`}>
                      {selectedProduit.quantite} {selectedProduit.unite}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stock minimum</p>
                    <p className="text-lg">{selectedProduit.stockMinimum} {selectedProduit.unite}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stock maximum</p>
                    <p className="text-lg">{selectedProduit.stockMaximum || 'Illimite'}</p>
                  </div>
                </div>
              )}

              {/* Categories */}
              {selectedProduit.categories && selectedProduit.categories.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduit.categories.map((cat) => (
                      <Badge
                        key={cat.categorie.id}
                        variant="outline"
                        style={cat.categorie.couleur ? { borderColor: cat.categorie.couleur, color: cat.categorie.couleur } : {}}
                      >
                        {cat.categorie.nom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Fournisseur */}
              {selectedProduit.fournisseur && (
                <div>
                  <p className="text-sm text-muted-foreground">Fournisseur par defaut</p>
                  <p>{selectedProduit.fournisseur.nomEntreprise}</p>
                </div>
              )}

              {/* Derniers mouvements */}
              {selectedProduit.mouvements && selectedProduit.mouvements.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Derniers mouvements</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Quantite</TableHead>
                        <TableHead>Motif</TableHead>
                        <TableHead>Utilisateur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProduit.mouvements.slice(0, 10).map((mvt) => (
                        <TableRow key={mvt.id}>
                          <TableCell className="text-sm">
                            {new Date(mvt.createdAt).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {MOUVEMENT_LABELS[mvt.type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {mvt.type === 'ENTREE' ? '+' : mvt.type === 'SORTIE' ? '-' : ''}
                            {mvt.quantite}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {mvt.motif || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {mvt.user ? `${mvt.user.prenom} ${mvt.user.nom}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
