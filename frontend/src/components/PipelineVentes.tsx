import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { commerceApi } from '@/services/api';
import type { Commande, PipelineVenteStatut } from '@/types';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Search,
  Truck,
  Eye,
  EyeOff,
  Package,
  CheckCircle2,
  Clock,
  Banknote,
  ShoppingCart,
  AlertCircle,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

// ── Column config ──────────────────────────────────────────────────────────
interface ColumnDef {
  id: PipelineVenteStatut;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;       // bg color for header
  textColor: string;
  borderColor: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'VERIFICATION_STOCK',
    label: 'Vérification stock',
    description: 'Dispo à confirmer chez le fournisseur',
    icon: Search,
    color: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  {
    id: 'COMMANDE_FOURNISSEUR',
    label: 'Commande fournisseur',
    description: 'BC émis, en attente de réception',
    icon: ShoppingCart,
    color: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  {
    id: 'EN_TRANSIT',
    label: 'En transit',
    description: 'Réception / stockage / expédition',
    icon: Truck,
    color: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
  },
  {
    id: 'LIVRE',
    label: 'Livré client',
    description: 'Livraison effectuée',
    icon: Package,
    color: 'bg-teal-50',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-200',
  },
  {
    id: 'A_ENCAISSER',
    label: 'À encaisser',
    description: 'Facture émise, paiement attendu',
    icon: Banknote,
    color: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
  },
];

const PAYE_COL: ColumnDef = {
  id: 'PAYE',
  label: 'Payé',
  description: 'Transactions terminées',
  icon: CheckCircle2,
  color: 'bg-green-50',
  textColor: 'text-green-700',
  borderColor: 'border-green-200',
};

// ── Helpers ────────────────────────────────────────────────────────────────
const STATUT_FACTURE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  PAYEE:                   { bg: 'bg-green-100', text: 'text-green-700',  label: 'Payée' },
  EN_ATTENTE_ENCAISSEMENT: { bg: 'bg-blue-100',  text: 'text-blue-700',   label: 'Encaissement' },
  PARTIELLEMENT_PAYEE:     { bg: 'bg-amber-100', text: 'text-amber-700',  label: 'Part. payée' },
  EN_RETARD:               { bg: 'bg-red-100',   text: 'text-red-700',    label: 'En retard' },
  VALIDEE:                 { bg: 'bg-gray-100',  text: 'text-gray-600',   label: 'Validée' },
  BROUILLON:               { bg: 'bg-gray-100',  text: 'text-gray-500',   label: 'Brouillon' },
};

function formatMontant(n: number, devise = 'DZD') {
  return new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' ' + devise;
}

function isRetard(c: Commande) {
  return c.dateLivraisonSouhaitee &&
    isPast(parseISO(c.dateLivraisonSouhaitee)) &&
    !isToday(parseISO(c.dateLivraisonSouhaitee)) &&
    c.pipelineStatut !== 'LIVRE' &&
    c.pipelineStatut !== 'PAYE';
}

