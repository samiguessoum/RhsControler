import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Receipt,
  Wallet,
  Landmark,
  Truck,
  Search,
  FileDown,
  Trash2,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  chargesApi,
  commandesFournisseursApi,
  facturesFournisseursApi,
  paiementsDiversApi,
  produitsServicesApi,
  tiersApi,
} from '@/services/api';
import type {
  Charge,
  CreateChargeInput,
  CreateCommandeFournisseurInput,
  CreateFactureFournisseurInput,
  CreatePaiementChargeInput,
  CreatePaiementDiversInput,
  CreatePaiementFournisseurInput,
  FactureFournisseur,
  ProduitService,
  Tiers,
} from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import {
  EMPTY_LINE,
  TVA_OPTIONS,
  computeTotals,
  formatMontant,
  formatDate,
  statusBadge,
} from '@/lib/commerce-utils';

// ============ LIGNES FORM COMPONENT ============

function LignesForm({
  lignes,
  setForm,
  produitsList,
}: {
  lignes: CreateCommandeFournisseurInput['lignes'] | CreateFactureFournisseurInput['lignes'];
  setForm: (updater: (prev: any) => any) => void;
  produitsList: ProduitService[];
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700">Lignes du document</div>

      {lignes.map((ligne, index) => (
        <div key={index} className="p-4 bg-gray-50 rounded-lg border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Ligne {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-500 h-8"
              onClick={() => {
                setForm((prev: any) => {
                  const next = { ...prev };
                  next.lignes = next.lignes.filter((_: any, idx: number) => idx !== index);
                  if (next.lignes.length === 0) next.lignes = [{ ...EMPTY_LINE }];
                  return next;
                });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Ligne 1: Produit et Libellé */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Produit / Service</Label>
              <Select
                value={ligne.produitServiceId || 'custom'}
                onValueChange={(value) => {
                  if (value === 'custom') {
                    setForm((prev: any) => {
                      const next = { ...prev };
                      next.lignes[index] = { ...next.lignes[index], produitServiceId: undefined };
                      return next;
                    });
                    return;
                  }
                  const produit = produitsList.find((p) => p.id === value);
                  setForm((prev: any) => {
                    const next = { ...prev };
                    next.lignes[index] = {
                      ...next.lignes[index],
                      produitServiceId: value,
                      libelle: produit?.nom || next.lignes[index].libelle,
                      prixUnitaireHT: produit?.prixAchatHT || next.lignes[index].prixUnitaireHT,
                      tauxTVA: produit?.tauxTVA || next.lignes[index].tauxTVA,
                      unite: produit?.unite || next.lignes[index].unite,
                    };
                    return next;
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un produit ou saisie libre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Saisie libre</SelectItem>
                  {produitsList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nom} {p.prixAchatHT ? `- ${formatMontant(p.prixAchatHT)}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Désignation</Label>
              <Input
                value={ligne.libelle || ''}
                placeholder="Description de la ligne"
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((prev: any) => {
                    const next = { ...prev };
                    next.lignes[index] = { ...next.lignes[index], libelle: value };
                    return next;
                  });
                }}
              />
            </div>
          </div>

          {/* Ligne 2: Quantité, Prix unitaire, TVA */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Quantité</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={ligne.quantite}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setForm((prev: any) => {
                    const next = { ...prev };
                    next.lignes[index] = { ...next.lignes[index], quantite: value };
                    return next;
                  });
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Prix unitaire HT (DA)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={ligne.prixUnitaireHT || 0}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setForm((prev: any) => {
                    const next = { ...prev };
                    next.lignes[index] = { ...next.lignes[index], prixUnitaireHT: value };
                    return next;
                  });
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Taux TVA</Label>
              <Select
                value={String(ligne.tauxTVA ?? 19)}
                onValueChange={(value) => {
                  setForm((prev: any) => {
                    const next = { ...prev };
                    next.lignes[index] = { ...next.lignes[index], tauxTVA: parseInt(value) };
                    return next;
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TVA_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Sous-total HT</Label>
              <div className="h-10 px-3 py-2 bg-white border rounded-md text-sm font-medium text-right">
                {formatMontant((ligne.quantite || 0) * (ligne.prixUnitaireHT || 0))}
              </div>
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() =>
          setForm((prev: any) => ({
            ...prev,
            lignes: [...prev.lignes, { ...EMPTY_LINE, ordre: prev.lignes.length + 1 }],
          }))
        }
      >
        <Plus className="h-4 w-4 mr-2" />
        Ajouter une ligne
      </Button>
    </div>
  );
}

// ============ TOTALS DISPLAY COMPONENT ============

function TotalsDisplay({ totals, className }: { totals: { totalHT: number; totalTVA: number; totalTTC: number }; className?: string }) {
  return (
    <div className={cn('bg-gray-50 rounded-lg p-4 space-y-2', className)}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Total Hors Taxes</span>
        <span className="font-medium">{formatMontant(totals.totalHT)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">TVA</span>
        <span className="font-medium">{formatMontant(totals.totalTVA)}</span>
      </div>
      <div className="flex justify-between text-lg pt-2 border-t border-gray-200">
        <span className="font-semibold text-primary">Total TTC</span>
        <span className="font-bold text-primary text-xl">{formatMontant(totals.totalTTC)}</span>
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function FacturationPage() {
  const queryClient = useQueryClient();
  const { canDo } = useAuthStore();
  const canManage = canDo('manageFacturation');

  // Search states
  const [searchCmdFournisseurs, setSearchCmdFournisseurs] = useState('');
  const [searchFactures, setSearchFactures] = useState('');
  const [searchCharges, setSearchCharges] = useState('');

  // ============ QUERIES ============

  const { data: fournisseursData } = useQuery({
    queryKey: ['tiers', 'fournisseurs'],
    queryFn: () => tiersApi.list({ page: 1, limit: 200 }),
  });

  const { data: produitsData } = useQuery({
    queryKey: ['produits-services', 'facturation'],
    queryFn: () => produitsServicesApi.list({ page: 1, limit: 200, actif: true, enAchat: true }),
  });

  const { data: commandesFournisseursData, isLoading: commandesFournisseursLoading } = useQuery({
    queryKey: ['achats', 'commandes-fournisseurs'],
    queryFn: () => commandesFournisseursApi.list({ limit: 100 }),
  });

  const { data: facturesData, isLoading: facturesLoading } = useQuery({
    queryKey: ['factures-fournisseurs'],
    queryFn: () => facturesFournisseursApi.list({ limit: 50 }),
  });

  const { data: chargesData, isLoading: chargesLoading } = useQuery({
    queryKey: ['charges'],
    queryFn: () => chargesApi.list({ limit: 50 }),
  });

  const { data: paiementsDiversData, isLoading: paiementsDiversLoading } = useQuery({
    queryKey: ['paiements-divers'],
    queryFn: () => paiementsDiversApi.list({ limit: 50 }),
  });

  const fournisseurs = (fournisseursData?.tiers || []).filter((t: Tiers) => t.typeTiers === 'FOURNISSEUR' || t.typeTiers === 'CLIENT_FOURNISSEUR');
  const produits = produitsData?.produits || [];

  // Filter lists based on search
  const filteredCmdFournisseurs = useMemo(() => {
    const list = commandesFournisseursData?.commandes || [];
    if (!searchCmdFournisseurs) return list;
    const search = searchCmdFournisseurs.toLowerCase();
    return list.filter((cf: any) =>
      cf.ref?.toLowerCase().includes(search) ||
      cf.fournisseur?.nomEntreprise?.toLowerCase().includes(search)
    );
  }, [commandesFournisseursData?.commandes, searchCmdFournisseurs]);

  const filteredFactures = useMemo(() => {
    const list = facturesData?.factures || [];
    if (!searchFactures) return list;
    const search = searchFactures.toLowerCase();
    return list.filter((f: FactureFournisseur) =>
      f.ref?.toLowerCase().includes(search) ||
      f.fournisseur?.nomEntreprise?.toLowerCase().includes(search)
    );
  }, [facturesData?.factures, searchFactures]);

  const filteredCharges = useMemo(() => {
    const list = chargesData?.charges || [];
    if (!searchCharges) return list;
    const search = searchCharges.toLowerCase();
    return list.filter((c: Charge) =>
      c.ref?.toLowerCase().includes(search) ||
      c.libelle?.toLowerCase().includes(search)
    );
  }, [chargesData?.charges, searchCharges]);

  // ============ FORM STATES ============

  const [commandeFournisseurForm, setCommandeFournisseurForm] = useState<CreateCommandeFournisseurInput>({
    fournisseurId: '',
    lignes: [{ ...EMPTY_LINE }],
  });
  const [factureForm, setFactureForm] = useState<CreateFactureFournisseurInput>({
    fournisseurId: '',
    lignes: [{ ...EMPTY_LINE }],
  });
  const [chargeForm, setChargeForm] = useState<CreateChargeInput>({
    typeCharge: 'DIVERSE',
    libelle: '',
    montantHT: 0,
    tauxTVA: 0,
  });
  const [paiementDiversForm, setPaiementDiversForm] = useState<CreatePaiementDiversInput>({
    libelle: '',
    typeOperation: 'DECAISSEMENT',
    montant: 0,
  });

  // Dialog states
  const [showCmdFournisseurDialog, setShowCmdFournisseurDialog] = useState(false);
  const [showFactureDialog, setShowFactureDialog] = useState(false);
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [showPaiementDiversDialog, setShowPaiementDiversDialog] = useState(false);
  const [editingCommandeFournisseurId, setEditingCommandeFournisseurId] = useState<string | null>(null);
  const [editingFactureFournisseurId, setEditingFactureFournisseurId] = useState<string | null>(null);

  const [paiementFacture, setPaiementFacture] = useState<{ id: string; montant: number; datePaiement?: string }>({ id: '', montant: 0 });
  const [paiementCharge, setPaiementCharge] = useState<{ id: string; montant: number; datePaiement?: string }>({ id: '', montant: 0 });

  const totalsCommandeFournisseur = useMemo(() => computeTotals(commandeFournisseurForm.lignes), [commandeFournisseurForm.lignes]);
  const totalsFacture = useMemo(() => computeTotals(factureForm.lignes), [factureForm.lignes]);

  // ============ MUTATIONS ============

  const createCommandeFournisseurMutation = useMutation({
    mutationFn: (payload: CreateCommandeFournisseurInput) => commandesFournisseursApi.create(payload),
    onSuccess: (data) => {
      toast.success('Commande fournisseur créée', {
        description: `Référence: ${data.ref || 'N/A'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['achats', 'commandes-fournisseurs'] });
      setCommandeFournisseurForm({ fournisseurId: '', lignes: [{ ...EMPTY_LINE }] });
      setShowCmdFournisseurDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const createFactureMutation = useMutation({
    mutationFn: (payload: CreateFactureFournisseurInput) => facturesFournisseursApi.create(payload),
    onSuccess: () => {
      toast.success('Facture fournisseur créée');
      queryClient.invalidateQueries({ queryKey: ['factures-fournisseurs'] });
      setFactureForm({ fournisseurId: '', lignes: [{ ...EMPTY_LINE }] });
      setShowFactureDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création de la facture');
    },
  });

  const updateCommandeFournisseurMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCommandeFournisseurInput> }) =>
      commandesFournisseursApi.update(id, payload),
    onSuccess: () => {
      toast.success('Commande fournisseur mise à jour');
      queryClient.invalidateQueries({ queryKey: ['achats', 'commandes-fournisseurs'] });
      setCommandeFournisseurForm({ fournisseurId: '', lignes: [{ ...EMPTY_LINE }] });
      setEditingCommandeFournisseurId(null);
      setShowCmdFournisseurDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const updateFactureFournisseurMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateFactureFournisseurInput> }) =>
      facturesFournisseursApi.update(id, payload),
    onSuccess: () => {
      toast.success('Facture fournisseur mise à jour');
      queryClient.invalidateQueries({ queryKey: ['factures-fournisseurs'] });
      setFactureForm({ fournisseurId: '', lignes: [{ ...EMPTY_LINE }] });
      setEditingFactureFournisseurId(null);
      setShowFactureDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la mise à jour de la facture');
    },
  });

  const createChargeMutation = useMutation({
    mutationFn: (payload: CreateChargeInput) => chargesApi.create(payload),
    onSuccess: () => {
      toast.success('Charge créée');
      queryClient.invalidateQueries({ queryKey: ['charges'] });
      setChargeForm({ typeCharge: 'DIVERSE', libelle: '', montantHT: 0, tauxTVA: 0 });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création de la charge');
    },
  });

  const createPaiementDiversMutation = useMutation({
    mutationFn: (payload: CreatePaiementDiversInput) => paiementsDiversApi.create(payload),
    onSuccess: () => {
      toast.success('Paiement divers créé');
      queryClient.invalidateQueries({ queryKey: ['paiements-divers'] });
      setPaiementDiversForm({ libelle: '', typeOperation: 'DECAISSEMENT', montant: 0 });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const createPaiementFactureMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreatePaiementFournisseurInput }) =>
      facturesFournisseursApi.createPaiement(id, payload),
    onSuccess: () => {
      toast.success('Paiement ajouté');
      queryClient.invalidateQueries({ queryKey: ['factures-fournisseurs'] });
      setPaiementFacture({ id: '', montant: 0 });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors du paiement');
    },
  });

  const createPaiementChargeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreatePaiementChargeInput }) =>
      chargesApi.createPaiement(id, payload),
    onSuccess: () => {
      toast.success('Paiement ajouté');
      queryClient.invalidateQueries({ queryKey: ['charges'] });
      setPaiementCharge({ id: '', montant: 0 });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors du paiement');
    },
  });

  const validerCommandeFournisseur = useMutation({
    mutationFn: (id: string) => commandesFournisseursApi.valider(id),
    onSuccess: () => {
      toast.success('Commande fournisseur validée');
      queryClient.invalidateQueries({ queryKey: ['achats', 'commandes-fournisseurs'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la validation');
    },
  });

  const validerFactureFournisseur = useMutation({
    mutationFn: (id: string) => facturesFournisseursApi.valider(id),
    onSuccess: () => {
      toast.success('Facture fournisseur validée');
      queryClient.invalidateQueries({ queryKey: ['factures-fournisseurs'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la validation');
    },
  });

  // ============ RENDER ============

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Achats & Dépenses</h1>
          <p className="text-muted-foreground">Commandes fournisseurs, factures, charges et paiements</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cmd Fournisseurs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{commandesFournisseursData?.commandes?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Factures</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{facturesData?.factures?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Charges</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{chargesData?.charges?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paiements Divers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{paiementsDiversData?.paiements?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="commandes">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="commandes" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Commandes</span>
          </TabsTrigger>
          <TabsTrigger value="factures" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Factures</span>
          </TabsTrigger>
          <TabsTrigger value="charges" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Charges</span>
          </TabsTrigger>
          <TabsTrigger value="divers" className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            <span className="hidden sm:inline">Paiements</span>
          </TabsTrigger>
        </TabsList>

        {/* COMMANDES FOURNISSEURS TAB */}
        <TabsContent value="commandes">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Commandes Fournisseurs</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchCmdFournisseurs}
                      onChange={(e) => setSearchCmdFournisseurs(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {canManage && (
                    <Button onClick={() => setShowCmdFournisseurDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Nouvelle commande</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {commandesFournisseursLoading ? (
                <p className="text-muted-foreground text-center py-8">Chargement...</p>
              ) : filteredCmdFournisseurs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchCmdFournisseurs ? 'Aucune commande trouvée' : 'Aucune commande fournisseur'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Fournisseur</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCmdFournisseurs.map((cf: any) => (
                        <TableRow key={cf.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{cf.ref}</TableCell>
                          <TableCell>{cf.fournisseur?.nomEntreprise || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(cf.dateCommande)}</TableCell>
                          <TableCell>{statusBadge(cf.statut)}</TableCell>
                          <TableCell className="text-right font-medium">{formatMontant(cf.totalTTC)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {canManage && cf.statut === 'BROUILLON' && (
                                <Tooltip content="Modifier la commande">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={async () => {
                                      try {
                                        const fullCommande = await commandesFournisseursApi.get(cf.id);
                                        setEditingCommandeFournisseurId(cf.id);
                                        setCommandeFournisseurForm({
                                          fournisseurId: fullCommande.fournisseurId,
                                          dateCommande: fullCommande.dateCommande?.split('T')[0],
                                          dateLivraisonSouhaitee: fullCommande.dateLivraisonSouhaitee?.split('T')[0],
                                          notes: fullCommande.notes || '',
                                          conditions: fullCommande.conditions || '',
                                          lignes: fullCommande.lignes?.map((l: any) => ({
                                            produitServiceId: l.produitServiceId || '',
                                            libelle: l.libelle || '',
                                            description: l.description || '',
                                            quantite: l.quantite || 1,
                                            prixUnitaireHT: l.prixUnitaireHT || 0,
                                            tauxTVA: l.tauxTVA || 20,
                                            remisePct: l.remisePct || 0,
                                          })) || [{ ...EMPTY_LINE }],
                                        });
                                        setShowCmdFournisseurDialog(true);
                                      } catch {
                                        toast.error('Erreur lors du chargement de la commande');
                                      }
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && cf.statut === 'BROUILLON' && (
                                <Tooltip content="Valider la commande">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => validerCommandeFournisseur.mutate(cf.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              <Tooltip content="Télécharger PDF">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => commandesFournisseursApi.downloadPdf(cf.id).catch(() => toast.error('Erreur téléchargement'))}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FACTURES FOURNISSEURS TAB */}
        <TabsContent value="factures">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Factures Fournisseurs</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchFactures}
                      onChange={(e) => setSearchFactures(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {canManage && (
                    <Button onClick={() => setShowFactureDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Nouvelle facture</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {facturesLoading ? (
                <p className="text-muted-foreground text-center py-8">Chargement...</p>
              ) : filteredFactures.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchFactures ? 'Aucune facture trouvée' : 'Aucune facture fournisseur'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Réf.</TableHead>
                        <TableHead>Fournisseur</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">Payé</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFactures.map((f: FactureFournisseur) => (
                        <TableRow key={f.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{f.ref}</TableCell>
                          <TableCell>{f.fournisseur?.nomEntreprise || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(f.dateFacture)}</TableCell>
                          <TableCell>{statusBadge(f.statut)}</TableCell>
                          <TableCell className="text-right font-medium">{formatMontant(f.totalTTC)}</TableCell>
                          <TableCell className="text-right hidden lg:table-cell">{formatMontant(f.totalPaye)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {canManage && f.statut === 'BROUILLON' && (
                                <Tooltip content="Modifier la facture">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={async () => {
                                      try {
                                        const fullFacture = await facturesFournisseursApi.get(f.id);
                                        setEditingFactureFournisseurId(f.id);
                                        setFactureForm({
                                          fournisseurId: fullFacture.fournisseurId,
                                          refFournisseur: fullFacture.refFournisseur || '',
                                          dateFacture: fullFacture.dateFacture?.split('T')[0],
                                          dateEcheance: fullFacture.dateEcheance?.split('T')[0],
                                          notes: fullFacture.notes || '',
                                          conditions: fullFacture.conditions || '',
                                          lignes: fullFacture.lignes?.map((l: any) => ({
                                            produitServiceId: l.produitServiceId || '',
                                            libelle: l.libelle || '',
                                            description: l.description || '',
                                            quantite: l.quantite || 1,
                                            prixUnitaireHT: l.prixUnitaireHT || 0,
                                            tauxTVA: l.tauxTVA || 20,
                                            remisePct: l.remisePct || 0,
                                          })) || [{ ...EMPTY_LINE }],
                                        });
                                        setShowFactureDialog(true);
                                      } catch {
                                        toast.error('Erreur lors du chargement de la facture');
                                      }
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && f.statut === 'BROUILLON' && (
                                <Tooltip content="Valider la facture">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => validerFactureFournisseur.mutate(f.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && f.statut !== 'BROUILLON' && f.statut !== 'PAYEE' && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="outline">Paiement</Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Ajouter un paiement</DialogTitle>
                                      <DialogDescription>Enregistrer un paiement pour la facture {f.ref}</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                        <p className="text-sm text-orange-700">Reste à payer</p>
                                        <p className="text-xl font-bold text-orange-700">{formatMontant(f.totalTTC - f.totalPaye)}</p>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Montant</Label>
                                        <Input
                                          type="number"
                                          placeholder="Montant"
                                          value={paiementFacture.id === f.id ? paiementFacture.montant : ''}
                                          onChange={(e) => setPaiementFacture({ id: f.id, montant: parseFloat(e.target.value) || 0 })}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Date de paiement</Label>
                                        <Input
                                          type="date"
                                          value={paiementFacture.id === f.id ? paiementFacture.datePaiement || '' : ''}
                                          onChange={(e) => setPaiementFacture({ id: f.id, montant: paiementFacture.montant || 0, datePaiement: e.target.value })}
                                        />
                                      </div>
                                      <DialogFooter>
                                        <Button
                                          onClick={() => createPaiementFactureMutation.mutate({
                                            id: f.id,
                                            payload: { montant: paiementFacture.montant, datePaiement: paiementFacture.datePaiement },
                                          })}
                                          disabled={!paiementFacture.montant}
                                        >
                                          Enregistrer
                                        </Button>
                                      </DialogFooter>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CHARGES TAB */}
        <TabsContent value="charges">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Charges</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchCharges}
                      onChange={(e) => setSearchCharges(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {canManage && (
                    <Button onClick={() => setShowChargeDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Nouvelle charge</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chargesLoading ? (
                <p className="text-muted-foreground text-center py-8">Chargement...</p>
              ) : filteredCharges.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchCharges ? 'Aucune charge trouvée' : 'Aucune charge'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Réf.</TableHead>
                        <TableHead>Libellé</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Total TTC</TableHead>
                      <TableHead>Payé</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCharges.map((c: Charge) => (
                      <TableRow key={c.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{c.ref}</TableCell>
                        <TableCell>{c.libelle}</TableCell>
                        <TableCell>{formatDate(c.dateCharge)}</TableCell>
                        <TableCell>{statusBadge(c.statut)}</TableCell>
                        <TableCell className="text-right font-medium">{formatMontant(c.montantTTC)}</TableCell>
                        <TableCell className="text-right">{formatMontant(c.montantPaye)}</TableCell>
                        <TableCell className="text-right">
                          {canManage && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">Paiement</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Ajouter un paiement</DialogTitle>
                                  <DialogDescription>Enregistrer un paiement pour la charge {c.ref}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <p className="text-sm text-orange-700">Reste à payer</p>
                                    <p className="text-xl font-bold text-orange-700">{formatMontant(c.montantTTC - c.montantPaye)}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Montant</Label>
                                    <Input
                                      type="number"
                                      placeholder="Montant"
                                      value={paiementCharge.id === c.id ? paiementCharge.montant : ''}
                                      onChange={(e) => setPaiementCharge({ id: c.id, montant: parseFloat(e.target.value) || 0 })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Date de paiement</Label>
                                    <Input
                                      type="date"
                                      value={paiementCharge.id === c.id ? paiementCharge.datePaiement || '' : ''}
                                      onChange={(e) => setPaiementCharge({ id: c.id, montant: paiementCharge.montant || 0, datePaiement: e.target.value })}
                                    />
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      onClick={() => createPaiementChargeMutation.mutate({
                                        id: c.id,
                                        payload: { montant: paiementCharge.montant, datePaiement: paiementCharge.datePaiement },
                                      })}
                                      disabled={!paiementCharge.montant}
                                    >
                                      Enregistrer
                                    </Button>
                                  </DialogFooter>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAIEMENTS DIVERS TAB */}
        <TabsContent value="divers">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Paiements Divers</CardTitle>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <Button onClick={() => setShowPaiementDiversDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Nouveau paiement</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {paiementsDiversLoading ? (
                <p className="text-muted-foreground text-center py-8">Chargement...</p>
              ) : (!paiementsDiversData?.paiements || paiementsDiversData.paiements.length === 0) ? (
                <p className="text-muted-foreground text-center py-8">Aucun paiement divers</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Réf.</TableHead>
                        <TableHead>Libellé</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paiementsDiversData?.paiements?.map((p) => (
                        <TableRow key={p.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{p.ref}</TableCell>
                          <TableCell>{p.libelle}</TableCell>
                          <TableCell>
                            {p.typeOperation === 'ENCAISSEMENT' ? (
                              <span className="text-green-600 font-medium">Encaissement</span>
                            ) : (
                              <span className="text-red-600 font-medium">Décaissement</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(p.datePaiement)}</TableCell>
                          <TableCell className="text-right font-medium">{formatMontant(p.montant)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============ DIALOGS ============ */}

      {/* Commande Fournisseur Dialog */}
      <Dialog open={showCmdFournisseurDialog} onOpenChange={(open) => {
        setShowCmdFournisseurDialog(open);
        if (!open) {
          setEditingCommandeFournisseurId(null);
          setCommandeFournisseurForm({ fournisseurId: '', lignes: [{ ...EMPTY_LINE }] });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCommandeFournisseurId ? 'Modifier la commande fournisseur' : 'Créer une commande fournisseur'}</DialogTitle>
            <DialogDescription>
              {editingCommandeFournisseurId
                ? "Modifiez les informations de la commande fournisseur en brouillon."
                : "Remplissez les informations pour créer une nouvelle commande auprès d'un fournisseur."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fournisseur <span className="text-red-500">*</span></Label>
                <Select
                  value={commandeFournisseurForm.fournisseurId}
                  onValueChange={(value) => setCommandeFournisseurForm({ ...commandeFournisseurForm, fournisseurId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    {fournisseurs.map((f: Tiers) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nomEntreprise}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date de livraison souhaitée</Label>
                <Input
                  type="date"
                  value={commandeFournisseurForm.dateLivraisonSouhaitee || ''}
                  onChange={(e) => setCommandeFournisseurForm({ ...commandeFournisseurForm, dateLivraisonSouhaitee: e.target.value })}
                />
              </div>
            </div>

            <LignesForm lignes={commandeFournisseurForm.lignes} setForm={setCommandeFournisseurForm} produitsList={produits} />

            <TotalsDisplay totals={totalsCommandeFournisseur} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCmdFournisseurDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (editingCommandeFournisseurId) {
                  updateCommandeFournisseurMutation.mutate({ id: editingCommandeFournisseurId, payload: commandeFournisseurForm });
                } else {
                  createCommandeFournisseurMutation.mutate(commandeFournisseurForm);
                }
              }}
              disabled={!commandeFournisseurForm.fournisseurId || commandeFournisseurForm.lignes.length === 0 || createCommandeFournisseurMutation.isPending || updateCommandeFournisseurMutation.isPending}
            >
              {createCommandeFournisseurMutation.isPending || updateCommandeFournisseurMutation.isPending
                ? (editingCommandeFournisseurId ? 'Mise à jour...' : 'Création...')
                : (editingCommandeFournisseurId ? 'Enregistrer les modifications' : 'Créer la commande')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Facture Fournisseur Dialog */}
      <Dialog open={showFactureDialog} onOpenChange={(open) => {
        setShowFactureDialog(open);
        if (!open) {
          setEditingFactureFournisseurId(null);
          setFactureForm({ fournisseurId: '', lignes: [{ ...EMPTY_LINE }] });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFactureFournisseurId ? 'Modifier la facture fournisseur' : 'Créer une facture fournisseur'}</DialogTitle>
            <DialogDescription>
              {editingFactureFournisseurId
                ? 'Modifiez les informations de la facture fournisseur en brouillon.'
                : 'Remplissez les informations pour enregistrer une facture fournisseur.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fournisseur <span className="text-red-500">*</span></Label>
                <Select
                  value={factureForm.fournisseurId}
                  onValueChange={(value) => setFactureForm({ ...factureForm, fournisseurId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    {fournisseurs.map((f: Tiers) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nomEntreprise}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Référence fournisseur</Label>
                <Input
                  value={factureForm.refFournisseur || ''}
                  placeholder="Numéro de facture du fournisseur"
                  onChange={(e) => setFactureForm({ ...factureForm, refFournisseur: e.target.value })}
                />
              </div>
            </div>

            <LignesForm lignes={factureForm.lignes} setForm={setFactureForm} produitsList={produits} />

            <TotalsDisplay totals={totalsFacture} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFactureDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (editingFactureFournisseurId) {
                  updateFactureFournisseurMutation.mutate({ id: editingFactureFournisseurId, payload: factureForm });
                } else {
                  createFactureMutation.mutate(factureForm);
                }
              }}
              disabled={!factureForm.fournisseurId || factureForm.lignes.length === 0 || createFactureMutation.isPending || updateFactureFournisseurMutation.isPending}
            >
              {createFactureMutation.isPending || updateFactureFournisseurMutation.isPending
                ? (editingFactureFournisseurId ? 'Mise à jour...' : 'Création...')
                : (editingFactureFournisseurId ? 'Enregistrer les modifications' : 'Créer la facture')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Charge Dialog */}
      <Dialog open={showChargeDialog} onOpenChange={setShowChargeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une charge</DialogTitle>
            <DialogDescription>
              Renseignez les informations de la charge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de charge</Label>
                <Select
                  value={chargeForm.typeCharge}
                  onValueChange={(value) => setChargeForm({ ...chargeForm, typeCharge: value as CreateChargeInput['typeCharge'] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOURNISSEUR">Fournisseur</SelectItem>
                    <SelectItem value="FISCALE">Fiscale</SelectItem>
                    <SelectItem value="SOCIALE">Sociale</SelectItem>
                    <SelectItem value="DIVERSE">Diverse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Libellé <span className="text-red-500">*</span></Label>
                <Input
                  value={chargeForm.libelle || ''}
                  placeholder="Description de la charge"
                  onChange={(e) => setChargeForm({ ...chargeForm, libelle: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Montant HT</Label>
                <Input
                  type="number"
                  value={chargeForm.montantHT || 0}
                  onChange={(e) => setChargeForm({ ...chargeForm, montantHT: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>TVA %</Label>
                <Input
                  type="number"
                  value={chargeForm.tauxTVA || 0}
                  onChange={(e) => setChargeForm({ ...chargeForm, tauxTVA: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={chargeForm.dateCharge || ''}
                  onChange={(e) => setChargeForm({ ...chargeForm, dateCharge: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChargeDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createChargeMutation.mutate(chargeForm)}
              disabled={!chargeForm.libelle || createChargeMutation.isPending}
            >
              {createChargeMutation.isPending ? 'Création...' : 'Créer la charge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paiement Divers Dialog */}
      <Dialog open={showPaiementDiversDialog} onOpenChange={setShowPaiementDiversDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un paiement divers</DialogTitle>
            <DialogDescription>
              Encaissement ou décaissement non lié à une facture.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Libellé <span className="text-red-500">*</span></Label>
              <Input
                value={paiementDiversForm.libelle || ''}
                placeholder="Description du paiement"
                onChange={(e) => setPaiementDiversForm({ ...paiementDiversForm, libelle: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type d'opération</Label>
                <Select
                  value={paiementDiversForm.typeOperation}
                  onValueChange={(value) => setPaiementDiversForm({ ...paiementDiversForm, typeOperation: value as CreatePaiementDiversInput['typeOperation'] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENCAISSEMENT">Encaissement (entrée)</SelectItem>
                    <SelectItem value="DECAISSEMENT">Décaissement (sortie)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Montant</Label>
                <Input
                  type="number"
                  value={paiementDiversForm.montant || 0}
                  onChange={(e) => setPaiementDiversForm({ ...paiementDiversForm, montant: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaiementDiversDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createPaiementDiversMutation.mutate(paiementDiversForm)}
              disabled={!paiementDiversForm.libelle || createPaiementDiversMutation.isPending}
            >
              {createPaiementDiversMutation.isPending ? 'Création...' : 'Créer le paiement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FacturationPage;
