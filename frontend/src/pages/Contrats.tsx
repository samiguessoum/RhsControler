import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, MoreVertical, FileText, CalendarClock, MapPin, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { clientsApi, contratsApi, prestationsApi, usersApi } from '@/services/api';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { Contrat, CreateContratInput, Client, User, Frequence, ContratStatut, ContratType, ContratSiteInput } from '@/types';

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

    // State pour le select d'ajout de site (permet de réinitialiser après sélection)
    const [siteSelectKey, setSiteSelectKey] = useState(0);

    // Sites configuration avec prestations
    const [contratSites, setContratSites] = useState<ContratSiteInput[]>(
      contrat?.contratSites?.map(cs => ({
        siteId: cs.siteId,
        prestations: cs.prestations || [],
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
      setContratSites(contratSites.map(cs =>
        cs.siteId === siteId ? { ...cs, ...updates } : cs
      ));
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
              if (!cs.frequenceOperations && !cs.frequenceControle) {
                const siteName = availableSites.find(s => s.id === cs.siteId)?.nom || 'Site';
                toast.error(`Configurez au moins une fréquence pour ${siteName}`);
                return;
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
            dateDebut: formData.get('dateDebut') as string,
            dateFin: (formData.get('dateFin') as string) || undefined,
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
                name="dateDebut"
                defaultValue={contrat?.dateDebut?.split('T')[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{isPonctuel ? 'Date fin (optionnel)' : 'Date fin'}</Label>
              <Input
                type="date"
                name="dateFin"
                defaultValue={contrat?.dateFin?.split('T')[0]}
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
                              <div className="flex flex-wrap gap-1">
                                {sitePrestations.map((nom) => (
                                  <Badge key={nom} variant="outline" className="pl-2 pr-1 py-0.5 text-xs flex items-center gap-1">
                                    {nom}
                                    <button
                                      type="button"
                                      onClick={() => removePrestationFromSite(cs.siteId, nom)}
                                      className="hover:bg-gray-200 rounded-full p-0.5"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Fréquences et dates */}
                          <div className="grid grid-cols-2 gap-3">
                            {/* Opérations */}
                            <div className="space-y-2 p-2 bg-gray-50 rounded">
                              <Label className="text-xs font-medium text-gray-600">Opérations</Label>
                              <Select
                                value={cs.frequenceOperations || ''}
                                onValueChange={(v) => updateSite(cs.siteId, { frequenceOperations: v as Frequence || undefined })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Fréquence" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FREQUENCES.map((f) => (
                                    <SelectItem key={f} value={f}>{FREQUENCE_LABELS[f]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {cs.frequenceOperations === 'PERSONNALISEE' && (
                                <Input
                                  type="number"
                                  className="h-8"
                                  min={1}
                                  placeholder="Intervalle en jours"
                                  value={cs.frequenceOperationsJours || ''}
                                  onChange={(e) => updateSite(cs.siteId, { frequenceOperationsJours: e.target.value ? Number(e.target.value) : undefined })}
                                />
                              )}
                              <div className="space-y-1">
                                <span className="text-xs text-gray-500">1ère opération</span>
                                <Input
                                  type="date"
                                  className="h-8"
                                  value={cs.premiereDateOperation || ''}
                                  onChange={(e) => updateSite(cs.siteId, { premiereDateOperation: e.target.value })}
                                />
                              </div>
                              <Input
                                type="number"
                                className="h-8"
                                min={1}
                                placeholder="Nb opérations"
                                value={cs.nombreOperations || ''}
                                onChange={(e) => updateSite(cs.siteId, { nombreOperations: e.target.value ? Number(e.target.value) : undefined })}
                              />
                            </div>

                            {/* Contrôles */}
                            <div className="space-y-2 p-2 bg-gray-50 rounded">
                              <Label className="text-xs font-medium text-gray-600">Visites de contrôle</Label>
                              <Select
                                value={cs.frequenceControle || ''}
                                onValueChange={(v) => updateSite(cs.siteId, { frequenceControle: v as Frequence || undefined })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Fréquence" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FREQUENCES.map((f) => (
                                    <SelectItem key={f} value={f}>{FREQUENCE_LABELS[f]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {cs.frequenceControle === 'PERSONNALISEE' && (
                                <Input
                                  type="number"
                                  className="h-8"
                                  min={1}
                                  placeholder="Intervalle en jours"
                                  value={cs.frequenceControleJours || ''}
                                  onChange={(e) => updateSite(cs.siteId, { frequenceControleJours: e.target.value ? Number(e.target.value) : undefined })}
                                />
                              )}
                              <div className="space-y-1">
                                <span className="text-xs text-gray-500">1ère visite de contrôle</span>
                                <Input
                                  type="date"
                                  className="h-8"
                                  value={cs.premiereDateControle || ''}
                                  onChange={(e) => updateSite(cs.siteId, { premiereDateControle: e.target.value })}
                                />
                              </div>
                              <Input
                                type="number"
                                className="h-8"
                                min={1}
                                placeholder="Nb contrôles"
                                value={cs.nombreVisitesControle || ''}
                                onChange={(e) => updateSite(cs.siteId, { nombreVisitesControle: e.target.value ? Number(e.target.value) : undefined })}
                              />
                            </div>
                          </div>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contrats</h1>
          <p className="text-muted-foreground">
            Gestion des contrats et fréquences
          </p>
        </div>
        {canDo('createContrat') && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau contrat
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="search-contrats">Recherche</Label>
              <Input
                id="search-contrats"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Entreprise, prestation, BC..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              <div className="space-y-1">
                <Label>Statut</Label>
                <Select
                  value={statutFilter}
                  onValueChange={(v) => setStatutFilter(v as ContratStatut | 'ALL')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous</SelectItem>
                    <SelectItem value="ACTIF">Actif</SelectItem>
                    <SelectItem value="SUSPENDU">Suspendu</SelectItem>
                    <SelectItem value="TERMINE">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={typeFilter}
                  onValueChange={(v) => setTypeFilter(v as ContratType | 'ALL')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous</SelectItem>
                    <SelectItem value="ANNUEL">Annuel</SelectItem>
                    <SelectItem value="PONCTUEL">Ponctuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Entreprise</Label>
                <Select
                  value={clientFilter}
                  onValueChange={(v) => setClientFilter(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.nomEntreprise}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : filteredContrats.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun contrat enregistré
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredContrats.map((contrat) => (
            <Card
              key={contrat.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedContrat(contrat)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {contrat.client?.nomEntreprise || clientMap.get(contrat.clientId)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {contrat.type === 'PONCTUEL' ? (
                          <span className="text-yellow-600 font-medium">Ponctuel</span>
                        ) : (
                          'Annuel'
                        )} • {contrat.statut}
                        {contrat.numeroBonCommande && (
                          <span className="ml-2 text-xs">BC: {contrat.numeroBonCommande}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContrat(contrat);
                        }}
                      >
                        Voir détail
                      </DropdownMenuItem>
                      {canDo('editContrat') && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingContrat(contrat);
                          }}
                        >
                          Modifier
                        </DropdownMenuItem>
                      )}
                      {canDo('deleteContrat') && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(contrat);
                          }}
                        >
                          Supprimer
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4 inline mr-2" />
                  Début: {formatDate(contrat.dateDebut)} {contrat.dateFin && `• Fin: ${formatDate(contrat.dateFin)}`}
                </div>
                {contrat.contratSites && contrat.contratSites.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 inline mr-2" />
                    {contrat.contratSites.length} site(s): {contrat.contratSites.map(cs => cs.site?.nom).join(', ')}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {contrat.prestations.slice(0, 4).map((p) => (
                    <Badge key={p} variant="outline" className="text-xs">
                      {p}
                    </Badge>
                  ))}
                  {contrat.prestations.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{contrat.prestations.length - 4}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedContrat} onOpenChange={(open) => !open && setSelectedContrat(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              Contrat - {selectedContrat?.client?.nomEntreprise || (selectedContrat?.clientId && clientMap.get(selectedContrat.clientId))}
            </DialogTitle>
            <DialogDescription>
              {selectedContrat?.type === 'PONCTUEL' ? 'Ponctuel' : 'Annuel'} • {selectedContrat?.statut}
            </DialogDescription>
          </DialogHeader>

          {selectedContrat && (
            <div className="space-y-4 overflow-auto pr-1 max-h-[70vh]">
              <div className="flex flex-wrap gap-2">
                {selectedContrat.prestations.map((p) => (
                  <Badge key={p} variant="outline" className="text-xs">
                    {p}
                  </Badge>
                ))}
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Début:</span>{' '}
                  <span className="font-medium">{formatDate(selectedContrat.dateDebut)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fin:</span>{' '}
                  <span className="font-medium">
                    {selectedContrat.dateFin ? formatDate(selectedContrat.dateFin) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Responsable:</span>{' '}
                  <span className="font-medium">
                    {selectedContrat.responsablePlanning
                      ? `${selectedContrat.responsablePlanning.prenom} ${selectedContrat.responsablePlanning.nom}`.trim()
                      : '—'}
                  </span>
                </div>
                {selectedContrat.numeroBonCommande && (
                  <div>
                    <span className="text-muted-foreground">BC:</span>{' '}
                    <span className="font-medium">{selectedContrat.numeroBonCommande}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Reconduction auto:</span>{' '}
                  <span className="font-medium">{selectedContrat.reconductionAuto ? 'Oui' : 'Non'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Auto-créer prochaine:</span>{' '}
                  <span className="font-medium">{selectedContrat.autoCreerProchaine ? 'Oui' : 'Non'}</span>
                </div>
                {selectedContrat.nombreOperations !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Nombre opérations:</span>{' '}
                    <span className="font-medium">{selectedContrat.nombreOperations ?? '—'}</span>
                  </div>
                )}
                {selectedContrat.frequenceOperations && (
                  <div>
                    <span className="text-muted-foreground">Fréquence opérations:</span>{' '}
                    <span className="font-medium">
                      {FREQUENCE_LABELS[selectedContrat.frequenceOperations]}
                    </span>
                  </div>
                )}
                {selectedContrat.frequenceControle && (
                  <div>
                    <span className="text-muted-foreground">Fréquence contrôles:</span>{' '}
                    <span className="font-medium">
                      {FREQUENCE_LABELS[selectedContrat.frequenceControle]}
                    </span>
                  </div>
                )}
                {selectedContrat.premiereDateOperation && (
                  <div>
                    <span className="text-muted-foreground">1ère opération:</span>{' '}
                    <span className="font-medium">{formatDate(selectedContrat.premiereDateOperation)}</span>
                  </div>
                )}
                {selectedContrat.premiereDateControle && (
                  <div>
                    <span className="text-muted-foreground">1er contrôle:</span>{' '}
                    <span className="font-medium">{formatDate(selectedContrat.premiereDateControle)}</span>
                  </div>
                )}
              </div>

              {selectedContrat.contratSites && selectedContrat.contratSites.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Sites</h4>
                    {selectedContrat.contratSites.map((cs) => (
                      <div key={cs.id} className="rounded-md border p-3 text-sm space-y-2">
                        <div className="font-medium">
                          {cs.site?.nom}
                          {cs.site?.adresse ? ` — ${cs.site.adresse}` : ''}
                        </div>
                        {cs.prestations?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {cs.prestations.map((p) => (
                              <Badge key={p} variant="outline" className="text-xs">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                          {cs.frequenceOperations && (
                            <div>Fréquence opérations: {FREQUENCE_LABELS[cs.frequenceOperations]}</div>
                          )}
                          {cs.frequenceControle && (
                            <div>Fréquence contrôles: {FREQUENCE_LABELS[cs.frequenceControle]}</div>
                          )}
                          {cs.premiereDateOperation && (
                            <div>1ère opération: {formatDate(cs.premiereDateOperation)}</div>
                          )}
                          {cs.premiereDateControle && (
                            <div>1er contrôle: {formatDate(cs.premiereDateControle)}</div>
                          )}
                          {cs.nombreOperations !== undefined && (
                            <div>Nb opérations: {cs.nombreOperations ?? '—'}</div>
                          )}
                          {cs.nombreVisitesControle !== undefined && (
                            <div>Nb contrôles: {cs.nombreVisitesControle ?? '—'}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {selectedContrat.notes && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <div className="text-muted-foreground">Notes</div>
                    <div className="mt-1 whitespace-pre-wrap">{selectedContrat.notes}</div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedContrat(null)}>
              Fermer
            </Button>
            <Button asChild>
              <Link to={`/contrats/${selectedContrat?.id}`}>Ouvrir la fiche</Link>
            </Button>
          </DialogFooter>
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
  );
}