// ── Draggable card ─────────────────────────────────────────────────────────
function KanbanCard({
  commande,
  onOpen,
  dragging = false,
}: {
  commande: Commande;
  onOpen: (c: Commande) => void;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: commande.id });
  const retard = isRetard(commande);
  const factureStatut = commande.factures?.[0]?.statut;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      className={cn(
        'bg-white rounded-xl border shadow-sm p-3 cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md',
        retard && 'border-red-200',
        dragging && 'shadow-xl ring-2 ring-primary/20 rotate-1'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-mono text-gray-400 truncate">{commande.ref}</p>
          <p className="text-sm font-semibold text-gray-900 truncate leading-snug mt-0.5">
            {commande.client?.nomEntreprise || '—'}
          </p>
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpen(commande); }}
          className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Voir détails"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lignes */}
      {commande.lignes && commande.lignes.length > 0 && (
        <div className="mb-2 space-y-0.5">
          {commande.lignes.slice(0, 2).map((l) => (
            <p key={l.id} className="text-xs text-gray-500 truncate">
              • {l.libelle} {l.quantite > 1 ? `(×${l.quantite})` : ''}
            </p>
          ))}
          {commande.lignes.length > 2 && (
            <p className="text-xs text-gray-400">+{commande.lignes.length - 2} article{commande.lignes.length - 2 > 1 ? 's' : ''}</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-50">
        <span className="text-sm font-bold text-gray-900">{formatMontant(commande.totalTTC, commande.devise)}</span>
        <div className="flex items-center gap-1.5">
          {commande.livraisonDirect && (
            <span title="Livraison directe fournisseur → client">
              <Truck className="w-3 h-3 text-purple-500" />
            </span>
          )}
          {retard && (
            <span className="flex items-center gap-0.5 text-red-500 text-xs font-semibold">
              <AlertCircle className="w-3 h-3" />
              Retard
            </span>
          )}
          {factureStatut && STATUT_FACTURE_BADGE[factureStatut] && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full font-medium',
              STATUT_FACTURE_BADGE[factureStatut].bg,
              STATUT_FACTURE_BADGE[factureStatut].text
            )}>
              {STATUT_FACTURE_BADGE[factureStatut].label}
            </span>
          )}
        </div>
      </div>

      {/* Date livraison souhaitée */}
      {commande.dateLivraisonSouhaitee && (
        <p className={cn('text-xs mt-1.5 flex items-center gap-1', retard ? 'text-red-500 font-medium' : 'text-gray-400')}>
          <Clock className="w-3 h-3" />
          Livr. souh. {format(parseISO(commande.dateLivraisonSouhaitee), 'd MMM', { locale: fr })}
        </p>
      )}
    </div>
  );
}

