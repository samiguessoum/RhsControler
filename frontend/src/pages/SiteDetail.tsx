import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  Activity,
  User,
  Download,
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
import api, { zoningApi, fieldInterventionsApi, fieldReportsApi } from '@/services/api';
import { formatDate, cn } from '@/lib/utils';
import type {
  Site,
  ZoningVersion,
  Zone,
  MonitoringDevice,
  FieldIntervention,
  FieldInterventionStatut,
  DeviceType,
  DeviceStatut,
  SiteDocument,
  SiteAnalytics,
  SiteContact,
  FieldReport,
} from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  BAIT_STATION: "Poste d'appâtage",
  MECHANICAL_TRAP: 'Piège mécanique',
  GLUE_TRAP: 'Boîte à colle',
  FLYING_INSECT_KILLER: 'Destructeur insectes (FK)',
};

const DEVICE_TYPE_COLORS: Record<DeviceType, string> = {
  BAIT_STATION: 'bg-orange-100 text-orange-800',
  MECHANICAL_TRAP: 'bg-red-100 text-red-800',
  GLUE_TRAP: 'bg-yellow-100 text-yellow-800',
  FLYING_INSECT_KILLER: 'bg-blue-100 text-blue-800',
};

const DEVICE_STATUT_COLORS: Record<DeviceStatut, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  REMOVED: 'bg-red-100 text-red-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
};

const FI_STATUT_CONFIG: Record<
  FieldInterventionStatut,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
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

const VALID_TABS = ['info', 'zoning', 'interventions', 'tendances', 'rapports', 'documents'];

