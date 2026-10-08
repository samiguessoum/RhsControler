import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { bonCommandeApi } from '@/services/api';
import { cn } from '@/lib/utils';
import { NIVEAUX_BC, formatDateBC, type NiveauAlerteBC, type PrevisionBC } from '@/lib/bc';

/** BC tel que renvoyé par l'API (liste ou détail), prévision comprise. */
export interface BonCommandeAffiche extends PrevisionBC {
  id: string;
  numero: string;
  date?: string | null;
  dateFinValidite?: string | null;
  quotaPassages: number | null;
  passagesConsommes: number;
  seuilAlerte: number;
  actif: boolean;
  notes?: string | null;
  sites?: { siteId: string; site?: { id: string; nom: string } }[];
  avenants?: { id: string; numero: number; nom?: string | null }[];
}

// ─── Pastilles de statut (sobres : bordure + fond léger) ──────────────────────

export const TONS = {
  rouge: 'border-red-200 bg-red-50 text-red-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  ambre: 'border-amber-200 bg-amber-50 text-amber-700',
  vert: 'border-green-200 bg-green-50 text-green-700',
  bleu: 'border-blue-200 bg-blue-50 text-blue-700',
  gris: 'border-gray-200 bg-gray-50 text-gray-600',
} as const;

const TON_NIVEAU: Record<NiveauAlerteBC, keyof typeof TONS> = {
  DEPASSE: 'rouge',
  EPUISE: 'rouge',
  EXPIRE: 'rouge',
  DERNIER: 'orange',
  INSUFFISANT: 'orange',
  ALERTE: 'ambre',
  EXPIRATION_PROCHE: 'ambre',
};

export function Statut({ ton, children }: { ton: keyof typeof TONS; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none', TONS[ton])}>
      {children}
    </span>
  );
}

export function StatutBC({ bc }: { bc: Pick<BonCommandeAffiche, 'actif' | 'niveauAlerte'> }) {
  if (!bc.actif) return <Statut ton="gris">Désactivé</Statut>;
  if (bc.niveauAlerte) return <Statut ton={TON_NIVEAU[bc.niveauAlerte]}>{NIVEAUX_BC[bc.niveauAlerte].label}</Statut>;
  return <Statut ton="vert">Actif</Statut>;
}

export const pl = (n: number, mot: string) => `${n} ${mot}${Math.abs(n) > 1 ? 's' : ''}`;

/** "Valable jusqu'au 31/12/2026 (encore 84 j)" / "Expiré depuis le …" / null si pas de fin. */
export function validiteBC(bc: Pick<BonCommandeAffiche, 'dateFinValidite' | 'joursAvantFinValidite'>): { texte: string; alerte: boolean } | null {
  if (!bc.dateFinValidite) return null;
  const fin = formatDateBC(bc.dateFinValidite);
  const j = bc.joursAvantFinValidite;
  if (j == null) return { texte: `Valable jusqu'au ${fin}`, alerte: false };
  if (j < 0) return { texte: `Expiré depuis le ${fin}`, alerte: true };
  if (j === 0) return { texte: `Valable jusqu'à aujourd'hui`, alerte: true };
  return { texte: `Valable jusqu'au ${fin} (encore ${j} j)`, alerte: j <= 30 };
}

// ─── Consommation : réalisées / planifiées / disponibles ──────────────────────

export function ConsommationBC({ bc, compact = false }: { bc: BonCommandeAffiche; compact?: boolean }) {
  const realisees = bc.passagesConsommes ?? 0;
  const planifiees = bc.actif ? bc.operationsPlanifiees ?? 0 : 0;
  const sansBC = bc.actif ? bc.operationsNonCouvertes ?? 0 : 0;
  const quota = bc.quotaPassages;

  if (quota == null) {
    return (
      <p className="text-xs text-gray-600">
        {pl(realisees, 'réalisée')}{planifiees > 0 && ` · ${pl(planifiees, 'planifiée')}`}
        <span className="text-amber-700"> · quota non renseigné</span>
      </p>
    );
  }

  const depasse = realisees > quota;
  const disponibles = Math.max(0, quota - realisees - planifiees);
  const pct = (n: number) => `${Math.min(100, (n / quota) * 100)}%`;
  return (
    <div className="space-y-1">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100" title={`${realisees} réalisées, ${planifiees} planifiées, ${disponibles} disponibles sur ${quota}`}>
        <div className={depasse ? 'bg-red-500' : 'bg-slate-700'} style={{ width: pct(realisees) }} />
        <div className="bg-slate-300" style={{ width: pct(Math.min(planifiees, Math.max(0, quota - realisees))) }} />
      </div>
      <p className={cn('text-gray-600', compact ? 'text-[11px]' : 'text-xs')}>
        <span className="font-medium text-gray-900">{realisees}/{quota}</span> réalisées
        {!compact && planifiees > 0 && <> · {pl(planifiees, 'planifiée')}</>}
        {!compact && <> · {pl(disponibles, 'disponible')}</>}
        {sansBC > 0 && <span className="text-red-700"> · {sansBC} sans BC</span>}
      </p>
    </div>
  );
}

