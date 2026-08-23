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
import { fieldInterventionsApi, interventionsApi, tiersApi } from '@/services/api';
import { formatDate, cn, getStatutLabel, getStatutColor } from '@/lib/utils';
import type { FieldIntervention, FieldInterventionStatut, Intervention, Tiers } from '@/types';
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

  // Stats : uniquement les interventions SUBMITTED pour le badge "À valider"
  const { data: statsData } = useQuery({
    queryKey: ['field-interventions-stats'],
    queryFn: () => fieldInterventionsApi.list({ statut: 'SUBMITTED', limit: 1 }),
  });
  const soumisesCount: number = (statsData as any)?.total ?? 0;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Fiches à valider" value={soumisesCount} color="text-amber-600" />
        <StatCard label="En attente de rapport" value={0} color="text-blue-600" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients" className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" /> Sites
          </TabsTrigger>
          <TabsTrigger value="rapports" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Rapports à faire
          </TabsTrigger>
          <TabsTrigger value="aValider" className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> À valider
            {soumisesCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-xs">{soumisesCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Sites & clients ── */}
        <TabsContent value="clients" className="mt-4">
          <ClientsSitesList />
        </TabsContent>

        {/* ── Rapports à faire : opérations réalisées sans rapport ── */}
        <TabsContent value="rapports" className="mt-4">
          <RapportsList />
        </TabsContent>

        {/* ── À valider ── */}
        <TabsContent value="aValider" className="mt-4">
          <SubmittedList canValidate={canDo('manageInterventions')} />
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

function ClientsSitesList() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['terrain-clients-sites', search],
    queryFn: () =>
      tiersApi.list({
        typeTiers: 'CLIENT',
        actif: true,
        search: search || undefined,
        limit: 100,
      }),
  });
  const clients: Tiers[] = data?.tiers ?? [];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un client..."
          className="pl-8 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Building2 className="h-10 w-10 mb-3" />
            <p className="font-medium">Aucun client trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  {client.nomEntreprise}
                </div>

                {client.sites && client.sites.length > 0 ? (
                  <div className="grid gap-2">
                    {client.sites.map((site) => (
                      <div
                        key={site.id}
                        className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-white rounded-lg border border-blue-100"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <MapPin className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-blue-900 truncate">{site.nom}</div>
                            {(site.adresse || site.ville) && (
                              <p className="text-xs text-muted-foreground truncate">
                                {[site.adresse, site.ville].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <Link to={`/sites/${site.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0">
                            Zoning & Terrain
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pl-6">Aucun site pour ce client</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// L'onglet Rapports suit le planning : toutes les opérations RÉALISÉES (contrat →
// planning), regroupées site par site, pour que l'assistante puisse croiser les
// données terrain et éditer le rapport de chaque site.
function RapportsList() {
  const { canDo } = useAuthStore();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['planning-operations-realisees', dateFrom, dateTo],
    queryFn: () =>
      interventionsApi.list({
        type: 'OPERATION',
        statut: 'REALISEE',
        dateDebut: dateFrom || undefined,
        dateFin: dateTo || undefined,
        sort: 'desc',
        limit: 300,
      }),
  });
  const items: Intervention[] = data?.interventions ?? [];

  const startMut = useMutation({
    mutationFn: (interventionId: string) => interventionsApi.startFieldReport(interventionId),
    onSuccess: (fi: FieldIntervention) => {
      qc.invalidateQueries({ queryKey: ['planning-operations-realisees'] });
      navigate(`/field-interventions/${fi.id}`);
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors du démarrage de la fiche terrain'),
  });

  const filtered = search
    ? items.filter((pi) =>
        pi.site?.nom?.toLowerCase().includes(search.toLowerCase()) ||
        pi.client?.nomEntreprise?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  // Regroupement site par site (conserve l'ordre du plus récent au plus ancien)
  const bySite = new Map<string, { site: Intervention['site']; client: Intervention['client']; ops: Intervention[] }>();
  for (const pi of filtered) {
    const key = pi.siteId || pi.id;
    if (!bySite.has(key)) bySite.set(key, { site: pi.site, client: pi.client, ops: [] });
    bySite.get(key)!.ops.push(pi);
  }
  const groups = Array.from(bySite.values());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un site ou un client..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Input type="date" className="w-36 h-9 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Réalisée depuis le" />
        <Input type="date" className="w-36 h-9 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Réalisée jusqu'au" />
        {(search || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}>
            Effacer
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mb-3" />
            <p className="font-medium">Aucune opération réalisée</p>
            <p className="text-sm mt-1">Les rapports suivent les opérations marquées réalisées dans le planning.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.site?.id ?? group.ops[0].id}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    {group.client?.nomEntreprise}
                    {group.site && (
                      <>
                        <span className="text-muted-foreground font-normal">›</span>
                        <MapPin className="h-3.5 w-3.5 text-blue-600" />
                        {group.site.nom}
                      </>
                    )}
                    <Badge variant="secondary" className="text-xs">{group.ops.length}</Badge>
                  </div>
                  {group.site && (
                    <Link to={`/sites/${group.site.id}?tab=rapports`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        Rapport du site <ChevronRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>

                <div className="grid gap-2">
                  {group.ops.map((pi) => {
                    const fi = pi.fieldIntervention;
                    return (
                      <div
                        key={pi.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-gray-50"
                      >
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="font-medium">{formatDate(pi.dateRealisee || pi.datePrevue)}</span>
                          {!fi && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50">Fiche terrain manquante</Badge>
                          )}
                          {fi && fi.statut !== 'VALIDATED' && (
                            <Badge className={cn('text-xs', FI_STATUT_CONFIG[fi.statut].color)}>
                              Fiche {FI_STATUT_CONFIG[fi.statut].label.toLowerCase()}
                            </Badge>
                          )}
                          {fi && fi.statut === 'VALIDATED' && (
                            <Badge className="text-xs bg-amber-100 text-amber-700">Rapport à générer</Badge>
                          )}
                        </div>
                        {!fi && canDo('realiserIntervention') ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                            disabled={startMut.isPending}
                            onClick={() => startMut.mutate(pi.id)}
                          >
                            Créer la fiche
                          </Button>
                        ) : fi ? (
                          <Link to={`/field-interventions/${fi.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              Voir la fiche <ChevronRight className="h-3 w-3 ml-0.5" />
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