// ── Droppable column ───────────────────────────────────────────────────────
function KanbanColumn({
  col,
  commandes,
  onOpen,
  isOver,
}: {
  col: ColumnDef;
  commandes: Commande[];
  onOpen: (c: Commande) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: col.id });
  const Icon = col.icon;
  const totalTTC = commandes.reduce((s, c) => s + c.totalTTC, 0);

  return (
    <div className="flex flex-col min-w-[220px] w-64 shrink-0">
      {/* Column header */}
      <div className={cn('rounded-t-xl border px-3 py-2.5', col.color, col.borderColor)}>
        <div className="flex items-center gap-2">
          <Icon className={cn('w-4 h-4 shrink-0', col.textColor)} />
          <span className={cn('text-xs font-bold uppercase tracking-wide', col.textColor)}>{col.label}</span>
          <span className={cn('ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/70', col.textColor)}>
            {commandes.length}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{col.description}</p>
        {commandes.length > 0 && (
          <p className={cn('text-xs font-semibold mt-1', col.textColor)}>
            {formatMontant(totalTTC)}
          </p>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-b-xl border-x border-b p-2 space-y-2 min-h-[120px] transition-colors',
          col.borderColor,
          isOver ? 'bg-primary/5' : 'bg-gray-50/60'
        )}
      >
        {commandes.length === 0 && !isOver && (
          <p className="text-xs text-gray-300 text-center py-6">Déposer ici</p>
        )}
        {commandes.map((c) => (
          <KanbanCard key={c.id} commande={c} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

// ── Detail Sheet ───────────────────────────────────────────────────────────
function CommandeSheet({
  commande,
  onClose,
  onRemoveFromPipeline,
}: {
  commande: Commande | null;
  onClose: () => void;
  onRemoveFromPipeline: (id: string) => void;
}) {
  if (!commande) return null;
  const col = [...COLUMNS, PAYE_COL].find((c) => c.id === commande.pipelineStatut);
  const retard = isRetard(commande);

  return (
    <Sheet open={!!commande} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base font-mono text-gray-500">{commande.ref}</SheetTitle>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{commande.client?.nomEntreprise}</p>
            </div>
            {col && (
              <span className={cn('text-xs font-bold px-2 py-1 rounded-full', col.color, col.textColor)}>
                {col.label}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {retard && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Date de livraison souhaitée dépassée
            </div>
          )}

          {/* Montants */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total HT</span>
              <span className="font-medium">{formatMontant(commande.totalHT, commande.devise)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">TVA</span>
              <span className="font-medium">{formatMontant(commande.totalTVA, commande.devise)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-base font-bold">
              <span>Total TTC</span>
              <span className="text-primary">{formatMontant(commande.totalTTC, commande.devise)}</span>
            </div>
          </div>

          {/* Infos */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Date commande</span>
              <span>{format(parseISO(commande.dateCommande), 'd MMM yyyy', { locale: fr })}</span>
            </div>
            {commande.dateLivraisonSouhaitee && (
              <div className="flex justify-between">
                <span className="text-gray-500">Livraison souhaitée</span>
                <span className={retard ? 'text-red-600 font-semibold' : ''}>
                  {format(parseISO(commande.dateLivraisonSouhaitee), 'd MMM yyyy', { locale: fr })}
                </span>
              </div>
            )}
            {commande.site && (
              <div className="flex justify-between">
                <span className="text-gray-500">Site</span>
                <span>{commande.site.nom}{commande.site.ville ? ` · ${commande.site.ville}` : ''}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Livraison directe</span>
              <span>{commande.livraisonDirect ? 'Fournisseur → Client' : 'Via entrepôt'}</span>
            </div>
          </div>

          {/* Articles */}
          {commande.lignes && commande.lignes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Articles</p>
              <div className="space-y-1">
                {commande.lignes.map((l) => (
                  <div key={l.id} className="flex justify-between text-sm py-1 border-b border-gray-50">
                    <span className="text-gray-700 truncate flex-1">{l.libelle}</span>
                    <span className="text-gray-500 ml-2 shrink-0">×{l.quantite}{l.unite ? ` ${l.unite}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bons de livraison */}
          {commande.bonsLivraison && commande.bonsLivraison.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bons de livraison</p>
              {commande.bonsLivraison.map((bl) => (
                <div key={bl.id} className="flex justify-between text-sm py-1">
                  <span className="font-mono text-gray-600">{bl.ref}</span>
                  <span className="text-gray-500">{bl.statut}</span>
                </div>
              ))}
            </div>
          )}

          {/* Factures */}
          {commande.factures && commande.factures.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Factures</p>
              {commande.factures.map((f) => (
                <div key={f.id} className="flex justify-between text-sm py-1">
                  <span className="font-mono text-gray-600">{f.ref}</span>
                  <div className="flex items-center gap-2">
                    {STATUT_FACTURE_BADGE[f.statut] && (
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', STATUT_FACTURE_BADGE[f.statut].bg, STATUT_FACTURE_BADGE[f.statut].text)}>
                        {STATUT_FACTURE_BADGE[f.statut].label}
                      </span>
                    )}
                    <span className="font-semibold">{formatMontant(f.totalTTC)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {commande.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{commande.notes}</p>
            </div>
          )}

          <Separator />

          <button
            type="button"
            onClick={() => { onRemoveFromPipeline(commande.id); onClose(); }}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-red-500 py-2 transition-colors"
          >
            <X className="w-4 h-4" />
            Retirer du pipeline
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Add to Pipeline panel ──────────────────────────────────────────────────
function AddCommandePanel({
  onAdd,
}: {
  onAdd: (commandeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data } = useQuery({
    queryKey: ['commerce', 'commandes'],
    queryFn: () => commerceApi.listCommandes({ limit: 200, statut: 'VALIDEE' }),
    enabled: open,
  });
  const { data: pipelineData } = useQuery({
    queryKey: ['commerce', 'pipeline'],
    queryFn: () => commerceApi.getPipelineVentes(),
  });
  const pipelineIds = new Set(pipelineData?.map((c) => c.id) ?? []);
  const available = (data?.commandes ?? []).filter(
    (c) => !pipelineIds.has(c.id) &&
      (c.ref.toLowerCase().includes(search.toLowerCase()) || c.client?.nomEntreprise?.toLowerCase().includes(search.toLowerCase()))
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-primary hover:text-primary text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        Ajouter une commande
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border shadow-lg p-4 w-72 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Ajouter au pipeline</p>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <input
        autoFocus
        type="text"
        placeholder="Rechercher une commande..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="max-h-64 overflow-y-auto space-y-1">
        {available.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Aucune commande validée disponible</p>
        )}
        {available.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { onAdd(c.id); setOpen(false); setSearch(''); }}
            className="w-full text-left rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
          >
            <p className="text-xs font-mono text-gray-400">{c.ref}</p>
            <p className="text-sm font-medium text-gray-800">{c.client?.nomEntreprise}</p>
            <p className="text-xs text-gray-500">{formatMontant(c.totalTTC, c.devise)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function PipelineVentes() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId]         = useState<string | null>(null);
  const [overId, setOverId]             = useState<PipelineVenteStatut | null>(null);
  const [showPaye, setShowPaye]         = useState(false);
  const [viewingCommande, setViewing]   = useState<Commande | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const { data: commandes = [], isLoading } = useQuery({
    queryKey: ['commerce', 'pipeline'],
    queryFn: () => commerceApi.getPipelineVentes(),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: PipelineVenteStatut }) =>
      commerceApi.updatePipelineStatut(id, statut),
    onMutate: async ({ id, statut }) => {
      await queryClient.cancelQueries({ queryKey: ['commerce', 'pipeline'] });
      const prev = queryClient.getQueryData<Commande[]>(['commerce', 'pipeline']);
      queryClient.setQueryData<Commande[]>(['commerce', 'pipeline'], (old) =>
        old ? old.map((c) => (c.id === id ? { ...c, pipelineStatut: statut } : c)) : old
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['commerce', 'pipeline'], ctx?.prev);
      toast.error('Erreur lors du déplacement');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['commerce', 'pipeline'] }),
  });

  const addMutation = useMutation({
    mutationFn: (id: string) => commerceApi.addCommandeToPipeline(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['commerce', 'pipeline'] }); toast.success('Commande ajoutée au pipeline'); },
    onError: () => toast.error('Erreur lors de l\'ajout'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => commerceApi.removeCommandeFromPipeline(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['commerce', 'pipeline'] }); toast.success('Commande retirée du pipeline'); },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const handleDragStart = useCallback((e: DragStartEvent) => setActiveId(String(e.active.id)), []);
  const handleDragOver  = useCallback((e: any) => setOverId(e.over?.id ?? null), []);
  const handleDragEnd   = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    setOverId(null);
    if (!over || active.id === over.id) return;
    const newStatut = over.id as PipelineVenteStatut;
    moveMutation.mutate({ id: String(active.id), statut: newStatut });
  }, [moveMutation]);

  const activeDragging = commandes.find((c) => c.id === activeId);

  const cols = showPaye ? [...COLUMNS, PAYE_COL] : COLUMNS;

  // Stats
  const total     = commandes.filter((c) => c.pipelineStatut !== 'PAYE').length;
  const totalTTC  = commandes.filter((c) => c.pipelineStatut !== 'PAYE').reduce((s, c) => s + c.totalTTC, 0);
  const retards   = commandes.filter(isRetard).length;
  const payees    = commandes.filter((c) => c.pipelineStatut === 'PAYE').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-primary rounded-full animate-spin mr-3" />
        Chargement du pipeline…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-gray-700">{total} commande{total > 1 ? 's' : ''} en cours</span>
          {total > 0 && <span className="text-gray-400">·</span>}
          {total > 0 && <span className="text-gray-600 font-medium">{formatMontant(totalTTC)}</span>}
          {retards > 0 && (
            <>
              <span className="text-gray-400">·</span>
              <span className="text-red-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {retards} en retard
              </span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPaye((v) => !v)}
            className="text-gray-500 gap-1.5"
          >
            {showPaye ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPaye ? 'Masquer payés' : `Payés (${payees})`}
          </Button>
        </div>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 items-start">
          {cols.map((col) => (
            <KanbanColumn
              key={col.id}
              col={col}
              commandes={commandes.filter((c) => c.pipelineStatut === col.id)}
              onOpen={setViewing}
              isOver={overId === col.id}
            />
          ))}

          {/* Add panel */}
          <div className="shrink-0 pt-0">
            <AddCommandePanel onAdd={(id) => addMutation.mutate(id)} />
          </div>
        </div>

        <DragOverlay>
          {activeDragging && (
            <KanbanCard commande={activeDragging} onOpen={() => {}} dragging />
          )}
        </DragOverlay>
      </DndContext>

      {/* Detail sheet */}
      <CommandeSheet
        commande={viewingCommande}
        onClose={() => setViewing(null)}
        onRemoveFromPipeline={(id) => removeMutation.mutate(id)}
      />
    </div>
  );
}