// ─── Création / modification d'un BC ──────────────────────────────────────────

interface BonCommandeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  contratId?: string | null;
  /** Sites du contrat proposés pour le périmètre */
  sites?: { id: string; nom: string }[];
  /** BC à modifier (création sinon) */
  bc?: BonCommandeAffiche | null;
}

const VIDE = { numero: '', quota: '', date: '', finValidite: '', seuil: '2', notes: '', siteIds: [] as string[] };

export function BonCommandeDialog({ open, onOpenChange, clientId, contratId, sites = [], bc }: BonCommandeDialogProps) {
  const queryClient = useQueryClient();
  const [f, setF] = useState(VIDE);

  useEffect(() => {
    if (!open) return;
    setF(bc
      ? {
          numero: bc.numero,
          quota: bc.quotaPassages != null ? String(bc.quotaPassages) : '',
          date: bc.date ? String(bc.date).slice(0, 10) : '',
          finValidite: bc.dateFinValidite ? String(bc.dateFinValidite).slice(0, 10) : '',
          seuil: String(bc.seuilAlerte ?? 2),
          notes: bc.notes ?? '',
          siteIds: (bc.sites ?? []).map((s) => s.siteId),
        }
      : VIDE);
  }, [open, bc]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        numero: f.numero.trim(),
        date: f.date || null,
        dateFinValidite: f.finValidite || null,
        quotaPassages: f.quota ? parseInt(f.quota) : null,
        seuilAlerte: f.seuil !== '' ? parseInt(f.seuil) : 2,
        notes: f.notes.trim() || undefined,
        siteIds: f.siteIds,
      };
      return bc
        ? bonCommandeApi.update(bc.id, { ...payload, notes: f.notes.trim() })
        : bonCommandeApi.create({ ...payload, clientId, contratId: contratId ?? undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrat'] });
      queryClient.invalidateQueries({ queryKey: ['bons-commandes'] });
      toast.success(bc ? 'Bon de commande mis à jour' : 'Bon de commande créé');
      onOpenChange(false);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement du BC'),
  });

  const set = (k: keyof typeof VIDE, v: any) => setF((p) => ({ ...p, [k]: v }));
  const basculerSite = (id: string) =>
    set('siteIds', f.siteIds.includes(id) ? f.siteIds.filter((s) => s !== id) : [...f.siteIds, id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{bc ? `Modifier le BC N° ${bc.numero}` : 'Nouveau bon de commande'}</DialogTitle>
          <DialogDescription>Les opérations réalisées sont décomptées automatiquement de ce BC.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Numéro du BC *</Label>
            <Input value={f.numero} onChange={(e) => set('numero', e.target.value)} placeholder="ex : 2026-042" className="h-9" autoFocus={!bc} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date de signature</Label>
            <Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valable jusqu'au</Label>
            <Input type="date" value={f.finValidite} onChange={(e) => set('finValidite', e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre d'opérations</Label>
            <Input type="number" min={1} value={f.quota} onChange={(e) => set('quota', e.target.value)} placeholder="ex : 12" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Alerter à … op. restantes</Label>
            <Input type="number" min={0} value={f.seuil} onChange={(e) => set('seuil', e.target.value)} className="h-9" />
          </div>

          {sites.length > 0 && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Sites couverts</Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => set('siteIds', [])}
                  className={cn('rounded border px-2 py-1 text-xs', f.siteIds.length === 0 ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
                >
                  Tout le contrat
                </button>
                {sites.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => basculerSite(s.id)}
                    className={cn('rounded border px-2 py-1 text-xs', f.siteIds.includes(s.id) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
                  >
                    {s.nom}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notes internes…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => mutation.mutate()} disabled={!f.numero.trim() || mutation.isPending}>
            {mutation.isPending ? 'Enregistrement…' : bc ? 'Enregistrer' : 'Créer le BC'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
