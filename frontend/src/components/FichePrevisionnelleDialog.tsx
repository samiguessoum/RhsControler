import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, Download, Loader2, Printer, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { contratsApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import type { Contrat, FichePrevisionnelleOptions } from '@/types';

// Même texte que le backend (OBSERVATIONS_DEFAUT)
const OBSERVATIONS_DEFAUT =
  'Les dates indiquées sont communiquées à titre prévisionnel et peuvent être ajustées en fonction des contraintes '
  + 'd\'exploitation et des conditions d\'intervention. Le client sera informé avant chaque passage.';

function optionsInitiales(contrat: Contrat): FichePrevisionnelleOptions {
  const avecControles = contrat.interventions?.some((iv) => iv.type === 'CONTROLE') ?? false;
  return {
    contenu: avecControles ? 'OPERATIONS_CONTROLES' : 'OPERATIONS',
    periode: 'A_VENIR',
    dateDebut: null,
    dateFin: null,
    precision: 'JOUR',
    siteIds: [],
    presentation: 'SITE',
    afficherPrestations: true,
    afficherBC: false,
    inclureAvenants: true,
    afficherRealises: false,
    afficherPrix: false,
    bonPourAccord: false,
    titre: '',
    libelleOperation: '',
    libelleControle: '',
    observations: OBSERVATIONS_DEFAUT,
    ...(contrat.fichePrevisionnelleOptions ?? {}),
  };
}

function Segmented<T extends string>({ value, onChange, choix }: {
  value: T;
  onChange: (v: T) => void;
  choix: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-0.5">
      {choix.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
            value === c.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{titre}</p>
      {children}
    </div>
  );
}

export function FichePrevisionnelleDialog({ contrat, open, onOpenChange }: {
  contrat: Contrat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { canDo } = useAuthStore();
  const queryClient = useQueryClient();
  const [options, setOptions] = useState<FichePrevisionnelleOptions>(() => optionsInitiales(contrat));
  const [apercuUrl, setApercuUrl] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [telechargement, setTelechargement] = useState(false);
  const [personnaliser, setPersonnaliser] = useState(false);
  const requete = useRef(0);

  const sites = useMemo(
    () => (contrat.contratSites ?? []).map((cs) => ({ id: cs.siteId, nom: cs.site?.nom ?? 'Site' })),
    [contrat.contratSites]
  );
  const set = <K extends keyof FichePrevisionnelleOptions>(k: K, v: FichePrevisionnelleOptions[K]) =>
    setOptions((o) => ({ ...o, [k]: v }));

  // Réglages repris à chaque ouverture (mémorisés sur le contrat)
  useEffect(() => {
    if (open) setOptions(optionsInitiales(contrat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Aperçu en direct : régénéré peu après chaque changement de réglage
  useEffect(() => {
    if (!open) return;
    const n = ++requete.current;
    setChargement(true);
    const t = setTimeout(async () => {
      try {
        const blob = await contratsApi.fichePrevisionnelle(contrat.id, options);
        if (n !== requete.current) return;
        setApercuUrl((ancien) => {
          if (ancien) URL.revokeObjectURL(ancien);
          return URL.createObjectURL(blob);
        });
      } catch {
        if (n === requete.current) toast.error('Impossible de générer l\'aperçu');
      } finally {
        if (n === requete.current) setChargement(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [open, options, contrat.id]);

  useEffect(() => () => { if (apercuUrl) URL.revokeObjectURL(apercuUrl); }, [apercuUrl]);

  const periodeIncomplete = options.periode === 'PERSONNALISEE' && (!options.dateDebut || !options.dateFin);

  const telecharger = async () => {
    setTelechargement(true);
    try {
      const blob = await contratsApi.fichePrevisionnelle(contrat.id, options, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const client = (contrat.client?.nomEntreprise ?? 'client').replace(/[^\p{L}\p{N}]+/gu, '-');
      a.href = url;
      a.download = `Fiche-previsionnelle-${client}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ['contrat', contrat.id] });
      toast.success('Fiche prévisionnelle téléchargée');
    } catch {
      toast.error('Erreur lors de la génération de la fiche');
    } finally {
      setTelechargement(false);
    }
  };

  const toutSites = options.siteIds.length === 0;
  const basculerSite = (id: string) => {
    const actuels = toutSites ? sites.map((s) => s.id) : options.siteIds;
    const suivants = actuels.includes(id) ? actuels.filter((s) => s !== id) : [...actuels, id];
    if (!suivants.length) return; // au moins un site
    set('siteIds', suivants.length === sites.length ? [] : suivants);
  };

  const affichage: Array<{ cle: keyof FichePrevisionnelleOptions; label: string; visible?: boolean }> = [
    { cle: 'afficherPrestations', label: 'Prestations' },
    { cle: 'afficherBC', label: 'N° de bons de commande' },
    { cle: 'inclureAvenants', label: 'Passages des avenants', visible: !!contrat.avenants?.length || !!contrat._count?.avenants },
    { cle: 'afficherRealises', label: 'Passages déjà réalisés' },
    { cle: 'afficherPrix', label: 'Prix (HT)', visible: canDo('viewFacturation') },
    { cle: 'bonPourAccord', label: 'Zone « Bon pour accord »' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-6xl h-[92vh] max-h-[92vh] p-0 gap-0 overflow-hidden grid-rows-[auto_1fr_auto]"
      >
        <div className="px-5 py-4 border-b">
          <DialogTitle className="text-base">Fiche prévisionnelle</DialogTitle>
          <DialogDescription className="text-xs">
            Planning des passages à transmettre au client · {contrat.client?.nomEntreprise}
          </DialogDescription>
        </div>

        <div className="grid min-h-0 lg:grid-cols-[340px_1fr]">
          {/* Réglages */}
          <div className="min-h-0 overflow-y-auto border-b lg:border-b-0 lg:border-r p-5 space-y-5">
            <Section titre="Contenu">
              <Segmented
                value={options.contenu}
                onChange={(v) => set('contenu', v)}
                choix={[
                  { value: 'OPERATIONS', label: 'Opérations' },
                  { value: 'OPERATIONS_CONTROLES', label: 'Opérations + contrôles' },
                ]}
              />
            </Section>

            <Section titre="Période">
              <Segmented
                value={options.periode}
                onChange={(v) => set('periode', v)}
                choix={[
                  { value: 'A_VENIR', label: 'À venir' },
                  { value: 'CONVENTION', label: 'Convention' },
                  { value: 'PERSONNALISEE', label: 'Personnalisée' },
                ]}
              />
              {options.periode === 'PERSONNALISEE' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Input type="date" className="h-8 text-xs" value={options.dateDebut ?? ''} onChange={(e) => set('dateDebut', e.target.value || null)} />
                  <Input type="date" className="h-8 text-xs" value={options.dateFin ?? ''} onChange={(e) => set('dateFin', e.target.value || null)} />
                </div>
              )}
            </Section>

            <Section titre="Dates affichées">
              <Segmented
                value={options.precision}
                onChange={(v) => set('precision', v)}
                choix={[
                  { value: 'JOUR', label: 'Jour exact' },
                  { value: 'SEMAINE', label: 'Semaine' },
                  { value: 'MOIS', label: 'Mois' },
                ]}
              />
            </Section>

            {sites.length > 1 && (
              <Section titre="Sites">
                <div className="flex flex-wrap gap-1.5">
                  {sites.map((s) => {
                    const actif = toutSites || options.siteIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => basculerSite(s.id)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          actif ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400 hover:text-gray-600'
                        )}
                      >
                        {s.nom}
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            <Section titre="Présentation">
              <Segmented
                value={options.presentation}
                onChange={(v) => set('presentation', v)}
                choix={[
                  { value: 'SITE', label: 'Par site' },
                  { value: 'CHRONO', label: 'Par mois' },
                ]}
              />
            </Section>

            <Section titre="Afficher">
              <div className="space-y-2">
                {affichage.filter((a) => a.visible !== false).map((a) => (
                  <label key={a.cle} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={!!options[a.cle]} onCheckedChange={(v) => set(a.cle, (v === true) as never)} />
                    {a.label}
                  </label>
                ))}
              </div>
            </Section>

            <div className="border-t pt-3">
              <button
                type="button"
                onClick={() => setPersonnaliser((p) => !p)}
                className="flex w-full items-center justify-between text-sm font-medium text-gray-700"
              >
                Personnaliser les textes
                <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', personnaliser && 'rotate-180')} />
              </button>
              {personnaliser && (
                <div className="space-y-3 pt-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Titre du document</Label>
                    <Input className="h-8 text-sm" placeholder="Planning prévisionnel des interventions" value={options.titre} onChange={(e) => set('titre', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nom des opérations</Label>
                      <Input className="h-8 text-sm" placeholder="Opération" value={options.libelleOperation} onChange={(e) => set('libelleOperation', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nom des contrôles</Label>
                      <Input className="h-8 text-sm" placeholder="Visite de contrôle" value={options.libelleControle} onChange={(e) => set('libelleControle', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Observations</Label>
                      {options.observations !== OBSERVATIONS_DEFAUT && (
                        <button type="button" className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline" onClick={() => set('observations', OBSERVATIONS_DEFAUT)}>
                          <RotateCcw className="h-3 w-3" /> Texte par défaut
                        </button>
                      )}
                    </div>
                    <Textarea rows={4} className="text-sm" value={options.observations ?? ''} onChange={(e) => set('observations', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Aperçu */}
          <div className="relative hidden lg:block min-h-0 bg-gray-100">
            {apercuUrl && <iframe title="Aperçu de la fiche prévisionnelle" src={`${apercuUrl}#toolbar=0&navpanes=0&view=FitH`} className="h-full w-full" />}
            {chargement && (
              <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs text-gray-500 shadow-sm">
                <Loader2 className="h-3 w-3 animate-spin" /> Mise à jour…
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <p className="hidden sm:block text-xs text-gray-400">Vos choix sont mémorisés pour ce contrat au téléchargement.</p>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fermer</Button>
            <Button variant="outline" size="sm" disabled={!apercuUrl || chargement} onClick={() => apercuUrl && window.open(apercuUrl, '_blank')}>
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Ouvrir / imprimer
            </Button>
            <Button size="sm" disabled={telechargement || periodeIncomplete} onClick={telecharger}>
              {telechargement ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
              Télécharger le PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
