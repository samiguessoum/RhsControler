import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Building2,
  MapPin,
  CalendarDays,
  CheckCircle2,
  Clock,
  Activity,
  AlertCircle,
  XCircle,
  Save,
  Send,
  ShieldCheck,
  Ban,
  Plus,
  Trash2,
  User,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fieldInterventionsApi, zoningApi } from '@/services/api';
import { formatDate, cn } from '@/lib/utils';
import type {
  ControlStatus,
  DeviceType,
  FieldInterventionStatut,
  FIProduct,
} from '@/types';
import { useAuthStore } from '@/store/auth.store';

const FI_STATUT_CONFIG: Record<FieldInterventionStatut, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  DRAFT:       { label: 'Brouillon',  color: 'bg-gray-100 text-gray-700',   icon: Clock },
  IN_PROGRESS: { label: 'En cours',   color: 'bg-blue-100 text-blue-700',   icon: Activity },
  SUBMITTED:   { label: 'Soumise',    color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  VALIDATED:   { label: 'Validée',    color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  CANCELLED:   { label: 'Annulée',    color: 'bg-red-100 text-red-700',     icon: XCircle },
};

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  BAIT_STATION: "Poste d'appâtage",
  MECHANICAL_TRAP: 'Piège mécanique',
  GLUE_TRAP: 'Boîte à colle',
  FLYING_INSECT_KILLER: 'Destructeur insectes (FK)',
};

const INSECT_ESPECES = ['Mouches', 'Moustiques', 'Abeilles', 'Papillons', 'Autres'];

interface ControlFormState {
  statusCode: string;
  observation: string;
  insectCounts: Record<string, number>;
}

