import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Receipt, Wallet, Landmark } from 'lucide-react';
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
import { chargesApi, facturesFournisseursApi, paiementsDiversApi, produitsServicesApi, tiersApi } from '@/services/api';
import type {
  Charge,
  CreateChargeInput,
  CreateFactureFournisseurInput,
  CreatePaiementChargeInput,
  CreatePaiementDiversInput,
  CreatePaiementFournisseurInput,
  FactureFournisseur,
  ProduitService,
  Tiers,
} from '@/types';
import { useAuthStore } from '@/store/auth.store';

const EMPTY_FOURNISSEUR_LINE = {
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

function computeTotals(lignes: Array<{ quantite: number; prixUnitaireHT?: number; tauxTVA?: number; remisePct?: number }>) {
  const totalHT = lignes.reduce((sum, l) => {
    const remise = l.remisePct ? (l.remisePct / 100) : 0;
    const prix = l.prixUnitaireHT || 0;
    return sum + l.quantite * prix * (1 - remise);
  }, 0);
  const totalTVA = lignes.reduce((sum, l) => {
    const remise = l.remisePct ? (l.remisePct / 100) : 0;
    const prix = l.prixUnitaireHT || 0;
    const tva = l.tauxTVA || 0;
    const ht = l.quantite * prix * (1 - remise);
    return sum + ht * (tva / 100);
  }, 0);
  return { totalHT, totalTVA, totalTTC: totalHT + totalTVA };
}

function statutBadge(statut: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
    BROUILLON: { label: 'Brouillon', variant: 'secondary' },
    VALIDEE: { label: 'Validée', variant: 'success' },
    EN_RETARD: { label: 'En retard', variant: 'warning' },
    PARTIELLEMENT_PAYEE: { label: 'Partiellement payée', variant: 'warning' },
    PAYEE: { label: 'Payée', variant: 'success' },
    ANNULEE: { label: 'Annulée', variant: 'destructive' },
    A_PAYER: { label: 'À payer', variant: 'warning' },
  };
  const badge = map[statut] || { label: statut, variant: 'secondary' };
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

export function FacturationPage() {
  const queryClient = useQueryClient();
  const { canDo } = useAuthStore();

  const { data: fournisseursData } = useQuery({
    queryKey: ['tiers', 'fournisseurs'],
    queryFn: () => tiersApi.list({ page: 1, limit: 200 }),
  });

  const { data: produitsData } = useQuery({
    queryKey: ['produits-services', 'facturation'],
    queryFn: () => produitsServicesApi.list({ page: 1, limit: 200, actif: true, enAchat: true }),
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

  const [factureForm, setFactureForm] = useState<CreateFactureFournisseurInput>({
    fournisseurId: '',
    lignes: [{ ...EMPTY_FOURNISSEUR_LINE }],
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

  const [paiementFacture, setPaiementFacture] = useState<{ id: string; montant: number; datePaiement?: string }>({ id: '', montant: 0 });
  const [paiementCharge, setPaiementCharge] = useState<{ id: string; montant: number; datePaiement?: string }>({ id: '', montant: 0 });

  const totalsFacture = useMemo(() => computeTotals(factureForm.lignes), [factureForm.lignes]);

  const createFactureMutation = useMutation({
    mutationFn: (payload: CreateFactureFournisseurInput) => facturesFournisseursApi.create(payload),
    onSuccess: () => {
      toast.success('Facture fournisseur créée');
      queryClient.invalidateQueries({ queryKey: ['factures-fournisseurs'] });
      setFactureForm({ fournisseurId: '', lignes: [{ ...EMPTY_FOURNISSEUR_LINE }] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création de la facture');
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

  const renderFactureLignes = (
    lignes: CreateFactureFournisseurInput['lignes'],
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
                  if (next.lignes.length === 0) next.lignes = [{ ...EMPTY_FOURNISSEUR_LINE }];
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
            lignes: [...prev.lignes, { ...EMPTY_FOURNISSEUR_LINE, ordre: prev.lignes.length + 1 }],
          }))
        }
      >
        <Plus className="h-4 w-4 mr-2" /> Ajouter une ligne
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facturation</h1>
        <p className="text-muted-foreground">Factures fournisseurs, charges et paiements divers</p>
      </div>

      <Tabs defaultValue="factures">
        <TabsList>
          <TabsTrigger value="factures"><Receipt className="h-4 w-4 mr-2" />Factures fournisseurs</TabsTrigger>
          <TabsTrigger value="charges"><Wallet className="h-4 w-4 mr-2" />Charges</TabsTrigger>
          <TabsTrigger value="divers"><Landmark className="h-4 w-4 mr-2" />Paiements divers</TabsTrigger>
        </TabsList>

        <TabsContent value="factures">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Factures fournisseurs</CardTitle>
              {canDo('manageFacturation') && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nouvelle facture</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Créer une facture fournisseur</DialogTitle>
                      <DialogDescription>Renseignez les informations principales.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Fournisseur</label>
                          <Select
                            value={factureForm.fournisseurId}
                            onValueChange={(value) => setFactureForm({ ...factureForm, fournisseurId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un fournisseur" />
                            </SelectTrigger>
                            <SelectContent>
                              {fournisseurs.map((t: Tiers) => (
                                <SelectItem key={t.id} value={t.id}>{t.nomEntreprise}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Réf. fournisseur</label>
                          <Input
                            value={factureForm.refFournisseur || ''}
                            onChange={(e) => setFactureForm({ ...factureForm, refFournisseur: e.target.value })}
                          />
                        </div>
                      </div>

                      {renderFactureLignes(factureForm.lignes, (updater) => setFactureForm(updater), produits)}

                      <div className="flex items-center justify-between text-sm">
                        <div className="text-muted-foreground">Total HT: {totalsFacture.totalHT.toFixed(2)} DA</div>
                        <div className="text-muted-foreground">TVA: {totalsFacture.totalTVA.toFixed(2)} DA</div>
                        <div className="font-medium">Total TTC: {totalsFacture.totalTTC.toFixed(2)} DA</div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={() => createFactureMutation.mutate(factureForm)}
                          disabled={!factureForm.fournisseurId || factureForm.lignes.length === 0}
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
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Total TTC</TableHead>
                      <TableHead>Payé</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facturesData?.factures?.map((f: FactureFournisseur) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.ref}</TableCell>
                        <TableCell>{f.fournisseur?.nomEntreprise || '-'}</TableCell>
                        <TableCell>{new Date(f.dateFacture).toLocaleDateString()}</TableCell>
                        <TableCell>{statutBadge(f.statut)}</TableCell>
                        <TableCell>{f.totalTTC.toFixed(2)} DA</TableCell>
                        <TableCell>{f.totalPaye.toFixed(2)} DA</TableCell>
                        <TableCell className="text-right">
                          {canDo('manageFacturation') && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">Paiement</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Ajouter un paiement</DialogTitle>
                                  <DialogDescription>Enregistrer un paiement fournisseur.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <Input
                                    type="number"
                                    placeholder="Montant"
                                    value={paiementFacture.id === f.id ? paiementFacture.montant : ''}
                                    onChange={(e) => setPaiementFacture({ id: f.id, montant: parseFloat(e.target.value) || 0 })}
                                  />
                                  <Input
                                    type="date"
                                    value={paiementFacture.id === f.id ? paiementFacture.datePaiement || '' : ''}
                                    onChange={(e) => setPaiementFacture({ id: f.id, montant: paiementFacture.montant || 0, datePaiement: e.target.value })}
                                  />
                                  <div className="flex justify-end">
                                    <Button
                                      onClick={() => createPaiementFactureMutation.mutate({
                                        id: f.id,
                                        payload: { montant: paiementFacture.montant, datePaiement: paiementFacture.datePaiement },
                                      })}
                                      disabled={!paiementFacture.montant}
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
                        <TableCell colSpan={7} className="text-center text-muted-foreground">Aucune facture</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charges">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Charges</CardTitle>
              {canDo('manageFacturation') && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nouvelle charge</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Créer une charge</DialogTitle>
                      <DialogDescription>Renseignez les informations principales.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Type</label>
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
                        <div>
                          <label className="text-sm text-muted-foreground">Libellé</label>
                          <Input
                            value={chargeForm.libelle || ''}
                            onChange={(e) => setChargeForm({ ...chargeForm, libelle: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Montant HT</label>
                          <Input
                            type="number"
                            value={chargeForm.montantHT || 0}
                            onChange={(e) => setChargeForm({ ...chargeForm, montantHT: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">TVA %</label>
                          <Input
                            type="number"
                            value={chargeForm.tauxTVA || 0}
                            onChange={(e) => setChargeForm({ ...chargeForm, tauxTVA: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Date charge</label>
                          <Input
                            type="date"
                            value={chargeForm.dateCharge || ''}
                            onChange={(e) => setChargeForm({ ...chargeForm, dateCharge: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={() => createChargeMutation.mutate(chargeForm)} disabled={!chargeForm.libelle}>Créer</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {chargesLoading ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : (
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
                    {chargesData?.charges?.map((c: Charge) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.ref}</TableCell>
                        <TableCell>{c.libelle}</TableCell>
                        <TableCell>{new Date(c.dateCharge).toLocaleDateString()}</TableCell>
                        <TableCell>{statutBadge(c.statut)}</TableCell>
                        <TableCell>{c.montantTTC.toFixed(2)} DA</TableCell>
                        <TableCell>{c.montantPaye.toFixed(2)} DA</TableCell>
                        <TableCell className="text-right">
                          {canDo('manageFacturation') && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">Paiement</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Ajouter un paiement</DialogTitle>
                                  <DialogDescription>Enregistrer un paiement de charge.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <Input
                                    type="number"
                                    placeholder="Montant"
                                    value={paiementCharge.id === c.id ? paiementCharge.montant : ''}
                                    onChange={(e) => setPaiementCharge({ id: c.id, montant: parseFloat(e.target.value) || 0 })}
                                  />
                                  <Input
                                    type="date"
                                    value={paiementCharge.id === c.id ? paiementCharge.datePaiement || '' : ''}
                                    onChange={(e) => setPaiementCharge({ id: c.id, montant: paiementCharge.montant || 0, datePaiement: e.target.value })}
                                  />
                                  <div className="flex justify-end">
                                    <Button
                                      onClick={() => createPaiementChargeMutation.mutate({
                                        id: c.id,
                                        payload: { montant: paiementCharge.montant, datePaiement: paiementCharge.datePaiement },
                                      })}
                                      disabled={!paiementCharge.montant}
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
                    {(!chargesData?.charges || chargesData.charges.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">Aucune charge</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Paiements divers</CardTitle>
              {canDo('manageFacturation') && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nouveau paiement</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Créer un paiement divers</DialogTitle>
                      <DialogDescription>Encaissement ou décaissement divers.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground">Libellé</label>
                          <Input
                            value={paiementDiversForm.libelle || ''}
                            onChange={(e) => setPaiementDiversForm({ ...paiementDiversForm, libelle: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Type</label>
                          <Select
                            value={paiementDiversForm.typeOperation}
                            onValueChange={(value) => setPaiementDiversForm({ ...paiementDiversForm, typeOperation: value as CreatePaiementDiversInput['typeOperation'] })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ENCAISSEMENT">Encaissement</SelectItem>
                              <SelectItem value="DECAISSEMENT">Décaissement</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Montant</label>
                        <Input
                          type="number"
                          value={paiementDiversForm.montant || 0}
                          onChange={(e) => setPaiementDiversForm({ ...paiementDiversForm, montant: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={() => createPaiementDiversMutation.mutate(paiementDiversForm)} disabled={!paiementDiversForm.libelle}>Créer</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {paiementsDiversLoading ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paiementsDiversData?.paiements?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.ref}</TableCell>
                        <TableCell>{p.libelle}</TableCell>
                        <TableCell>{p.typeOperation}</TableCell>
                        <TableCell>{new Date(p.datePaiement).toLocaleDateString()}</TableCell>
                        <TableCell>{p.montant.toFixed(2)} DA</TableCell>
                      </TableRow>
                    ))}
                    {(!paiementsDiversData?.paiements || paiementsDiversData.paiements.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">Aucun paiement</TableCell>
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

export default FacturationPage;
