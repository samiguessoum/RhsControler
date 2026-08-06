import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, MoreVertical, FileText, CalendarClock, MapPin, Trash2, X, ChevronDown, ChevronUp, Search, Clock, CheckCircle2, Calendar, Pencil, Check } from 'lucide-react';
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
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { Contrat, CreateContratInput, Client, User, Frequence, ContratStatut, ContratType, ContratSiteInput } from '@/types';

function computeProjectionDates(
  premierDate: string,
  nbOps: number | undefined,
  frequenceJours: number | undefined,
  dateFin?: string,
): string[] {
  if (!premierDate || !frequenceJours) return [];
  const dates: string[] = [];
  const start = new Date(premierDate + 'T12:00:00');
  if (nbOps && nbOps > 0) {
    for (let i = 0; i < nbOps; i++) {
      const d = new Date(start.getTime() + i * frequenceJours * 86400000);
      dates.push(d.toISOString().split('T')[0]);
    }
  } else if (dateFin) {
    const fin = new Date(dateFin + 'T12:00:00');
    let d = new Date(start);
    let safety = 0;
    while (d <= fin && safety < 120) {
      dates.push(d.toISOString().split('T')[0]);
      d = new Date(d.getTime() + frequenceJours * 86400000);
      safety++;
    }
  }
  return dates;
}

const FREQUENCES: Frequence[] = [
  'HEBDOMADAIRE',
  'MENSUELLE',
  'TRIMESTRIELLE',
  'SEMESTRIELLE',
  'ANNUELLE',
  'PERSONNALISEE',
];

