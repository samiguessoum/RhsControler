import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { prestationsApi, usersApi, employesApi, postesApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import type { Prestation, User, Role, Employe, Poste } from '@/types';

export function ParametresPage() {
  const queryClient = useQueryClient();
  const { canDo } = useAuthStore();

  const [isCreatePrestationOpen, setIsCreatePrestationOpen] = useState(false);
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null);
  const [pendingPrestation, setPendingPrestation] = useState<{ nom: string; ordre?: number; description?: string } | null>(null);
  const [confirmPrestationCreateOpen, setConfirmPrestationCreateOpen] = useState(false);
  const [deletePrestationTarget, setDeletePrestationTarget] = useState<Prestation | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserRole, setNewUserRole] = useState<Role>('PLANNING');
  const [editUserRole, setEditUserRole] = useState<Role>('PLANNING');
  const [isCreateEmployeOpen, setIsCreateEmployeOpen] = useState(false);
  const [editingEmploye, setEditingEmploye] = useState<Employe | null>(null);
  const [viewingEmploye, setViewingEmploye] = useState<Employe | null>(null);
  const [deleteEmployeTarget, setDeleteEmployeTarget] = useState<Employe | null>(null);
  const [newEmployePosteIds, setNewEmployePosteIds] = useState<string[]>([]);
  const [editEmployePosteIds, setEditEmployePosteIds] = useState<string[]>([]);
  const [employeSearch, setEmployeSearch] = useState('');
  const [isCreatePosteOpen, setIsCreatePosteOpen] = useState(false);
  const [editingPoste, setEditingPoste] = useState<Poste | null>(null);
  const [deletePosteTarget, setDeletePosteTarget] = useState<Poste | null>(null);

  const { data: prestations = [] } = useQuery({
    queryKey: ['prestations'],
    queryFn: () => prestationsApi.list(),
    enabled: canDo('managePrestations'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: canDo('manageUsers'),
  });

  const { data: employes = [] } = useQuery({
    queryKey: ['employes'],
    queryFn: employesApi.list,
    enabled: canDo('manageEmployes'),
  });

  const { data: postes = [] } = useQuery({
    queryKey: ['postes'],
    queryFn: () => postesApi.list(),
    enabled: canDo('viewPostes') || canDo('managePostes') || canDo('manageEmployes'),
  });

  const createPrestationMutation = useMutation({
    mutationFn: ({ nom, ordre, description }: { nom: string; ordre?: number; description?: string }) =>
      prestationsApi.create({ nom, ordre, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestations'] });
      toast.success('Prestation créée');
      setIsCreatePrestationOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updatePrestationMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { nom?: string; ordre?: number; description?: string; actif?: boolean } }) =>
      prestationsApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestations'] });
      toast.success('Prestation mise à jour');
      setEditingPrestation(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deletePrestationMutation = useMutation({
    mutationFn: (id: string) => prestationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestations'] });
      toast.success('Prestation supprimée');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });
  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur créé');
      setIsCreateUserOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur mis à jour');
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const createEmployeMutation = useMutation({
    mutationFn: (payload: { prenom: string; nom: string; posteIds: string[] }) => employesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employes'] });
      toast.success('Employé créé');
      setIsCreateEmployeOpen(false);
      setNewEmployePosteIds([]);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateEmployeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { prenom?: string; nom?: string; posteIds?: string[] } }) =>
      employesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employes'] });
      toast.success('Employé mis à jour');
      setEditingEmploye(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteEmployeMutation = useMutation({
    mutationFn: (id: string) => employesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employes'] });
      toast.success('Employé supprimé');
      setDeleteEmployeTarget(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const createPosteMutation = useMutation({
    mutationFn: (payload: { nom: string }) => postesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postes'] });
      toast.success('Poste créé');
      setIsCreatePosteOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updatePosteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { nom?: string; actif?: boolean } }) => postesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postes'] });
      toast.success('Poste mis à jour');
      setEditingPoste(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deletePosteMutation = useMutation({
    mutationFn: (id: string) => postesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postes'] });
      toast.success('Poste supprimé');
      setDeletePosteTarget(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  useEffect(() => {
    if (editingUser) {
      setEditUserRole(editingUser.role);
    }
  }, [editingUser]);

  useEffect(() => {
    if (editingEmploye) {
      setEditEmployePosteIds((editingEmploye.postes || []).map((p) => p.id));
    }
  }, [editingEmploye]);

  const togglePoste = (current: string[], value: string, setValue: (next: string[]) => void) => {
    if (current.includes(value)) {
      setValue(current.filter((p) => p !== value));
    } else {
      setValue([...current, value]);
    }
  };

  const filteredEmployes = employeSearch.trim()
    ? employes.filter((e) => {
        const postesLabel = e.postes.map((p) => p.nom).join(' ');
        const haystack = `${e.prenom} ${e.nom} ${postesLabel}`.toLowerCase();
        return haystack.includes(employeSearch.trim().toLowerCase());
      })
    : employes;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          Gestion des utilisateurs, employés et prestations
        </p>
      </div>

      {canDo('managePrestations') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Prestations</CardTitle>
            <Button onClick={() => setIsCreatePrestationOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle prestation
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {prestations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune prestation</p>
            ) : (
              prestations.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{p.nom}</p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Ordre: {p.ordre}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingPrestation(p)}>
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeletePrestationTarget(p)}>
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {canDo('managePostes') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Postes</CardTitle>
            <Button onClick={() => setIsCreatePosteOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau poste
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {postes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun poste</p>
            ) : (
              postes.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{p.nom}</p>
                    <p className="text-xs text-muted-foreground">{p.actif ? 'Actif' : 'Inactif'}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingPoste(p)}>
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeletePosteTarget(p)}>
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {canDo('manageEmployes') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Employés</CardTitle>
            <Button onClick={() => setIsCreateEmployeOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel employé
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {employes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="employeSearch">Recherche</Label>
                <Input
                  id="employeSearch"
                  value={employeSearch}
                  onChange={(e) => setEmployeSearch(e.target.value)}
                  placeholder="Rechercher par nom ou poste"
                />
              </div>
            )}
            {filteredEmployes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun employé</p>
            ) : (
              filteredEmployes.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {e.prenom} {e.nom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.postes.map((p) => p.nom).join(' • ')}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewingEmploye(e)}>
                        Voir détails
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingEmploye(e)}>
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteEmployeTarget(e)}>
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {canDo('manageUsers') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Utilisateurs</CardTitle>
            <Button onClick={() => setIsCreateUserOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel utilisateur
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun utilisateur</p>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {u.prenom} {u.nom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {u.email} • {u.role} • {u.actif ? 'Actif' : 'Inactif'}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingUser(u)}>
                        Modifier
                      </DropdownMenuItem>
                      {u.actif && (
                        <DropdownMenuItem
                          onClick={() => updateUserMutation.mutate({ id: u.id, data: { actif: false } })}
                        >
                          Désactiver
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreatePrestationOpen} onOpenChange={setIsCreatePrestationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle prestation</DialogTitle>
            <DialogDescription>Ajoutez une prestation disponible</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const nom = formData.get('nom') as string;
              const ordreRaw = formData.get('ordre') as string;
              const ordre = ordreRaw ? Number(ordreRaw) : undefined;
              const description = (formData.get('description') as string) || undefined;
              setPendingPrestation({ nom, ordre, description });
              setConfirmPrestationCreateOpen(true);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input name="nom" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea name="description" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ordre">Ordre</Label>
              <Input name="ordre" type="number" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatePrestationOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createPrestationMutation.isPending}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPrestation} onOpenChange={() => setEditingPrestation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la prestation</DialogTitle>
          </DialogHeader>
          {editingPrestation && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const nom = formData.get('nom') as string;
                const ordreRaw = formData.get('ordre') as string;
                const ordre = ordreRaw ? Number(ordreRaw) : undefined;
                const description = (formData.get('description') as string) || undefined;
                updatePrestationMutation.mutate({ id: editingPrestation.id, updates: { nom, ordre, description } });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input name="nom" defaultValue={editingPrestation.nom} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea name="description" defaultValue={editingPrestation.description || ''} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ordre">Ordre</Label>
                <Input name="ordre" type="number" defaultValue={editingPrestation.ordre} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPrestation(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={updatePrestationMutation.isPending}>
                  Mettre à jour
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmPrestationCreateOpen} onOpenChange={setConfirmPrestationCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la création</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous créer cette prestation ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmPrestationCreateOpen(false)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPrestation) createPrestationMutation.mutate(pendingPrestation);
                setPendingPrestation(null);
                setConfirmPrestationCreateOpen(false);
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePrestationTarget} onOpenChange={(open) => !open && setDeletePrestationTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette prestation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePrestationTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePrestationTarget) deletePrestationMutation.mutate(deletePrestationTarget.id);
                setDeletePrestationTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCreatePosteOpen} onOpenChange={setIsCreatePosteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau poste</DialogTitle>
            <DialogDescription>Ajoutez un poste</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const nom = formData.get('nom') as string;
              createPosteMutation.mutate({ nom });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input name="nom" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatePosteOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createPosteMutation.isPending}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPoste} onOpenChange={() => setEditingPoste(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le poste</DialogTitle>
          </DialogHeader>
          {editingPoste && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const nom = formData.get('nom') as string;
                updatePosteMutation.mutate({ id: editingPoste.id, data: { nom } });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input name="nom" defaultValue={editingPoste.nom} required />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPoste(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={updatePosteMutation.isPending}>
                  Mettre à jour
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePosteTarget} onOpenChange={(open) => !open && setDeletePosteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce poste ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePosteTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePosteTarget) deletePosteMutation.mutate(deletePosteTarget.id);
                setDeletePosteTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isCreateEmployeOpen}
        onOpenChange={(open) => {
          setIsCreateEmployeOpen(open);
          if (!open) setNewEmployePosteIds([]);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel employé</DialogTitle>
            <DialogDescription>Ajoutez un employé</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = {
                prenom: formData.get('prenom') as string,
                nom: formData.get('nom') as string,
                posteIds: newEmployePosteIds,
              };
              createEmployeMutation.mutate(data);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom *</Label>
                <Input name="prenom" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input name="nom" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Postes *</Label>
              <div className="grid grid-cols-2 gap-2">
                {postes.map((poste) => (
                  <label key={poste.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newEmployePosteIds.includes(poste.id)}
                      onCheckedChange={() => togglePoste(newEmployePosteIds, poste.id, setNewEmployePosteIds)}
                    />
                    <span>{poste.nom}</span>
                  </label>
                ))}
                {postes.length === 0 && (
                  <p className="text-xs text-muted-foreground">Créez un poste avant d’ajouter un employé.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateEmployeOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createEmployeMutation.isPending || newEmployePosteIds.length === 0}
              >
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEmploye} onOpenChange={() => setEditingEmploye(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'employé</DialogTitle>
          </DialogHeader>
          {editingEmploye && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const prenom = formData.get('prenom') as string;
                const nom = formData.get('nom') as string;
                updateEmployeMutation.mutate({
                  id: editingEmploye.id,
                  data: { prenom, nom, posteIds: editEmployePosteIds },
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom *</Label>
                  <Input name="prenom" defaultValue={editingEmploye.prenom} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom *</Label>
                  <Input name="nom" defaultValue={editingEmploye.nom} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Postes *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {postes.map((poste) => (
                    <label key={poste.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editEmployePosteIds.includes(poste.id)}
                        onCheckedChange={() => togglePoste(editEmployePosteIds, poste.id, setEditEmployePosteIds)}
                      />
                      <span>{poste.nom}</span>
                    </label>
                  ))}
                  {postes.length === 0 && (
                    <p className="text-xs text-muted-foreground">Créez un poste pour l’affecter.</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingEmploye(null)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={updateEmployeMutation.isPending || editEmployePosteIds.length === 0}
                >
                  Mettre à jour
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingEmploye} onOpenChange={() => setViewingEmploye(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails employé</DialogTitle>
          </DialogHeader>
          {viewingEmploye && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nom complet</p>
                <p className="font-medium">{viewingEmploye.prenom} {viewingEmploye.nom}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Postes</p>
                <p className="font-medium">
                  {viewingEmploye.postes.map((p) => p.nom).join(', ')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEmployeTarget} onOpenChange={(open) => !open && setDeleteEmployeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet employé ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteEmployeTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteEmployeTarget) deleteEmployeMutation.mutate(deleteEmployeTarget.id);
                setDeleteEmployeTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isCreateUserOpen}
        onOpenChange={(open) => {
          setIsCreateUserOpen(open);
          if (!open) setNewUserRole('PLANNING');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>Ajoutez un compte utilisateur</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = {
                email: formData.get('email') as string,
                password: formData.get('password') as string,
                nom: formData.get('nom') as string,
                prenom: formData.get('prenom') as string,
                tel: (formData.get('tel') as string) || undefined,
                role: newUserRole,
              };
              createUserMutation.mutate(data);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom *</Label>
                <Input name="prenom" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input name="nom" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input name="password" type="password" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tel">Téléphone</Label>
                <Input name="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECTION">Direction</SelectItem>
                    <SelectItem value="PLANNING">Planning</SelectItem>
                    <SelectItem value="EQUIPE">Équipe</SelectItem>
                    <SelectItem value="LECTURE">Lecture</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l’utilisateur</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = {
                email: formData.get('email') as string,
                nom: formData.get('nom') as string,
                prenom: formData.get('prenom') as string,
                tel: (formData.get('tel') as string) || undefined,
                role: editUserRole,
              };
              updateUserMutation.mutate({ id: editingUser.id, data });
            }}
            className="space-y-4"
          >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom *</Label>
                  <Input name="prenom" defaultValue={editingUser.prenom} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom *</Label>
                  <Input name="nom" defaultValue={editingUser.nom} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input name="email" type="email" defaultValue={editingUser.email} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tel">Téléphone</Label>
                  <Input name="tel" defaultValue={editingUser.tel || ''} />
                </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select value={editUserRole} onValueChange={(v) => setEditUserRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="DIRECTION">Direction</SelectItem>
                      <SelectItem value="PLANNING">Planning</SelectItem>
                      <SelectItem value="EQUIPE">Équipe</SelectItem>
                      <SelectItem value="LECTURE">Lecture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  Mettre à jour
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
