import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  History,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { stockApi } from '@/services/api';
import { cn } from '@/lib/utils';
import type { Produit, CreateProduitInput, TypeMouvement } from '@/types';

// ============ PRODUCT FORM DIALOG ============
function ProductFormDialog({
  open,
  onClose,
  product,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  product?: Produit | null;
  onSubmit: (data: CreateProduitInput & { actif?: boolean }) => void;
  isPending: boolean;
}) {
  const [reference, setReference] = useState('');
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [unite, setUnite] = useState('unité');
  const [quantite, setQuantite] = useState('0');
  const [stockMinimum, setStockMinimum] = useState('0');
  const [prixUnitaire, setPrixUnitaire] = useState('');

  const isEditing = !!product;

  // Reset form when dialog opens or product changes
  useEffect(() => {
    if (open) {
      setReference(product?.reference || '');
      setNom(product?.nom || '');
      setDescription(product?.description || '');
      setUnite(product?.unite || 'unité');
      setQuantite(product?.quantite?.toString() || '0');
      setStockMinimum(product?.stockMinimum?.toString() || '0');
      setPrixUnitaire(product?.prixUnitaire?.toString() || '');
    }
  }, [open, product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim() || !nom.trim()) {
      toast.error('Référence et nom requis');
      return;
    }
    onSubmit({
      reference: reference.trim(),
      nom: nom.trim(),
      description: description.trim() || undefined,
      unite,
      quantite: isEditing ? undefined : parseFloat(quantite) || 0,
      stockMinimum: parseFloat(stockMinimum) || 0,
      prixUnitaire: prixUnitaire ? parseFloat(prixUnitaire) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifier les informations du produit' : 'Ajouter un nouveau produit au stock'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Référence *</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="REF-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Unité</Label>
              <Select value={unite} onValueChange={setUnite}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unité">Unité</SelectItem>
                  <SelectItem value="L">Litre (L)</SelectItem>
                  <SelectItem value="Kg">Kilogramme (Kg)</SelectItem>
                  <SelectItem value="m">Mètre (m)</SelectItem>
                  <SelectItem value="m²">Mètre carré (m²)</SelectItem>
                  <SelectItem value="carton">Carton</SelectItem>
                  <SelectItem value="palette">Palette</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom du produit"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optionnel)"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {!isEditing && (
              <div className="space-y-2">
                <Label>Quantité initiale</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Stock minimum</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={stockMinimum}
                onChange={(e) => setStockMinimum(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Prix unitaire</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={prixUnitaire}
                onChange={(e) => setPrixUnitaire(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'En cours...' : isEditing ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============ MOUVEMENT DIALOG ============
function MouvementDialog({
  open,
  onClose,
  produit,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  produit: Produit;
  onSubmit: (data: { type: TypeMouvement; quantite: number; motif?: string }) => void;
  isPending: boolean;
}) {
  const [type, setType] = useState<TypeMouvement>('ENTREE');
  const [quantite, setQuantite] = useState('');
  const [motif, setMotif] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantite);
    if (!qty || qty <= 0) {
      toast.error('Quantité invalide');
      return;
    }
    if (type === 'SORTIE' && qty > produit.quantite) {
      toast.error(`Stock insuffisant. Disponible: ${produit.quantite} ${produit.unite}`);
      return;
    }
    onSubmit({
      type,
      quantite: type === 'AJUSTEMENT' ? qty : qty,
      motif: motif.trim() || undefined,
    });
  };

  const resetForm = () => {
    setType('ENTREE');
    setQuantite('');
    setMotif('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mouvement de stock</DialogTitle>
          <DialogDescription>
            {produit.nom} - Stock actuel: {produit.quantite} {produit.unite}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type de mouvement</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('ENTREE')}
                className={cn(
                  'p-3 rounded-md border text-center transition-all',
                  type === 'ENTREE'
                    ? 'bg-green-50 border-green-500 ring-2 ring-green-200'
                    : 'hover:bg-gray-50'
                )}
              >
                <ArrowDownCircle className={cn('h-6 w-6 mx-auto mb-1', type === 'ENTREE' ? 'text-green-600' : 'text-gray-400')} />
                <div className={cn('text-sm font-medium', type === 'ENTREE' ? 'text-green-700' : 'text-gray-600')}>
                  Entrée
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType('SORTIE')}
                className={cn(
                  'p-3 rounded-md border text-center transition-all',
                  type === 'SORTIE'
                    ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
                    : 'hover:bg-gray-50'
                )}
              >
                <ArrowUpCircle className={cn('h-6 w-6 mx-auto mb-1', type === 'SORTIE' ? 'text-red-600' : 'text-gray-400')} />
                <div className={cn('text-sm font-medium', type === 'SORTIE' ? 'text-red-700' : 'text-gray-600')}>
                  Sortie
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType('AJUSTEMENT')}
                className={cn(
                  'p-3 rounded-md border text-center transition-all',
                  type === 'AJUSTEMENT'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                    : 'hover:bg-gray-50'
                )}
              >
                <RefreshCw className={cn('h-6 w-6 mx-auto mb-1', type === 'AJUSTEMENT' ? 'text-blue-600' : 'text-gray-400')} />
                <div className={cn('text-sm font-medium', type === 'AJUSTEMENT' ? 'text-blue-700' : 'text-gray-600')}>
                  Ajustement
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              {type === 'AJUSTEMENT' ? 'Nouvelle quantité' : 'Quantité'} ({produit.unite})
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              placeholder={type === 'AJUSTEMENT' ? `Actuel: ${produit.quantite}` : '0'}
              required
            />
            {type === 'SORTIE' && (
              <p className="text-xs text-muted-foreground">
                Maximum disponible: {produit.quantite} {produit.unite}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Motif (optionnel)</Label>
            <Textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Raison du mouvement..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'En cours...' : 'Valider'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============ HISTORY DIALOG ============
function HistoryDialog({
  open,
  onClose,
  produit,
}: {
  open: boolean;
  onClose: () => void;
  produit: Produit | null;
}) {
  const { data: fullProduit } = useQuery({
    queryKey: ['produit', produit?.id],
    queryFn: () => stockApi.getProduit(produit!.id),
    enabled: !!produit?.id && open,
  });

  const mouvements = fullProduit?.mouvements || [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique - {produit?.nom}
          </DialogTitle>
          <DialogDescription>
            Référence: {produit?.reference} | Stock actuel: {produit?.quantite} {produit?.unite}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[400px] overflow-auto">
          {mouvements.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun mouvement enregistré</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Avant</TableHead>
                  <TableHead className="text-right">Après</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mouvements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">
                      {format(parseISO(m.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          m.type === 'ENTREE' && 'bg-green-100 text-green-800',
                          m.type === 'SORTIE' && 'bg-red-100 text-red-800',
                          m.type === 'AJUSTEMENT' && 'bg-blue-100 text-blue-800'
                        )}
                      >
                        {m.type === 'ENTREE' ? 'Entrée' : m.type === 'SORTIE' ? 'Sortie' : 'Ajust.'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {m.type === 'ENTREE' ? '+' : m.type === 'SORTIE' ? '-' : ''}
                      {m.quantite}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {m.quantiteAvant}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {m.quantiteApres}
                    </TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">
                      {m.motif || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.user ? `${m.user.prenom} ${m.user.nom}` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ MAIN PAGE ============
export default function Stocks() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);

  // Dialogs
  const [productDialog, setProductDialog] = useState<{ open: boolean; product?: Produit | null }>({
    open: false,
  });
  const [mouvementDialog, setMouvementDialog] = useState<{ open: boolean; produit?: Produit }>({
    open: false,
  });
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; produit?: Produit | null }>({
    open: false,
  });

  // Queries
  const { data: produits = [], isLoading } = useQuery({
    queryKey: ['produits', search, showInactive, showLowStock],
    queryFn: () =>
      stockApi.listProduits({
        search: search || undefined,
        actif: showInactive ? undefined : true,
        stockBas: showLowStock || undefined,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['stock-stats'],
    queryFn: stockApi.getStats,
  });

  const { data: alertes } = useQuery({
    queryKey: ['stock-alertes'],
    queryFn: stockApi.getAlertes,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: stockApi.createProduit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produits'] });
      queryClient.invalidateQueries({ queryKey: ['stock-stats'] });
      toast.success('Produit créé');
      setProductDialog({ open: false });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProduitInput & { actif: boolean }> }) =>
      stockApi.updateProduit(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['produits'] });
      queryClient.invalidateQueries({ queryKey: ['stock-stats'] });
      if (variables.data.actif === true) {
        toast.success('Produit réactivé');
      } else {
        toast.success('Produit modifié');
        setProductDialog({ open: false });
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la modification');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: stockApi.deleteProduit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produits'] });
      queryClient.invalidateQueries({ queryKey: ['stock-stats'] });
      toast.success('Produit supprimé');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const mouvementMutation = useMutation({
    mutationFn: stockApi.createMouvement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produits'] });
      queryClient.invalidateQueries({ queryKey: ['stock-stats'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alertes'] });
      toast.success('Mouvement enregistré');
      setMouvementDialog({ open: false });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors du mouvement');
    },
  });

  const handleProductSubmit = (data: CreateProduitInput) => {
    if (productDialog.product) {
      updateMutation.mutate({ id: productDialog.product.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleMouvementSubmit = (data: { type: TypeMouvement; quantite: number; motif?: string }) => {
    if (!mouvementDialog.produit) return;
    mouvementMutation.mutate({
      produitId: mouvementDialog.produit.id,
      ...data,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des stocks</h1>
          <p className="text-muted-foreground">Gérez vos produits et mouvements de stock</p>
        </div>
        <Button onClick={() => setProductDialog({ open: true, product: null })}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau produit
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total produits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProduits || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produits actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.produitsActifs || 0}</div>
          </CardContent>
        </Card>
        <Card className={cn(stats?.stockBas && stats.stockBas > 0 && 'border-orange-300 bg-orange-50')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              {stats?.stockBas && stats.stockBas > 0 && <AlertTriangle className="h-4 w-4 text-orange-500" />}
              Stock bas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', stats?.stockBas && stats.stockBas > 0 ? 'text-orange-600' : '')}>
              {stats?.stockBas || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mouvements (7j)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.mouvementsRecents || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      {alertes && alertes.count > 0 && (
        <Card className="border-orange-300 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              Alertes stock bas ({alertes.count})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {alertes.alertes.slice(0, 5).map((p) => (
                <Badge key={p.id} variant="outline" className="bg-white border-orange-300">
                  {p.nom}: {p.quantite}/{p.stockMinimum} {p.unite}
                </Badge>
              ))}
              {alertes.count > 5 && (
                <Badge variant="outline" className="bg-white">
                  +{alertes.count - 5} autres
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou référence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showLowStock ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowLowStock(!showLowStock)}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Stock bas
        </Button>
        <Button
          variant={showInactive ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowInactive(!showInactive)}
        >
          <Filter className="h-4 w-4 mr-1" />
          Inclure inactifs
        </Button>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : produits.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Aucun produit trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Stock min.</TableHead>
                  <TableHead className="text-right">Prix unit.</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produits.map((produit) => {
                  const isLow = produit.quantite <= produit.stockMinimum;
                  return (
                    <TableRow key={produit.id} className={cn(!produit.actif && 'opacity-50')}>
                      <TableCell className="font-mono text-sm">{produit.reference}</TableCell>
                      <TableCell>
                        <div className="font-medium">{produit.nom}</div>
                        {produit.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {produit.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn('font-mono font-medium', isLow && 'text-orange-600')}>
                          {produit.quantite}
                        </span>
                        <span className="text-muted-foreground ml-1">{produit.unite}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {produit.stockMinimum} {produit.unite}
                      </TableCell>
                      <TableCell className="text-right">
                        {produit.prixUnitaire ? `${produit.prixUnitaire.toFixed(2)} DA` : '-'}
                      </TableCell>
                      <TableCell>
                        {!produit.actif ? (
                          <Badge variant="secondary">Inactif</Badge>
                        ) : isLow ? (
                          <Badge className="bg-orange-100 text-orange-800">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Stock bas
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMouvementDialog({ open: true, produit })}
                            disabled={!produit.actif}
                            title="Mouvement de stock"
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setHistoryDialog({ open: true, produit })}
                            title="Historique"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setProductDialog({ open: true, product: produit })}
                            title="Modifier"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!produit.actif ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                updateMutation.mutate({ id: produit.id, data: { actif: true } });
                              }}
                              title="Réactiver"
                            >
                              <RefreshCw className="h-4 w-4 text-green-500" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Supprimer ce produit ?')) {
                                  deleteMutation.mutate(produit.id);
                                }
                              }}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ProductFormDialog
        open={productDialog.open}
        onClose={() => setProductDialog({ open: false })}
        product={productDialog.product}
        onSubmit={handleProductSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {mouvementDialog.produit && (
        <MouvementDialog
          open={mouvementDialog.open}
          onClose={() => setMouvementDialog({ open: false })}
          produit={mouvementDialog.produit}
          onSubmit={handleMouvementSubmit}
          isPending={mouvementMutation.isPending}
        />
      )}

      <HistoryDialog
        open={historyDialog.open}
        onClose={() => setHistoryDialog({ open: false })}
        produit={historyDialog.produit || null}
      />
    </div>
  );
}
