import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, MoreVertical, FileText, CalendarClock, MapPin, Trash2, X, ChevronDown, ChevronUp, Search, Clock, CheckCircle2, Calendar, Pencil, Check, Receipt, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { clientsApi, contratsApi, interventionsApi, prestationsApi, usersApi } from '@/services/api';
import { formatDate, cn } from '@/lib/utils';
import { addDays, addMonths, format } from 'date-fns';
import { useAuthStore } from '@/store/auth.store';
import type { Contrat, CreateContratInput, Client, User, ContratStatut, ContratType, ContratSiteInput, Prestation } from '@/types';

export function computeProjectionDates(
  premierDate: string,
  nbOps: number | undefined,
  frequenceJours: number | undefined,
  frequenceMois: number | undefined,
  dateFin: string | undefined,
  ponctuel: boolean,
): string[] {
  if (!premierDate) return [];
  // Ponctuel : une échéance unique n'a pas besoin de fréquence
  if (!frequenceJours && !frequenceMois && !(ponctuel && nbOps === 1)) return [];
  const suivante = (d: Date) => (frequenceMois ? addMonths(d, frequenceMois) : addDays(d, frequenceJours || 30));
  const dates: string[] = [];
  let d = new Date(premierDate + 'T12:00:00');
  if (nbOps && nbOps > 0) {
    for (let i = 0; i < nbOps && i < 500; i++) {
      dates.push(format(d, 'yyyy-MM-dd'));
      d = suivante(d);
    }
  } else if (dateFin && !ponctuel) {
    const fin = new Date(dateFin + 'T12:00:00');
    for (let i = 0; d <= fin && i < 500; i++) {
      dates.push(format(d, 'yyyy-MM-dd'));
      d = suivante(d);
    }
  }
  return dates;
}

/** Même algo que le backend : répartit nbEntreOps contrôles entre chaque paire d'opérations. */
export function computeProjectionControles(datesOps: string[], nbEntreOps: number): string[] {
  if (nbEntreOps <= 0 || datesOps.length < 2) return [];
  const result: string[] = [];
  for (let i = 0; i < datesOps.length - 1; i++) {
    const debut = new Date(datesOps[i] + 'T12:00:00').getTime();
    const fin = new Date(datesOps[i + 1] + 'T12:00:00').getTime();
    const espacement = (fin - debut) / (nbEntreOps + 1);
    for (let j = 1; j <= nbEntreOps; j++) {
      result.push(format(new Date(Math.round(debut + j * espacement)), 'yyyy-MM-dd'));
    }
  }
  return result;
}

// Même règle que le backend : aucune visite de contrôle après la dernière opération (dates yyyy-MM-dd).
export function apresDerniereOperation(date: string, opDates: string[]): boolean {
  const ops = opDates.filter(Boolean);
  if (!date || ops.length === 0) return false;
  return date > ops.reduce((max, d) => (d > max ? d : max));
}

// Date hors de [debut, fin] (yyyy-MM-dd, bornes facultatives). Sert au garde-fou convention
// (bloquant, même règle que le backend) et à l'avertissement hors période de prestations.
export function horsBornes(date: string, debut: string, fin: string): boolean {
  return !!date && ((!!debut && date < debut) || (!!fin && date > fin));
}

// Dates soumises au garde-fou convention : les opérations et les visites qui seront planifiées
// (celles après la dernière opération sont ignorées).
function datesAPlanifier(cs: ContratSiteInput): string[] {
  const ops = cs.datesPrevuesOperations || [];
  return [...ops, ...(cs.datesPrevuesControles || []).filter((d) => !apresDerniereOperation(d, ops))];
}