export function FieldInterventionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, canDo } = useAuthStore();
  const isOffice = canDo('manageInterventions');

  const { data: fi, isLoading } = useQuery({
    queryKey: ['field-intervention', id],
    queryFn: () => fieldInterventionsApi.get(id!),
    enabled: !!id,
  });

  const { data: controlStatuses = [] } = useQuery<ControlStatus[]>({
    queryKey: ['control-statuses'],
    queryFn: zoningApi.listControlStatuses,
    staleTime: Infinity,
  });

  const [controls, setControls] = useState<Record<string, ControlFormState>>({});
  const [products, setProducts] = useState<Partial<FIProduct>[]>([]);
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!fi || initialized.current) return;
    initialized.current = true;
    const initial: Record<string, ControlFormState> = {};
    for (const zone of fi.zoningVersion?.zones || []) {
      for (const device of zone.devices || []) {
        const existing = fi.controls?.find((c) => c.deviceId === device.id);
        initial[device.id] = {
          statusCode: existing?.statusCode || '',
          observation: existing?.observation || '',
          insectCounts: Object.fromEntries(
            (existing?.insectCounts || []).map((ic) => [ic.espece, ic.count])
          ),
        };
      }
    }
    setControls(initial);
    setProducts(fi.products?.length ? fi.products : []);
  }, [fi]);

  const isEditable = fi ? ['DRAFT', 'IN_PROGRESS'].includes(fi.statut) : false;

  const buildControlsPayload = (state: Record<string, ControlFormState>) =>
    Object.entries(state).map(([deviceId, c]) => ({
      deviceId,
      statusCode: c.statusCode || undefined,
      observation: c.observation || undefined,
      insectCounts: Object.entries(c.insectCounts)
        .filter(([, count]) => count > 0)
        .map(([espece, count]) => ({ espece, count })),
    }));

  const saveMutation = useMutation({
    mutationFn: (state: Record<string, ControlFormState>) =>
      fieldInterventionsApi.upsertControls(id!, buildControlsPayload(state)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-intervention', id] }),
    onError: (error: any) => toast.error(error?.response?.data?.error || "Erreur lors de l'enregistrement"),
  });

  const scheduleAutosave = (next: Record<string, ControlFormState>) => {
    if (!isEditable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMutation.mutate(next), 1000);
  };

  const updateControl = (deviceId: string, patch: Partial<ControlFormState>) => {
    setControls((prev) => {
      const next = { ...prev, [deviceId]: { ...prev[deviceId], ...patch } };
      scheduleAutosave(next);
      return next;
    });
  };

  const updateInsectCount = (deviceId: string, espece: string, count: number) => {
    setControls((prev) => {
      const next = {
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          insectCounts: { ...prev[deviceId]?.insectCounts, [espece]: count },
        },
      };
      scheduleAutosave(next);
      return next;
    });
  };

  const productsMutation = useMutation({
    mutationFn: (payload: Partial<FIProduct>[]) => fieldInterventionsApi.upsertProducts(id!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-intervention', id] });
      toast.success('Produits enregistrés');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || "Erreur lors de l'enregistrement des produits"),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync(controls);
      return fieldInterventionsApi.submit(id!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-intervention', id] });
      qc.invalidateQueries({ queryKey: ['field-interventions-all'] });
      toast.success('Fiche terrain soumise');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la soumission'),
  });

  const [commentaire, setCommentaire] = useState('');
  useEffect(() => { if (fi) setCommentaire(fi.commentaire || ''); }, [fi?.id]);
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commentMutation = useMutation({
    mutationFn: (value: string) => fieldInterventionsApi.update(id!, { commentaire: value }),
    onError: (error: any) => toast.error(error?.response?.data?.error || "Erreur lors de l'enregistrement du commentaire"),
  });
  const onCommentChange = (value: string) => {
    setCommentaire(value);
    if (commentTimer.current) clearTimeout(commentTimer.current);
    commentTimer.current = setTimeout(() => commentMutation.mutate(value), 1000);
  };

  const validateMutation = useMutation({
    mutationFn: () => fieldInterventionsApi.validate(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-intervention', id] });
      toast.success('Fiche terrain validée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la validation'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => fieldInterventionsApi.cancel(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-intervention', id] });
      toast.success('Fiche terrain annulée');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || "Erreur lors de l'annulation"),
  });

  const zones = useMemo(() => fi?.zoningVersion?.zones || [], [fi]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!fi) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Intervention terrain introuvable.</p>
      </div>
    );
  }

  const statutConfig = FI_STATUT_CONFIG[fi.statut];
  const StatutIcon = statutConfig.icon;
  const sortedStatuses = [...controlStatuses].sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99));

  return (
    <div className="p-3 sm:p-6 space-y-3 sm:space-y-4 max-w-3xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        {saveMutation.isPending && (
          <span className="text-xs text-gray-400 ml-auto">Enregistrement…</span>
        )}
      </div>

      {/* Info carte */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-base font-semibold">
              {fi.type === 'OPERATION' ? 'Opération de traitement' : 'Visite de contrôle'}
            </h1>
            <Badge className={cn('text-xs gap-1', statutConfig.color)}>
              <StatutIcon className="h-3 w-3" /> {statutConfig.label}
            </Badge>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
              <span>{fi.client?.nomEntreprise}</span>
              {fi.contrat && <span className="text-gray-400">· {fi.contrat.type}</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
              <Link to={`/sites/${fi.siteId}`} className="text-blue-600 underline">
                {fi.site?.nom}
              </Link>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
              <span>{formatDate(fi.dateIntervention)}</span>
            </div>
          </div>
          {fi.applicateurs && fi.applicateurs.length > 0 && (
            <div className="pt-1 flex flex-wrap gap-1">
              {fi.applicateurs.map((a) => (
                <Badge key={a.id} variant="outline" className="text-xs">
                  {a.employe?.prenom} {a.employe?.nom}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {zones.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            Aucune zone/dispositif dans ce zonage.
          </CardContent>
        </Card>
      )}

      {/* Zones et dispositifs */}
      {zones.map((zone) => (
        <div key={zone.id}>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">
            {zone.nom}{zone.etage ? ` — ${zone.etage}` : ''}
          </h2>
          <div className="space-y-3">
            {(zone.devices || []).map((device) => {
              const state = controls[device.id] || { statusCode: '', observation: '', insectCounts: {} };
              const savedControl = fi.controls?.find((c) => c.deviceId === device.id);
              const filledBy = (savedControl as any)?.updatedBy;
              const hasContent = state.statusCode || state.observation || Object.values(state.insectCounts).some((v) => v > 0);

              return (
                <Card key={device.id} className={cn(hasContent && 'border-blue-200 bg-blue-50/30')}>
                  <CardContent className="py-3 px-4 space-y-3">
                    {/* Device title + attribution */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-sm">
                          #{device.displayNumber} — {DEVICE_TYPE_LABELS[device.type]}
                        </span>
                        {device.nom && (
                          <span className="text-xs text-gray-500 ml-1">({device.nom})</span>
                        )}
                      </div>
                      {filledBy && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0 mt-0.5">
                          <User className="h-3 w-3" />
                          {filledBy.prenom}
                        </span>
                      )}
                    </div>

                    {/* Statut — pastilles */}
                    <div className="flex flex-wrap gap-2">
                      {sortedStatuses.map((cs) => {
                        const selected = state.statusCode === cs.code;
                        return (
                          <button
                            key={cs.code}
                            type="button"
                            disabled={!isEditable}
                            onClick={() => updateControl(device.id, { statusCode: selected ? '' : cs.code })}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border-2 transition-all select-none min-h-[40px]',
                              selected
                                ? 'text-white border-transparent shadow-md'
                                : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50',
                              !isEditable && 'opacity-60 cursor-default'
                            )}
                            style={selected ? { backgroundColor: cs.color ?? '#6b7280', borderColor: cs.color ?? '#6b7280' } : {}}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: selected ? 'rgba(255,255,255,0.7)' : (cs.color ?? '#6b7280') }}
                            />
                            <span className="font-bold">{cs.code}</span>
                            <span className={cn('hidden sm:inline font-normal text-xs', selected ? 'opacity-90' : 'text-gray-500')}>
                              {cs.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Observation */}
                    <Textarea
                      placeholder="Remarque (optionnel)"
                      value={state.observation}
                      disabled={!isEditable}
                      rows={2}
                      onChange={(e) => updateControl(device.id, { observation: e.target.value })}
                      className="text-sm resize-none"
                    />

                    {/* Comptage insectes (FK seulement) */}
                    {device.type === 'FLYING_INSECT_KILLER' && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Comptage insectes</p>
                        {INSECT_ESPECES.map((espece) => {
                          const count = state.insectCounts[espece] ?? 0;
                          return (
                            <div key={espece} className="flex items-center justify-between gap-3">
                              <span className="text-sm text-gray-700 w-28">{espece}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!isEditable || count <= 0}
                                  onClick={() => updateInsectCount(device.id, espece, Math.max(0, count - 1))}
                                  className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 disabled:opacity-40 active:bg-gray-100"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-10 text-center font-semibold text-lg tabular-nums">{count}</span>
                                <button
                                  type="button"
                                  disabled={!isEditable}
                                  onClick={() => updateInsectCount(device.id, espece, count + 1)}
                                  className="w-10 h-10 rounded-full border-2 border-blue-200 bg-blue-50 flex items-center justify-center text-blue-700 disabled:opacity-40 active:bg-blue-100"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Produits utilisés */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produits utilisés</CardTitle>
          {isEditable && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setProducts((p) => [...p, { nom: '', quantite: undefined, unite: '' }])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {products.length === 0 && <p className="text-sm text-gray-400">Aucun produit renseigné.</p>}
          {products.map((p, i) => (
            <div key={i} className="space-y-2 pb-3 border-b last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Nom du produit"
                  value={p.nom || ''}
                  disabled={!isEditable}
                  onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, nom: e.target.value } : x))}
                />
                {isEditable && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-500 shrink-0"
                    onClick={() => setProducts((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="N° lot"
                  value={p.lot || ''}
                  disabled={!isEditable}
                  onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, lot: e.target.value } : x))}
                />
                <Input
                  className="w-20"
                  type="number"
                  placeholder="Qté"
                  value={p.quantite ?? ''}
                  disabled={!isEditable}
                  onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, quantite: parseFloat(e.target.value) || undefined } : x))}
                />
                <Input
                  className="w-16"
                  placeholder="Unité"
                  value={p.unite || ''}
                  disabled={!isEditable}
                  onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, unite: e.target.value } : x))}
                />
              </div>
            </div>
          ))}
          {isEditable && products.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => productsMutation.mutate(products)}>
              <Save className="h-3.5 w-3.5 mr-1" /> Enregistrer les produits
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Commentaire */}
      <Card>
        <CardContent className="py-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Commentaire général</label>
          <Textarea
            className="mt-2"
            rows={3}
            disabled={!isEditable}
            placeholder="Observations générales sur l'intervention…"
            value={commentaire}
            onChange={(e) => onCommentChange(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Barre d'actions fixe en bas */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
        {isEditable && (
          <>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => saveMutation.mutate(controls)}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" /> Enregistrer le brouillon
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" /> Soumettre
            </Button>
          </>
        )}
        {isOffice && fi.statut === 'SUBMITTED' && (
          <>
            <Button
              variant="outline"
              className="w-full sm:w-auto text-red-600 hover:text-red-700"
              onClick={() => cancelMutation.mutate()}
            >
              <Ban className="h-4 w-4 mr-2" /> Annuler
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
            >
              <ShieldCheck className="h-4 w-4 mr-2" /> Valider
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
