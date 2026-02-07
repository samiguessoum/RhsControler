import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, FileText, Receipt, ShoppingCart, ArrowRightLeft, FileDown, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { commerceApi, commandesFournisseursApi, produitsServicesApi, tiersApi } from '@/services/api';
import type { CreateCommandeInput, CreateDevisInput, CreateFactureInput, CreateCommandeFournisseurInput, ProduitService, Tiers, FactureType } from '@/types';
import { useAuthStore } from '@/store/auth.store';

const EMPTY_LINE = {
  produitServiceId: undefined as string | undefined,
  libelle: '',
  description: '',
  quantite: 1,
  unite: '',
  prixUnitaireHT: 0,
  tauxTVA: 19,
  remisePct: 0,
  ordre: 1,
};

function computeTotals(lignes: Array<{ quantite: number; prixUnitaireHT?: number; tauxTVA?: number; remisePct?: number }>, sign: number = 1) {
  const totalHT = lignes.reduce((sum, l) => {
    const prix = l.prixUnitaireHT ?? 0;
    const remise = l.remisePct ? (l.remisePct / 100) : 0;
    return sum + l.quantite * prix * (1 - remise);
  }, 0) * sign;
  const totalTVA = lignes.reduce((sum, l) => {
    const prix = l.prixUnitaireHT ?? 0;
    const tva = l.tauxTVA ?? 0;
    const remise = l.remisePct ? (l.remisePct / 100) : 0;
    const ht = l.quantite * prix * (1 - remise);
    return sum + ht * (tva / 100);
  }, 0) * sign;
  return { totalHT, totalTVA, totalTTC: totalHT + totalTVA };
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
    BROUILLON: { label: 'Brouillon', variant: 'secondary' },
    VALIDE: { label: 'Validé', variant: 'success' },
    SIGNE: { label: 'Signé', variant: 'success' },
    REFUSE: { label: 'Refusé', variant: 'destructive' },
    EXPIRE: { label: 'Expiré', variant: 'warning' },
    ANNULE: { label: 'Annulé', variant: 'destructive' },
    ANNULEE: { label: 'Annulée', variant: 'destructive' },
    VALIDEE: { label: 'Validée', variant: 'success' },
    EN_PREPARATION: { label: 'Préparation', variant: 'warning' },
    EXPEDIEE: { label: 'Expédiée', variant: 'warning' },
    LIVREE: { label: 'Livrée', variant: 'success' },
    EN_RETARD: { label: 'En retard', variant: 'warning' },
    PARTIELLEMENT_PAYEE: { label: 'Partiellement payée', variant: 'warning' },
    PAYEE: { label: 'Payée', variant: 'success' },
    // Commandes fournisseurs
    ENVOYEE: { label: 'Envoyée', variant: 'default' },
    CONFIRMEE: { label: 'Confirmée', variant: 'success' },
    EN_RECEPTION: { label: 'En réception', variant: 'warning' },
    RECUE: { label: 'Reçue', variant: 'success' },
  };
  const badge = map[status] || { label: status, variant: 'secondary' };
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

