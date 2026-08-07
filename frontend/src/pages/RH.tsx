import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfYear, endOfYear } from 'date-fns';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  RefreshCw,
  Users,
  UserCheck,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { rhApi, employesApi, interventionsApi } from '@/services/api';
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
  RecuperationEmploye,
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
  const [annee, setAnnee] = useState(anneeActuelle);

  const annees = Array.from({ length: 4 }, (_, i) => anneeActuelle - i);

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Ressources Humaines</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestion des congés, récupérations et soldes employés</p>
        </div>
        <Select value={String(annee)} onValueChange={(v) => setAnnee(Number(v))}>
          <SelectTrigger className="w-28 bg-white shadow-sm shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {annees.map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid w-full grid-cols-5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm h-auto">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Vue d'ensemble</span>
          </TabsTrigger>
          <TabsTrigger value="conges" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Congés</span>
          </TabsTrigger>
          <TabsTrigger value="weekends" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Weekends</span>
          </TabsTrigger>
          <TabsTrigger value="soldes" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Soldes</span>
          </TabsTrigger>
          <TabsTrigger value="recuperation" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Récupération</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <RHDashboardTab annee={annee} />
        </TabsContent>

        <TabsContent value="conges" className="mt-4">
          <CongesTab canManage={canManageRH} annee={annee} />
        </TabsContent>

        <TabsContent value="weekends" className="mt-4">
          <WeekendsTab canManage={canManageRH} annee={annee} />
        </TabsContent>

        <TabsContent value="soldes" className="mt-4">
          <SoldesTab canManage={canManageRH} annee={annee} />
        </TabsContent>

        <TabsContent value="recuperation" className="mt-4">
          <RecuperationTab canManage={canManageRH} annee={annee} />
        </TabsContent>
      </Tabs>
    </div>
    </div>
  );
}

