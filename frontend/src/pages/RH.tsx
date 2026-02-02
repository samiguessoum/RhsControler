import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfYear, endOfYear } from 'date-fns';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';

import { rhApi, employesApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useAuthStore } from '@/store/auth.store';
import type {
  Conge,
  TypeConge,
  StatutConge,
  Employe,
  CreateCongeInput,
  CreateWeekendTravailleInput,
} from '@/types';

// ============ CONFIGURATION ============
const TYPE_CONGE_CONFIG: Record<TypeConge, { label: string; color: string; bgColor: string }> = {
  ANNUEL: { label: 'Congé annuel', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  MALADIE: { label: 'Maladie', color: 'text-red-700', bgColor: 'bg-red-100' },
  RECUPERATION: { label: 'Récupération', color: 'text-green-700', bgColor: 'bg-green-100' },
  SANS_SOLDE: { label: 'Sans solde', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  EXCEPTIONNEL: { label: 'Exceptionnel', color: 'text-purple-700', bgColor: 'bg-purple-100' },
};

const STATUT_CONGE_CONFIG: Record<StatutConge, { label: string; color: string; bgColor: string }> = {
  EN_ATTENTE: { label: 'En attente', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  APPROUVE: { label: 'Approuvé', color: 'text-green-700', bgColor: 'bg-green-100' },
  REFUSE: { label: 'Refusé', color: 'text-red-700', bgColor: 'bg-red-100' },
  ANNULE: { label: 'Annulé', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export default function RHPage() {
  const { canDo } = useAuthStore();
  const canManageRH = canDo('manageRH');
  const anneeActuelle = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ressources Humaines</h1>
          <p className="text-muted-foreground">
            Gestion des congés et jours de récupération
          </p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="conges">Congés</TabsTrigger>
          <TabsTrigger value="weekends">Weekends travaillés</TabsTrigger>
          <TabsTrigger value="soldes">Soldes</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <RHDashboardTab />
        </TabsContent>

        <TabsContent value="conges">
          <CongesTab canManage={canManageRH} />
        </TabsContent>

        <TabsContent value="weekends">
          <WeekendsTab canManage={canManageRH} annee={anneeActuelle} />
        </TabsContent>

        <TabsContent value="soldes">
          <SoldesTab canManage={canManageRH} annee={anneeActuelle} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ DASHBOARD TAB ============
function RHDashboardTab() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['rh-dashboard'],
    queryFn: rhApi.getDashboard,
  });

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Congés en attente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.stats.congesEnAttente}</div>
            <p className="text-xs text-muted-foreground">demandes à traiter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En congé aujourd'hui</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.stats.employesEnConge}</div>
            <p className="text-xs text-muted-foreground">
              sur {dashboard.stats.totalEmployes} employés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Récup. à prendre</CardTitle>
            <RefreshCw className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.employesAvecRecup.length}</div>
            <p className="text-xs text-muted-foreground">employés avec jours disponibles</p>
          </CardContent>
        </Card>
      </div>

      {/* Congés en cours */}
      {dashboard.congesEnCours.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Employés en congé aujourd'hui</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboard.congesEnCours.map((conge) => (
                <div key={conge.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">
                      {conge.employe?.prenom} {conge.employe?.nom}
                    </span>
                    <Badge className={`ml-2 ${TYPE_CONGE_CONFIG[conge.type].bgColor} ${TYPE_CONGE_CONFIG[conge.type].color}`}>
                      {TYPE_CONGE_CONFIG[conge.type].label}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Jusqu'au {format(parseISO(conge.dateFin), 'dd/MM/yyyy')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Récupérations disponibles */}
      {dashboard.employesAvecRecup.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Jours de récupération disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead className="text-right">Jours acquis</TableHead>
                  <TableHead className="text-right">Jours pris</TableHead>
                  <TableHead className="text-right">Restants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.employesAvecRecup.map((solde) => (
                  <TableRow key={solde.id}>
                    <TableCell className="font-medium">
                      {solde.employe?.prenom} {solde.employe?.nom}
                    </TableCell>
                    <TableCell className="text-right">{solde.joursAcquis}</TableCell>
                    <TableCell className="text-right">{solde.joursPris}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {solde.joursRestants}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ CONGES TAB ============
function CongesTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApprouverDialog, setShowApprouverDialog] = useState(false);
  const [selectedConge, setSelectedConge] = useState<Conge | null>(null);
  const [filterEmploye, setFilterEmploye] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');

  const { data: employes } = useQuery({
    queryKey: ['employes'],
    queryFn: employesApi.list,
  });

  const { data: congesData, isLoading } = useQuery({
    queryKey: ['conges', filterEmploye, filterStatut],
    queryFn: () =>
      rhApi.listConges({
        employeId: filterEmploye !== 'all' ? filterEmploye : undefined,
        statut: filterStatut !== 'all' ? filterStatut : undefined,
      }),
  });

  const approuverMutation = useMutation({
    mutationFn: ({ id, approuve, commentaire }: { id: string; approuve: boolean; commentaire?: string }) =>
      rhApi.approuverConge(id, { approuve, commentaire }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conges'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
      setShowApprouverDialog(false);
      setSelectedConge(null);
    },
  });

  const annulerMutation = useMutation({
    mutationFn: rhApi.annulerConge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conges'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <Select value={filterEmploye} onValueChange={setFilterEmploye}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tous les employés" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les employés</SelectItem>
              {employes?.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.prenom} {emp.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUT_CONGE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle demande
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Période</TableHead>
                <TableHead className="text-center">Jours</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {congesData?.conges.map((conge) => (
                <TableRow key={conge.id}>
                  <TableCell className="font-medium">
                    {conge.employe?.prenom} {conge.employe?.nom}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${TYPE_CONGE_CONFIG[conge.type].bgColor} ${TYPE_CONGE_CONFIG[conge.type].color}`}>
                      {TYPE_CONGE_CONFIG[conge.type].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(parseISO(conge.dateDebut), 'dd/MM/yyyy')} -{' '}
                    {format(parseISO(conge.dateFin), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-center">{conge.nbJours}</TableCell>
                  <TableCell>
                    <Badge className={`${STATUT_CONGE_CONFIG[conge.statut].bgColor} ${STATUT_CONGE_CONFIG[conge.statut].color}`}>
                      {STATUT_CONGE_CONFIG[conge.statut].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-32 truncate">{conge.motif || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {canManage && conge.statut === 'EN_ATTENTE' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            onClick={() => {
                              setSelectedConge(conge);
                              setShowApprouverDialog(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => approuverMutation.mutate({ id: conge.id, approuve: false })}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {canManage && (conge.statut === 'EN_ATTENTE' || (conge.statut === 'APPROUVE' && new Date(conge.dateDebut) > new Date())) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => annulerMutation.mutate(conge.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {congesData?.conges.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucun congé trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreateCongeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        employes={employes || []}
      />

      <ApprouverCongeDialog
        open={showApprouverDialog}
        onOpenChange={setShowApprouverDialog}
        conge={selectedConge}
        onApprouver={(commentaire) => {
          if (selectedConge) {
            approuverMutation.mutate({ id: selectedConge.id, approuve: true, commentaire });
          }
        }}
      />
    </div>
  );
}

// ============ CREATE CONGE DIALOG ============
function CreateCongeDialog({
  open,
  onOpenChange,
  employes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employes: Employe[];
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateCongeInput>({
    employeId: '',
    type: 'ANNUEL',
    dateDebut: '',
    dateFin: '',
    nbJours: 1,
    motif: '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        employeId: '',
        type: 'ANNUEL',
        dateDebut: '',
        dateFin: '',
        nbJours: 1,
        motif: '',
      });
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: rhApi.createConge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conges'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle demande de congé</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Employé</Label>
            <Select
              value={formData.employeId}
              onValueChange={(v) => setFormData({ ...formData, employeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un employé" />
              </SelectTrigger>
              <SelectContent>
                {employes.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.prenom} {emp.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type de congé</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => setFormData({ ...formData, type: v as TypeConge })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONGE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date début</Label>
              <Input
                type="date"
                value={formData.dateDebut}
                onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date fin</Label>
              <Input
                type="date"
                value={formData.dateFin}
                onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nombre de jours</Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              value={formData.nbJours}
              onChange={(e) => setFormData({ ...formData, nbJours: parseFloat(e.target.value) })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Motif (optionnel)</Label>
            <Input
              value={formData.motif || ''}
              onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
              placeholder="Raison du congé..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !formData.employeId}>
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============ APPROUVER CONGE DIALOG ============
function ApprouverCongeDialog({
  open,
  onOpenChange,
  conge,
  onApprouver,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conge: Conge | null;
  onApprouver: (commentaire?: string) => void;
}) {
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    if (open) setCommentaire('');
  }, [open]);

  if (!conge) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approuver le congé</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-medium">
              {conge.employe?.prenom} {conge.employe?.nom}
            </p>
            <p className="text-sm text-muted-foreground">
              {TYPE_CONGE_CONFIG[conge.type].label} - {conge.nbJours} jour(s)
            </p>
            <p className="text-sm">
              Du {format(parseISO(conge.dateDebut), 'dd/MM/yyyy')} au{' '}
              {format(parseISO(conge.dateFin), 'dd/MM/yyyy')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Commentaire (optionnel)</Label>
            <Input
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Ajouter un commentaire..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => onApprouver(commentaire)}>Approuver</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ WEEKENDS TAB ============
function WeekendsTab({ canManage, annee }: { canManage: boolean; annee: number }) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterEmploye, setFilterEmploye] = useState<string>('all');

  const { data: employes } = useQuery({
    queryKey: ['employes'],
    queryFn: employesApi.list,
  });

  const { data: weekendsData, isLoading } = useQuery({
    queryKey: ['weekends', filterEmploye, annee],
    queryFn: () =>
      rhApi.listWeekendTravailles({
        employeId: filterEmploye !== 'all' ? filterEmploye : undefined,
        dateDebut: startOfYear(new Date(annee, 0, 1)).toISOString(),
        dateFin: endOfYear(new Date(annee, 0, 1)).toISOString(),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: rhApi.deleteWeekendTravaille,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekends'] });
      queryClient.invalidateQueries({ queryKey: ['soldes'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <Select value={filterEmploye} onValueChange={setFilterEmploye}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tous les employés" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les employés</SelectItem>
              {employes?.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.prenom} {emp.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canManage && (
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un jour
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Jours de weekend travaillés en {annee}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Chargement...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Jour</TableHead>
                  <TableHead>Notes</TableHead>
                  {canManage && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekendsData?.jours.map((jour) => (
                  <TableRow key={jour.id}>
                    <TableCell className="font-medium">
                      {jour.employe?.prenom} {jour.employe?.nom}
                    </TableCell>
                    <TableCell>{format(parseISO(jour.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={jour.estVendredi ? 'secondary' : 'default'}>
                        {jour.estVendredi ? 'Vendredi' : 'Samedi'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{jour.notes || '-'}</TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => deleteMutation.mutate(jour.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {weekendsData?.jours.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucun jour de weekend travaillé enregistré
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddWeekendDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        employes={employes || []}
      />
    </div>
  );
}

// ============ ADD WEEKEND DIALOG ============
function AddWeekendDialog({
  open,
  onOpenChange,
  employes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employes: Employe[];
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateWeekendTravailleInput>({
    employeId: '',
    date: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        employeId: '',
        date: '',
        notes: '',
      });
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: rhApi.createWeekendTravaille,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekends'] });
      queryClient.invalidateQueries({ queryKey: ['soldes'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un jour de weekend travaillé</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Employé</Label>
            <Select
              value={formData.employeId}
              onValueChange={(v) => setFormData({ ...formData, employeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un employé" />
              </SelectTrigger>
              <SelectContent>
                {employes.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.prenom} {emp.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date (vendredi ou samedi)</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Sélectionnez une date qui tombe un vendredi ou un samedi
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notes (optionnel)</Label>
            <Input
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Intervention spécifique, etc."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !formData.employeId || !formData.date}>
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============ SOLDES TAB ============
function SoldesTab({ canManage, annee }: { canManage: boolean; annee: number }) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedEmploye, setSelectedEmploye] = useState<Employe | null>(null);

  const { data: employes } = useQuery({
    queryKey: ['employes'],
    queryFn: employesApi.list,
  });

  const { data: soldesData, isLoading } = useQuery({
    queryKey: ['soldes', annee],
    queryFn: () => rhApi.getSoldes({ annee }),
  });

  // Grouper les soldes par employé
  const soldesParEmploye = employes?.map((emp) => {
    const soldesEmp = soldesData?.soldes.filter((s) => s.employeId === emp.id) || [];
    return {
      employe: emp,
      soldes: soldesEmp,
      annuel: soldesEmp.find((s) => s.type === 'ANNUEL'),
      recuperation: soldesEmp.find((s) => s.type === 'RECUPERATION'),
    };
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Soldes de congés {annee}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Chargement...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead className="text-center" colSpan={3}>
                    Congés annuels
                  </TableHead>
                  <TableHead className="text-center" colSpan={3}>
                    Récupération
                  </TableHead>
                  {canManage && <TableHead></TableHead>}
                </TableRow>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead className="text-center text-xs">Acquis</TableHead>
                  <TableHead className="text-center text-xs">Pris</TableHead>
                  <TableHead className="text-center text-xs">Restants</TableHead>
                  <TableHead className="text-center text-xs">Acquis</TableHead>
                  <TableHead className="text-center text-xs">Pris</TableHead>
                  <TableHead className="text-center text-xs">Restants</TableHead>
                  {canManage && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {soldesParEmploye?.map((item) => (
                  <TableRow key={item.employe.id}>
                    <TableCell className="font-medium">
                      {item.employe.prenom} {item.employe.nom}
                    </TableCell>
                    <TableCell className="text-center">{item.annuel?.joursAcquis || 0}</TableCell>
                    <TableCell className="text-center">{item.annuel?.joursPris || 0}</TableCell>
                    <TableCell className="text-center font-bold">
                      {item.annuel?.joursRestants || 0}
                    </TableCell>
                    <TableCell className="text-center">{item.recuperation?.joursAcquis || 0}</TableCell>
                    <TableCell className="text-center">{item.recuperation?.joursPris || 0}</TableCell>
                    <TableCell className="text-center font-bold text-green-600">
                      {item.recuperation?.joursRestants || 0}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedEmploye(item.employe);
                            setShowEditDialog(true);
                          }}
                        >
                          Modifier
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditSoldeDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        employe={selectedEmploye}
        annee={annee}
      />
    </div>
  );
}

// ============ EDIT SOLDE DIALOG ============
function EditSoldeDialog({
  open,
  onOpenChange,
  employe,
  annee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employe: Employe | null;
  annee: number;
}) {
  const queryClient = useQueryClient();
  const [joursAnnuels, setJoursAnnuels] = useState(0);

  const { data: recap } = useQuery({
    queryKey: ['employe-recap', employe?.id, annee],
    queryFn: () => (employe ? rhApi.getEmployeRecap(employe.id, annee) : null),
    enabled: !!employe && open,
  });

  useEffect(() => {
    if (recap) {
      const soldeAnnuel = recap.soldes.find((s) => s.type === 'ANNUEL');
      setJoursAnnuels(soldeAnnuel?.joursAcquis || 0);
    }
  }, [recap]);

  const updateMutation = useMutation({
    mutationFn: rhApi.updateSolde,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soldes'] });
      queryClient.invalidateQueries({ queryKey: ['employe-recap'] });
      onOpenChange(false);
    },
  });

  if (!employe) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      employeId: employe.id,
      annee,
      type: 'ANNUEL',
      joursAcquis: joursAnnuels,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Modifier les soldes - {employe.prenom} {employe.nom}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Jours de congé annuel acquis</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={joursAnnuels}
                onChange={(e) => setJoursAnnuels(parseFloat(e.target.value) || 0)}
              />
            </div>

            {recap && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Récapitulatif récupération</h4>
                <p className="text-sm">
                  Weekends travaillés: <strong>{recap.stats.totalWeekendsTravailles}</strong>
                </p>
                <p className="text-sm">
                  Jours de récup acquis (calculé automatiquement):{' '}
                  <strong className="text-green-600">{recap.stats.joursRecupAcquis}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Les jours de récupération sont calculés automatiquement selon les weekends travaillés.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
