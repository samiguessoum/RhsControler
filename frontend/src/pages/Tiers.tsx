import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Users,
  UserPlus,
  Truck,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  ArrowRightLeft,
} from 'lucide-react';

import { tiersApi, referentielsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuthStore } from '@/store/auth.store';
import type {
  Tiers,
  TypeTiers,
  FormeJuridique,
  CreateTiersInput,
} from '@/types';
import { ClientsPage } from './Clients';

// ============ CONFIGURATION ============
const TYPE_TIERS_CONFIG: Record<TypeTiers, { label: string; icon: any; color: string; bgColor: string }> = {
  CLIENT: { label: 'Client', icon: Users, color: 'text-blue-700', bgColor: 'bg-blue-100' },
  FOURNISSEUR: { label: 'Fournisseur', icon: Truck, color: 'text-orange-700', bgColor: 'bg-orange-100' },
  PROSPECT: { label: 'Prospect', icon: UserPlus, color: 'text-purple-700', bgColor: 'bg-purple-100' },
  CLIENT_FOURNISSEUR: { label: 'Client & Fournisseur', icon: ArrowRightLeft, color: 'text-green-700', bgColor: 'bg-green-100' },
};

const FORME_JURIDIQUE_OPTIONS: { value: FormeJuridique; label: string }[] = [
  { value: 'SARL', label: 'SARL' },
  { value: 'EURL', label: 'EURL' },
  { value: 'SPA', label: 'SPA' },
  { value: 'SNC', label: 'SNC' },
  { value: 'AUTO_ENTREPRENEUR', label: 'Auto-entrepreneur' },
  { value: 'ASSOCIATION', label: 'Association' },
  { value: 'PARTICULIER', label: 'Particulier' },
  { value: 'AUTRE', label: 'Autre' },
];

