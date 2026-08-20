import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Activity,
  ChevronRight,
  MapPin,
  Building2,
  Plus,
  FileText,
  TrendingUp,
  Filter,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fieldInterventionsApi } from '@/services/api';
import { formatDate, cn } from '@/lib/utils';
import type { FieldIntervention, FieldInterventionStatut } from '@/types';
import { useAuthStore } from '@/store/auth.store';

// ─── Config ───────────────────────────────────────────────────────────────────

const FI_STATUT_CONFIG: Record<FieldInterventionStatut, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  DRAFT:       { label: 'Brouillon',  color: 'bg-gray-100 text-gray-700',   icon: Clock },
  IN_PROGRESS: { label: 'En cours',   color: 'bg-blue-100 text-blue-700',   icon: Activity },
  SUBMITTED:   { label: 'Soumise',    color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  VALIDATED:   { label: 'Validée',    color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  CANCELLED:   { label: 'Annulée',    color: 'bg-red-100 text-red-700',     icon: XCircle },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TerrainPage() {
  const { canDo } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['field-interventions-all', filterStatut, filterType, dateFrom, dateTo, page],
    queryFn: () =>
      fieldInterventionsApi.list({
        statut: filterStatut || undefined,
        type: filterType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit,
      }),
  });

  const items: FieldIntervention[] = (data as any)?.items ?? [];
  const total: number = (data as any)?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  // Filtrage client-side sur search (nom site ou client)
  const filtered = search
    ? items.filter((fi) =>
        fi.site?.nom?.toLowerCase().includes(search.toLowerCase()) ||
        fi.client?.nomEntreprise?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  // Stats rapides (sur les éléments chargés)
  const stats = {
    total,
    enCours: items.filter((fi) => fi.statut === 'IN_PROGRESS').length,
    soumises: items.filter((fi) => fi.statut === 'SUBMITTED').length,
    validees: items.filter((fi) => fi.statut === 'VALIDATED').length,
  };

  const validateMut = useMutation({
    mutationFn: (id: string) => fieldInterventionsApi.validate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-interventions-all'] });
      toast.success('Intervention validée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la validation'),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => fieldInterventionsApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-interventions-all'] });
      toast.success('Intervention annulée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de l\'annulation'),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Terrain & Rapports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suivi des interventions terrain, zoning et rapports de contrôle
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} color="text-gray-700" />
        <StatCard label="En cours" value={stats.enCours} color="text-blue-600" />
        <StatCard label="À valider" value={stats.soumises} color="text-amber-600" />
        <StatCard label="Validées" value={stats.validees} color="text-green-600" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="interventions">
        <TabsList>
          <TabsTrigger value="interventions" className="flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4" /> Interventions
          </TabsTrigger>
          <TabsTrigger value="aValider" className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> À valider
            {stats.soumises > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-xs">{stats.soumises}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rapports" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Rapports
          </TabsTrigger>
        </TabsList>

        {/* ── Toutes les interventions ── */}
        <TabsContent value="interventions" className="mt-4 space-y-4">
          {/* Filtres */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher site ou client..."
                    className="pl-8 h-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={filterType || 'all'} onValueChange={(v) => { setFilterType(v === 'all' ? '' : v); setPage(1); }}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous types</SelectItem>
                    <SelectItem value="OPERATION">Opération</SelectItem>
                    <SelectItem value="VISITE">Visite contrôle</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatut || 'all'} onValueChange={(v) => { setFilterStatut(v === 'all' ? '' : v); setPage(1); }}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    {Object.entries(FI_STATUT_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  className="w-36 h-9 text-sm"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  title="Date début"
                />
                <Input
                  type="date"
                  className="w-36 h-9 text-sm"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  title="Date fin"
                />
                {(filterStatut || filterType || dateFrom || dateTo || search) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-muted-foreground"
                    onClick={() => { setFilterStatut(''); setFilterType(''); setDateFrom(''); setDateTo(''); setSearch(''); setPage(1); }}
                  >
                    Effacer
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <InterventionList
            items={filtered}
            isLoading={isLoading}
            canValidate={canDo('manageInterventions')}
            onValidate={(id) => validateMut.mutate(id)}
            onCancel={(id) => cancelMut.mutate(id)}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── À valider ── */}
        <TabsContent value="aValider" className="mt-4">
          <SubmittedList canValidate={canDo('manageInterventions')} />
        </TabsContent>

        {/* ── Rapports ── */}
        <TabsContent value="rapports" className="mt-4">
          <RapportsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className={cn('text-2xl font-bold', color)}>{value}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function InterventionList({
  items,
  isLoading,
  canValidate,
  onValidate,
  onCancel,
}: {
  items: FieldIntervention[];
  isLoading: boolean;
  canValidate: boolean;
  onValidate: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ClipboardCheck className="h-10 w-10 mb-3" />
          <p className="font-medium">Aucune intervention trouvée</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((fi) => {
        const cfg = FI_STATUT_CONFIG[fi.statut];
        const Icon = cfg.icon;
        return (
          <Card key={fi.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="flex items-center gap-4 py-3 px-4">
              <Icon className={cn('h-5 w-5 shrink-0', cfg.color.split(' ')[1])} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{formatDate(fi.dateIntervention)}</span>
                  <Badge variant="outline" className="text-xs">
                    {fi.type === 'OPERATION' ? 'Opération' : 'Visite'}
                  </Badge>
                  <Badge className={cn('text-xs', cfg.color)}>{cfg.label}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {fi.client && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {fi.client.nomEntreprise}
                    </span>
                  )}
                  {fi.site && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <Link to={`/sites/${fi.siteId}`} className="hover:underline text-blue-600" onClick={(e) => e.stopPropagation()}>
                        {fi.site.nom}
                      </Link>
                    </span>
                  )}
                  {fi._count && <span>{fi._count.controls} dispositifs</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canValidate && fi.statut === 'SUBMITTED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => onValidate(fi.id)}
                  >
                    Valider
                  </Button>
                )}
                {canValidate && ['DRAFT', 'IN_PROGRESS', 'SUBMITTED'].includes(fi.statut) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-red-400 hover:text-red-600"
                    onClick={() => onCancel(fi.id)}
                  >
                    Annuler
                  </Button>
                )}
                <Link to={`/field-interventions/${fi.id}`}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SubmittedList({ canValidate }: { canValidate: boolean }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['field-interventions-submitted'],
    queryFn: () => fieldInterventionsApi.list({ statut: 'SUBMITTED', limit: 50 }),
  });
  const items: FieldIntervention[] = (data as any)?.items ?? [];

  const validateMut = useMutation({
    mutationFn: (id: string) => fieldInterventionsApi.validate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-interventions-submitted'] });
      qc.invalidateQueries({ queryKey: ['field-interventions-all'] });
      toast.success('Intervention validée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la validation'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mb-3 text-green-400" />
          <p className="font-medium">Aucune intervention en attente de validation</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((fi) => (
        <Card key={fi.id} className="border-amber-200 bg-amber-50/30">
          <CardContent className="flex items-center gap-4 py-3 px-4">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">{formatDate(fi.dateIntervention)}</span>
                <Badge variant="outline" className="text-xs">{fi.type === 'OPERATION' ? 'Opération' : 'Visite'}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {fi.client && <span><Building2 className="h-3 w-3 inline mr-0.5" />{fi.client.nomEntreprise}</span>}
                {fi.site && (
                  <Link to={`/sites/${fi.siteId}`} className="hover:underline text-blue-600">
                    <MapPin className="h-3 w-3 inline mr-0.5" />{fi.site.nom}
                  </Link>
                )}
                {fi.submittedAt && <span>Soumise le {formatDate(fi.submittedAt)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canValidate && (
                <Button
                  size="sm"
                  className="h-8 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => validateMut.mutate(fi.id)}
                  disabled={validateMut.isPending}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Valider
                </Button>
              )}
              <Link to={`/field-interventions/${fi.id}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Voir <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RapportsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['field-interventions-rapports'],
    queryFn: () => fieldInterventionsApi.list({ statut: 'VALIDATED', limit: 50 }),
  });
  const items: FieldIntervention[] = ((data as any)?.items ?? []).filter(
    (fi: FieldIntervention) => fi._count && fi._count.reports > 0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mb-3" />
          <p className="font-medium">Aucun rapport disponible</p>
          <p className="text-sm mt-1">Les rapports sont générés depuis les interventions validées.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((fi) => (
        <Card key={fi.id}>
          <CardContent className="flex items-center gap-4 py-3 px-4">
            <FileText className="h-5 w-5 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">{formatDate(fi.dateIntervention)}</span>
                <Badge variant="outline" className="text-xs">{fi.type === 'OPERATION' ? 'Opération' : 'Visite'}</Badge>
                <Badge className="text-xs bg-green-100 text-green-700">Validée</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {fi.client && <span>{fi.client.nomEntreprise}</span>}
                {fi.site && <span><MapPin className="h-3 w-3 inline mr-0.5" />{fi.site.nom}</span>}
                <span>{fi._count?.reports} rapport(s)</span>
              </div>
            </div>
            <Link to={`/field-interventions/${fi.id}`}>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                Voir <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
