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
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fieldInterventionsApi, zoningApi, produitsServicesApi } from '@/services/api';
import { formatDate, cn } from '@/lib/utils';
import type {
  ControlStatus,
  DeviceType,
  FieldInterventionStatut,
  FIProduct,
  FICheckCategory,
} from '@/types';
import { useAuthStore } from '@/store/auth.store';

// ─── Constantes ────────────────────────────────────────────────────────────

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
  FLYING_INSECT_KILLER: 'Destructeur FK',
};

const DEVICE_TYPE_STYLE: Record<DeviceType, { bg: string; text: string; code: string; emoji: string }> = {
  BAIT_STATION:        { bg: 'bg-blue-600',   text: 'text-white', code: 'BA', emoji: '🐀' },
  MECHANICAL_TRAP:     { bg: 'bg-orange-500', text: 'text-white', code: 'PM', emoji: '🪤' },
  GLUE_TRAP:           { bg: 'bg-purple-600', text: 'text-white', code: 'BC', emoji: '⬛' },
  FLYING_INSECT_KILLER:{ bg: 'bg-green-600',  text: 'text-white', code: 'FK', emoji: '⚡' },
};

const INSECT_ESPECES = ['Mouches', 'Moustiques', 'Abeilles', 'Papillons', 'Autres'];

const BOITES_TYPES: DeviceType[] = ['BAIT_STATION', 'MECHANICAL_TRAP', 'GLUE_TRAP'];

const AUTRE_SUBTYPES = [
  { key: 'ANTI_SERPENTS', label: 'Lutte anti-serpents' },
  { key: 'ANTI_CHATS',    label: 'Lutte anti-chats' },
  { key: 'ANTI_FOURMIS',  label: 'Lutte anti-fourmis' },
  { key: 'ANTI_PUCES',    label: 'Lutte anti-puces' },
  { key: 'ANTI_PIGEONS',  label: 'Lutte anti-pigeons' },
];

type Category = 'boites' | 'fk' | 'regards' | 'goliath' | 'autre';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'boites',  label: 'Boîtes' },
  { key: 'fk',      label: 'Destructeurs FK' },
  { key: 'regards', label: 'Regards / Avaloirs' },
  { key: 'goliath', label: 'Goliath Gel' },
  { key: 'autre',   label: 'Autre' },
];

// ─── Types locaux ───────────────────────────────────────────────────────────

interface ControlFormState {
  statusCode: string;
  observation: string;
  insectCounts: Record<string, number>;
}

interface SimpleCheckState {
  statut: string;
  commentaire: string;
}

// ─── Composant ──────────────────────────────────────────────────────────────