export default function TiersPage() {
  const { canDo } = useAuthStore();
  const canCreate = canDo('createClient');
  const canEdit = canDo('editClient');
  const canDelete = canDo('deleteClient');
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTiers, setEditingTiers] = useState<Tiers | null>(null);
  const [viewingTiers, setViewingTiers] = useState<Tiers | null>(null);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['tiers-stats'],
    queryFn: tiersApi.getStats,
  });

  // Fetch tiers list
  const typeTiersFilter = activeTab === 'all' ? undefined : activeTab as TypeTiers;
  const { data: tiersData, isLoading } = useQuery({
    queryKey: ['tiers', typeTiersFilter, search],
    queryFn: () => tiersApi.list({ typeTiers: typeTiersFilter, search: search || undefined, limit: 100 }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: tiersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      queryClient.invalidateQueries({ queryKey: ['tiers-stats'] });
    },
  });

  // Convert prospect mutation
  const convertMutation = useMutation({
    mutationFn: tiersApi.convertirProspect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      queryClient.invalidateQueries({ queryKey: ['tiers-stats'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tiers</h1>
          <p className="text-muted-foreground">
            Gestion des clients, fournisseurs et prospects
          </p>
        </div>
        {canCreate && activeTab !== 'CLIENT' && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau tiers
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('CLIENT')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.clients.actifs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.clients.total || 0} total
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('FOURNISSEUR')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fournisseurs</CardTitle>
            <Truck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.fournisseurs.actifs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.fournisseurs.total || 0} total
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('PROSPECT')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospects</CardTitle>
            <UserPlus className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.prospects.actifs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.prospects.total || 0} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="CLIENT">Clients</TabsTrigger>
              <TabsTrigger value="FOURNISSEUR">Fournisseurs</TabsTrigger>
              <TabsTrigger value="PROSPECT">Prospects</TabsTrigger>
            </TabsList>

            {activeTab !== 'CLIENT' && (
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
          </div>
        </Tabs>
      </div>

      {/* Clients Module (when CLIENT tab is selected) */}
      {activeTab === 'CLIENT' ? (
        <ClientsPage />
      ) : (
        /* Tiers List */
        <Card>
          {isLoading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiersData?.tiers.map((tiers) => {
                  const config = TYPE_TIERS_CONFIG[tiers.typeTiers];
                  const contactPrincipal = tiers.siegeContacts?.[0];
                  return (
                    <TableRow key={tiers.id} className="cursor-pointer hover:bg-gray-50">
                      <TableCell className="font-mono text-sm">
                        {tiers.code || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{tiers.nomEntreprise}</div>
                          {tiers.nomAlias && (
                            <div className="text-xs text-muted-foreground">{tiers.nomAlias}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${config.bgColor} ${config.color}`}>
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{tiers.siegeVille || '-'}</TableCell>
                      <TableCell>
                        {contactPrincipal ? (
                          <div className="text-sm">
                            {contactPrincipal.nom}
                            {contactPrincipal.fonction && (
                              <span className="text-muted-foreground"> ({contactPrincipal.fonction})</span>
                            )}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{tiers.siegeTel || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingTiers(tiers)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingTiers(tiers)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {tiers.typeTiers === 'PROSPECT' && canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600"
                              onClick={() => convertMutation.mutate(tiers.id)}
                              title="Convertir en client"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500"
                              onClick={() => {
                                if (confirm('Supprimer ce tiers ?')) {
                                  deleteMutation.mutate(tiers.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {tiersData?.tiers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucun tiers trouvé
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <TiersFormDialog
        open={showCreateDialog || !!editingTiers}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingTiers(null);
          }
        }}
        tiers={editingTiers}
      />

      {/* View Sheet */}
      <TiersDetailSheet
        open={!!viewingTiers}
        onOpenChange={(open) => !open && setViewingTiers(null)}
        tiersId={viewingTiers?.id}
        canEdit={canEdit}
        onEdit={() => {
          if (viewingTiers) {
            setEditingTiers(viewingTiers);
            setViewingTiers(null);
          }
        }}
      />
    </div>
  );
}

// ============ TIERS FORM DIALOG ============
function TiersFormDialog({
  open,
  onOpenChange,
  tiers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiers: Tiers | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!tiers;

  const [formData, setFormData] = useState<CreateTiersInput>({
    nomEntreprise: '',
    typeTiers: 'CLIENT',
  });

  const [activeTab, setActiveTab] = useState('general');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (tiers) {
        setFormData({
          nomEntreprise: tiers.nomEntreprise,
          nomAlias: tiers.nomAlias,
          typeTiers: tiers.typeTiers,
          formeJuridique: tiers.formeJuridique,
          siegeRC: tiers.siegeRC,
          siegeNIF: tiers.siegeNIF,
          siegeAI: tiers.siegeAI,
          siegeNIS: tiers.siegeNIS,
          tvaIntracom: tiers.tvaIntracom,
          capital: tiers.capital,
          siegeNom: tiers.siegeNom,
          siegeAdresse: tiers.siegeAdresse,
          siegeCodePostal: tiers.siegeCodePostal,
          siegeVille: tiers.siegeVille,
          siegePays: tiers.siegePays,
          siegeTel: tiers.siegeTel,
          siegeFax: tiers.siegeFax,
          siegeEmail: tiers.siegeEmail,
          siegeWebsite: tiers.siegeWebsite,
          secteur: tiers.secteur,
          remiseParDefaut: tiers.remiseParDefaut,
          encoursMaximum: tiers.encoursMaximum,
          devise: tiers.devise,
          notePublique: tiers.notePublique,
          notePrivee: tiers.notePrivee,
        });
      } else {
        setFormData({
          nomEntreprise: '',
          typeTiers: 'CLIENT',
          siegePays: 'Algérie',
          devise: 'DZD',
        });
      }
      setActiveTab('general');
    }
  }, [open, tiers]);

  const { data: modesPaiement } = useQuery({
    queryKey: ['modes-paiement'],
    queryFn: referentielsApi.getModesPaiement,
    enabled: open,
  });

  const { data: conditionsPaiement } = useQuery({
    queryKey: ['conditions-paiement'],
    queryFn: referentielsApi.getConditionsPaiement,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: tiersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      queryClient.invalidateQueries({ queryKey: ['tiers-stats'] });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTiersInput> }) =>
      tiersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      queryClient.invalidateQueries({ queryKey: ['tiers-stats'] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && tiers) {
      updateMutation.mutate({ id: tiers.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier le tiers' : 'Nouveau tiers'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="adresse">Adresse</TabsTrigger>
              <TabsTrigger value="legal">Légal</TabsTrigger>
              <TabsTrigger value="commercial">Commercial</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type de tiers *</Label>
                  <Select
                    value={formData.typeTiers}
                    onValueChange={(v) => setFormData({ ...formData, typeTiers: v as TypeTiers })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_TIERS_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Forme juridique</Label>
                  <Select
                    value={formData.formeJuridique || ''}
                    onValueChange={(v) => setFormData({ ...formData, formeJuridique: v as FormeJuridique })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FORME_JURIDIQUE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Raison sociale *</Label>
                <Input
                  value={formData.nomEntreprise}
                  onChange={(e) => setFormData({ ...formData, nomEntreprise: e.target.value })}
                  placeholder="Nom de l'entreprise"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Nom commercial / Enseigne</Label>
                <Input
                  value={formData.nomAlias || ''}
                  onChange={(e) => setFormData({ ...formData, nomAlias: e.target.value })}
                  placeholder="Nom commercial"
                />
              </div>

              <div className="space-y-2">
                <Label>Secteur d'activité</Label>
                <Input
                  value={formData.secteur || ''}
                  onChange={(e) => setFormData({ ...formData, secteur: e.target.value })}
                  placeholder="Ex: BTP, Services, Commerce..."
                />
              </div>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="adresse" className="space-y-4">
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Textarea
                  value={formData.siegeAdresse || ''}
                  onChange={(e) => setFormData({ ...formData, siegeAdresse: e.target.value })}
                  placeholder="Rue, numéro..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input
                    value={formData.siegeCodePostal || ''}
                    onChange={(e) => setFormData({ ...formData, siegeCodePostal: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input
                    value={formData.siegeVille || ''}
                    onChange={(e) => setFormData({ ...formData, siegeVille: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pays</Label>
                  <Input
                    value={formData.siegePays || ''}
                    onChange={(e) => setFormData({ ...formData, siegePays: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={formData.siegeTel || ''}
                    onChange={(e) => setFormData({ ...formData, siegeTel: e.target.value })}
                    placeholder="+213..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fax</Label>
                  <Input
                    value={formData.siegeFax || ''}
                    onChange={(e) => setFormData({ ...formData, siegeFax: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.siegeEmail || ''}
                    onChange={(e) => setFormData({ ...formData, siegeEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site web</Label>
                  <Input
                    value={formData.siegeWebsite || ''}
                    onChange={(e) => setFormData({ ...formData, siegeWebsite: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </TabsContent>

            {/* Legal Tab */}
            <TabsContent value="legal" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Registre du Commerce (RC)</Label>
                  <Input
                    value={formData.siegeRC || ''}
                    onChange={(e) => setFormData({ ...formData, siegeRC: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIF</Label>
                  <Input
                    value={formData.siegeNIF || ''}
                    onChange={(e) => setFormData({ ...formData, siegeNIF: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Article d'Imposition (AI)</Label>
                  <Input
                    value={formData.siegeAI || ''}
                    onChange={(e) => setFormData({ ...formData, siegeAI: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>NIS</Label>
                  <Input
                    value={formData.siegeNIS || ''}
                    onChange={(e) => setFormData({ ...formData, siegeNIS: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>TVA Intracommunautaire</Label>
                  <Input
                    value={formData.tvaIntracom || ''}
                    onChange={(e) => setFormData({ ...formData, tvaIntracom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capital social</Label>
                  <Input
                    type="number"
                    value={formData.capital || ''}
                    onChange={(e) => setFormData({ ...formData, capital: parseFloat(e.target.value) || undefined })}
                    placeholder="En DZD"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Commercial Tab */}
            <TabsContent value="commercial" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mode de paiement par défaut</Label>
                  <Select
                    value={formData.modePaiementId || ''}
                    onValueChange={(v) => setFormData({ ...formData, modePaiementId: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {modesPaiement?.map((mode) => (
                        <SelectItem key={mode.id} value={mode.id}>
                          {mode.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conditions de paiement</Label>
                  <Select
                    value={formData.conditionPaiementId || ''}
                    onValueChange={(v) => setFormData({ ...formData, conditionPaiementId: v || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionsPaiement?.map((cond) => (
                        <SelectItem key={cond.id} value={cond.id}>
                          {cond.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Remise par défaut (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.remiseParDefaut || ''}
                    onChange={(e) => setFormData({ ...formData, remiseParDefaut: parseFloat(e.target.value) || undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Encours maximum</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.encoursMaximum || ''}
                    onChange={(e) => setFormData({ ...formData, encoursMaximum: parseFloat(e.target.value) || undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Devise</Label>
                  <Select
                    value={formData.devise || 'DZD'}
                    onValueChange={(v) => setFormData({ ...formData, devise: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DZD">DZD - Dinar algérien</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="USD">USD - Dollar US</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Note publique (visible sur documents)</Label>
                <Textarea
                  value={formData.notePublique || ''}
                  onChange={(e) => setFormData({ ...formData, notePublique: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Note privée (interne)</Label>
                <Textarea
                  value={formData.notePrivee || ''}
                  onChange={(e) => setFormData({ ...formData, notePrivee: e.target.value })}
                  rows={2}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending || !formData.nomEntreprise}>
              {isEdit ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============ TIERS DETAIL SHEET ============
function TiersDetailSheet({
  open,
  onOpenChange,
  tiersId,
  canEdit,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiersId?: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const { data: tiers, isLoading } = useQuery({
    queryKey: ['tiers', tiersId],
    queryFn: () => tiersApi.get(tiersId!),
    enabled: !!tiersId && open,
  });

  if (!tiersId) return null;

  const config = tiers ? TYPE_TIERS_CONFIG[tiers.typeTiers] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Fiche tiers</span>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="py-8 text-center">Chargement...</div>
        ) : tiers ? (
          <div className="space-y-6 mt-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${config?.bgColor}`}>
                <Building2 className={`h-8 w-8 ${config?.color}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{tiers.nomEntreprise}</h2>
                {tiers.nomAlias && (
                  <p className="text-muted-foreground">{tiers.nomAlias}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <Badge className={`${config?.bgColor} ${config?.color}`}>
                    {config?.label}
                  </Badge>
                  {tiers.code && (
                    <Badge variant="outline" className="font-mono">
                      {tiers.code}
                    </Badge>
                  )}
                  {!tiers.actif && (
                    <Badge variant="destructive">Inactif</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="font-semibold border-b pb-2">Coordonnées</h3>
              {tiers.siegeAdresse && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p>{tiers.siegeAdresse}</p>
                    <p>{tiers.siegeCodePostal} {tiers.siegeVille}</p>
                    <p>{tiers.siegePays}</p>
                  </div>
                </div>
              )}
              {tiers.siegeTel && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{tiers.siegeTel}</span>
                </div>
              )}
              {tiers.siegeEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${tiers.siegeEmail}`} className="text-primary hover:underline">
                    {tiers.siegeEmail}
                  </a>
                </div>
              )}
            </div>

            {/* Legal Info */}
            {(tiers.siegeRC || tiers.siegeNIF || tiers.siegeAI || tiers.siegeNIS) && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Informations légales</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {tiers.siegeRC && (
                    <div>
                      <span className="text-muted-foreground">RC:</span> {tiers.siegeRC}
                    </div>
                  )}
                  {tiers.siegeNIF && (
                    <div>
                      <span className="text-muted-foreground">NIF:</span> {tiers.siegeNIF}
                    </div>
                  )}
                  {tiers.siegeAI && (
                    <div>
                      <span className="text-muted-foreground">AI:</span> {tiers.siegeAI}
                    </div>
                  )}
                  {tiers.siegeNIS && (
                    <div>
                      <span className="text-muted-foreground">NIS:</span> {tiers.siegeNIS}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contacts */}
            {tiers.siegeContacts && tiers.siegeContacts.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Contacts</h3>
                <div className="space-y-2">
                  {tiers.siegeContacts.map((contact) => (
                    <div key={contact.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {contact.prenom} {contact.nom}
                        </span>
                        {contact.estPrincipal && (
                          <Badge variant="outline" className="text-xs">Principal</Badge>
                        )}
                      </div>
                      {contact.fonction && (
                        <p className="text-sm text-muted-foreground">{contact.fonction}</p>
                      )}
                      <div className="flex gap-4 mt-1 text-sm">
                        {contact.tel && <span>{contact.tel}</span>}
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                            {contact.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bank Accounts */}
            {tiers.comptesBancaires && tiers.comptesBancaires.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold border-b pb-2">Comptes bancaires</h3>
                <div className="space-y-2">
                  {tiers.comptesBancaires.map((compte) => (
                    <div key={compte.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{compte.libelle}</span>
                        {compte.estDefaut && (
                          <Badge variant="outline" className="text-xs">Par défaut</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {compte.banque} {compte.agence && `- ${compte.agence}`}
                      </p>
                      {compte.iban && (
                        <p className="text-sm font-mono mt-1">IBAN: {compte.iban}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="space-y-3">
              <h3 className="font-semibold border-b pb-2">Statistiques</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{tiers._count?.contrats || 0}</p>
                  <p className="text-sm text-muted-foreground">Contrats</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{tiers._count?.interventions || 0}</p>
                  <p className="text-sm text-muted-foreground">Interventions</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
