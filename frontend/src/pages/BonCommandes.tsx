import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { bonCommandeApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ShoppingCart, AlertTriangle, Plus, Pencil, Trash2, Building2, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NIVEAUX_BC, formatDateBC, type PrevisionBC } from '@/lib/bc';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BonCommande extends PrevisionBC {
  id: string;
  numero: string;
  client: { id: string; nomEntreprise: string };
  contrat?: { id: string; type: string } | null;
  date?: string | null;
  dateFinValidite?: string | null;
  quotaPassages: number | null;
  passagesConsommes: number;
  seuilAlerte: number;
  actif: boolean;
  notes: string | null;
  sites: { siteId: string; site: { id: string; nom: string } }[];
  interventions?: any[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatutChip(bc: BonCommande) {
  if (!bc.actif) return <Badge variant="secondary">Inactif</Badge>;
  if (bc.niveauAlerte) {
    const n = NIVEAUX_BC[bc.niveauAlerte];
    return <Badge className={n.badge}>{n.label}</Badge>;
  }
  return <Badge className="bg-green-600 text-white">Actif</Badge>;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function BonCommandesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filtres
  const [filterClient, setFilterClient] = useState('');
  const [filterActif, setFilterActif] = useState<'all' | 'actif' | 'inactif'>('actif');
  const [filterAlerte, setFilterAlerte] = useState(false);

  // Sélection
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));

  // Édition inline quota / notes / périmètre
  const [editingQuota, setEditingQuota] = useState(false);
  const [quotaDraft, setQuotaDraft] = useState<string>('');
  const [editingSeuil, setEditingSeuil] = useState(false);
  const [seuilDraft, setSeuilDraft] = useState('');
  const [editingFinValidite, setEditingFinValidite] = useState(false);
  const [finValiditeDraft, setFinValiditeDraft] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [editingPerimetre, setEditingPerimetre] = useState(false);
  const [perimetreDraft, setPerimetreDraft] = useState<string[]>([]);

  // Fetch liste
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['bons-commandes', filterActif, filterAlerte],
    queryFn: () =>
      bonCommandeApi.list({
        actif: filterActif === 'actif' ? true : filterActif === 'inactif' ? false : undefined,
        enAlerte: filterAlerte || undefined,
      }),
  });

  // Fetch détail BC sélectionné
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['bons-commandes', selectedId],
    queryFn: () => (selectedId ? bonCommandeApi.getOne(selectedId) : null),
    enabled: !!selectedId,
  });

  const bc = detailData?.bonCommande as BonCommande | undefined;

  // Mutation update
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      bonCommandeApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bons-commandes'] });
      setEditingQuota(false);
      setEditingSeuil(false);
      setEditingFinValidite(false);
      setEditingNotes(false);
      setEditingPerimetre(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour du BC');
    },
  });

  // Lorsqu'on sélectionne un BC, pré-remplir les drafts
  useEffect(() => {
    if (bc) {
      setQuotaDraft(bc.quotaPassages != null ? String(bc.quotaPassages) : '');
      setSeuilDraft(String(bc.seuilAlerte));
      setFinValiditeDraft(bc.dateFinValidite ? String(bc.dateFinValidite).slice(0, 10) : '');
      setEditingSeuil(false);
      setEditingFinValidite(false);
      setNotesDraft(bc.notes ?? '');
      setPerimetreDraft((bc.sites ?? []).map((s) => s.siteId));
      setEditingPerimetre(false);
    }
  }, [bc?.id]);

  // Filtrage client côté frontend
  const bcs: BonCommande[] = (listData?.bonsCommandes ?? []).filter((b: BonCommande) =>
    !filterClient || b.client.nomEntreprise.toLowerCase().includes(filterClient.toLowerCase())
  );

  const passagesRestants = bc?.passagesRestants ?? null;
  const progressPct = bc?.quotaPassages
    ? Math.min(100, Math.round((bc.passagesConsommes / bc.quotaPassages) * 100))
    : 0;

  return (
    <div className="flex h-full gap-0">
      {/* ─── Panel gauche : liste ─────────────────────────────────── */}
      <aside className="w-80 flex-shrink-0 border-r bg-white flex flex-col">
        <div className="p-4 border-b space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Bons de commande
          </h2>
          <Input
            placeholder="Filtrer par client..."
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            {(['all', 'actif', 'inactif'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterActif(v)}
                className={cn(
                  'text-xs px-2 py-1 rounded border',
                  filterActif === v ? 'bg-primary text-white border-primary' : 'border-gray-200 hover:bg-gray-50'
                )}
              >
                {v === 'all' ? 'Tous' : v === 'actif' ? 'Actifs' : 'Inactifs'}
              </button>
            ))}
            <button
              onClick={() => setFilterAlerte(!filterAlerte)}
              className={cn(
                'text-xs px-2 py-1 rounded border flex items-center gap-1',
                filterAlerte ? 'bg-yellow-500 text-white border-yellow-500' : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              En alerte
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {listLoading && <p className="p-4 text-sm text-muted-foreground">Chargement...</p>}
          {!listLoading && bcs.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Aucun bon de commande trouvé.</p>
          )}
          {bcs.map((b) => {
            const niveau = b.actif && b.niveauAlerte ? NIVEAUX_BC[b.niveauAlerte] : null;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors',
                  selectedId === b.id && 'bg-primary/5 border-l-4 border-l-primary'
                )}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium text-sm">BC-{b.numero}</span>
                  {niveau && (
                    <span className={cn('text-xs font-semibold', niveau.texte)}>{niveau.label}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{b.client.nomEntreprise}</p>
                <p className="text-xs text-muted-foreground">
                  {b.quotaPassages != null
                    ? `${b.passagesConsommes}/${b.quotaPassages} passages`
                    : 'Quota à renseigner'}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ─── Panel droit : détail ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {!selectedId && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
            <p>Sélectionnez un bon de commande</p>
          </div>
        )}

        {selectedId && detailLoading && (
          <p className="text-sm text-muted-foreground">Chargement du détail...</p>
        )}

        {bc && (
          <div className="space-y-6 max-w-3xl">
            {/* En-tête */}
            <div className="bg-white rounded-lg border p-5 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">BC-{bc.numero}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Building2 className="h-4 w-4" />
                  {bc.client.nomEntreprise}
                </p>
                {bc.date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Signé le {formatDateBC(bc.date)}
                  </p>
                )}
              </div>
              {getStatutChip(bc)}
            </div>

            {/* Alertes et prévision (information uniquement : rien n'est bloqué ni supprimé) */}
            {bc.actif && (bc.motifs?.length ?? 0) > 0 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <ul className="space-y-1 text-sm text-amber-900">
                  {bc.motifs!.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            )}

            {/* Quota & passages */}
            <div className="bg-white rounded-lg border p-5 space-y-4">
              <h2 className="font-semibold">Passages</h2>

              {bc.quotaPassages === null && (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">Quota à renseigner</p>
                    <p className="text-xs text-yellow-700">Ce BC n'a pas de quota défini. Renseignez-le ci-dessous.</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{bc.passagesConsommes}</p>
                  <p className="text-xs text-muted-foreground">consommés</p>
                </div>
                <div className="flex-1">
                  {bc.quotaPassages != null ? (
                    <>
                      <Progress value={progressPct} className="h-3" />
                      <p className="text-xs text-muted-foreground mt-1 text-right">{progressPct}% utilisé</p>
                    </>
                  ) : (
                    <div className="h-3 bg-gray-100 rounded-full" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {passagesRestants != null ? passagesRestants : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">restants</p>
                </div>
              </div>

              {bc.actif && bc.contrat && (
                <p className="text-xs text-muted-foreground">
                  {(bc.operationsPlanifiees ?? 0) + (bc.operationsNonCouvertes ?? 0)} opération(s) planifiée(s) imputable(s) à ce BC
                  {bc.dateEpuisementPrevue && ` — épuisement prévu le ${formatDateBC(bc.dateEpuisementPrevue)}`}
                  {(bc.operationsNonCouvertes ?? 0) > 0 && ` — ${bc.operationsNonCouvertes} sans BC disponible`}
                </p>
              )}

              {/* Quota éditable */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-32">Quota total</label>
                {editingQuota ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={quotaDraft}
                      onChange={(e) => setQuotaDraft(e.target.value)}
                      className="w-24 h-8 text-sm"
                      placeholder="ex: 12"
                    />
                    <Button
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          id: bc.id,
                          payload: { quotaPassages: quotaDraft ? parseInt(quotaDraft) : null },
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      Sauvegarder
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingQuota(false)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{bc.quotaPassages ?? '—'}</span>
                    <Button size="sm" variant="ghost" onClick={() => setEditingQuota(true)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-32">Seuil alerte</label>
                {editingSeuil ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={seuilDraft}
                      onChange={(e) => setSeuilDraft(e.target.value)}
                      className="w-24 h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: bc.id, payload: { seuilAlerte: parseInt(seuilDraft) } })}
                      disabled={updateMutation.isPending || seuilDraft === ''}
                    >
                      Sauvegarder
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingSeuil(false)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{bc.seuilAlerte} passage(s) restant(s)</span>
                    <Button size="sm" variant="ghost" onClick={() => setEditingSeuil(true)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-32">Valable jusqu'au</label>
                {editingFinValidite ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={finValiditeDraft}
                      onChange={(e) => setFinValiditeDraft(e.target.value)}
                      className="w-40 h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: bc.id, payload: { dateFinValidite: finValiditeDraft || null } })}
                      disabled={updateMutation.isPending}
                    >
                      Sauvegarder
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingFinValidite(false)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{bc.dateFinValidite ? formatDateBC(bc.dateFinValidite) : '—'}</span>
                    <Button size="sm" variant="ghost" onClick={() => setEditingFinValidite(true)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Sites couverts / périmètre */}
            <div className="bg-white rounded-lg border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Périmètre</h2>
                {!editingPerimetre && (
                  <Button size="sm" variant="ghost" onClick={() => setEditingPerimetre(true)}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Modifier
                  </Button>
                )}
              </div>

              {editingPerimetre ? (
                (() => {
                  const contratSites = (bc.contrat as any)?.contratSites ?? [];
                  if (contratSites.length === 0) {
                    return <p className="text-sm text-muted-foreground">Ce BC n'est pas lié à un contrat avec sites configurés.</p>;
                  }
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Sélectionnez les sites couverts par ce BC. Laissez tout vide pour qu'il s'applique à tous les sites du contrat.
                      </p>
                      <div className="space-y-1.5">
                        {contratSites.map((cs: any) => {
                          const checked = perimetreDraft.includes(cs.site.id);
                          return (
                            <label key={cs.site.id} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setPerimetreDraft((prev) =>
                                    checked ? prev.filter((id) => id !== cs.site.id) : [...prev, cs.site.id]
                                  )
                                }
                                className="rounded border-gray-300"
                              />
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {cs.site.nom}
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: bc.id, payload: { siteIds: perimetreDraft } })}
                          disabled={updateMutation.isPending}
                        >
                          Sauvegarder
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingPerimetre(false)}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <>
                  {(bc.sites ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {bc.contrat ? 'Tous les sites du contrat' : 'Aucun site lié à ce BC.'}
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {(bc.sites ?? []).map((s) => (
                        <li key={s.siteId} className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {s.site?.nom ?? s.siteId}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-lg border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Notes</h2>
                {!editingNotes && (
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(true)}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Modifier
                  </Button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    placeholder="Notes internes sur ce BC..."
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({ id: bc.id, payload: { notes: notesDraft || null } })
                      }
                      disabled={updateMutation.isPending}
                    >
                      Sauvegarder
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {bc.notes || 'Aucune note.'}
                </p>
              )}
            </div>

            {/* Interventions liées */}
            {bc.interventions && bc.interventions.length > 0 && (
              <div className="bg-white rounded-lg border p-5 space-y-3">
                <h2 className="font-semibold">Interventions liées ({bc.interventions.length})</h2>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {bc.interventions.map((i: any) => (
                    <div
                      key={i.id}
                      className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0"
                    >
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>{new Date(i.datePrevue).toLocaleDateString('fr-FR')}</span>
                      {i.site && (
                        <span className="text-muted-foreground truncate">{i.site.nom}</span>
                      )}
                      <Badge
                        variant={i.statut === 'REALISEE' ? 'default' : 'secondary'}
                        className="ml-auto"
                      >
                        {i.statut}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default BonCommandesPage;