const FREQUENCE_LABELS: Record<Frequence, string> = {
  HEBDOMADAIRE: 'Hebdomadaire',
  MENSUELLE: 'Mensuelle',
  TRIMESTRIELLE: 'Trimestrielle',
  SEMESTRIELLE: 'Semestrielle',
  ANNUELLE: 'Annuelle',
  PERSONNALISEE: 'Personnalisée',
};

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
    queryFn: () => contratsApi.list({ clientId: clientIdFilter, limit: 200 }),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients-active'],
    queryFn: () => clientsApi.list({ actif: true, limit: 200 }),
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

  const submitContrat = (data: CreateContratInput, isEdit: boolean) => {
    if (isEdit && editingContrat) {
      updateMutation.mutate({ id: editingContrat.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const ContratForm = ({
    contrat,
    isEdit,
  }: {
    contrat?: Contrat;
    isEdit: boolean;
  }) => {
    const defaultClientId = clientIdFilter || contrat?.clientId || '';
    const [clientId, setClientId] = useState<string | undefined>(defaultClientId || undefined);
    const [type, setType] = useState<ContratType>(contrat?.type || 'ANNUEL');
    const [responsablePlanningId, setResponsablePlanningId] = useState<string | undefined>(contrat?.responsablePlanningId || undefined);
    const [statut, setStatut] = useState<ContratStatut>(contrat?.statut || 'ACTIF');
    const [dateDebut, setDateDebut] = useState(contrat?.dateDebut?.split('T')[0] || '');
    const [dateFin, setDateFin] = useState(contrat?.dateFin?.split('T')[0] || '');

    const handleDateDebutChange = (value: string) => {
      setDateDebut(value);
      // Pour un contrat annuel, suggérer automatiquement la date de fin à +1 an
      if (type === 'ANNUEL' && value) {
        const fin = new Date(value);
        fin.setFullYear(fin.getFullYear() + 1);
        setDateFin(fin.toISOString().split('T')[0]);
      }
    };

    // State pour le select d'ajout de site (permet de réinitialiser après sélection)
    const [siteSelectKey, setSiteSelectKey] = useState(0);

    // Sites configuration avec prestations
    const [contratSites, setContratSites] = useState<ContratSiteInput[]>(
      contrat?.contratSites?.map(cs => ({
        siteId: cs.siteId,
        prestations: cs.prestations || [],
        prixPrestations: (cs.prixPrestations as Record<string, number>) || {},
        frequenceOperations: cs.frequenceOperations || undefined,
        frequenceOperationsJours: cs.frequenceOperationsJours ?? undefined,
        frequenceControle: cs.frequenceControle || undefined,
        frequenceControleJours: cs.frequenceControleJours ?? undefined,
        premiereDateOperation: cs.premiereDateOperation?.split('T')[0],
        premiereDateControle: cs.premiereDateControle?.split('T')[0],
        nombreOperations: cs.nombreOperations ?? undefined,
        nombreVisitesControle: cs.nombreVisitesControle ?? undefined,
        notes: cs.notes ?? undefined,
      })) || []
    );

    // État pour les sites dépliés/repliés
    const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());

    // Get selected client's sites
    const selectedClient = clients.find(c => c.id === clientId);
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
        // Auto-recompute ops dates when schedule params change
        if ('premiereDateOperation' in updates || 'frequenceOperationsJours' in updates || 'nombreOperations' in updates) {
          updated.datesPrevuesOperations = computeProjectionDates(
            updated.premiereDateOperation || '',
            updated.nombreOperations,
            updated.frequenceOperationsJours,
            dateFin || undefined,
          );
        }
        // Auto-recompute controls dates when schedule params change
        if ('premiereDateControle' in updates || 'frequenceControleJours' in updates || 'nombreVisitesControle' in updates) {
          updated.datesPrevuesControles = computeProjectionDates(
            updated.premiereDateControle || '',
            updated.nombreVisitesControle,
            updated.frequenceControleJours,
            dateFin || undefined,
          );
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

    const resetSiteDates = (siteId: string, type: 'ops' | 'ctrl') => {
      const cs = contratSites.find(s => s.siteId === siteId);
      if (!cs) return;
      if (type === 'ops') {
        updateSite(siteId, { datesPrevuesOperations: computeProjectionDates(cs.premiereDateOperation || '', cs.nombreOperations, cs.frequenceOperationsJours, dateFin || undefined) });
      } else {
        updateSite(siteId, { datesPrevuesControles: computeProjectionDates(cs.premiereDateControle || '', cs.nombreVisitesControle, cs.frequenceControleJours, dateFin || undefined) });
      }
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
              if (isPonctuel) {
                // Pour les ponctuels : au moins un nombre d'opérations ou de contrôles
                if (!cs.nombreOperations && !cs.nombreVisitesControle) {
                  const siteName = availableSites.find(s => s.id === cs.siteId)?.nom || 'Site';
                  toast.error(`Indiquez le nombre d'opérations ou de contrôles pour ${siteName}`);
                  return;
                }
              } else {
                // Pour les annuels : au moins une fréquence
                if (!cs.frequenceOperations && !cs.frequenceControle) {
                  const siteName = availableSites.find(s => s.id === cs.siteId)?.nom || 'Site';
                  toast.error(`Configurez au moins une fréquence pour ${siteName}`);
                  return;
                }
              }
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
            frequenceOperations: cs.frequenceOperations || undefined,
            frequenceOperationsJours: cs.frequenceOperationsJours ?? undefined,
            frequenceControle: cs.frequenceControle || undefined,
            frequenceControleJours: cs.frequenceControleJours ?? undefined,
            nombreOperations: cs.nombreOperations ?? undefined,
            nombreVisitesControle: cs.nombreVisitesControle ?? undefined,
            notes: cs.notes ?? undefined,
          }));

          const data: CreateContratInput = {
            clientId: clientId as string,
            type,
            dateDebut: dateDebut,
            dateFin: dateFin || undefined,
            reconductionAuto: formData.get('reconductionAuto') === 'on',
            prestations: allSitePrestations, // Toutes les prestations de tous les sites
            responsablePlanningId,
            statut,
            notes: (formData.get('notes') as string) || undefined,
            autoCreerProchaine: true,
            // Ponctuel fields
            numeroBonCommande: isPonctuel ? (formData.get('numeroBonCommande') as string) : undefined,
            // Sites avec leurs configurations
            contratSites: cleanedContratSites,
          };

          if (isEdit) {
            submitContrat(data, true);
          } else {
            setPendingCreate(data);
            setConfirmCreateOpen(true);
          }
        }}
        className="space-y-5 max-h-[70vh] overflow-y-auto pr-2"
      >
        {/* Section 1: Informations de base */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-sm text-gray-700">Informations générales</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client: Client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nomEntreprise}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as ContratType)}>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date début *</Label>
              <Input
                type="date"
                value={dateDebut}
                onChange={(e) => handleDateDebutChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>
                {isPonctuel ? 'Date fin (optionnel)' : 'Date fin'}
                {!isPonctuel && dateFin && (
                  <span className="ml-2 text-xs font-normal text-green-600">← suggérée automatiquement</span>
                )}
              </Label>
              <Input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Champs spécifiques ponctuel */}
        {isPonctuel && (
          <div className="space-y-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="font-medium text-sm text-yellow-800">Contrat ponctuel</h3>
            <div className="space-y-2">
              <Label>N° Bon de commande *</Label>
              <Input
                name="numeroBonCommande"
                defaultValue={contrat?.numeroBonCommande || ''}
                placeholder="Ex: BC-2024-001"
                required={isPonctuel}
              />
            </div>
          </div>
        )}

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

                  return (
                    <div key={cs.siteId} className="bg-white rounded border overflow-hidden">
                      {/* En-tête du site */}
                      <div
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleSiteExpansion(cs.siteId)}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          <span className="font-medium">{site?.nom || 'Site'}</span>
                          {sitePrestations.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {sitePrestations.length} prestation(s)
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
                        <div className="p-3 border-t space-y-4">
                          {/* Prestations du site */}
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Prestations *</Label>
                            {availablePrestationsForSite.length > 0 && (
                              <Select onValueChange={(v) => addPrestationToSite(cs.siteId, v)}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Ajouter une prestation" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availablePrestationsForSite.map((p) => (
                                    <SelectItem key={p.id} value={p.nom}>
                                      {p.nom}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {sitePrestations.length > 0 && (
                              <div className="space-y-1.5">
                                {sitePrestations.map((nom) => (
                                  <div key={nom} className="flex items-center gap-2 p-1.5 bg-white rounded border border-gray-100">
                                    {/* Nom */}
                                    <span className="text-xs font-medium text-gray-700 flex-1 min-w-0 truncate">{nom}</span>
                                    {/* Prix */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Input
                                        type="number"
                                        min={0}
                                        step={100}
                                        className="h-6 w-24 text-xs px-2"
                                        placeholder="Prix DA"
                                        value={(cs.prixPrestations?.[nom]) ?? ''}
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
                                      <span className="text-[10px] text-gray-400">DA</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removePrestationFromSite(cs.siteId, nom)}
                                      className="hover:bg-gray-100 rounded-full p-0.5 flex-shrink-0"
                                    >
                                      <X className="h-3 w-3 text-gray-400" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Opérations + Contrôles — affichage selon le type de contrat */}
                          <div className="grid grid-cols-2 gap-3">

                            {/* ─── Opérations ─── */}
                            <div className={`space-y-2 p-3 rounded-lg border ${isPonctuel ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                              <p className={`text-xs font-semibold ${isPonctuel ? 'text-amber-700' : 'text-gray-600'}`}>
                                Opérations {isPonctuel ? '— quota' : '— fréquence'}
                              </p>

                              {isPonctuel ? (
                                /* PONCTUEL : nombre total d'opérations à réaliser */
                                <div className="space-y-1.5">
                                  <span className="text-xs text-gray-500">Nombre d'opérations prévu *</span>
                                  <Input
                                    type="number"
                                    className="h-8"
                                    min={1}
                                    placeholder="Ex : 4"
                                    value={cs.nombreOperations || ''}
                                    onChange={(e) => updateSite(cs.siteId, { nombreOperations: e.target.value ? Number(e.target.value) : undefined })}
                                  />
                                </div>
                              ) : (
                                /* ANNUEL : intervalle en jours */
                                <div className="space-y-1.5">
                                  <span className="text-xs text-gray-500">Toutes les X jours *</span>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      className="h-8"
                                      min={1}
                                      placeholder="Ex : 30"
                                      value={cs.frequenceOperationsJours || ''}
                                      onChange={(e) => updateSite(cs.siteId, {
                                        frequenceOperationsJours: e.target.value ? Number(e.target.value) : undefined,
                                        frequenceOperations: e.target.value ? 'PERSONNALISEE' : undefined,
                                      })}
                                    />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">jours</span>
                                  </div>
                                  {cs.frequenceOperationsJours && (
                                    <p className="text-xs text-green-700 font-medium">
                                      ≈ {Math.round(365 / cs.frequenceOperationsJours)}x / an
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Date première opération — commun aux deux types */}
                              <div className="space-y-1">
                                <span className="text-xs text-gray-500">Date de la 1ère opération</span>
                                <Input
                                  type="date"
                                  className="h-8"
                                  value={cs.premiereDateOperation || ''}
                                  onChange={(e) => updateSite(cs.siteId, { premiereDateOperation: e.target.value })}
                                />
                              </div>
                            </div>

                            {/* ─── Contrôles ─── */}
                            <div className={`space-y-2 p-3 rounded-lg border ${isPonctuel ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                              <p className={`text-xs font-semibold ${isPonctuel ? 'text-amber-700' : 'text-gray-600'}`}>
                                Contrôles {isPonctuel ? '— quota' : '— fréquence'}
                              </p>

                              {isPonctuel ? (
                                /* PONCTUEL : nombre total de contrôles */
                                <div className="space-y-1.5">
                                  <span className="text-xs text-gray-500">Nombre de contrôles prévu</span>
                                  <Input
                                    type="number"
                                    className="h-8"
                                    min={1}
                                    placeholder="Ex : 1"
                                    value={cs.nombreVisitesControle || ''}
                                    onChange={(e) => updateSite(cs.siteId, { nombreVisitesControle: e.target.value ? Number(e.target.value) : undefined })}
                                  />
                                </div>
                              ) : (
                                /* ANNUEL : intervalle en jours */
                                <div className="space-y-1.5">
                                  <span className="text-xs text-gray-500">Toutes les X jours</span>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      className="h-8"
                                      min={1}
                                      placeholder="Ex : 90"
                                      value={cs.frequenceControleJours || ''}
                                      onChange={(e) => updateSite(cs.siteId, {
                                        frequenceControleJours: e.target.value ? Number(e.target.value) : undefined,
                                        frequenceControle: e.target.value ? 'PERSONNALISEE' : undefined,
                                      })}
                                    />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">jours</span>
                                  </div>
                                  {cs.frequenceControleJours && (
                                    <p className="text-xs text-green-700 font-medium">
                                      ≈ {Math.round(365 / cs.frequenceControleJours)}x / an
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Date première visite de contrôle — commun aux deux types */}
                              <div className="space-y-1">
                                <span className="text-xs text-gray-500">Date de la 1ère visite</span>
                                <Input
                                  type="date"
                                  className="h-8"
                                  value={cs.premiereDateControle || ''}
                                  onChange={(e) => updateSite(cs.siteId, { premiereDateControle: e.target.value })}
                                />
                              </div>
                            </div>

                          </div>

                          {/* ─── Projection des dates ─── */}
                          {(cs.datesPrevuesOperations?.length || cs.datesPrevuesControles?.length) && (
                            <div className="space-y-3 pt-2 border-t border-gray-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Projection des dates</p>

                              {cs.datesPrevuesOperations && cs.datesPrevuesOperations.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-600">
                                      Opérations ({cs.datesPrevuesOperations.length})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => resetSiteDates(cs.siteId, 'ops')}
                                      className="text-xs text-blue-500 hover:text-blue-700"
                                    >
                                      ↺ Recalculer
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {cs.datesPrevuesOperations.map((date, i) => (
                                      <div key={i} className="flex items-center gap-1">
                                        <span className="text-[10px] text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                                        <Input
                                          type="date"
                                          className="h-7 text-xs px-1.5"
                                          value={date}
                                          onChange={(e) => updateSiteDate(cs.siteId, 'ops', i, e.target.value)}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {cs.datesPrevuesControles && cs.datesPrevuesControles.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-600">
                                      Contrôles ({cs.datesPrevuesControles.length})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => resetSiteDates(cs.siteId, 'ctrl')}
                                      className="text-xs text-blue-500 hover:text-blue-700"
                                    >
                                      ↺ Recalculer
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {cs.datesPrevuesControles.map((date, i) => (
                                      <div key={i} className="flex items-center gap-1">
                                        <span className="text-[10px] text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                                        <Input
                                          type="date"
                                          className="h-7 text-xs px-1.5"
                                          value={date}
                                          onChange={(e) => updateSiteDate(cs.siteId, 'ctrl', i, e.target.value)}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Responsable planning</Label>
              <Select value={responsablePlanningId || ''} onValueChange={(v) => setResponsablePlanningId(v || undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u: User) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.prenom} {u.nom}
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

          <div className="flex items-center gap-6 pt-2">
            {!isPonctuel && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="reconductionAuto" defaultChecked={contrat?.reconductionAuto} className="rounded" />
                Reconduction automatique
              </label>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => (isEdit ? setEditingContrat(null) : setIsCreateOpen(false))}>
            Annuler
          </Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Créer le contrat')}
          </Button>
        </DialogFooter>
      </form>
    );
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
              placeholder="Entreprise, prestation, BC..."
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
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate">
                      {selectedContrat.client?.nomEntreprise || clientMap.get(selectedContrat.clientId)}
                    </h2>
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => { setEditingContrat(selectedContrat); setSelectedContrat(null); }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Modifier
                  </Button>
                </div>

                {/* Compact info row */}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(selectedContrat.dateDebut)}
                    {selectedContrat.dateFin && <> → {formatDate(selectedContrat.dateFin)}</>}
                  </span>
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
                                  {iv.type === 'OPERATION' ? 'OP' : 'CTRL'}
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
                                    <span className="text-gray-400">Annulée</span>
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
                <Button variant="outline" size="sm" onClick={() => { setSelectedContrat(null); setEditingInterventionId(null); }}>
                  Fermer
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Nouveau contrat</DialogTitle>
            <DialogDescription>
              Le planning sera généré automatiquement à la création.
            </DialogDescription>
          </DialogHeader>
          <ContratForm isEdit={false} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingContrat} onOpenChange={() => setEditingContrat(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Modifier le contrat</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations du contrat
            </DialogDescription>
          </DialogHeader>
          {editingContrat && <ContratForm contrat={editingContrat} isEdit={true} />}
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
