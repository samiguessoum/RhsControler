import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  Receipt,
  ShoppingCart,
  ArrowRightLeft,
  FileDown,
  Truck,
  Search,
  Eye,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Trash2,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { commerceApi, commandesFournisseursApi, produitsServicesApi, tiersApi } from '@/services/api';
import type { CreateCommandeInput, CreateDevisInput, CreateFactureInput, CreateCommandeFournisseurInput, ProduitService, Tiers, FactureType } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

// ============ CONFIGURATION ============

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

const TVA_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 9, label: '9%' },
  { value: 19, label: '19%' },
];

const NIVEAU_RELANCE_OPTIONS = [
  { value: 1, label: 'Niveau 1 - Rappel amical', description: 'Premier rappel courtois' },
  { value: 2, label: 'Niveau 2 - Relance ferme', description: 'Deuxième rappel plus insistant' },
  { value: 3, label: 'Niveau 3 - Mise en demeure', description: 'Dernier avertissement avant action' },
];

// ============ HELPERS ============

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

function formatMontant(montant: number | undefined | null): string {
  if (montant === undefined || montant === null) return '-';
  return new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(montant) + ' DA';
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
    EN_PREPARATION: { label: 'En préparation', variant: 'warning' },
    EXPEDIEE: { label: 'Expédiée', variant: 'warning' },
    LIVREE: { label: 'Livrée', variant: 'success' },
    EN_RETARD: { label: 'En retard', variant: 'destructive' },
    PARTIELLEMENT_PAYEE: { label: 'Partiellement payée', variant: 'warning' },
    PAYEE: { label: 'Payée', variant: 'success' },
    ENVOYEE: { label: 'Envoyée', variant: 'default' },
    CONFIRMEE: { label: 'Confirmée', variant: 'success' },
    EN_RECEPTION: { label: 'En réception', variant: 'warning' },
    RECUE: { label: 'Reçue', variant: 'success' },
  };
  const badge = map[status] || { label: status, variant: 'secondary' };
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
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

// ============ LIGNES FORM COMPONENT ============

