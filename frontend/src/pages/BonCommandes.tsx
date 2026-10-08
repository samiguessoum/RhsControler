import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { bonCommandeApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, AlertTriangle, Pencil, Building2, FileText } from 'lucide-react';
import { cn, getStatutLabel } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDateBC } from '@/lib/bc';
import { BonCommandeDialog, ConsommationBC, StatutBC, pl, validiteBC, type BonCommandeAffiche } from '@/components/BonCommande';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BonCommande extends BonCommandeAffiche {
  client: { id: string; nomEntreprise: string };
  contrat?: {
    id: string;
    type: string;
    refExterne?: string | null;
    nom?: string | null;
    contratSites?: { site: { id: string; nom: string } }[];
  } | null;
  sites: { siteId: string; site: { id: string; nom: string } }[];
  interventions?: any[];
}

const libelleContrat = (c: NonNullable<BonCommande['contrat']>) =>
  c.refExterne || c.nom || `Contrat ${c.type === 'PONCTUEL' ? 'ponctuel' : 'annuel'}`;

function Chiffre({ valeur, label, ton }: { valeur: React.ReactNode; label: string; ton?: string }) {
  return (
    <div>
      <p className={cn('text-2xl font-semibold tabular-nums text-gray-900', ton)}>{valeur}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{children}</dd>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function BonCommandesPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Filtres
  const [filterClient, setFilterClient] = useState('');
  const [filterActif, setFilterActif] = useState<'all' | 'actif' | 'inactif'>('actif');
  const [filterAlerte, setFilterAlerte] = useState(false);

  // Sélection (suit le lien ?id=… même si la page est déjà ouverte)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) setSelectedId(id);
  }, [searchParams]);

  const [showEdit, setShowEdit] = useState(false);

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['bons-commandes', filterActif, filterAlerte],
    queryFn: () =>
      bonCommandeApi.list({
        actif: filterActif === 'actif' ? true : filterActif === 'inactif' ? false : undefined,
        enAlerte: filterAlerte || undefined,
      }),
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['bons-commandes', selectedId],
    queryFn: () => (selectedId ? bonCommandeApi.getOne(selectedId) : null),
    enabled: !!selectedId,
  });
  const bc = detailData?.bonCommande as BonCommande | undefined;

  const actifMutation = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) =>
      actif ? bonCommandeApi.update(id, { actif: true }) : bonCommandeApi.delete(id),
    onSuccess: (_, { actif }) => {
      queryClient.invalidateQueries({ queryKey: ['bons-commandes'] });
      queryClient.invalidateQueries({ queryKey: ['contrat'] });
      toast.success(actif ? 'Bon de commande réactivé' : 'Bon de commande désactivé');
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour du BC'),
  });

  const bcs: BonCommande[] = (listData?.bonsCommandes ?? []).filter((b: BonCommande) =>
    !filterClient || b.client.nomEntreprise.toLowerCase().includes(filterClient.toLowerCase())
  );

  const planifiees = bc?.actif ? bc.operationsPlanifiees ?? 0 : 0;
  const disponibles = bc?.quotaPassages != null ? Math.max(0, bc.quotaPassages - bc.passagesConsommes - planifiees) : null;
  const validite = bc ? validiteBC(bc) : null;
  const avenant = bc?.avenants?.[0];

  return (
    <div className="flex h-full gap-0">
      {/* ─── Liste ─────────────────────────────────────────────────── */}
      <aside className="w-80 flex-shrink-0 border-r bg-white flex flex-col">
        <div className="p-4 border-b space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Bons de commande
          </h2>
          <Input placeholder="Filtrer par client…" value={filterClient} onChange={(e) => setFilterClient(e.target.value)} />
          <div className="flex gap-1.5 flex-wrap">
            {(['actif', 'inactif', 'all'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterActif(v)}
                className={cn(
                  'text-xs px-2 py-1 rounded border',
                  filterActif === v ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {v === 'all' ? 'Tous' : v === 'actif' ? 'Actifs' : 'Désactivés'}
              </button>
            ))}
            <button
              onClick={() => setFilterAlerte(!filterAlerte)}
              className={cn(
                'text-xs px-2 py-1 rounded border flex items-center gap-1',
                filterAlerte ? 'bg-amber-50 text-amber-800 border-amber-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              En alerte
            </button>
          </div>
          {!listLoading && <p className="text-xs text-gray-400">{pl(bcs.length, 'bon')} de commande</p>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {listLoading && <p className="p-4 text-sm text-muted-foreground">Chargement…</p>}
          {!listLoading && bcs.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucun bon de commande trouvé.</p>}
          {bcs.map((b) => {
            const v = validiteBC(b);
            return (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-l-2 border-l-transparent hover:bg-gray-50 transition-colors space-y-1',
                  selectedId === b.id && 'bg-gray-50 border-l-gray-900'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 truncate">N° {b.numero}</span>
                  <StatutBC bc={b} />
                </div>
                <p className="text-xs text-gray-600 truncate">
                  {b.client.nomEntreprise}
                  {b.contrat && <span className="text-gray-400"> · {libelleContrat(b.contrat)}</span>}
                  {b.avenants?.[0] && <span className="text-gray-400"> · Av. n°{b.avenants[0].numero}</span>}
                </p>
                <ConsommationBC bc={b} compact />
                {v && <p className={cn('text-[11px]', v.alerte ? 'text-orange-700' : 'text-gray-400')}>{v.texte}</p>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ─── Détail ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {!selectedId && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
            <p>Sélectionnez un bon de commande</p>
          </div>
        )}
        {selectedId && detailLoading && <p className="text-sm text-muted-foreground">Chargement du détail…</p>}

        {bc && (
          <div className="space-y-4 max-w-3xl">
            {/* En-tête */}
            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold text-gray-900">BC N° {bc.numero}</h1>
                    <StatutBC bc={bc} />
                  </div>
                  <p className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    {bc.client.nomEntreprise}
                  </p>
                  {bc.contrat && (
                    <p className="text-sm text-gray-600 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <Link to={`/contrats/${bc.contrat.id}`} className="underline-offset-2 hover:underline">
                        {libelleContrat(bc.contrat)}
                      </Link>
                      {avenant && <span className="text-gray-500">· réservé à l'avenant n°{avenant.numero}{avenant.nom ? ` (${avenant.nom})` : ''}</span>}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowEdit(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={bc.actif ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : ''}
                    disabled={actifMutation.isPending}
                    onClick={() => {
                      if (bc.actif && !window.confirm('Désactiver ce BC ? Les passages non réalisés en seront détachés.')) return;
                      actifMutation.mutate({ id: bc.id, actif: !bc.actif });
                    }}
                  >
                    {bc.actif ? 'Désactiver' : 'Réactiver'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Alertes (informatives : rien n'est bloqué) */}
            {bc.actif && (bc.motifs?.length ?? 0) > 0 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <ul className="space-y-0.5 text-sm text-amber-900">
                  {bc.motifs!.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            )}

            {/* Consommation */}
            <div className="bg-white rounded-lg border p-5 space-y-4">
              <h2 className="font-semibold text-gray-900">Consommation</h2>
              <div className="grid grid-cols-4 gap-4">
                <Chiffre valeur={bc.passagesConsommes} label="réalisées" ton={bc.quotaPassages != null && bc.passagesConsommes > bc.quotaPassages ? 'text-red-700' : undefined} />
                <Chiffre valeur={planifiees} label="planifiées" />
                <Chiffre valeur={disponibles ?? '—'} label="disponibles" />
                <Chiffre valeur={bc.quotaPassages ?? '—'} label="quota" ton={bc.quotaPassages == null ? 'text-amber-700' : undefined} />
              </div>
              <ConsommationBC bc={bc} />
              {(bc.dateEpuisementPrevue || (bc.operationsNonCouvertes ?? 0) > 0) && (
                <p className="text-sm text-gray-600">
                  {bc.dateEpuisementPrevue && <>Épuisement prévu le <span className="font-medium text-gray-900">{formatDateBC(bc.dateEpuisementPrevue)}</span>. </>}
                  {(bc.operationsNonCouvertes ?? 0) > 0 && (
                    <span className="text-red-700">
                      {pl(bc.operationsNonCouvertes!, 'opération')} planifiée{bc.operationsNonCouvertes! > 1 ? 's' : ''} au-delà du quota : nouveau BC à demander.
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Informations */}
            <div className="bg-white rounded-lg border px-5 py-3">
              <dl className="divide-y">
                <Info label="Signé le">{bc.date ? formatDateBC(bc.date) : <span className="text-gray-400">Non renseigné</span>}</Info>
                <Info label="Validité">
                  {validite ? <span className={cn(validite.alerte && 'text-orange-700')}>{validite.texte}</span> : <span className="text-gray-400">Sans date de fin</span>}
                </Info>
                <Info label="Sites couverts">{bc.sites.length ? bc.sites.map((s) => s.site.nom).join(', ') : 'Tout le contrat'}</Info>
                <Info label="Alerte">À {pl(bc.seuilAlerte, 'opération')} restante{bc.seuilAlerte > 1 ? 's' : ''}</Info>
                <Info label="Notes">
                  {bc.notes ? <span className="whitespace-pre-line">{bc.notes}</span> : <span className="text-gray-400">Aucune</span>}
                </Info>
              </dl>
            </div>

            {/* Passages imputés */}
            {bc.interventions && bc.interventions.length > 0 && (
              <div className="bg-white rounded-lg border">
                <h2 className="font-semibold text-gray-900 px-5 pt-4 pb-2">
                  Passages imputés <span className="font-normal text-gray-400">({bc.interventions.length}{bc.interventions.length >= 50 ? ' derniers' : ''})</span>
                </h2>
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                      <tr className="border-y">
                        <th className="px-5 py-2 text-left font-medium">Date</th>
                        <th className="px-2 py-2 text-left font-medium">Nature</th>
                        <th className="px-2 py-2 text-left font-medium">Site</th>
                        <th className="px-2 py-2 text-left font-medium">Prestation</th>
                        <th className="px-5 py-2 text-right font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bc.interventions.map((i: any) => (
                        <tr key={i.id}>
                          <td className="px-5 py-2 tabular-nums">{formatDateBC(i.dateRealisee ?? i.datePrevue)}</td>
                          <td className="px-2 py-2">{i.type === 'OPERATION' ? 'Opération' : i.type === 'CONTROLE' ? 'Visite de contrôle' : i.type}</td>
                          <td className="px-2 py-2 text-gray-600">{i.site?.nom ?? '—'}</td>
                          <td className="px-2 py-2 text-gray-600">{i.prestation ?? '—'}</td>
                          <td className={cn('px-5 py-2 text-right', i.statut === 'REALISEE' ? 'text-green-700' : 'text-gray-500')}>{getStatutLabel(i.statut)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <BonCommandeDialog
              open={showEdit}
              onOpenChange={setShowEdit}
              clientId={bc.client.id}
              contratId={bc.contrat?.id}
              sites={(bc.contrat?.contratSites ?? []).map((cs) => ({ id: cs.site.id, nom: cs.site.nom }))}
              bc={bc}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default BonCommandesPage;
