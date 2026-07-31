import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, MoreVertical, Building2, Hash, Users, Briefcase, Wrench, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
import api, { prestationsApi, usersApi, employesApi, postesApi, settingsApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import type { Prestation, User, Role, Employe, Poste, CompanySettings, UpdateCompanySettingsInput } from '@/types';

export function ParametresPage() {
  const queryClient = useQueryClient();
  const { canDo, user: currentUser } = useAuthStore();

  const [isCreatePrestationOpen, setIsCreatePrestationOpen] = useState(false);
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null);
  const [pendingPrestation, setPendingPrestation] = useState<{ nom: string; ordre?: number; description?: string } | null>(null);
  const [confirmPrestationCreateOpen, setConfirmPrestationCreateOpen] = useState(false);
  const [deletePrestationTarget, setDeletePrestationTarget] = useState<Prestation | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [newUserRole, setNewUserRole] = useState<Role>('COORDINATEUR');
  const [newUserEmployeId, setNewUserEmployeId] = useState<string>('');
  const [newUserCreateEmploye, setNewUserCreateEmploye] = useState(false);
  const [newUserPosteIds, setNewUserPosteIds] = useState<string[]>([]);
  const [newUserDateEntree, setNewUserDateEntree] = useState<string>('');
  const [editUserRole, setEditUserRole] = useState<Role>('COORDINATEUR');
  const [editUserEmployeId, setEditUserEmployeId] = useState<string>('');
  const [isCreateEmployeOpen, setIsCreateEmployeOpen] = useState(false);
  const [editingEmploye, setEditingEmploye] = useState<Employe | null>(null);
  const [viewingEmploye, setViewingEmploye] = useState<Employe | null>(null);
  const [deleteEmployeTarget, setDeleteEmployeTarget] = useState<Employe | null>(null);
  const [newEmployePosteIds, setNewEmployePosteIds] = useState<string[]>([]);
  const [newEmployeSalaire, setNewEmployeSalaire] = useState<string>('');
  const [newEmployeDateEntree, setNewEmployeDateEntree] = useState<string>('');
  const [editEmployePosteIds, setEditEmployePosteIds] = useState<string[]>([]);
  const [editEmployeSalaire, setEditEmployeSalaire] = useState<string>('');
  const [editEmployeDateEntree, setEditEmployeDateEntree] = useState<string>('');
  const [employeSearch, setEmployeSearch] = useState('');
  const [isCreatePosteOpen, setIsCreatePosteOpen] = useState(false);
  const [editingPoste, setEditingPoste] = useState<Poste | null>(null);
  const [deletePosteTarget, setDeletePosteTarget] = useState<Poste | null>(null);

  // Settings state
  const [settingsForm, setSettingsForm] = useState<UpdateCompanySettingsInput>({});
  const [activeTab, setActiveTab] = useState('entreprise');

  // Conges state
  const [congesAnnee, setCongesAnnee] = useState(new Date().getFullYear());
  const [congesMode, setCongesMode] = useState<'ANNUEL' | 'MENSUEL'>('MENSUEL');
  const [congesJoursAnnuels, setCongesJoursAnnuels] = useState(30);
  const [congesJoursMensuels, setCongesJoursMensuels] = useState(2.5);
  const [congesMoisCredit, setCongesMoisCredit] = useState(new Date().getMonth() + 1);
  // Ajustement manuel
  const [ajustEmployeId, setAjustEmployeId] = useState('');
  const [ajustJours, setAjustJours] = useState('');
  const [ajustSens, setAjustSens] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [ajustMotif, setAjustMotif] = useState('');

  // Query for settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
    enabled: canDo('manageSettings'),
  });

  // Update settingsForm when settings are loaded
  useEffect(() => {
    if (settings) {
      setSettingsForm({
        nomEntreprise: settings.nomEntreprise,
        formeJuridique: settings.formeJuridique || '',
        adresse: settings.adresse || '',
        codePostal: settings.codePostal || '',
        ville: settings.ville || '',
        pays: settings.pays || '',
        telephone: settings.telephone || '',
        fax: settings.fax || '',
        email: settings.email || '',
        siteWeb: settings.siteWeb || '',
        rc: settings.rc || '',
        nif: settings.nif || '',
        ai: settings.ai || '',
        nis: settings.nis || '',
        nin: settings.nin || '',
        compteBancaire: settings.compteBancaire || '',
        rib: settings.rib || '',
        banque: settings.banque || '',
        devisePrincipale: settings.devisePrincipale,
        tauxTVADefaut: settings.tauxTVADefaut,
        prefixDevis: settings.prefixDevis,
        prefixCommande: settings.prefixCommande,
        prefixFacture: settings.prefixFacture,
        prefixAvoir: settings.prefixAvoir,
        prefixCommandeFournisseur: settings.prefixCommandeFournisseur,
        prefixFactureFournisseur: settings.prefixFactureFournisseur,
        prefixCharge: settings.prefixCharge,
        prefixClient: settings.prefixClient,
        prefixFournisseur: settings.prefixFournisseur,
        prefixProspect: settings.prefixProspect,
        prefixProduit: settings.prefixProduit,
        prefixService: settings.prefixService,
        longueurNumero: settings.longueurNumero,
        inclureAnnee: settings.inclureAnnee,
        separateur: settings.separateur,
        // Décalages de numérotation
        offsetDevis: settings.offsetDevis || 0,
        offsetCommande: settings.offsetCommande || 0,
        offsetFacture: settings.offsetFacture || 0,
        offsetAvoir: settings.offsetAvoir || 0,
        offsetCommandeFournisseur: settings.offsetCommandeFournisseur || 0,
        offsetFactureFournisseur: settings.offsetFactureFournisseur || 0,
        offsetCharge: settings.offsetCharge || 0,
        offsetClient: settings.offsetClient || 0,
        offsetFournisseur: settings.offsetFournisseur || 0,
        offsetProspect: settings.offsetProspect || 0,
      });
      // Initialiser les états congés depuis les settings
      setCongesMode((settings.modeAllocationConges as 'ANNUEL' | 'MENSUEL') || 'ANNUEL');
      setCongesJoursAnnuels(settings.joursCongesAnnuels ?? 30);
      setCongesJoursMensuels(settings.joursCongesMensuels ?? 2.5);
    }
  }, [settings]);

  // Mutation for updating settings
  const updateSettingsMutation = useMutation({
    mutationFn: (data: UpdateCompanySettingsInput) => settingsApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Paramètres mis à jour avec succès');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  // Mutation for uploading logo
  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Logo mis à jour avec succès');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'upload du logo');
    },
  });

  // Mutation for uploading logo carré
  const uploadLogoCarreMutation = useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogoCarre(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Logo carré mis à jour avec succès');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'upload du logo carré');
    },
  });

  const saveCongeSettingsMutation = useMutation({
    mutationFn: () => settingsApi.updateSettings({
      modeAllocationConges: congesMode,
      joursCongesAnnuels: congesJoursAnnuels,
      joursCongesMensuels: congesJoursMensuels,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Parametres de conges sauvegardes');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur');
    },
  });

  const crediterMoisMutation = useMutation({
    mutationFn: (payload: { mois: number; annee: number }) =>
      api.post('/rh/soldes/crediter-mois', payload),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'Mois credite');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors du credit');
    },
  });

  const cloturerAnneeMutation = useMutation({
    mutationFn: (payload: { annee: number; action: string }) =>
      api.post('/rh/soldes/cloture-annee', payload),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'Cloture effectuee');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la cloture');
    },
  });

  const ajusterSoldeMutation = useMutation({
    mutationFn: (payload: { employeId: string; jours: string; sens: string; motif: string; annee: number }) =>
      api.post(`/rh/soldes/${payload.employeId}/ajuster`, payload),
    onSuccess: (res: any) => {
      toast.success(`Solde ajuste. Nouveau solde : ${res.data?.soldeApres} j`);
      setAjustJours('');
      setAjustMotif('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'ajustement');
    },
  });

  const handleSettingsChange = (field: keyof UpdateCompanySettingsInput, value: any) => {
    setSettingsForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(settingsForm);
  };

  // Gérer la touche Entrée pour sauvegarder
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveSettings();
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadLogoMutation.mutate(file);
    }
  };

  const handleLogoCarreUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadLogoCarreMutation.mutate(file);
    }
  };

  // Generate preview reference - Format: PRÉFIXE0000/2026
  // Génère un aperçu de référence. Le paramètre `numeroBase` permet de montrer le prochain numéro attendu.
  const generatePreviewRef = (prefix: string, numeroBase: number = 1) => {
    const annee = new Date().getFullYear();
    const numero = String(numeroBase).padStart(settingsForm.longueurNumero || 4, '0');
    const sep = settingsForm.separateur !== undefined ? settingsForm.separateur : '/';
    if (settingsForm.inclureAnnee) {
      return `${prefix}${numero}${sep}${annee}`;
    }
    return `${prefix}${numero}`;
  };

  const { data: prestations = [] } = useQuery({
    queryKey: ['prestations'],
    queryFn: () => prestationsApi.list(),
    enabled: canDo('managePrestations'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: canDo('manageUsers'),
  });

  const { data: employes = [] } = useQuery({
    queryKey: ['employes'],
    queryFn: employesApi.list,
    enabled: canDo('manageEmployes'),
  });

  const { data: postes = [] } = useQuery({
    queryKey: ['postes'],
    queryFn: () => postesApi.list(),
    enabled: canDo('viewPostes') || canDo('managePostes') || canDo('manageEmployes'),
  });

  const createPrestationMutation = useMutation({
    mutationFn: ({ nom, ordre, description }: { nom: string; ordre?: number; description?: string }) =>
      prestationsApi.create({ nom, ordre, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestations'] });
      toast.success('Prestation créée');
      setIsCreatePrestationOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updatePrestationMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { nom?: string; ordre?: number; description?: string; actif?: boolean } }) =>
      prestationsApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestations'] });
      toast.success('Prestation mise à jour');
      setEditingPrestation(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deletePrestationMutation = useMutation({
    mutationFn: (id: string) => prestationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestations'] });
      toast.success('Prestation supprimée');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });
  const ROLES_WITH_EMPLOYE: Role[] = ['DIRECTION', 'COORDINATEUR', 'SUPER_CHEF_EQUIPE', 'EQUIPE'];

  const createUserMutation = useMutation({
    mutationFn: async (userData: Parameters<typeof usersApi.create>[0]) => {
      const user = await usersApi.create(userData);
      if (newUserCreateEmploye && newUserPosteIds.length > 0) {
        const employe = await employesApi.create({
          prenom: userData.prenom!,
          nom: userData.nom!,
          posteIds: newUserPosteIds,
          ...(newUserDateEntree ? { dateEntree: newUserDateEntree } : {}),
        });
        await usersApi.update(user.id, { employeId: employe.id });
      }
      return user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employes'] });
      toast.success('Utilisateur créé');
      setIsCreateUserOpen(false);
      setNewUserCreateEmploye(false);
      setNewUserPosteIds([]);
      setNewUserDateEntree('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur mis à jour');
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const permanentDeleteUserMutation = useMutation({
    mutationFn: (id: string) => usersApi.permanentDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur supprimé définitivement');
      setDeletingUser(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const createEmployeMutation = useMutation({
    mutationFn: (payload: { prenom: string; nom: string; posteIds: string[]; salaireBase?: number; dateEntree?: string }) => employesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employes'] });
      toast.success('Employé créé');
      setIsCreateEmployeOpen(false);
      setNewEmployePosteIds([]);
      setNewEmployeSalaire('');
      setNewEmployeDateEntree('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateEmployeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { prenom?: string; nom?: string; posteIds?: string[]; salaireBase?: number | null; dateEntree?: string | null } }) =>
      employesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employes'] });
      toast.success('Employé mis à jour');
      setEditingEmploye(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteEmployeMutation = useMutation({
    mutationFn: (id: string) => employesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employes'] });
      toast.success('Employé supprimé');
      setDeleteEmployeTarget(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const createPosteMutation = useMutation({
    mutationFn: (payload: { nom: string }) => postesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postes'] });
      toast.success('Poste créé');
      setIsCreatePosteOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updatePosteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { nom?: string; actif?: boolean } }) => postesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postes'] });
      toast.success('Poste mis à jour');
      setEditingPoste(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deletePosteMutation = useMutation({
    mutationFn: (id: string) => postesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postes'] });
      toast.success('Poste supprimé');
      setDeletePosteTarget(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  useEffect(() => {
    if (editingUser) {
      setEditUserRole(editingUser.role);
      setEditUserEmployeId(editingUser.employeId || '');
    }
  }, [editingUser]);

  useEffect(() => {
    if (editingEmploye) {
      setEditEmployePosteIds((editingEmploye.postes || []).map((p) => p.id));
      setEditEmployeSalaire(editingEmploye.salaireBase != null ? String(editingEmploye.salaireBase) : '');
      setEditEmployeDateEntree(editingEmploye.dateEntree ? editingEmploye.dateEntree.slice(0, 10) : '');
    }
  }, [editingEmploye]);

  const togglePoste = (current: string[], value: string, setValue: (next: string[]) => void) => {
    if (current.includes(value)) {
      setValue(current.filter((p) => p !== value));
    } else {
      setValue([...current, value]);
    }
  };

  const PosteMultiSelect = ({
    value,
    onChange,
    postesList,
    required,
  }: {
    value: string[];
    onChange: (next: string[]) => void;
    postesList: typeof postes;
    required?: boolean;
  }) => {
    const actifs = postesList.filter((p) => p.actif);
    const toggle = (id: string) =>
      onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

    if (actifs.length === 0) {
      return <p className="text-xs text-muted-foreground">Aucun poste disponible. Creez-en un d'abord.</p>;
    }

    return (
      <div className="space-y-2">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {actifs.map((p) => {
            const selected = value.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`relative flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
                  selected
                    ? 'border-primary bg-primary/5 text-primary font-medium shadow-sm'
                    : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent'
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  selected ? 'border-primary bg-primary text-white' : 'border-input'
                }`}>
                  {selected && (
                    <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  )}
                </span>
                <span className="truncate">{p.nom}</span>
              </button>
            );
          })}
        </div>
        {required && value.length === 0 && (
          <p className="text-xs text-amber-600">Selectionnez au moins un poste</p>
        )}
      </div>
    );
  };

  const filteredEmployes = employeSearch.trim()
    ? employes.filter((e) => {
        const postesLabel = e.postes.map((p) => p.nom).join(' ');
        const haystack = `${e.prenom} ${e.nom} ${postesLabel}`.toLowerCase();
        return haystack.includes(employeSearch.trim().toLowerCase());
      })
    : employes;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          Configuration de l'entreprise et gestion des utilisateurs
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-flex">
          {canDo('manageSettings') && (
            <TabsTrigger value="entreprise" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Entreprise</span>
            </TabsTrigger>
          )}
          {canDo('manageSettings') && (
            <TabsTrigger value="numerotation" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              <span className="hidden sm:inline">Numérotation</span>
            </TabsTrigger>
          )}
          {canDo('manageUsers') && (
            <TabsTrigger value="utilisateurs" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Utilisateurs</span>
            </TabsTrigger>
          )}
          {canDo('manageEmployes') && (
            <TabsTrigger value="employes" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Employés</span>
            </TabsTrigger>
          )}
          {canDo('managePostes') && (
            <TabsTrigger value="postes" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Postes</span>
            </TabsTrigger>
          )}
          {canDo('managePrestations') && (
            <TabsTrigger value="prestations" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Prestations</span>
            </TabsTrigger>
          )}
          {canDo('manageRH') && (
            <TabsTrigger value="conges" className="flex items-center gap-2">
              <span className="hidden sm:inline">Conges</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Onglet Entreprise */}
        {canDo('manageSettings') && (
          <TabsContent value="entreprise" className="space-y-6" onKeyDown={handleKeyDown}>
            {isLoadingSettings ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : (
              <>
                {/* Identité */}
                <Card>
                  <CardHeader>
                    <CardTitle>Identité de l'entreprise</CardTitle>
                    <CardDescription>Informations générales de votre société</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nomEntreprise">Nom de l'entreprise *</Label>
                        <Input
                          id="nomEntreprise"
                          value={settingsForm.nomEntreprise || ''}
                          onChange={(e) => handleSettingsChange('nomEntreprise', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="formeJuridique">Forme juridique</Label>
                        <Select
                          value={settingsForm.formeJuridique || ''}
                          onValueChange={(v) => handleSettingsChange('formeJuridique', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SARL">SARL</SelectItem>
                            <SelectItem value="EURL">EURL</SelectItem>
                            <SelectItem value="SPA">SPA</SelectItem>
                            <SelectItem value="SNC">SNC</SelectItem>
                            <SelectItem value="AUTO_ENTREPRENEUR">Auto-entrepreneur</SelectItem>
                            <SelectItem value="ASSOCIATION">Association</SelectItem>
                            <SelectItem value="AUTRE">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Logo principal (rectangulaire)</Label>
                        <p className="text-xs text-muted-foreground">Utilisé sur les documents PDF</p>
                        <div className="flex items-center gap-4">
                          {settings?.logoPath && (
                            <img
                              src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}/${settings.logoPath}`}
                              alt="Logo"
                              className="h-16 w-auto object-contain border rounded"
                            />
                          )}
                          <div>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="max-w-xs"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              JPG, PNG ou WebP. Max 5 Mo.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Logo carré</Label>
                        <p className="text-xs text-muted-foreground">Utilisé pour les icônes et favicons</p>
                        <div className="flex items-center gap-4">
                          {settings?.logoCarrePath && (
                            <img
                              src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}/${settings.logoCarrePath}`}
                              alt="Logo carré"
                              className="h-16 w-16 object-contain border rounded"
                            />
                          )}
                          <div>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoCarreUpload}
                              className="max-w-xs"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Format carré recommandé. Max 5 Mo.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Coordonnées */}
                <Card>
                  <CardHeader>
                    <CardTitle>Coordonnées</CardTitle>
                    <CardDescription>Adresse et moyens de contact</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="adresse">Adresse</Label>
                      <Input
                        id="adresse"
                        value={settingsForm.adresse || ''}
                        onChange={(e) => handleSettingsChange('adresse', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="codePostal">Code postal</Label>
                        <Input
                          id="codePostal"
                          value={settingsForm.codePostal || ''}
                          onChange={(e) => handleSettingsChange('codePostal', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ville">Ville</Label>
                        <Input
                          id="ville"
                          value={settingsForm.ville || ''}
                          onChange={(e) => handleSettingsChange('ville', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pays">Pays</Label>
                        <Input
                          id="pays"
                          value={settingsForm.pays || ''}
                          onChange={(e) => handleSettingsChange('pays', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="telephone">Téléphone</Label>
                        <Input
                          id="telephone"
                          value={settingsForm.telephone || ''}
                          onChange={(e) => handleSettingsChange('telephone', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fax">Fax</Label>
                        <Input
                          id="fax"
                          value={settingsForm.fax || ''}
                          onChange={(e) => handleSettingsChange('fax', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={settingsForm.email || ''}
                          onChange={(e) => handleSettingsChange('email', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="siteWeb">Site web</Label>
                        <Input
                          id="siteWeb"
                          value={settingsForm.siteWeb || ''}
                          onChange={(e) => handleSettingsChange('siteWeb', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Informations légales */}
                <Card>
                  <CardHeader>
                    <CardTitle>Informations légales</CardTitle>
                    <CardDescription>Numéros d'identification officiels</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rc">Registre du commerce (RC)</Label>
                        <Input
                          id="rc"
                          value={settingsForm.rc || ''}
                          onChange={(e) => handleSettingsChange('rc', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nif">NIF</Label>
                        <Input
                          id="nif"
                          value={settingsForm.nif || ''}
                          onChange={(e) => handleSettingsChange('nif', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="ai">Article d'imposition (AI)</Label>
                        <Input
                          id="ai"
                          value={settingsForm.ai || ''}
                          onChange={(e) => handleSettingsChange('ai', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nis">NIS</Label>
                        <Input
                          id="nis"
                          value={settingsForm.nis || ''}
                          onChange={(e) => handleSettingsChange('nis', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nin">Numéro d'Identification Nationale (NIN)</Label>
                        <Input
                          id="nin"
                          value={settingsForm.nin || ''}
                          onChange={(e) => handleSettingsChange('nin', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">NIN du gérant</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Coordonnées bancaires */}
                <Card>
                  <CardHeader>
                    <CardTitle>Coordonnées bancaires</CardTitle>
                    <CardDescription>Informations de compte pour les paiements</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="banque">Banque</Label>
                      <Input
                        id="banque"
                        value={settingsForm.banque || ''}
                        onChange={(e) => handleSettingsChange('banque', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="compteBancaire">N° de compte</Label>
                        <Input
                          id="compteBancaire"
                          value={settingsForm.compteBancaire || ''}
                          onChange={(e) => handleSettingsChange('compteBancaire', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rib">RIB</Label>
                        <Input
                          id="rib"
                          value={settingsForm.rib || ''}
                          onChange={(e) => handleSettingsChange('rib', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Paramètres commerciaux */}
                <Card>
                  <CardHeader>
                    <CardTitle>Paramètres commerciaux</CardTitle>
                    <CardDescription>Devise et TVA par défaut</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="devisePrincipale">Devise principale</Label>
                        <Select
                          value={settingsForm.devisePrincipale || 'DZD'}
                          onValueChange={(v) => handleSettingsChange('devisePrincipale', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DZD">DZD - Dinar algérien</SelectItem>
                            <SelectItem value="EUR">EUR - Euro</SelectItem>
                            <SelectItem value="USD">USD - Dollar américain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tauxTVADefaut">Taux TVA par défaut (%)</Label>
                        <Input
                          id="tauxTVADefaut"
                          type="number"
                          step="0.01"
                          value={settingsForm.tauxTVADefaut || 19}
                          onChange={(e) => handleSettingsChange('tauxTVADefaut', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer les paramètres
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        )}

        {/* Onglet Numérotation */}
        {canDo('manageSettings') && (
          <TabsContent value="numerotation" className="space-y-6" onKeyDown={handleKeyDown}>
            {isLoadingSettings ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : (
              <>
                {/* Options générales */}
                <Card>
                  <CardHeader>
                    <CardTitle>Options de numérotation</CardTitle>
                    <CardDescription>Format : PRÉFIXE + numéro + séparateur + année (ex: DV0001/2026)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="longueurNumero">Longueur du numéro</Label>
                        <Select
                          value={String(settingsForm.longueurNumero || 4)}
                          onValueChange={(v) => handleSettingsChange('longueurNumero', parseInt(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 chiffres (001/2026)</SelectItem>
                            <SelectItem value="4">4 chiffres (0001/2026)</SelectItem>
                            <SelectItem value="5">5 chiffres (00001/2026)</SelectItem>
                            <SelectItem value="6">6 chiffres (000001/2026)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="separateur">Séparateur</Label>
                        <Select
                          value={settingsForm.separateur === '' ? 'NONE' : (settingsForm.separateur || '/')}
                          onValueChange={(v) => handleSettingsChange('separateur', v === 'NONE' ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="/">Slash (/) (Recommandé)</SelectItem>
                            <SelectItem value="-">Tiret (-)</SelectItem>
                            <SelectItem value="NONE">Aucun</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Inclure l'année</Label>
                        <div className="flex items-center space-x-2 pt-2">
                          <Checkbox
                            id="inclureAnnee"
                            checked={settingsForm.inclureAnnee ?? true}
                            onCheckedChange={(checked) => handleSettingsChange('inclureAnnee', checked)}
                          />
                          <label htmlFor="inclureAnnee" className="text-sm">
                            Ajouter l'année dans la référence
                          </label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Documents de vente */}
                <Card>
                  <CardHeader>
                    <CardTitle>Documents de vente</CardTitle>
                    <CardDescription>Préfixes et décalages pour les documents commerciaux sortants. Le décalage permet de reprendre une numérotation en cours (ex: +839 pour que la prochaine soit 840).</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                        <span>Document</span>
                        <span>Préfixe</span>
                        <span>Décalage</span>
                        <span>Aperçu</span>
                      </div>
                      {[
                        { label: 'Devis', field: 'prefixDevis' as const, offsetField: 'offsetDevis' as const },
                        { label: 'Commandes', field: 'prefixCommande' as const, offsetField: 'offsetCommande' as const },
                        { label: 'Factures', field: 'prefixFacture' as const, offsetField: 'offsetFacture' as const },
                        { label: 'Avoirs', field: 'prefixAvoir' as const, offsetField: 'offsetAvoir' as const },
                      ].map((item) => (
                        <div key={item.field} className="grid grid-cols-4 gap-4 items-center">
                          <span className="text-sm">{item.label}</span>
                          <Input
                            value={settingsForm[item.field] || ''}
                            onChange={(e) => handleSettingsChange(item.field, e.target.value.toUpperCase())}
                            className="w-24"
                            maxLength={5}
                          />
                          <Input
                            type="number"
                            min={0}
                            value={settingsForm[item.offsetField] || 0}
                            onChange={(e) => handleSettingsChange(item.offsetField, parseInt(e.target.value) || 0)}
                            className="w-24"
                            placeholder="+0"
                          />
                          <span className="text-sm text-muted-foreground font-mono">
                            {generatePreviewRef(settingsForm[item.field] || '', (settingsForm[item.offsetField] || 0) + 1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Documents d'achat */}
                <Card>
                  <CardHeader>
                    <CardTitle>Documents d'achat</CardTitle>
                    <CardDescription>Préfixes et décalages pour les documents fournisseurs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                        <span>Document</span>
                        <span>Préfixe</span>
                        <span>Décalage</span>
                        <span>Aperçu</span>
                      </div>
                      {[
                        { label: 'Commandes fournisseur', field: 'prefixCommandeFournisseur' as const, offsetField: 'offsetCommandeFournisseur' as const },
                        { label: 'Factures fournisseur', field: 'prefixFactureFournisseur' as const, offsetField: 'offsetFactureFournisseur' as const },
                        { label: 'Charges', field: 'prefixCharge' as const, offsetField: 'offsetCharge' as const },
                      ].map((item) => (
                        <div key={item.field} className="grid grid-cols-4 gap-4 items-center">
                          <span className="text-sm">{item.label}</span>
                          <Input
                            value={settingsForm[item.field] || ''}
                            onChange={(e) => handleSettingsChange(item.field, e.target.value.toUpperCase())}
                            className="w-24"
                            maxLength={5}
                          />
                          <Input
                            type="number"
                            min={0}
                            value={settingsForm[item.offsetField] || 0}
                            onChange={(e) => handleSettingsChange(item.offsetField, parseInt(e.target.value) || 0)}
                            className="w-24"
                            placeholder="+0"
                          />
                          <span className="text-sm text-muted-foreground font-mono">
                            {generatePreviewRef(settingsForm[item.field] || '', (settingsForm[item.offsetField] || 0) + 1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Tiers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Tiers</CardTitle>
                    <CardDescription>Préfixes et décalages pour les codes clients et fournisseurs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                        <span>Type</span>
                        <span>Préfixe</span>
                        <span>Décalage</span>
                        <span>Aperçu</span>
                      </div>
                      {[
                        { label: 'Clients', field: 'prefixClient' as const, offsetField: 'offsetClient' as const },
                        { label: 'Fournisseurs', field: 'prefixFournisseur' as const, offsetField: 'offsetFournisseur' as const },
                        { label: 'Prospects', field: 'prefixProspect' as const, offsetField: 'offsetProspect' as const },
                      ].map((item) => (
                        <div key={item.field} className="grid grid-cols-4 gap-4 items-center">
                          <span className="text-sm">{item.label}</span>
                          <Input
                            value={settingsForm[item.field] || ''}
                            onChange={(e) => handleSettingsChange(item.field, e.target.value.toUpperCase())}
                            className="w-24"
                            maxLength={5}
                          />
                          <Input
                            type="number"
                            min={0}
                            value={settingsForm[item.offsetField] || 0}
                            onChange={(e) => handleSettingsChange(item.offsetField, parseInt(e.target.value) || 0)}
                            className="w-24"
                            placeholder="+0"
                          />
                          <span className="text-sm text-muted-foreground font-mono">
                            {generatePreviewRef(settingsForm[item.field] || '', (settingsForm[item.offsetField] || 0) + 1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Produits/Services */}
                <Card>
                  <CardHeader>
                    <CardTitle>Produits & Services</CardTitle>
                    <CardDescription>Préfixes pour les références produits</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                        <span>Type</span>
                        <span>Préfixe</span>
                        <span>Aperçu</span>
                      </div>
                      {[
                        { label: 'Produits', field: 'prefixProduit' as const },
                        { label: 'Services', field: 'prefixService' as const },
                      ].map((item) => (
                        <div key={item.field} className="grid grid-cols-3 gap-4 items-center">
                          <span className="text-sm">{item.label}</span>
                          <Input
                            value={settingsForm[item.field] || ''}
                            onChange={(e) => handleSettingsChange(item.field, e.target.value.toUpperCase())}
                            className="w-24"
                            maxLength={5}
                          />
                          <span className="text-sm text-muted-foreground font-mono">
                            {generatePreviewRef(settingsForm[item.field] || '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer les paramètres
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        )}

        {/* Onglet Utilisateurs */}
        {canDo('manageUsers') && (
          <TabsContent value="utilisateurs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Utilisateurs</CardTitle>
                <Button onClick={() => setIsCreateUserOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvel utilisateur
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun utilisateur</p>
                ) : (
                  users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {u.prenom} {u.nom}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {u.email} • {u.role} • {u.actif ? 'Actif' : 'Inactif'}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingUser(u)}>
                            Modifier
                          </DropdownMenuItem>
                          {u.actif && (
                            <DropdownMenuItem
                              onClick={() => updateUserMutation.mutate({ id: u.id, data: { actif: false } })}
                            >
                              Désactiver
                            </DropdownMenuItem>
                          )}
                          {!u.actif && (
                            <DropdownMenuItem
                              onClick={() => updateUserMutation.mutate({ id: u.id, data: { actif: true } })}
                            >
                              Réactiver
                            </DropdownMenuItem>
                          )}
                          {currentUser?.role === 'SUPER_ADMIN' && u.id !== currentUser.id && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeletingUser(u)}
                            >
                              Supprimer définitivement
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Onglet Employés */}
        {canDo('manageEmployes') && (
          <TabsContent value="employes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Employés</CardTitle>
                <Button onClick={() => setIsCreateEmployeOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvel employé
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {employes.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="employeSearch">Recherche</Label>
                    <Input
                      id="employeSearch"
                      value={employeSearch}
                      onChange={(e) => setEmployeSearch(e.target.value)}
                      placeholder="Rechercher par nom ou poste"
                    />
                  </div>
                )}
                {filteredEmployes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun employé</p>
                ) : (
                  filteredEmployes.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {e.prenom} {e.nom}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.postes.map((p) => p.nom).join(' • ')}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingEmploye(e)}>
                            Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingEmploye(e)}>
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteEmployeTarget(e)}>
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Onglet Postes */}
        {canDo('managePostes') && (
          <TabsContent value="postes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Postes</CardTitle>
                <Button onClick={() => setIsCreatePosteOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau poste
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {postes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun poste</p>
                ) : (
                  postes.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{p.nom}</p>
                        <p className="text-xs text-muted-foreground">{p.actif ? 'Actif' : 'Inactif'}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingPoste(p)}>
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeletePosteTarget(p)}>
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Onglet Prestations */}
        {canDo('managePrestations') && (
          <TabsContent value="prestations">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Prestations</CardTitle>
                <Button onClick={() => setIsCreatePrestationOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle prestation
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {prestations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune prestation</p>
                ) : (
                  prestations.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{p.nom}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Ordre: {p.ordre}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingPrestation(p)}>
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeletePrestationTarget(p)}>
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Congés ── */}
        {canDo('manageRH') && (
          <TabsContent value="conges" className="space-y-6">

            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              L'acquisition des conges est automatique : 2,5 jours par mois sont credites
              a chaque employe des sa creation, selon sa date d'entree dans l'entreprise.
            </div>

            {/* Cloture annee */}
            <Card>
              <CardHeader>
                <CardTitle>Cloture de fin d'annee</CardTitle>
                <CardDescription>
                  A la fin de chaque annee, choisissez ce qu'il advient des jours non consommes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Label>Annee a cloturer</Label>
                  <Input
                    type="number" min={2020} max={2099}
                    value={congesAnnee}
                    onChange={(e) => setCongesAnnee(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-24"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    {
                      action: 'REPORTER',
                      label: 'Reporter',
                      desc: 'Les jours restants sont transferes vers l\'annee suivante',
                      color: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
                    },
                    {
                      action: 'SUPPRIMER',
                      label: 'Supprimer',
                      desc: 'Les jours non consommes sont perdus (remis a zero)',
                      color: 'border-red-200 bg-red-50 hover:bg-red-100',
                    },
                    {
                      action: 'PAYER',
                      label: 'Convertir en indemnite',
                      desc: 'Les jours restants sont marques comme payes en compensation',
                      color: 'border-green-200 bg-green-50 hover:bg-green-100',
                    },
                  ].map(({ action, label, desc, color }) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => cloturerAnneeMutation.mutate({ annee: congesAnnee, action })}
                      disabled={cloturerAnneeMutation.isPending}
                      className={`rounded-lg border p-4 text-left transition-colors ${color} disabled:opacity-50`}
                    >
                      <p className="font-semibold text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Cette action s'applique a tous les employes ayant un solde positif pour {congesAnnee}.
                  Elle est irreversible.
                </div>
              </CardContent>
            </Card>

            {/* Ajustement manuel */}
            <Card>
              <CardHeader>
                <CardTitle>Ajustement manuel</CardTitle>
                <CardDescription>
                  Ajoutez ou deduisez des jours manuellement pour un employe
                  (reprise de donnees, correction, conges exceptionnels...).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Employe</Label>
                    <select
                      value={ajustEmployeId}
                      onChange={(e) => setAjustEmployeId(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">-- choisir --</option>
                      {employes.map((e) => (
                        <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Annee</Label>
                    <Input
                      type="number" min={2020} max={2099}
                      value={congesAnnee}
                      onChange={(e) => setCongesAnnee(parseInt(e.target.value) || new Date().getFullYear())}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Jours</Label>
                    <Input
                      type="number" min={0.5} step={0.5}
                      value={ajustJours}
                      onChange={(e) => setAjustJours(e.target.value)}
                      placeholder="Ex: 5"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Sens</Label>
                    <select
                      value={ajustSens}
                      onChange={(e) => setAjustSens(e.target.value as 'CREDIT' | 'DEBIT')}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="CREDIT">+ Credit</option>
                      <option value="DEBIT">- Debit</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Motif</Label>
                  <Input
                    value={ajustMotif}
                    onChange={(e) => setAjustMotif(e.target.value)}
                    placeholder="Ex: Reprise solde ancien systeme, conge exceptionnel..."
                  />
                </div>
                <Button
                  onClick={() => ajusterSoldeMutation.mutate({
                    employeId: ajustEmployeId,
                    jours: ajustJours,
                    sens: ajustSens,
                    motif: ajustMotif,
                    annee: congesAnnee,
                  })}
                  disabled={ajusterSoldeMutation.isPending || !ajustEmployeId || !ajustJours}
                >
                  {ajusterSoldeMutation.isPending ? 'Ajustement...' : 'Appliquer'}
                </Button>
              </CardContent>
            </Card>

          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <Dialog open={isCreatePrestationOpen} onOpenChange={setIsCreatePrestationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle prestation</DialogTitle>
            <DialogDescription>Ajoutez une prestation disponible</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const nom = formData.get('nom') as string;
              const ordreRaw = formData.get('ordre') as string;
              const ordre = ordreRaw ? Number(ordreRaw) : undefined;
              const description = (formData.get('description') as string) || undefined;
              setPendingPrestation({ nom, ordre, description });
              setConfirmPrestationCreateOpen(true);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input name="nom" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea name="description" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ordre">Ordre</Label>
              <Input name="ordre" type="number" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatePrestationOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createPrestationMutation.isPending}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPrestation} onOpenChange={() => setEditingPrestation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la prestation</DialogTitle>
          </DialogHeader>
          {editingPrestation && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const nom = formData.get('nom') as string;
                const ordreRaw = formData.get('ordre') as string;
                const ordre = ordreRaw ? Number(ordreRaw) : undefined;
                const description = (formData.get('description') as string) || undefined;
                updatePrestationMutation.mutate({ id: editingPrestation.id, updates: { nom, ordre, description } });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input name="nom" defaultValue={editingPrestation.nom} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea name="description" defaultValue={editingPrestation.description || ''} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ordre">Ordre</Label>
                <Input name="ordre" type="number" defaultValue={editingPrestation.ordre} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPrestation(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={updatePrestationMutation.isPending}>
                  Mettre à jour
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmPrestationCreateOpen} onOpenChange={setConfirmPrestationCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la création</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous créer cette prestation ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmPrestationCreateOpen(false)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPrestation) createPrestationMutation.mutate(pendingPrestation);
                setPendingPrestation(null);
                setConfirmPrestationCreateOpen(false);
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePrestationTarget} onOpenChange={(open) => !open && setDeletePrestationTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette prestation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePrestationTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePrestationTarget) deletePrestationMutation.mutate(deletePrestationTarget.id);
                setDeletePrestationTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCreatePosteOpen} onOpenChange={setIsCreatePosteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau poste</DialogTitle>
            <DialogDescription>Ajoutez un poste</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const nom = formData.get('nom') as string;
              createPosteMutation.mutate({ nom });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input name="nom" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatePosteOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createPosteMutation.isPending}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPoste} onOpenChange={() => setEditingPoste(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le poste</DialogTitle>
          </DialogHeader>
          {editingPoste && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const nom = formData.get('nom') as string;
                updatePosteMutation.mutate({ id: editingPoste.id, data: { nom } });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input name="nom" defaultValue={editingPoste.nom} required />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPoste(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={updatePosteMutation.isPending}>
                  Mettre à jour
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePosteTarget} onOpenChange={(open) => !open && setDeletePosteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce poste ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePosteTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePosteTarget) deletePosteMutation.mutate(deletePosteTarget.id);
                setDeletePosteTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isCreateEmployeOpen}
        onOpenChange={(open) => {
          setIsCreateEmployeOpen(open);
          if (!open) {
            setNewEmployePosteIds([]);
            setNewEmployeDateEntree('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel employé</DialogTitle>
            <DialogDescription>Ajoutez un employé</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const salaireRaw = newEmployeSalaire.trim();
              createEmployeMutation.mutate({
                prenom: formData.get('prenom') as string,
                nom: formData.get('nom') as string,
                posteIds: newEmployePosteIds,
                ...(canDo('viewDashboardFinance') && salaireRaw ? { salaireBase: parseFloat(salaireRaw) } : {}),
                ...(newEmployeDateEntree ? { dateEntree: newEmployeDateEntree } : {}),
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prenom *</Label>
                <Input name="prenom" required />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input name="nom" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date d'entrée dans l'entreprise</Label>
              <Input
                type="date"
                value={newEmployeDateEntree}
                onChange={(e) => setNewEmployeDateEntree(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Sert au calcul des congés acquis (2,5 jours par mois depuis cette date).
              </p>
            </div>

            {canDo('viewDashboardFinance') && (
              <div className="space-y-2">
                <Label>Salaire mensuel brut (DZD)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={500}
                    placeholder="Ex: 45000"
                    value={newEmployeSalaire}
                    onChange={(e) => setNewEmployeSalaire(e.target.value)}
                    className="w-40"
                  />
                  <span className="text-sm text-muted-foreground">DZD / mois</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Postes *</Label>
              <PosteMultiSelect
                value={newEmployePosteIds}
                onChange={setNewEmployePosteIds}
                postesList={postes}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateEmployeOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createEmployeMutation.isPending || newEmployePosteIds.length === 0}
              >
                Creer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEmploye} onOpenChange={() => setEditingEmploye(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'employé</DialogTitle>
          </DialogHeader>
          {editingEmploye && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const prenom = formData.get('prenom') as string;
                const nom = formData.get('nom') as string;
                const salaireRaw = editEmployeSalaire.trim();
                updateEmployeMutation.mutate({
                  id: editingEmploye.id,
                  data: {
                    prenom,
                    nom,
                    posteIds: editEmployePosteIds,
                    dateEntree: editEmployeDateEntree || null,
                    ...(canDo('viewDashboardFinance')
                      ? { salaireBase: salaireRaw ? parseFloat(salaireRaw) : null }
                      : {}),
                  },
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prenom *</Label>
                  <Input name="prenom" defaultValue={editingEmploye.prenom} required />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input name="nom" defaultValue={editingEmploye.nom} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Date d'entrée dans l'entreprise</Label>
                <Input
                  type="date"
                  value={editEmployeDateEntree}
                  onChange={(e) => setEditEmployeDateEntree(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Sert au calcul des congés acquis (2,5 jours par mois depuis cette date).
                </p>
              </div>

              {canDo('viewDashboardFinance') && (
                <div className="space-y-2">
                  <Label>Salaire mensuel brut (DZD)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step={500}
                      placeholder="Ex: 45000"
                      value={editEmployeSalaire}
                      onChange={(e) => setEditEmployeSalaire(e.target.value)}
                      className="w-40"
                    />
                    <span className="text-sm text-muted-foreground">DZD / mois</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Postes *</Label>
                <PosteMultiSelect
                  value={editEmployePosteIds}
                  onChange={setEditEmployePosteIds}
                  postesList={postes}
                  required
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingEmploye(null)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={updateEmployeMutation.isPending || editEmployePosteIds.length === 0}
                >
                  Mettre a jour
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingEmploye} onOpenChange={() => setViewingEmploye(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails employé</DialogTitle>
          </DialogHeader>
          {viewingEmploye && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nom complet</p>
                <p className="font-medium">{viewingEmploye.prenom} {viewingEmploye.nom}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Postes</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {viewingEmploye.postes.map((p) => (
                    <span key={p.id} className="inline-flex items-center rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                      {p.nom}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date d'entrée</p>
                <p className="font-medium">
                  {viewingEmploye.dateEntree
                    ? new Date(viewingEmploye.dateEntree).toLocaleDateString('fr-FR')
                    : <span className="text-muted-foreground text-sm">Non renseignée</span>}
                </p>
              </div>
              {canDo('viewDashboardFinance') && (
                <div>
                  <p className="text-sm text-muted-foreground">Salaire mensuel brut</p>
                  <p className="font-medium">
                    {viewingEmploye.salaireBase != null
                      ? `${viewingEmploye.salaireBase.toLocaleString('fr-DZ')} DZD`
                      : <span className="text-muted-foreground text-sm">Non renseigne</span>}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEmployeTarget} onOpenChange={(open) => !open && setDeleteEmployeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {deleteEmployeTarget?.prenom} {deleteEmployeTarget?.nom} ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {(deleteEmployeTarget?._count?.interventionEmployes ?? 0) > 0 && (
                  <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                    <strong>Attention :</strong> cet employe est assigne a{' '}
                    <strong>{deleteEmployeTarget!._count!.interventionEmployes} mission{deleteEmployeTarget!._count!.interventionEmployes > 1 ? 's' : ''}</strong>.
                    Il sera retire de toutes ces missions.
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Cette action est definitive et ne peut pas etre annulee.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteEmployeTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteEmployeTarget) deleteEmployeMutation.mutate(deleteEmployeTarget.id);
                setDeleteEmployeTarget(null);
              }}
            >
              Supprimer definitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isCreateUserOpen}
        onOpenChange={(open) => {
          setIsCreateUserOpen(open);
          if (!open) { setNewUserRole('COORDINATEUR'); setNewUserEmployeId(''); setNewUserCreateEmploye(false); setNewUserPosteIds([]); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>Ajoutez un compte utilisateur</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = {
                email: formData.get('email') as string,
                password: formData.get('password') as string,
                nom: formData.get('nom') as string,
                prenom: formData.get('prenom') as string,
                tel: (formData.get('tel') as string) || undefined,
                role: newUserRole,
                employeId: newUserEmployeId || undefined,
              };
              createUserMutation.mutate(data);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom *</Label>
                <Input name="prenom" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input name="nom" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input name="password" type="password" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tel">Téléphone</Label>
                <Input name="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="DIRECTION">Direction (admin + finance)</SelectItem>
                    <SelectItem value="COORDINATEUR">Coordinateur (admin sans finance)</SelectItem>
                    <SelectItem value="SUPER_CHEF_EQUIPE">Super Chef d'équipe</SelectItem>
                    <SelectItem value="EQUIPE">Équipe (ses interventions seulement)</SelectItem>
                    <SelectItem value="LECTURE">Lecture seule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Section fiche employé — proposée pour tous les rôles opérationnels */}
            {ROLES_WITH_EMPLOYE.includes(newUserRole) && (
              <div className="rounded-lg border p-4 space-y-3 bg-gray-50">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="createEmploye"
                    checked={newUserCreateEmploye}
                    onCheckedChange={(v) => {
                      setNewUserCreateEmploye(!!v);
                      setNewUserPosteIds([]);
                    }}
                  />
                  <Label htmlFor="createEmploye" className="cursor-pointer font-medium">
                    Créer aussi une fiche employé
                    <span className="block text-xs font-normal text-muted-foreground">
                      Permet d'affecter cet utilisateur à des interventions
                    </span>
                  </Label>
                </div>

                {newUserCreateEmploye && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-sm">Date d'entree <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        required={newUserCreateEmploye}
                        value={newUserDateEntree}
                        onChange={(e) => setNewUserDateEntree(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Poste(s) <span className="text-red-500">*</span></Label>
                      <PosteMultiSelect
                        value={newUserPosteIds}
                        onChange={setNewUserPosteIds}
                        postesList={postes}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending || (newUserCreateEmploye && (newUserPosteIds.length === 0 || !newUserDateEntree))}
              >
                {createUserMutation.isPending ? 'Création...' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = {
                email: formData.get('email') as string,
                nom: formData.get('nom') as string,
                prenom: formData.get('prenom') as string,
                tel: (formData.get('tel') as string) || undefined,
                role: editUserRole,
                employeId: editUserEmployeId || null,
              };
              updateUserMutation.mutate({ id: editingUser.id, data });
            }}
            className="space-y-4"
          >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom *</Label>
                  <Input name="prenom" defaultValue={editingUser.prenom} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom *</Label>
                  <Input name="nom" defaultValue={editingUser.nom} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input name="email" type="email" defaultValue={editingUser.email} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tel">Téléphone</Label>
                  <Input name="tel" defaultValue={editingUser.tel || ''} />
                </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select value={editUserRole} onValueChange={(v) => setEditUserRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="DIRECTION">Direction (admin + finance)</SelectItem>
                    <SelectItem value="COORDINATEUR">Coordinateur (admin sans finance)</SelectItem>
                    <SelectItem value="SUPER_CHEF_EQUIPE">Super Chef d'équipe</SelectItem>
                    <SelectItem value="EQUIPE">Équipe (ses interventions seulement)</SelectItem>
                    <SelectItem value="LECTURE">Lecture seule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editUserRole === 'EQUIPE' && (
              <div className="space-y-2">
                <Label>Lier à un employé <span className="text-xs text-muted-foreground">(pour filtrer ses interventions)</span></Label>
                <Select value={editUserEmployeId} onValueChange={setEditUserEmployeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un employé..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Aucun —</SelectItem>
                    {employes.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  Mettre à jour
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression définitive */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingUser?.prenom} {deletingUser?.nom}</strong> ({deletingUser?.email}) sera supprimé de façon irréversible.
              Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deletingUser && permanentDeleteUserMutation.mutate(deletingUser.id)}
              disabled={permanentDeleteUserMutation.isPending}
            >
              {permanentDeleteUserMutation.isPending ? 'Suppression...' : 'Supprimer définitivement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