export function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = VALID_TABS.includes(searchParams.get('tab') || '') ? searchParams.get('tab')! : 'info';

  // Site data — uses GET /sites/:id → { site: { ...siteData } }
  const {
    data: site,
    isLoading,
    isError,
  } = useQuery<Site>({
    queryKey: ['site', siteId],
    queryFn: async () => {
      const { data } = await api.get(`/sites/${siteId}`);
      return data.site as Site;
    },
    enabled: !!siteId,
  });

  // Zoning versions
  const { data: zoningVersionsRaw } = useQuery({
    queryKey: ['zoning-versions', siteId],
    queryFn: () => zoningApi.listVersions(siteId!),
    enabled: !!siteId,
  });
  const zoningVersions: ZoningVersion[] = Array.isArray(zoningVersionsRaw)
    ? zoningVersionsRaw
    : ((zoningVersionsRaw as { versions?: ZoningVersion[] })?.versions ?? []);

  // Field interventions
  const { data: fiRaw } = useQuery({
    queryKey: ['field-interventions', siteId],
    queryFn: () => fieldInterventionsApi.list({ siteId: siteId!, limit: 50 }),
    enabled: !!siteId,
  });
  const fiItems: FieldIntervention[] = (fiRaw as { items?: FieldIntervention[] })?.items ?? [];
  const fiTotal: number = (fiRaw as { total?: number })?.total ?? fiItems.length;

  // Site documents
  const { data: siteDocsRaw } = useQuery({
    queryKey: ['site-documents', siteId],
    queryFn: () => fieldInterventionsApi.listSiteDocuments(siteId!),
    enabled: !!siteId,
  });
  const siteDocuments: SiteDocument[] = Array.isArray(siteDocsRaw)
    ? siteDocsRaw
    : ((siteDocsRaw as { documents?: SiteDocument[] })?.documents ?? []);

  // Analytics (uses active version if available)
  const activeVersion = zoningVersions.find((v) => v.statut === 'ACTIVE');
  const { data: analyticsRaw } = useQuery({
    queryKey: ['site-analytics', siteId, activeVersion?.id],
    queryFn: () =>
      fieldInterventionsApi.getAnalytics(siteId!, { zoningVersionId: activeVersion?.id }),
    enabled: !!siteId,
  });
  const analytics = analyticsRaw as SiteAnalytics | undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isError || !site) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-red-600 font-medium">Site introuvable.</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
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
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
              {site.ville && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {site.ville}
                </span>
              )}
              {site.tel && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {site.tel}
                </span>
              )}
              {site.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {site.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={initialTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="info" className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" /> Informations
          </TabsTrigger>
          <TabsTrigger value="zoning" className="flex items-center gap-1.5">
            <Map className="h-4 w-4" /> Zoning
            {zoningVersions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-xs">
                {zoningVersions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="interventions" className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" /> Interventions terrain
            {fiTotal > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-xs">
                {fiTotal}
              </Badge>
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
              <Badge variant="secondary" className="ml-1 h-4 text-xs">
                {siteDocuments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1 : Informations ─────────────────────────────── */}
        <TabsContent value="info" className="mt-4 space-y-4">
          <InfoTab site={site} />
        </TabsContent>

        {/* ── Tab 2 : Zoning ──────────────────────────────────── */}
        <TabsContent value="zoning" className="mt-4">
          <ZoningTab siteId={siteId!} versions={zoningVersions} />
        </TabsContent>

        {/* ── Tab 3 : Interventions terrain ────────────────────── */}
        <TabsContent value="interventions" className="mt-4">
          <FieldInterventionsTab
            siteId={siteId!}
            clientId={site.clientId}
            versions={zoningVersions}
            items={fiItems}
            total={fiTotal}
          />
        </TabsContent>

        {/* ── Tab 4 : Tendances ─────────────────────────────────── */}
        <TabsContent value="tendances" className="mt-4">
          <TendancesTab analytics={analytics} />
        </TabsContent>

        {/* ── Tab 5 : Rapports ──────────────────────────────────── */}
        <TabsContent value="rapports" className="mt-4">
          <RapportsTab siteId={siteId!} />
        </TabsContent>

        {/* ── Tab 6 : Documents ─────────────────────────────────── */}
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab siteId={siteId!} documents={siteDocuments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1 : Informations ─────────────────────────────────────────────────────

function InfoTab({ site }: { site: Site }) {
  const contacts = site.contacts ?? [];

  return (
    <div className="space-y-4">
      {/* Client link */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">Client :</span>
            <Link
              to={`/tiers/${site.clientId}`}
              className="text-blue-600 hover:underline font-medium"
            >
              Voir la fiche client
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Adresse */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adresse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {site.adresse && <p>{site.adresse}</p>}
          {site.complement && <p className="text-gray-500">{site.complement}</p>}
          {(site.codePostal || site.ville) && (
            <p>{[site.codePostal, site.ville].filter(Boolean).join(' ')}</p>
          )}
          {site.pays && <p className="text-gray-500">{site.pays}</p>}
          {!site.adresse && !site.ville && (
            <p className="text-gray-400 italic">Adresse non renseignée</p>
          )}
        </CardContent>
      </Card>

      {/* Coordonnées */}
      {(site.tel || site.fax || site.email) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {site.tel && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{site.tel}</span>
              </div>
            )}
            {site.fax && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Fax : {site.fax}</span>
              </div>
            )}
            {site.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <a href={`mailto:${site.email}`} className="text-blue-600 hover:underline">
                  {site.email}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informations pratiques */}
      {(site.horairesOuverture || site.accessibilite) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations pratiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {site.horairesOuverture && (
              <p>
                <span className="font-medium">Horaires : </span>
                {site.horairesOuverture}
              </p>
            )}
            {site.accessibilite && (
              <p>
                <span className="font-medium">Accès : </span>
                {site.accessibilite}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {site.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{site.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Contacts */}
      {contacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts du site</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contacts.map((c: SiteContact) => (
              <div key={c.id} className="flex items-start gap-3 pb-3 border-b last:border-b-0 last:pb-0">
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-gray-500" />
                </div>
                <div className="text-sm">
                  <p className="font-medium">
                    {[c.civilite, c.prenom, c.nom].filter(Boolean).join(' ')}
                    {c.estPrincipal && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Principal
                      </Badge>
                    )}
                  </p>
                  {c.fonction && <p className="text-gray-500">{c.fonction}</p>}
                  <div className="flex flex-wrap gap-3 mt-1 text-gray-500">
                    {c.tel && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.tel}</span>}
                    {c.telMobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telMobile}</span>}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                        <Mail className="h-3 w-3" />{c.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab 2 : Zoning ──────────────────────────────────────────────────────────

function ZoningTab({ siteId, versions }: { siteId: string; versions: ZoningVersion[] }) {
  const qc = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ nom: '', notes: '' });
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    versions.find((v) => v.statut === 'ACTIVE')?.id ?? versions[0]?.id ?? null
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: versionRaw } = useQuery({
    queryKey: ['zoning-version', selectedVersionId],
    queryFn: () => zoningApi.getVersion(selectedVersionId!),
    enabled: !!selectedVersionId,
  });
  const version = versionRaw as ZoningVersion | undefined;

  const createMut = useMutation({
    mutationFn: (payload: { nom: string; notes?: string }) =>
      zoningApi.createVersion(siteId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zoning-versions', siteId] });
      setShowCreateDialog(false);
      setCreateForm({ nom: '', notes: '' });
      toast.success('Version de zoning créée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la création de la version'),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) =>
      zoningApi.updateVersion(id, { statut: 'ACTIVE', dateActivation: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zoning-versions', siteId] });
      qc.invalidateQueries({ queryKey: ['zoning-version', selectedVersionId] });
      toast.success('Version activée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de l\'activation'),
  });

  const duplicateMut = useMutation({
    mutationFn: (v: ZoningVersion) =>
      zoningApi.createVersion(siteId, { nom: `${v.nom} (copie)`, notes: v.notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zoning-versions', siteId] });
      toast.success('Version dupliquée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la duplication'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => zoningApi.deleteVersion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zoning-versions', siteId] });
      if (selectedVersionId === deleteConfirmId) setSelectedVersionId(null);
      setDeleteConfirmId(null);
      toast.success('Version supprimée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la suppression'),
  });

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
          {/* Sidebar — version list */}
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        {version.nom}
                        <Badge className={cn('text-xs', ZONING_STATUT_CONFIG[version.statut].color)}>
                          {ZONING_STATUT_CONFIG[version.statut].label}
                        </Badge>
                      </CardTitle>
                      {version.notes && (
                        <p className="text-sm text-gray-500 mt-1">{version.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {version.statut === 'DRAFT' && (
                        <Button
                          size="sm"
                          onClick={() => activateMut.mutate(version.id)}
                          disabled={activateMut.isPending}
                        >
                          Activer
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => duplicateMut.mutate(version)}
                        disabled={duplicateMut.isPending}
                      >
                        Dupliquer
                      </Button>
                      {version.statut === 'DRAFT' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:text-red-700 hover:border-red-300"
                          onClick={() => setDeleteConfirmId(version.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!version.zones || version.zones.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Aucune zone définie</p>
                  ) : (
                    <div className="space-y-4">
                      {version.zones.map((zone) => (
                        <ZoneCard key={zone.id} zone={zone} versionId={version.id} />
                      ))}
                    </div>
                  )}
                  <AddZoneButton versionId={version.id} />
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
          <DialogHeader>
            <DialogTitle>Nouvelle version de zoning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input
                placeholder="Ex: Zoning initial, Après rénovation…"
                value={createForm.nom}
                onChange={(e) => setCreateForm((f) => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                placeholder="Description de cette version…"
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createMut.mutate(createForm)}
              disabled={!createForm.nom || createMut.isPending}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette version ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les zones et dispositifs associés seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirmId && deleteMut.mutate(deleteConfirmId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Zone card ────────────────────────────────────────────────────────────────

function ZoneCard({ zone, versionId }: { zone: Zone; versionId: string }) {
  const qc = useQueryClient();
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [editDevice, setEditDevice] = useState<MonitoringDevice | null>(null);
  const [deleteDeviceId, setDeleteDeviceId] = useState<string | null>(null);
  const [showEditZone, setShowEditZone] = useState(false);
  const [zoneForm, setZoneForm] = useState({ nom: zone.nom, etage: zone.etage ?? '', description: zone.description ?? '' });

  const [deviceForm, setDeviceForm] = useState({
    type: 'BAIT_STATION' as DeviceType,
    displayNumber: '',
    nom: '',
    notes: '',
    statut: 'ACTIVE' as DeviceStatut,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['zoning-version', versionId] });

  const createDeviceMut = useMutation({
    mutationFn: () => zoningApi.createDevice(zone.id, { ...deviceForm }),
    onSuccess: () => {
      invalidate();
      setShowAddDevice(false);
      setDeviceForm({ type: 'BAIT_STATION', displayNumber: '', nom: '', notes: '', statut: 'ACTIVE' });
      toast.success('Dispositif ajouté');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de l\'ajout du dispositif'),
  });

  const updateDeviceMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => zoningApi.updateDevice(editDevice!.id, payload),
    onSuccess: () => {
      invalidate();
      setEditDevice(null);
      toast.success('Dispositif mis à jour');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la mise à jour du dispositif'),
  });

  const deleteDeviceMut = useMutation({
    mutationFn: (id: string) => zoningApi.deleteDevice(id),
    onSuccess: () => {
      invalidate();
      setDeleteDeviceId(null);
      toast.success('Dispositif supprimé');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la suppression du dispositif'),
  });

  const updateZoneMut = useMutation({
    mutationFn: () => zoningApi.updateZone(zone.id, zoneForm),
    onSuccess: () => {
      invalidate();
      setShowEditZone(false);
      toast.success('Zone mise à jour');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la mise à jour de la zone'),
  });

  const deleteZoneMut = useMutation({
    mutationFn: () => zoningApi.deleteZone(zone.id),
    onSuccess: () => {
      invalidate();
      toast.success('Zone supprimée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la suppression de la zone'),
  });

  const devices = zone.devices ?? [];
  const canDeleteZone = devices.length === 0;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium">{zone.nom}</h3>
          {zone.etage && <p className="text-xs text-gray-500">{zone.etage}</p>}
          {zone.description && <p className="text-xs text-gray-400">{zone.description}</p>}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setZoneForm({ nom: zone.nom, etage: zone.etage ?? '', description: zone.description ?? '' });
              setShowEditZone(true);
            }}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          {canDeleteZone && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-400 hover:text-red-600"
              onClick={() => deleteZoneMut.mutate()}
              disabled={deleteZoneMut.isPending}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAddDevice(true)}>
            <Plus className="h-3 w-3 mr-1" /> Dispositif
          </Button>
        </div>
      </div>

      {devices.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {devices.map((device) => (
            <button
              key={device.id}
              onClick={() => {
                setDeviceForm({
                  type: device.type,
                  displayNumber: device.displayNumber,
                  nom: device.nom ?? '',
                  notes: device.notes ?? '',
                  statut: device.statut,
                });
                setEditDevice(device);
              }}
              className={cn(
                'flex items-center gap-2 p-2 rounded border text-xs text-left hover:opacity-80 transition-opacity',
                DEVICE_TYPE_COLORS[device.type]
              )}
            >
              <Bug className="h-3 w-3 shrink-0" />
              <span className="font-medium">#{device.displayNumber}</span>
              <span className="truncate flex-1">{DEVICE_TYPE_LABELS[device.type]}</span>
              <span
                className={cn('px-1 rounded text-xs', DEVICE_STATUT_COLORS[device.statut])}
              >
                {device.statut === 'ACTIVE' ? '●' : device.statut === 'REMOVED' ? '✕' : '○'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Aucun dispositif</p>
      )}

      {/* Add device dialog */}
      <Dialog open={showAddDevice} onOpenChange={setShowAddDevice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un dispositif — {zone.nom}</DialogTitle>
          </DialogHeader>
          <DeviceFormFields form={deviceForm} onChange={setDeviceForm} showStatut={false} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDevice(false)}>Annuler</Button>
            <Button
              onClick={() => createDeviceMut.mutate()}
              disabled={!deviceForm.displayNumber || createDeviceMut.isPending}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit device dialog */}
      <Dialog open={!!editDevice} onOpenChange={(o) => { if (!o) setEditDevice(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le dispositif #{editDevice?.displayNumber}</DialogTitle>
          </DialogHeader>
          <DeviceFormFields form={deviceForm} onChange={setDeviceForm} showStatut />
          <DialogFooter>
            <Button
              variant="outline"
              className="text-red-500 hover:text-red-700 mr-auto"
              onClick={() => { setDeleteDeviceId(editDevice!.id); setEditDevice(null); }}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Supprimer
            </Button>
            <Button variant="outline" onClick={() => setEditDevice(null)}>Annuler</Button>
            <Button
              onClick={() => updateDeviceMut.mutate(deviceForm)}
              disabled={!deviceForm.displayNumber || updateDeviceMut.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete device confirm */}
      <AlertDialog open={!!deleteDeviceId} onOpenChange={(o) => { if (!o) setDeleteDeviceId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce dispositif ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteDeviceId && deleteDeviceMut.mutate(deleteDeviceId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit zone dialog */}
      <Dialog open={showEditZone} onOpenChange={setShowEditZone}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier la zone</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input value={zoneForm.nom} onChange={(e) => setZoneForm((f) => ({ ...f, nom: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Étage / Niveau</Label>
              <Input placeholder="RDC, 1er étage…" value={zoneForm.etage} onChange={(e) => setZoneForm((f) => ({ ...f, etage: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea placeholder="Optionnel…" value={zoneForm.description} onChange={(e) => setZoneForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditZone(false)}>Annuler</Button>
            <Button onClick={() => updateZoneMut.mutate()} disabled={!zoneForm.nom || updateZoneMut.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Device form fields (shared between add/edit) ─────────────────────────────

type DeviceFormState = {
  type: DeviceType;
  displayNumber: string;
  nom: string;
  notes: string;
  statut: DeviceStatut;
};

function DeviceFormFields({
  form,
  onChange,
  showStatut,
}: {
  form: DeviceFormState;
  onChange: (f: DeviceFormState) => void;
  showStatut: boolean;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <Label>Type *</Label>
        <Select
          value={form.type}
          onValueChange={(v) => onChange({ ...form, type: v as DeviceType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(DEVICE_TYPE_LABELS) as [DeviceType, string][]).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Numéro *</Label>
        <Input
          placeholder="01, 02, A1…"
          value={form.displayNumber}
          onChange={(e) => onChange({ ...form, displayNumber: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>Nom libre</Label>
        <Input
          placeholder="Optionnel"
          value={form.nom}
          onChange={(e) => onChange({ ...form, nom: e.target.value })}
        />
      </div>
      {showStatut && (
        <div className="space-y-1">
          <Label>Statut</Label>
          <Select
            value={form.statut}
            onValueChange={(v) => onChange({ ...form, statut: v as DeviceStatut })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Actif</SelectItem>
              <SelectItem value="INACTIVE">Inactif</SelectItem>
              <SelectItem value="REMOVED">Retiré</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label>Notes</Label>
        <Textarea
          placeholder="Optionnel"
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}

// ─── Add zone button ──────────────────────────────────────────────────────────

function AddZoneButton({ versionId }: { versionId: string }) {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ nom: '', etage: '', description: '' });

  const mut = useMutation({
    mutationFn: () => zoningApi.createZone(versionId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zoning-version', versionId] });
      setShowDialog(false);
      setForm({ nom: '', etage: '', description: '' });
      toast.success('Zone créée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la création de la zone'),
  });

  return (
    <>
      <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setShowDialog(true)}>
        <Plus className="h-3 w-3 mr-1" /> Ajouter une zone
      </Button>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle zone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input
                placeholder="Ex: Administration RDC, Production…"
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Étage / Niveau</Label>
              <Input
                placeholder="RDC, 1er étage, Mezzanine…"
                value={form.etage}
                onChange={(e) => setForm((f) => ({ ...f, etage: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                placeholder="Optionnel…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button onClick={() => mut.mutate()} disabled={!form.nom || mut.isPending}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Tab 3 : Field Interventions ──────────────────────────────────────────────

function FieldInterventionsTab({
  siteId,
  clientId,
  versions,
  items,
  total,
}: {
  siteId: string;
  clientId: string;
  versions: ZoningVersion[];
  items: FieldIntervention[];
  total: number;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterStatut, setFilterStatut] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [createForm, setCreateForm] = useState({
    zoningVersionId: versions.find((v) => v.statut === 'ACTIVE')?.id ?? versions[0]?.id ?? '',
    type: 'OPERATION',
    dateIntervention: new Date().toISOString().slice(0, 10),
    commentaire: '',
  });

  const createMut = useMutation({
    mutationFn: () =>
      fieldInterventionsApi.create({
        ...createForm,
        siteId,
        clientId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-interventions', siteId] });
      setShowCreateDialog(false);
      toast.success('Intervention créée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la création de l\'intervention'),
  });

  let filtered = items;
  if (filterStatut !== 'ALL') filtered = filtered.filter((fi) => fi.statut === filterStatut);
  if (filterType !== 'ALL') filtered = filtered.filter((fi) => fi.type === filterType);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Interventions terrain</h2>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Tous types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous types</SelectItem>
              <SelectItem value="OPERATION">Opération</SelectItem>
              <SelectItem value="VISITE">Visite</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Tous statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous statuts</SelectItem>
              {(Object.entries(FI_STATUT_CONFIG) as [FieldInterventionStatut, { label: string }][]).map(
                ([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            disabled={versions.length === 0}
          >
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
              <Card
                key={fi.id}
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => navigate(`/field-interventions/${fi.id}`)}
              >
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <Icon className={cn('h-5 w-5 shrink-0', cfg.color.split(' ')[1])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {formatDate(fi.dateIntervention)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {fi.type === 'OPERATION' ? 'Opération' : 'Visite contrôle'}
                      </Badge>
                      <Badge className={cn('text-xs', cfg.color)}>{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {fi.applicateurs && fi.applicateurs.length > 0 && (
                        <span>
                          {fi.applicateurs
                            .map((a) => `${a.employe?.prenom ?? ''} ${a.employe?.nom ?? ''}`.trim())
                            .join(', ')}
                        </span>
                      )}
                      {fi._count && <span>{fi._count.controls} dispositif(s)</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle intervention terrain</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Type *</Label>
              <Select
                value={createForm.type}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <Select
                value={createForm.zoningVersionId}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, zoningVersionId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      v{v.version} — {v.nom} ({ZONING_STATUT_CONFIG[v.statut].label})
                    </SelectItem>
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
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={
                !createForm.zoningVersionId ||
                !createForm.dateIntervention ||
                createMut.isPending
              }
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 4 : Tendances ────────────────────────────────────────────────────────

function TendancesTab({ analytics }: { analytics?: SiteAnalytics }) {
  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
          <TrendingUp className="h-10 w-10 mb-3" />
          <p className="font-medium">Aucune donnée disponible</p>
          <p className="text-sm mt-1">
            Les tendances apparaissent après les premières interventions validées.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalInsects = Object.values(analytics.deviceStats).reduce(
    (s, d) => s + d.insectTotal,
    0
  );
  const maxInsectMonth = Math.max(...analytics.insectTrend.map((t) => t.count), 1);

  // Top 5 devices by insect count
  const topDevices = Object.entries(analytics.deviceStats)
    .sort(([, a], [, b]) => b.insectTotal - a.insectTotal)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{analytics.totalInterventions}</div>
            <p className="text-sm text-gray-500 mt-1">Interventions totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{totalInsects}</div>
            <p className="text-sm text-gray-500 mt-1">Insectes capturés (total)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {Object.keys(analytics.deviceStats).length}
            </div>
            <p className="text-sm text-gray-500 mt-1">Dispositifs contrôlés</p>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart — insect trend */}
      {analytics.insectTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Captures / mois (IK)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.insectTrend.map(({ month, count }) => (
                <div key={month} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-gray-500 text-xs shrink-0">{month}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${(count / maxInsectMonth) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-gray-700 text-xs">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top devices */}
      {topDevices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 5 dispositifs (captures)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topDevices.map(([deviceId, stats], idx) => (
                <div key={deviceId} className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-gray-400 text-xs">{idx + 1}.</span>
                  <span className="flex-1 text-gray-700 text-xs font-mono truncate">{deviceId}</span>
                  <span className="text-orange-600 font-medium text-xs">{stats.insectTotal}</span>
                  <span className="text-gray-400 text-xs">{stats.interventionCount} int.</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab 5 : Rapports ─────────────────────────────────────────────────────────

function RapportsTab({ siteId }: { siteId: string }) {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery<FieldReport[]>({
    queryKey: ['site-field-reports', siteId],
    queryFn: () => fieldReportsApi.list(siteId),
  });

  const generateMut = useMutation({
    mutationFn: () => fieldReportsApi.generate(siteId, { dateFrom, dateTo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-field-reports', siteId] });
      setShowDialog(false);
      setDateFrom('');
      setDateTo('');
      toast.success('Rapport généré');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la génération du rapport'),
  });

  const handleDownload = async (report: FieldReport) => {
    setDownloadingId(report.id);
    try {
      const blob = await fieldReportsApi.download(report.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.titre ? `${report.titre}.xlsx` : `rapport-${report.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Erreur lors du téléchargement du rapport');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Rapports terrain</h2>
        <Button size="sm" onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Générer un rapport
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FileText className="h-10 w-10 mb-3" />
            <p className="font-medium">Aucun rapport généré</p>
            <p className="text-sm mt-1">
              Générez un rapport Excel agrégeant l'historique des contrôles et comptages sur une période.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{report.titre || `Rapport v${report.version}`}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                    {report.dateDebut && report.dateFin && (
                      <span>{formatDate(report.dateDebut)} → {formatDate(report.dateFin)}</span>
                    )}
                    <Badge variant="outline" className="text-xs">v{report.version}</Badge>
                    {report.generatedBy && (
                      <span>{report.generatedBy.prenom} {report.generatedBy.nom}</span>
                    )}
                    <span>{formatDate(report.generatedAt)}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!report.xlsxPath || downloadingId === report.id}
                  onClick={() => handleDownload(report)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  {downloadingId === report.id ? 'Téléchargement...' : 'Télécharger'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate report dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Générer un rapport</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Le rapport agrège les contrôles et comptages des interventions terrain soumises ou validées sur la période choisie.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Du *</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Au *</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => generateMut.mutate()}
              disabled={!dateFrom || !dateTo || generateMut.isPending}
            >
              {generateMut.isPending ? 'Génération...' : 'Générer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 6 : Documents ────────────────────────────────────────────────────────

const DOC_TYPES = ['rapport', 'controles', 'tendance', 'zoning', 'autre'] as const;

function DocumentsTab({ siteId, documents }: { siteId: string; documents: SiteDocument[] }) {
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    titre: '',
    type: 'rapport',
    filename: '',
    path: '',
    commentaire: '',
    annee: '',
  });

  const createMut = useMutation({
    mutationFn: () =>
      fieldInterventionsApi.createSiteDocument(siteId, {
        ...form,
        annee: form.annee ? parseInt(form.annee, 10) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-documents', siteId] });
      setShowDialog(false);
      setForm({ titre: '', type: 'rapport', filename: '', path: '', commentaire: '', annee: '' });
      toast.success('Document ajouté');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de l\'ajout du document'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fieldInterventionsApi.deleteSiteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-documents', siteId] });
      setDeleteId(null);
      toast.success('Document supprimé');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la suppression du document'),
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
            <p className="text-sm mt-1">
              Importez d'anciens rapports PDF, fichiers Excel, etc.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.titre}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <Badge variant="outline" className="text-xs">
                      {doc.type}
                    </Badge>
                    {doc.annee && <span>{doc.annee}</span>}
                    {doc.date && <span>{formatDate(doc.date)}</span>}
                    {doc.uploadedBy && (
                      <span>
                        {doc.uploadedBy.prenom} {doc.uploadedBy.nom}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:text-red-600 shrink-0"
                  onClick={() => setDeleteId(doc.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add document dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un document archivé</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Titre *</Label>
              <Input
                value={form.titre}
                onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                placeholder="Rapport annuel 2024…"
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Année</Label>
                <Input
                  type="number"
                  placeholder="2024"
                  value={form.annee}
                  onChange={(e) => setForm((f) => ({ ...f, annee: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Nom du fichier *</Label>
                <Input
                  placeholder="rapport.pdf"
                  value={form.filename}
                  onChange={(e) => setForm((f) => ({ ...f, filename: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Chemin / URL *</Label>
              <Input
                placeholder="/uploads/…"
                value={form.path}
                onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Commentaire</Label>
              <Textarea
                value={form.commentaire}
                onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!form.titre || !form.filename || !form.path || createMut.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
