import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entrepotsApi } from '@/services/api';
import { Entrepot, CreateEntrepotInput } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Warehouse,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Mail,
  User,
  Boxes,
  CheckCircle2,
  LayoutGrid,
  List,
  Star,
  X,
  Building2,
  Calendar,
  Globe,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  ClipboardList,
  PackageSearch,
} from 'lucide-react';

const EMPTY_ENTREPOT_FORM: CreateEntrepotInput = {
  code: '',
  nom: '',
  adresse: '',
  codePostal: '',
  ville: '',
  pays: 'Algérie',
  responsable: '',
  tel: '',
  email: '',
  estDefaut: false,
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-DZ', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-DZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMontant(value?: number | null) {
  if (value == null) return '-';
  return new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' DA';
}

const MOUVEMENT_LABELS: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  ENTREE:     { label: 'Entrée',     icon: TrendingUp,     className: 'bg-green-100 text-green-700 border-green-200' },
  SORTIE:     { label: 'Sortie',     icon: TrendingDown,   className: 'bg-red-100 text-red-700 border-red-200' },
  AJUSTEMENT: { label: 'Ajustement', icon: ClipboardList,  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  TRANSFERT:  { label: 'Transfert',  icon: ArrowLeftRight, className: 'bg-purple-100 text-purple-700 border-purple-200' },
  INVENTAIRE: { label: 'Inventaire', icon: PackageSearch,  className: 'bg-orange-100 text-orange-700 border-orange-200' },
};