function LignesForm({
  lignes,
  setForm,
  produitsList,
}: {
  lignes: CreateDevisInput['lignes'];
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
                      prixUnitaireHT: produit?.prixVenteHT || next.lignes[index].prixUnitaireHT,
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
                      {p.nom} {p.prixVenteHT ? `- ${formatMontant(p.prixVenteHT)}` : ''}
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

// ============ DOCUMENT DETAIL SHEET ============

function DocumentDetailSheet({
  open,
  onOpenChange,
  type,
  document,
  onConvert,
  onDownloadPdf,
  canManage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'devis' | 'commande' | 'facture' | 'commandeFournisseur';
  document: any;
  onConvert?: () => void;
  onDownloadPdf: () => void;
  canManage: boolean;
}) {
  if (!document) return null;

  const typeLabels = {
    devis: 'Devis',
    commande: 'Commande',
    facture: document.type === 'AVOIR' ? 'Avoir' : 'Facture',
    commandeFournisseur: 'Commande fournisseur',
  };

  const typeIcons = {
    devis: FileText,
    commande: ShoppingCart,
    facture: Receipt,
    commandeFournisseur: Truck,
  };

  const Icon = typeIcons[type];
  const client = type === 'commandeFournisseur' ? document.fournisseur : document.client;
  const lignes = document.lignes || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {typeLabels[type]} {document.ref}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Statut et actions */}
          <div className="flex items-center justify-between">
            {statusBadge(document.statut)}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onDownloadPdf}>
                <FileDown className="h-4 w-4 mr-2" />
                Télécharger PDF
              </Button>
              {canManage && onConvert && (
                <Button size="sm" onClick={onConvert}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Convertir
                </Button>
              )}
            </div>
          </div>

          {/* Informations client/fournisseur */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm text-gray-700">
              {type === 'commandeFournisseur' ? 'Fournisseur' : 'Client'}
            </h3>
            {client && (
              <>
                <p className="font-medium">{client.nomEntreprise}</p>
                {client.siegeAdresse && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    {client.siegeAdresse}, {client.siegeVille}
                  </p>
                )}
                {client.siegeTel && (
                  <a href={`tel:${client.siegeTel}`} className="text-sm text-primary flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    {client.siegeTel}
                  </a>
                )}
                {client.siegeEmail && (
                  <a href={`mailto:${client.siegeEmail}`} className="text-sm text-primary flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    {client.siegeEmail}
                  </a>
                )}
              </>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Date du document</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDate(document.dateDevis || document.dateCommande || document.dateFacture)}
              </p>
            </div>
            {(document.dateValidite || document.dateEcheance || document.dateLivraisonSouhaitee) && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  {type === 'devis' ? 'Validité' : type === 'facture' ? 'Échéance' : 'Livraison souhaitée'}
                </p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(document.dateValidite || document.dateEcheance || document.dateLivraisonSouhaitee)}
                </p>
              </div>
            )}
          </div>

          {/* Lignes */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">Détail des lignes</h3>
            {lignes.length > 0 ? (
              <div className="space-y-2">
                {lignes.map((ligne: any, index: number) => (
                  <div key={index} className="p-3 bg-white border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{ligne.libelle || ligne.produitService?.nom || 'Ligne sans libellé'}</p>
                        {ligne.description && (
                          <p className="text-sm text-muted-foreground">{ligne.description}</p>
                        )}
                      </div>
                      <p className="font-medium text-right">
                        {formatMontant(ligne.totalHT || (ligne.quantite * ligne.prixUnitaireHT))}
                      </p>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Quantité: {ligne.quantite} {ligne.unite}</span>
                      <span>Prix unitaire: {formatMontant(ligne.prixUnitaireHT)}</span>
                      <span>TVA: {ligne.tauxTVA}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune ligne</p>
            )}
          </div>

          {/* Totaux */}
          <TotalsDisplay
            totals={{
              totalHT: document.totalHT || 0,
              totalTVA: document.totalTVA || 0,
              totalTTC: document.totalTTC || 0,
            }}
          />

          {/* Infos paiement (factures) */}
          {type === 'facture' && (
            <div className="p-4 bg-blue-50 rounded-lg space-y-2">
              <h3 className="font-semibold text-sm text-blue-700">Paiement</h3>
              <div className="flex justify-between">
                <span className="text-sm">Montant payé</span>
                <span className="font-medium">{formatMontant(document.totalPaye)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Reste à payer</span>
                <span className="font-bold text-blue-700">
                  {formatMontant((document.totalTTC || 0) - (document.totalPaye || 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============ RELANCE DIALOG ============

function RelanceDialog({
  open,
  onOpenChange,
  facture,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facture: any;
  onSubmit: (data: { canal: string; commentaire?: string; niveau: number }) => void;
  isPending: boolean;
}) {
  const [canal, setCanal] = useState<'EMAIL' | 'SMS' | 'COURRIER' | 'APPEL'>('EMAIL');
  const [niveau, setNiveau] = useState(1);
  const [commentaire, setCommentaire] = useState('');

  const handleSubmit = () => {
    onSubmit({ canal, commentaire: commentaire || undefined, niveau });
  };

  const resteAPayer = (facture?.totalTTC || 0) - (facture?.totalPaye || 0);
  const isFullyPaid = resteAPayer <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Créer une relance
          </DialogTitle>
          <DialogDescription>
            Enregistrer une relance pour la facture {facture?.ref}
          </DialogDescription>
        </DialogHeader>

        {isFullyPaid ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-green-700 font-medium">Cette facture est entièrement payée</p>
            <p className="text-sm text-green-600 mt-1">Aucune relance nécessaire</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Rappel du montant */}
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-700">Montant restant dû</p>
              <p className="text-xl font-bold text-orange-700">{formatMontant(resteAPayer)}</p>
            </div>

            {/* Canal de relance */}
            <div className="space-y-2">
              <Label>Moyen de relance</Label>
              <Select value={canal} onValueChange={(v) => setCanal(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </span>
                  </SelectItem>
                  <SelectItem value="SMS">
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> SMS
                    </span>
                  </SelectItem>
                  <SelectItem value="APPEL">
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Appel téléphonique
                    </span>
                  </SelectItem>
                  <SelectItem value="COURRIER">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Courrier postal
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Niveau de relance */}
            <div className="space-y-2">
              <Label>Niveau de relance</Label>
              <div className="space-y-2">
                {NIVEAU_RELANCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNiveau(opt.value)}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left transition-all',
                      niveau === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <p className={cn('font-medium', niveau === opt.value && 'text-primary')}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Commentaire */}
            <div className="space-y-2">
              <Label>Commentaire (optionnel)</Label>
              <Textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Notes sur cette relance..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          {!isFullyPaid && (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? 'Enregistrement...' : 'Enregistrer la relance'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ MAIN COMPONENT ============

export function CommercePage() {
  const queryClient = useQueryClient();
  const { canDo } = useAuthStore();
  const canManage = canDo('manageCommerce');

  // Search states
  const [searchDevis, setSearchDevis] = useState('');
  const [searchCommandes, setSearchCommandes] = useState('');
  const [searchFactures, setSearchFactures] = useState('');
  const [searchCmdFournisseurs, setSearchCmdFournisseurs] = useState('');

  // Detail sheet state
  const [viewingDocument, setViewingDocument] = useState<{
    type: 'devis' | 'commande' | 'facture' | 'commandeFournisseur';
    document: any;
  } | null>(null);

  // Relance dialog state
  const [relanceFacture, setRelanceFacture] = useState<any>(null);

  // ============ QUERIES ============

  const { data: devisData, isLoading: devisLoading } = useQuery({
    queryKey: ['commerce', 'devis'],
    queryFn: () => commerceApi.listDevis({ limit: 100 }),
  });

  const { data: commandesData, isLoading: commandesLoading } = useQuery({
    queryKey: ['commerce', 'commandes'],
    queryFn: () => commerceApi.listCommandes({ limit: 100 }),
  });

  const { data: facturesData, isLoading: facturesLoading } = useQuery({
    queryKey: ['commerce', 'factures'],
    queryFn: () => commerceApi.listFactures({ limit: 100 }),
  });

  const { data: commandesFournisseursData, isLoading: commandesFournisseursLoading } = useQuery({
    queryKey: ['commerce', 'commandes-fournisseurs'],
    queryFn: () => commandesFournisseursApi.list({ limit: 100 }),
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

  // Filter clients and fournisseurs
  const tiers = tiersData?.tiers || [];
  const clients = tiers.filter((t) => t.typeTiers === 'CLIENT' || t.typeTiers === 'CLIENT_FOURNISSEUR');
  const fournisseurs = tiers.filter((t) => t.typeTiers === 'FOURNISSEUR' || t.typeTiers === 'CLIENT_FOURNISSEUR');
  const produits = produitsData?.produits || [];
  const produitsAchat = produitsAchatData?.produits || [];

  // Filter lists based on search
  const filteredDevis = useMemo(() => {
    const list = devisData?.devis || [];
    if (!searchDevis) return list;
    const search = searchDevis.toLowerCase();
    return list.filter((d) =>
      d.ref?.toLowerCase().includes(search) ||
      d.client?.nomEntreprise?.toLowerCase().includes(search)
    );
  }, [devisData?.devis, searchDevis]);

  const filteredCommandes = useMemo(() => {
    const list = commandesData?.commandes || [];
    if (!searchCommandes) return list;
    const search = searchCommandes.toLowerCase();
    return list.filter((c) =>
      c.ref?.toLowerCase().includes(search) ||
      c.client?.nomEntreprise?.toLowerCase().includes(search)
    );
  }, [commandesData?.commandes, searchCommandes]);

  const filteredFactures = useMemo(() => {
    const list = facturesData?.factures || [];
    if (!searchFactures) return list;
    const search = searchFactures.toLowerCase();
    return list.filter((f) =>
      f.ref?.toLowerCase().includes(search) ||
      f.client?.nomEntreprise?.toLowerCase().includes(search)
    );
  }, [facturesData?.factures, searchFactures]);

  const filteredCmdFournisseurs = useMemo(() => {
    const list = commandesFournisseursData?.commandes || [];
    if (!searchCmdFournisseurs) return list;
    const search = searchCmdFournisseurs.toLowerCase();
    return list.filter((cf) =>
      cf.ref?.toLowerCase().includes(search) ||
      cf.fournisseur?.nomEntreprise?.toLowerCase().includes(search)
    );
  }, [commandesFournisseursData?.commandes, searchCmdFournisseurs]);

  // ============ FORM STATES ============

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
  const [commandeFournisseurForm, setCommandeFournisseurForm] = useState<CreateCommandeFournisseurInput>({
    fournisseurId: '',
    lignes: [{ ...EMPTY_LINE }],
  });

  // Dialog states
  const [showDevisDialog, setShowDevisDialog] = useState(false);
  const [showCommandeDialog, setShowCommandeDialog] = useState(false);
  const [showFactureDialog, setShowFactureDialog] = useState(false);
  const [showCmdFournisseurDialog, setShowCmdFournisseurDialog] = useState(false);

  const totalsDevis = useMemo(() => computeTotals(devisForm.lignes), [devisForm.lignes]);
  const totalsCommande = useMemo(() => computeTotals(commandeForm.lignes), [commandeForm.lignes]);
  const factureSign = factureForm.type === 'AVOIR' ? -1 : 1;
  const totalsFacture = useMemo(() => computeTotals(factureForm.lignes, factureSign), [factureForm.lignes, factureSign]);
  const totalsCommandeFournisseur = useMemo(() => computeTotals(commandeFournisseurForm.lignes), [commandeFournisseurForm.lignes]);

  // ============ MUTATIONS ============

  const createDevisMutation = useMutation({
    mutationFn: (payload: CreateDevisInput) => commerceApi.createDevis(payload),
    onSuccess: (data) => {
      toast.success('Devis créé avec succès', {
        description: `Référence: ${data.ref || 'N/A'}`,
        action: {
          label: 'Voir',
          onClick: () => setViewingDocument({ type: 'devis', document: data }),
        },
      });
      queryClient.invalidateQueries({ queryKey: ['commerce', 'devis'] });
      setDevisForm({ clientId: '', lignes: [{ ...EMPTY_LINE }] });
      setShowDevisDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création du devis');
    },
  });

  const createCommandeMutation = useMutation({
    mutationFn: (payload: CreateCommandeInput) => commerceApi.createCommande(payload),
    onSuccess: (data) => {
      toast.success('Commande créée avec succès', {
        description: `Référence: ${data.ref || 'N/A'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes'] });
      setCommandeForm({ clientId: '', lignes: [{ ...EMPTY_LINE }] });
      setShowCommandeDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création de la commande');
    },
  });

  const createFactureMutation = useMutation({
    mutationFn: (payload: CreateFactureInput) => commerceApi.createFacture(payload),
    onSuccess: (data) => {
      toast.success('Facture créée avec succès', {
        description: `Référence: ${data.ref || 'N/A'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['commerce', 'factures'] });
      setFactureForm({ clientId: '', lignes: [{ ...EMPTY_LINE }], type: 'FACTURE' });
      setShowFactureDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création de la facture');
    },
  });

  const convertirDevis = useMutation({
    mutationFn: (id: string) => commerceApi.convertirDevisCommande(id),
    onSuccess: () => {
      toast.success('Devis converti en commande');
      queryClient.invalidateQueries({ queryKey: ['commerce'] });
      setViewingDocument(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la conversion');
    },
  });

  const convertirCommande = useMutation({
    mutationFn: (id: string) => commerceApi.convertirCommandeFacture(id),
    onSuccess: () => {
      toast.success('Commande convertie en facture');
      queryClient.invalidateQueries({ queryKey: ['commerce'] });
      setViewingDocument(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la conversion');
    },
  });

  const createRelanceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { canal: string; commentaire?: string; niveau: number } }) =>
      commerceApi.createRelance(id, payload),
    onSuccess: () => {
      toast.success('Relance enregistrée');
      setRelanceFacture(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la relance');
    },
  });

  const createCommandeFournisseurMutation = useMutation({
    mutationFn: (payload: CreateCommandeFournisseurInput) => commandesFournisseursApi.create(payload),
    onSuccess: (data) => {
      toast.success('Commande fournisseur créée', {
        description: `Référence: ${data.ref || 'N/A'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes-fournisseurs'] });
      setCommandeFournisseurForm({ fournisseurId: '', lignes: [{ ...EMPTY_LINE }] });
      setShowCmdFournisseurDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création');
    },
  });

  // ============ RENDER ============

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commerce</h1>
          <p className="text-muted-foreground">Gestion des devis, commandes et factures</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Devis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{devisData?.devis?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Commandes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{commandesData?.commandes?.length || 0}</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Cmd Fournisseurs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{commandesFournisseursData?.commandes?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="devis">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="devis" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Devis</span>
          </TabsTrigger>
          <TabsTrigger value="commandes" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Commandes</span>
          </TabsTrigger>
          <TabsTrigger value="factures" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Factures</span>
          </TabsTrigger>
          <TabsTrigger value="fournisseurs" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Fournisseurs</span>
          </TabsTrigger>
        </TabsList>

        {/* DEVIS TAB */}
        <TabsContent value="devis">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Devis</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un devis..."
                      value={searchDevis}
                      onChange={(e) => setSearchDevis(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {canManage && (
                    <Button onClick={() => setShowDevisDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Nouveau devis</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {devisLoading ? (
                <p className="text-muted-foreground text-center py-8">Chargement...</p>
              ) : filteredDevis.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchDevis ? 'Aucun devis trouvé' : 'Aucun devis'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDevis.map((d) => (
                        <TableRow
                          key={d.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setViewingDocument({ type: 'devis', document: d })}
                        >
                          <TableCell className="font-medium">{d.ref}</TableCell>
                          <TableCell>{d.client?.nomEntreprise || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(d.dateDevis)}</TableCell>
                          <TableCell>{statusBadge(d.statut)}</TableCell>
                          <TableCell className="text-right font-medium">{formatMontant(d.totalTTC)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Tooltip content="Voir les détails">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewingDocument({ type: 'devis', document: d })}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Tooltip>
                              <Tooltip content="Télécharger PDF">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => commerceApi.downloadDevisPdf(d.id).catch(() => toast.error('Erreur téléchargement'))}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              </Tooltip>
                              {canManage && (
                                <Tooltip content="Convertir en commande">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => convertirDevis.mutate(d.id)}
                                  >
                                    <ArrowRightLeft className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
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

        {/* COMMANDES TAB */}
        <TabsContent value="commandes">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Commandes</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher une commande..."
                      value={searchCommandes}
                      onChange={(e) => setSearchCommandes(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {canManage && (
                    <Button onClick={() => setShowCommandeDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Nouvelle commande</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {commandesLoading ? (
                <p className="text-muted-foreground text-center py-8">Chargement...</p>
              ) : filteredCommandes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchCommandes ? 'Aucune commande trouvée' : 'Aucune commande'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCommandes.map((c) => (
                        <TableRow
                          key={c.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setViewingDocument({ type: 'commande', document: c })}
                        >
                          <TableCell className="font-medium">{c.ref}</TableCell>
                          <TableCell>{c.client?.nomEntreprise || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(c.dateCommande)}</TableCell>
                          <TableCell>{statusBadge(c.statut)}</TableCell>
                          <TableCell className="text-right font-medium">{formatMontant(c.totalTTC)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Tooltip content="Voir les détails">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewingDocument({ type: 'commande', document: c })}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Tooltip>
                              <Tooltip content="Télécharger PDF">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => commerceApi.downloadCommandePdf(c.id).catch(() => toast.error('Erreur téléchargement'))}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              </Tooltip>
                              {canManage && (
                                <Tooltip content="Convertir en facture">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => convertirCommande.mutate(c.id)}
                                  >
                                    <ArrowRightLeft className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
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

        {/* FACTURES TAB */}
        <TabsContent value="factures">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Factures</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher une facture..."
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
                  {searchFactures ? 'Aucune facture trouvée' : 'Aucune facture'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="hidden lg:table-cell">Type</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">Payé</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFactures.map((f) => (
                        <TableRow
                          key={f.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setViewingDocument({ type: 'facture', document: f })}
                        >
                          <TableCell className="font-medium">{f.ref}</TableCell>
                          <TableCell>{f.client?.nomEntreprise || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(f.dateFacture)}</TableCell>
                          <TableCell>{statusBadge(f.statut)}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {f.type === 'AVOIR' ? (
                              <Badge variant="secondary">Avoir</Badge>
                            ) : (
                              <Badge variant="default">Facture</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatMontant(f.totalTTC)}</TableCell>
                          <TableCell className="text-right hidden lg:table-cell">{formatMontant(f.totalPaye)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Tooltip content="Voir les détails">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewingDocument({ type: 'facture', document: f })}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Tooltip>
                              <Tooltip content="Télécharger PDF">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => commerceApi.downloadFacturePdf(f.id).catch(() => toast.error('Erreur téléchargement'))}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              </Tooltip>
                              {canManage && f.statut !== 'PAYEE' && (
                                <Tooltip content="Créer une relance">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setRelanceFacture(f)}
                                  >
                                    <Bell className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
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

        {/* COMMANDES FOURNISSEURS TAB */}
        <TabsContent value="fournisseurs">
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
                      {filteredCmdFournisseurs.map((cf) => (
                        <TableRow
                          key={cf.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setViewingDocument({ type: 'commandeFournisseur', document: cf })}
                        >
                          <TableCell className="font-medium">{cf.ref}</TableCell>
                          <TableCell>{cf.fournisseur?.nomEntreprise || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(cf.dateCommande)}</TableCell>
                          <TableCell>{statusBadge(cf.statut)}</TableCell>
                          <TableCell className="text-right font-medium">{formatMontant(cf.totalTTC)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Tooltip content="Voir les détails">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewingDocument({ type: 'commandeFournisseur', document: cf })}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Tooltip>
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
      </Tabs>

      {/* ============ DIALOGS ============ */}

      {/* Devis Dialog */}
      <Dialog open={showDevisDialog} onOpenChange={setShowDevisDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un devis</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer un nouveau devis client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client <span className="text-red-500">*</span></Label>
                <Select
                  value={devisForm.clientId}
                  onValueChange={(value) => setDevisForm({ ...devisForm, clientId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((t: Tiers) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nomEntreprise}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date de validité</Label>
                <Input
                  type="date"
                  value={devisForm.dateValidite || ''}
                  onChange={(e) => setDevisForm({ ...devisForm, dateValidite: e.target.value })}
                />
              </div>
            </div>

            <LignesForm lignes={devisForm.lignes} setForm={setDevisForm} produitsList={produits} />

            <TotalsDisplay totals={totalsDevis} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDevisDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createDevisMutation.mutate(devisForm)}
              disabled={!devisForm.clientId || devisForm.lignes.length === 0 || createDevisMutation.isPending}
            >
              {createDevisMutation.isPending ? 'Création...' : 'Créer le devis'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commande Dialog */}
      <Dialog open={showCommandeDialog} onOpenChange={setShowCommandeDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer une commande</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer une nouvelle commande client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client <span className="text-red-500">*</span></Label>
                <Select
                  value={commandeForm.clientId}
                  onValueChange={(value) => setCommandeForm({ ...commandeForm, clientId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((t: Tiers) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nomEntreprise}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date de livraison souhaitée</Label>
                <Input
                  type="date"
                  value={commandeForm.dateLivraisonSouhaitee || ''}
                  onChange={(e) => setCommandeForm({ ...commandeForm, dateLivraisonSouhaitee: e.target.value })}
                />
              </div>
            </div>

            <LignesForm lignes={commandeForm.lignes} setForm={setCommandeForm} produitsList={produits} />

            <TotalsDisplay totals={totalsCommande} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommandeDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createCommandeMutation.mutate(commandeForm)}
              disabled={!commandeForm.clientId || commandeForm.lignes.length === 0 || createCommandeMutation.isPending}
            >
              {createCommandeMutation.isPending ? 'Création...' : 'Créer la commande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Facture Dialog */}
      <Dialog open={showFactureDialog} onOpenChange={setShowFactureDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer une facture</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer une nouvelle facture client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Client <span className="text-red-500">*</span></Label>
                <Select
                  value={factureForm.clientId}
                  onValueChange={(value) => setFactureForm({ ...factureForm, clientId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((t: Tiers) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nomEntreprise}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type de document</Label>
                <Select
                  value={factureForm.type || 'FACTURE'}
                  onValueChange={(value) => setFactureForm({ ...factureForm, type: value as FactureType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FACTURE">Facture</SelectItem>
                    <SelectItem value="AVOIR">Avoir (remboursement)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date d'échéance</Label>
                <Input
                  type="date"
                  value={factureForm.dateEcheance || ''}
                  onChange={(e) => setFactureForm({ ...factureForm, dateEcheance: e.target.value })}
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
              onClick={() => createFactureMutation.mutate(factureForm)}
              disabled={!factureForm.clientId || factureForm.lignes.length === 0 || createFactureMutation.isPending}
            >
              {createFactureMutation.isPending ? 'Création...' : 'Créer la facture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commande Fournisseur Dialog */}
      <Dialog open={showCmdFournisseurDialog} onOpenChange={setShowCmdFournisseurDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer une commande fournisseur</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer une nouvelle commande auprès d'un fournisseur.
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

            <LignesForm lignes={commandeFournisseurForm.lignes} setForm={setCommandeFournisseurForm} produitsList={produitsAchat} />

            <TotalsDisplay totals={totalsCommandeFournisseur} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCmdFournisseurDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createCommandeFournisseurMutation.mutate(commandeFournisseurForm)}
              disabled={!commandeFournisseurForm.fournisseurId || commandeFournisseurForm.lignes.length === 0 || createCommandeFournisseurMutation.isPending}
            >
              {createCommandeFournisseurMutation.isPending ? 'Création...' : 'Créer la commande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Detail Sheet */}
      <DocumentDetailSheet
        open={!!viewingDocument}
        onOpenChange={(open) => !open && setViewingDocument(null)}
        type={viewingDocument?.type || 'devis'}
        document={viewingDocument?.document}
        canManage={canManage}
        onDownloadPdf={() => {
          if (!viewingDocument) return;
          const { type, document } = viewingDocument;
          const downloadFn = {
            devis: () => commerceApi.downloadDevisPdf(document.id),
            commande: () => commerceApi.downloadCommandePdf(document.id),
            facture: () => commerceApi.downloadFacturePdf(document.id),
            commandeFournisseur: () => commandesFournisseursApi.downloadPdf(document.id),
          };
          downloadFn[type]?.().catch(() => toast.error('Erreur téléchargement'));
        }}
        onConvert={
          viewingDocument?.type === 'devis'
            ? () => convertirDevis.mutate(viewingDocument.document.id)
            : viewingDocument?.type === 'commande'
            ? () => convertirCommande.mutate(viewingDocument.document.id)
            : undefined
        }
      />

      {/* Relance Dialog */}
      <RelanceDialog
        open={!!relanceFacture}
        onOpenChange={(open) => !open && setRelanceFacture(null)}
        facture={relanceFacture}
        onSubmit={(data) => {
          if (relanceFacture) {
            createRelanceMutation.mutate({ id: relanceFacture.id, payload: data });
          }
        }}
        isPending={createRelanceMutation.isPending}
      />
    </div>
  );
}

export default CommercePage;