export function CommercePage() {
  const queryClient = useQueryClient();
  const { canDo } = useAuthStore();

  const { data: devisData, isLoading: devisLoading } = useQuery({
    queryKey: ['commerce', 'devis'],
    queryFn: () => commerceApi.listDevis({ limit: 50 }),
  });

  const { data: commandesData, isLoading: commandesLoading } = useQuery({
    queryKey: ['commerce', 'commandes'],
    queryFn: () => commerceApi.listCommandes({ limit: 50 }),
  });

  const { data: facturesData, isLoading: facturesLoading } = useQuery({
    queryKey: ['commerce', 'factures'],
    queryFn: () => commerceApi.listFactures({ limit: 50 }),
  });

  const { data: commandesFournisseursData, isLoading: commandesFournisseursLoading } = useQuery({
    queryKey: ['commerce', 'commandes-fournisseurs'],
    queryFn: () => commandesFournisseursApi.list({ limit: 50 }),
  });

  const { data: tiersData } = useQuery({
    queryKey: ['tiers', 'commerce'],
    queryFn: () => tiersApi.list({ page: 1, limit: 200 }),
  });

  const { data: produitsData } = useQuery({
    queryKey: ['produits-services', 'commerce'],
    queryFn: () => produitsServicesApi.list({ page: 1, limit: 200, actif: true, enVente: true }),
  });

  const { data: produitsAchatData } = useQuery({
    queryKey: ['produits-services', 'commerce-achat'],
    queryFn: () => produitsServicesApi.list({ page: 1, limit: 200, actif: true, enAchat: true }),
  });

  const tiers = tiersData?.tiers || [];
  const fournisseurs = tiers.filter((t) => t.typeTiers === 'FOURNISSEUR' || t.typeTiers === 'CLIENT_FOURNISSEUR');
  const produits = produitsData?.produits || [];
  const produitsAchat = produitsAchatData?.produits || [];

  const [devisForm, setDevisForm] = useState<CreateDevisInput>({
    clientId: '',
    lignes: [{ ...EMPTY_LINE }],
  });
  const [commandeForm, setCommandeForm] = useState<CreateCommandeInput>({
    clientId: '',
    lignes: [{ ...EMPTY_LINE }],
  });
  const [factureForm, setFactureForm] = useState<CreateFactureInput>({
    clientId: '',
    lignes: [{ ...EMPTY_LINE }],
    type: 'FACTURE',
  });
  const [relanceForm, setRelanceForm] = useState<{ id: string; canal: 'EMAIL' | 'SMS' | 'COURRIER' | 'APPEL'; commentaire?: string; niveau?: number }>({
    id: '',
    canal: 'EMAIL',
  });
  const [commandeFournisseurForm, setCommandeFournisseurForm] = useState<CreateCommandeFournisseurInput>({
    fournisseurId: '',
    lignes: [{ ...EMPTY_LINE }],
  });

  const totalsDevis = useMemo(() => computeTotals(devisForm.lignes), [devisForm.lignes]);
  const totalsCommande = useMemo(() => computeTotals(commandeForm.lignes), [commandeForm.lignes]);
  const factureSign = factureForm.type === 'AVOIR' ? -1 : 1;
  const totalsFacture = useMemo(() => computeTotals(factureForm.lignes, factureSign), [factureForm.lignes, factureSign]);
  const totalsCommandeFournisseur = useMemo(() => computeTotals(commandeFournisseurForm.lignes), [commandeFournisseurForm.lignes]);

  const createDevisMutation = useMutation({
    mutationFn: (payload: CreateDevisInput) => commerceApi.createDevis(payload),
    onSuccess: () => {
      toast.success('Devis créé');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'devis'] });
      setDevisForm({ clientId: '', lignes: [{ ...EMPTY_LINE }] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création du devis');
    },
  });

  const createCommandeMutation = useMutation({
    mutationFn: (payload: CreateCommandeInput) => commerceApi.createCommande(payload),
    onSuccess: () => {
      toast.success('Commande créée');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes'] });
      setCommandeForm({ clientId: '', lignes: [{ ...EMPTY_LINE }] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création de la commande');
    },
  });

  const createFactureMutation = useMutation({
    mutationFn: (payload: CreateFactureInput) => commerceApi.createFacture(payload),
    onSuccess: () => {
      toast.success('Facture créée');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'factures'] });
      setFactureForm({ clientId: '', lignes: [{ ...EMPTY_LINE }], type: 'FACTURE' });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création de la facture');
    },
  });

  const convertirDevis = useMutation({
    mutationFn: (id: string) => commerceApi.convertirDevisCommande(id),
    onSuccess: () => {
      toast.success('Commande créée depuis le devis');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la conversion');
    },
  });

  const convertirCommande = useMutation({
    mutationFn: (id: string) => commerceApi.convertirCommandeFacture(id),
    onSuccess: () => {
      toast.success('Facture créée depuis la commande');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'factures'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la conversion');
    },
  });

  const createRelanceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { canal: 'EMAIL' | 'SMS' | 'COURRIER' | 'APPEL'; commentaire?: string; niveau?: number } }) =>
      commerceApi.createRelance(id, payload),
    onSuccess: () => {
      toast.success('Relance enregistrée');
      setRelanceForm({ id: '', canal: 'EMAIL' });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la relance');
    },
  });

  const createCommandeFournisseurMutation = useMutation({
    mutationFn: (payload: CreateCommandeFournisseurInput) => commandesFournisseursApi.create(payload),
    onSuccess: () => {
      toast.success('Commande fournisseur créée');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes-fournisseurs'] });
      setCommandeFournisseurForm({ fournisseurId: '', lignes: [{ ...EMPTY_LINE }] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création de la commande fournisseur');
    },
  });

  const renderLignesForm = (
    lignes: CreateDevisInput['lignes'],
    setForm: (updater: (prev: any) => any) => void,
    produitsList: ProduitService[],
  ) => (
    <div className="space-y-3">
      {lignes.map((ligne, index) => (
        <div key={index} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Produit</label>
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
                    prixUnitaireHT: produit?.prixVenteHT || next.lignes[index].prixUnitaireHT,
                    tauxTVA: produit?.tauxTVA || next.lignes[index].tauxTVA,
                    unite: produit?.unite || next.lignes[index].unite,
                  };
                  return next;
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Produit/Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Saisie libre</SelectItem>
                {produitsList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Libellé</label>
            <Input
              value={ligne.libelle || ''}
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
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Qté</label>
            <Input
              type="number"
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
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">PU HT</label>
            <Input
              type="number"
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
          <div className="col-span-1">
            <label className="text-xs text-muted-foreground">TVA</label>
            <Input
              type="number"
              value={ligne.tauxTVA || 0}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setForm((prev: any) => {
                  const next = { ...prev };
                  next.lignes[index] = { ...next.lignes[index], tauxTVA: value };
                  return next;
                });
              }}
            />
          </div>
          <div className="col-span-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setForm((prev: any) => {
                  const next = { ...prev };
                  next.lignes = next.lignes.filter((_: any, idx: number) => idx !== index);
                  if (next.lignes.length === 0) next.lignes = [{ ...EMPTY_LINE }];
                  return next;
                });
              }}
            >
              Suppr.
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setForm((prev: any) => ({
            ...prev,
            lignes: [...prev.lignes, { ...EMPTY_LINE, ordre: prev.lignes.length + 1 }],
          }))
        }
      >
        <Plus className="h-4 w-4 mr-2" /> Ajouter une ligne
      </Button>
    </div>
  );

  const renderLignesFournisseurForm = (
    lignes: CreateCommandeFournisseurInput['lignes'],
    setForm: (updater: (prev: any) => any) => void,
    produitsList: ProduitService[],
  ) => (
    <div className="space-y-3">
      {lignes.map((ligne, index) => (
        <div key={index} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Produit</label>
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
                <SelectValue placeholder="Produit/Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Saisie libre</SelectItem>
                {produitsList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Libellé</label>
            <Input
              value={ligne.libelle || ''}
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
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Qté</label>
            <Input
              type="number"
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
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">PU HT</label>
            <Input
              type="number"
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
          <div className="col-span-1">
            <label className="text-xs text-muted-foreground">TVA</label>
            <Input
              type="number"
              value={ligne.tauxTVA || 0}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setForm((prev: any) => {
                  const next = { ...prev };
                  next.lignes[index] = { ...next.lignes[index], tauxTVA: value };
                  return next;
                });
              }}
            />
          </div>
          <div className="col-span-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setForm((prev: any) => {
                  const next = { ...prev };
                  next.lignes = next.lignes.filter((_: any, idx: number) => idx !== index);
                  if (next.lignes.length === 0) next.lignes = [{ ...EMPTY_LINE }];
                  return next;
                });
              }}
            >
              Suppr.
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setForm((prev: any) => ({
            ...prev,
            lignes: [...prev.lignes, { ...EMPTY_LINE, ordre: prev.lignes.length + 1 }],
          }))
        }
      >
        <Plus className="h-4 w-4 mr-2" /> Ajouter une ligne
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commerce</h1>
          <p className="text-muted-foreground">Devis, commandes, factures et paiements</p>
        </div>
      </div>

      <Tabs defaultValue="devis">
        <TabsList>
          <TabsTrigger value="devis">
            <FileText className="h-4 w-4 mr-2" /> Devis
          </TabsTrigger>
          <TabsTrigger value="commandes">
            <ShoppingCart className="h-4 w-4 mr-2" /> Commandes
          </TabsTrigger>
          <TabsTrigger value="factures">
            <Receipt className="h-4 w-4 mr-2" /> Factures
          </TabsTrigger>
          <TabsTrigger value="fournisseurs">
            <Truck className="h-4 w-4 mr-2" /> Cmd Fournisseurs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devis">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Devis</CardTitle>
              {canDo('manageCommerce') && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" /> Nouveau devis
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Créer un devis</DialogTitle>
                      <DialogDescription>Saisissez les informations principales du devis.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Client</label>
                          <Select
                            value={devisForm.clientId}
                            onValueChange={(value) => setDevisForm({ ...devisForm, clientId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un client" />
                            </SelectTrigger>
                            <SelectContent>
                              {tiers.map((t: Tiers) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.nomEntreprise}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Date de validité</label>
                          <Input
                            type="date"
                            value={devisForm.dateValidite || ''}
                            onChange={(e) => setDevisForm({ ...devisForm, dateValidite: e.target.value })}
                          />
                        </div>
                      </div>

                      {renderLignesForm(devisForm.lignes, (updater) => setDevisForm(updater), produits)}

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-muted-foreground">Total HT: {totalsDevis.totalHT.toFixed(2)} DA</div>
                        <div className="text-muted-foreground">TVA: {totalsDevis.totalTVA.toFixed(2)} DA</div>
                        <div className="font-medium">Total TTC: {totalsDevis.totalTTC.toFixed(2)} DA</div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => createDevisMutation.mutate(devisForm)}
                          disabled={!devisForm.clientId || devisForm.lignes.length === 0}
                        >
                          Créer
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {devisLoading ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Total TTC</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devisData?.devis?.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.ref}</TableCell>
                        <TableCell>{d.client?.nomEntreprise || '-'}</TableCell>
                        <TableCell>{new Date(d.dateDevis).toLocaleDateString()}</TableCell>
                        <TableCell>{statusBadge(d.statut)}</TableCell>
                        <TableCell>{d.totalTTC?.toFixed(2)} DA</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => commerceApi.downloadDevisPdf(d.id).catch(() => toast.error('Erreur téléchargement PDF'))}
                            title="Télécharger PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          {canDo('manageCommerce') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => convertirDevis.mutate(d.id)}
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-1" /> Cmd
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!devisData?.devis || devisData.devis.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Aucun devis
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commandes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Commandes</CardTitle>
              {canDo('manageCommerce') && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" /> Nouvelle commande
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Créer une commande</DialogTitle>
                      <DialogDescription>Saisissez les informations principales de la commande.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Client</label>
                          <Select
                            value={commandeForm.clientId}
                            onValueChange={(value) => setCommandeForm({ ...commandeForm, clientId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un client" />
                            </SelectTrigger>
                            <SelectContent>
                              {tiers.map((t: Tiers) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.nomEntreprise}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Livraison souhaitée</label>
                          <Input
                            type="date"
                            value={commandeForm.dateLivraisonSouhaitee || ''}
                            onChange={(e) => setCommandeForm({ ...commandeForm, dateLivraisonSouhaitee: e.target.value })}
                          />
                        </div>
                      </div>

                      {renderLignesForm(commandeForm.lignes, (updater) => setCommandeForm(updater), produits)}

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-muted-foreground">Total HT: {totalsCommande.totalHT.toFixed(2)} DA</div>
                        <div className="text-muted-foreground">TVA: {totalsCommande.totalTVA.toFixed(2)} DA</div>
                        <div className="font-medium">Total TTC: {totalsCommande.totalTTC.toFixed(2)} DA</div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => createCommandeMutation.mutate(commandeForm)}
                          disabled={!commandeForm.clientId || commandeForm.lignes.length === 0}
                        >
                          Créer
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {commandesLoading ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Total TTC</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commandesData?.commandes?.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.ref}</TableCell>
                        <TableCell>{c.client?.nomEntreprise || '-'}</TableCell>
                        <TableCell>{new Date(c.dateCommande).toLocaleDateString()}</TableCell>
                        <TableCell>{statusBadge(c.statut)}</TableCell>
                        <TableCell>{c.totalTTC?.toFixed(2)} DA</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => commerceApi.downloadCommandePdf(c.id).catch(() => toast.error('Erreur téléchargement PDF'))}
                            title="Télécharger PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          {canDo('manageCommerce') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => convertirCommande.mutate(c.id)}
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-1" /> Fact
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!commandesData?.commandes || commandesData.commandes.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Aucune commande
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="factures">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Factures</CardTitle>
              {canDo('manageCommerce') && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" /> Nouvelle facture
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Créer une facture</DialogTitle>
                      <DialogDescription>Saisissez les informations principales de la facture.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Client</label>
                          <Select
                            value={factureForm.clientId}
                            onValueChange={(value) => setFactureForm({ ...factureForm, clientId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un client" />
                            </SelectTrigger>
                            <SelectContent>
                              {tiers.map((t: Tiers) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.nomEntreprise}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Échéance</label>
                          <Input
                            type="date"
                            value={factureForm.dateEcheance || ''}
                            onChange={(e) => setFactureForm({ ...factureForm, dateEcheance: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Type</label>
                          <Select
                            value={factureForm.type || 'FACTURE'}
                            onValueChange={(value) => setFactureForm({ ...factureForm, type: value as FactureType })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FACTURE">Facture</SelectItem>
                              <SelectItem value="AVOIR">Avoir</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {renderLignesForm(factureForm.lignes, (updater) => setFactureForm(updater), produits)}

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-muted-foreground">Total HT: {totalsFacture.totalHT.toFixed(2)} DA</div>
                        <div className="text-muted-foreground">TVA: {totalsFacture.totalTVA.toFixed(2)} DA</div>
                        <div className="font-medium">Total TTC: {totalsFacture.totalTTC.toFixed(2)} DA</div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => createFactureMutation.mutate(factureForm)}
                          disabled={!factureForm.clientId || factureForm.lignes.length === 0}
                        >
                          Créer
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {facturesLoading ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Total TTC</TableHead>
                      <TableHead>Payé</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facturesData?.factures?.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.ref}</TableCell>
                        <TableCell>{f.client?.nomEntreprise || '-'}</TableCell>
                        <TableCell>{new Date(f.dateFacture).toLocaleDateString()}</TableCell>
                        <TableCell>{statusBadge(f.statut)}</TableCell>
                        <TableCell>{f.type === 'AVOIR' ? <Badge variant="secondary">Avoir</Badge> : <Badge variant="default">Facture</Badge>}</TableCell>
                        <TableCell>{f.totalTTC?.toFixed(2)} DA</TableCell>
                        <TableCell>{f.totalPaye?.toFixed(2)} DA</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => commerceApi.downloadFacturePdf(f.id).catch(() => toast.error('Erreur téléchargement PDF'))}
                            title="Télécharger PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          {canDo('manageCommerce') && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">Relancer</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Créer une relance</DialogTitle>
                                  <DialogDescription>Enregistrer une relance client.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3">
                                  <Select
                                    value={relanceForm.id === f.id ? relanceForm.canal : 'EMAIL'}
                                    onValueChange={(value) => setRelanceForm({ id: f.id, canal: value as any })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Canal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="EMAIL">Email</SelectItem>
                                      <SelectItem value="SMS">SMS</SelectItem>
                                      <SelectItem value="COURRIER">Courrier</SelectItem>
                                      <SelectItem value="APPEL">Appel</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    placeholder="Commentaire"
                                    value={relanceForm.id === f.id ? (relanceForm.commentaire || '') : ''}
                                    onChange={(e) => setRelanceForm({ id: f.id, canal: relanceForm.canal, commentaire: e.target.value, niveau: relanceForm.niveau })}
                                  />
                                  <Input
                                    type="number"
                                    placeholder="Niveau"
                                    value={relanceForm.id === f.id ? (relanceForm.niveau ?? '') : ''}
                                    onChange={(e) => setRelanceForm({ id: f.id, canal: relanceForm.canal, commentaire: relanceForm.commentaire, niveau: parseInt(e.target.value) || 1 })}
                                  />
                                  <div className="flex justify-end">
                                    <Button
                                      onClick={() => createRelanceMutation.mutate({ id: f.id, payload: { canal: relanceForm.canal, commentaire: relanceForm.commentaire, niveau: relanceForm.niveau } })}
                                    >
                                      Enregistrer
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!facturesData?.factures || facturesData.factures.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Aucune facture
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fournisseurs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Commandes Fournisseurs</CardTitle>
              {canDo('manageCommerce') && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" /> Nouvelle commande
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Créer une commande fournisseur</DialogTitle>
                      <DialogDescription>Saisissez les informations principales de la commande.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Fournisseur</label>
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
                        <div>
                          <label className="text-sm text-muted-foreground">Livraison souhaitée</label>
                          <Input
                            type="date"
                            value={commandeFournisseurForm.dateLivraisonSouhaitee || ''}
                            onChange={(e) => setCommandeFournisseurForm({ ...commandeFournisseurForm, dateLivraisonSouhaitee: e.target.value })}
                          />
                        </div>
                      </div>

                      {renderLignesFournisseurForm(commandeFournisseurForm.lignes, (updater) => setCommandeFournisseurForm(updater), produitsAchat)}

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-muted-foreground">Total HT: {totalsCommandeFournisseur.totalHT.toFixed(2)} DA</div>
                        <div className="text-muted-foreground">TVA: {totalsCommandeFournisseur.totalTVA.toFixed(2)} DA</div>
                        <div className="font-medium">Total TTC: {totalsCommandeFournisseur.totalTTC.toFixed(2)} DA</div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => createCommandeFournisseurMutation.mutate(commandeFournisseurForm)}
                          disabled={!commandeFournisseurForm.fournisseurId || commandeFournisseurForm.lignes.length === 0}
                        >
                          Créer
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {commandesFournisseursLoading ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Total TTC</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commandesFournisseursData?.commandes?.map((cf) => (
                      <TableRow key={cf.id}>
                        <TableCell className="font-medium">{cf.ref}</TableCell>
                        <TableCell>{cf.fournisseur?.nomEntreprise || '-'}</TableCell>
                        <TableCell>{new Date(cf.dateCommande).toLocaleDateString()}</TableCell>
                        <TableCell>{statusBadge(cf.statut)}</TableCell>
                        <TableCell>{cf.totalTTC?.toFixed(2)} DA</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => commandesFournisseursApi.downloadPdf(cf.id).catch(() => toast.error('Erreur téléchargement PDF'))}
                            title="Télécharger PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!commandesFournisseursData?.commandes || commandesFournisseursData.commandes.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Aucune commande fournisseur
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CommercePage;
