import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Phone,
  Mail,
  Building2,
  Map,
  ClipboardList,
  TrendingUp,
  FileText,
  FolderOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Edit2,
  Trash2,
  ChevronRight,
  Bug,
  Shield,
  Layers,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { tiersApi, zoningApi, fieldInterventionsApi } from '@/services/api';
import { formatDate, cn } from '@/lib/utils';
import type {
  Site,
  ZoningVersion,
  Zone,
  MonitoringDevice,
  FieldIntervention,
  FieldInterventionStatut,
  DeviceType,
  SiteDocument,
  SiteAnalytics,
} from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  BAIT_STATION: 'Poste d\'appâtage',
  MECHANICAL_TRAP: 'Piège mécanique',
  GLUE_TRAP: 'Boîte à colle',
  FLYING_INSECT_KILLER: 'Destructeur insectes',
};

const DEVICE_TYPE_COLORS: Record<DeviceType, string> = {
  BAIT_STATION: 'bg-orange-100 text-orange-800',
  MECHANICAL_TRAP: 'bg-red-100 text-red-800',
  GLUE_TRAP: 'bg-yellow-100 text-yellow-800',
  FLYING_INSECT_KILLER: 'bg-blue-100 text-blue-800',
};

const FI_STATUT_CONFIG: Record<FieldInterventionStatut, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock },
  IN_PROGRESS: { label: 'En cours', color: 'bg-blue-100 text-blue-700', icon: Activity },
  SUBMITTED: { label: 'Soumise', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  VALIDATED: { label: 'Validée', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  CANCELLED: { label: 'Annulée', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const ZONING_STATUT_CONFIG = {
  DRAFT: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700' },
  ARCHIVED: { label: 'Archivée', color: 'bg-slate-100 text-slate-600' },
};

// ─── Main component ───────────────────────────────────────────────────────────

export function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Site data
  const { data: site, isLoading } = useQuery<Site>({
    queryKey: ['site', siteId],
    queryFn: async () => {
      const { data } = await import('@/services/api').then((m) => m.default.get(`/tiers/${siteId}/site`));
      return data;
    },
    enabled: !!siteId,
  });

  // Zoning versions
  const { data: zoningVersions = [] } = useQuery<ZoningVersion[]>({
    queryKey: ['zoning-versions', siteId],
    queryFn: () => zoningApi.listVersions(siteId!),
    enabled: !!siteId,
  });

  // Field interventions
  const { data: fiData } = useQuery<{ total: number; items: FieldIntervention[] }>({
    queryKey: ['field-interventions', siteId],
    queryFn: () => fieldInterventionsApi.list({ siteId: siteId!, limit: 50 }),
    enabled: !!siteId,
  });

  // Site documents
  const { data: siteDocuments = [] } = useQuery<SiteDocument[]>({
    queryKey: ['site-documents', siteId],
    queryFn: () => fieldInterventionsApi.listSiteDocuments(siteId!),
    enabled: !!siteId,
  });

  // Analytics
  const activeVersion = zoningVersions.find((v) => v.statut === 'ACTIVE');
  const { data: analytics } = useQuery<SiteAnalytics>({
    queryKey: ['site-analytics', siteId, activeVersion?.id],
    queryFn: () => fieldInterventionsApi.getAnalytics(siteId!, { zoningVersionId: activeVersion?.id }),
    enabled: !!siteId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="p-6">
        <p className="text-red-600">Site introuvable.</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{site.nom}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              {site.ville && <><MapPin className="h-3 w-3" /><span>{site.ville}</span></>}
              {site.tel && <><Phone className="h-3 w-3 ml-2" /><span>{site.tel}</span></>}
              {site.email && <><Mail className="h-3 w-3 ml-2" /><span>{site.email}</span></>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="info" className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" /> Informations
          </TabsTrigger>
          <TabsTrigger value="zoning" className="flex items-center gap-1.5">
            <Map className="h-4 w-4" /> Zoning
            {zoningVersions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-xs">{zoningVersions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="interventions" className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" /> Interventions terrain
            {fiData?.total != null && (
              <Badge variant="secondary" className="ml-1 h-4 text-xs">{fiData.total}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tendances" className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" /> Tendances
          </TabsTrigger>
          <TabsTrigger value="rapports" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Rapports
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1.5">
            <FolderOpen className="h-4 w-4" /> Documents
            {siteDocuments.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-xs">{siteDocuments.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Info ─────────────────────────────────────────────── */}
        <TabsContent value="info" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Adresse</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {site.adresse && <p>{site.adresse}</p>}
              {site.complement && <p>{site.complement}</p>}
              <p>{[site.codePostal, site.ville].filter(Boolean).join(' ')}</p>
              {site.pays && <p className="text-gray-500">{site.pays}</p>}
            </CardContent>
          </Card>
          {(site.horairesOuverture || site.accessibilite) && (
            <Card>
              <CardHeader><CardTitle>Informations pratiques</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {site.horairesOuverture && <p><span className="font-medium">Horaires : </span>{site.horairesOuverture}</p>}
                {site.accessibilite && <p><span className="font-medium">Accès : </span>{site.accessibilite}</p>}
              </CardContent>
            </Card>
          )}
          {site.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-gray-700 whitespace-pre-wrap">{site.notes}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Zoning ───────────────────────────────────────────── */}
        <TabsContent value="zoning" className="mt-4">
          <ZoningTab siteId={siteId!} versions={zoningVersions} />
        </TabsContent>

        {/* ── Interventions terrain ─────────────────────────────── */}
        <TabsContent value="interventions" className="mt-4">
          <FieldInterventionsTab siteId={siteId!} versions={zoningVersions} items={fiData?.items ?? []} total={fiData?.total ?? 0} />
        </TabsContent>

        {/* ── Tendances ─────────────────────────────────────────── */}
        <TabsContent value="tendances" className="mt-4">
          <TendancesTab analytics={analytics} />
        </TabsContent>

        {/* ── Rapports ──────────────────────────────────────────── */}
        <TabsContent value="rapports" className="mt-4">
          <RapportsTab items={fiData?.items ?? []} />
        </TabsContent>

        {/* ── Documents ─────────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab siteId={siteId!} documents={siteDocuments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Zoning Tab ──────────────────────────────────────────────────────────────

function ZoningTab({ siteId, versions }: { siteId: string; versions: ZoningVersion[] }) {
  const qc = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    versions.find((v) => v.statut === 'ACTIVE')?.id ?? versions[0]?.id ?? null
  );

  const { data: version } = useQuery<ZoningVersion>({
    queryKey: ['zoning-version', selectedVersionId],
    queryFn: () => zoningApi.getVersion(selectedVersionId!),
    enabled: !!selectedVersionId,
  });

  const createMut = useMutation({
    mutationFn: (payload: { nom: string; notes?: string }) => zoningApi.createVersion(siteId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zoning-versions', siteId] });
      setShowCreateDialog(false);
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => zoningApi.updateVersion(id, { statut: 'ACTIVE', dateActivation: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zoning-versions', siteId] });
      qc.invalidateQueries({ queryKey: ['zoning-version', selectedVersionId] });
    },
  });

  const [createForm, setCreateForm] = useState({ nom: '', notes: '' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Versions de zoning</h2>
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nouvelle version
        </Button>
      </div>

      {versions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Map className="h-10 w-10 mb-3" />
            <p className="font-medium">Aucun zoning créé</p>
            <p className="text-sm mt-1">Créez la première version du plan de zonage de ce site.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {/* Version list */}
          <div className="col-span-3 space-y-2">
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-colors',
                  selectedVersionId === v.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">v{v.version}</span>
                  <Badge className={cn('text-xs', ZONING_STATUT_CONFIG[v.statut].color)}>
                    {ZONING_STATUT_CONFIG[v.statut].label}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 truncate">{v.nom}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(v.createdAt)}</p>
              </button>
            ))}
          </div>

          {/* Version detail */}
          <div className="col-span-9">
            {version ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {version.nom}
                        <Badge className={cn('text-xs', ZONING_STATUT_CONFIG[version.statut].color)}>
                          {ZONING_STATUT_CONFIG[version.statut].label}
                        </Badge>
                      </CardTitle>
                      {version.notes && <p className="text-sm text-gray-500 mt-1">{version.notes}</p>}
                    </div>
                    {version.statut === 'DRAFT' && (
                      <Button size="sm" onClick={() => activateMut.mutate(version.id)} disabled={activateMut.isPending}>
                        Activer
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {(!version.zones || version.zones.length === 0) ? (
                    <p className="text-sm text-gray-400 text-center py-8">Aucune zone définie</p>
                  ) : (
                    <div className="space-y-4">
                      {version.zones.map((zone) => (
                        <ZoneCard key={zone.id} zone={zone} versionId={version.id} />
                      ))}
                    </div>
                  )}
                  <AddZoneButton versionId={version.id} siteId={siteId} />
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400">
                Sélectionnez une version
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle version de zoning</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input
                placeholder="Ex: Zoning initial, Après rénovation..."
                value={createForm.nom}
                onChange={(e) => setCreateForm((f) => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                placeholder="Description de cette version..."
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annuler</Button>
            <Button
              onClick={() => createMut.mutate(createForm)}
              disabled={!createForm.nom || createMut.isPending}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ZoneCard({ zone, versionId }: { zone: Zone; versionId: string }) {
  const qc = useQueryClient();
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    type: 'BAIT_STATION' as DeviceType,
    displayNumber: '',
    nom: '',
    notes: '',
  });

  const createDeviceMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => zoningApi.createDevice(zone.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zoning-version', versionId] });
      setShowAddDevice(false);
      setDeviceForm({ type: 'BAIT_STATION', displayNumber: '', nom: '', notes: '' });
    },
  });

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium">{zone.nom}</h3>
          {zone.etage && <p className="text-xs text-gray-500">{zone.etage}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAddDevice(true)}>
          <Plus className="h-3 w-3 mr-1" /> Dispositif
        </Button>
      </div>

      {zone.devices && zone.devices.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {zone.devices.map((device) => (
            <DeviceBadge key={device.id} device={device} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Aucun dispositif</p>
      )}

      <Dialog open={showAddDevice} onOpenChange={setShowAddDevice}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un dispositif — {zone.nom}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Type *</Label>
              <Select value={deviceForm.type} onValueChange={(v) => setDeviceForm((f) => ({ ...f, type: v as DeviceType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DEVICE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Numéro *</Label>
              <Input
                placeholder="01, 02, A1..."
                value={deviceForm.displayNumber}
                onChange={(e) => setDeviceForm((f) => ({ ...f, displayNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Nom libre</Label>
              <Input
                placeholder="Optionnel"
                value={deviceForm.nom}
                onChange={(e) => setDeviceForm((f) => ({ ...f, nom: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDevice(false)}>Annuler</Button>
            <Button
              onClick={() => createDeviceMut.mutate(deviceForm)}
              disabled={!deviceForm.displayNumber || createDeviceMut.isPending}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeviceBadge({ device }: { device: MonitoringDevice }) {
  const statut = device.statut === 'ACTIVE' ? '' : device.statut === 'REMOVED' ? ' (retiré)' : ' (inactif)';
  return (
    <div className={cn('flex items-center gap-2 p-2 rounded border text-xs', DEVICE_TYPE_COLORS[device.type])}>
      <Bug className="h-3 w-3 shrink-0" />
      <span className="font-medium">#{device.displayNumber}</span>
      <span className="truncate">{DEVICE_TYPE_LABELS[device.type]}{statut}</span>
    </div>
  );
}

function AddZoneButton({ versionId, siteId }: { versionId: string; siteId: string }) {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ nom: '', etage: '', description: '' });

  const mut = useMutation({
    mutationFn: () => zoningApi.createZone(versionId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zoning-version', versionId] });
      setShowDialog(false);
      setForm({ nom: '', etage: '', description: '' });
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setShowDialog(true)}>
        <Plus className="h-3 w-3 mr-1" /> Ajouter une zone
      </Button>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle zone</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input placeholder="Ex: Administration RDC, Production..." value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Étage / Niveau</Label>
              <Input placeholder="RDC, 1er étage, Mezzanine..." value={form.etage} onChange={(e) => setForm((f) => ({ ...f, etage: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea placeholder="Optionnel..." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={() => mut.mutate()} disabled={!form.nom || mut.isPending}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Field Interventions Tab ──────────────────────────────────────────────────

function FieldInterventionsTab({
  siteId,
  versions,
  items,
  total,
}: {
  siteId: string;
  versions: ZoningVersion[];
  items: FieldIntervention[];
  total: number;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterStatut, setFilterStatut] = useState<string>('');
  const [createForm, setCreateForm] = useState({
    zoningVersionId: versions.find((v) => v.statut === 'ACTIVE')?.id ?? '',
    type: 'OPERATION',
    dateIntervention: new Date().toISOString().slice(0, 10),
    commentaire: '',
  });

  const createMut = useMutation({
    mutationFn: () =>
      fieldInterventionsApi.create({ ...createForm, siteId, clientId: '' }), // clientId rempli côté serveur
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-interventions', siteId] });
      setShowCreateDialog(false);
    },
  });

  const filtered = filterStatut ? items.filter((fi) => fi.statut === filterStatut) : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Interventions terrain</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Tous statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous statuts</SelectItem>
              {Object.entries(FI_STATUT_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowCreateDialog(true)} disabled={versions.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Nouvelle intervention
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
            <ClipboardList className="h-10 w-10 mb-3" />
            <p className="font-medium">Aucune intervention terrain</p>
            {versions.length === 0 && (
              <p className="text-sm mt-1">Créez d'abord un zoning pour ce site.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((fi) => {
            const cfg = FI_STATUT_CONFIG[fi.statut];
            const Icon = cfg.icon;
            return (
              <Card key={fi.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate(`/field-interventions/${fi.id}`)}>
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <Icon className={cn('h-5 w-5', cfg.color.split(' ')[1])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{formatDate(fi.dateIntervention)}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {fi.type === 'OPERATION' ? 'Opération' : 'Visite contrôle'}
                      </Badge>
                      <Badge className={cn('text-xs', cfg.color)}>{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {fi.applicateurs && fi.applicateurs.length > 0 && (
                        <span>{fi.applicateurs.map((a) => `${a.employe?.prenom} ${a.employe?.nom}`).join(', ')}</span>
                      )}
                      {fi._count && <span>{fi._count.controls} dispositifs</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle intervention terrain</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Type *</Label>
              <Select value={createForm.type} onValueChange={(v) => setCreateForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERATION">Opération</SelectItem>
                  <SelectItem value="VISITE">Visite de contrôle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input
                type="date"
                value={createForm.dateIntervention}
                onChange={(e) => setCreateForm((f) => ({ ...f, dateIntervention: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Version de zoning *</Label>
              <Select value={createForm.zoningVersionId} onValueChange={(v) => setCreateForm((f) => ({ ...f, zoningVersionId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une version" /></SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>v{v.version} — {v.nom} ({ZONING_STATUT_CONFIG[v.statut].label})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Commentaire</Label>
              <Textarea
                value={createForm.commentaire}
                onChange={(e) => setCreateForm((f) => ({ ...f, commentaire: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annuler</Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!createForm.zoningVersionId || !createForm.dateIntervention || createMut.isPending}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tendances Tab ────────────────────────────────────────────────────────────

function TendancesTab({ analytics }: { analytics?: SiteAnalytics }) {
  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
          <TrendingUp className="h-10 w-10 mb-3" />
          <p className="font-medium">Aucune donnée disponible</p>
          <p className="text-sm mt-1">Les tendances apparaissent après les premières interventions validées.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{analytics.totalInterventions}</div>
            <p className="text-sm text-gray-500 mt-1">Interventions totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {Object.values(analytics.deviceStats).reduce((s, d) => s + d.insectTotal, 0)}
            </div>
            <p className="text-sm text-gray-500 mt-1">Insectes capturés (total)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{Object.keys(analytics.deviceStats).length}</div>
            <p className="text-sm text-gray-500 mt-1">Dispositifs contrôlés</p>
          </CardContent>
        </Card>
      </div>

      {analytics.insectTrend.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Tendance captures / mois (IK)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.insectTrend.map(({ month, count }) => {
                const max = Math.max(...analytics.insectTrend.map((t) => t.count), 1);
                return (
                  <div key={month} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-gray-500 text-xs">{month}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-gray-700">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Rapports Tab ─────────────────────────────────────────────────────────────

function RapportsTab({ items }: { items: FieldIntervention[] }) {
  const withReports = items.filter((fi) => fi._count && fi._count.reports > 0);

  if (withReports.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
          <FileText className="h-10 w-10 mb-3" />
          <p className="font-medium">Aucun rapport généré</p>
          <p className="text-sm mt-1">Les rapports sont générés depuis les interventions terrain validées.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {withReports.map((fi) => (
        <Card key={fi.id}>
          <CardContent className="flex items-center gap-4 py-3 px-4">
            <FileText className="h-5 w-5 text-blue-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">{formatDate(fi.dateIntervention)} — {fi.type === 'OPERATION' ? 'Opération' : 'Visite'}</p>
              <p className="text-xs text-gray-500">{fi._count?.reports} rapport(s)</p>
            </div>
            <Link to={`/field-interventions/${fi.id}`}>
              <Button variant="ghost" size="sm">Voir <ChevronRight className="h-3 w-3 ml-1" /></Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab({ siteId, documents }: { siteId: string; documents: SiteDocument[] }) {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ titre: '', type: 'rapport', filename: '', path: '', commentaire: '', annee: '' });

  const createMut = useMutation({
    mutationFn: () => fieldInterventionsApi.createSiteDocument(siteId, {
      ...form,
      annee: form.annee ? parseInt(form.annee) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-documents', siteId] });
      setShowDialog(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fieldInterventionsApi.deleteSiteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['site-documents', siteId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Documents archivés</h2>
        <Button size="sm" onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter un document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FolderOpen className="h-10 w-10 mb-3" />
            <p className="font-medium">Aucun document archivé</p>
            <p className="text-sm mt-1">Importez d'anciens rapports PDF, fichiers Excel, etc.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <FileText className="h-5 w-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.titre}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Badge variant="outline" className="text-xs">{doc.type}</Badge>
                    {doc.annee && <span>{doc.annee}</span>}
                    {doc.date && <span>{formatDate(doc.date)}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:text-red-600"
                  onClick={() => deleteMut.mutate(doc.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un document archivé</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Titre *</Label>
              <Input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} placeholder="Rapport annuel 2024..." />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['rapport', 'controles', 'tendance', 'zoning', 'autre'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Année</Label>
                <Input type="number" placeholder="2024" value={form.annee} onChange={(e) => setForm((f) => ({ ...f, annee: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Nom du fichier *</Label>
                <Input placeholder="rapport.pdf" value={form.filename} onChange={(e) => setForm((f) => ({ ...f, filename: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Chemin/URL *</Label>
              <Input placeholder="/uploads/..." value={form.path} onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Commentaire</Label>
              <Textarea value={form.commentaire} onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.titre || !form.filename || !form.path || createMut.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
