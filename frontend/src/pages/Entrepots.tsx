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

  // Query
  const { data: entrepots, isLoading } = useQuery({
    queryKey: ['entrepots'],
    queryFn: () => entrepotsApi.list(),
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
      setShowModal(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de la modification'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => entrepotsApi.delete(id),
    onSuccess: () => {
      toast.success('Entrepôt supprimé');
      queryClient.invalidateQueries({ queryKey: ['entrepots'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de la suppression'),
  });

  const resetForm = () => {
    setEntrepotForm(EMPTY_ENTREPOT_FORM);
    setEditingEntrepot(null);
  };

  const handleEdit = (entrepot: Entrepot) => {
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
            <Card key={entrepot.id} className="hover:shadow-md transition-shadow">
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
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(entrepot.adresse || entrepot.ville) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
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
                  <a href={`tel:${entrepot.tel}`} className="flex items-center gap-2 text-primary hover:underline">
                    <Phone className="h-4 w-4" />
                    {entrepot.tel}
                  </a>
                )}
                {entrepot.email && (
                  <a href={`mailto:${entrepot.email}`} className="flex items-center gap-2 text-primary hover:underline">
                    <Mail className="h-4 w-4" />
                    {entrepot.email}
                  </a>
                )}
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Boxes className="h-4 w-4" />
                    {entrepot._count?.stocks || 0} produits stockés
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
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntrepots.map((entrepot) => (
                <TableRow key={entrepot.id}>
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
                      <a href={`tel:${entrepot.tel}`} className="text-primary hover:underline text-sm">
                        {entrepot.tel}
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{entrepot._count?.stocks || 0}</Badge>
                  </TableCell>
                  <TableCell>
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

      {/* Modal */}
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

      {/* Delete Confirmation */}
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