// Croix de suppression d'une date de la projection (masquée s'il ne reste qu'une date : pour ne
// rien planifier, on vide la fréquence)
function SupprimerDate({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return <span className="w-4 flex-shrink-0" />;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Supprimer cette date"
      className="w-4 flex-shrink-0 text-gray-300 hover:text-red-600"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

type SerieDates = 'ops' | 'ctrl';

// Projection éditable des dates d'opérations et de visites de contrôle (formulaire contrat et
// avenant). `opsExistantes` : opérations déjà au planning (avenant), prises en compte pour les
// visites remplacées ou tombant après la dernière opération.
export function ProjectionDates({
  ops,
  ctrl,
  opsExistantes = [],
  debutConvention,
  finConvention,
  debutPeriode,
  finPeriode,
  onChangeDate,
  onRemoveDate,
  onReset,
  onRemoveHorsContrat,
}: {
  ops: string[];
  ctrl: string[];
  opsExistantes?: string[];
  debutConvention: string;
  finConvention: string;
  debutPeriode: string;
  finPeriode: string;
  onChangeDate: (serie: SerieDates, index: number, value: string) => void;
  onRemoveDate: (serie: SerieDates, index: number) => void;
  onReset: (serie: SerieDates) => void;
  onRemoveHorsContrat: () => void;
}) {
  if (ops.length === 0 && ctrl.length === 0) return null;
  const toutesOps = [...opsExistantes, ...ops];
  const nbHorsContrat = ctrl.filter((d) => apresDerniereOperation(d, toutesOps)).length;
  const nbInterdites = [...ops, ...ctrl.filter((d) => !apresDerniereOperation(d, toutesOps))]
    .filter((d) => horsBornes(d, debutConvention, finConvention)).length;
  const nbAutrePeriode = ops
    .filter((d) => !horsBornes(d, debutConvention, finConvention) && horsBornes(d, debutPeriode, finPeriode)).length;
  return (
    <div className="space-y-3 pt-2 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Projection des dates</p>
      {nbInterdites > 0 && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-300 rounded px-2 py-1.5 font-medium">
          {nbInterdites} date(s) encadrée(s) en rouge hors convention
          {debutConvention && <> (avant le {formatDate(debutConvention)}</>}
          {finConvention && <>{debutConvention ? ' ou ' : ' ('}après le {formatDate(finConvention)}</>}
          {(debutConvention || finConvention) && ')'} : modifiez-les ou supprimez-les pour enregistrer.
        </p>
      )}
      {nbAutrePeriode > 0 && (
        <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1.5">
          {nbAutrePeriode} opération(s) en orange hors de la période de prestations : elles compteront sur une autre année.
        </p>
      )}

      {ops.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Opérations ({ops.length})</span>
            <button type="button" onClick={() => onReset('ops')} className="text-xs text-blue-500 hover:text-blue-700">
              ↺ Recalculer
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {ops.map((date, i) => {
              const interdite = horsBornes(date, debutConvention, finConvention);
              const autrePeriode = !interdite && horsBornes(date, debutPeriode, finPeriode);
              return (
                <div
                  key={i}
                  className="flex items-center gap-1 group"
                  title={interdite ? 'Hors convention : à modifier ou supprimer' : autrePeriode ? 'Hors de la période de prestations' : undefined}
                >
                  <span className="text-[10px] text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                  <Input
                    type="date"
                    className={cn(
                      'h-7 text-xs px-1.5',
                      interdite && 'text-red-600 bg-red-50 border-red-500 ring-1 ring-red-500',
                      autrePeriode && 'text-orange-700 bg-orange-50 border-orange-300'
                    )}
                    value={date}
                    onChange={(e) => onChangeDate('ops', i, e.target.value)}
                  />
                  <SupprimerDate visible={ops.length > 1} onClick={() => onRemoveDate('ops', i)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ctrl.length > 0 && (
        <div className="space-y-1.5">
          {nbHorsContrat > 0 && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              Attention : {nbHorsContrat} visite(s) de contrôle tombent après la dernière opération et ne seront pas planifiées.
              Ajustez le nombre, la fréquence ou la date de départ si besoin.
              <button
                type="button"
                onClick={onRemoveHorsContrat}
                className="ml-1 font-medium underline hover:text-red-900"
              >
                Retirer les dates en rouge
              </button>
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              Contrôles ({ctrl.length})
              {nbHorsContrat > 0 && <span className="font-normal text-red-500"> · en rouge : après la dernière opération</span>}
            </span>
            <button type="button" onClick={() => onReset('ctrl')} className="text-xs text-blue-500 hover:text-blue-700">
              ↺ Recalculer
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {ctrl.map((date, i) => {
              const horsContrat = apresDerniereOperation(date, toutesOps);
              const interdite = !horsContrat && horsBornes(date, debutConvention, finConvention);
              const autrePeriode = !horsContrat && !interdite && horsBornes(date, debutPeriode, finPeriode);
              return (
                <div
                  key={i}
                  className="flex items-center gap-1 group"
                  title={
                    horsContrat ? 'Après la dernière opération : ne sera pas planifiée'
                      : interdite ? 'Hors convention : à modifier ou supprimer'
                      : autrePeriode ? 'Hors de la période de prestations'
                      : undefined
                  }
                >
                  <span className="text-[10px] text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                  <Input
                    type="date"
                    className={cn(
                      'h-7 text-xs px-1.5',
                      horsContrat && 'line-through text-red-500 bg-red-50 border-red-200',
                      interdite && 'text-red-600 bg-red-50 border-red-500 ring-1 ring-red-500',
                      autrePeriode && 'text-orange-700 bg-orange-50 border-orange-300'
                    )}
                    value={date}
                    onChange={(e) => onChangeDate('ctrl', i, e.target.value)}
                  />
                  <SupprimerDate visible={ctrl.length > 1} onClick={() => onRemoveDate('ctrl', i)} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function FrequenceInput({
  jours,
  onChange,
  placeholder,
}: {
  jours?: number;
  onChange: (v: { jours?: number; mois?: number }) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 whitespace-nowrap">Tous les</span>
      <Input
        type="number"
        className="h-8 w-20"
        min={1}
        placeholder={placeholder}
        value={jours || ''}
        onChange={(e) => onChange({ jours: e.target.value ? Number(e.target.value) : undefined, mois: undefined })}
      />
      <span className="text-xs text-gray-500 whitespace-nowrap">jours</span>
    </div>
  );
}

// Sélecteur de client avec recherche côté serveur : la liste des clients actifs chargée en
// arrière-plan est plafonnée (voir clientController.list), donc taper une recherche interroge
// le backend sur l'ensemble des clients au lieu de se limiter aux ~100 premiers par ordre alphabétique.
function ClientCombobox({
  selected,
  onSelect,
  initialClients,
}: {
  selected: Client | undefined;
  onSelect: (client: Client) => void;
  initialClients: Client[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: searchData, isFetching } = useQuery({
    queryKey: ['clients-search', debouncedSearch],
    queryFn: () => clientsApi.list({ search: debouncedSearch, actif: true, limit: 50 }),
    enabled: debouncedSearch.length > 0,
    staleTime: 30000,
  });

  const options: Client[] = debouncedSearch ? (searchData?.clients || []) : initialClients;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={cn('truncate', selected ? 'text-foreground' : 'text-muted-foreground')}>
          {selected ? selected.nomEntreprise : 'Sélectionner un client...'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Rechercher un client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {debouncedSearch && isFetching ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Recherche...</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Aucun client trouvé</p>
            ) : (
              options.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    onSelect(client);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground truncate',
                    selected?.id === client.id && 'bg-accent font-medium'
                  )}
                >
                  {client.nomEntreprise}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ContratForm({
  contrat,
  isEdit,
  clientIdFilter,
  clients,
  users,
  prestations,
  isPending,
  onSubmit,
  onCancel,
}: {
  contrat?: Contrat;
  isEdit: boolean;
  clientIdFilter?: string;
  clients: Client[];
  users: User[];
  prestations: Prestation[];
  isPending: boolean;
  onSubmit: (data: CreateContratInput) => void;
  onCancel: () => void;
}) {
  const defaultClientId = clientIdFilter || contrat?.clientId || '';
  const [nom, setNom] = useState((contrat as any)?.nom || '');
  const [clientId, setClientId] = useState<string | undefined>(defaultClientId || undefined);
  // Objet client complet (avec sites) pour le client sélectionné — conservé séparément de la
  // liste `clients` chargée en arrière-plan, car celle-ci ne contient pas forcément le client
  // choisi via la recherche (voir ClientCombobox).
  const [selectedClientObj, setSelectedClientObj] = useState<Client | undefined>(
    () => (contrat?.client as Client | undefined) || clients.find((c) => c.id === defaultClientId)
  );
  const [type, setType] = useState<ContratType>(contrat?.type || 'ANNUEL');
  const [responsablePlanningId, setResponsablePlanningId] = useState<string | undefined>(contrat?.responsablePlanningId || undefined);
  const [statut, setStatut] = useState<ContratStatut>(contrat?.statut || 'ACTIF');
  const [dateDebut, setDateDebut] = useState(contrat?.dateDebut?.split('T')[0] || '');
  const [dateFin, setDateFin] = useState(contrat?.dateFin?.split('T')[0] || '');
  const [dateDebutConvention, setDateDebutConvention] = useState((contrat as any)?.dateDebutConvention?.split('T')[0] || '');
  const [dateFinConvention, setDateFinConvention] = useState((contrat as any)?.dateFinConvention?.split('T')[0] || '');

  const handleDateDebutChange = (value: string) => {
    setDateDebut(value);
    // Pour un contrat annuel, suggérer automatiquement la date de fin à +1 an
    if (type === 'ANNUEL' && value) {
      const fin = new Date(value);
      fin.setFullYear(fin.getFullYear() + 1);
      changerDateFin(fin.toISOString().split('T')[0]);
    }
  };

  // State pour le select d'ajout de site (permet de réinitialiser après sélection)
  const [reconductionAuto, setReconductionAuto] = useState<boolean>(contrat ? (contrat.reconductionAuto ?? true) : true);
  const [siteSelectKey, setSiteSelectKey] = useState(0);

  // Sites configuration avec prestations
  const [contratSites, setContratSites] = useState<ContratSiteInput[]>(
    contrat?.contratSites?.map(cs => ({
      siteId: cs.siteId,
      prestations: cs.prestations || [],
      prixPrestations: (cs.prixPrestations as Record<string, number>) || {},
      frequenceOperationsJours: cs.frequenceOperationsJours ?? undefined,
      frequenceOperationsMois: cs.frequenceOperationsMois ?? undefined,
      premiereDateOperation: cs.premiereDateOperation?.split('T')[0],
      nombreOperations: cs.nombreOperations ?? undefined,
      nombreVisitesControleEntreOps: cs.nombreVisitesControleEntreOps ?? undefined,
      notes: cs.notes ?? undefined,
    })) || []
  );

  const projectionOps = (cs: ContratSiteInput, fin: string, t: ContratType = type) =>
    computeProjectionDates(cs.premiereDateOperation || '', cs.nombreOperations, cs.frequenceOperationsJours, cs.frequenceOperationsMois, fin || undefined, t === 'PONCTUEL');
  const projectionCtrl = (cs: ContratSiteInput) =>
    computeProjectionControles(cs.datesPrevuesOperations || [], cs.nombreVisitesControleEntreOps || 0);

  // État pour les sites dépliés/repliés — dépliés par défaut pour ne pas cacher
  // les prestations/prix (source d'oublis fréquente)
  const [expandedSites, setExpandedSites] = useState<Set<string>>(
    new Set((contrat?.contratSites || []).map(cs => cs.siteId))
  );

  // Get selected client's sites
  const selectedClient = selectedClientObj;
  const availableSites = selectedClient?.sites || [];

  // Sites non encore ajoutés au contrat
  const sitesNotInContract = availableSites.filter(s => !contratSites.find(cs => cs.siteId === s.id));

  // Add a site to the contract
  const addSite = (siteId: string) => {
    if (!siteId || contratSites.find(cs => cs.siteId === siteId)) return;
    setContratSites([...contratSites, { siteId, prestations: [] }]);
    setExpandedSites(prev => new Set([...prev, siteId]));
    // Reset le select en changeant sa clé
    setSiteSelectKey(prev => prev + 1);
  };

  // Remove a site from the contract
  const removeSite = (siteId: string) => {
    setContratSites(contratSites.filter(cs => cs.siteId !== siteId));
    setExpandedSites(prev => {
      const newSet = new Set(prev);
      newSet.delete(siteId);
      return newSet;
    });
  };

  // Update a site's configuration
  const updateSite = (siteId: string, updates: Partial<ContratSiteInput>) => {
    setContratSites(contratSites.map(cs => {
      if (cs.siteId !== siteId) return cs;
      const updated = { ...cs, ...updates };
      // Sans 1ère date saisie, la série démarre au début de la période (ou à la signature de la
      // convention si elle est postérieure) : la projection s'affiche dès le nombre / la fréquence
      const departParDefaut = [dateDebut, dateDebutConvention].filter(Boolean).sort().pop() || '';
      // Recalculer la projection des dates quand les paramètres changent
      if (['premiereDateOperation', 'frequenceOperationsJours', 'frequenceOperationsMois', 'nombreOperations'].some((k) => k in updates)) {
        if (!('premiereDateOperation' in updates) && !updated.premiereDateOperation && (updated.nombreOperations || updated.frequenceOperationsJours || updated.frequenceOperationsMois)) {
          updated.premiereDateOperation = departParDefaut;
        }
        updated.datesPrevuesOperations = projectionOps(updated, dateFin);
      }
      const opsChanged = ['premiereDateOperation', 'frequenceOperationsJours', 'frequenceOperationsMois', 'nombreOperations', 'datesPrevuesOperations'].some((k) => k in updates);
      if ('nombreVisitesControleEntreOps' in updates || opsChanged) {
        updated.datesPrevuesControles = projectionCtrl(updated);
      }
      return updated;
    }));
  };

  const updateSiteDate = (siteId: string, type: 'ops' | 'ctrl', index: number, value: string) => {
    setContratSites(contratSites.map(cs => {
      if (cs.siteId !== siteId) return cs;
      if (type === 'ops') {
        const dates = [...(cs.datesPrevuesOperations || [])];
        dates[index] = value;
        return { ...cs, datesPrevuesOperations: dates };
      } else {
        const dates = [...(cs.datesPrevuesControles || [])];
        dates[index] = value;
        return { ...cs, datesPrevuesControles: dates };
      }
    }));
  };

  const removeSiteDate = (siteId: string, serie: 'ops' | 'ctrl', index: number) => {
    setContratSites(contratSites.map(cs => {
      if (cs.siteId !== siteId) return cs;
      const cle = serie === 'ops' ? 'datesPrevuesOperations' : 'datesPrevuesControles';
      const dates = (cs[cle] || []).filter((_, i) => i !== index);
      // Ponctuel : le nombre d'opérations prévu suit les dates retenues (quota du contrat)
      const nombre = (type !== 'PONCTUEL' || serie !== 'ops') ? {} : { nombreOperations: dates.length };
      return { ...cs, [cle]: dates, ...nombre };
    }));
  };

  // Retire les visites en rouge (après la dernière opération : elles ne seraient pas planifiées)
  const removeControlesApresDerniereOp = (siteId: string) => {
    setContratSites(contratSites.map(cs => cs.siteId !== siteId ? cs : {
      ...cs,
      datesPrevuesControles: (cs.datesPrevuesControles || []).filter((d) => !apresDerniereOperation(d, cs.datesPrevuesOperations || [])),
    }));
  };

  const resetSiteDates = (siteId: string, type: 'ops' | 'ctrl') => {
    const cs = contratSites.find(s => s.siteId === siteId);
    if (!cs) return;
    if (type === 'ops') {
      updateSite(siteId, { datesPrevuesOperations: projectionOps(cs, dateFin) });
    } else {
      updateSite(siteId, { datesPrevuesControles: projectionCtrl(cs) });
    }
  };

  // La date de fin borne la projection des annuels : recalculer les projections déjà affichées
  // Le type change la règle de projection (quota ponctuel / date de fin annuel)
  const changerType = (value: ContratType) => {
    setType(value);
    setContratSites((sites) => sites.map((cs) => ({
      ...cs,
      ...(cs.datesPrevuesOperations ? { datesPrevuesOperations: projectionOps(cs, dateFin, value) } : {}),
      ...(cs.datesPrevuesControles ? { datesPrevuesControles: projectionCtrl(cs) } : {}),
    })));
  };

  const changerDateFin = (value: string) => {
    setDateFin(value);
    setContratSites((sites) => sites.map((cs) => ({
      ...cs,
      ...(cs.datesPrevuesOperations ? { datesPrevuesOperations: projectionOps(cs, value) } : {}),
    })));
  };

  // Add prestation to a site
  const addPrestationToSite = (siteId: string, prestationNom: string) => {
    const site = contratSites.find(cs => cs.siteId === siteId);
    if (!site) return;
    const currentPrestations = site.prestations || [];
    if (!currentPrestations.includes(prestationNom)) {
      updateSite(siteId, { prestations: [...currentPrestations, prestationNom] });
    }
  };

  // Remove prestation from a site
  const removePrestationFromSite = (siteId: string, prestationNom: string) => {
    const site = contratSites.find(cs => cs.siteId === siteId);
    if (!site) return;
    const currentPrestations = site.prestations || [];
    updateSite(siteId, { prestations: currentPrestations.filter(p => p !== prestationNom) });
  };

  // Toggle site expansion
  const toggleSiteExpansion = (siteId: string) => {
    setExpandedSites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(siteId)) {
        newSet.delete(siteId);
      } else {
        newSet.add(siteId);
      }
      return newSet;
    });
  };

  // Reset sites when client changes
  useEffect(() => {
    if (!isEdit) {
      setContratSites([]);
      setExpandedSites(new Set());
    }
  }, [clientId, isEdit]);

  const isPonctuel = type === 'PONCTUEL';
  // Bornes du garde-fou : signature de la convention (à défaut début de période) → fin de convention
  const debutConvention = dateDebutConvention || dateDebut;
  const finConvention = dateFinConvention;
  const hasSites = contratSites.length > 0;

  // Compute all prestations across all sites for the contrat level
  const allSitePrestations = useMemo(() => {
    const allPrests = new Set<string>();
    contratSites.forEach(cs => {
      (cs.prestations || []).forEach(p => allPrests.add(p));
    });
    return Array.from(allPrests);
  }, [contratSites]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        // Validation pour contrat ponctuel
        if (isPonctuel) {
          const numeroBonCommande = formData.get('numeroBonCommande') as string;
          if (!numeroBonCommande) {
            toast.error('Numéro de bon de commande requis pour un contrat ponctuel');
            return;
          }
        }

        // Validation des sites
        if (hasSites) {
          for (const cs of contratSites) {
            if (!cs.prestations || cs.prestations.length === 0) {
              const siteName = availableSites.find(s => s.id === cs.siteId)?.nom || 'Site';
              toast.error(`Sélectionnez au moins une prestation pour ${siteName}`);
              return;
            }
            const prestationSansPrix = cs.prestations.find(nom => !cs.prixPrestations?.[nom]);
            if (prestationSansPrix) {
              const siteName = availableSites.find(s => s.id === cs.siteId)?.nom || 'Site';
              toast.error(`Indiquez le prix de "${prestationSansPrix}" pour ${siteName}`);
              setExpandedSites(prev => new Set([...prev, cs.siteId]));
              return;
            }
            const siteName = availableSites.find(s => s.id === cs.siteId)?.nom || 'Site';
            const freqOps = cs.frequenceOperationsJours || cs.frequenceOperationsMois;
            if (isPonctuel) {
              if (!cs.nombreOperations) {
                toast.error(`Indiquez le nombre d'opérations pour ${siteName}`);
                return;
              }
              if (cs.nombreOperations > 1 && !freqOps) {
                toast.error(`Indiquez la fréquence des opérations pour ${siteName}`);
                return;
              }
            } else if (!freqOps) {
              toast.error(`Configurez la fréquence des opérations pour ${siteName}`);
              return;
            }
            if ((cs.nombreOperations || freqOps) && !cs.premiereDateOperation) {
              toast.error(`Indiquez la date de la 1ère opération pour ${siteName}`);
              return;
            }
          }
        }

        if (dateDebutConvention && dateFinConvention && dateFinConvention < dateDebutConvention) {
          toast.error('La fin de convention est antérieure à sa date de signature');
          return;
        }
        for (const cs of contratSites) {
          const dateInterdite = datesAPlanifier(cs)
            .find((d) => horsBornes(d, debutConvention, finConvention));
          if (dateInterdite) {
            const siteName = availableSites.find(s => s.id === cs.siteId)?.nom || 'Site';
            toast.error(`${siteName} : le ${formatDate(dateInterdite)} est hors convention — modifiez ou supprimez cette date`);
            setExpandedSites(prev => new Set([...prev, cs.siteId]));
            return;
          }
        }

        if (!clientId) {
          toast.error('Client requis');
          return;
        }

        if (!hasSites) {
          toast.error('Ajoutez au moins un site au contrat');
          return;
        }

        const cleanedContratSites = contratSites.map((cs) => ({
          ...cs,
          frequenceOperationsJours: cs.frequenceOperationsJours ?? undefined,
          frequenceOperationsMois: cs.frequenceOperationsMois ?? undefined,
          nombreOperations: cs.nombreOperations ?? undefined,
          nombreVisitesControleEntreOps: cs.nombreVisitesControleEntreOps ?? undefined,
          notes: cs.notes ?? undefined,
        }));

        const data: CreateContratInput = {
          clientId: clientId as string,
          // En modification, une valeur vidée est envoyée vide/null pour être effacée
          nom: isEdit ? nom : (nom || undefined),
          type,
          dateDebut: dateDebut,
          dateFin: dateFin || (isEdit ? null : undefined),
          reconductionAuto,
          prestations: allSitePrestations, // Toutes les prestations de tous les sites
          responsablePlanningId: responsablePlanningId || (isEdit ? null : undefined),
          statut,
          notes: (formData.get('notes') as string) || (isEdit ? '' : undefined),
          autoCreerProchaine: true,
          dateDebutConvention: dateDebutConvention || (isEdit ? null : undefined),
          dateFinConvention: dateFinConvention || (isEdit ? null : undefined),
          // Ponctuel fields
          numeroBonCommande: ((formData.get('numeroBonCommande') as string) || '').trim() || (isEdit ? null : undefined),
          // Sites avec leurs configurations
          contratSites: cleanedContratSites,
        };

        onSubmit(data);
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      {/* Champs : seule zone qui défile ; les boutons restent fixes en dessous */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-5">
      {/* Section 1: Informations de base */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-sm text-gray-700">Informations générales</h3>

        <div className="space-y-2">
          <Label>Nom du contrat</Label>
          <Input
            placeholder="Ex: Dératisation annuelle 2026 — Site Alger"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <ClientCombobox
              selected={selectedClientObj}
              onSelect={(client) => {
                setClientId(client.id);
                setSelectedClientObj(client);
              }}
              initialClients={clients}
            />
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={type} onValueChange={(v) => changerType(v as ContratType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANNUEL">Annuel</SelectItem>
                <SelectItem value="PONCTUEL">Ponctuel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-0 rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {/* Ligne 1 — Convention */}
          <div className="grid grid-cols-2 gap-px">
            <div className="space-y-1 p-3 bg-white">
              <Label className="text-xs text-gray-500">Date début convention{isPonctuel && <span className="text-gray-400"> (optionnel)</span>}</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={dateDebutConvention}
                onChange={(e) => setDateDebutConvention(e.target.value)}
              />
            </div>
            <div className="space-y-1 p-3 bg-white">
              <Label className="text-xs text-gray-500">Date fin convention <span className="text-gray-400">(optionnel)</span></Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={dateFinConvention}
                onChange={(e) => setDateFinConvention(e.target.value)}
              />
            </div>
          </div>
          {/* Ligne 2 — Contrat annuel */}
          <div className="grid grid-cols-2 gap-px">
            <div className="space-y-1 p-3 bg-white">
              <Label className="text-xs text-gray-500">Date début contrat annuel {isPonctuel ? <span className="text-gray-400">(optionnel)</span> : <span className="text-red-500">*</span>}</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={dateDebut}
                onChange={(e) => handleDateDebutChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1 p-3 bg-white">
              <Label className="text-xs text-gray-500">
                Date fin contrat annuel
                {!isPonctuel && <span className="text-gray-400"> (optionnel)</span>}
              </Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={dateFin}
                onChange={(e) => changerDateFin(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Bon de commande (obligatoire en ponctuel, facultatif en annuel) */}
      <div className={cn('space-y-4 p-4 rounded-lg border', isPonctuel ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200')}>
        <h3 className={cn('font-medium text-sm', isPonctuel ? 'text-yellow-800' : 'text-gray-700')}>
          {isPonctuel ? 'Contrat ponctuel' : 'Bon de commande'}
        </h3>
        <div className="space-y-2">
          <Label>N° Bon de commande{isPonctuel ? ' *' : ' (facultatif)'}</Label>
          <Input
            name="numeroBonCommande"
            defaultValue={contrat?.numeroBonCommande || ''}
            placeholder="Ex: BC-2024-001"
            required={isPonctuel}
          />
          {!isPonctuel && (
            <p className="text-xs text-muted-foreground">Repris sur les factures du contrat.</p>
          )}
        </div>
      </div>

      {/* Section 3: Configuration des sites */}
      {clientId && (
        <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-blue-800 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Sites du contrat *
            </h3>
            {sitesNotInContract.length > 0 && (
              <Select key={siteSelectKey} onValueChange={addSite}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Ajouter un site" />
                </SelectTrigger>
                <SelectContent>
                  {sitesNotInContract.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {availableSites.length === 0 ? (
            <p className="text-sm text-blue-700">
              Ce client n'a pas de sites configurés. Ajoutez des sites au client d'abord.
            </p>
          ) : contratSites.length === 0 ? (
            <p className="text-sm text-blue-700">
              Ajoutez au moins un site pour configurer les prestations et fréquences.
            </p>
          ) : (
            <div className="space-y-3">
              {contratSites.map((cs) => {
                const site = availableSites.find(s => s.id === cs.siteId);
                const isExpanded = expandedSites.has(cs.siteId);
                const sitePrestations = cs.prestations || [];
                const availablePrestationsForSite = prestations.filter(p => !sitePrestations.includes(p.nom));
                const missingPriceCount = sitePrestations.filter(nom => !cs.prixPrestations?.[nom]).length;

                return (
                  <div
                    key={cs.siteId}
                    className={`bg-white rounded border overflow-hidden ${
                      sitePrestations.length === 0 || missingPriceCount > 0 ? 'border-amber-300' : ''
                    }`}
                  >
                    {/* En-tête du site */}
                    <div
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleSiteExpansion(cs.siteId)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span className="font-medium">{site?.nom || 'Site'}</span>
                        {sitePrestations.length > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            {sitePrestations.length} prestation(s)
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100 border border-amber-300">
                            Aucune prestation
                          </Badge>
                        )}
                        {missingPriceCount > 0 && (
                          <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100 border border-amber-300">
                            {missingPriceCount} prix manquant{missingPriceCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSite(cs.siteId);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    {/* Contenu déplié */}
                    {isExpanded && (
                      <div className="border-t divide-y divide-gray-100">

                        {/* ── Prestations ── */}
                        <div className="p-3 space-y-2">
                          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Prestations</span>

                          {sitePrestations.length > 0 && (
                            <div className="space-y-1">
                              {sitePrestations.map((nom) => {
                                const priceMissing = !cs.prixPrestations?.[nom];
                                return (
                                  <div key={nom} className="flex items-center gap-2">
                                    <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{nom}</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      step="any"
                                      className={cn('h-7 w-24 text-sm text-right px-2', priceMissing && 'border-amber-400 focus-visible:ring-amber-400')}
                                      placeholder="Prix"
                                      value={cs.prixPrestations?.[nom] ?? ''}
                                      onChange={(e) => {
                                        const prix = e.target.value ? Number(e.target.value) : undefined;
                                        updateSite(cs.siteId, {
                                          prixPrestations: {
                                            ...(cs.prixPrestations || {}),
                                            ...(prix !== undefined ? { [nom]: prix } : Object.fromEntries(
                                              Object.entries(cs.prixPrestations || {}).filter(([k]) => k !== nom)
                                            )),
                                          },
                                        });
                                      }}
                                    />
                                    <span className="text-xs text-gray-400 w-5 shrink-0">DA</span>
                                    <button
                                      type="button"
                                      onClick={() => removePrestationFromSite(cs.siteId, nom)}
                                      className="text-gray-300 hover:text-red-500 shrink-0"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Bouton ajout — pleine largeur, bien visible */}
                          {availablePrestationsForSite.length > 0 && (
                            <Select key={sitePrestations.join(',')} onValueChange={(v) => addPrestationToSite(cs.siteId, v)}>
                              <SelectTrigger className={cn(
                                'w-full h-9 border-dashed font-medium text-sm gap-2 justify-center',
                                sitePrestations.length === 0
                                  ? 'border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                  : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50'
                              )}>
                                <Plus className="h-4 w-4 shrink-0" />
                                <SelectValue placeholder={sitePrestations.length === 0 ? 'Ajouter une prestation' : 'Ajouter une prestation'} />
                              </SelectTrigger>
                              <SelectContent>
                                {availablePrestationsForSite.map((p) => (
                                  <SelectItem key={p.id} value={p.nom}>{p.nom}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {/* ── Planning ── */}
                        <div className="p-3 space-y-4">
                          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Planning</span>

                          {isPonctuel && (
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-600 w-40 shrink-0">Nb opérations <span className="text-red-500">*</span></span>
                              <Input
                                type="number"
                                className="h-8 w-24"
                                min={1}
                                placeholder="Ex : 4"
                                value={cs.nombreOperations || ''}
                                onChange={(e) => updateSite(cs.siteId, { nombreOperations: e.target.value ? Number(e.target.value) : undefined })}
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-40 shrink-0">
                              Fréquence
                              {!isPonctuel && <span className="text-red-500"> *</span>}
                              {isPonctuel && <span className="text-gray-400 text-xs"> (si &gt; 1)</span>}
                            </span>
                            <FrequenceInput
                              jours={cs.frequenceOperationsJours}
                              placeholder={isPonctuel ? 'Ex : 30' : 'Ex : 90'}
                              onChange={(v) => updateSite(cs.siteId, { frequenceOperationsJours: v.jours, frequenceOperationsMois: undefined })}
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-40 shrink-0">1ère opération</span>
                            <Input
                              type="date"
                              className="h-8 w-36"
                              value={cs.premiereDateOperation || ''}
                              onChange={(e) => updateSite(cs.siteId, { premiereDateOperation: e.target.value })}
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-40 shrink-0">VC entre chaque OP</span>
                            <Input
                              type="number"
                              className="h-8 w-24"
                              min={0}
                              placeholder="0"
                              value={cs.nombreVisitesControleEntreOps ?? ''}
                              onChange={(e) => updateSite(cs.siteId, { nombreVisitesControleEntreOps: e.target.value ? Number(e.target.value) : undefined })}
                            />
                          </div>
                        </div>

                        {/* ── Projection des dates ── */}
                        {(cs.datesPrevuesOperations?.length || cs.datesPrevuesControles?.length) ? (
                          <div className="p-3">
                            <ProjectionDates
                              ops={cs.datesPrevuesOperations || []}
                              ctrl={cs.datesPrevuesControles || []}
                              debutConvention={debutConvention}
                              finConvention={finConvention}
                              debutPeriode={dateDebut}
                              finPeriode={dateFin}
                              onChangeDate={(t, i, v) => updateSiteDate(cs.siteId, t, i, v)}
                              onRemoveDate={(t, i) => removeSiteDate(cs.siteId, t, i)}
                              onReset={(t) => resetSiteDates(cs.siteId, t)}
                              onRemoveHorsContrat={() => removeControlesApresDerniereOp(cs.siteId)}
                            />
                          </div>
                        ) : null}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 4: Options avancées */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-sm text-gray-700">Options</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Responsable planning</Label>
            <Select value={responsablePlanningId || ''} onValueChange={(v) => setResponsablePlanningId(v || undefined)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                {users
                  // Uniquement les comptes bureau actifs (les rôles terrain / lecture ne gèrent pas de contrats)
                  .filter(
                    (u: User) =>
                      (u.actif && !['EQUIPE', 'SUPER_CHEF_EQUIPE', 'LECTURE'].includes(u.role)) ||
                      u.id === responsablePlanningId
                  )
                  .map((u: User) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.prenom} {u.nom}
                      {!u.actif ? ' (désactivé)' : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Statut</Label>
            <Select value={statut} onValueChange={(v) => setStatut(v as ContratStatut)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIF">Actif</SelectItem>
                <SelectItem value="SUSPENDU">Suspendu</SelectItem>
                <SelectItem value="TERMINE">Terminé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea name="notes" defaultValue={contrat?.notes || ''} rows={2} placeholder="Notes internes..." />
        </div>

        {!isPonctuel && (
          <button
            type="button"
            onClick={() => setReconductionAuto((v) => !v)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
              reconductionAuto
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <RefreshCw className={`h-4 w-4 shrink-0 ${reconductionAuto ? 'text-green-600' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm font-medium ${reconductionAuto ? 'text-green-800' : 'text-gray-600'}`}>
                  Reconduction automatique
                </p>
                <p className={`text-xs mt-0.5 ${reconductionAuto ? 'text-green-600' : 'text-gray-400'}`}>
                  {reconductionAuto
                    ? 'Le contrat sera reconduit chaque année jusqu\'à la fin de la convention'
                    : 'Le renouvellement devra être effectué manuellement'}
                </p>
              </div>
            </div>
            <div className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${reconductionAuto ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${reconductionAuto ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </button>
        )}
      </div>
      </div>

      <DialogFooter className="px-6 py-4 border-t bg-background">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Créer le contrat')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ContratsPage() {
  const queryClient = useQueryClient();
  const { canDo } = useAuthStore();
  const [searchParams] = useSearchParams();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContrat, setEditingContrat] = useState<Contrat | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contrat | null>(null);
  const [selectedContrat, setSelectedContrat] = useState<Contrat | null>(null);
  const [pendingCreate, setPendingCreate] = useState<CreateContratInput | null>(null);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statutFilter, setStatutFilter] = useState<ContratStatut | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<ContratType | 'ALL'>('ALL');
  const clientIdFilter = searchParams.get('clientId') || undefined;
  const [clientFilter, setClientFilter] = useState<string>(clientIdFilter || 'ALL');

  const { data: contratsData, isLoading } = useQuery({
    queryKey: ['contrats', clientIdFilter],
    queryFn: () => contratsApi.list({ clientId: clientIdFilter, limit: 1000 }),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients-active'],
    queryFn: () => clientsApi.list({ actif: true, limit: 1000 }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  });

  const { data: prestationsData = [] } = useQuery({
    queryKey: ['prestations-active'],
    queryFn: () => prestationsApi.list(true),
  });

  const { data: selectedContratDetail } = useQuery({
    queryKey: ['contrat-detail', selectedContrat?.id],
    queryFn: () => contratsApi.get(selectedContrat!.id),
    enabled: !!selectedContrat,
  });

  const createMutation = useMutation({
    mutationFn: contratsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contrats'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-alertes'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-a-planifier'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-en-retard'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-semaine'] });
      const planningMsg = data.planning ? ` (${data.planning.interventionsCreees} interventions créées)` : '';
      toast.success(`Contrat créé${planningMsg}`);
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      const details = error.response?.data?.details;
      if (details?.length) {
        toast.error(`${error.response?.data?.error || 'Données invalides'} • ${details.map((d: any) => `${d.field}: ${d.message}`).join(', ')}`);
      } else {
        toast.error(error.response?.data?.error || 'Erreur lors de la création');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateContratInput> }) =>
      contratsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrats'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-alertes'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-a-planifier'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-en-retard'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-semaine'] });
      toast.success('Contrat mis à jour');
      setEditingContrat(null);
    },
    onError: (error: any) => {
      const details = error.response?.data?.details;
      if (details?.length) {
        toast.error(`${error.response?.data?.error || 'Données invalides'} • ${details.map((d: any) => `${d.field}: ${d.message}`).join(', ')}`);
      } else {
        toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contratsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrats'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-active'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-alertes'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-a-planifier'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-en-retard'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-semaine'] });
      toast.success('Contrat supprimé');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const [editingInterventionId, setEditingInterventionId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState('');

  const updateInterventionDateMutation = useMutation({
    mutationFn: ({ id, datePrevue }: { id: string; datePrevue: string }) =>
      interventionsApi.update(id, { datePrevue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrat-detail', selectedContrat?.id] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-semaine'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-a-planifier'] });
      queryClient.invalidateQueries({ queryKey: ['interventions-en-retard'] });
      setEditingInterventionId(null);
      toast.success('Date mise à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour de la date');
    },
  });

  const contrats = contratsData?.contrats || [];
  const clients = clientsData?.clients || [];

  const clientMap = useMemo(() => {
    return new Map(clients.map((c) => [c.id, c.nomEntreprise]));
  }, [clients]);

  const filteredContrats = useMemo(() => {
    let result = contrats;

    if (clientFilter !== 'ALL') {
      result = result.filter((c) => c.clientId === clientFilter);
    }

    if (statutFilter !== 'ALL') {
      result = result.filter((c) => c.statut === statutFilter);
    }

    if (typeFilter !== 'ALL') {
      result = result.filter((c) => c.type === typeFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter((c) => {
        const clientName = c.client?.nomEntreprise || clientMap.get(c.clientId) || '';
        const prestations = c.prestations.join(' ');
        const bc = c.numeroBonCommande || '';
        return (
          (c.nom || '').toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q) ||
          prestations.toLowerCase().includes(q) ||
          bc.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [contrats, clientFilter, statutFilter, typeFilter, searchTerm, clientMap]);
  const users = usersData || [];
  const prestations = prestationsData || [];

  const formProps = {
    clientIdFilter,
    clients,
    users,
    prestations,
    isPending: createMutation.isPending || updateMutation.isPending,
  };


  // KPI counts
  const kpiActifs   = contrats.filter(c => c.statut === 'ACTIF').length;
  const kpiAnnuels  = contrats.filter(c => c.type === 'ANNUEL').length;
  const kpiPonctuel = contrats.filter(c => c.type === 'PONCTUEL').length;

  const STATUT_STYLE: Record<string, { bar: string; dot: string; text: string; bg: string }> = {
    ACTIF:    { bar: 'bg-green-500',  dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50' },
    SUSPENDU: { bar: 'bg-amber-400',  dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50' },
    TERMINE:  { bar: 'bg-gray-300',   dot: 'bg-gray-400',   text: 'text-gray-500',   bg: 'bg-gray-100' },
  };

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Contrats</h1>
          <p className="text-sm text-gray-400 mt-0.5">{contrats.length} contrat{contrats.length > 1 ? 's' : ''} au total</p>
        </div>
        {canDo('createContrat') && (
          <Button
            className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm shadow-green-200 h-9"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau contrat
          </Button>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Actifs',    value: kpiActifs,   bar: 'bg-green-500', num: 'text-green-700',  bg: 'bg-green-50',  icon: CheckCircle2, filter: () => setStatutFilter('ACTIF') },
          { label: 'Annuels',   value: kpiAnnuels,  bar: 'bg-blue-500',  num: 'text-blue-700',   bg: 'bg-blue-50',   icon: Calendar,     filter: () => setTypeFilter('ANNUEL') },
          { label: 'Ponctuels', value: kpiPonctuel, bar: 'bg-amber-400', num: 'text-amber-700',  bg: 'bg-amber-50',  icon: Clock,        filter: () => setTypeFilter('PONCTUEL') },
        ].map(({ label, value, bar, num, bg, icon: Icon, filter }) => (
          <div key={label} onClick={filter}
            className="relative bg-white rounded-xl p-5 overflow-hidden cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className={`absolute bottom-0 left-0 right-0 h-1 ${bar} rounded-b-xl`} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                <p className={`text-4xl font-black tabular-nums leading-none ${num}`}>{value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${num}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Barre filtres ── */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Statut pills */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { value: 'ALL', label: 'Tous' },
              { value: 'ACTIF', label: 'Actifs' },
              { value: 'SUSPENDU', label: 'Suspendus' },
              { value: 'TERMINE', label: 'Terminés' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setStatutFilter(opt.value as ContratStatut | 'ALL')}
                className={`h-7 px-3 rounded-md text-xs font-semibold transition-all ${
                  statutFilter === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          {/* Type pills */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { value: 'ALL', label: 'Tous types' },
              { value: 'ANNUEL', label: 'Annuel' },
              { value: 'PONCTUEL', label: 'Ponctuel' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setTypeFilter(opt.value as ContratType | 'ALL')}
                className={`h-7 px-3 rounded-md text-xs font-semibold transition-all ${
                  typeFilter === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Nom, entreprise, prestation, BC..."
              className="pl-8 h-8 w-52 text-sm border-gray-200" />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2">
                <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          {/* Filtre client */}
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-8 w-44 text-xs border-gray-200">
              <SelectValue placeholder="Toutes entreprises" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes entreprises</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nomEntreprise}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Contenu ── */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">Chargement...</p>
        </div>
      ) : filteredContrats.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">Aucun contrat trouvé</p>
          <p className="text-sm text-gray-400 mt-1">
            {searchTerm ? `Aucun résultat pour "${searchTerm}"` : 'Créez votre premier contrat'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredContrats.map((contrat) => {
            const sty = STATUT_STYLE[contrat.statut] || STATUT_STYLE.ACTIF;
            const initials = (contrat.client?.nomEntreprise || clientMap.get(contrat.clientId) || '??').slice(0, 2).toUpperCase();
            return (
              <div key={contrat.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden hover:-translate-y-0.5"
                onClick={() => setSelectedContrat(contrat)}
              >
                <div className={`h-1 ${sty.bar}`} />
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 font-black text-sm text-green-700">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">
                          {contrat.client?.nomEntreprise || clientMap.get(contrat.clientId)}
                        </p>
                        {(contrat as any).nom && (
                          <p className="text-[11px] text-gray-500 truncate">{(contrat as any).nom}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sty.bg} ${sty.text}`}>
                            {contrat.statut}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${contrat.type === 'PONCTUEL' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                            {contrat.type === 'PONCTUEL' ? 'Ponctuel' : 'Annuel'}
                          </span>
                          {contrat.numeroBonCommande && (
                            <span className="text-[11px] text-gray-400">BC: {contrat.numeroBonCommande}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedContrat(contrat)}>Voir détail</DropdownMenuItem>
                          {canDo('editContrat') && (
                            <DropdownMenuItem onClick={() => setEditingContrat(contrat)}>Modifier</DropdownMenuItem>
                          )}
                          {canDo('deleteContrat') && (
                            <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTarget(contrat)}>Supprimer</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{formatDate(contrat.dateDebut)}</span>
                    {contrat.dateFin && <><span className="text-gray-300">→</span><span>{formatDate(contrat.dateFin)}</span></>}
                  </div>

                  {/* Sites */}
                  {contrat.contratSites && contrat.contratSites.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{contrat.contratSites.map(cs => cs.site?.nom).filter(Boolean).join(', ')}</span>
                      <span className="flex-shrink-0 text-gray-300">({contrat.contratSites.length})</span>
                    </div>
                  )}

                  {/* Prestations */}
                  {contrat.prestations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-50">
                      {contrat.prestations.slice(0, 4).map(p => (
                        <span key={p} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p}</span>
                      ))}
                      {contrat.prestations.length > 4 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">+{contrat.prestations.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedContrat} onOpenChange={(open) => { if (!open) { setSelectedContrat(null); setEditingInterventionId(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
          {selectedContrat && (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b">
                <div className="pr-8">
                  <h2 className="text-lg font-semibold truncate">
                    {selectedContrat.client?.nomEntreprise || clientMap.get(selectedContrat.clientId)}
                  </h2>
                  {selectedContrat.nom && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{selectedContrat.nom}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedContrat.type === 'PONCTUEL' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {selectedContrat.type === 'PONCTUEL' ? 'Ponctuel' : 'Annuel'}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedContrat.statut === 'ACTIF' ? 'bg-green-100 text-green-700' : selectedContrat.statut === 'TERMINE' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>
                      {selectedContrat.statut}
                    </span>
                    {selectedContrat.prestations.map((p) => (
                      <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p}</span>
                    ))}
                  </div>
                </div>

                {/* Compact info row */}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(selectedContrat.dateDebut)}
                    {selectedContrat.dateFin && <> → {formatDate(selectedContrat.dateFin)}</>}
                  </span>
                  {((selectedContrat as any).dateDebutConvention || (selectedContrat as any).dateFinConvention) && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Calendar className="h-3 w-3" />
                      Convention
                      {(selectedContrat as any).dateDebutConvention && <> signée le {formatDate((selectedContrat as any).dateDebutConvention)}</>}
                      {(selectedContrat as any).dateFinConvention && <> jusqu'au {formatDate((selectedContrat as any).dateFinConvention)}</>}
                    </span>
                  )}
                  {selectedContrat.responsablePlanning && (
                    <span>
                      {selectedContrat.responsablePlanning.prenom} {selectedContrat.responsablePlanning.nom}
                    </span>
                  )}
                  {selectedContrat.numeroBonCommande && (
                    <span>BC {selectedContrat.numeroBonCommande}</span>
                  )}
                  {selectedContrat.contratSites && selectedContrat.contratSites.length > 0 && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedContrat.contratSites.map(cs => cs.site?.nom).filter(Boolean).join(', ')}
                    </span>
                  )}
                  {selectedContratDetail?.interventions && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {selectedContratDetail.interventions.length} interventions
                    </span>
                  )}
                </div>
              </div>

              {/* Body — planning */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {selectedContrat.notes && (
                  <div className="text-xs text-muted-foreground bg-gray-50 rounded-md px-3 py-2 whitespace-pre-wrap">
                    {selectedContrat.notes}
                  </div>
                )}

                {selectedContratDetail?.interventions && selectedContratDetail.interventions.length > 0 ? (
                  (() => {
                    const today = new Date();
                    const bySite = selectedContratDetail.interventions!.reduce((acc, iv) => {
                      const key = iv.site?.nom || 'Sans site';
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(iv);
                      return acc;
                    }, {} as Record<string, typeof selectedContratDetail.interventions>);

                    return Object.entries(bySite).map(([siteName, ivs]) => (
                      <div key={siteName} className="rounded-lg border overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />
                          {siteName}
                          <span className="ml-auto text-gray-400 font-normal">{ivs!.length} intervention{ivs!.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="divide-y">
                          {ivs!.sort((a, b) => a.datePrevue.localeCompare(b.datePrevue)).map((iv) => {
                            const isPast = new Date(iv.datePrevue) < today;
                            const canEdit = iv.statut !== 'REALISEE' && iv.statut !== 'ANNULEE';
                            const isEditing = editingInterventionId === iv.id;
                            const rowColor =
                              iv.statut === 'REALISEE' ? 'bg-green-50/50' :
                              iv.statut === 'ANNULEE' ? 'bg-gray-50 opacity-50' :
                              isPast ? 'bg-red-50/40' :
                              iv.statut === 'PLANIFIEE' ? 'bg-blue-50/30' : '';

                            return (
                              <div key={iv.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${rowColor}`}>
                                {/* Type badge */}
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${iv.type === 'OPERATION' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                  {iv.type === 'OPERATION' ? 'OP' : 'VC'}
                                </span>

                                {/* Date — editable */}
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="date"
                                      className="text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                      value={editingDateValue}
                                      onChange={(e) => setEditingDateValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && editingDateValue)
                                          updateInterventionDateMutation.mutate({ id: iv.id, datePrevue: editingDateValue });
                                        if (e.key === 'Escape') setEditingInterventionId(null);
                                      }}
                                      autoFocus
                                    />
                                    <button
                                      className="text-green-600 hover:text-green-700 disabled:opacity-40"
                                      disabled={!editingDateValue || updateInterventionDateMutation.isPending}
                                      onClick={() => updateInterventionDateMutation.mutate({ id: iv.id, datePrevue: editingDateValue })}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button className="text-gray-400 hover:text-gray-600" onClick={() => setEditingInterventionId(null)}>
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className={`flex items-center gap-1 group ${canEdit ? 'cursor-pointer' : 'cursor-default'} ${iv.statut === 'ANNULEE' ? 'line-through text-gray-400' : iv.statut === 'REALISEE' ? 'text-green-700' : isPast ? 'text-red-600 font-semibold' : 'text-gray-800'}`}
                                    onClick={() => {
                                      if (!canEdit) return;
                                      setEditingInterventionId(iv.id);
                                      setEditingDateValue(iv.datePrevue.split('T')[0]);
                                    }}
                                  >
                                    <span className="font-medium">
                                      {new Date(iv.datePrevue).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                                    </span>
                                    {canEdit && <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />}
                                  </button>
                                )}

                                {/* Prestation */}
                                {iv.prestation && <span className="text-gray-400 truncate">{iv.prestation}</span>}

                                {/* Statut pill */}
                                <span className="ml-auto shrink-0">
                                  {iv.statut === 'REALISEE' ? (
                                    <span className="flex items-center gap-0.5 text-green-600 font-medium">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {iv.dateRealisee && new Date(iv.dateRealisee).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                    </span>
                                  ) : iv.statut === 'ANNULEE' ? (
                                    <span className="text-gray-400">Supprimée</span>
                                  ) : iv.statut === 'PLANIFIEE' ? (
                                    <span className="text-blue-600 font-medium">Planifiée</span>
                                  ) : isPast ? (
                                    <span className="text-red-500 font-semibold">En retard</span>
                                  ) : (
                                    <span className="text-gray-400">À planifier</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()
                ) : selectedContratDetail ? (
                  <div className="text-center text-sm text-muted-foreground py-8">Aucune intervention planifiée</div>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-8">Chargement du planning…</div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/contrats/${selectedContrat.id}`} className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Fiche complète
                  </Link>
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    asChild
                  >
                    <Link
                      to={`/commerce?tab=factures&contratId=${selectedContrat.id}&clientId=${selectedContrat.clientId}&siteId=${selectedContrat.contratSites?.[0]?.siteId || ''}&mentionSpeciale=${encodeURIComponent([selectedContrat.nom?.trim() ? `Contrat « ${selectedContrat.nom.trim()} »` : '', selectedContrat.refExterne ? `Selon le contrat N° ${(selectedContrat as any).refExterne}` : '', selectedContrat.numeroBonCommande ? `Selon le Bon de commande "${selectedContrat.numeroBonCommande}"` : '', (selectedContrat as any).dateDebutConvention ? `Convention signée le ${new Date((selectedContrat as any).dateDebutConvention).toLocaleDateString('fr-FR')}` : ''].filter(Boolean).join(' — '))}`}
                      onClick={() => setSelectedContrat(null)}
                    >
                      <Receipt className="h-3.5 w-3.5 mr-1.5" />
                      Créer une facture
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setEditingContrat(selectedContrat); setSelectedContrat(null); }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Modifier
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedContrat(null); setEditingInterventionId(null); }}>
                    Fermer
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Nouveau contrat</DialogTitle>
            <DialogDescription>
              Le planning sera généré automatiquement à la création.
            </DialogDescription>
          </DialogHeader>
          <ContratForm
            isEdit={false}
            {...formProps}
            onSubmit={(data) => {
              setPendingCreate(data);
              setConfirmCreateOpen(true);
            }}
            onCancel={() => setIsCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingContrat} onOpenChange={() => setEditingContrat(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Modifier le contrat</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations du contrat
            </DialogDescription>
          </DialogHeader>
          {editingContrat && (
            <ContratForm
              key={editingContrat.id}
              contrat={editingContrat}
              isEdit={true}
              {...formProps}
              onSubmit={(data) => updateMutation.mutate({ id: editingContrat.id, data })}
              onCancel={() => setEditingContrat(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la création</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous créer ce contrat ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCreateOpen(false)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingCreate) createMutation.mutate(pendingCreate);
                setPendingCreate(null);
                setConfirmCreateOpen(false);
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive et supprime le contrat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  );
}
