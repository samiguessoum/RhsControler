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
import { prestationsApi, usersApi, employesApi, postesApi, settingsApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import type { Prestation, User, Role, Employe, Poste, CompanySettings, UpdateCompanySettingsInput } from '@/types';

export function ParametresPage() {
  const queryClient = useQueryClient();
  const { canDo } = useAuthStore();

  const [isCreatePrestationOpen, setIsCreatePrestationOpen] = useState(false);
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null);
  const [pendingPrestation, setPendingPrestation] = useState<{ nom: string; ordre?: number; description?: string } | null>(null);
  const [confirmPrestationCreateOpen, setConfirmPrestationCreateOpen] = useState(false);
  const [deletePrestationTarget, setDeletePrestationTarget] = useState<Prestation | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserRole, setNewUserRole] = useState<Role>('PLANNING');
  const [editUserRole, setEditUserRole] = useState<Role>('PLANNING');
  const [isCreateEmployeOpen, setIsCreateEmployeOpen] = useState(false);
  const [editingEmploye, setEditingEmploye] = useState<Employe | null>(null);
  const [viewingEmploye, setViewingEmploye] = useState<Employe | null>(null);
  const [deleteEmployeTarget, setDeleteEmployeTarget] = useState<Employe | null>(null);
  const [newEmployePosteIds, setNewEmployePosteIds] = useState<string[]>([]);
  const [editEmployePosteIds, setEditEmployePosteIds] = useState<string[]>([]);
  const [employeSearch, setEmployeSearch] = useState('');
  const [isCreatePosteOpen, setIsCreatePosteOpen] = useState(false);
  const [editingPoste, setEditingPoste] = useState<Poste | null>(null);
  const [deletePosteTarget, setDeletePosteTarget] = useState<Poste | null>(null);

  // Settings state
  const [settingsForm, setSettingsForm] = useState<UpdateCompanySettingsInput>({});
  const [activeTab, setActiveTab] = useState('entreprise');

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
      });
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

  const handleSettingsChange = (field: keyof UpdateCompanySettingsInput, value: any) => {
    setSettingsForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(settingsForm);
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

  // Generate preview reference
  const generatePreviewRef = (prefix: string) => {
    const annee = new Date().getFullYear();
    const numero = '1'.padStart(settingsForm.longueurNumero || 5, '0');
    // Utiliser le séparateur configuré, ou '-' par défaut si non défini
    const sep = settingsForm.separateur !== undefined ? settingsForm.separateur : '-';
    if (settingsForm.inclureAnnee) {
      return `${prefix}${sep}${annee}${sep}${numero}`;
    }
    return `${prefix}${sep}${numero}`;
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
  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur créé');
      setIsCreateUserOpen(false);
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

  const createEmployeMutation = useMutation({
    mutationFn: (payload: { prenom: string; nom: string; posteIds: string[] }) => employesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employes'] });
      toast.success('Employé créé');
      setIsCreateEmployeOpen(false);
      setNewEmployePosteIds([]);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateEmployeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { prenom?: string; nom?: string; posteIds?: string[] } }) =>
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
    }
  }, [editingUser]);

  useEffect(() => {
    if (editingEmploye) {
      setEditEmployePosteIds((editingEmploye.postes || []).map((p) => p.id));
    }
  }, [editingEmploye]);

  const togglePoste = (current: string[], value: string, setValue: (next: string[]) => void) => {
    if (current.includes(value)) {
      setValue(current.filter((p) => p !== value));
    } else {
      setValue([...current, value]);
    }
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
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
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
        </TabsList>

        {/* Onglet Entreprise */}
        {canDo('manageSettings') && (
          <TabsContent value="entreprise" className="space-y-6">
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
          <TabsContent value="numerotation" className="space-y-6">
            {isLoadingSettings ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : (
              <>
                {/* Options générales */}
                <Card>
                  <CardHeader>
                    <CardTitle>Options de numérotation</CardTitle>
                    <CardDescription>Configurez le format des références</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="longueurNumero">Longueur du numéro</Label>
                        <Select
                          value={String(settingsForm.longueurNumero || 5)}
                          onValueChange={(v) => handleSettingsChange('longueurNumero', parseInt(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 chiffres (001)</SelectItem>
                            <SelectItem value="4">4 chiffres (0001)</SelectItem>
                            <SelectItem value="5">5 chiffres (00001)</SelectItem>
                            <SelectItem value="6">6 chiffres (000001)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="separateur">Séparateur</Label>
                        <Select
                          value={settingsForm.separateur === '' ? 'NONE' : (settingsForm.separateur || '-')}
                          onValueChange={(v) => handleSettingsChange('separateur', v === 'NONE' ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-">Tiret (-)</SelectItem>
                            <SelectItem value="/">Slash (/)</SelectItem>
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
                    <CardDescription>Préfixes pour les documents commerciaux sortants</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                        <span>Document</span>
                        <span>Préfixe</span>
                        <span>Aperçu</span>
                      </div>
                      {[
                        { label: 'Devis', field: 'prefixDevis' as const },
                        { label: 'Commandes', field: 'prefixCommande' as const },
                        { label: 'Factures', field: 'prefixFacture' as const },
                        { label: 'Avoirs', field: 'prefixAvoir' as const },
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

                {/* Documents d'achat */}
                <Card>
                  <CardHeader>
                    <CardTitle>Documents d'achat</CardTitle>
                    <CardDescription>Préfixes pour les documents fournisseurs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                        <span>Document</span>
                        <span>Préfixe</span>
                        <span>Aperçu</span>
                      </div>
                      {[
                        { label: 'Commandes fournisseur', field: 'prefixCommandeFournisseur' as const },
                        { label: 'Factures fournisseur', field: 'prefixFactureFournisseur' as const },
                        { label: 'Charges', field: 'prefixCharge' as const },
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

                {/* Tiers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Tiers</CardTitle>
                    <CardDescription>Préfixes pour les codes clients et fournisseurs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                        <span>Type</span>
                        <span>Préfixe</span>
                        <span>Aperçu</span>
                      </div>
                      {[
                        { label: 'Clients', field: 'prefixClient' as const },
                        { label: 'Fournisseurs', field: 'prefixFournisseur' as const },
                        { label: 'Prospects', field: 'prefixProspect' as const },
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
          if (!open) setNewEmployePosteIds([]);
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
              const data = {
                prenom: formData.get('prenom') as string,
                nom: formData.get('nom') as string,
                posteIds: newEmployePosteIds,
              };
              createEmployeMutation.mutate(data);
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
              <Label>Postes *</Label>
              <div className="grid grid-cols-2 gap-2">
                {postes.map((poste) => (
                  <label key={poste.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newEmployePosteIds.includes(poste.id)}
                      onCheckedChange={() => togglePoste(newEmployePosteIds, poste.id, setNewEmployePosteIds)}
                    />
                    <span>{poste.nom}</span>
                  </label>
                ))}
                {postes.length === 0 && (
                  <p className="text-xs text-muted-foreground">Créez un poste avant d’ajouter un employé.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateEmployeOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createEmployeMutation.isPending || newEmployePosteIds.length === 0}
              >
                Créer
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
                updateEmployeMutation.mutate({
                  id: editingEmploye.id,
                  data: { prenom, nom, posteIds: editEmployePosteIds },
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom *</Label>
                  <Input name="prenom" defaultValue={editingEmploye.prenom} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom *</Label>
                  <Input name="nom" defaultValue={editingEmploye.nom} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Postes *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {postes.map((poste) => (
                    <label key={poste.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editEmployePosteIds.includes(poste.id)}
                        onCheckedChange={() => togglePoste(editEmployePosteIds, poste.id, setEditEmployePosteIds)}
                      />
                      <span>{poste.nom}</span>
                    </label>
                  ))}
                  {postes.length === 0 && (
                    <p className="text-xs text-muted-foreground">Créez un poste pour l’affecter.</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingEmploye(null)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={updateEmployeMutation.isPending || editEmployePosteIds.length === 0}
                >
                  Mettre à jour
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
                <p className="font-medium">
                  {viewingEmploye.postes.map((p) => p.nom).join(', ')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEmployeTarget} onOpenChange={(open) => !open && setDeleteEmployeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet employé ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteEmployeTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteEmployeTarget) deleteEmployeMutation.mutate(deleteEmployeTarget.id);
                setDeleteEmployeTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isCreateUserOpen}
        onOpenChange={(open) => {
          setIsCreateUserOpen(open);
          if (!open) setNewUserRole('PLANNING');
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
                    <SelectItem value="DIRECTION">Direction</SelectItem>
                    <SelectItem value="PLANNING">Planning</SelectItem>
                    <SelectItem value="EQUIPE">Équipe</SelectItem>
                    <SelectItem value="LECTURE">Lecture</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l’utilisateur</DialogTitle>
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
                      <SelectItem value="DIRECTION">Direction</SelectItem>
                      <SelectItem value="PLANNING">Planning</SelectItem>
                      <SelectItem value="EQUIPE">Équipe</SelectItem>
                      <SelectItem value="LECTURE">Lecture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
    </div>
  );
}