// ============ DASHBOARD TAB ============
function RHDashboardTab({ annee }: { annee: number }) {
  const [recapEmployeId, setRecapEmployeId] = useState<string>('');

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['rh-dashboard'],
    queryFn: rhApi.getDashboard,
  });

  const { data: employes } = useQuery({
    queryKey: ['employes'],
    queryFn: employesApi.list,
  });

  const { data: recap, isLoading: recapLoading } = useQuery({
    queryKey: ['employe-recap-dashboard', recapEmployeId, annee],
    queryFn: () => rhApi.getEmployeRecap(recapEmployeId, annee),
    enabled: !!recapEmployeId,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!dashboard) return null;

  const soldeAnnuel = recap?.soldes.find((s) => s.type === 'ANNUEL');
  const soldeRecup = recap?.soldes.find((s) => s.type === 'RECUPERATION');
  const congesApprouves = recap?.conges.filter((c) => c.statut === 'APPROUVE') || [];
  const congesEnAttente = recap?.conges.filter((c) => c.statut === 'EN_ATTENTE') || [];

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative bg-white rounded-xl p-5 shadow-sm overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-400" />
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Demandes en attente</p>
            <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900">{dashboard.stats.congesEnAttente}</p>
          <p className="text-xs text-gray-400 mt-1">congés à traiter</p>
        </div>

        <div className="relative bg-white rounded-xl p-5 shadow-sm overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">En congé aujourd'hui</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900">{dashboard.stats.employesEnConge}</p>
          <p className="text-xs text-gray-400 mt-1">sur {dashboard.stats.totalEmployes} employés actifs</p>
        </div>

        <div className="relative bg-white rounded-xl p-5 shadow-sm overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500" />
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Récupérations dispo</p>
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900">{dashboard.employesAvecRecup.length}</p>
          <p className="text-xs text-gray-400 mt-1">employés avec jours disponibles</p>
        </div>
      </div>

      {/* Récapitulatif employé */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base font-bold text-gray-900">Récapitulatif employé — {annee}</CardTitle>
            <Select value={recapEmployeId} onValueChange={setRecapEmployeId}>
              <SelectTrigger className="w-52 bg-gray-50">
                <SelectValue placeholder="Sélectionner un employé" />
              </SelectTrigger>
              <SelectContent>
                {employes?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.prenom} {emp.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!recapEmployeId && (
            <p className="text-sm text-gray-400 text-center py-6">Sélectionnez un employé pour voir son récapitulatif</p>
          )}

          {recapEmployeId && recapLoading && (
            <div className="space-y-3">
              <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          )}

          {recap && !recapLoading && (
            <div className="space-y-5">
              {/* Soldes en grille */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Congés annuels */}
                <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Congés annuels</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xl font-black text-gray-900">{soldeAnnuel?.joursAcquis ?? 0}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Acquis</p>
                    </div>
                    <div>
                      <p className="text-xl font-black text-red-500">{soldeAnnuel?.joursPris ?? 0}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Pris</p>
                    </div>
                    <div>
                      <p className={`text-xl font-black ${(soldeAnnuel?.joursRestants ?? 0) > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {soldeAnnuel?.joursRestants ?? 0}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Restants</p>
                    </div>
                  </div>
                  {(soldeAnnuel?.joursReportes ?? 0) > 0 && (
                    <p className="text-xs text-blue-600 text-center">+{soldeAnnuel!.joursReportes}j reportés de l'année précédente</p>
                  )}
                </div>

                {/* Récupération */}
                <div className="bg-green-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Récupération</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xl font-black text-gray-900">{soldeRecup?.joursAcquis ?? 0}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Acquis</p>
                    </div>
                    <div>
                      <p className="text-xl font-black text-red-500">{soldeRecup?.joursPris ?? 0}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Pris</p>
                    </div>
                    <div>
                      <p className={`text-xl font-black ${(soldeRecup?.joursRestants ?? 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {soldeRecup?.joursRestants ?? 0}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Restants</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">{recap.stats.totalWeekendsTravailles} weekend{recap.stats.totalWeekendsTravailles > 1 ? 's' : ''} travaillé{recap.stats.totalWeekendsTravailles > 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Historique des congés pris */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Congés pris en {annee}
                  {congesEnAttente.length > 0 && (
                    <span className="ml-2 text-yellow-600 normal-case font-normal">({congesEnAttente.length} en attente)</span>
                  )}
                </p>
                {congesApprouves.length === 0 && congesEnAttente.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-2">Aucun congé cette année</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...congesEnAttente, ...congesApprouves].map((conge) => (
                      <div key={conge.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className={`text-xs ${TYPE_CONGE_CONFIG[conge.type].bgColor} ${TYPE_CONGE_CONFIG[conge.type].color} border-0`}>
                            {TYPE_CONGE_CONFIG[conge.type].label}
                          </Badge>
                          <span className="text-sm text-gray-700">
                            {format(parseISO(conge.dateDebut), 'dd/MM')} → {format(parseISO(conge.dateFin), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">{conge.nbJours}j</span>
                          <Badge className={`text-xs ${STATUT_CONGE_CONFIG[conge.statut].bgColor} ${STATUT_CONGE_CONFIG[conge.statut].color} border-0`}>
                            {STATUT_CONGE_CONFIG[conge.statut].label}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Congés en cours */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-gray-900">
              Employés en congé aujourd'hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.congesEnCours.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucun employé en congé aujourd'hui</p>
            ) : (
              <div className="space-y-2">
                {dashboard.congesEnCours.map((conge) => (
                  <div key={conge.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                        {conge.employe?.prenom?.[0]}{conge.employe?.nom?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {conge.employe?.prenom} {conge.employe?.nom}
                        </p>
                        <Badge className={`text-xs ${TYPE_CONGE_CONFIG[conge.type].bgColor} ${TYPE_CONGE_CONFIG[conge.type].color} border-0`}>
                          {TYPE_CONGE_CONFIG[conge.type].label}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      jusqu'au {format(parseISO(conge.dateFin), 'dd/MM')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Récupérations disponibles */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-gray-900">
              Jours de récupération disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.employesAvecRecup.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune récupération à prendre</p>
            ) : (
              <div className="space-y-2">
                {dashboard.employesAvecRecup.map((solde) => (
                  <div key={solde.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">
                        {solde.employe?.prenom?.[0]}{solde.employe?.nom?.[0]}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {solde.employe?.prenom} {solde.employe?.nom}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{solde.joursAcquis} acquis</span>
                      <span className="text-gray-300">|</span>
                      <span>{solde.joursPris} pris</span>
                      <span className="text-gray-300">|</span>
                      <span className="font-black text-green-600 text-sm">{solde.joursRestants}j</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ CONGES TAB ============
function CongesTab({ canManage, annee }: { canManage: boolean; annee: number }) {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApprouverDialog, setShowApprouverDialog] = useState(false);
  const [selectedConge, setSelectedConge] = useState<Conge | null>(null);
  const [filterEmploye, setFilterEmploye] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const { data: employes } = useQuery({
    queryKey: ['employes'],
    queryFn: employesApi.list,
  });

  const { data: congesData, isLoading } = useQuery({
    queryKey: ['conges', filterEmploye, filterStatut, filterType, annee],
    queryFn: () =>
      rhApi.listConges({
        employeId: filterEmploye !== 'all' ? filterEmploye : undefined,
        statut: filterStatut !== 'all' ? filterStatut : undefined,
        dateDebut: startOfYear(new Date(annee, 0, 1)).toISOString(),
        dateFin: endOfYear(new Date(annee, 0, 1)).toISOString(),
      }),
  });

  const congesFiltres = useMemo(() => {
    if (!congesData?.conges) return [];
    if (filterType === 'all') return congesData.conges;
    return congesData.conges.filter((c) => c.type === filterType);
  }, [congesData, filterType]);

  const approuverMutation = useMutation({
    mutationFn: ({ id, approuve, commentaire }: { id: string; approuve: boolean; commentaire?: string }) =>
      rhApi.approuverConge(id, { approuve, commentaire }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['conges'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['soldes'] });
      setShowApprouverDialog(false);
      setSelectedConge(null);
      toast.success(vars.approuve ? 'Congé approuvé' : 'Congé refusé');
    },
    onError: () => toast.error('Erreur lors du traitement'),
  });

  const annulerMutation = useMutation({
    mutationFn: rhApi.annulerConge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conges'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
      toast.success('Congé annulé');
    },
    onError: () => toast.error('Erreur lors de l\'annulation'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Select value={filterEmploye} onValueChange={setFilterEmploye}>
            <SelectTrigger className="w-44 bg-white shadow-sm">
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

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40 bg-white shadow-sm">
              <SelectValue placeholder="Tous les types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {Object.entries(TYPE_CONGE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-40 bg-white shadow-sm">
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

        <Button onClick={() => setShowCreateDialog(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle demande
        </Button>
      </div>

      {isLoading ? (
        <Card className="shadow-sm">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </Card>
      ) : (
        <Card className="shadow-sm">
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
              {congesFiltres.map((conge) => (
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
                            disabled={approuverMutation.isPending}
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
                          disabled={annulerMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {congesFiltres.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucun congé trouvé pour {annee}
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
    nbJours: 0,
    motif: '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        employeId: '',
        type: 'ANNUEL',
        dateDebut: '',
        dateFin: '',
        nbJours: 0,
        motif: '',
      });
    }
  }, [open]);

  // Calcul automatique du nombre de jours ouvrés entre les deux dates
  const nbJoursCalc = useMemo(() => {
    if (!formData.dateDebut || !formData.dateFin) return 0;
    const start = new Date(formData.dateDebut);
    const end = new Date(formData.dateFin);
    if (end < start) return 0;
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 5 && day !== 6) count++; // exclure vendredi et samedi (semaine algérienne)
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }, [formData.dateDebut, formData.dateFin]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, nbJours: nbJoursCalc }));
  }, [nbJoursCalc]);

  const createMutation = useMutation({
    mutationFn: rhApi.createConge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conges'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
      toast.success('Demande de congé créée');
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de la création'),
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date debut</Label>
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
                min={formData.dateDebut || undefined}
                onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                required
              />
            </div>
          </div>

          {formData.dateDebut && formData.dateFin && (
            <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
              nbJoursCalc > 0 ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'
            }`}>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Duree calculee (jours ouvrables)</p>
                <p className={`text-lg font-bold ${nbJoursCalc > 0 ? 'text-primary' : 'text-destructive'}`}>
                  {nbJoursCalc > 0 ? `${nbJoursCalc} jour${nbJoursCalc > 1 ? 's' : ''}` : 'Dates invalides'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Vendredi et samedi exclus</p>
            </div>
          )}

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
            <Button type="submit" disabled={createMutation.isPending || !formData.employeId || nbJoursCalc === 0}>
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
  const [confirmingKeys, setConfirmingKeys] = useState<Set<string>>(new Set());

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

  // Fetch recent interventions to suggest weekend entries
  const dateDebut90 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return format(d, 'yyyy-MM-dd');
  }, []);

  const { data: recentInterventionsData } = useQuery({
    queryKey: ['interventions-weekend-suggestions', dateDebut90],
    queryFn: () =>
      interventionsApi.list({
        dateDebut: dateDebut90,
        dateFin: format(new Date(), 'yyyy-MM-dd'),
        limit: 500,
      }),
  });

  // Compute suggestions: weekend interventions not yet in weekendTravaille
  const suggestions = useMemo(() => {
    const interventions = recentInterventionsData?.interventions || [];
    const registeredKeys = new Set(
      (weekendsData?.jours || []).map((j) => `${j.employeId}_${j.date.slice(0, 10)}`)
    );

    const result: Array<{
      key: string;
      employeId: string;
      employe: { prenom: string; nom: string } | undefined;
      date: string;
      estVendredi: boolean;
      clientNom: string;
      heurePrevue?: string;
      heureFin?: string;
      notes: string;
    }> = [];

    for (const intervention of interventions) {
      if (intervention.statut === 'ANNULEE') continue;
      const dateStr = (intervention.dateRealisee || intervention.datePrevue || '').slice(0, 10);
      if (!dateStr) continue;
      const dayOfWeek = new Date(`${dateStr}T12:00:00`).getDay();
      if (dayOfWeek !== 5 && dayOfWeek !== 6) continue; // Vendredi=5, Samedi=6

      const estVendredi = dayOfWeek === 5;

      for (const ie of intervention.interventionEmployes || []) {
        const key = `${ie.employeId}_${dateStr}`;
        if (registeredKeys.has(key)) continue;

        let heureFin: string | undefined;
        if (intervention.heurePrevue && intervention.duree) {
          const [h, m] = intervention.heurePrevue.split(':').map(Number);
          const total = h * 60 + m + intervention.duree;
          heureFin = `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
        }

        const clientNom = (intervention as any).client?.nomEntreprise || 'Client';
        const horaireStr = intervention.heurePrevue
          ? ` de ${intervention.heurePrevue}${heureFin ? ` à ${heureFin}` : ''}`
          : '';
        const notes = `Intervention ${clientNom}${horaireStr}`;

        result.push({
          key,
          employeId: ie.employeId,
          employe: ie.employe,
          date: dateStr,
          estVendredi,
          clientNom,
          heurePrevue: intervention.heurePrevue,
          heureFin,
          notes,
        });
      }
    }

    return result;
  }, [recentInterventionsData, weekendsData]);

  const createWeekendMutation = useMutation({
    mutationFn: rhApi.createWeekendTravaille,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekends'] });
      queryClient.invalidateQueries({ queryKey: ['soldes'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
      toast.success('Weekend travaillé enregistré');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de l\'enregistrement'),
  });

  const deleteMutation = useMutation({
    mutationFn: rhApi.deleteWeekendTravaille,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekends'] });
      queryClient.invalidateQueries({ queryKey: ['soldes'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
      toast.success('Entrée supprimée');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  return (
    <div className="space-y-4">
      {/* Suggestions de récupération depuis le planning */}
      {suggestions.length > 0 && canManage && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-800">
              {suggestions.length} intervention{suggestions.length > 1 ? 's' : ''} de weekend sans récupération enregistrée
            </p>
          </div>
          <div className="space-y-2">
            {suggestions.map((s) => {
              const isPending = confirmingKeys.has(s.key);
              return (
                <div key={s.key} className="flex items-center justify-between bg-white border border-amber-100 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${s.estVendredi ? 'bg-blue-500' : 'bg-purple-500'}`} />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {s.employe?.prenom} {s.employe?.nom}
                      </p>
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">{s.estVendredi ? 'Vendredi' : 'Samedi'}</span>
                        {' '}{format(new Date(`${s.date}T12:00:00`), 'dd/MM/yyyy')}
                        {' — '}{s.clientNom}
                        {s.heurePrevue && <span> · {s.heurePrevue}{s.heureFin ? `–${s.heureFin}` : ''}</span>}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-600 text-green-700 hover:bg-green-50 text-xs"
                    disabled={isPending}
                    onClick={async () => {
                      setConfirmingKeys((prev) => new Set(prev).add(s.key));
                      try {
                        await createWeekendMutation.mutateAsync({
                          employeId: s.employeId,
                          date: s.date,
                          notes: s.notes,
                        });
                      } finally {
                        setConfirmingKeys((prev) => {
                          const next = new Set(prev);
                          next.delete(s.key);
                          return next;
                        });
                      }
                    }}
                  >
                    {isPending ? 'Enregistrement...' : 'Enregistrer récup'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-3">
          <Select value={filterEmploye} onValueChange={setFilterEmploye}>
            <SelectTrigger className="w-48 bg-white shadow-sm">
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
          <Button onClick={() => setShowAddDialog(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter manuellement
          </Button>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold text-gray-900">
            Jours de weekend travaillés en {annee}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
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
      toast.success('Weekend travaillé ajouté');
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de l\'ajout'),
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
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold text-gray-900">Soldes de congés {annee}</CardTitle>
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
                    <TableCell className="text-center font-black text-blue-700">
                      {item.annuel?.joursRestants || 0}
                    </TableCell>
                    <TableCell className="text-center">{item.recuperation?.joursAcquis || 0}</TableCell>
                    <TableCell className="text-center">{item.recuperation?.joursPris || 0}</TableCell>
                    <TableCell className="text-center font-black text-green-600">
                      {item.recuperation?.joursRestants || 0}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-600 text-green-700 hover:bg-green-50"
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
      toast.success('Solde mis à jour');
      onOpenChange(false);
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
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

// ============ RECUPERATION TAB ============
function RecuperationTab({ canManage, annee }: { canManage: boolean; annee: number }) {
  const queryClient = useQueryClient();
  const [expandedEmployeId, setExpandedEmployeId] = useState<string | null>(null);
  const [accordDialog, setAccordDialog] = useState<{ open: boolean; employeId: string; employeNom: string } | null>(null);
  const [accordForm, setAccordForm] = useState({ nbJours: 1, motif: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['recuperations', annee],
    queryFn: () => rhApi.listRecuperations({ annee }),
  });

  const accorderMutation = useMutation({
    mutationFn: rhApi.accorderRecuperation,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['recuperations'] });
      queryClient.invalidateQueries({ queryKey: ['soldes'] });
      queryClient.invalidateQueries({ queryKey: ['rh-dashboard'] });
      toast.success(`${vars.nbJours}j de récupération accordés`);
      setAccordDialog(null);
      setAccordForm({ nbJours: 1, motif: '' });
    },
    onError: () => toast.error('Erreur lors de l\'accord'),
  });

  const deleteMutation = useMutation({
    mutationFn: rhApi.deleteRecuperationAccordee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recuperations'] });
      queryClient.invalidateQueries({ queryKey: ['soldes'] });
      toast.success('Accord de récupération supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const recuperations: RecuperationEmploye[] = data?.recuperations || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dialog accorder récupération */}
      <Dialog open={!!accordDialog?.open} onOpenChange={(open) => !open && setAccordDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accorder des jours de récupération</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Employé : <span className="font-semibold">{accordDialog?.employeNom}</span>
            </p>
            <div className="space-y-1">
              <Label>Nombre de jours *</Label>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={accordForm.nbJours}
                onChange={(e) => setAccordForm((f) => ({ ...f, nbJours: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Motif</Label>
              <Input
                placeholder="Ex: travail exceptionnel, astreinte..."
                value={accordForm.motif}
                onChange={(e) => setAccordForm((f) => ({ ...f, motif: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAccordDialog(null)}>Annuler</Button>
            <Button
              onClick={() => {
                if (!accordDialog || accordForm.nbJours <= 0) return;
                accorderMutation.mutate({
                  employeId: accordDialog.employeId,
                  nbJours: accordForm.nbJours,
                  motif: accordForm.motif || undefined,
                  annee,
                });
              }}
              disabled={accorderMutation.isPending || accordForm.nbJours <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Award className="h-4 w-4 mr-1" />
              Accorder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liste des employés */}
      {recuperations.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm">
          Aucun employé trouvé
        </div>
      ) : (
        recuperations.map((rec) => {
          const { employe, weekends, accordees, congesRecup, solde } = rec;
          const isExpanded = expandedEmployeId === employe.id;
          const joursWeekend = weekends.length; // nb weekends travaillés
          const joursAccordes = accordees.reduce((s, a) => s + a.nbJours, 0);
          const joursConsommes = congesRecup
            .filter((c) => c.statut === 'APPROUVE')
            .reduce((s, c) => s + c.nbJours, 0);
          const joursRestants = (solde?.joursRestants ?? 0);
          const initiales = `${employe.prenom[0]}${employe.nom[0]}`.toUpperCase();

          // Timeline combinée (weekends + accordées + congés récup), triée par date desc
          const timeline: Array<{ date: string; label: string; type: 'weekend' | 'accord' | 'conge'; jours?: number; id: string; statut?: string }> = [
            ...weekends.map((w) => ({
              date: w.date,
              label: `Weekend travaillé — ${w.estVendredi ? 'Vendredi' : 'Samedi'}${w.notes ? ` (${w.notes})` : ''}`,
              type: 'weekend' as const,
              id: w.id,
            })),
            ...accordees.map((a) => ({
              date: a.dateAccordee,
              label: `+${a.nbJours}j accordé${a.motif ? ` — ${a.motif}` : ''}`,
              type: 'accord' as const,
              jours: a.nbJours,
              id: a.id,
            })),
            ...congesRecup.map((c) => ({
              date: c.dateDebut,
              label: `${c.nbJours}j récup pris${c.motif ? ` — ${c.motif}` : ''}`,
              type: 'conge' as const,
              jours: c.nbJours,
              id: c.id,
              statut: c.statut,
            })),
          ].sort((a, b) => b.date.localeCompare(a.date));

          return (
            <div key={employe.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header de la carte employé */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedEmployeId(isExpanded ? null : employe.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                    {initiales}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{employe.prenom} {employe.nom}</div>
                    <div className="text-xs text-gray-500">{employe.postes.map((p) => p.nom).join(', ')}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* KPIs inline */}
                  <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 mr-2">
                    <span>{joursWeekend} weekend{joursWeekend > 1 ? 's' : ''}</span>
                    {joursAccordes > 0 && <span className="text-blue-600">+{joursAccordes}j accordé{joursAccordes > 1 ? 's' : ''}</span>}
                    {joursConsommes > 0 && <span className="text-red-500">−{joursConsommes}j pris</span>}
                  </div>

                  {/* Solde badge */}
                  <div className={`px-3 py-1 rounded-full text-sm font-black ${
                    joursRestants > 0 ? 'bg-green-100 text-green-700' :
                    joursRestants < 0 ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {joursRestants > 0 ? '+' : ''}{joursRestants}j
                  </div>

                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-700 border-green-300 hover:bg-green-50 h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAccordDialog({ open: true, employeId: employe.id, employeNom: `${employe.prenom} ${employe.nom}` });
                        setAccordForm({ nbJours: 1, motif: '' });
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Accorder
                    </Button>
                  )}

                  {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </div>

              {/* Section dépliée : historique + stats */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  {/* Résumé du solde */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-black text-orange-600">{joursWeekend}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Weekends travaillés</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-black text-blue-600">+{joursAccordes}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Jours accordés</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-black text-red-600">−{joursConsommes}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Jours consommés</div>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${joursRestants > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                      <div className={`text-xl font-black ${joursRestants > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {joursRestants > 0 ? '+' : ''}{joursRestants}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Solde restant</div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Historique</h4>
                    {timeline.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Aucun événement</p>
                    ) : (
                      <div className="space-y-2">
                        {timeline.map((event) => (
                          <div key={`${event.type}-${event.id}`} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                event.type === 'weekend' ? 'bg-orange-400' :
                                event.type === 'accord' ? 'bg-blue-400' : 'bg-red-400'
                              }`} />
                              <span className="text-gray-500 text-xs w-20 flex-shrink-0">
                                {format(parseISO(event.date), 'dd/MM/yyyy')}
                              </span>
                              <span className="text-gray-700">{event.label}</span>
                              {event.statut && (
                                <Badge variant="secondary" className={`text-xs ${
                                  event.statut === 'APPROUVE' ? 'bg-green-100 text-green-700' :
                                  event.statut === 'EN_ATTENTE' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {event.statut === 'APPROUVE' ? 'Approuvé' : event.statut === 'EN_ATTENTE' ? 'En attente' : event.statut}
                                </Badge>
                              )}
                            </div>
                            {event.type === 'accord' && canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                onClick={() => deleteMutation.mutate(event.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
