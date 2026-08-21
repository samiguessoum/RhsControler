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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                {fi.type === 'OPERATION' ? 'Opération de traitement' : 'Visite de contrôle'}
                <Badge className={cn('text-xs gap-1', statutConfig.color)}>
                  <StatutIcon className="h-3 w-3" /> {statutConfig.label}
                </Badge>
              </CardTitle>
              <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                <div className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {fi.client?.nomEntreprise}
                  {fi.contrat && <span className="text-gray-400">· Contrat {fi.contrat.type}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <Link to={`/sites/${fi.siteId}`} className="hover:underline text-blue-600">
                    {fi.site?.nom}
                  </Link>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> {formatDate(fi.dateIntervention)}
                </div>
              </div>
            </div>
            {saveMutation.isPending && (
              <span className="text-xs text-gray-400">Enregistrement…</span>
            )}
          </div>
        </CardHeader>
        {fi.applicateurs && fi.applicateurs.length > 0 && (
          <CardContent className="pt-0 pb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Applicateurs</p>
            <div className="flex flex-wrap gap-1">
              {fi.applicateurs.map((a) => (
                <Badge key={a.id} variant="outline">{a.employe?.prenom} {a.employe?.nom}</Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {zones.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            Aucune zone/dispositif dans ce zonage.
          </CardContent>
        </Card>
      )}

      {zones.map((zone) => (
        <Card key={zone.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{zone.nom}{zone.etage ? ` — ${zone.etage}` : ''}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(zone.devices || []).map((device) => {
              const state = controls[device.id] || { statusCode: '', observation: '', insectCounts: {} };
              return (
                <div key={device.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {DEVICE_TYPE_LABELS[device.type]} #{device.displayNumber}
                      {device.nom ? ` — ${device.nom}` : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select
                      value={state.statusCode || undefined}
                      onValueChange={(v) => updateControl(device.id, { statusCode: v })}
                      disabled={!isEditable}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="État du dispositif" />
                      </SelectTrigger>
                      <SelectContent>
                        {controlStatuses.map((cs) => (
                          <SelectItem key={cs.code} value={cs.code}>{cs.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Observation (optionnel)"
                      value={state.observation}
                      disabled={!isEditable}
                      onChange={(e) => updateControl(device.id, { observation: e.target.value })}
                    />
                  </div>

                  {device.type === 'FLYING_INSECT_KILLER' && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                      {INSECT_ESPECES.map((espece) => (
                        <div key={espece}>
                          <label className="text-xs text-gray-500">{espece}</label>
                          <Input
                            type="number"
                            min={0}
                            disabled={!isEditable}
                            value={state.insectCounts[espece] ?? ''}
                            onChange={(e) => updateInsectCount(device.id, espece, parseInt(e.target.value, 10) || 0)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

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
        <CardContent className="space-y-2">
          {products.length === 0 && <p className="text-sm text-gray-400">Aucun produit renseigné.</p>}
          {products.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-5"
                placeholder="Nom du produit"
                value={p.nom || ''}
                disabled={!isEditable}
                onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, nom: e.target.value } : x))}
              />
              <Input
                className="col-span-3"
                placeholder="Lot"
                value={p.lot || ''}
                disabled={!isEditable}
                onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, lot: e.target.value } : x))}
              />
              <Input
                className="col-span-2"
                type="number"
                placeholder="Qté"
                value={p.quantite ?? ''}
                disabled={!isEditable}
                onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, quantite: parseFloat(e.target.value) || undefined } : x))}
              />
              <Input
                className="col-span-1"
                placeholder="Unité"
                value={p.unite || ''}
                disabled={!isEditable}
                onChange={(e) => setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, unite: e.target.value } : x))}
              />
              {isEditable && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="col-span-1 text-red-500"
                  onClick={() => setProducts((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {isEditable && products.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => productsMutation.mutate(products)}>
              <Save className="h-3.5 w-3.5 mr-1" /> Enregistrer les produits
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Commentaire général</label>
          <Textarea
            className="mt-1"
            rows={3}
            disabled={!isEditable}
            placeholder="Observations générales sur l'intervention…"
            value={commentaire}
            onChange={(e) => onCommentChange(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Barre d'actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex items-center justify-end gap-2 flex-wrap">
        {isEditable && (
          <>
            <Button variant="outline" onClick={() => saveMutation.mutate(controls)} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Enregistrer le brouillon
            </Button>
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              <Send className="h-4 w-4 mr-1" /> Soumettre
            </Button>
          </>
        )}
        {isOffice && fi.statut === 'SUBMITTED' && (
          <>
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => cancelMutation.mutate()}>
              <Ban className="h-4 w-4 mr-1" /> Annuler
            </Button>
            <Button onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Valider
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