export function FieldInterventionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canDo } = useAuthStore();
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

  // ── État dispositifs (boîtes + FK) ─────────────────────────
  const [controls, setControls] = useState<Record<string, ControlFormState>>({});
  const [products, setProducts] = useState<Partial<FIProduct>[]>([]);
  const initialized = useRef(false);
  // Un timer par deviceId pour n'autosauvegarder que le dispositif modifié
  const deviceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── État simple checks ──────────────────────────────────────
  const [simpleChecks, setSimpleChecks] = useState<Record<string, SimpleCheckState>>({});
  const simpleCheckTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const simpleInitialized = useRef(false);

  // ── Produits terrain (catalogue CONSOMMABLE) ─────────────────
  const { data: produitsTerrainData } = useQuery({
    queryKey: ['produits-terrain'],
    queryFn: () => produitsServicesApi.list({ nature: 'CONSOMMABLE', limit: 200 }),
    staleTime: 5 * 60_000,
  });
  const produitsTerrainList = produitsTerrainData?.produits ?? [];

  // ── Audit (bureau uniquement) ────────────────────────────────
  const [showAudit, setShowAudit] = useState(false);
  const { data: auditData } = useQuery({
    queryKey: ['field-intervention-audit', id],
    queryFn: () => fieldInterventionsApi.getAudit(id!),
    enabled: !!id && isOffice && showAudit,
    staleTime: 30_000,
  });

  // ── Navigation ──────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<Category>('boites');
  const [selectedAutreSubType, setSelectedAutreSubType] = useState<string | null>(null);

  // ── Initialisation controls ──────────────────────────────────
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

  // ── Initialisation simple checks ─────────────────────────────
  useEffect(() => {
    if (!fi || simpleInitialized.current) return;
    simpleInitialized.current = true;
    const init: Record<string, SimpleCheckState> = {};
    for (const sc of fi.simpleChecks || []) {
      const key = sc.subType ? `${sc.category}_${sc.subType}` : sc.category;
      init[key] = { statut: sc.statut ?? '', commentaire: sc.commentaire ?? '' };
    }
    setSimpleChecks(init);
  }, [fi]);

  const isEditable = fi ? ['DRAFT', 'IN_PROGRESS'].includes(fi.statut) : false;

  // ── Mutations contrôles dispositifs ─────────────────────────
  const buildSinglePayload = (deviceId: string, c: ControlFormState) => ([{
    deviceId,
    statusCode: c.statusCode || undefined,
    observation: c.observation || undefined,
    insectCounts: Object.entries(c.insectCounts)
      .filter(([, count]) => count > 0)
      .map(([espece, count]) => ({ espece, count })),
  }]);

  const [isSaving, setIsSaving] = useState(false);

  // Autosave par dispositif — n'envoie QUE ce dispositif, pas les autres
  const scheduleDeviceSave = (deviceId: string, state: ControlFormState) => {
    if (!isEditable) return;
    if (deviceTimers.current[deviceId]) clearTimeout(deviceTimers.current[deviceId]);
    deviceTimers.current[deviceId] = setTimeout(async () => {
      try {
        await fieldInterventionsApi.upsertControls(id!, buildSinglePayload(deviceId, state));
        qc.invalidateQueries({ queryKey: ['field-intervention', id] });
      } catch (err: any) {
        toast.error(err?.response?.data?.error || "Erreur lors de l'enregistrement");
      }
    }, 1000);
  };

  // Sauvegarde manuelle (bouton) — envoie uniquement les dispositifs touchés cette session
  const touchedDevices = useRef<Set<string>>(new Set());

  const saveAllTouched = async (state: Record<string, ControlFormState>) => {
    if (touchedDevices.current.size === 0) return;
    setIsSaving(true);
    try {
      const payload = [...touchedDevices.current].map((deviceId) => buildSinglePayload(deviceId, state[deviceId])[0]);
      await fieldInterventionsApi.upsertControls(id!, payload);
      qc.invalidateQueries({ queryKey: ['field-intervention', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const updateControl = (deviceId: string, patch: Partial<ControlFormState>) => {
    touchedDevices.current.add(deviceId);
    setControls((prev) => {
      const updated = { ...prev[deviceId], ...patch };
      scheduleDeviceSave(deviceId, updated);
      return { ...prev, [deviceId]: updated };
    });
  };

  const updateInsectCount = (deviceId: string, espece: string, count: number) => {
    touchedDevices.current.add(deviceId);
    setControls((prev) => {
      const updated = {
        ...prev[deviceId],
        insectCounts: { ...prev[deviceId]?.insectCounts, [espece]: count },
      };
      scheduleDeviceSave(deviceId, updated);
      return { ...prev, [deviceId]: updated };
    });
  };

  // ── Mutations simple checks ──────────────────────────────────
  const updateSimpleCheck = (category: FICheckCategory, subType: string, patch: Partial<SimpleCheckState>) => {
    if (!isEditable) return;
    const key = subType ? `${category}_${subType}` : category;
    setSimpleChecks((prev) => {
      const current = prev[key] ?? { statut: '', commentaire: '' };
      const next = { ...prev, [key]: { ...current, ...patch } };
      if (simpleCheckTimers.current[key]) clearTimeout(simpleCheckTimers.current[key]);
      simpleCheckTimers.current[key] = setTimeout(() => {
        fieldInterventionsApi.upsertSimpleCheck(id!, {
          category,
          subType: subType || undefined,
          statut: next[key].statut || undefined,
          commentaire: next[key].commentaire || undefined,
        }).catch((err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de l\'enregistrement'));
      }, 800);
      return next;
    });
  };

  // ── Produits ─────────────────────────────────────────────────
  const productsMutation = useMutation({
    mutationFn: (payload: Partial<FIProduct>[]) => fieldInterventionsApi.upsertProducts(id!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-intervention', id] });
      toast.success('Produits enregistrés');
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || "Erreur lors de l'enregistrement des produits"),
  });

  // ── Submit / Validate / Cancel ───────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      await saveAllTouched(controls);
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
    onError: (error: any) => toast.error(error?.response?.data?.error || "Erreur lors de l'enregistrement"),
  });
  const onCommentChange = (value: string) => {
    setCommentaire(value);
    if (commentTimer.current) clearTimeout(commentTimer.current);
    commentTimer.current = setTimeout(() => commentMutation.mutate(value), 1000);
  };

  const validateMutation = useMutation({
    mutationFn: () => fieldInterventionsApi.validate(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['field-intervention', id] }); toast.success('Fiche validée'); },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la validation'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => fieldInterventionsApi.cancel(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['field-intervention', id] }); toast.success('Fiche annulée'); },
    onError: (error: any) => toast.error(error?.response?.data?.error || "Erreur lors de l'annulation"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => fieldInterventionsApi.reject(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['field-intervention', id] }); toast.success('Fiche renvoyée au technicien pour correction'); },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors du renvoi'),
  });

  // ── Données calculées ────────────────────────────────────────
  const zones = useMemo(() => fi?.zoningVersion?.zones || [], [fi]);
  const sortedStatuses = useMemo(
    () => [...controlStatuses].sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99)),
    [controlStatuses]
  );

  // Dispositifs regroupés par type, triés, pour chaque catégorie
  const devicesByType = useMemo(() => {
    const typeOrder: DeviceType[] = ['BAIT_STATION', 'MECHANICAL_TRAP', 'GLUE_TRAP', 'FLYING_INSECT_KILLER'];
    const allDevices = zones.flatMap((z) =>
      (z.devices || []).map((d) => ({ ...d, zoneName: z.nom, zoneEtage: z.etage }))
    );
    return typeOrder.map((type) => ({
      type,
      devices: allDevices
        .filter((d) => d.type === type)
        .sort((a, b) => {
          const na = parseInt(a.displayNumber, 10), nb = parseInt(b.displayNumber, 10);
          return !isNaN(na) && !isNaN(nb) ? na - nb : a.displayNumber.localeCompare(b.displayNumber);
        }),
    })).filter((g) => g.devices.length > 0);
  }, [zones]);

  const hasBoites = devicesByType.some((g) => BOITES_TYPES.includes(g.type));
  const hasFK = devicesByType.some((g) => g.type === 'FLYING_INSECT_KILLER');

  // ── Loading / not found ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!fi) return <div className="p-6"><p className="text-gray-500">Intervention terrain introuvable.</p></div>;

  const statutConfig = FI_STATUT_CONFIG[fi.statut];
  const StatutIcon = statutConfig.icon;

  // ── Rendu d'une carte dispositif ────────────────────────────
  const renderDeviceCard = (device: any) => {
    const state = controls[device.id] || { statusCode: '', observation: '', insectCounts: {} };
    const savedControl = fi.controls?.find((c) => c.deviceId === device.id);
    const filledBy = (savedControl as any)?.updatedBy;
    const hasContent = state.statusCode || state.observation || Object.values(state.insectCounts).some((v) => v > 0);
    const typeStyle = DEVICE_TYPE_STYLE[device.type as DeviceType];

    return (
      <Card key={device.id} className={cn('overflow-hidden', hasContent ? 'border-2 border-blue-300' : 'border border-gray-200')}>
        {/* En-tête : numéro + type */}
        <div className={cn('flex items-center gap-4 px-4 py-3', hasContent ? 'bg-blue-50' : 'bg-gray-50')}>
          {/* Badge type */}
          <div className={cn('w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm', typeStyle.bg, typeStyle.text)}>
            <span className="text-lg leading-none">{typeStyle.emoji}</span>
            <span className="text-xs font-bold mt-0.5">{typeStyle.code}</span>
          </div>
          {/* Numéro */}
          <div className="flex-1 min-w-0">
            <div className="text-4xl font-black text-gray-800 leading-none">#{device.displayNumber}</div>
            {device.nom && <div className="text-sm text-gray-500 mt-1 truncate">{device.nom}</div>}
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 bg-gray-800 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                📍 {device.zoneName}{device.zoneEtage ? ` · ${device.zoneEtage}` : ''}
              </span>
            </div>
          </div>
          {/* Attribution */}
          {filledBy ? (
            <div className="flex flex-col items-end shrink-0">
              <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-1">
                <User className="h-3 w-3" />{filledBy.prenom}
              </span>
            </div>
          ) : (
            <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0 self-start mt-1" title="Non rempli" />
          )}
        </div>

        <CardContent className="px-4 pt-3 pb-4 space-y-3">
          {/* Pastilles statut */}
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
                    'flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold border-2 transition-all select-none min-h-[44px]',
                    selected ? 'text-white border-transparent shadow-md' : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50',
                    !isEditable && 'opacity-60 cursor-default'
                  )}
                  style={selected ? { backgroundColor: cs.color ?? '#6b7280', borderColor: cs.color ?? '#6b7280' } : {}}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selected ? 'rgba(255,255,255,0.8)' : (cs.color ?? '#6b7280') }} />
                  <span className="font-black">{cs.code}</span>
                  <span className={cn('font-normal text-xs', selected ? 'opacity-90' : 'text-gray-500')}>{cs.label}</span>
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

          {/* Comptage insectes FK */}
          {device.type === 'FLYING_INSECT_KILLER' && (
            <div className="space-y-3 pt-1">
              <p className="text-sm font-bold text-gray-600">Comptage insectes</p>
              {INSECT_ESPECES.map((espece) => {
                const count = state.insectCounts[espece] ?? 0;
                return (
                  <div key={espece} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-sm font-medium text-gray-700 w-28">{espece}</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={!isEditable || count <= 0}
                        onClick={() => updateInsectCount(device.id, espece, Math.max(0, count - 1))}
                        className="w-11 h-11 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 disabled:opacity-30 active:bg-gray-200 bg-white"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        disabled={!isEditable}
                        value={count === 0 ? '' : count}
                        placeholder="0"
                        onChange={(e) => updateInsectCount(device.id, espece, Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-16 text-center font-black text-2xl tabular-nums bg-white border-2 border-gray-200 rounded-xl py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
                      />
                      <button
                        type="button"
                        disabled={!isEditable}
                        onClick={() => updateInsectCount(device.id, espece, count + 1)}
                        className="w-11 h-11 rounded-full border-2 border-blue-300 bg-blue-600 flex items-center justify-center text-white disabled:opacity-30 active:bg-blue-700"
                      >
                        <Plus className="h-5 w-5" />
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
  };

  // ── Rendu formulaire simple (Regards, Goliath, Autre) ───────
  const renderSimpleCheck = (category: FICheckCategory, subType: string = '', label: string, filledBy?: any) => {
    const key = subType ? `${category}_${subType}` : category;
    const state = simpleChecks[key] || { statut: '', commentaire: '' };

    return (
      <Card className={cn(state.statut && 'border-blue-200 bg-blue-50/30')}>
        <CardContent className="py-4 px-4 space-y-4">
          {label && <p className="font-semibold text-sm text-gray-700">{label}</p>}

          {/* OK / Pas OK */}
          <div className="flex gap-3">
            {(['OK', 'PAS_OK'] as const).map((s) => {
              const selected = state.statut === s;
              const isOk = s === 'OK';
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!isEditable}
                  onClick={() => updateSimpleCheck(category, subType, { statut: selected ? '' : s })}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-semibold text-base border-2 transition-all min-h-[52px]',
                    selected && isOk && 'bg-green-500 border-green-500 text-white',
                    selected && !isOk && 'bg-red-500 border-red-500 text-white',
                    !selected && 'bg-white border-gray-200 text-gray-600 active:bg-gray-50',
                    !isEditable && 'opacity-60 cursor-default'
                  )}
                >
                  {isOk ? '✓ OK' : '✗ Pas OK'}
                </button>
              );
            })}
          </div>

          {/* Commentaire */}
          <Textarea
            placeholder="Commentaire (optionnel)"
            value={state.commentaire}
            disabled={!isEditable}
            rows={3}
            onChange={(e) => updateSimpleCheck(category, subType, { commentaire: e.target.value })}
            className="text-sm resize-none"
          />

          {/* Attribution */}
          {filledBy && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <User className="h-3 w-3" /> Renseigné par {filledBy.prenom} {filledBy.nom}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Contenu de la catégorie active ──────────────────────────
  const renderCategoryContent = () => {
    if (activeCategory === 'boites') {
      const boitesGroups = devicesByType.filter((g) => BOITES_TYPES.includes(g.type));
      if (boitesGroups.length === 0) {
        return <p className="text-center text-gray-400 py-8">Aucune boîte dans ce zonage.</p>;
      }
      return boitesGroups.map(({ type, devices }) => {
        const typeStyle = DEVICE_TYPE_STYLE[type];
        const filled = devices.filter((d) => {
          const s = controls[d.id];
          return s?.statusCode || s?.observation;
        }).length;
        return (
          <div key={type} className="space-y-3">
            {/* En-tête type */}
            <div className={cn('flex items-center gap-3 px-4 py-3 rounded-2xl', typeStyle.bg)}>
              <span className="text-2xl">{typeStyle.emoji}</span>
              <div className="flex-1">
                <p className={cn('font-bold text-base', typeStyle.text)}>{DEVICE_TYPE_LABELS[type]}</p>
                <p className="text-white/70 text-xs">{devices.length} dispositif{devices.length > 1 ? 's' : ''}</p>
              </div>
              {filled > 0 && (
                <span className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {filled}/{devices.length} remplis
                </span>
              )}
            </div>
            {devices.map(renderDeviceCard)}
          </div>
        );
      });
    }

    if (activeCategory === 'fk') {
      const fkGroups = devicesByType.filter((g) => g.type === 'FLYING_INSECT_KILLER');
      if (fkGroups.length === 0) {
        return <p className="text-center text-gray-400 py-8">Aucun destructeur d'insectes dans ce zonage.</p>;
      }
      const { bg, text, emoji } = DEVICE_TYPE_STYLE.FLYING_INSECT_KILLER;
      const devices = fkGroups[0].devices;
      const filled = devices.filter((d) => controls[d.id]?.statusCode).length;
      return (
        <div className="space-y-3">
          <div className={cn('flex items-center gap-3 px-4 py-3 rounded-2xl', bg)}>
            <span className="text-2xl">{emoji}</span>
            <div className="flex-1">
              <p className={cn('font-bold text-base', text)}>Destructeurs FK</p>
              <p className="text-white/70 text-xs">{devices.length} dispositif{devices.length > 1 ? 's' : ''}</p>
            </div>
            {filled > 0 && (
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-full">
                {filled}/{devices.length} remplis
              </span>
            )}
          </div>
          {devices.map(renderDeviceCard)}
        </div>
      );
    }

    if (activeCategory === 'regards') {
      const saved = fi.simpleChecks?.find((sc) => sc.category === 'REGARDS');
      return renderSimpleCheck('REGARDS', '', '', saved?.updatedBy as any);
    }

    if (activeCategory === 'goliath') {
      const saved = fi.simpleChecks?.find((sc) => sc.category === 'GOLIATH');
      return renderSimpleCheck('GOLIATH', '', '', saved?.updatedBy as any);
    }

    if (activeCategory === 'autre') {
      return (
        <div className="space-y-4">
          {/* Sélection du type */}
          <div className="flex flex-col gap-2">
            {AUTRE_SUBTYPES.map(({ key, label }) => {
              const selected = selectedAutreSubType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedAutreSubType(selected ? null : key)}
                  className={cn(
                    'w-full text-left px-4 py-3.5 rounded-xl border-2 font-medium transition-all',
                    selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {selectedAutreSubType && (
            <div className="mt-2">
              {(() => {
                const saved = fi.simpleChecks?.find((sc) => sc.category === 'AUTRE' && sc.subType === selectedAutreSubType);
                return renderSimpleCheck('AUTRE', selectedAutreSubType, '', saved?.updatedBy as any);
              })()}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // ── Rendu ────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-6 space-y-3 sm:space-y-4 max-w-3xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        {isSaving && (
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
              <Link to={`/sites/${fi.siteId}`} className="text-blue-600 underline">{fi.site?.nom}</Link>
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

      {/* Navigation catégories */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORIES.map(({ key, label }) => {
          const disabled = (key === 'boites' && !hasBoites) || (key === 'fk' && !hasFK);
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => setActiveCategory(key)}
              className={cn(
                'shrink-0 px-4 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all whitespace-nowrap min-h-[44px]',
                activeCategory === key
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                  : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50',
                disabled && 'opacity-40 cursor-not-allowed'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Contenu catégorie */}
      <div className="space-y-3">
        {renderCategoryContent()}
      </div>

      {/* Produits utilisés */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produits utilisés</CardTitle>
          {isEditable && (
            <Button size="sm" variant="outline" onClick={() => setProducts((p) => [...p, { nom: '', quantite: undefined, unite: '' }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {products.length === 0 && <p className="text-sm text-gray-400">Aucun produit renseigné.</p>}
          {products.map((p, i) => (
            <div key={i} className="space-y-2 pb-3 border-b last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                {isEditable ? (
                  <select
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={p.nom || ''}
                    onChange={(e) => {
                      const chosen = produitsTerrainList.find((x) => x.nom === e.target.value);
                      setProducts((prev) => prev.map((x, idx) => idx === i ? { ...x, nom: e.target.value, unite: chosen?.unite ?? x.unite } : x));
                    }}
                  >
                    <option value="">— Sélectionner un produit —</option>
                    {produitsTerrainList.map((pt) => (
                      <option key={pt.id} value={pt.nom}>{pt.nom}</option>
                    ))}
                  </select>
                ) : (
                  <span className="flex-1 text-sm font-medium text-gray-800">{p.nom || '—'}</span>
                )}
                {isEditable && (
                  <Button size="icon" variant="ghost" className="text-red-500 shrink-0" onClick={() => setProducts((prev) => prev.filter((_, idx) => idx !== i))}>
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

      {/* Commentaire général */}
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

      {/* Traçabilité — bureau uniquement */}
      {isOffice && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowAudit((v) => !v)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-gray-500" /> Traçabilité
              </CardTitle>
              {showAudit ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </div>
          </CardHeader>

          {showAudit && (
            <CardContent className="pt-0 space-y-4">
              {/* État actuel par dispositif */}
              {auditData?.controls && auditData.controls.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">État actuel par dispositif</p>
                  <div className="space-y-1">
                    {[...auditData.controls]
                      .sort((a: any, b: any) => {
                        const na = parseInt(a.device?.displayNumber, 10), nb = parseInt(b.device?.displayNumber, 10);
                        return !isNaN(na) && !isNaN(nb) ? na - nb : 0;
                      })
                      .map((ctrl: any) => (
                        <div key={ctrl.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium shrink-0">#{ctrl.device?.displayNumber}</span>
                            <span className="text-gray-500 truncate text-xs">{ctrl.device?.nom || ''}</span>
                            {ctrl.statusCode && (
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold shrink-0">
                                {ctrl.statusCode}
                              </span>
                            )}
                          </div>
                          {ctrl.updatedBy ? (
                            <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                              <User className="h-3 w-3" />{ctrl.updatedBy.prenom} {ctrl.updatedBy.nom}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 shrink-0">—</span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Simple checks */}
              {auditData?.simpleChecks && auditData.simpleChecks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contrôles simples</p>
                  <div className="space-y-1">
                    {auditData.simpleChecks.map((sc: any) => {
                      const catLabel: Record<string, string> = { REGARDS: 'Regards / Avaloirs', GOLIATH: 'Goliath Gel', AUTRE: 'Autre' };
                      const subLabel = sc.subType ? ` · ${sc.subType.replace(/_/g, ' ').toLowerCase()}` : '';
                      return (
                        <div key={sc.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{catLabel[sc.category]}{subLabel}</span>
                            {sc.statut && (
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-bold',
                                sc.statut === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              )}>
                                {sc.statut === 'OK' ? 'OK' : 'Pas OK'}
                              </span>
                            )}
                          </div>
                          {sc.updatedBy ? (
                            <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                              <User className="h-3 w-3" />{sc.updatedBy.prenom} {sc.updatedBy.nom}
                            </span>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Historique des modifications */}
              {auditData?.audits && auditData.audits.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Historique des modifications</p>
                  <div className="space-y-1">
                    {auditData.audits.map((a: any) => (
                      <div key={a.id} className="text-xs py-1.5 border-b last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-700">
                            {a.changedBy ? `${a.changedBy.prenom} ${a.changedBy.nom}` : 'Inconnu'}
                          </span>
                          <span className="text-gray-400">
                            {new Date(a.changedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-gray-500 mt-0.5">
                          {a.oldStatusCode !== a.newStatusCode && (
                            <span>{a.oldStatusCode || '—'} → <strong>{a.newStatusCode || '—'}</strong></span>
                          )}
                          {a.oldObservation !== a.newObservation && a.newObservation && (
                            <span className="ml-2 italic">"{a.newObservation}"</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {auditData && auditData.controls.length === 0 && auditData.simpleChecks.length === 0 && auditData.audits.length === 0 && (
                <p className="text-sm text-gray-400">Aucune donnée de traçabilité disponible.</p>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Barre d'actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
        {isEditable && (
          <>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => saveAllTouched(controls)} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Enregistrer le brouillon
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              <Send className="h-4 w-4 mr-2" /> Soumettre
            </Button>
          </>
        )}
        {isOffice && fi.statut === 'SUBMITTED' && (
          <>
            <Button variant="outline" className="w-full sm:w-auto text-red-600 hover:text-red-700" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              <Ban className="h-4 w-4 mr-2" /> Annuler définitivement
            </Button>
            <Button variant="outline" className="w-full sm:w-auto text-orange-600 hover:text-orange-700 border-orange-200" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Renvoyer en correction
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Valider
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