export function EntrepotsPage() {
  const queryClient = useQueryClient();
  const { canDo } = useAuthStore();
  const canManage = canDo('manageStock');

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal] = useState(false);
  const [editingEntrepot, setEditingEntrepot] = useState<Entrepot | null>(null);
  const [entrepotForm, setEntrepotForm] = useState<CreateEntrepotInput>(EMPTY_ENTREPOT_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Entrepot | null>(null);
  const [viewingEntrepotId, setViewingEntrepotId] = useState<string | null>(null);

  // Query liste
  const { data: entrepots, isLoading } = useQuery({
    queryKey: ['entrepots'],
    queryFn: () => entrepotsApi.list(),
  });

  // Query détail (chargée quand on clique sur un entrepôt)
  const { data: entrepotDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['entrepot', viewingEntrepotId],
    queryFn: () => entrepotsApi.get(viewingEntrepotId!),
    enabled: !!viewingEntrepotId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateEntrepotInput) => entrepotsApi.create(payload),
    onSuccess: () => {
      toast.success('Entrepôt créé');
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      setShowModal(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de la création'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateEntrepotInput> }) =>
      entrepotsApi.update(id, payload),
    onSuccess: () => {
      toast.success('Entrepôt modifié');
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      queryClient.invalidateQueries({ queryKey: ['entrepot', viewingEntrepotId] });
      setShowModal(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de la modification'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => entrepotsApi.update(id, { estDefaut: true }),
    onSuccess: () => {
      toast.success('Entrepôt par défaut mis à jour');
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      queryClient.invalidateQueries({ queryKey: ['entrepot', viewingEntrepotId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => entrepotsApi.delete(id),
    onSuccess: () => {
      toast.success('Entrepôt supprimé');
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      setDeleteTarget(null);
      setViewingEntrepotId(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de la suppression'),
  });

  const resetForm = () => {
    setEntrepotForm(EMPTY_ENTREPOT_FORM);
    setEditingEntrepot(null);
  };

  const handleEdit = (entrepot: Entrepot, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingEntrepot(entrepot);
    setEntrepotForm({
      code: entrepot.code,
      nom: entrepot.nom,
      adresse: entrepot.adresse || '',
      codePostal: entrepot.codePostal || '',
      ville: entrepot.ville || '',
      pays: entrepot.pays || 'Algérie',
      responsable: entrepot.responsable || '',
      tel: entrepot.tel || '',
      email: entrepot.email || '',
      estDefaut: entrepot.estDefaut || false,
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!entrepotForm.code || !entrepotForm.nom) {
      toast.error('Code et nom requis');
      return;
    }
    if (editingEntrepot) {
      updateMutation.mutate({ id: editingEntrepot.id, payload: entrepotForm });
    } else {
      createMutation.mutate(entrepotForm);
    }
  };

  // Filtrage
  const filteredEntrepots = (entrepots || []).filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.code.toLowerCase().includes(s) ||
      e.nom.toLowerCase().includes(s) ||
      e.ville?.toLowerCase().includes(s) ||
      e.responsable?.toLowerCase().includes(s)
    );
  });

  // Calculs détail
  const stocks = entrepotDetail?.stocks || [];
  const mouvements = entrepotDetail?.mouvements || [];
  const valeurStock = stocks.reduce((sum, s) => {
    const prix = s.produit.prixAchatHT ?? s.produit.prixVenteHT ?? 0;
    return sum + s.quantite * prix;
  }, 0);
  const stocksEnAlerte = stocks.filter(
    (s) => s.produit.stockMinimum != null && s.quantite <= (s.produit.stockMinimum ?? 0)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entrepôts</h1>
          <p className="text-muted-foreground">Gérez vos lieux de stockage</p>
        </div>
        {canManage && (
          <Button onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvel entrepôt
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <Warehouse className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total entrepôts</p>
              <p className="text-2xl font-bold">{entrepots?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Actifs</p>
              <p className="text-2xl font-bold">
                {entrepots?.filter((e) => e.actif).length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-100">
              <Boxes className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total produits stockés</p>
              <p className="text-2xl font-bold">
                {entrepots?.reduce((sum, e) => sum + (e._count?.stocks || 0), 0) || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un entrepôt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : filteredEntrepots.length === 0 ? (
        <div className="text-center py-12">
          <Warehouse className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Aucun entrepôt trouvé</p>
          {canManage && (
            <Button variant="outline" className="mt-4" onClick={() => { resetForm(); setShowModal(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Créer un entrepôt
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEntrepots.map((entrepot) => (
            <Card
              key={entrepot.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setViewingEntrepotId(entrepot.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Warehouse className="h-4 w-4" />
                      {entrepot.nom}
                      {entrepot.estDefaut && (
                        <Badge variant="secondary" className="text-xs">Défaut</Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{entrepot.code}</p>
                  </div>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => handleEdit(entrepot, e)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(entrepot); }}
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
                {!entrepot.actif && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Inactif</Badge>
                )}
                {(entrepot.adresse || entrepot.ville) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      {entrepot.adresse && <p>{entrepot.adresse}</p>}
                      {entrepot.ville && <p>{entrepot.codePostal} {entrepot.ville}</p>}
                    </div>
                  </div>
                )}
                {entrepot.responsable && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{entrepot.responsable}</span>
                  </div>
                )}
                {entrepot.tel && (
                  <a
                    href={`tel:${entrepot.tel}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-4 w-4" />
                    {entrepot.tel}
                  </a>
                )}
                {entrepot.email && (
                  <a
                    href={`mailto:${entrepot.email}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Mail className="h-4 w-4" />
                    {entrepot.email}
                  </a>
                )}
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Boxes className="h-4 w-4" />
                    {entrepot._count?.stocks || 0} produit(s) stocké(s)
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-center">Produits</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntrepots.map((entrepot) => (
                <TableRow
                  key={entrepot.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setViewingEntrepotId(entrepot.id)}
                >
                  <TableCell className="font-mono text-sm">{entrepot.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {entrepot.nom}
                      {entrepot.estDefaut && (
                        <Badge variant="secondary" className="text-xs">Défaut</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {entrepot.ville ? `${entrepot.codePostal} ${entrepot.ville}` : '-'}
                  </TableCell>
                  <TableCell>{entrepot.responsable || '-'}</TableCell>
                  <TableCell>
                    {entrepot.tel && (
                      <a
                        href={`tel:${entrepot.tel}`}
                        className="text-primary hover:underline text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {entrepot.tel}
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{entrepot._count?.stocks || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={entrepot.actif ? 'default' : 'secondary'}
                      className={entrepot.actif ? 'bg-green-100 text-green-700 border-green-200' : ''}
                    >
                      {entrepot.actif ? 'Actif' : 'Inactif'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(entrepot)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteTarget(entrepot)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ============ DETAIL DIALOG ============ */}
      <Dialog open={!!viewingEntrepotId} onOpenChange={(open) => !open && setViewingEntrepotId(null)}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Chargement...
            </div>
          ) : entrepotDetail ? (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Warehouse className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-xl flex items-center gap-2 flex-wrap">
                      {entrepotDetail.nom}
                      {entrepotDetail.estDefaut && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Star className="h-3 w-3" />
                          Défaut
                        </Badge>
                      )}
                    </DialogTitle>
                    <DialogDescription className="font-mono text-sm mt-0.5">
                      {entrepotDetail.code}
                    </DialogDescription>
                    <div className="mt-1">
                      <Badge
                        className={
                          entrepotDetail.actif
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }
                      >
                        {entrepotDetail.actif ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-lg border bg-purple-50 border-purple-100">
                  <p className="text-xs text-muted-foreground">Références</p>
                  <p className="text-xl font-bold text-purple-700">{stocks.length}</p>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg border bg-blue-50 border-blue-100">
                  <p className="text-xs text-muted-foreground">Valeur stock (achat)</p>
                  <p className="text-lg font-bold text-blue-700 truncate">{formatMontant(valeurStock)}</p>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg border bg-red-50 border-red-100">
                  <p className="text-xs text-muted-foreground">Alertes stock bas</p>
                  <p className="text-xl font-bold text-red-600">{stocksEnAlerte.length}</p>
                </div>
                <div className="flex flex-col gap-1 p-3 rounded-lg border bg-muted/40">
                  <p className="text-xs text-muted-foreground">Créé le</p>
                  <p className="text-sm font-medium">{formatDate(entrepotDetail.createdAt)}</p>
                </div>
              </div>

              {/* Tabs : infos / articles / mouvements */}
              <Tabs defaultValue="articles">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="articles">
                    <Boxes className="h-4 w-4 mr-1.5" />
                    Articles ({stocks.length})
                  </TabsTrigger>
                  <TabsTrigger value="mouvements">
                    <ArrowLeftRight className="h-4 w-4 mr-1.5" />
                    Derniers mouvements
                  </TabsTrigger>
                  <TabsTrigger value="infos">
                    <Building2 className="h-4 w-4 mr-1.5" />
                    Informations
                  </TabsTrigger>
                </TabsList>

                {/* Onglet articles */}
                <TabsContent value="articles" className="mt-3">
                  {stocks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Boxes className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>Aucun article dans cet entrepôt</p>
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Référence</TableHead>
                            <TableHead>Désignation</TableHead>
                            <TableHead>Emplacement</TableHead>
                            <TableHead className="text-right">Quantité</TableHead>
                            <TableHead className="text-right">Prix achat HT</TableHead>
                            <TableHead className="text-right">Prix vente TTC</TableHead>
                            <TableHead className="text-right">Valeur stock</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stocks.map((s) => {
                            const isAlerte =
                              s.produit.stockMinimum != null &&
                              s.quantite <= (s.produit.stockMinimum ?? 0);
                            const valeur = s.quantite * (s.produit.prixAchatHT ?? s.produit.prixVenteHT ?? 0);
                            return (
                              <TableRow key={s.id} className={isAlerte ? 'bg-red-50' : ''}>
                                <TableCell className="font-mono text-xs">{s.produit.reference}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    {!s.produit.actif && (
                                      <Badge variant="outline" className="text-xs px-1 py-0">inactif</Badge>
                                    )}
                                    <span className="text-sm">{s.produit.nom}</span>
                                    {isAlerte && (
                                      <Badge variant="destructive" className="text-xs px-1 py-0">stock bas</Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {s.emplacement || '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  <span className={isAlerte ? 'text-red-600' : ''}>
                                    {s.quantite} {s.produit.unite}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {formatMontant(s.produit.prixAchatHT)}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {formatMontant(s.produit.prixVenteTTC)}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium">
                                  {formatMontant(valeur)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Onglet mouvements */}
                <TabsContent value="mouvements" className="mt-3">
                  {mouvements.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>Aucun mouvement enregistré</p>
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Article</TableHead>
                            <TableHead className="text-right">Quantité</TableHead>
                            <TableHead className="text-right">Avant → Après</TableHead>
                            <TableHead>Motif</TableHead>
                            <TableHead>Opérateur</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mouvements.map((m) => {
                            const mv = MOUVEMENT_LABELS[m.type] ?? {
                              label: m.type, icon: ArrowLeftRight, className: 'bg-gray-100 text-gray-700',
                            };
                            const MvIcon = mv.icon;
                            return (
                              <TableRow key={m.id}>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDateShort(m.createdAt)}
                                </TableCell>
                                <TableCell>
                                  <Badge className={`text-xs gap-1 ${mv.className}`}>
                                    <MvIcon className="h-3 w-3" />
                                    {mv.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  <div>
                                    <p className="font-medium">{m.produitService?.nom ?? '-'}</p>
                                    {m.produitService?.reference && (
                                      <p className="text-xs text-muted-foreground font-mono">
                                        {m.produitService.reference}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {m.type === 'SORTIE' ? '-' : '+'}{m.quantite} {m.produitService?.unite ?? ''}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                                  {m.quantiteAvant} → {m.quantiteApres}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                                  {m.motif || '-'}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {m.user ? `${m.user.prenom} ${m.user.nom}` : '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* Onglet informations */}
                <TabsContent value="infos" className="mt-3 space-y-4">
                  {entrepotDetail.description && (
                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                      {entrepotDetail.description}
                    </p>
                  )}

                  {(entrepotDetail.adresse || entrepotDetail.ville || entrepotDetail.pays) && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        Localisation
                      </h4>
                      <div className="space-y-1 pl-6 text-sm">
                        {entrepotDetail.adresse && (
                          <p className="flex items-start gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/60" />
                            {entrepotDetail.adresse}
                          </p>
                        )}
                        {(entrepotDetail.codePostal || entrepotDetail.ville) && (
                          <p className="text-muted-foreground pl-6">
                            {[entrepotDetail.codePostal, entrepotDetail.ville].filter(Boolean).join(' ')}
                          </p>
                        )}
                        {entrepotDetail.pays && (
                          <p className="flex items-center gap-2 text-muted-foreground">
                            <Globe className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                            {entrepotDetail.pays}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {(entrepotDetail.responsable || entrepotDetail.tel || entrepotDetail.email) && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          Contact
                        </h4>
                        <div className="space-y-2 pl-6">
                          {entrepotDetail.responsable && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>{entrepotDetail.responsable}</span>
                            </div>
                          )}
                          {entrepotDetail.tel && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                              <a href={`tel:${entrepotDetail.tel}`} className="text-primary hover:underline">
                                {entrepotDetail.tel}
                              </a>
                            </div>
                          )}
                          {entrepotDetail.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                              <a href={`mailto:${entrepotDetail.email}`} className="text-primary hover:underline break-all">
                                {entrepotDetail.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Créé le {formatDate(entrepotDetail.createdAt)} · Mis à jour le {formatDate(entrepotDetail.updatedAt)}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Footer actions */}
              <DialogFooter className="gap-2 sm:gap-2 pt-2">
                {canManage && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(entrepotDetail)}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Supprimer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleEdit(entrepotDetail);
                        setViewingEntrepotId(null);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1.5" />
                      Modifier
                    </Button>
                    {!entrepotDetail.estDefaut && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        disabled={setDefaultMutation.isPending}
                        onClick={() => setDefaultMutation.mutate(entrepotDetail.id)}
                      >
                        <Star className="h-4 w-4 mr-1.5" />
                        Définir par défaut
                      </Button>
                    )}
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setViewingEntrepotId(null)}>
                  <X className="h-4 w-4 mr-1.5" />
                  Fermer
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ============ CREATE / EDIT MODAL ============ */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntrepot ? 'Modifier l\'entrepôt' : 'Nouvel entrepôt'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code <span className="text-red-500">*</span></Label>
                <Input
                  value={entrepotForm.code}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, code: e.target.value.toUpperCase() })}
                  placeholder="ENT001"
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
              <Textarea
                value={entrepotForm.adresse || ''}
                onChange={(e) => setEntrepotForm({ ...entrepotForm, adresse: e.target.value })}
                placeholder="123 Rue Example"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code postal</Label>
                <Input
                  value={entrepotForm.codePostal || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, codePostal: e.target.value })}
                  placeholder="16000"
                />
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input
                  value={entrepotForm.ville || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, ville: e.target.value })}
                  placeholder="Alger"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Responsable</Label>
              <Input
                value={entrepotForm.responsable || ''}
                onChange={(e) => setEntrepotForm({ ...entrepotForm, responsable: e.target.value })}
                placeholder="Nom du responsable"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={entrepotForm.tel || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, tel: e.target.value })}
                  placeholder="0555 123 456"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={entrepotForm.email || ''}
                  onChange={(e) => setEntrepotForm({ ...entrepotForm, email: e.target.value })}
                  placeholder="entrepot@example.com"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="estDefaut"
                checked={entrepotForm.estDefaut || false}
                onCheckedChange={(checked) => setEntrepotForm({ ...entrepotForm, estDefaut: !!checked })}
              />
              <Label htmlFor="estDefaut" className="cursor-pointer">
                Entrepôt par défaut
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Enregistrement...'
                : editingEntrepot
                ? 'Enregistrer'
                : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ DELETE CONFIRMATION ============ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'entrepôt ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l'entrepôt "{deleteTarget?.nom}" ?
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
    </div>
  );
}

export default EntrepotsPage;
