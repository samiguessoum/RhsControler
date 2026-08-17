import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  Receipt,
  ShoppingCart,
  ArrowRightLeft,
  FileDown,
  Search,
  Eye,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Trash2,
  Bell,
  CheckCircle2,
  Pencil,
  CreditCard,
  Banknote,
  Building2,
  Hash,
  User,
  Link,
  ClipboardList,
  Package,
  Timer,
  ArrowUpDown,
  AlertTriangle,
  RotateCcw,
  Truck,
  PackageCheck,
  XCircle,
  AlertCircle,
  Layers,
  SquareCheck,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Separator } from '@/components/ui/separator';
import { commerceApi, produitsServicesApi, tiersApi } from '@/services/api';
import type { CreateCommandeInput, CreateDevisInput, CreateFactureInput, ProduitService, Tiers, FactureType, BonLivraison, CreateBonLivraisonInput, BonLivraisonStatut } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import {
  EMPTY_LINE,
  TVA_OPTIONS,
  NIVEAU_RELANCE_OPTIONS,
  computeTotals,
  formatMontant,
  formatDate,
  statusBadge,
  STATUS_MAP,
} from '@/lib/commerce-utils';

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
  typeDocument,
  noteServiceDefaut,
}: {
  lignes: CreateDevisInput['lignes'];
  setForm: (updater: (prev: any) => any) => void;
  produitsList: ProduitService[];
  typeDocument?: 'PRODUIT' | 'SERVICE';
  noteServiceDefaut?: string | null;
}) {
  // Filtrer les produits/services selon le type de document
  const filteredProduits = typeDocument
    ? produitsList.filter((p) => p.type === typeDocument)
    : produitsList;

  const typeLabel = typeDocument === 'SERVICE' ? 'Service' : typeDocument === 'PRODUIT' ? 'Produit' : 'Produit / Service';

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700">Lignes du document</div>

      {lignes.map((ligne, index) => (
        <div key={index} className={cn(
          "p-4 rounded-lg border space-y-3",
          typeDocument === 'SERVICE' ? "bg-purple-50/30 border-purple-100" :
          typeDocument === 'PRODUIT' ? "bg-emerald-50/30 border-emerald-100" :
          "bg-gray-50"
        )}>
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
              <Label className="text-xs">{typeLabel}</Label>
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
                  const produit = filteredProduits.find((p) => p.id === value);
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
                  <SelectValue placeholder={`Choisir un ${typeLabel.toLowerCase()} ou saisie libre`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Saisie libre</SelectItem>
                  {filteredProduits.filter((p) => p.id && p.id !== '').map((p) => (
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
                placeholder="Nom de la prestation / produit"
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

          {/* Spécificités / Détails */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Spécificités <span className="italic">(optionnel - ex: zones traitées, détails techniques...)</span>
            </Label>
            <Textarea
              value={ligne.description || ''}
              placeholder="Détails supplémentaires, zones concernées, conditions particulières..."
              rows={2}
              className="text-sm resize-none"
              onChange={(e) => {
                const value = e.target.value;
                setForm((prev: any) => {
                  const next = { ...prev };
                  next.lignes[index] = { ...next.lignes[index], description: value };
                  return next;
                });
              }}
            />
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
            lignes: [...prev.lignes, {
              ...EMPTY_LINE,
              ordre: prev.lignes.length + 1,
              // Si SERVICE et noteServiceDefaut existe, pré-remplir la description
              description: typeDocument === 'SERVICE' && noteServiceDefaut ? noteServiceDefaut : undefined,
            }],
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
  onValidate,
  onDelete,
  onPayment,
  onDownloadPdf,
  onNavigateToDocument,
  canManage,
  canDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'devis' | 'commande' | 'facture';
  document: any;
  onConvert?: () => void;
  onValidate?: () => void;
  onDelete?: () => void;
  onPayment?: () => void;
  onDownloadPdf: () => void;
  onNavigateToDocument?: (docType: 'devis' | 'commande' | 'facture', docId: string) => void;
  canManage: boolean;
  canDelete?: boolean;
}) {
  if (!document) return null;

  const typeLabels = {
    devis: 'Devis',
    commande: 'Commande',
    facture: document.type === 'AVOIR' ? 'Avoir' : 'Facture',
  };

  const typeIcons = {
    devis: FileText,
    commande: ShoppingCart,
    facture: Receipt,
  };

  const Icon = typeIcons[type];
  const client = document.client;
  const lignes = document.lignes || [];

  // Calcul de la remise globale si applicable
  const hasRemiseGlobal = (document.remiseGlobalPct && document.remiseGlobalPct > 0) ||
                          (document.remiseGlobalMontant && document.remiseGlobalMontant > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[650px] sm:max-w-[650px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {typeLabels[type]} {document.ref}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Statut et actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {statusBadge(document.statut)}
              {type === 'facture' && document.type === 'AVOIR' && (
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                  Avoir
                </Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button variant="outline" size="sm" onClick={onDownloadPdf}>
                <FileDown className="h-4 w-4 mr-2" />
                PDF
              </Button>
              {canManage && onValidate && document.statut === 'BROUILLON' && (
                <Button size="sm" variant="secondary" className="text-green-700 bg-green-100 hover:bg-green-200" onClick={onValidate}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Valider
                </Button>
              )}
              {canManage && onPayment && type === 'facture' && document.statut !== 'BROUILLON' && document.statut !== 'PAYEE' && document.statut !== 'EN_ATTENTE_ENCAISSEMENT' && (
                <Button size="sm" variant="secondary" className="text-green-700 bg-green-100 hover:bg-green-200" onClick={onPayment}>
                  <Banknote className="h-4 w-4 mr-2" />
                  Paiement
                </Button>
              )}
              {canManage && onConvert && document.statut !== 'BROUILLON' && (
                <Button size="sm" onClick={onConvert}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Convertir
                </Button>
              )}
              {canManage && onDelete && canDelete && (
                <Button size="sm" variant="destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              )}
            </div>
          </div>

          {/* Documents liés (source) */}
          {(document.devis || document.devisId || document.commande || document.commandeId) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-semibold text-sm text-amber-800 mb-2 flex items-center gap-2">
                <Link className="h-4 w-4" />
                Documents liés
              </h3>
              <div className="flex flex-wrap gap-3 text-sm">
                {(document.devis || document.devisId) && (
                  <button
                    onClick={() => onNavigateToDocument?.('devis', document.devis?.id || document.devisId)}
                    className="flex items-center gap-2 bg-white px-3 py-2 rounded border hover:bg-amber-100 hover:border-amber-400 transition-colors cursor-pointer group"
                  >
                    <FileText className="h-4 w-4 text-amber-600" />
                    <span className="text-muted-foreground">Devis source:</span>
                    <span className="font-medium text-amber-700 group-hover:underline">
                      {document.devis?.ref || document.devisId}
                    </span>
                    <Eye className="h-3 w-3 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                {(document.commande || document.commandeId) && (
                  <button
                    onClick={() => onNavigateToDocument?.('commande', document.commande?.id || document.commandeId)}
                    className="flex items-center gap-2 bg-white px-3 py-2 rounded border hover:bg-amber-100 hover:border-amber-400 transition-colors cursor-pointer group"
                  >
                    <ShoppingCart className="h-4 w-4 text-amber-600" />
                    <span className="text-muted-foreground">Commande source:</span>
                    <span className="font-medium text-amber-700 group-hover:underline">
                      {document.commande?.ref || document.commandeId}
                    </span>
                    <Eye className="h-3 w-3 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Réf BC Client (pour commandes validées) */}
          {type === 'commande' && document.refBonCommandeClient && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-green-700" />
                <span className="text-sm text-green-800 font-medium">N° Bon de Commande Client:</span>
                <span className="font-bold text-green-900">{document.refBonCommandeClient}</span>
              </div>
            </div>
          )}

          {/* Informations client */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Client
            </h3>
            {client && (
              <>
                <p className="font-medium">{client.nomEntreprise}</p>
                {client.siegeNIF && (
                  <p className="text-sm text-muted-foreground">NIF: {client.siegeNIF}</p>
                )}
                {client.siegeNIS && (
                  <p className="text-sm text-muted-foreground">NIS: {client.siegeNIS}</p>
                )}
                {client.siegeRC && (
                  <p className="text-sm text-muted-foreground">RC: {client.siegeRC}</p>
                )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Date du document</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDate(document.dateDevis || document.dateCommande || document.dateFacture)}
              </p>
            </div>
            {type === 'devis' && document.dateValidite && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Validité</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(document.dateValidite)}
                </p>
              </div>
            )}
            {type === 'commande' && document.dateLivraisonSouhaitee && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Livraison souhaitée</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(document.dateLivraisonSouhaitee)}
                </p>
              </div>
            )}
            {type === 'facture' && document.dateEcheance && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Échéance</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDate(document.dateEcheance)}
                  {document.delaiPaiementJours && (
                    <span className="text-xs text-muted-foreground">({document.delaiPaiementJours} jours)</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Créé par / modifié par */}
          {(document.createdBy || document.createdAt) && (
            <div className="p-3 bg-gray-50 rounded-lg grid grid-cols-2 gap-4">
              {document.createdBy && (
                <div>
                  <p className="text-xs text-muted-foreground">Créé par</p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <User className="h-3 w-3" />
                    {document.createdBy.prenom} {document.createdBy.nom}
                  </p>
                  {document.createdAt && (
                    <p className="text-xs text-muted-foreground">{formatDate(document.createdAt)}</p>
                  )}
                </div>
              )}
              {document.updatedBy && (
                <div>
                  <p className="text-xs text-muted-foreground">Modifié par</p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <User className="h-3 w-3" />
                    {document.updatedBy.prenom} {document.updatedBy.nom}
                  </p>
                  {document.updatedAt && (
                    <p className="text-xs text-muted-foreground">{formatDate(document.updatedAt)}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Lignes */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Détail des lignes ({lignes.length})
            </h3>
            {lignes.length > 0 ? (
              <div className="space-y-2">
                {lignes.map((ligne: any, index: number) => (
                  <div key={index} className="p-3 bg-white border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{ligne.libelle || ligne.produitService?.nom || 'Ligne sans libellé'}</p>
                        {ligne.description && (
                          <p className="text-sm text-muted-foreground mt-1">{ligne.description}</p>
                        )}
                      </div>
                      <p className="font-medium text-right ml-4">
                        {formatMontant(ligne.totalHT || (ligne.quantite * ligne.prixUnitaireHT))}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Qté: {ligne.quantite} {ligne.unite || 'unité(s)'}</span>
                      <span>PU HT: {formatMontant(ligne.prixUnitaireHT)}</span>
                      <span>TVA: {ligne.tauxTVA}%</span>
                      {ligne.remisePct > 0 && (
                        <span className="text-orange-600">Remise: {ligne.remisePct}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune ligne</p>
            )}
          </div>

          {/* Remise globale */}
          {hasRemiseGlobal && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <h3 className="font-semibold text-sm text-orange-800 mb-2">Remise globale</h3>
              <div className="flex gap-6 text-sm">
                {document.remiseGlobalPct > 0 && (
                  <span>Pourcentage: <strong>{document.remiseGlobalPct}%</strong></span>
                )}
                {document.remiseGlobalMontant > 0 && (
                  <span>Montant: <strong>{formatMontant(document.remiseGlobalMontant)}</strong></span>
                )}
              </div>
            </div>
          )}

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
            <div className="p-4 bg-blue-50 rounded-lg space-y-3">
              <h3 className="font-semibold text-sm text-blue-700 flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Paiement
              </h3>
              {document.delaiPaiementJours && (
                <div className="flex justify-between text-sm">
                  <span>Délai de paiement</span>
                  <span className="font-medium">{document.delaiPaiementJours} jours</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm">Montant payé</span>
                <span className="font-medium">{formatMontant(document.totalPaye || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Reste à payer</span>
                <span className="font-bold text-blue-700">
                  {formatMontant((document.totalTTC || 0) - (document.totalPaye || 0))}
                </span>
              </div>
              {/* Liste des paiements */}
              {document.paiements && document.paiements.length > 0 && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs font-medium text-blue-700 mb-2">Historique des paiements</p>
                  <div className="space-y-2">
                    {document.paiements.map((paiement: any, index: number) => (
                      <div key={index} className="flex justify-between items-center bg-white p-2 rounded text-sm">
                        <div>
                          <span className="text-muted-foreground">{formatDate(paiement.datePaiement)}</span>
                          {paiement.modePaiement && (
                            <span className="ml-2 text-xs bg-blue-100 px-2 py-0.5 rounded">
                              {paiement.modePaiement.libelle}
                            </span>
                          )}
                          {paiement.reference && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              Réf: {paiement.reference}
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-green-700">+{formatMontant(paiement.montant)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes et conditions */}
          {(document.notes || document.conditions) && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              {document.notes && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{document.notes}</p>
                </div>
              )}
              {document.conditions && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-1">Conditions</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{document.conditions}</p>
                </div>
              )}
            </div>
          )}

          {/* Devise */}
          {document.devise && document.devise !== 'DZD' && (
            <div className="text-xs text-muted-foreground text-right">
              Devise: {document.devise}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============ DEVIS DETAIL DIALOG - STYLE PLANNING ============

function DevisDetailDialog({
  open,
  devis,
  onClose,
  onValidate,
  onConvert,
  onEdit,
  onDelete,
  onDownloadPdf,
  canManage,
  canDelete,
  isValidating,
  isConverting,
}: {
  open: boolean;
  devis: any;
  onClose: () => void;
  onValidate: () => void;
  onConvert: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownloadPdf: () => void;
  canManage: boolean;
  canDelete: boolean;
  isValidating: boolean;
  isConverting: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);

  if (!devis) return null;

  const client = devis.client;
  const lignes = devis.lignes || [];
  const isBrouillon = devis.statut === 'BROUILLON';
  const isValide = devis.statut === 'VALIDE';
  const isSigne = devis.statut === 'SIGNE';

  // Calcul validité
  const dateValidite = devis.dateValidite ? new Date(devis.dateValidite) : null;
  const today = new Date();
  const joursRestants = dateValidite ? Math.ceil((dateValidite.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isExpire = joursRestants !== null && joursRestants < 0;
  const isExpireBientot = joursRestants !== null && joursRestants >= 0 && joursRestants <= 7;

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'BROUILLON':
        return { label: 'Brouillon', className: 'bg-slate-100 text-slate-800' };
      case 'VALIDE':
        return { label: 'Validé', className: 'bg-blue-100 text-blue-800' };
      case 'SIGNE':
        return { label: 'Signé', className: 'bg-emerald-100 text-emerald-800' };
      case 'REFUSE':
        return { label: 'Refusé', className: 'bg-red-100 text-red-800' };
      case 'EXPIRE':
        return { label: 'Expiré', className: 'bg-orange-100 text-orange-800' };
      case 'ANNULE':
        return { label: 'Annulé', className: 'bg-red-100 text-red-800' };
      default:
        return { label: statut, className: 'bg-gray-100 text-gray-800' };
    }
  };

  const statutBadge = getStatutBadge(devis.statut);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Détail du devis
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status et Référence */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={statutBadge.className}>
                  {statutBadge.label}
                </Badge>
                {/* Badge type document */}
                {devis.typeDocument && (
                  <Badge className={devis.typeDocument === 'SERVICE'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-emerald-100 text-emerald-800'
                  }>
                    {devis.typeDocument === 'SERVICE' ? 'Services' : 'Produits'}
                  </Badge>
                )}
                <span className="font-semibold text-lg">{devis.ref}</span>
                {isBrouillon && (
                  <span className="text-xs text-slate-500 italic">(non comptabilisé)</span>
                )}
              </div>
              {dateValidite && (
                <Badge className={cn(
                  isExpire ? "bg-red-100 text-red-800" :
                  isExpireBientot ? "bg-orange-100 text-orange-800" :
                  "bg-gray-100 text-gray-800"
                )}>
                  <Timer className="h-3 w-3 mr-1" />
                  {isExpire ? 'Expiré' : `${joursRestants}j restants`}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Client Info */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Client
              </h4>
              <div className="pl-6 space-y-1 text-sm">
                <p className="font-medium">{client?.nomEntreprise || 'Client non défini'}</p>
                {client?.siegeAdresse && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {client.siegeAdresse}{client.siegeVille && `, ${client.siegeVille}`}
                  </p>
                )}
                {client?.siegeTel && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${client.siegeTel}`} className="hover:underline">{client.siegeTel}</a>
                  </p>
                )}
                {client?.siegeEmail && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <a href={`mailto:${client.siegeEmail}`} className="hover:underline">{client.siegeEmail}</a>
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Informations du devis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="min-w-0">
                <span className="text-muted-foreground">Date du devis:</span>
                <p className="font-medium">{formatDate(devis.dateDevis)}</p>
              </div>
              {dateValidite && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Validité:</span>
                  <p className={cn(
                    "font-medium",
                    isExpire && "text-red-600",
                    isExpireBientot && "text-orange-600"
                  )}>
                    {formatDate(devis.dateValidite)}
                  </p>
                </div>
              )}
              {devis.site && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Site:</span>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {devis.site.nom}
                    {devis.site.ville && <span className="text-muted-foreground">({devis.site.ville})</span>}
                  </p>
                </div>
              )}
              {devis.createdBy && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Créé par:</span>
                  <p className="font-medium">{devis.createdBy.prenom} {devis.createdBy.nom}</p>
                </div>
              )}
              {(devis.remiseGlobalPct > 0 || devis.remiseGlobalMontant > 0) && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Remise globale:</span>
                  <p className="font-medium text-orange-600">
                    {devis.remiseGlobalPct > 0 && `${devis.remiseGlobalPct}%`}
                    {devis.remiseGlobalPct > 0 && devis.remiseGlobalMontant > 0 && ' + '}
                    {devis.remiseGlobalMontant > 0 && formatMontant(devis.remiseGlobalMontant)}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Articles - Tableau ERP classique */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Articles
                <Badge variant="secondary" className="ml-2">{lignes.length}</Badge>
              </h4>

              {lignes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-md">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucun article dans ce devis</p>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Désignation</TableHead>
                        <TableHead className="w-20 text-right">Qté</TableHead>
                        <TableHead className="w-24 text-right">P.U. HT</TableHead>
                        <TableHead className="w-20 text-right">Remise</TableHead>
                        <TableHead className="w-16 text-right">TVA</TableHead>
                        <TableHead className="w-28 text-right">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lignes.map((ligne: any, index: number) => {
                        const ligneTotal = ligne.totalHT || (ligne.quantite * ligne.prixUnitaireHT * (1 - (ligne.remisePct || 0) / 100));
                        const isService = ligne.produitService?.type === 'SERVICE';
                        const isProduit = ligne.produitService?.type === 'PRODUIT';

                        return (
                          <TableRow key={index} className="hover:bg-gray-50/50">
                            <TableCell className="text-center text-muted-foreground font-mono text-xs">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isService && <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />}
                                {isProduit && <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />}
                                {!isService && !isProduit && <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />}
                                <div className="min-w-0">
                                  <p className="font-medium">
                                    {ligne.libelle || ligne.produitService?.nom || 'Article sans nom'}
                                  </p>
                                  {ligne.description && (
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ligne.description}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium align-top">
                              {ligne.quantite}
                              {ligne.unite && <span className="text-xs text-muted-foreground ml-1">{ligne.unite}</span>}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap align-top">{formatMontant(ligne.prixUnitaireHT)}</TableCell>
                            <TableCell className="text-right align-top">
                              {ligne.remisePct > 0 ? (
                                <span className="text-orange-600 font-medium">-{ligne.remisePct}%</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground align-top">{ligne.tauxTVA}%</TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap align-top">{formatMontant(ligneTotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totaux - Style formulaire création */}
              {lignes.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Hors Taxes</span>
                    <span className="font-medium">{formatMontant(devis.totalHT)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA</span>
                    <span className="font-medium">{formatMontant(devis.totalTVA)}</span>
                  </div>
                  <div className="flex justify-between text-lg pt-2">
                    <span className="font-semibold text-emerald-600">Total TTC</span>
                    <span className="font-bold text-emerald-600">{formatMontant(devis.totalTTC)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {devis.notes && (
              <>
                <Separator />
                <div className="rounded-md border border-amber-200 bg-amber-50">
                  <div className="px-3 py-2 border-b border-amber-200 bg-amber-100/50">
                    <span className="text-sm font-medium text-amber-800 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Notes
                    </span>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">{devis.notes}</p>
                  </div>
                </div>
              </>
            )}

            {/* Conditions */}
            {devis.conditions && (
              <div className="rounded-md border border-blue-200 bg-blue-50">
                <div className="px-3 py-2 border-b border-blue-200 bg-blue-100/50">
                  <span className="text-sm font-medium text-blue-800 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Conditions
                  </span>
                </div>
                <div className="px-3 py-2">
                  <p className="text-sm text-blue-900 whitespace-pre-wrap">{devis.conditions}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <DialogFooter className="gap-2 flex-wrap">
              {/* Actions de modification/suppression à gauche */}
              <div className="flex items-center gap-2 mr-auto">
                {canManage && canDelete && (
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                )}
                {canManage && isBrouillon && (
                  <Button
                    variant="outline"
                    onClick={onEdit}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                )}
              </div>

              {/* Actions principales à droite */}
              <Button
                variant="outline"
                onClick={onDownloadPdf}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Devis
              </Button>

              {canManage && isBrouillon && (
                <Button
                  onClick={() => setShowValidateConfirm(true)}
                  disabled={isValidating}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isValidating ? 'Validation...' : 'Valider'}
                </Button>
              )}

              {canManage && (isValide || isSigne) && (
                <Button
                  onClick={() => setShowConvertConfirm(true)}
                  disabled={isConverting}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  {isConverting ? 'Conversion...' : 'Convertir en commande'}
                </Button>
              )}

              <Button variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de validation */}
      <AlertDialog open={showValidateConfirm} onOpenChange={setShowValidateConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              Valider le devis ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Vous allez valider ce devis. Une fois validé, il ne pourra plus être modifié.</p>

                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Devis</span>
                    <span className="font-medium text-foreground">{devis.ref}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium text-foreground">{client?.nomEntreprise || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Articles</span>
                    <span className="font-medium text-foreground">{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total TTC</span>
                    <span className="font-bold text-emerald-600">{formatMontant(devis.totalTTC)}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setShowValidateConfirm(false);
                onValidate();
              }}
            >
              Valider le devis
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Supprimer le devis ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le devis <strong>{devis.ref}</strong> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete();
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmation de conversion en commande */}
      <AlertDialog open={showConvertConfirm} onOpenChange={setShowConvertConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              Convertir en commande ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Vous allez convertir ce devis en commande client.</p>

                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Devis</span>
                    <span className="font-medium text-foreground">{devis.ref}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium text-foreground">{client?.nomEntreprise || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Articles</span>
                    <span className="font-medium text-foreground">{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total TTC</span>
                    <span className="font-bold text-emerald-600">{formatMontant(devis.totalTTC)}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConvertConfirm(false);
                onConvert();
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Confirmer la conversion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============ COMMANDE DETAIL DIALOG ============

function CommandeDetailDialog({
  open,
  commande,
  onClose,
  onValidate,
  onConvert,
  onEdit,
  onDelete,
  onDownloadPdf,
  canManage,
  canDelete,
  isValidating,
  isConverting,
  onCreateBL,
}: {
  open: boolean;
  commande: any;
  onClose: () => void;
  onValidate: () => void;
  onConvert: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownloadPdf: () => void;
  canManage: boolean;
  canDelete: boolean;
  isValidating: boolean;
  isConverting: boolean;
  onCreateBL?: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);

  if (!commande) return null;

  const client = commande.client;
  const lignes = commande.lignes || [];
  const isBrouillon = commande.statut === 'BROUILLON';
  const isValidee = commande.statut === 'VALIDEE';

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'BROUILLON':
        return { label: 'Brouillon', className: 'bg-slate-100 text-slate-800' };
      case 'VALIDEE':
        return { label: 'Validée', className: 'bg-green-100 text-green-800' };
      case 'EN_COURS':
        return { label: 'En cours', className: 'bg-amber-100 text-amber-800' };
      case 'LIVREE':
        return { label: 'Livrée', className: 'bg-emerald-100 text-emerald-800' };
      case 'ANNULEE':
        return { label: 'Annulée', className: 'bg-red-100 text-red-800' };
      default:
        return { label: statut, className: 'bg-gray-100 text-gray-800' };
    }
  };

  const statutBadge = getStatutBadge(commande.statut);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Détail de la commande
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status et Référence */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={statutBadge.className}>
                  {statutBadge.label}
                </Badge>
                {/* Badge type document */}
                {commande.typeDocument && (
                  <Badge className={commande.typeDocument === 'SERVICE'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-emerald-100 text-emerald-800'
                  }>
                    {commande.typeDocument === 'SERVICE' ? 'Services' : 'Produits'}
                  </Badge>
                )}
                <span className="font-semibold text-lg">{commande.ref}</span>
                {isBrouillon && (
                  <span className="text-xs text-slate-500 italic">(non comptabilisé)</span>
                )}
              </div>
              {commande.refBonCommandeClient && (
                <Badge variant="outline" className="text-sm">
                  BC: {commande.refBonCommandeClient}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Client Info */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Client
              </h4>
              <div className="pl-6 space-y-1 text-sm">
                <p className="font-medium">{client?.nomEntreprise || 'Client non défini'}</p>
                {client?.siegeAdresse && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {client.siegeAdresse}{client.siegeVille && `, ${client.siegeVille}`}
                  </p>
                )}
                {client?.siegeTel && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${client.siegeTel}`} className="hover:underline">{client.siegeTel}</a>
                  </p>
                )}
                {client?.siegeEmail && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <a href={`mailto:${client.siegeEmail}`} className="hover:underline">{client.siegeEmail}</a>
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Informations de la commande */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="min-w-0">
                <span className="text-muted-foreground">Date de commande:</span>
                <p className="font-medium">{formatDate(commande.dateCommande)}</p>
              </div>
              {commande.dateLivraisonSouhaitee && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Livraison souhaitée:</span>
                  <p className="font-medium">{formatDate(commande.dateLivraisonSouhaitee)}</p>
                </div>
              )}
              {commande.site && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Site:</span>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {commande.site.nom}
                    {commande.site.ville && <span className="text-muted-foreground">({commande.site.ville})</span>}
                  </p>
                </div>
              )}
              {commande.devis && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Devis source:</span>
                  <p className="font-medium flex items-center gap-1">
                    <Link className="h-3 w-3 text-muted-foreground" />
                    {commande.devis.ref}
                  </p>
                </div>
              )}
              {commande.createdBy && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Créé par:</span>
                  <p className="font-medium">{commande.createdBy.prenom} {commande.createdBy.nom}</p>
                </div>
              )}
              {(commande.remiseGlobalPct > 0 || commande.remiseGlobalMontant > 0) && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Remise globale:</span>
                  <p className="font-medium text-orange-600">
                    {commande.remiseGlobalPct > 0 && `${commande.remiseGlobalPct}%`}
                    {commande.remiseGlobalPct > 0 && commande.remiseGlobalMontant > 0 && ' + '}
                    {commande.remiseGlobalMontant > 0 && formatMontant(commande.remiseGlobalMontant)}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Articles - Tableau ERP classique */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Articles
                <Badge variant="secondary" className="ml-2">{lignes.length}</Badge>
              </h4>

              {lignes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-md">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucun article dans cette commande</p>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Désignation</TableHead>
                        <TableHead className="w-20 text-right">Qté</TableHead>
                        <TableHead className="w-24 text-right">P.U. HT</TableHead>
                        <TableHead className="w-20 text-right">Remise</TableHead>
                        <TableHead className="w-16 text-right">TVA</TableHead>
                        <TableHead className="w-28 text-right">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lignes.map((ligne: any, index: number) => {
                        const ligneTotal = ligne.totalHT || (ligne.quantite * ligne.prixUnitaireHT * (1 - (ligne.remisePct || 0) / 100));
                        const isService = ligne.produitService?.type === 'SERVICE';
                        const isProduit = ligne.produitService?.type === 'PRODUIT';

                        return (
                          <TableRow key={index} className="hover:bg-gray-50/50">
                            <TableCell className="text-center text-muted-foreground font-mono text-xs">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isService && <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />}
                                {isProduit && <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />}
                                {!isService && !isProduit && <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />}
                                <div className="min-w-0">
                                  <p className="font-medium">
                                    {ligne.libelle || ligne.produitService?.nom || 'Article sans nom'}
                                  </p>
                                  {ligne.description && (
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ligne.description}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium align-top">
                              {ligne.quantite}
                              {ligne.unite && <span className="text-xs text-muted-foreground ml-1">{ligne.unite}</span>}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap align-top">{formatMontant(ligne.prixUnitaireHT)}</TableCell>
                            <TableCell className="text-right align-top">
                              {ligne.remisePct > 0 ? (
                                <span className="text-orange-600 font-medium">-{ligne.remisePct}%</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground align-top">{ligne.tauxTVA}%</TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap align-top">{formatMontant(ligneTotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totaux */}
              {lignes.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Hors Taxes</span>
                    <span className="font-medium">{formatMontant(commande.totalHT)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA</span>
                    <span className="font-medium">{formatMontant(commande.totalTVA)}</span>
                  </div>
                  <div className="flex justify-between text-lg pt-2">
                    <span className="font-semibold text-green-700">Total TTC</span>
                    <span className="font-bold text-green-700">{formatMontant(commande.totalTTC)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Livraisons */}
            {commande.bonsLivraison && commande.bonsLivraison.length > 0 && (() => {
              type BLItem = NonNullable<typeof commande.bonsLivraison>[0];
              type BLLigne = NonNullable<BLItem['lignes']>[0];
              const bls = commande.bonsLivraison!;
              // Utilise les lignes de la commande pour le total réel (évite le double-compte si plusieurs BLs)
              const totalCmd = (commande.lignes || []).reduce((s: number, l: any) => s + (l.quantite || 0), 0);
              const totalLivree = bls.reduce((s: number, bl: BLItem) => s + (bl.lignes || []).reduce((ss: number, l: BLLigne) => ss + l.quantiteLivree, 0), 0);
              const totalRestante = Math.max(0, totalCmd - totalLivree);
              const pct = totalCmd > 0 ? Math.round((totalLivree / totalCmd) * 100) : 0;
              // BLs triés chronologiquement pour calcul cumulatif
              const blsSorted = [...bls].sort((a: BLItem, b: BLItem) => new Date((a as any).dateBonLivraison || 0).getTime() - new Date((b as any).dateBonLivraison || 0).getTime());
              return (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4 text-teal-600" />
                      Livraisons
                      <Badge variant="secondary" className="ml-1">{bls.length}</Badge>
                    </h4>
                    {/* Progression globale */}
                    {totalCmd > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500">Total commandé : <span className="font-semibold text-gray-800">{totalCmd}</span></span>
                            <span className="text-teal-600">Livré : <span className="font-bold">{totalLivree}</span></span>
                            {totalRestante > 0 && <span className="text-orange-600">Restant : <span className="font-bold">{totalRestante}</span></span>}
                          </div>
                          <span className={`font-bold text-base ${pct >= 100 ? 'text-green-600' : 'text-teal-600'}`}>{pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-teal-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    )}
                    {/* Liste des BLs */}
                    <div className="space-y-2">
                      {blsSorted.map((bl: BLItem, blIdx: number) => {
                        const blLivree = (bl.lignes || []).reduce((s: number, l: BLLigne) => s + l.quantiteLivree, 0);
                        // Cumulatif = total livré par tous les BLs précédents + ce BL
                        const cumulLivree = blsSorted.slice(0, blIdx + 1).reduce((s: number, b: BLItem) => s + (b.lignes || []).reduce((ss: number, l: BLLigne) => ss + l.quantiteLivree, 0), 0);
                        const cumulPct = totalCmd > 0 ? Math.round((cumulLivree / totalCmd) * 100) : 0;
                        const blCfg: Record<string, { label: string; cls: string }> = {
                          BROUILLON: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-700' },
                          CONFIRME:  { label: 'Confirmé',  cls: 'bg-blue-100 text-blue-800' },
                          LIVRE:     { label: 'Livré',     cls: 'bg-green-100 text-green-800' },
                          ANNULE:    { label: 'Annulé',    cls: 'bg-red-100 text-red-700' },
                        };
                        const bc = blCfg[bl.statut] || blCfg['BROUILLON'];
                        return (
                          <div key={bl.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-gray-900">{bl.ref}</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bc.cls}`}>{bc.label}</span>
                              </div>
                              <div className="text-xs text-gray-400 flex items-center gap-3">
                                {(bl as any).dateBonLivraison && <span>Émis le {new Date((bl as any).dateBonLivraison).toLocaleDateString('fr-FR')}</span>}
                                {bl.dateLivraisonEffective && (
                                  <span className="text-green-600 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {new Date(bl.dateLivraisonEffective).toLocaleDateString('fr-FR')}
                                  </span>
                                )}
                              </div>
                            </div>
                            {totalCmd > 0 && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>Ce BL : <span className="font-semibold text-teal-700">{blLivree} unité{blLivree > 1 ? 's' : ''}</span></span>
                                  <span className={`font-semibold ${cumulPct >= 100 ? 'text-green-600' : 'text-teal-600'}`}>Cumulé : {cumulLivree}/{totalCmd} ({cumulPct}%)</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${cumulPct >= 100 ? 'bg-green-400' : 'bg-teal-400'}`} style={{ width: `${Math.min(cumulPct, 100)}%` }} />
                                </div>
                              </div>
                            )}
                            {(bl.lignes || []).length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {(bl.lignes || []).map((l: BLLigne, li: number) => {
                                  const reste = Math.max(0, (l.quantiteCommandee || 0) - l.quantiteLivree);
                                  return (
                                    <div key={li} className="flex items-center justify-between text-xs text-gray-600 py-0.5 border-t border-gray-50">
                                      <span className="text-gray-700 font-medium truncate max-w-[200px]">{l.libelle || `Ligne ${li + 1}`}</span>
                                      <div className="flex items-center gap-3 shrink-0 ml-2">
                                        <span className="text-teal-600 font-semibold">{l.quantiteLivree}{l.unite ? ` ${l.unite}` : ''}</span>
                                        {reste > 0 && <span className="text-orange-500">({reste} restant{reste > 1 ? 's' : ''})</span>}
                                        {reste === 0 && l.quantiteCommandee && <span className="text-green-500">✓</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Notes */}
            {commande.notes && (
              <>
                <Separator />
                <div className="rounded-md border border-amber-200 bg-amber-50">
                  <div className="px-3 py-2 border-b border-amber-200 bg-amber-100/50">
                    <span className="text-sm font-medium text-amber-800 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Notes
                    </span>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">{commande.notes}</p>
                  </div>
                </div>
              </>
            )}

            {/* Conditions */}
            {commande.conditions && (
              <div className="rounded-md border border-green-200 bg-green-50">
                <div className="px-3 py-2 border-b border-green-200 bg-green-100/50">
                  <span className="text-sm font-medium text-green-800 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Conditions
                  </span>
                </div>
                <div className="px-3 py-2">
                  <p className="text-sm text-green-900 whitespace-pre-wrap">{commande.conditions}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <DialogFooter className="gap-2 flex-wrap">
              {/* Actions de modification/suppression à gauche */}
              <div className="flex items-center gap-2 mr-auto">
                {canManage && canDelete && (
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                )}
                {canManage && isBrouillon && (
                  <Button
                    variant="outline"
                    onClick={onEdit}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                )}
              </div>

              {/* Actions principales à droite */}
              <Button
                variant="outline"
                onClick={onDownloadPdf}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Bon de commande
              </Button>

              {canManage && isBrouillon && (
                <Button
                  onClick={() => setShowValidateConfirm(true)}
                  disabled={isValidating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isValidating ? 'Validation...' : 'Valider'}
                </Button>
              )}

              {canManage && isValidee && (
                <Button
                  onClick={() => setShowConvertConfirm(true)}
                  disabled={isConverting}
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  {isConverting ? 'Conversion...' : 'Convertir en facture'}
                </Button>
              )}

              {canManage && onCreateBL && commande.statut !== 'BROUILLON' && commande.statut !== 'ANNULEE' && (
                <Button variant="outline" onClick={onCreateBL} className="border-green-300 text-green-700 hover:bg-green-50">
                  <Truck className="h-4 w-4 mr-2" />
                  Créer un BL
                </Button>
              )}

              <Button variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de validation */}
      <AlertDialog open={showValidateConfirm} onOpenChange={setShowValidateConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Valider la commande ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Vous allez valider cette commande. Une fois validée, elle ne pourra plus être modifiée.</p>

                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commande</span>
                    <span className="font-medium text-foreground">{commande.ref}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium text-foreground">{client?.nomEntreprise || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Articles</span>
                    <span className="font-medium text-foreground">{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total TTC</span>
                    <span className="font-bold text-green-700">{formatMontant(commande.totalTTC)}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                setShowValidateConfirm(false);
                onValidate();
              }}
            >
              Valider la commande
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Supprimer la commande ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la commande <strong>{commande.ref}</strong> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete();
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmation de conversion en facture */}
      <AlertDialog open={showConvertConfirm} onOpenChange={setShowConvertConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-700" />
              Convertir en facture ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Vous allez convertir cette commande en facture client.</p>

                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commande</span>
                    <span className="font-medium text-foreground">{commande.ref}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium text-foreground">{client?.nomEntreprise || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Articles</span>
                    <span className="font-medium text-foreground">{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total TTC</span>
                    <span className="font-bold text-green-700">{formatMontant(commande.totalTTC)}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                setShowConvertConfirm(false);
                onConvert();
              }}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Confirmer la conversion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  onSubmit: (data: { canal: 'EMAIL' | 'SMS' | 'COURRIER' | 'APPEL'; commentaire?: string; niveau: number }) => void;
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

// ============ FACTURE DETAIL DIALOG ============

function FactureDetailDialog({
  open,
  facture,
  onClose,
  onValidate,
  onEdit,
  onDelete,
  onDownloadPdf,
  onPayment,
  onRelance,
  onChequeAction,
  onCreateAvoir,
  canManage,
  canDelete,
  isValidating,
}: {
  open: boolean;
  facture: any;
  onClose: () => void;
  onValidate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownloadPdf: () => void;
  onPayment: () => void;
  onRelance: () => void;
  onChequeAction: (paiementId: string, newStatut: 'DEPOSE' | 'ENCAISSE' | 'REJETE', label: string) => void;
  onCreateAvoir: () => void;
  canManage: boolean;
  canDelete: boolean;
  isValidating: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);

  if (!facture) return null;

  const client = facture.client;
  const lignes = facture.lignes || [];
  const isBrouillon = facture.statut === 'BROUILLON';
  const isAvoir = facture.type === 'AVOIR';
  const totalEnAttente = facture.totalEnAttente || 0;
  const resteAPayer = (facture.totalTTC || 0) - (facture.totalPaye || 0) - totalEnAttente;
  const pctPaye = facture.totalTTC > 0 ? ((facture.totalPaye || 0) / facture.totalTTC) * 100 : 0;
  const pctEnAttente = facture.totalTTC > 0 ? (totalEnAttente / facture.totalTTC) * 100 : 0;

  // Échéance
  const dateEcheance = facture.dateEcheance ? new Date(facture.dateEcheance) : null;
  const today = new Date();
  const joursRestants = dateEcheance ? Math.ceil((dateEcheance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isEnRetard = joursRestants !== null && joursRestants < 0 && facture.statut !== 'PAYEE';
  const isEcheanceBientot = joursRestants !== null && joursRestants >= 0 && joursRestants <= 7 && facture.statut !== 'PAYEE';

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'BROUILLON':
        return { label: 'Brouillon', className: 'bg-slate-100 text-slate-800' };
      case 'VALIDEE':
        return { label: 'Validée', className: 'bg-blue-100 text-blue-800' };
      case 'EN_RETARD':
        return { label: 'En retard', className: 'bg-red-100 text-red-800' };
      case 'PARTIELLEMENT_PAYEE':
        return { label: 'Part. payée', className: 'bg-amber-100 text-amber-800' };
      case 'EN_ATTENTE_ENCAISSEMENT':
        return { label: 'En att. encaissement', className: 'bg-amber-100 text-amber-700 border border-amber-300' };
      case 'PAYEE':
        return { label: 'Payée', className: 'bg-emerald-100 text-emerald-800' };
      case 'ANNULEE':
        return { label: 'Annulée', className: 'bg-red-100 text-red-800' };
      default:
        return { label: statut, className: 'bg-gray-100 text-gray-800' };
    }
  };

  const statutBadge = getStatutBadge(facture.statut);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Détail de la {isAvoir ? 'note de crédit (avoir)' : 'facture'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status et Référence */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={statutBadge.className}>
                  {statutBadge.label}
                </Badge>
                {isAvoir && (
                  <Badge className="bg-purple-100 text-purple-800">
                    Avoir
                  </Badge>
                )}
                {facture.typeDocument && (
                  <Badge className={facture.typeDocument === 'SERVICE'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-emerald-100 text-emerald-800'
                  }>
                    {facture.typeDocument === 'SERVICE' ? 'Services' : 'Produits'}
                  </Badge>
                )}
                <span className="font-semibold text-lg">{facture.ref}</span>
                {isBrouillon ? (
                  <span className="text-xs text-slate-500 italic">(non comptabilisé)</span>
                ) : (
                  <span className="text-xs text-emerald-600 italic">(comptabilisée)</span>
                )}
              </div>
              {dateEcheance && facture.statut !== 'PAYEE' && (
                <Badge className={cn(
                  isEnRetard ? "bg-red-100 text-red-800" :
                  isEcheanceBientot ? "bg-orange-100 text-orange-800" :
                  "bg-gray-100 text-gray-800"
                )}>
                  <Timer className="h-3 w-3 mr-1" />
                  {isEnRetard ? `En retard (${Math.abs(joursRestants!)}j)` : `${joursRestants}j avant échéance`}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Documents liés */}
            {(facture.devis || facture.devisId || facture.commande || facture.commandeId) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-semibold text-sm text-amber-800 mb-2 flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Documents source
                </h4>
                <div className="flex flex-wrap gap-3 text-sm">
                  {(facture.devis || facture.devisId) && (
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded border">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <span className="text-muted-foreground">Devis:</span>
                      <span className="font-medium text-amber-700">
                        {facture.devis?.ref || facture.devisId}
                      </span>
                    </div>
                  )}
                  {(facture.commande || facture.commandeId) && (
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded border">
                      <ShoppingCart className="h-4 w-4 text-amber-600" />
                      <span className="text-muted-foreground">Commande:</span>
                      <span className="font-medium text-amber-700">
                        {facture.commande?.ref || facture.commandeId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Client Info */}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Client
              </h4>
              <div className="pl-6 space-y-1 text-sm">
                <p className="font-medium">{client?.nomEntreprise || 'Client non défini'}</p>
                {client?.siegeNIF && (
                  <p className="text-muted-foreground">NIF: {client.siegeNIF}</p>
                )}
                {client?.siegeNIS && (
                  <p className="text-muted-foreground">NIS: {client.siegeNIS}</p>
                )}
                {client?.siegeRC && (
                  <p className="text-muted-foreground">RC: {client.siegeRC}</p>
                )}
                {client?.siegeAdresse && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {client.siegeAdresse}{client.siegeVille && `, ${client.siegeVille}`}
                  </p>
                )}
                {client?.siegeTel && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${client.siegeTel}`} className="hover:underline">{client.siegeTel}</a>
                  </p>
                )}
                {client?.siegeEmail && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <a href={`mailto:${client.siegeEmail}`} className="hover:underline">{client.siegeEmail}</a>
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Informations de la facture */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="min-w-0">
                <span className="text-muted-foreground">Date de facture:</span>
                <p className="font-medium">{formatDate(facture.dateFacture)}</p>
              </div>
              {dateEcheance && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Date d'échéance:</span>
                  <p className={cn(
                    "font-medium",
                    isEnRetard && "text-red-600",
                    isEcheanceBientot && "text-orange-600"
                  )}>
                    {formatDate(facture.dateEcheance)}
                    {facture.delaiPaiementJours && (
                      <span className="text-xs text-muted-foreground ml-2">({facture.delaiPaiementJours} jours)</span>
                    )}
                  </p>
                </div>
              )}
              {facture.site && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Site:</span>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {facture.site.nom}
                    {facture.site.ville && <span className="text-muted-foreground">({facture.site.ville})</span>}
                  </p>
                </div>
              )}
              {facture.createdBy && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Créé par:</span>
                  <p className="font-medium">{facture.createdBy.prenom} {facture.createdBy.nom}</p>
                </div>
              )}
              {(facture.remiseGlobalPct > 0 || facture.remiseGlobalMontant > 0) && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">Remise globale:</span>
                  <p className="font-medium text-orange-600">
                    {facture.remiseGlobalPct > 0 && `${facture.remiseGlobalPct}%`}
                    {facture.remiseGlobalPct > 0 && facture.remiseGlobalMontant > 0 && ' + '}
                    {facture.remiseGlobalMontant > 0 && formatMontant(facture.remiseGlobalMontant)}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Paiement - spécifique facture */}
            {!isBrouillon && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <h4 className="font-semibold text-sm text-blue-700 flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Suivi de paiement
                </h4>
                <div className={cn("grid gap-4 text-sm", totalEnAttente > 0 ? "grid-cols-4" : "grid-cols-3")}>
                  <div>
                    <span className="text-muted-foreground">Total TTC</span>
                    <p className="font-bold text-lg">{formatMontant(facture.totalTTC)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Encaissé</span>
                    <p className="font-bold text-lg text-green-600">{formatMontant(facture.totalPaye || 0)}</p>
                  </div>
                  {totalEnAttente > 0 && (
                    <div>
                      <span className="text-muted-foreground">En attente bancaire</span>
                      <p className="font-bold text-lg text-amber-600">{formatMontant(totalEnAttente)}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Reste à payer</span>
                    <p className={cn("font-bold text-lg", resteAPayer > 0.01 ? "text-orange-600" : "text-green-600")}>
                      {formatMontant(Math.max(0, resteAPayer))}
                    </p>
                  </div>
                </div>
                {/* Barre de progression composite */}
                <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                  <div className="h-2 flex">
                    <div
                      className="bg-green-500 transition-all"
                      style={{ width: `${Math.min(pctPaye, 100)}%` }}
                    />
                    <div
                      className="bg-amber-400 transition-all"
                      style={{ width: `${Math.min(pctEnAttente, 100 - pctPaye)}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-600 text-right">
                  {Math.round(pctPaye)}% encaissé
                  {pctEnAttente > 0 && <span className="text-amber-600 ml-2">+ {Math.round(pctEnAttente)}% en attente</span>}
                </p>

                {/* Historique des paiements */}
                {facture.paiements && facture.paiements.length > 0 && (
                  <div className="mt-2 pt-3 border-t border-blue-200">
                    <p className="text-xs font-medium text-blue-700 mb-2">Historique des paiements</p>
                    <div className="space-y-2">
                      {facture.paiements.filter((p: any) => p.statut !== 'ANNULE').map((paiement: any, index: number) => {
                        const statutBadge: Record<string, { label: string; className: string }> = {
                          RECU:    { label: 'Chèque reçu',       className: 'bg-orange-100 text-orange-700 border-orange-200' },
                          DEPOSE:  { label: 'Déposé en banque',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
                          ENCAISSE:{ label: 'Encaissé',          className: 'bg-green-100 text-green-700 border-green-200' },
                          REJETE:  { label: 'Rejeté',            className: 'bg-red-100 text-red-700 border-red-200' },
                        };
                        const badge = statutBadge[paiement.statut];
                        const showChequeTracking = paiement.statut === 'RECU' || paiement.statut === 'DEPOSE';
                        return (
                          <div key={index} className="bg-white p-2 rounded text-sm border border-gray-100">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-muted-foreground">{formatDate(paiement.datePaiement)}</span>
                                {paiement.modePaiement && (
                                  <Badge variant="outline" className="text-xs">
                                    {paiement.modePaiement.libelle}
                                  </Badge>
                                )}
                                {badge && (
                                  <Badge className={cn("text-xs border", badge.className)}>
                                    {badge.label}
                                  </Badge>
                                )}
                                {paiement.reference && (
                                  <span className="text-xs text-muted-foreground">N°{paiement.reference}</span>
                                )}
                                {paiement.banque && (
                                  <span className="text-xs text-muted-foreground">{paiement.banque}</span>
                                )}
                              </div>
                              <span className={cn("font-medium ml-2", paiement.statut === 'REJETE' ? 'text-red-600 line-through' : 'text-green-700')}>
                                +{formatMontant(paiement.montant)}
                              </span>
                            </div>
                            {/* Dates de suivi */}
                            {(paiement.dateDepot || paiement.dateEncaissement) && (
                              <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                                {paiement.dateDepot && <span>Déposé le {formatDate(paiement.dateDepot)}</span>}
                                {paiement.dateEncaissement && <span>Encaissé le {formatDate(paiement.dateEncaissement)}</span>}
                              </div>
                            )}
                            {/* Boutons d'action chèque */}
                            {canManage && showChequeTracking && (
                              <div className="mt-2 flex gap-2">
                                {paiement.statut === 'RECU' && (
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                                    onClick={() => onChequeAction(paiement.id, 'DEPOSE', 'Date de dépôt en banque')}
                                  >
                                    Déposer en banque
                                  </Button>
                                )}
                                {paiement.statut === 'DEPOSE' && (
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                                    onClick={() => onChequeAction(paiement.id, 'ENCAISSE', 'Date d\'encaissement')}
                                  >
                                    Confirmer encaissement
                                  </Button>
                                )}
                                {(paiement.statut === 'RECU' || paiement.statut === 'DEPOSE') && (
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                    onClick={() => onChequeAction(paiement.id, 'REJETE', 'Chèque rejeté — date de rejet')}
                                  >
                                    Marquer rejeté
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Relances */}
                {facture.relances && facture.relances.length > 0 && (
                  <div className="mt-2 pt-3 border-t border-blue-200">
                    <p className="text-xs font-medium text-blue-700 mb-2">Relances envoyées</p>
                    <div className="space-y-1">
                      {facture.relances.map((relance: any, index: number) => (
                        <div key={index} className="flex justify-between items-center bg-white p-2 rounded text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Niveau {relance.niveau}
                            </Badge>
                            <span className="text-muted-foreground">{relance.canal}</span>
                            {relance.commentaire && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{relance.commentaire}</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(relance.dateRelance)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Articles - Tableau ERP classique */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Articles
                <Badge variant="secondary" className="ml-2">{lignes.length}</Badge>
              </h4>

              {lignes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-md">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucun article dans cette facture</p>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Désignation</TableHead>
                        <TableHead className="w-20 text-right">Qté</TableHead>
                        <TableHead className="w-24 text-right">P.U. HT</TableHead>
                        <TableHead className="w-20 text-right">Remise</TableHead>
                        <TableHead className="w-16 text-right">TVA</TableHead>
                        <TableHead className="w-28 text-right">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lignes.map((ligne: any, index: number) => {
                        const ligneTotal = ligne.totalHT || (ligne.quantite * ligne.prixUnitaireHT * (1 - (ligne.remisePct || 0) / 100));
                        const isService = ligne.produitService?.type === 'SERVICE';
                        const isProduit = ligne.produitService?.type === 'PRODUIT';

                        return (
                          <TableRow key={index} className="hover:bg-gray-50/50">
                            <TableCell className="text-center text-muted-foreground font-mono text-xs">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isService && <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />}
                                {isProduit && <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />}
                                {!isService && !isProduit && <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />}
                                <div className="min-w-0">
                                  <p className="font-medium">
                                    {ligne.libelle || ligne.produitService?.nom || 'Article sans nom'}
                                  </p>
                                  {ligne.description && (
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ligne.description}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium align-top">
                              {ligne.quantite}
                              {ligne.unite && <span className="text-xs text-muted-foreground ml-1">{ligne.unite}</span>}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap align-top">{formatMontant(ligne.prixUnitaireHT)}</TableCell>
                            <TableCell className="text-right align-top">
                              {ligne.remisePct > 0 ? (
                                <span className="text-orange-600 font-medium">-{ligne.remisePct}%</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground align-top">{ligne.tauxTVA}%</TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap align-top">{formatMontant(ligneTotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totaux */}
              {lignes.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Hors Taxes</span>
                    <span className="font-medium">{formatMontant(facture.totalHT)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA</span>
                    <span className="font-medium">{formatMontant(facture.totalTVA)}</span>
                  </div>
                  <div className="flex justify-between text-lg pt-2">
                    <span className="font-semibold text-blue-700">Total TTC</span>
                    <span className="font-bold text-blue-700">{formatMontant(facture.totalTTC)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {facture.notes && (
              <>
                <Separator />
                <div className="rounded-md border border-amber-200 bg-amber-50">
                  <div className="px-3 py-2 border-b border-amber-200 bg-amber-100/50">
                    <span className="text-sm font-medium text-amber-800 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Notes
                    </span>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">{facture.notes}</p>
                  </div>
                </div>
              </>
            )}

            {/* Conditions */}
            {facture.conditions && (
              <div className="rounded-md border border-blue-200 bg-blue-50">
                <div className="px-3 py-2 border-b border-blue-200 bg-blue-100/50">
                  <span className="text-sm font-medium text-blue-800 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Conditions
                  </span>
                </div>
                <div className="px-3 py-2">
                  <p className="text-sm text-blue-900 whitespace-pre-wrap">{facture.conditions}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <DialogFooter className="gap-2 flex-wrap">
              {/* Actions de modification/suppression à gauche */}
              <div className="flex items-center gap-2 mr-auto">
                {canManage && canDelete && (
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                )}
                {canManage && isBrouillon && (
                  <Button
                    variant="outline"
                    onClick={onEdit}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                )}
              </div>

              {/* Actions principales à droite */}
              {canManage && !isAvoir && !isBrouillon && facture.statut !== 'ANNULEE' && (
                <Button
                  variant="outline"
                  onClick={onCreateAvoir}
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Créer un avoir
                </Button>
              )}

              <Button
                variant="outline"
                onClick={onDownloadPdf}
              >
                <FileDown className="h-4 w-4 mr-2" />
                {isAvoir ? 'Avoir' : 'Facture'}
              </Button>

              {canManage && !isBrouillon && facture.statut !== 'PAYEE' && (
                <Button
                  variant="outline"
                  onClick={onRelance}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Relance
                </Button>
              )}

              {canManage && !isBrouillon && facture.statut !== 'PAYEE' && facture.statut !== 'EN_ATTENTE_ENCAISSEMENT' && (
                <Button
                  onClick={onPayment}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  Paiement
                </Button>
              )}

              {canManage && isBrouillon && (
                <Button
                  onClick={() => setShowValidateConfirm(true)}
                  disabled={isValidating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isValidating ? 'Validation...' : 'Valider'}
                </Button>
              )}

              <Button variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de validation */}
      <AlertDialog open={showValidateConfirm} onOpenChange={setShowValidateConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-blue-600">
              <CheckCircle2 className="h-5 w-5" />
              Valider la facture ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Vous allez valider cette facture. Une fois validée, elle ne pourra plus être modifiée.</p>

                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Facture</span>
                    <span className="font-medium text-foreground">{facture.ref}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium text-foreground">{client?.nomEntreprise || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium text-foreground">{isAvoir ? 'Avoir' : 'Facture'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Articles</span>
                    <span className="font-medium text-foreground">{lignes.length} ligne{lignes.length > 1 ? 's' : ''}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total TTC</span>
                    <span className="font-bold text-blue-600">{formatMontant(facture.totalTTC)}</span>
                  </div>
                </div>

                {/* Avertissement stock mixte */}
                {(() => {
                  const produitsSousSeuil = lignes.filter((l: any) => {
                    const ps = l.produitService;
                    if (!ps || !ps.aStock || ps.type === 'SERVICE') return false;
                    if (!ps.stockMinimum || ps.stockMinimum <= 0) return false;
                    const stockApres = ps.quantite - l.quantite;
                    return stockApres < ps.stockMinimum;
                  });
                  if (produitsSousSeuil.length === 0) return null;
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1 text-sm">
                      <p className="font-medium text-amber-800 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        {produitsSousSeuil.length} produit{produitsSousSeuil.length > 1 ? 's' : ''} passeront sous le stock minimum
                      </p>
                      <ul className="text-amber-700 space-y-0.5 pl-5 list-disc">
                        {produitsSousSeuil.map((l: any) => (
                          <li key={l.id}>
                            {l.produitService?.nom} — stock après : {(l.produitService?.quantite - l.quantite).toFixed(2)} / min. {l.produitService?.stockMinimum}
                          </li>
                        ))}
                      </ul>
                      <p className="text-amber-600 text-xs">La validation reste possible.</p>
                    </div>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setShowValidateConfirm(false);
                onValidate();
              }}
            >
              Valider la facture
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Supprimer la facture ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la facture <strong>{facture.ref}</strong> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete();
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============ MAIN COMPONENT ============

export function CommercePage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { canDo } = useAuthStore();
  const canManage = canDo('manageCommerce');

  // Search states
  const [searchDevis, setSearchDevis] = useState('');
  const [searchCommandes, setSearchCommandes] = useState('');
  const [searchBL, setSearchBL] = useState('');
  const [searchFactures, setSearchFactures] = useState('');

  // Sort states
  const [sortDevis, setSortDevis] = useState<string>('recent');
  const [sortCommandes, setSortCommandes] = useState<string>('recent');
  const [statusFilterCommandes, setStatusFilterCommandes] = useState('all');
  const [sortBL, setSortBL] = useState<string>('recent');
  const [sortFactures, setSortFactures] = useState<string>('recent');
  const [statusFilterFactures, setStatusFilterFactures] = useState<string>(
    () => new URLSearchParams(window.location.search).get('statut') || 'all'
  );

  // Type filters (SERVICE / PRODUIT)
  const [typeFilterDevis, setTypeFilterDevis] = useState<'all' | 'SERVICE' | 'PRODUIT'>('all');
  const [typeFilterCommandes, setTypeFilterCommandes] = useState<'all' | 'SERVICE' | 'PRODUIT'>('all');
  const [typeFilterBL, setTypeFilterBL] = useState<'all' | 'SERVICE' | 'PRODUIT'>('all');
  const [typeFilterFactures, setTypeFilterFactures] = useState<'all' | 'SERVICE' | 'PRODUIT'>('all');

  // Bulk selection
  const [selectedDevis, setSelectedDevis] = useState<Set<string>>(new Set());
  const [selectedCommandes, setSelectedCommandes] = useState<Set<string>>(new Set());
  const [selectedBL, setSelectedBL] = useState<Set<string>>(new Set());
  const [selectedFactures, setSelectedFactures] = useState<Set<string>>(new Set());

  // Detail sheet state
  const [viewingDocument, setViewingDocument] = useState<{
    type: 'devis' | 'commande' | 'facture';
    document: any;
  } | null>(null);

  // BL states
  const [viewingBL, setViewingBL] = useState<BonLivraison | null>(null);
  const [viewingBLProgression, setViewingBLProgression] = useState<import('../types').CommandeProgressionLivraison | null>(null);
  const [showBLDialog, setShowBLDialog] = useState(false);
  const [blFromCommandeId, setBLFromCommandeId] = useState<string | null>(null);
  const [blProgression, setBLProgression] = useState<import('../types').CommandeProgressionLivraison | null>(null);
  const [blForm, setBLForm] = useState<CreateBonLivraisonInput>({ clientId: '', lignes: [] });
  const [statusFilterBL, setStatusFilterBL] = useState<string>('all');

  // Relance dialog state
  const [relanceFacture, setRelanceFacture] = useState<any>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'devis' | 'commande' | 'facture';
    item: any;
  } | null>(null);

  // Devis validation confirmation state
  const [validationTarget, setValidationTarget] = useState<any>(null);

  // Devis conversion confirmation state
  const [conversionTarget, setConversionTarget] = useState<any>(null);

  // Payment dialog state
  const [paiementFacture, setPaiementFacture] = useState<any>(null);
  const [paiementForm, setPaiementForm] = useState({
    montant: 0,
    modePaiement: 'CHEQUE' as 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'CARTE' | 'EFFET',
    reference: '',
    banque: '',
    emetteur: '',
    datePaiement: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Cheque lifecycle modal state
  const [chequeActionModal, setChequeActionModal] = useState<{
    paiementId: string;
    newStatut: 'DEPOSE' | 'ENCAISSE' | 'REJETE';
    label: string;
  } | null>(null);
  const [chequeActionDate, setChequeActionDate] = useState(new Date().toISOString().split('T')[0]);

  // Active tab state — synced with ?tab= query param
  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['devis', 'commandes', 'bons-livraison', 'factures'];
  const activeTab = validTabs.includes(tabFromUrl ?? '') ? tabFromUrl! : 'devis';
  const setActiveTab = (tab: string) => {
    navigate(`${location.pathname}?tab=${tab}`, { replace: true });
  };

  // Auto-open facture from ?openId= URL param
  useEffect(() => {
    const openId = new URLSearchParams(location.search).get('openId');
    if (openId) {
      commerceApi.getFacture(openId)
        .then(facture => setViewingDocument({ type: 'facture', document: facture }))
        .catch(() => {});
    }
  }, []);

  // ============ QUERIES ============

  const { data: devisData, isLoading: devisLoading } = useQuery({
    queryKey: ['commerce', 'devis'],
    queryFn: () => commerceApi.listDevis({ limit: 100 }),
  });

  const { data: commandesData, isLoading: commandesLoading } = useQuery({
    queryKey: ['commerce', 'commandes'],
    queryFn: () => commerceApi.listCommandes({ limit: 100 }),
  });

  const { data: blData, isLoading: blLoading } = useQuery({
    queryKey: ['commerce', 'bons-livraison'],
    queryFn: () => commerceApi.listBonsLivraison({ limit: 100 }),
  });

  const { data: facturesData, isLoading: facturesLoading } = useQuery({
    queryKey: ['commerce', 'factures'],
    queryFn: () => commerceApi.listFactures({ limit: 100 }),
  });

  const { data: tiersData } = useQuery({
    queryKey: ['tiers', 'commerce'],
    queryFn: () => tiersApi.list({ page: 1, limit: 200 }),
  });

  const { data: produitsData } = useQuery({
    queryKey: ['produits-services', 'commerce'],
    queryFn: () => produitsServicesApi.list({ page: 1, limit: 200, actif: true, enVente: true }),
  });

  // Filter clients only (fournisseurs are handled in Achats & Dépenses)
  const tiers = tiersData?.tiers || [];
  const clients = tiers.filter((t) => t.typeTiers === 'CLIENT' || t.typeTiers === 'CLIENT_FOURNISSEUR');
  const produits = produitsData?.produits || [];

  // Sort function for documents
  const sortDocuments = <T extends {
    ref: string;
    createdAt?: string;
    dateDevis?: string;
    dateCommande?: string;
    dateFacture?: string;
    totalTTC: number;
    client?: { nomEntreprise: string };
  }>(documents: T[], sortBy: string): T[] => {
    return [...documents].sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.createdAt || b.dateDevis || b.dateCommande || b.dateFacture || 0).getTime() -
                 new Date(a.createdAt || a.dateDevis || a.dateCommande || a.dateFacture || 0).getTime();
        case 'oldest':
          return new Date(a.createdAt || a.dateDevis || a.dateCommande || a.dateFacture || 0).getTime() -
                 new Date(b.createdAt || b.dateDevis || b.dateCommande || b.dateFacture || 0).getTime();
        case 'client-az':
          return (a.client?.nomEntreprise || '').localeCompare(b.client?.nomEntreprise || '');
        case 'client-za':
          return (b.client?.nomEntreprise || '').localeCompare(a.client?.nomEntreprise || '');
        case 'montant-asc':
          return a.totalTTC - b.totalTTC;
        case 'montant-desc':
          return b.totalTTC - a.totalTTC;
        case 'ref-az':
          return a.ref.localeCompare(b.ref);
        default:
          return 0;
      }
    });
  };

  // Filter lists based on search
  const filteredDevis = useMemo(() => {
    let list = devisData?.devis || [];
    if (typeFilterDevis !== 'all') list = list.filter((d) => d.typeDocument === typeFilterDevis);
    if (!searchDevis) return list;
    const search = searchDevis.toLowerCase();
    return list.filter((d) =>
      d.ref?.toLowerCase().includes(search) ||
      d.client?.nomEntreprise?.toLowerCase().includes(search)
    );
  }, [devisData?.devis, searchDevis, typeFilterDevis]);

  const filteredCommandes = useMemo(() => {
    let list = commandesData?.commandes || [];
    if (statusFilterCommandes !== 'all') list = list.filter((c) => c.statut === statusFilterCommandes);
    if (typeFilterCommandes !== 'all') list = list.filter((c) => c.typeDocument === typeFilterCommandes);
    if (!searchCommandes) return list;
    const search = searchCommandes.toLowerCase();
    return list.filter((c) =>
      c.ref?.toLowerCase().includes(search) ||
      c.client?.nomEntreprise?.toLowerCase().includes(search)
    );
  }, [commandesData?.commandes, searchCommandes, statusFilterCommandes, typeFilterCommandes]);

  const filteredBL = useMemo(() => {
    let list = blData?.items || [];
    if (statusFilterBL !== 'all') list = list.filter((b) => b.statut === statusFilterBL);
    if (typeFilterBL !== 'all') list = list.filter((b) => (b.commande as any)?.typeDocument === typeFilterBL);
    if (!searchBL) return list;
    const search = searchBL.toLowerCase();
    return list.filter((b) =>
      b.ref?.toLowerCase().includes(search) ||
      b.client?.nomEntreprise?.toLowerCase().includes(search) ||
      b.commande?.ref?.toLowerCase().includes(search)
    );
  }, [blData?.items, searchBL, statusFilterBL, typeFilterBL]);

  const filteredFactures = useMemo(() => {
    let list = facturesData?.factures || [];
    if (statusFilterFactures !== 'all') list = list.filter((f) => f.statut === statusFilterFactures);
    if (typeFilterFactures !== 'all') list = list.filter((f) => (f as any).typeDocument === typeFilterFactures);
    if (!searchFactures) return list;
    const search = searchFactures.toLowerCase();
    return list.filter((f) =>
      f.ref?.toLowerCase().includes(search) ||
      f.client?.nomEntreprise?.toLowerCase().includes(search) ||
      f.site?.nom?.toLowerCase().includes(search)
    );
  }, [facturesData?.factures, searchFactures, statusFilterFactures, typeFilterFactures]);

  // Track which documents have been converted
  const convertedDevisIds = useMemo(() => {
    const ids = new Set<string>();
    (commandesData?.commandes || []).forEach((c) => {
      if (c.devisId) ids.add(c.devisId);
    });
    return ids;
  }, [commandesData?.commandes]);

  const convertedCommandeIds = useMemo(() => {
    const ids = new Set<string>();
    (facturesData?.factures || []).forEach((f) => {
      if (f.commandeId) ids.add(f.commandeId);
    });
    return ids;
  }, [facturesData?.factures]);

  // ============ FORM STATES ============

  const [devisForm, setDevisForm] = useState<CreateDevisInput & { dureeValiditeJours?: number }>({
    clientId: '',
    siteId: undefined,
    typeDocument: 'PRODUIT',
    lignes: [{ ...EMPTY_LINE }],
    dureeValiditeJours: 7,
  });
  const [commandeForm, setCommandeForm] = useState<CreateCommandeInput>({
    clientId: '',
    siteId: undefined,
    typeDocument: 'PRODUIT',
    lignes: [{ ...EMPTY_LINE }],
  });
  const [factureForm, setFactureForm] = useState<CreateFactureInput>({
    clientId: '',
    siteId: undefined,
    typeDocument: 'PRODUIT',
    lignes: [{ ...EMPTY_LINE }],
    type: 'FACTURE',
    dateFacture: new Date().toISOString().split('T')[0],
    delaiPaiementJours: 45,
  });

  // Dialog states
  const [showDevisDialog, setShowDevisDialog] = useState(false);
  const [showCommandeDialog, setShowCommandeDialog] = useState(false);
  const [showFactureDialog, setShowFactureDialog] = useState(false);

  // Editing states (null = create mode, string = edit mode with document id)
  const [editingDevisId, setEditingDevisId] = useState<string | null>(null);
  const [editingCommandeId, setEditingCommandeId] = useState<string | null>(null);
  const [editingFactureId, setEditingFactureId] = useState<string | null>(null);

  // Validation dialog states
  const [validationCommandeDialog, setValidationCommandeDialog] = useState<any>(null);
  const [validationFactureDialog, setValidationFactureDialog] = useState<any>(null);
  const [validationCommandeForm, setValidationCommandeForm] = useState({
    refBonCommandeClient: '',
    dateCommande: '',
    dateLivraisonSouhaitee: '',
    notes: '',
    conditions: '',
  });
  const [validationFactureForm, setValidationFactureForm] = useState({
    delaiPaiementJours: 45,
    dateFacture: '',
    notes: '',
    conditions: '',
  });

  // Handle navigation state from Planning (generate facture from intervention)
  useEffect(() => {
    const state = location.state as {
      generateFacture?: boolean;
      clientId?: string;
      siteId?: string;
      prestation?: string;
      prixPrestation?: number;
      interventionId?: string;
      dateIntervention?: string;
      contratType?: 'PONCTUEL' | 'ANNUEL';
      contratNumeroBonCommande?: string;
      contratDateDebut?: string;
    } | null;

    if (state?.generateFacture && state.clientId) {
      setActiveTab('factures');

      const dateDebutStr = state.contratDateDebut ? new Date(state.contratDateDebut).toLocaleDateString('fr-FR') : '';
      let mentionSpeciale = '';
      if (state.contratType === 'PONCTUEL' && state.contratNumeroBonCommande) {
        mentionSpeciale = `Selon le bon de commande "${state.contratNumeroBonCommande}"${dateDebutStr ? ` du ${dateDebutStr}` : ''}`;
      } else if (state.contratType === 'ANNUEL' && dateDebutStr) {
        mentionSpeciale = `Selon la convention du ${dateDebutStr}`;
      }

      setFactureForm({
        clientId: state.clientId,
        siteId: state.siteId || undefined,
        typeDocument: 'SERVICE',
        lignes: [{
          ...EMPTY_LINE,
          libelle: state.prestation || 'Prestation de service',
          description: '',
          quantite: 1,
          prixUnitaireHT: state.prixPrestation ?? 0,
        }],
        type: 'FACTURE',
        notes: '',
        mentionSpeciale,
        dateFacture: new Date().toISOString().split('T')[0],
        dateOperation: state.dateIntervention ? state.dateIntervention.split('T')[0] : undefined,
        delaiPaiementJours: 45,
      });
      setShowFactureDialog(true);

      toast.info('Facture pré-remplie depuis l\'intervention', {
        description: 'Complétez les informations et créez la facture.',
      });

      // Nettoyer le state pour éviter de réouvrir le dialog à chaque navigation
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  const totalsDevis = useMemo(() => computeTotals(devisForm.lignes), [devisForm.lignes]);
  const totalsCommande = useMemo(() => computeTotals(commandeForm.lignes), [commandeForm.lignes]);
  const factureSign = factureForm.type === 'AVOIR' ? -1 : 1;
  const totalsFacture = useMemo(() => computeTotals(factureForm.lignes, factureSign), [factureForm.lignes, factureSign]);

  // ============ MUTATIONS ============

  const createDevisMutation = useMutation({
    mutationFn: (payload: CreateDevisInput) => commerceApi.createDevis(payload),
    onSuccess: (data, variables) => {
      toast.success('Devis créé avec succès', {
        description: `Référence: ${data.ref || 'N/A'}`,
        action: {
          label: 'Voir',
          onClick: () => setViewingDocument({ type: 'devis', document: data }),
        },
      });
      queryClient.invalidateQueries({ queryKey: ['commerce', 'devis'] });
      // Si c'est un devis SERVICE avec un site, rafraîchir les tiers pour mettre à jour noteServiceDefaut
      if (variables.typeDocument === 'SERVICE' && variables.siteId) {
        queryClient.invalidateQueries({ queryKey: ['tiers', 'commerce'] });
      }
      setDevisForm({ clientId: '', siteId: undefined, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }], dureeValiditeJours: 7 });
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
      setCommandeForm({ clientId: '', siteId: undefined, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }] });
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
      setFactureForm({ clientId: '', siteId: undefined, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }], type: 'FACTURE', dateFacture: new Date().toISOString().split('T')[0], delaiPaiementJours: 45 });
      setShowFactureDialog(false);
      setActiveTab('factures');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création de la facture');
    },
  });

  // Update mutations for draft documents
  const updateDevisMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateDevisInput> }) =>
      commerceApi.updateDevis(id, payload),
    onSuccess: () => {
      toast.success('Devis mis à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'devis'] });
      setDevisForm({ clientId: '', siteId: undefined, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }], dureeValiditeJours: 7 });
      setEditingDevisId(null);
      setShowDevisDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la mise à jour du devis');
    },
  });

  const updateCommandeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCommandeInput> }) =>
      commerceApi.updateCommande(id, payload),
    onSuccess: () => {
      toast.success('Commande mise à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes'] });
      setCommandeForm({ clientId: '', siteId: undefined, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }] });
      setEditingCommandeId(null);
      setShowCommandeDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la mise à jour de la commande');
    },
  });

  const updateFactureMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateFactureInput> }) =>
      commerceApi.updateFacture(id, payload),
    onSuccess: () => {
      toast.success('Facture mise à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'factures'] });
      setFactureForm({ clientId: '', siteId: undefined, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }], type: 'FACTURE', dateFacture: new Date().toISOString().split('T')[0], delaiPaiementJours: 45 });
      setEditingFactureId(null);
      setShowFactureDialog(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la mise à jour de la facture');
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

  // Validation mutations
  const validerDevis = useMutation({
    mutationFn: (id: string) => commerceApi.validerDevis(id),
    onSuccess: () => {
      toast.success('Devis validé avec succès');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'devis'] });
      setViewingDocument(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la validation');
    },
  });

  const validerCommande = useMutation({
    mutationFn: ({ id, refBonCommandeClient, dateCommande, dateLivraisonSouhaitee, notes, conditions }: {
      id: string;
      refBonCommandeClient: string;
      dateCommande?: string;
      dateLivraisonSouhaitee?: string;
      notes?: string;
      conditions?: string;
    }) =>
      commerceApi.validerCommande(id, { refBonCommandeClient, dateCommande, dateLivraisonSouhaitee, notes, conditions }),
    onSuccess: () => {
      toast.success('Commande validée avec succès');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes'] });
      setViewingDocument(null);
      setValidationCommandeDialog(null);
      setValidationCommandeForm({ refBonCommandeClient: '', dateCommande: '', dateLivraisonSouhaitee: '', notes: '', conditions: '' });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la validation');
    },
  });

  const validerFacture = useMutation({
    mutationFn: ({ id, delaiPaiementJours, dateFacture, notes, conditions }: {
      id: string;
      delaiPaiementJours?: number;
      dateFacture?: string;
      notes?: string;
      conditions?: string;
    }) =>
      commerceApi.validerFacture(id, { delaiPaiementJours, dateFacture, notes, conditions }),
    onSuccess: () => {
      toast.success('Facture validée avec succès');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'factures'] });
      setViewingDocument(null);
      setValidationFactureDialog(null);
      setValidationFactureForm({ delaiPaiementJours: 45, dateFacture: '', notes: '', conditions: '' });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la validation');
    },
  });

  const createRelanceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { canal: 'EMAIL' | 'SMS' | 'COURRIER' | 'APPEL'; commentaire?: string; niveau: number } }) =>
      commerceApi.createRelance(id, payload),
    onSuccess: () => {
      toast.success('Relance enregistrée');
      setRelanceFacture(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la relance');
    },
  });

  // Delete mutations
  const deleteDevisMutation = useMutation({
    mutationFn: (id: string) => commerceApi.deleteDevis(id),
    onSuccess: () => {
      toast.success('Devis supprimé');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'devis'] });
      setDeleteTarget(null);
      setViewingDocument(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const deleteCommandeMutation = useMutation({
    mutationFn: (id: string) => commerceApi.deleteCommande(id),
    onSuccess: () => {
      toast.success('Commande supprimée');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes'] });
      setDeleteTarget(null);
      setViewingDocument(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const deleteFactureMutation = useMutation({
    mutationFn: (id: string) => commerceApi.deleteFacture(id),
    onSuccess: () => {
      toast.success('Facture supprimée');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'factures'] });
      setDeleteTarget(null);
      setViewingDocument(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  // Payment mutation
  const createPaiementMutation = useMutation({
    mutationFn: (payload: { factureId: string; montant: number; datePaiement?: string; modePaiement?: string; reference?: string; banque?: string; notes?: string }) =>
      commerceApi.createPaiement(payload),
    onSuccess: async (_, variables) => {
      toast.success('Paiement enregistré');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'factures'] });
      if (viewingDocument?.type === 'facture' && variables.factureId) {
        try {
          const freshFacture = await commerceApi.getFacture(variables.factureId);
          setViewingDocument({ type: 'facture', document: freshFacture });
        } catch {}
      }
      setPaiementFacture(null);
      setPaiementForm({
        montant: 0,
        modePaiement: 'CHEQUE',
        reference: '',
        banque: '',
        emetteur: '',
        datePaiement: new Date().toISOString().split('T')[0],
        notes: '',
      });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de l\'enregistrement du paiement');
    },
  });

  // Cheque status mutation
  const updateStatutChequeMutation = useMutation({
    mutationFn: ({ id, statut, date }: { id: string; statut: string; date?: string }) =>
      commerceApi.updateStatutCheque(id, statut, date),
    onSuccess: async () => {
      toast.success('Statut du chèque mis à jour');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'factures'] });
      setChequeActionModal(null);
      if (viewingDocument?.type === 'facture' && viewingDocument.document?.id) {
        try {
          const freshFacture = await commerceApi.getFacture(viewingDocument.document.id);
          setViewingDocument({ type: 'facture', document: freshFacture });
        } catch {}
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  // ── BL Mutations ──────────────────────────────────────────────────────────
  const createBLMutation = useMutation({
    mutationFn: (payload: CreateBonLivraisonInput) => commerceApi.createBonLivraison(payload),
    onSuccess: () => {
      toast.success('Bon de livraison créé');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'bons-livraison'] });
      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes'] });
      setShowBLDialog(false);
      setBLForm({ clientId: '', lignes: [] });
      setBLFromCommandeId(null);
      setBLProgression(null);
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la création'),
  });

  const openBLDetail = async (id: string) => {
    try {
      const full = await commerceApi.getBonLivraison(id);
      setViewingBL(full);
      if (full.commandeId) {
        commerceApi.getCommandeProgressionLivraison(full.commandeId)
          .then(setViewingBLProgression)
          .catch(() => setViewingBLProgression(null));
      } else {
        setViewingBLProgression(null);
      }
    } catch {
      toast.error('Erreur lors du chargement');
    }
  };

  const validerBLMutation = useMutation({
    mutationFn: (id: string) => commerceApi.validerBonLivraison(id),
    onSuccess: () => {
      toast.success('BL confirmé');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'bons-livraison'] });
      if (viewingBL) openBLDetail(viewingBL.id);
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur'),
  });

  const livrerBLMutation = useMutation({
    mutationFn: (id: string) => commerceApi.livrerBonLivraison(id),
    onSuccess: () => {
      toast.success('BL marqué comme livré');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'bons-livraison'] });
      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes'] });
      if (viewingBL) openBLDetail(viewingBL.id);
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur'),
  });

  const annulerBLMutation = useMutation({
    mutationFn: (id: string) => commerceApi.annulerBonLivraison(id),
    onSuccess: () => {
      toast.success('BL annulé');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'bons-livraison'] });
      if (viewingBL) openBLDetail(viewingBL.id);
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur'),
  });

  const deleteBLMutation = useMutation({
    mutationFn: (id: string) => commerceApi.deleteBonLivraison(id),
    onSuccess: () => {
      toast.success('BL supprimé');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'bons-livraison'] });
      setViewingBL(null);
    },
    onError: (error: any) => toast.error(error?.response?.data?.error || 'Erreur lors de la suppression'),
  });

  const creerBLFromCommande = async (commandeId: string) => {
    try {
      const [commande, progression] = await Promise.all([
        commerceApi.getCommande(commandeId),
        commerceApi.getCommandeProgressionLivraison(commandeId),
      ]);
      setBLFromCommandeId(commandeId);
      setBLProgression(progression);
      setBLForm({
        clientId: commande.clientId,
        commandeId,
        siteId: commande.siteId || undefined,
        devise: commande.devise || 'DZD',
        lignes: (commande.lignes || [])
          .filter((l: any) => {
            const prog = progression.lignes.find((p) => p.commandeLigneId === l.id);
            return !prog || prog.quantiteRestante > 0;
          })
          .map((l: any) => {
            const prog = progression.lignes.find((p) => p.commandeLigneId === l.id);
            const restante = prog ? prog.quantiteRestante : l.quantite;
            return {
              commandeLigneId: l.id,
              libelle: l.libelle,
              description: l.description || '',
              quantiteCommandee: l.quantite,
              quantiteLivree: restante,
              unite: l.unite || '',
              prixUnitaireHT: l.prixUnitaireHT,
              tauxTVA: l.tauxTVA,
              remisePct: l.remisePct || 0,
            };
          }),
      });
      setShowBLDialog(true);
    } catch {
      toast.error('Erreur lors du chargement de la commande');
    }
  };

  // BL badge helper
  const blStatusBadge = (statut: BonLivraisonStatut) => {
    const config: Record<BonLivraisonStatut, { label: string; className: string }> = {
      BROUILLON: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700' },
      CONFIRME: { label: 'Confirmé', className: 'bg-blue-100 text-blue-800' },
      LIVRE: { label: 'Livré', className: 'bg-green-100 text-green-800' },
      ANNULE: { label: 'Annulé', className: 'bg-red-100 text-red-700' },
    };
    const c = config[statut] || { label: statut, className: 'bg-gray-100 text-gray-700' };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  // Helper function to check if a document can be deleted
  const canDeleteDevis = (devisId: string) => {
    // Can't delete if converted to commande
    return !convertedDevisIds.has(devisId);
  };

  const canDeleteCommande = (commandeId: string) => {
    // Can't delete if converted to facture
    return !convertedCommandeIds.has(commandeId);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;

    switch (deleteTarget.type) {
      case 'devis':
        deleteDevisMutation.mutate(deleteTarget.item.id);
        break;
      case 'commande':
        deleteCommandeMutation.mutate(deleteTarget.item.id);
        break;
      case 'facture':
        deleteFactureMutation.mutate(deleteTarget.item.id);
        break;
    }
  };

  // ============ RENDER ============

  // KPI calculations
  const kpiDevis          = devisData?.devis?.filter((d: any) => d.statut !== 'BROUILLON').length || 0;
  const kpiCommandes      = commandesData?.commandes?.filter((c: any) => c.statut !== 'BROUILLON').length || 0;
  const kpiBL             = blData?.items?.filter((b: any) => b.statut !== 'ANNULE').length || 0;
  const kpiBLEnCours      = blData?.items?.filter((b: any) => b.statut === 'CONFIRME').length || 0;
  const kpiFactures       = facturesData?.factures?.filter((f: any) => f.statut !== 'BROUILLON').length || 0;
  const kpiEnRetard       = facturesData?.factures?.filter((f: any) => f.statut === 'EN_RETARD').length || 0;
  const kpiDevisBrouillon = devisData?.devis?.filter((d: any) => d.statut === 'BROUILLON').length || 0;
  const tabCounts = {
    devis: devisData?.devis?.length || 0,
    commandes: commandesData?.commandes?.length || 0,
    'bons-livraison': blData?.items?.length || 0,
    factures: facturesData?.factures?.length || 0,
  };

  return (
    <div className="min-h-screen bg-gray-50">
    <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Cycle de vente</h1>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /><span>Devis</span>
            <span className="text-gray-300">→</span>
            <ShoppingCart className="h-3.5 w-3.5" /><span>Commandes</span>
            <span className="text-gray-300">→</span>
            <Truck className="h-3.5 w-3.5" /><span>Bons de livraison</span>
            <span className="text-gray-300">→</span>
            <Receipt className="h-3.5 w-3.5" /><span>Factures</span>
          </p>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { tab: 'devis',          label: 'Devis',          value: kpiDevis,     sub: kpiDevisBrouillon > 0 ? `${kpiDevisBrouillon} brouillon${kpiDevisBrouillon > 1 ? 's' : ''}` : null, bar: 'bg-blue-500',   num: 'text-blue-700',   bg: 'bg-blue-50',   icon: FileText },
          { tab: 'commandes',      label: 'Commandes',      value: kpiCommandes, sub: null,                                                                                                   bar: 'bg-amber-400',  num: 'text-amber-700',  bg: 'bg-amber-50',  icon: ShoppingCart },
          { tab: 'bons-livraison', label: 'Bons de livr.',  value: kpiBL,        sub: kpiBLEnCours > 0 ? `${kpiBLEnCours} en cours` : null,                                                  bar: 'bg-teal-500',   num: 'text-teal-700',   bg: 'bg-teal-50',   icon: Truck },
          { tab: 'factures',       label: 'Factures',       value: kpiFactures,  sub: kpiEnRetard > 0 ? `${kpiEnRetard} en retard` : null,                                                   bar: 'bg-green-500',  num: 'text-green-700',  bg: 'bg-green-50',  icon: Receipt },
        ].map(({ tab, label, value, sub, bar, num, bg, icon: Icon }) => (
          <div key={tab} onClick={() => setActiveTab(tab)}
            className={cn(
              'relative bg-white rounded-xl p-5 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
              activeTab === tab ? 'ring-2 ring-gray-300 shadow-sm' : 'shadow-sm'
            )}>
            <div className={`absolute bottom-0 left-0 right-0 h-1 ${bar} rounded-b-xl`} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                <p className={`text-4xl font-black tabular-nums leading-none ${num}`}>{value}</p>
                {sub && <p className={`text-xs font-semibold mt-1 ${sub.includes('retard') ? 'text-red-600' : 'text-gray-400'}`}>{sub}</p>}
              </div>
              <div className={`p-2.5 rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${num}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-white rounded-xl shadow-sm p-1 h-auto">
          {([
            { value: 'devis',          icon: FileText,     label: 'Devis',               labelShort: 'Devis',  color: 'bg-blue-500' },
            { value: 'commandes',      icon: ShoppingCart, label: 'Commandes',            labelShort: 'Cmd.',   color: 'bg-amber-400' },
            { value: 'bons-livraison', icon: Truck,        label: 'Bons de livraison',    labelShort: 'BL',     color: 'bg-teal-500' },
            { value: 'factures',       icon: Receipt,      label: 'Factures',             labelShort: 'Fact.',  color: 'bg-green-500' },
          ] as const).map(({ value, icon: Icon, label, labelShort, color }) => (
            <TabsTrigger key={value} value={value} className="group relative flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{labelShort}</span>
              {tabCounts[value] > 0 && (
                <span className={`hidden sm:inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white ${color} group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white`}>
                  {tabCounts[value]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* DEVIS TAB */}
        <TabsContent value="devis">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-gray-900">{filteredDevis.length} devis</p>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  {(['all', 'SERVICE', 'PRODUIT'] as const).map((t) => (
                    <button key={t} onClick={() => setTypeFilterDevis(t)} className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${typeFilterDevis === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                      {t === 'all' ? 'Tous' : t === 'SERVICE' ? 'Service' : 'Produit'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedDevis.size > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                    <SquareCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-700">{selectedDevis.size} sélectionné{selectedDevis.size > 1 ? 's' : ''}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-600 hover:bg-red-50" onClick={async () => {
                      const ids = [...selectedDevis];
                      await Promise.all(ids.map(id => commerceApi.deleteDevis(id)));
                      queryClient.invalidateQueries({ queryKey: ['commerce', 'devis'] });
                      setSelectedDevis(new Set());
                      toast.success(`${ids.length} devis supprimé${ids.length > 1 ? 's' : ''}`);
                    }}>
                      <Trash2 className="h-3 w-3 mr-1" />Supprimer
                    </Button>
                    <button className="text-gray-400 hover:text-gray-600 text-xs" onClick={() => setSelectedDevis(new Set())}>✕</button>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                  <Input placeholder="Rechercher..." value={searchDevis} onChange={(e) => setSearchDevis(e.target.value)} className="pl-8 h-8 w-48 text-sm border-gray-200" />
                </div>
                <Select value={sortDevis} onValueChange={setSortDevis}>
                  <SelectTrigger className="h-8 w-36 text-xs border-gray-200">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Plus récent</SelectItem>
                    <SelectItem value="oldest">Plus ancien</SelectItem>
                    <SelectItem value="client-az">Client A-Z</SelectItem>
                    <SelectItem value="montant-desc">Montant ↓</SelectItem>
                    <SelectItem value="ref-az">Référence A-Z</SelectItem>
                  </SelectContent>
                </Select>
                {canManage && (
                  <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-200" onClick={() => setShowDevisDialog(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Nouveau devis
                  </Button>
                )}
              </div>
            </div>
            <div>
              {devisLoading ? (
                <div className="py-12 text-center"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-xs text-gray-400">Chargement...</p></div>
              ) : filteredDevis.length === 0 ? (
                <div className="py-12 text-center"><FileText className="h-8 w-8 text-gray-200 mx-auto mb-2"/><p className="text-sm text-gray-400">{searchDevis ? 'Aucun devis trouvé' : 'Aucun devis'}</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox checked={filteredDevis.length > 0 && filteredDevis.every(d => selectedDevis.has(d.id))} onCheckedChange={(checked) => {
                            if (checked) setSelectedDevis(new Set(filteredDevis.map(d => d.id)));
                            else setSelectedDevis(new Set());
                          }} />
                        </TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="hidden lg:table-cell">Site</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortDocuments(filteredDevis, sortDevis).map((d) => (
                        <TableRow
                          key={d.id}
                          className={`cursor-pointer hover:bg-gray-50 ${selectedDevis.has(d.id) ? 'bg-blue-50' : ''}`}
                          onClick={async () => {
                            try {
                              const fullDevis = await commerceApi.getDevis(d.id);
                              setViewingDocument({ type: 'devis', document: fullDevis });
                            } catch {
                              toast.error('Erreur lors du chargement du devis');
                            }
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedDevis.has(d.id)} onCheckedChange={(checked) => {
                              const next = new Set(selectedDevis);
                              if (checked) next.add(d.id); else next.delete(d.id);
                              setSelectedDevis(next);
                            }} />
                          </TableCell>
                          <TableCell className="font-medium">{d.ref}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {d.typeDocument ? (
                              <Badge className={d.typeDocument === 'SERVICE'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                              }>
                                {d.typeDocument === 'SERVICE' ? 'Service' : 'Produit'}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>{d.client?.nomEntreprise || '-'}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {d.site ? (
                              <span className="text-sm flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {d.site.nom}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(d.dateDevis)}</TableCell>
                          <TableCell>{statusBadge(d.statut)}</TableCell>
                          <TableCell className="text-right font-medium">{formatMontant(d.totalTTC)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Tooltip content="Voir les détails">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const fullDevis = await commerceApi.getDevis(d.id);
                                      setViewingDocument({ type: 'devis', document: fullDevis });
                                    } catch {
                                      toast.error('Erreur lors du chargement du devis');
                                    }
                                  }}
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
                              {canManage && d.statut === 'BROUILLON' && (
                                <Tooltip content="Modifier le devis">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={async () => {
                                      try {
                                        const fullDevis = await commerceApi.getDevis(d.id);
                                        // Calculer la durée de validité en jours
                                        let dureeValiditeJours = 7;
                                        if (fullDevis.dateDevis && fullDevis.dateValidite) {
                                          const dateDevis = new Date(fullDevis.dateDevis);
                                          const dateValidite = new Date(fullDevis.dateValidite);
                                          dureeValiditeJours = Math.round((dateValidite.getTime() - dateDevis.getTime()) / (1000 * 60 * 60 * 24));
                                        }
                                        setEditingDevisId(d.id);
                                        setDevisForm({
                                          clientId: fullDevis.clientId,
                                          dateDevis: fullDevis.dateDevis?.split('T')[0],
                                          dureeValiditeJours,
                                          notes: fullDevis.notes || '',
                                          conditions: fullDevis.conditions || '',
                                          remiseGlobalPct: fullDevis.remiseGlobalPct || 0,
                                          remiseGlobalMontant: fullDevis.remiseGlobalMontant || 0,
                                          lignes: fullDevis.lignes?.map((l: any) => ({
                                            produitServiceId: l.produitServiceId || undefined,
                                            libelle: l.libelle || '',
                                            description: l.description || '',
                                            quantite: l.quantite || 1,
                                            unite: l.unite || '',
                                            prixUnitaireHT: l.prixUnitaireHT || 0,
                                            tauxTVA: l.tauxTVA ?? 19,
                                            remisePct: l.remisePct || 0,
                                          })) || [{ ...EMPTY_LINE }],
                                        });
                                        setShowDevisDialog(true);
                                      } catch {
                                        toast.error('Erreur lors du chargement du devis');
                                      }
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && d.statut === 'BROUILLON' && (
                                <Tooltip content="Valider le devis">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => setValidationTarget(d)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && d.statut !== 'BROUILLON' && !convertedDevisIds.has(d.id) && (
                                <Tooltip content="Convertir en commande">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setConversionTarget(d)}
                                  >
                                    <ArrowRightLeft className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && canDeleteDevis(d.id) && (
                                <Tooltip content="Supprimer">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setDeleteTarget({ type: 'devis', item: d })}
                                  >
                                    <Trash2 className="h-4 w-4" />
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
            </div>
          </div>
        </TabsContent>

        {/* COMMANDES TAB */}
        <TabsContent value="commandes">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-gray-900">{filteredCommandes.length} commande{filteredCommandes.length > 1 ? 's' : ''}</p>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  {(['all', 'SERVICE', 'PRODUIT'] as const).map((t) => (
                    <button key={t} onClick={() => setTypeFilterCommandes(t)} className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${typeFilterCommandes === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                      {t === 'all' ? 'Tous' : t === 'SERVICE' ? 'Service' : 'Produit'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedCommandes.size > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                    <SquareCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-700">{selectedCommandes.size} sélectionné{selectedCommandes.size > 1 ? 's' : ''}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-600 hover:bg-red-50" onClick={async () => {
                      const ids = [...selectedCommandes];
                      await Promise.all(ids.map(id => commerceApi.deleteCommande(id)));
                      queryClient.invalidateQueries({ queryKey: ['commerce', 'commandes'] });
                      setSelectedCommandes(new Set());
                      toast.success(`${ids.length} commande${ids.length > 1 ? 's' : ''} supprimée${ids.length > 1 ? 's' : ''}`);
                    }}>
                      <Trash2 className="h-3 w-3 mr-1" />Supprimer
                    </Button>
                    <button className="text-gray-400 hover:text-gray-600 text-xs" onClick={() => setSelectedCommandes(new Set())}>✕</button>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                  <Input placeholder="Rechercher..." value={searchCommandes} onChange={(e) => setSearchCommandes(e.target.value)} className="pl-8 h-8 w-48 text-sm border-gray-200" />
                </div>
                <Select value={sortCommandes} onValueChange={setSortCommandes}>
                  <SelectTrigger className="h-8 w-36 text-xs border-gray-200">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Plus récent</SelectItem>
                    <SelectItem value="oldest">Plus ancien</SelectItem>
                    <SelectItem value="client-az">Client A-Z</SelectItem>
                    <SelectItem value="montant-desc">Montant ↓</SelectItem>
                    <SelectItem value="ref-az">Référence A-Z</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilterCommandes} onValueChange={setStatusFilterCommandes}>
                  <SelectTrigger className="h-8 w-36 text-xs border-gray-200"><SelectValue placeholder="Statut" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="BROUILLON">Brouillon</SelectItem>
                    <SelectItem value="VALIDEE">Validée</SelectItem>
                    <SelectItem value="EN_PREPARATION">En préparation</SelectItem>
                    <SelectItem value="EXPEDIEE">Expédiée</SelectItem>
                    <SelectItem value="LIVREE">Livrée</SelectItem>
                    <SelectItem value="ANNULEE">Annulée</SelectItem>
                  </SelectContent>
                </Select>
                {canManage && (
                    <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-200" onClick={() => setShowCommandeDialog(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Nouvelle commande
                    </Button>
                  )}
                </div>
              </div>
            <div>
              {commandesLoading ? (
                <div className="py-12 text-center"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-xs text-gray-400">Chargement...</p></div>
              ) : filteredCommandes.length === 0 ? (
                <div className="py-12 text-center"><ShoppingCart className="h-8 w-8 text-gray-200 mx-auto mb-2"/><p className="text-sm text-gray-400">{searchCommandes || statusFilterCommandes !== 'all' ? 'Aucune commande trouvée' : 'Aucune commande'}</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox checked={filteredCommandes.length > 0 && filteredCommandes.every(c => selectedCommandes.has(c.id))} onCheckedChange={(checked) => {
                            if (checked) setSelectedCommandes(new Set(filteredCommandes.map(c => c.id)));
                            else setSelectedCommandes(new Set());
                          }} />
                        </TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="hidden lg:table-cell">Site</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortDocuments(filteredCommandes, sortCommandes).map((c) => (
                        <TableRow
                          key={c.id}
                          className={`cursor-pointer hover:bg-gray-50 ${selectedCommandes.has(c.id) ? 'bg-blue-50' : ''}`}
                          onClick={async () => {
                            try {
                              const fullCommande = await commerceApi.getCommande(c.id);
                              setViewingDocument({ type: 'commande', document: fullCommande });
                            } catch {
                              toast.error('Erreur lors du chargement de la commande');
                            }
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedCommandes.has(c.id)} onCheckedChange={(checked) => {
                              const next = new Set(selectedCommandes);
                              if (checked) next.add(c.id); else next.delete(c.id);
                              setSelectedCommandes(next);
                            }} />
                          </TableCell>
                          <TableCell className="font-medium">{c.ref}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {c.typeDocument ? (
                              <Badge className={c.typeDocument === 'SERVICE'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                              }>
                                {c.typeDocument === 'SERVICE' ? 'Service' : 'Produit'}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>{c.client?.nomEntreprise || '-'}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {c.site ? (
                              <span className="text-sm flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {c.site.nom}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(c.dateCommande)}</TableCell>
                          <TableCell>
                            {(() => {
                              const cfg = STATUS_MAP[c.statut] || { label: c.statut, variant: 'secondary' as const };
                              const bls = c.bonsLivraison || [];
                              const totalCmd = (c.lignes || []).reduce((s: number, l: any) => s + (l.quantite || 0), 0);
                              const totalLivree = bls.reduce((s, bl) => s + (bl.lignes || []).reduce((ss, l) => ss + l.quantiteLivree, 0), 0);
                              const pct = totalCmd > 0 ? Math.round((totalLivree / totalCmd) * 100) : 0;
                              const lastDelivery = bls.filter(bl => bl.dateLivraisonEffective).sort((a, b) => new Date(b.dateLivraisonEffective!).getTime() - new Date(a.dateLivraisonEffective!).getTime())[0];
                              return (
                                <div className="flex flex-col items-start gap-1.5 min-w-[130px]">
                                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                                  {bls.length > 0 && (
                                    <div className="w-full space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1 text-teal-700 font-medium">
                                          <Truck className="h-3 w-3" />
                                          {bls.length} BL
                                        </span>
                                        <span className={`font-semibold ${pct >= 100 ? 'text-green-600' : 'text-orange-600'}`}>{totalLivree}<span className="text-gray-400 font-normal">/{totalCmd}</span></span>
                                      </div>
                                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
                                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-teal-400' : 'bg-gray-300'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                      </div>
                                      {lastDelivery?.dateLivraisonEffective && (
                                        <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                          <Calendar className="h-2.5 w-2.5" />
                                          {new Date(lastDelivery.dateLivraisonEffective).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatMontant(c.totalTTC)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Tooltip content="Voir les détails">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const fullCommande = await commerceApi.getCommande(c.id);
                                      setViewingDocument({ type: 'commande', document: fullCommande });
                                    } catch {
                                      toast.error('Erreur lors du chargement de la commande');
                                    }
                                  }}
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
                              {canManage && c.statut === 'BROUILLON' && (
                                <Tooltip content="Modifier la commande">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={async () => {
                                      try {
                                        const fullCommande = await commerceApi.getCommande(c.id);
                                        setEditingCommandeId(c.id);
                                        setCommandeForm({
                                          clientId: fullCommande.clientId,
                                          siteId: fullCommande.siteId || undefined,
                                          typeDocument: fullCommande.typeDocument || 'PRODUIT',
                                          devisId: fullCommande.devisId || undefined,
                                          dateCommande: fullCommande.dateCommande?.split('T')[0],
                                          dateLivraisonSouhaitee: fullCommande.dateLivraisonSouhaitee?.split('T')[0],
                                          notes: fullCommande.notes || '',
                                          conditions: fullCommande.conditions || '',
                                          remiseGlobalPct: fullCommande.remiseGlobalPct || 0,
                                          remiseGlobalMontant: fullCommande.remiseGlobalMontant || 0,
                                          lignes: fullCommande.lignes?.map((l: any) => ({
                                            produitServiceId: l.produitServiceId || undefined,
                                            libelle: l.libelle || '',
                                            description: l.description || '',
                                            quantite: l.quantite || 1,
                                            unite: l.unite || '',
                                            prixUnitaireHT: l.prixUnitaireHT || 0,
                                            tauxTVA: l.tauxTVA ?? 19,
                                            remisePct: l.remisePct || 0,
                                          })) || [{ ...EMPTY_LINE }],
                                        });
                                        setShowCommandeDialog(true);
                                      } catch {
                                        toast.error('Erreur lors du chargement de la commande');
                                      }
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && c.statut === 'BROUILLON' && (
                                <Tooltip content="Valider la commande">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => {
                                      setValidationCommandeForm({
                                        refBonCommandeClient: c.refBonCommandeClient || '',
                                        dateCommande: c.dateCommande?.split('T')[0] || new Date().toISOString().split('T')[0],
                                        dateLivraisonSouhaitee: c.dateLivraisonSouhaitee?.split('T')[0] || '',
                                        notes: c.notes || '',
                                        conditions: c.conditions || '',
                                      });
                                      setValidationCommandeDialog(c);
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && c.statut !== 'BROUILLON' && !convertedCommandeIds.has(c.id) && (
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
                              {canManage && c.statut !== 'BROUILLON' && c.statut !== 'ANNULEE' && (
                                <Tooltip content="Créer un bon de livraison">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => creerBLFromCommande(c.id)}
                                  >
                                    <Truck className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && canDeleteCommande(c.id) && (
                                <Tooltip content="Supprimer">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setDeleteTarget({ type: 'commande', item: c })}
                                  >
                                    <Trash2 className="h-4 w-4" />
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
            </div>
          </div>
        </TabsContent>

        {/* BONS DE LIVRAISON TAB */}
        <TabsContent value="bons-livraison">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-gray-900">{filteredBL.length} bon{filteredBL.length > 1 ? 's' : ''} de livraison</p>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  {(['all', 'SERVICE', 'PRODUIT'] as const).map((t) => (
                    <button key={t} onClick={() => setTypeFilterBL(t)} className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${typeFilterBL === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                      {t === 'all' ? 'Tous' : t === 'SERVICE' ? 'Service' : 'Produit'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedBL.size > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                    <SquareCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-700">{selectedBL.size} sélectionné{selectedBL.size > 1 ? 's' : ''}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-blue-600 hover:bg-blue-100" onClick={async () => {
                      const ids = [...selectedBL].filter(id => filteredBL.find(b => b.id === id)?.statut === 'BROUILLON');
                      await Promise.all(ids.map(id => commerceApi.validerBonLivraison(id)));
                      queryClient.invalidateQueries({ queryKey: ['commerce', 'bons-livraison'] });
                      setSelectedBL(new Set());
                      toast.success(`${ids.length} BL confirmé${ids.length > 1 ? 's' : ''}`);
                    }}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Confirmer
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-600 hover:bg-red-50" onClick={async () => {
                      const ids = [...selectedBL];
                      await Promise.all(ids.map(id => commerceApi.deleteBonLivraison(id)));
                      queryClient.invalidateQueries({ queryKey: ['commerce', 'bons-livraison'] });
                      setSelectedBL(new Set());
                      toast.success(`${ids.length} BL supprimé${ids.length > 1 ? 's' : ''}`);
                    }}>
                      <Trash2 className="h-3 w-3 mr-1" />Supprimer
                    </Button>
                    <button className="text-gray-400 hover:text-gray-600 text-xs" onClick={() => setSelectedBL(new Set())}>✕</button>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                  <Input placeholder="Rechercher..." value={searchBL} onChange={(e) => setSearchBL(e.target.value)} className="pl-8 h-8 w-48 text-sm border-gray-200" />
                </div>
                <Select value={statusFilterBL} onValueChange={setStatusFilterBL}>
                  <SelectTrigger className="h-8 w-36 text-xs border-gray-200"><SelectValue placeholder="Statut" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="BROUILLON">Brouillon</SelectItem>
                    <SelectItem value="CONFIRME">Confirmé</SelectItem>
                    <SelectItem value="LIVRE">Livré</SelectItem>
                    <SelectItem value="ANNULE">Annulé</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBL} onValueChange={setSortBL}>
                  <SelectTrigger className="h-8 w-36 text-xs border-gray-200">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Plus récent</SelectItem>
                    <SelectItem value="oldest">Plus ancien</SelectItem>
                    <SelectItem value="client-az">Client A-Z</SelectItem>
                    <SelectItem value="ref-az">Référence A-Z</SelectItem>
                  </SelectContent>
                </Select>
                {canManage && (
                  <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-200" onClick={() => {
                    setBLForm({ clientId: '', lignes: [] });
                    setBLFromCommandeId(null);
                    setBLProgression(null);
                    setShowBLDialog(true);
                  }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Nouveau BL
                  </Button>
                )}
              </div>
            </div>
            <div>
              {blLoading ? (
                <div className="py-12 text-center"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-xs text-gray-400">Chargement...</p></div>
              ) : filteredBL.length === 0 ? (
                <div className="py-12 text-center"><Truck className="h-8 w-8 text-gray-200 mx-auto mb-2"/><p className="text-sm text-gray-400">{searchBL ? 'Aucun BL trouvé' : 'Aucun bon de livraison'}</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox checked={filteredBL.length > 0 && filteredBL.every(b => selectedBL.has(b.id))} onCheckedChange={(checked) => {
                            if (checked) setSelectedBL(new Set(filteredBL.map(b => b.id)));
                            else setSelectedBL(new Set());
                          }} />
                        </TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="hidden md:table-cell">Commande</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead className="hidden lg:table-cell">Livraison</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBL
                        .slice()
                        .sort((a, b) => {
                          if (sortBL === 'oldest') return new Date(a.dateBonLivraison).getTime() - new Date(b.dateBonLivraison).getTime();
                          if (sortBL === 'client-az') return (a.client?.nomEntreprise || '').localeCompare(b.client?.nomEntreprise || '');
                          if (sortBL === 'ref-az') return a.ref.localeCompare(b.ref);
                          return new Date(b.dateBonLivraison).getTime() - new Date(a.dateBonLivraison).getTime();
                        })
                        .map((bl) => {
                          const totalCmd = (bl.lignes || []).reduce((s, l) => s + (l.quantiteCommandee || 0), 0);
                          const totalLivree = (bl.lignes || []).reduce((s, l) => s + l.quantiteLivree, 0);
                          const pct = totalCmd > 0 ? Math.round((totalLivree / totalCmd) * 100) : (totalLivree > 0 ? 100 : 0);
                          return (
                          <TableRow key={bl.id} className={`cursor-pointer hover:bg-gray-50 ${selectedBL.has(bl.id) ? 'bg-blue-50' : ''}`} onClick={async () => {
                            openBLDetail(bl.id);
                          }}>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={selectedBL.has(bl.id)} onCheckedChange={(checked) => {
                                const next = new Set(selectedBL);
                                if (checked) next.add(bl.id); else next.delete(bl.id);
                                setSelectedBL(next);
                              }} />
                            </TableCell>
                            <TableCell className="font-medium text-gray-900">{bl.ref}</TableCell>
                            <TableCell>
                              <span className="font-medium text-gray-800">{bl.client?.nomEntreprise || '-'}</span>
                              {bl.site && <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5"><MapPin className="h-3 w-3" />{bl.site.nom}</p>}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {bl.commande
                                ? <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{bl.commande.ref}</span>
                                : <span className="text-gray-400 text-xs">—</span>}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">
                              <p className="text-gray-600">{new Date(bl.dateBonLivraison).toLocaleDateString('fr-FR')}</p>
                              {bl.dateLivraisonEffective && (
                                <p className="text-xs text-green-600 font-medium flex items-center gap-0.5 mt-0.5">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {new Date(bl.dateLivraisonEffective).toLocaleDateString('fr-FR')}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {totalCmd > 0 ? (
                                <div className="min-w-[120px]">
                                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>{totalLivree} / {totalCmd}</span>
                                    <span className="font-semibold text-gray-700">{pct}%</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                  </div>
                                </div>
                              ) : <span className="text-gray-400 text-xs">—</span>}
                            </TableCell>
                            <TableCell>{blStatusBadge(bl.statut)}</TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <Tooltip content="Voir les détails">
                                  <Button variant="ghost" size="sm" onClick={() => openBLDetail(bl.id)}><Eye className="h-4 w-4" /></Button>
                                </Tooltip>
                                <Tooltip content="Télécharger PDF">
                                  <Button variant="ghost" size="sm" onClick={() => commerceApi.downloadBonLivraisonPdf(bl.id).catch(() => toast.error('Erreur'))}><FileDown className="h-4 w-4" /></Button>
                                </Tooltip>
                                {canManage && bl.statut === 'BROUILLON' && (
                                  <Tooltip content="Confirmer">
                                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => validerBLMutation.mutate(bl.id)}>
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  </Tooltip>
                                )}
                                {canManage && bl.statut === 'CONFIRME' && (
                                  <Tooltip content="Marquer livré">
                                    <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => livrerBLMutation.mutate(bl.id)}>
                                      <PackageCheck className="h-4 w-4" />
                                    </Button>
                                  </Tooltip>
                                )}
                                {canManage && (bl.statut === 'BROUILLON' || bl.statut === 'CONFIRME') && (
                                  <Tooltip content="Annuler">
                                    <Button variant="ghost" size="sm" className="text-orange-500 hover:text-orange-600 hover:bg-orange-50" onClick={() => annulerBLMutation.mutate(bl.id)}>
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </Tooltip>
                                )}
                                {canManage && bl.statut === 'BROUILLON' && (
                                  <Tooltip content="Supprimer">
                                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteBLMutation.mutate(bl.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* FACTURES TAB */}
        <TabsContent value="factures">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-gray-900">{filteredFactures.length} facture{filteredFactures.length > 1 ? 's' : ''}</p>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  {(['all', 'SERVICE', 'PRODUIT'] as const).map((t) => (
                    <button key={t} onClick={() => setTypeFilterFactures(t)} className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${typeFilterFactures === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                      {t === 'all' ? 'Tous' : t === 'SERVICE' ? 'Service' : 'Produit'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedFactures.size > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                    <SquareCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-700">{selectedFactures.size} sélectionné{selectedFactures.size > 1 ? 's' : ''}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-600 hover:bg-red-50" onClick={async () => {
                      const ids = [...selectedFactures];
                      await Promise.all(ids.map(id => commerceApi.deleteFacture(id)));
                      queryClient.invalidateQueries({ queryKey: ['commerce', 'factures'] });
                      setSelectedFactures(new Set());
                      toast.success(`${ids.length} facture${ids.length > 1 ? 's' : ''} supprimée${ids.length > 1 ? 's' : ''}`);
                    }}>
                      <Trash2 className="h-3 w-3 mr-1" />Supprimer
                    </Button>
                    <button className="text-gray-400 hover:text-gray-600 text-xs" onClick={() => setSelectedFactures(new Set())}>✕</button>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                  <Input placeholder="Rechercher..." value={searchFactures} onChange={(e) => setSearchFactures(e.target.value)} className="pl-8 h-8 w-44 text-sm border-gray-200" />
                </div>
                <Select value={statusFilterFactures} onValueChange={setStatusFilterFactures}>
                  <SelectTrigger className="h-8 w-44 text-xs border-gray-200">
                    <SelectValue placeholder="Tous statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="BROUILLON">Brouillon</SelectItem>
                    <SelectItem value="VALIDEE">Validée</SelectItem>
                    <SelectItem value="EN_RETARD">En retard</SelectItem>
                    <SelectItem value="PARTIELLEMENT_PAYEE">Part. payée</SelectItem>
                    <SelectItem value="EN_ATTENTE_ENCAISSEMENT">En att. encaissement</SelectItem>
                    <SelectItem value="PAYEE">Payée</SelectItem>
                    <SelectItem value="ANNULEE">Annulée</SelectItem>
                  </SelectContent>
                </Select>
                  <Select value={sortFactures} onValueChange={setSortFactures}>
                    <SelectTrigger className="w-[160px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Trier par..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Plus récent</SelectItem>
                      <SelectItem value="oldest">Plus ancien</SelectItem>
                      <SelectItem value="client-az">Client A-Z</SelectItem>
                      <SelectItem value="client-za">Client Z-A</SelectItem>
                      <SelectItem value="montant-desc">Montant ↓</SelectItem>
                      <SelectItem value="montant-asc">Montant ↑</SelectItem>
                      <SelectItem value="ref-az">Référence A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                  {canManage && (
                    <Button onClick={() => setShowFactureDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Nouvelle facture</span>
                    </Button>
                  )}
                </div>
              </div>
            <div>
              {facturesLoading ? (
                <div className="py-12 text-center"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-xs text-gray-400">Chargement...</p></div>
              ) : filteredFactures.length === 0 ? (
                <div className="py-12 text-center"><Receipt className="h-8 w-8 text-gray-200 mx-auto mb-2"/><p className="text-sm text-gray-400">{searchFactures ? 'Aucune facture trouvée' : 'Aucune facture'}</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox checked={filteredFactures.length > 0 && filteredFactures.every(f => selectedFactures.has(f.id))} onCheckedChange={(checked) => {
                            if (checked) setSelectedFactures(new Set(filteredFactures.map(f => f.id)));
                            else setSelectedFactures(new Set());
                          }} />
                        </TableHead>
                        <TableHead className="w-32">Référence</TableHead>
                        <TableHead className="w-24">Type</TableHead>
                        <TableHead className="min-w-[160px]">Client</TableHead>
                        <TableHead className="hidden md:table-cell min-w-[140px]">Site</TableHead>
                        <TableHead className="hidden md:table-cell w-28">Date</TableHead>
                        <TableHead className="w-32">Statut</TableHead>
                        <TableHead className="text-right w-32">Total TTC</TableHead>
                        <TableHead className="text-right hidden lg:table-cell w-28">Payé</TableHead>
                        <TableHead className="w-36"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortDocuments(filteredFactures, sortFactures).map((f) => (
                        <TableRow
                          key={f.id}
                          className={`cursor-pointer hover:bg-gray-50 ${selectedFactures.has(f.id) ? 'bg-blue-50' : ''}`}
                          onClick={async () => {
                            try {
                              const fullFacture = await commerceApi.getFacture(f.id);
                              setViewingDocument({ type: 'facture', document: fullFacture });
                            } catch {
                              toast.error('Erreur lors du chargement de la facture');
                            }
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedFactures.has(f.id)} onCheckedChange={(checked) => {
                              const next = new Set(selectedFactures);
                              if (checked) next.add(f.id); else next.delete(f.id);
                              setSelectedFactures(next);
                            }} />
                          </TableCell>
                          <TableCell className="font-medium">{f.ref}</TableCell>
                          <TableCell>
                            {f.typeDocument ? (
                              <Badge className={f.typeDocument === 'SERVICE'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                              }>
                                {f.typeDocument === 'SERVICE' ? 'Service' : 'Produit'}
                              </Badge>
                            ) : f.type === 'AVOIR' ? (
                              <Badge variant="secondary">Avoir</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{f.client?.nomEntreprise || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {f.site ? (
                              <span className="text-sm flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {f.site.nom}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{formatDate(f.dateFacture)}</TableCell>
                          <TableCell>{statusBadge(f.statut)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatMontant(f.totalTTC)}</TableCell>
                          <TableCell className="text-right hidden lg:table-cell text-muted-foreground">{formatMontant(f.totalPaye)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Tooltip content="Voir les détails">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const fullFacture = await commerceApi.getFacture(f.id);
                                      setViewingDocument({ type: 'facture', document: fullFacture });
                                    } catch {
                                      toast.error('Erreur lors du chargement de la facture');
                                    }
                                  }}
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
                              {canManage && f.statut === 'BROUILLON' && (
                                <Tooltip content="Modifier la facture">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={async () => {
                                      try {
                                        const fullFacture = await commerceApi.getFacture(f.id);
                                        setEditingFactureId(f.id);
                                        setFactureForm({
                                          clientId: fullFacture.clientId,
                                          siteId: fullFacture.siteId || undefined,
                                          typeDocument: fullFacture.typeDocument || 'PRODUIT',
                                          devisId: fullFacture.devisId || undefined,
                                          commandeId: fullFacture.commandeId || undefined,
                                          dateFacture: fullFacture.dateFacture?.split('T')[0] || new Date().toISOString().split('T')[0],
                                          delaiPaiementJours: fullFacture.delaiPaiementJours ?? 45,
                                          notes: fullFacture.notes || '',
                                          conditions: fullFacture.conditions || '',
                                          mentionSpeciale: fullFacture.mentionSpeciale || '',
                                          type: fullFacture.type || 'FACTURE',
                                          remiseGlobalPct: fullFacture.remiseGlobalPct || 0,
                                          remiseGlobalMontant: fullFacture.remiseGlobalMontant || 0,
                                          lignes: fullFacture.lignes?.map((l: any) => ({
                                            produitServiceId: l.produitServiceId || undefined,
                                            libelle: l.libelle || '',
                                            description: l.description || '',
                                            quantite: l.quantite || 1,
                                            unite: l.unite || '',
                                            prixUnitaireHT: l.prixUnitaireHT || 0,
                                            tauxTVA: l.tauxTVA ?? 19,
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
                                    onClick={async () => {
                                      try {
                                        const fullFacture = await commerceApi.getFacture(f.id);
                                        setValidationFactureForm({
                                          delaiPaiementJours: fullFacture.delaiPaiementJours ?? 45,
                                          dateFacture: fullFacture.dateFacture?.split('T')[0] || new Date().toISOString().split('T')[0],
                                          notes: fullFacture.notes || '',
                                          conditions: fullFacture.conditions || '',
                                        });
                                        setValidationFactureDialog(fullFacture);
                                      } catch {
                                        toast.error('Erreur lors du chargement de la facture');
                                      }
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && f.statut !== 'PAYEE' && f.statut !== 'BROUILLON' && f.statut !== 'EN_ATTENTE_ENCAISSEMENT' && (
                                <Tooltip content="Enregistrer un paiement">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => {
                                      setPaiementFacture(f);
                                      const remaining = Math.max(0, f.totalTTC - (f.totalPaye || 0) - (f.totalEnAttente || 0));
                                      setPaiementForm({
                                        ...paiementForm,
                                        montant: remaining,
                                        emetteur: f.client?.nomEntreprise || '',
                                      });
                                    }}
                                  >
                                    <Banknote className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
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
                              {canManage && (f.statut === 'BROUILLON' || f.statut === 'VALIDEE') && (
                                <Tooltip content="Supprimer">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setDeleteTarget({ type: 'facture', item: f })}
                                  >
                                    <Trash2 className="h-4 w-4" />
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
            </div>
          </div>
        </TabsContent>

      </Tabs>

      {/* ── Sheet détail BL ─────────────────────────────────────────────────── */}
      <Sheet open={!!viewingBL} onOpenChange={(open) => { if (!open) { setViewingBL(null); setViewingBLProgression(null); } }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {viewingBL && (() => {
            const lignes = viewingBL.lignes || [];
            // Cumulative totals from commande progression (all BLs), fallback to this BL only
            const prog = viewingBLProgression;
            const totalCmd = prog
              ? prog.lignes.reduce((s, l) => s + l.quantiteCommandee, 0)
              : lignes.reduce((s, l) => s + (l.quantiteCommandee || 0), 0);
            const totalLivree = prog
              ? prog.lignes.reduce((s, l) => s + l.quantiteDejaLivree, 0)
              : lignes.reduce((s, l) => s + l.quantiteLivree, 0);
            const totalRestante = Math.max(0, totalCmd - totalLivree);
            const pct = totalCmd > 0 ? Math.round((totalLivree / totalCmd) * 100) : (totalLivree > 0 ? 100 : 0);
            // This BL's own contribution
            const thisBLLivree = lignes.reduce((s, l) => s + l.quantiteLivree, 0);
            return (
            <>
              <SheetHeader className="mb-5">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-green-600" />
                  {viewingBL.ref}
                  <span className="ml-1">{blStatusBadge(viewingBL.statut)}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-5 text-sm">

                {/* Section client */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Client</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Entreprise</p>
                      <p className="font-semibold text-gray-900">{viewingBL.client?.nomEntreprise || '—'}</p>
                    </div>
                    {viewingBL.site && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Site</p>
                        <p className="font-medium text-gray-800 flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-gray-400" />{viewingBL.site.nom}</p>
                        {viewingBL.site.ville && <p className="text-xs text-gray-400">{viewingBL.site.ville}</p>}
                      </div>
                    )}
                    {viewingBL.adresseLivraison && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 mb-0.5">Adresse de livraison</p>
                        <p className="text-gray-700">{[viewingBL.adresseLivraison.adresse, viewingBL.adresseLivraison.codePostal, viewingBL.adresseLivraison.ville].filter(Boolean).join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section commande & dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-500 mb-1">Commande liée</p>
                    <p className="font-semibold text-blue-800">{viewingBL.commande?.ref || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Date BL</p>
                    <p className="font-semibold text-gray-800">{new Date(viewingBL.dateBonLivraison).toLocaleDateString('fr-FR')}</p>
                  </div>
                  {viewingBL.dateLivraisonEffective && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-500 mb-1">Date livraison effective</p>
                      <p className="font-semibold text-green-800">{new Date(viewingBL.dateLivraisonEffective).toLocaleDateString('fr-FR')}</p>
                    </div>
                  )}
                  {viewingBL.createdBy && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Créé par</p>
                      <p className="font-medium text-gray-700">{viewingBL.createdBy.prenom} {viewingBL.createdBy.nom}</p>
                    </div>
                  )}
                </div>

                {/* Progression — cumulative commande */}
                {totalCmd > 0 && (
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        {prog ? 'Progression commande (cumulée)' : 'Progression livraison'}
                      </p>
                      <span className={`text-sm font-bold ${pct >= 100 ? 'text-green-600' : 'text-teal-600'}`}>{pct}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-400 mb-0.5">Commandée</p>
                        <p className="font-bold text-gray-800 text-xl">{totalCmd}</p>
                      </div>
                      <div className="bg-teal-50 rounded-lg p-2">
                        <p className="text-[10px] text-teal-500 mb-0.5">Total livré</p>
                        <p className="font-bold text-teal-700 text-xl">{totalLivree}</p>
                        {prog && thisBLLivree > 0 && (
                          <p className="text-[10px] text-teal-400">dont {thisBLLivree} ce BL</p>
                        )}
                      </div>
                      <div className={`rounded-lg p-2 ${totalRestante > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                        <p className={`text-[10px] mb-0.5 ${totalRestante > 0 ? 'text-orange-400' : 'text-green-400'}`}>Restant</p>
                        <p className={`font-bold text-xl ${totalRestante > 0 ? 'text-orange-700' : 'text-green-600'}`}>{totalRestante > 0 ? totalRestante : '✓'}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-teal-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )}

                {/* Notes */}
                {viewingBL.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{viewingBL.notes}</span>
                  </div>
                )}

                {/* Lignes — with cumulative data from commande progression */}
                {(lignes.length > 0 || (prog && prog.lignes.length > 0)) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Lignes {prog ? '(total cumulé par ligne)' : `(${lignes.length})`}
                    </p>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600">Désignation</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-500">Cmd.</th>
                            <th className="px-3 py-2 text-center font-semibold text-teal-600">Total livré</th>
                            {prog && <th className="px-3 py-2 text-center font-semibold text-blue-500">Ce BL</th>}
                            <th className="px-3 py-2 text-center font-semibold text-orange-500">Restant</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-400">Unt.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(prog ? prog.lignes : lignes.map(l => ({
                            commandeLigneId: '',
                            libelle: l.libelle || '',
                            quantiteCommandee: l.quantiteCommandee || 0,
                            quantiteDejaLivree: l.quantiteLivree,
                            quantiteRestante: Math.max(0, (l.quantiteCommandee || 0) - l.quantiteLivree),
                          }))).map((pl, i) => {
                            const thisBLLigne = prog ? lignes.find(l => l.commandeLigneId === pl.commandeLigneId) : null;
                            const linePct = pl.quantiteCommandee > 0 ? Math.round((pl.quantiteDejaLivree / pl.quantiteCommandee) * 100) : 0;
                            return (
                              <tr key={i} className={`border-t ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                <td className="px-3 py-2">
                                  <p className="font-medium text-gray-900">{pl.libelle}</p>
                                  {pl.quantiteCommandee > 0 && (
                                    <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden w-full max-w-[80px]">
                                      <div className={`h-full rounded-full ${linePct >= 100 ? 'bg-green-400' : 'bg-teal-400'}`} style={{ width: `${Math.min(linePct, 100)}%` }} />
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center text-gray-500">{pl.quantiteCommandee || '—'}</td>
                                <td className="px-3 py-2 text-center font-semibold text-teal-700">{pl.quantiteDejaLivree}</td>
                                {prog && <td className="px-3 py-2 text-center text-blue-600">{thisBLLigne?.quantiteLivree ?? 0}</td>}
                                <td className="px-3 py-2 text-center font-semibold">
                                  <span className={pl.quantiteRestante > 0 ? 'text-orange-600' : 'text-green-600'}>
                                    {pl.quantiteRestante > 0 ? pl.quantiteRestante : '✓'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center text-gray-400">
                                  {(prog ? null : lignes[i]?.unite) || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 flex-wrap border-t pt-4">
                  <Button size="sm" variant="outline" onClick={() => commerceApi.downloadBonLivraisonPdf(viewingBL.id).catch(() => toast.error('Erreur'))}>
                    <FileDown className="h-4 w-4 mr-1" />PDF
                  </Button>
                  {canManage && viewingBL.statut === 'BROUILLON' && (
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => validerBLMutation.mutate(viewingBL.id)}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />Confirmer
                    </Button>
                  )}
                  {canManage && viewingBL.statut === 'CONFIRME' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => livrerBLMutation.mutate(viewingBL.id)}>
                      <PackageCheck className="h-4 w-4 mr-1" />Marquer livré
                    </Button>
                  )}
                  {canManage && (viewingBL.statut === 'BROUILLON' || viewingBL.statut === 'CONFIRME') && (
                    <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => annulerBLMutation.mutate(viewingBL.id)}>
                      <XCircle className="h-4 w-4 mr-1" />Annuler
                    </Button>
                  )}
                  {canManage && viewingBL.statut === 'BROUILLON' && (
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => deleteBLMutation.mutate(viewingBL.id)}>
                      <Trash2 className="h-4 w-4 mr-1" />Supprimer
                    </Button>
                  )}
                </div>
              </div>
            </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ── Dialog création BL ───────────────────────────────────────────────── */}
      <Dialog open={showBLDialog} onOpenChange={(open) => {
        setShowBLDialog(open);
        if (!open) { setBLForm({ clientId: '', lignes: [] }); setBLFromCommandeId(null); setBLProgression(null); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-green-600" />
              Nouveau bon de livraison
              {blFromCommandeId && <span className="text-xs font-normal text-gray-500 ml-2">depuis commande</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!blFromCommandeId && (
              <div>
                <Label>Client *</Label>
                <Select value={blForm.clientId} onValueChange={(v) => setBLForm({ ...blForm, clientId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.nomEntreprise}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Date du BL</Label>
              <Input type="date" value={blForm.dateBonLivraison || new Date().toISOString().split('T')[0]} onChange={(e) => setBLForm({ ...blForm, dateBonLivraison: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={blForm.notes || ''} onChange={(e) => setBLForm({ ...blForm, notes: e.target.value })} rows={2} placeholder="Observations, instructions de livraison..." />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Lignes *</Label>
                {!blFromCommandeId && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setBLForm({ ...blForm, lignes: [...blForm.lignes, { libelle: '', quantiteLivree: 1, prixUnitaireHT: 0, tauxTVA: 0 }] })}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
                  </Button>
                )}
              </div>
              <div className="border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold">Désignation</th>
                      {blFromCommandeId && <th className="px-2 py-2 text-center font-semibold text-gray-500">Qté cmd.</th>}
                      {blFromCommandeId && <th className="px-2 py-2 text-center font-semibold text-gray-500">Déjà livrée</th>}
                      {blFromCommandeId && <th className="px-2 py-2 text-center font-semibold text-gray-500">Restante</th>}
                      <th className="px-2 py-2 text-center font-semibold text-blue-700">Qté à livrer</th>
                      {!blFromCommandeId && <th className="px-2 py-2 text-left font-semibold">Unité</th>}
                      {!blFromCommandeId && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {blForm.lignes.map((l, i) => {
                      const prog = blFromCommandeId && blProgression ? blProgression.lignes.find((p) => p.commandeLigneId === l.commandeLigneId) : null;
                      const restante = prog ? prog.quantiteRestante : null;
                      return (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1.5">
                            {blFromCommandeId ? (
                              <p className="font-medium">{l.libelle}</p>
                            ) : (
                              <Input value={l.libelle} onChange={(e) => {
                                const updated = [...blForm.lignes]; updated[i] = { ...updated[i], libelle: e.target.value };
                                setBLForm({ ...blForm, lignes: updated });
                              }} placeholder="Désignation" className="h-7 text-xs" />
                            )}
                          </td>
                          {blFromCommandeId && <td className="px-2 py-1.5 text-center text-gray-500">{l.quantiteCommandee ?? '—'}</td>}
                          {blFromCommandeId && <td className="px-2 py-1.5 text-center text-gray-500">{prog ? prog.quantiteDejaLivree : '—'}</td>}
                          {blFromCommandeId && <td className="px-2 py-1.5 text-center font-medium text-orange-600">{restante ?? '—'}</td>}
                          <td className="px-2 py-1.5">
                            <Input
                              type="number" min="0" max={restante ?? undefined}
                              value={l.quantiteLivree}
                              onChange={(e) => {
                                const updated = [...blForm.lignes];
                                updated[i] = { ...updated[i], quantiteLivree: parseFloat(e.target.value) || 0 };
                                setBLForm({ ...blForm, lignes: updated });
                              }}
                              className="h-7 text-xs w-20 text-center"
                            />
                          </td>
                          {!blFromCommandeId && (
                            <td className="px-2 py-1.5">
                              <Input value={l.unite || ''} onChange={(e) => {
                                const updated = [...blForm.lignes]; updated[i] = { ...updated[i], unite: e.target.value };
                                setBLForm({ ...blForm, lignes: updated });
                              }} placeholder="unité" className="h-7 text-xs w-16" />
                            </td>
                          )}
                          {!blFromCommandeId && (
                            <td className="px-2 py-1.5">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => {
                                setBLForm({ ...blForm, lignes: blForm.lignes.filter((_, j) => j !== i) });
                              }}><Trash2 className="h-3 w-3" /></Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowBLDialog(false)}>Annuler</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!blForm.clientId || blForm.lignes.length === 0 || createBLMutation.isPending}
              onClick={() => createBLMutation.mutate(blForm)}
            >
              {createBLMutation.isPending ? 'Création...' : 'Créer le BL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ DIALOGS ============ */}

      {/* Devis Dialog */}
      <Dialog open={showDevisDialog} onOpenChange={(open) => {
        setShowDevisDialog(open);
        if (!open) {
          setEditingDevisId(null);
          setDevisForm({ clientId: '', siteId: undefined, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }], dureeValiditeJours: 7 });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDevisId ? 'Modifier le devis' : 'Créer un devis'}</DialogTitle>
            <DialogDescription>
              {editingDevisId
                ? 'Modifiez les informations du devis en brouillon.'
                : 'Remplissez les informations pour créer un nouveau devis client.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Type de document - obligatoire pour nouveau devis */}
            {!editingDevisId && (
              <div className="space-y-2">
                <Label>Type de devis <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Si un site est sélectionné, charger la noteServiceDefaut
                      let newLignes = [{ ...EMPTY_LINE }];
                      if (devisForm.siteId && devisForm.clientId) {
                        const selectedClient = clients.find((c: Tiers) => c.id === devisForm.clientId);
                        const selectedSite = selectedClient?.sites?.find((s: any) => s.id === devisForm.siteId);
                        if (selectedSite?.noteServiceDefaut) {
                          newLignes = [{ ...EMPTY_LINE, description: selectedSite.noteServiceDefaut }];
                        }
                      }
                      setDevisForm({ ...devisForm, typeDocument: 'SERVICE', lignes: newLignes });
                    }}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      devisForm.typeDocument === 'SERVICE'
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        devisForm.typeDocument === 'SERVICE' ? "bg-purple-500" : "bg-gray-300"
                      )} />
                      <div>
                        <p className={cn("font-semibold", devisForm.typeDocument === 'SERVICE' && "text-purple-700")}>
                          Services
                        </p>
                        <p className="text-xs text-muted-foreground">Prestations, interventions, maintenance...</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevisForm({ ...devisForm, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }] })}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      devisForm.typeDocument === 'PRODUIT'
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        devisForm.typeDocument === 'PRODUIT' ? "bg-emerald-500" : "bg-gray-300"
                      )} />
                      <div>
                        <p className={cn("font-semibold", devisForm.typeDocument === 'PRODUIT' && "text-emerald-700")}>
                          Produits
                        </p>
                        <p className="text-xs text-muted-foreground">Matériel, équipements, consommables...</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Afficher le type pour un devis en modification */}
            {editingDevisId && devisForm.typeDocument && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Type:</span>
                <Badge className={devisForm.typeDocument === 'SERVICE' ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"}>
                  {devisForm.typeDocument === 'SERVICE' ? 'Services' : 'Produits'}
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client <span className="text-red-500">*</span></Label>
                <Select
                  value={devisForm.clientId}
                  onValueChange={(value) => setDevisForm({ ...devisForm, clientId: value, siteId: undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.filter((t: Tiers) => t.id && t.id !== '').map((t: Tiers) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nomEntreprise}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Site concerné <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
                <Select
                  value={devisForm.siteId || '__none__'}
                  onValueChange={(value) => {
                    const newSiteId = value === '__none__' ? undefined : value;
                    // Si c'est un devis SERVICE et qu'on sélectionne un site, pré-remplir les descriptions
                    if (devisForm.typeDocument === 'SERVICE' && newSiteId) {
                      const selectedClient = clients.find((c: Tiers) => c.id === devisForm.clientId);
                      const selectedSite = selectedClient?.sites?.find((s: any) => s.id === newSiteId);
                      if (selectedSite?.noteServiceDefaut) {
                        // Appliquer la note par défaut à toutes les lignes
                        const updatedLignes = devisForm.lignes.map(ligne => ({
                          ...ligne,
                          description: ligne.description || selectedSite.noteServiceDefaut,
                        }));
                        setDevisForm({ ...devisForm, siteId: newSiteId, lignes: updatedLignes });
                        return;
                      }
                    }
                    setDevisForm({ ...devisForm, siteId: newSiteId });
                  }}
                  disabled={!devisForm.clientId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={devisForm.clientId ? "Sélectionner un site" : "Sélectionnez d'abord un client"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun site spécifique</SelectItem>
                    {(() => {
                      const selectedClient = clients.find((c: Tiers) => c.id === devisForm.clientId);
                      return selectedClient?.sites?.filter((site: any) => site.id && site.id !== '').map((site: any) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.nom} {site.ville && `- ${site.ville}`}
                        </SelectItem>
                      )) || [];
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date du devis</Label>
                <Input
                  type="date"
                  value={devisForm.dateDevis || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDevisForm({ ...devisForm, dateDevis: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Durée de validité (jours)</Label>
                <Input
                  type="number"
                  min="1"
                  value={devisForm.dureeValiditeJours ?? 7}
                  onChange={(e) => setDevisForm({ ...devisForm, dureeValiditeJours: parseInt(e.target.value) || 7 })}
                />
              </div>
            </div>

            <LignesForm
              lignes={devisForm.lignes}
              setForm={setDevisForm}
              produitsList={produits}
              typeDocument={devisForm.typeDocument}
              noteServiceDefaut={(() => {
                if (devisForm.typeDocument !== 'SERVICE' || !devisForm.siteId || !devisForm.clientId) return null;
                const selectedClient = clients.find((c: Tiers) => c.id === devisForm.clientId);
                const selectedSite = selectedClient?.sites?.find((s: any) => s.id === devisForm.siteId);
                return selectedSite?.noteServiceDefaut || null;
              })()}
            />

            <TotalsDisplay totals={totalsDevis} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDevisDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                // Calculer la date de validité à partir de la date du devis + durée en jours
                const dateDevis = devisForm.dateDevis || new Date().toISOString().split('T')[0];
                const dureeJours = devisForm.dureeValiditeJours ?? 7;
                const dateValidite = new Date(dateDevis);
                dateValidite.setDate(dateValidite.getDate() + dureeJours);

                const { dureeValiditeJours, ...restForm } = devisForm;
                const payload = {
                  ...restForm,
                  dateDevis,
                  dateValidite: dateValidite.toISOString().split('T')[0],
                };

                if (editingDevisId) {
                  updateDevisMutation.mutate({ id: editingDevisId, payload });
                } else {
                  createDevisMutation.mutate(payload);
                }
              }}
              disabled={!devisForm.clientId || devisForm.lignes.length === 0 || (!editingDevisId && !devisForm.typeDocument) || createDevisMutation.isPending || updateDevisMutation.isPending}
            >
              {createDevisMutation.isPending || updateDevisMutation.isPending
                ? (editingDevisId ? 'Mise à jour...' : 'Création...')
                : (editingDevisId ? 'Enregistrer les modifications' : 'Créer le devis')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commande Dialog */}
      <Dialog open={showCommandeDialog} onOpenChange={(open) => {
        setShowCommandeDialog(open);
        if (!open) {
          setEditingCommandeId(null);
          setCommandeForm({ clientId: '', siteId: undefined, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }] });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCommandeId ? 'Modifier la commande' : 'Créer une commande'}</DialogTitle>
            <DialogDescription>
              {editingCommandeId
                ? 'Modifiez les informations de la commande en brouillon.'
                : 'Remplissez les informations pour créer une nouvelle commande client.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Type de document - obligatoire pour nouvelle commande */}
            {!editingCommandeId && (
              <div className="space-y-2">
                <Label>Type de commande <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Si un site est sélectionné, charger la noteServiceDefaut
                      let newLignes = [{ ...EMPTY_LINE }];
                      if (commandeForm.siteId && commandeForm.clientId) {
                        const selectedClient = clients.find((c: Tiers) => c.id === commandeForm.clientId);
                        const selectedSite = selectedClient?.sites?.find((s: any) => s.id === commandeForm.siteId);
                        if (selectedSite?.noteServiceDefaut) {
                          newLignes = [{ ...EMPTY_LINE, description: selectedSite.noteServiceDefaut }];
                        }
                      }
                      setCommandeForm({ ...commandeForm, typeDocument: 'SERVICE', lignes: newLignes });
                    }}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      commandeForm.typeDocument === 'SERVICE'
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        commandeForm.typeDocument === 'SERVICE' ? "bg-purple-500" : "bg-gray-300"
                      )} />
                      <div>
                        <p className={cn("font-semibold", commandeForm.typeDocument === 'SERVICE' && "text-purple-700")}>
                          Services
                        </p>
                        <p className="text-xs text-muted-foreground">Prestations, interventions, maintenance...</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommandeForm({ ...commandeForm, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }] })}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      commandeForm.typeDocument === 'PRODUIT'
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        commandeForm.typeDocument === 'PRODUIT' ? "bg-emerald-500" : "bg-gray-300"
                      )} />
                      <div>
                        <p className={cn("font-semibold", commandeForm.typeDocument === 'PRODUIT' && "text-emerald-700")}>
                          Produits
                        </p>
                        <p className="text-xs text-muted-foreground">Matériel, équipements, consommables...</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Afficher le type pour une commande en modification */}
            {editingCommandeId && commandeForm.typeDocument && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Type:</span>
                <Badge className={commandeForm.typeDocument === 'SERVICE' ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"}>
                  {commandeForm.typeDocument === 'SERVICE' ? 'Services' : 'Produits'}
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client <span className="text-red-500">*</span></Label>
                <Select
                  value={commandeForm.clientId}
                  onValueChange={(value) => setCommandeForm({ ...commandeForm, clientId: value, siteId: undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.filter((t: Tiers) => t.id && t.id !== '').map((t: Tiers) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nomEntreprise}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Site concerné <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
                <Select
                  value={commandeForm.siteId || '__none__'}
                  onValueChange={(value) => {
                    const newSiteId = value === '__none__' ? undefined : value;
                    // Si c'est une commande SERVICE et qu'on sélectionne un site, pré-remplir les descriptions
                    if (commandeForm.typeDocument === 'SERVICE' && newSiteId) {
                      const selectedClient = clients.find((c: Tiers) => c.id === commandeForm.clientId);
                      const selectedSite = selectedClient?.sites?.find((s: any) => s.id === newSiteId);
                      if (selectedSite?.noteServiceDefaut) {
                        // Appliquer la note par défaut à toutes les lignes
                        const updatedLignes = commandeForm.lignes.map(ligne => ({
                          ...ligne,
                          description: ligne.description || selectedSite.noteServiceDefaut,
                        }));
                        setCommandeForm({ ...commandeForm, siteId: newSiteId, lignes: updatedLignes });
                        return;
                      }
                    }
                    setCommandeForm({ ...commandeForm, siteId: newSiteId });
                  }}
                  disabled={!commandeForm.clientId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={commandeForm.clientId ? "Sélectionner un site" : "Sélectionnez d'abord un client"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun site spécifique</SelectItem>
                    {(() => {
                      const selectedClient = clients.find((c: Tiers) => c.id === commandeForm.clientId);
                      return selectedClient?.sites?.filter((site: any) => site.id && site.id !== '').map((site: any) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.nom} {site.ville && `- ${site.ville}`}
                        </SelectItem>
                      )) || [];
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de livraison souhaitée</Label>
                <Input
                  type="date"
                  value={commandeForm.dateLivraisonSouhaitee || ''}
                  onChange={(e) => setCommandeForm({ ...commandeForm, dateLivraisonSouhaitee: e.target.value })}
                />
              </div>
            </div>

            <LignesForm
              lignes={commandeForm.lignes}
              setForm={setCommandeForm}
              produitsList={produits}
              typeDocument={commandeForm.typeDocument}
              noteServiceDefaut={(() => {
                if (commandeForm.typeDocument === 'SERVICE' && commandeForm.siteId && commandeForm.clientId) {
                  const selectedClient = clients.find((c: Tiers) => c.id === commandeForm.clientId);
                  const selectedSite = selectedClient?.sites?.find((s: any) => s.id === commandeForm.siteId);
                  return selectedSite?.noteServiceDefaut || null;
                }
                return null;
              })()}
            />

            <TotalsDisplay totals={totalsCommande} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommandeDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (editingCommandeId) {
                  updateCommandeMutation.mutate({ id: editingCommandeId, payload: commandeForm });
                } else {
                  createCommandeMutation.mutate(commandeForm);
                }
              }}
              disabled={!commandeForm.clientId || commandeForm.lignes.length === 0 || createCommandeMutation.isPending || updateCommandeMutation.isPending}
            >
              {createCommandeMutation.isPending || updateCommandeMutation.isPending
                ? (editingCommandeId ? 'Mise à jour...' : 'Création...')
                : (editingCommandeId ? 'Enregistrer les modifications' : 'Créer la commande')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Facture Dialog */}
      <Dialog open={showFactureDialog} onOpenChange={(open) => {
        setShowFactureDialog(open);
        if (!open) {
          setEditingFactureId(null);
          setFactureForm({ clientId: '', siteId: undefined, typeDocument: 'PRODUIT', lignes: [{ ...EMPTY_LINE }], type: 'FACTURE', dateFacture: new Date().toISOString().split('T')[0], delaiPaiementJours: 45 });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFactureId ? 'Modifier la facture' : factureForm.type === 'AVOIR' ? 'Créer un avoir' : 'Créer une facture'}
            </DialogTitle>
            <DialogDescription>
              {editingFactureId
                ? 'Modifiez les informations de la facture en brouillon.'
                : factureForm.type === 'AVOIR'
                  ? 'Vérifiez et ajustez les lignes de l\'avoir avant de le valider.'
                  : 'Remplissez les informations pour créer une nouvelle facture client.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Type de prestation */}
            <div className="space-y-2">
              <Label>Type de prestation <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    let newLignes = factureForm.lignes;
                    if (!editingFactureId) {
                      newLignes = [{ ...EMPTY_LINE }];
                      if (factureForm.siteId && factureForm.clientId) {
                        const selectedClient = clients.find((c: Tiers) => c.id === factureForm.clientId);
                        const selectedSite = selectedClient?.sites?.find((s: any) => s.id === factureForm.siteId);
                        if (selectedSite?.noteServiceDefaut) {
                          newLignes = [{ ...EMPTY_LINE, description: selectedSite.noteServiceDefaut }];
                        }
                      }
                    }
                    setFactureForm({ ...factureForm, typeDocument: 'SERVICE', lignes: newLignes });
                  }}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    factureForm.typeDocument === 'SERVICE'
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      factureForm.typeDocument === 'SERVICE' ? "bg-purple-500" : "bg-gray-300"
                    )} />
                    <div>
                      <p className={cn("font-semibold", factureForm.typeDocument === 'SERVICE' && "text-purple-700")}>
                        Services
                      </p>
                      <p className="text-xs text-muted-foreground">Prestations, interventions, maintenance...</p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newLignes = editingFactureId ? factureForm.lignes : [{ ...EMPTY_LINE }];
                    setFactureForm({ ...factureForm, typeDocument: 'PRODUIT', lignes: newLignes });
                  }}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    factureForm.typeDocument === 'PRODUIT'
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      factureForm.typeDocument === 'PRODUIT' ? "bg-emerald-500" : "bg-gray-300"
                    )} />
                    <div>
                      <p className={cn("font-semibold", factureForm.typeDocument === 'PRODUIT' && "text-emerald-700")}>
                        Produits
                      </p>
                      <p className="text-xs text-muted-foreground">Matériel, équipements, consommables...</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client <span className="text-red-500">*</span></Label>
                <Select
                  value={factureForm.clientId}
                  onValueChange={(value) => setFactureForm({ ...factureForm, clientId: value, siteId: undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.filter((t: Tiers) => t.id && t.id !== '').map((t: Tiers) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nomEntreprise}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Site concerné <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
                <Select
                  value={factureForm.siteId || '__none__'}
                  onValueChange={(value) => {
                    const newSiteId = value === '__none__' ? undefined : value;
                    if (factureForm.typeDocument === 'SERVICE' && newSiteId) {
                      const selectedClient = clients.find((c: Tiers) => c.id === factureForm.clientId);
                      const selectedSite = selectedClient?.sites?.find((s: any) => s.id === newSiteId);
                      if (selectedSite?.noteServiceDefaut) {
                        const updatedLignes = factureForm.lignes.map(ligne => ({
                          ...ligne,
                          description: ligne.description || selectedSite.noteServiceDefaut,
                        }));
                        setFactureForm({ ...factureForm, siteId: newSiteId, lignes: updatedLignes });
                        return;
                      }
                    }
                    setFactureForm({ ...factureForm, siteId: newSiteId });
                  }}
                  disabled={!factureForm.clientId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={factureForm.clientId ? "Sélectionner un site" : "Sélectionnez d'abord un client"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun site spécifique</SelectItem>
                    {(() => {
                      const selectedClient = clients.find((c: Tiers) => c.id === factureForm.clientId);
                      return selectedClient?.sites?.filter((site: any) => site.id && site.id !== '').map((site: any) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.nom} {site.ville && `- ${site.ville}`}
                        </SelectItem>
                      )) || [];
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Facture ou Avoir</Label>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de facturation</Label>
                <Input
                  type="date"
                  value={factureForm.dateFacture || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFactureForm({ ...factureForm, dateFacture: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Date d'émission de la facture</p>
              </div>
              <div className="space-y-2">
                <Label>Délai de paiement (jours)</Label>
                <Input
                  type="number"
                  min="0"
                  value={factureForm.delaiPaiementJours ?? 45}
                  onChange={(e) => setFactureForm({ ...factureForm, delaiPaiementJours: parseInt(e.target.value) || 45 })}
                />
                <p className="text-xs text-muted-foreground">L'échéance sera calculée automatiquement</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mention spéciale (optionnel)</Label>
              <Input
                value={factureForm.mentionSpeciale || ''}
                onChange={(e) => setFactureForm({ ...factureForm, mentionSpeciale: e.target.value })}
                placeholder='Ex: Selon le bon de commande "1234" du 01/01/2026'
              />
              <p className="text-xs text-muted-foreground">
                Affichée en gras sur le PDF, à la place de la mention "Opération du..."
              </p>
            </div>

            <LignesForm
              lignes={factureForm.lignes}
              setForm={setFactureForm}
              produitsList={produits}
              typeDocument={factureForm.typeDocument as 'PRODUIT' | 'SERVICE' | undefined}
              noteServiceDefaut={(() => {
                if (factureForm.typeDocument !== 'SERVICE' || !factureForm.siteId || !factureForm.clientId) return null;
                const selectedClient = clients.find((c: Tiers) => c.id === factureForm.clientId);
                const selectedSite = selectedClient?.sites?.find((s: any) => s.id === factureForm.siteId);
                return selectedSite?.noteServiceDefaut || null;
              })()}
            />

            <TotalsDisplay totals={totalsFacture} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFactureDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (editingFactureId) {
                  updateFactureMutation.mutate({ id: editingFactureId, payload: factureForm });
                } else {
                  createFactureMutation.mutate(factureForm);
                }
              }}
              disabled={!factureForm.clientId || factureForm.lignes.length === 0 || createFactureMutation.isPending || updateFactureMutation.isPending}
            >
              {createFactureMutation.isPending || updateFactureMutation.isPending
                ? (editingFactureId ? 'Mise à jour...' : 'Création...')
                : editingFactureId
                  ? 'Enregistrer les modifications'
                  : factureForm.type === 'AVOIR'
                    ? 'Créer l\'avoir'
                    : 'Créer la facture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Devis Detail Dialog - Nouveau design premium */}
      <DevisDetailDialog
        open={viewingDocument?.type === 'devis'}
        devis={viewingDocument?.type === 'devis' ? viewingDocument.document : null}
        onClose={() => setViewingDocument(null)}
        canManage={canManage}
        canDelete={viewingDocument?.type === 'devis' ? canDeleteDevis(viewingDocument.document.id) : false}
        onValidate={() => {
          if (viewingDocument?.type === 'devis') {
            validerDevis.mutate(viewingDocument.document.id);
          }
        }}
        onConvert={() => {
          if (viewingDocument?.type === 'devis') {
            convertirDevis.mutate(viewingDocument.document.id);
          }
        }}
        onEdit={async () => {
          if (viewingDocument?.type !== 'devis') return;
          try {
            const fullDevis = await commerceApi.getDevis(viewingDocument.document.id);
            let dureeValiditeJours = 7;
            if (fullDevis.dateDevis && fullDevis.dateValidite) {
              const dateDevis = new Date(fullDevis.dateDevis);
              const dateValidite = new Date(fullDevis.dateValidite);
              dureeValiditeJours = Math.round((dateValidite.getTime() - dateDevis.getTime()) / (1000 * 60 * 60 * 24));
            }
            setEditingDevisId(viewingDocument.document.id);
            setDevisForm({
              clientId: fullDevis.clientId,
              dateDevis: fullDevis.dateDevis?.split('T')[0],
              dureeValiditeJours,
              notes: fullDevis.notes || '',
              conditions: fullDevis.conditions || '',
              remiseGlobalPct: fullDevis.remiseGlobalPct || 0,
              remiseGlobalMontant: fullDevis.remiseGlobalMontant || 0,
              lignes: fullDevis.lignes?.map((l: any) => ({
                produitServiceId: l.produitServiceId || undefined,
                libelle: l.libelle || '',
                description: l.description || '',
                quantite: l.quantite || 1,
                unite: l.unite || '',
                prixUnitaireHT: l.prixUnitaireHT || 0,
                tauxTVA: l.tauxTVA ?? 19,
                remisePct: l.remisePct || 0,
              })) || [{ ...EMPTY_LINE }],
            });
            setViewingDocument(null);
            setShowDevisDialog(true);
          } catch {
            toast.error('Erreur lors du chargement du devis');
          }
        }}
        onDelete={() => {
          if (viewingDocument?.type === 'devis') {
            deleteDevisMutation.mutate(viewingDocument.document.id);
          }
        }}
        onDownloadPdf={() => {
          if (viewingDocument?.type === 'devis') {
            commerceApi.downloadDevisPdf(viewingDocument.document.id).catch(() => toast.error('Erreur téléchargement'));
          }
        }}
        isValidating={validerDevis.isPending}
        isConverting={convertirDevis.isPending}
      />

      {/* Commande Detail Dialog - Design premium similaire à Devis */}
      <CommandeDetailDialog
        open={viewingDocument?.type === 'commande'}
        commande={viewingDocument?.type === 'commande' ? viewingDocument.document : null}
        onClose={() => setViewingDocument(null)}
        canManage={canManage}
        canDelete={viewingDocument?.type === 'commande' ? canDeleteCommande(viewingDocument.document.id) : false}
        onValidate={() => {
          if (viewingDocument?.type === 'commande') {
            const doc = viewingDocument.document;
            setValidationCommandeForm({
              refBonCommandeClient: doc.refBonCommandeClient || '',
              dateCommande: doc.dateCommande?.split('T')[0] || new Date().toISOString().split('T')[0],
              dateLivraisonSouhaitee: doc.dateLivraisonSouhaitee?.split('T')[0] || '',
              notes: doc.notes || '',
              conditions: doc.conditions || '',
            });
            setValidationCommandeDialog(doc);
          }
        }}
        onConvert={() => {
          if (viewingDocument?.type === 'commande' && !convertedCommandeIds.has(viewingDocument.document.id)) {
            convertirCommande.mutate(viewingDocument.document.id);
          }
        }}
        onEdit={async () => {
          if (viewingDocument?.type !== 'commande') return;
          try {
            const fullCommande = await commerceApi.getCommande(viewingDocument.document.id);
            setEditingCommandeId(viewingDocument.document.id);
            setCommandeForm({
              clientId: fullCommande.clientId,
              siteId: fullCommande.siteId || undefined,
              typeDocument: fullCommande.typeDocument || 'PRODUIT',
              devisId: fullCommande.devisId || undefined,
              dateCommande: fullCommande.dateCommande?.split('T')[0],
              dateLivraisonSouhaitee: fullCommande.dateLivraisonSouhaitee?.split('T')[0],
              notes: fullCommande.notes || '',
              conditions: fullCommande.conditions || '',
              remiseGlobalPct: fullCommande.remiseGlobalPct || 0,
              remiseGlobalMontant: fullCommande.remiseGlobalMontant || 0,
              lignes: fullCommande.lignes?.map((l: any) => ({
                produitServiceId: l.produitServiceId || undefined,
                libelle: l.libelle || '',
                description: l.description || '',
                quantite: l.quantite || 1,
                unite: l.unite || '',
                prixUnitaireHT: l.prixUnitaireHT || 0,
                tauxTVA: l.tauxTVA ?? 19,
                remisePct: l.remisePct || 0,
              })) || [{ ...EMPTY_LINE }],
            });
            setViewingDocument(null);
            setShowCommandeDialog(true);
          } catch {
            toast.error('Erreur lors du chargement de la commande');
          }
        }}
        onDelete={() => {
          if (viewingDocument?.type === 'commande') {
            deleteCommandeMutation.mutate(viewingDocument.document.id);
          }
        }}
        onDownloadPdf={() => {
          if (viewingDocument?.type === 'commande') {
            commerceApi.downloadCommandePdf(viewingDocument.document.id).catch(() => toast.error('Erreur téléchargement'));
          }
        }}
        isValidating={validerCommande.isPending}
        isConverting={convertirCommande.isPending}
        onCreateBL={viewingDocument?.type === 'commande' && canManage ? () => {
          const commandeId = viewingDocument.document.id;
          setViewingDocument(null);
          creerBLFromCommande(commandeId);
        } : undefined}
      />

      {/* Facture Detail Dialog - Design premium similaire à Devis/Commande */}
      <FactureDetailDialog
        open={viewingDocument?.type === 'facture'}
        facture={viewingDocument?.type === 'facture' ? viewingDocument.document : null}
        onClose={() => setViewingDocument(null)}
        canManage={canManage}
        canDelete={
          viewingDocument?.type === 'facture'
            ? (viewingDocument.document.statut === 'BROUILLON' || viewingDocument.document.statut === 'VALIDEE')
            : false
        }
        onValidate={() => {
          if (viewingDocument?.type === 'facture') {
            const doc = viewingDocument.document;
            setValidationFactureForm({
              delaiPaiementJours: doc.delaiPaiementJours ?? 45,
              dateFacture: doc.dateFacture?.split('T')[0] || new Date().toISOString().split('T')[0],
              notes: doc.notes || '',
              conditions: doc.conditions || '',
            });
            setValidationFactureDialog(doc);
          }
        }}
        onEdit={async () => {
          if (viewingDocument?.type !== 'facture') return;
          try {
            const fullFacture = await commerceApi.getFacture(viewingDocument.document.id);
            setEditingFactureId(viewingDocument.document.id);
            setFactureForm({
              clientId: fullFacture.clientId,
              siteId: fullFacture.siteId || undefined,
              typeDocument: fullFacture.typeDocument || 'PRODUIT',
              devisId: fullFacture.devisId || undefined,
              commandeId: fullFacture.commandeId || undefined,
              dateFacture: fullFacture.dateFacture?.split('T')[0] || new Date().toISOString().split('T')[0],
              delaiPaiementJours: fullFacture.delaiPaiementJours ?? 45,
              notes: fullFacture.notes || '',
              conditions: fullFacture.conditions || '',
              mentionSpeciale: fullFacture.mentionSpeciale || '',
              type: fullFacture.type || 'FACTURE',
              remiseGlobalPct: fullFacture.remiseGlobalPct || 0,
              remiseGlobalMontant: fullFacture.remiseGlobalMontant || 0,
              lignes: fullFacture.lignes?.map((l: any) => ({
                produitServiceId: l.produitServiceId || undefined,
                libelle: l.libelle || '',
                description: l.description || '',
                quantite: l.quantite || 1,
                unite: l.unite || '',
                prixUnitaireHT: l.prixUnitaireHT || 0,
                tauxTVA: l.tauxTVA ?? 19,
                remisePct: l.remisePct || 0,
              })) || [{ ...EMPTY_LINE }],
            });
            setViewingDocument(null);
            setShowFactureDialog(true);
          } catch {
            toast.error('Erreur lors du chargement de la facture');
          }
        }}
        onDelete={() => {
          if (viewingDocument?.type === 'facture') {
            setDeleteTarget({ type: 'facture', item: viewingDocument.document });
          }
        }}
        onDownloadPdf={() => {
          if (viewingDocument?.type === 'facture') {
            commerceApi.downloadFacturePdf(viewingDocument.document.id).catch(() => toast.error('Erreur téléchargement'));
          }
        }}
        onPayment={() => {
          if (viewingDocument?.type === 'facture') {
            const doc = viewingDocument.document;
            setPaiementFacture(doc);
            const remaining = Math.max(0, doc.totalTTC - (doc.totalPaye || 0) - (doc.totalEnAttente || 0));
            setPaiementForm({
              ...paiementForm,
              montant: remaining,
              emetteur: doc.client?.nomEntreprise || '',
            });
          }
        }}
        onRelance={() => {
          if (viewingDocument?.type === 'facture') {
            setRelanceFacture(viewingDocument.document);
          }
        }}
        onChequeAction={(paiementId, newStatut, label) => {
          setChequeActionDate(new Date().toISOString().split('T')[0]);
          setChequeActionModal({ paiementId, newStatut, label });
        }}
        onCreateAvoir={async () => {
          if (viewingDocument?.type !== 'facture') return;
          try {
            const fullFacture = await commerceApi.getFacture(viewingDocument.document.id);
            setEditingFactureId(null);
            setFactureForm({
              clientId: fullFacture.clientId,
              siteId: fullFacture.siteId || undefined,
              typeDocument: fullFacture.typeDocument || 'PRODUIT',
              type: 'AVOIR',
              dateFacture: new Date().toISOString().split('T')[0],
              delaiPaiementJours: fullFacture.delaiPaiementJours ?? 45,
              notes: `Avoir sur facture ${fullFacture.ref}`,
              conditions: fullFacture.conditions || '',
              remiseGlobalPct: fullFacture.remiseGlobalPct || 0,
              remiseGlobalMontant: fullFacture.remiseGlobalMontant || 0,
              lignes: fullFacture.lignes?.map((l: any) => ({
                produitServiceId: l.produitServiceId || undefined,
                libelle: l.libelle || '',
                description: l.description || '',
                quantite: l.quantite || 1,
                unite: l.unite || '',
                prixUnitaireHT: l.prixUnitaireHT || 0,
                tauxTVA: l.tauxTVA ?? 19,
                remisePct: l.remisePct || 0,
              })) || [{ ...EMPTY_LINE }],
            });
            setViewingDocument(null);
            setShowFactureDialog(true);
          } catch {
            toast.error('Erreur lors du chargement de la facture');
          }
        }}
        isValidating={validerFacture.isPending}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'devis' && (
                <>Êtes-vous sûr de vouloir supprimer le devis <strong>{deleteTarget.item.ref}</strong> ? Cette action est irréversible.</>
              )}
              {deleteTarget?.type === 'commande' && (
                <>Êtes-vous sûr de vouloir supprimer la commande <strong>{deleteTarget.item.ref}</strong> ? Cette action est irréversible.</>
              )}
              {deleteTarget?.type === 'facture' && (
                <>Êtes-vous sûr de vouloir supprimer la facture <strong>{deleteTarget.item.ref}</strong> ? Cette action est irréversible.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleteDevisMutation.isPending || deleteCommandeMutation.isPending || deleteFactureMutation.isPending}
            >
              {(deleteDevisMutation.isPending || deleteCommandeMutation.isPending || deleteFactureMutation.isPending)
                ? 'Suppression...'
                : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validation Devis Confirmation Dialog */}
      <AlertDialog open={!!validationTarget} onOpenChange={(open) => !open && setValidationTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              Valider le devis ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Vous allez valider ce devis. Une fois validé, il ne pourra plus être modifié.</p>
                {validationTarget && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Devis</span>
                      <span className="font-medium text-foreground">{validationTarget.ref}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client</span>
                      <span className="font-medium text-foreground">{validationTarget.client?.nomEntreprise || '-'}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total TTC</span>
                      <span className="font-bold text-emerald-600">{formatMontant(validationTarget.totalTTC)}</span>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (validationTarget) {
                  validerDevis.mutate(validationTarget.id);
                  setValidationTarget(null);
                }
              }}
              disabled={validerDevis.isPending}
            >
              {validerDevis.isPending ? 'Validation...' : 'Valider le devis'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conversion Devis Confirmation Dialog */}
      <AlertDialog open={!!conversionTarget} onOpenChange={(open) => !open && setConversionTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-blue-600">
              <ArrowRightLeft className="h-5 w-5" />
              Convertir en commande ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Vous allez convertir ce devis en commande client.</p>
                {conversionTarget && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Devis</span>
                      <span className="font-medium text-foreground">{conversionTarget.ref}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client</span>
                      <span className="font-medium text-foreground">{conversionTarget.client?.nomEntreprise || '-'}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total TTC</span>
                      <span className="font-bold text-emerald-600">{formatMontant(conversionTarget.totalTTC)}</span>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (conversionTarget) {
                  convertirDevis.mutate(conversionTarget.id);
                  setConversionTarget(null);
                }
              }}
              disabled={convertirDevis.isPending}
            >
              {convertirDevis.isPending ? 'Conversion...' : 'Convertir en commande'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <Dialog open={!!paiementFacture} onOpenChange={(open) => !open && setPaiementFacture(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-600" />
              Enregistrer un paiement
            </DialogTitle>
            <DialogDescription>
              Facture {paiementFacture?.ref} - Client: {paiementFacture?.client?.nomEntreprise}
            </DialogDescription>
          </DialogHeader>

          {paiementFacture && (
            <div className="space-y-6">
              {/* Récapitulatif facture */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant total TTC</span>
                  <span className="font-semibold">{formatMontant(paiementFacture.totalTTC)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Encaissé</span>
                  <span className="font-medium text-green-600">{formatMontant(paiementFacture.totalPaye || 0)}</span>
                </div>
                {(paiementFacture.totalEnAttente || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">En attente bancaire (chèques)</span>
                    <span className="font-medium text-amber-600">{formatMontant(paiementFacture.totalEnAttente)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="font-medium">Reste à payer</span>
                  <span className="font-bold text-primary">
                    {formatMontant(Math.max(0, paiementFacture.totalTTC - (paiementFacture.totalPaye || 0) - (paiementFacture.totalEnAttente || 0)))}
                  </span>
                </div>
              </div>

              {/* Formulaire de paiement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Montant du paiement <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={Math.max(0, paiementFacture.totalTTC - (paiementFacture.totalPaye || 0) - (paiementFacture.totalEnAttente || 0))}
                    value={paiementForm.montant}
                    onChange={(e) => setPaiementForm({ ...paiementForm, montant: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date du paiement</Label>
                  <Input
                    type="date"
                    value={paiementForm.datePaiement}
                    onChange={(e) => setPaiementForm({ ...paiementForm, datePaiement: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Émetteur du paiement
                </Label>
                <Input
                  value={paiementForm.emetteur}
                  onChange={(e) => setPaiementForm({ ...paiementForm, emetteur: e.target.value })}
                  placeholder="Nom de l'émetteur (par défaut: le client)"
                />
                <p className="text-xs text-muted-foreground">
                  Par défaut le client. Modifiez si le paiement provient d'une holding ou autre entité.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Mode de paiement <span className="text-red-500">*</span></Label>
                <Select
                  value={paiementForm.modePaiement}
                  onValueChange={(v) => setPaiementForm({ ...paiementForm, modePaiement: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ESPECES">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Espèces
                      </div>
                    </SelectItem>
                    <SelectItem value="CHEQUE">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Chèque
                      </div>
                    </SelectItem>
                    <SelectItem value="VIREMENT">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Virement bancaire
                      </div>
                    </SelectItem>
                    <SelectItem value="CARTE">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Carte bancaire
                      </div>
                    </SelectItem>
                    <SelectItem value="EFFET">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Effet de commerce
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Champs conditionnels pour chèque */}
              {paiementForm.modePaiement === 'CHEQUE' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Numéro de chèque
                    </Label>
                    <Input
                      value={paiementForm.reference}
                      onChange={(e) => setPaiementForm({ ...paiementForm, reference: e.target.value })}
                      placeholder="N° chèque"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Banque
                    </Label>
                    <Input
                      value={paiementForm.banque}
                      onChange={(e) => setPaiementForm({ ...paiementForm, banque: e.target.value })}
                      placeholder="Nom de la banque"
                    />
                  </div>
                </div>
              )}

              {/* Champs conditionnels pour virement */}
              {paiementForm.modePaiement === 'VIREMENT' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Référence virement
                    </Label>
                    <Input
                      value={paiementForm.reference}
                      onChange={(e) => setPaiementForm({ ...paiementForm, reference: e.target.value })}
                      placeholder="Réf. virement"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Banque émettrice
                    </Label>
                    <Input
                      value={paiementForm.banque}
                      onChange={(e) => setPaiementForm({ ...paiementForm, banque: e.target.value })}
                      placeholder="Banque du client"
                    />
                  </div>
                </div>
              )}

              {/* Champs conditionnels pour effet */}
              {paiementForm.modePaiement === 'EFFET' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Numéro d'effet
                    </Label>
                    <Input
                      value={paiementForm.reference}
                      onChange={(e) => setPaiementForm({ ...paiementForm, reference: e.target.value })}
                      placeholder="N° effet"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Banque
                    </Label>
                    <Input
                      value={paiementForm.banque}
                      onChange={(e) => setPaiementForm({ ...paiementForm, banque: e.target.value })}
                      placeholder="Banque domiciliataire"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={paiementForm.notes}
                  onChange={(e) => setPaiementForm({ ...paiementForm, notes: e.target.value })}
                  placeholder="Commentaires ou observations..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaiementFacture(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (paiementFacture && paiementForm.montant > 0) {
                  createPaiementMutation.mutate({
                    factureId: paiementFacture.id,
                    montant: paiementForm.montant,
                    datePaiement: paiementForm.datePaiement,
                    modePaiement: paiementForm.modePaiement,
                    reference: paiementForm.modePaiement === 'CHEQUE' ? paiementForm.reference || undefined : undefined,
                    banque: paiementForm.modePaiement === 'CHEQUE' ? paiementForm.banque || undefined : undefined,
                    notes: paiementForm.notes || undefined,
                  });
                }
              }}
              disabled={!paiementForm.montant || paiementForm.montant <= 0 || createPaiementMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createPaiementMutation.isPending ? 'Enregistrement...' : 'Enregistrer le paiement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog suivi chèque */}
      <Dialog open={!!chequeActionModal} onOpenChange={(open) => !open && setChequeActionModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              {chequeActionModal?.newStatut === 'DEPOSE' && 'Dépôt en banque'}
              {chequeActionModal?.newStatut === 'ENCAISSE' && 'Confirmation d\'encaissement'}
              {chequeActionModal?.newStatut === 'REJETE' && 'Chèque rejeté'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{chequeActionModal?.label}</Label>
              <Input
                type="date"
                value={chequeActionDate}
                onChange={(e) => setChequeActionDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChequeActionModal(null)}>Annuler</Button>
            <Button
              onClick={() => {
                if (chequeActionModal) {
                  updateStatutChequeMutation.mutate({
                    id: chequeActionModal.paiementId,
                    statut: chequeActionModal.newStatut,
                    date: chequeActionDate,
                  });
                }
              }}
              disabled={updateStatutChequeMutation.isPending}
              className={cn(
                chequeActionModal?.newStatut === 'REJETE' ? 'bg-red-600 hover:bg-red-700' :
                chequeActionModal?.newStatut === 'ENCAISSE' ? 'bg-green-600 hover:bg-green-700' : ''
              )}
            >
              {updateStatutChequeMutation.isPending ? 'Enregistrement...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog validation commande */}
      <Dialog open={!!validationCommandeDialog} onOpenChange={(open) => !open && setValidationCommandeDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Valider la commande {validationCommandeDialog?.ref}
            </DialogTitle>
            <DialogDescription>
              Vérifiez et modifiez les informations si nécessaire avant validation
            </DialogDescription>
          </DialogHeader>

          {validationCommandeDialog && (
            <div className="space-y-4">
              {/* Infos principales */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium">{validationCommandeDialog.client?.nomEntreprise}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Référence</p>
                  <p className="font-medium font-mono">{validationCommandeDialog.ref}</p>
                </div>
              </div>

              {/* Champs modifiables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de commande</Label>
                  <Input
                    type="date"
                    value={validationCommandeForm.dateCommande}
                    onChange={(e) => setValidationCommandeForm({ ...validationCommandeForm, dateCommande: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de livraison souhaitée</Label>
                  <Input
                    type="date"
                    value={validationCommandeForm.dateLivraisonSouhaitee}
                    onChange={(e) => setValidationCommandeForm({ ...validationCommandeForm, dateLivraisonSouhaitee: e.target.value })}
                  />
                </div>
              </div>

              {/* Numéro BC client - OBLIGATOIRE */}
              <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Label htmlFor="refBonCommandeClient" className="flex items-center gap-1 text-amber-800">
                  <Hash className="h-4 w-4" />
                  Numéro de bon de commande client <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="refBonCommandeClient"
                  value={validationCommandeForm.refBonCommandeClient}
                  onChange={(e) => setValidationCommandeForm({ ...validationCommandeForm, refBonCommandeClient: e.target.value })}
                  placeholder="Ex: BC-2026-001, PO-12345..."
                  className="font-mono bg-white"
                />
                <p className="text-xs text-amber-700">
                  Ce numéro est obligatoire et apparaîtra sur tous les documents.
                </p>
              </div>

              {/* Lignes de la commande */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Lignes de la commande ({validationCommandeDialog.lignes?.length || 0})
                </h4>
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs">Désignation</TableHead>
                        <TableHead className="text-xs text-right">Qté</TableHead>
                        <TableHead className="text-xs text-right">PU HT</TableHead>
                        <TableHead className="text-xs text-right">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationCommandeDialog.lignes?.map((l: any, i: number) => (
                        <TableRow key={i} className="text-sm">
                          <TableCell className="py-2">{l.libelle || l.produitService?.nom}</TableCell>
                          <TableCell className="py-2 text-right">{l.quantite} {l.unite}</TableCell>
                          <TableCell className="py-2 text-right">{formatMontant(l.prixUnitaireHT)}</TableCell>
                          <TableCell className="py-2 text-right font-medium">{formatMontant(l.totalHT)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totaux */}
              <div className="p-4 bg-primary/5 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total HT</span>
                  <span>{formatMontant(validationCommandeDialog.totalHT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total TVA</span>
                  <span>{formatMontant(validationCommandeDialog.totalTVA)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total TTC</span>
                  <span className="text-primary">{formatMontant(validationCommandeDialog.totalTTC)}</span>
                </div>
              </div>

              {/* Notes et conditions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <textarea
                    className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none"
                    value={validationCommandeForm.notes}
                    onChange={(e) => setValidationCommandeForm({ ...validationCommandeForm, notes: e.target.value })}
                    placeholder="Notes internes..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conditions</Label>
                  <textarea
                    className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none"
                    value={validationCommandeForm.conditions}
                    onChange={(e) => setValidationCommandeForm({ ...validationCommandeForm, conditions: e.target.value })}
                    placeholder="Conditions particulières..."
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setValidationCommandeDialog(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (validationCommandeDialog && validationCommandeForm.refBonCommandeClient.trim()) {
                  validerCommande.mutate({
                    id: validationCommandeDialog.id,
                    refBonCommandeClient: validationCommandeForm.refBonCommandeClient.trim(),
                    dateCommande: validationCommandeForm.dateCommande,
                    dateLivraisonSouhaitee: validationCommandeForm.dateLivraisonSouhaitee || undefined,
                    notes: validationCommandeForm.notes || undefined,
                    conditions: validationCommandeForm.conditions || undefined,
                  });
                }
              }}
              disabled={!validationCommandeForm.refBonCommandeClient.trim() || validerCommande.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {validerCommande.isPending ? 'Validation...' : 'Valider la commande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog validation facture */}
      <Dialog open={!!validationFactureDialog} onOpenChange={(open) => !open && setValidationFactureDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Valider la facture {validationFactureDialog?.ref}
            </DialogTitle>
            <DialogDescription>
              Vérifiez et modifiez les informations si nécessaire avant validation
            </DialogDescription>
          </DialogHeader>

          {validationFactureDialog && (
            <div className="space-y-4">
              {/* Infos principales */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium">{validationFactureDialog.client?.nomEntreprise}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Référence</p>
                  <p className="font-medium font-mono">{validationFactureDialog.ref}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant={validationFactureDialog.type === 'AVOIR' ? 'destructive' : 'default'}>
                    {validationFactureDialog.type === 'AVOIR' ? 'Avoir' : 'Facture'}
                  </Badge>
                </div>
              </div>

              {/* Champs modifiables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de facturation</Label>
                  <Input
                    type="date"
                    value={validationFactureForm.dateFacture}
                    onChange={(e) => setValidationFactureForm({ ...validationFactureForm, dateFacture: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Délai de paiement (jours)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    value={validationFactureForm.delaiPaiementJours}
                    onChange={(e) => setValidationFactureForm({ ...validationFactureForm, delaiPaiementJours: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Échéance :{' '}
                    <span className="font-medium text-primary">
                      {formatDate(
                        new Date(
                          new Date(validationFactureForm.dateFacture || new Date()).getTime() +
                            validationFactureForm.delaiPaiementJours * 24 * 60 * 60 * 1000
                        )
                      )}
                    </span>
                  </p>
                </div>
              </div>

              {/* Documents sources */}
              {(validationFactureDialog.devisId || validationFactureDialog.commandeId) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-medium text-amber-800 mb-1">Documents sources</p>
                  <div className="flex gap-4 text-sm">
                    {validationFactureDialog.devisId && (
                      <span>Devis: <strong>{validationFactureDialog.devis?.ref || validationFactureDialog.devisId}</strong></span>
                    )}
                    {validationFactureDialog.commandeId && (
                      <span>Commande: <strong>{validationFactureDialog.commande?.ref || validationFactureDialog.commandeId}</strong></span>
                    )}
                  </div>
                </div>
              )}

              {/* Lignes de la facture */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Lignes de la facture ({validationFactureDialog.lignes?.length || 0})
                </h4>
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs">Désignation</TableHead>
                        <TableHead className="text-xs text-right">Qté</TableHead>
                        <TableHead className="text-xs text-right">PU HT</TableHead>
                        <TableHead className="text-xs text-right">Total HT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationFactureDialog.lignes?.map((l: any, i: number) => (
                        <TableRow key={i} className="text-sm">
                          <TableCell className="py-2">{l.libelle || l.produitService?.nom}</TableCell>
                          <TableCell className="py-2 text-right">{l.quantite} {l.unite}</TableCell>
                          <TableCell className="py-2 text-right">{formatMontant(l.prixUnitaireHT)}</TableCell>
                          <TableCell className="py-2 text-right font-medium">{formatMontant(l.totalHT)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totaux */}
              <div className="p-4 bg-primary/5 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total HT</span>
                  <span>{formatMontant(validationFactureDialog.totalHT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total TVA</span>
                  <span>{formatMontant(validationFactureDialog.totalTVA)}</span>
                </div>
                {(validationFactureDialog.remiseGlobalPct > 0 || validationFactureDialog.remiseGlobalMontant > 0) && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Remise globale</span>
                    <span>
                      {validationFactureDialog.remiseGlobalPct > 0 && `${validationFactureDialog.remiseGlobalPct}%`}
                      {validationFactureDialog.remiseGlobalPct > 0 && validationFactureDialog.remiseGlobalMontant > 0 && ' + '}
                      {validationFactureDialog.remiseGlobalMontant > 0 && formatMontant(validationFactureDialog.remiseGlobalMontant)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total TTC</span>
                  <span className="text-primary">{formatMontant(validationFactureDialog.totalTTC)}</span>
                </div>
              </div>

              {/* Notes et conditions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <textarea
                    className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none"
                    value={validationFactureForm.notes}
                    onChange={(e) => setValidationFactureForm({ ...validationFactureForm, notes: e.target.value })}
                    placeholder="Notes internes..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conditions</Label>
                  <textarea
                    className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none"
                    value={validationFactureForm.conditions}
                    onChange={(e) => setValidationFactureForm({ ...validationFactureForm, conditions: e.target.value })}
                    placeholder="Conditions particulières..."
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setValidationFactureDialog(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (validationFactureDialog) {
                  validerFacture.mutate({
                    id: validationFactureDialog.id,
                    delaiPaiementJours: validationFactureForm.delaiPaiementJours,
                    dateFacture: validationFactureForm.dateFacture,
                    notes: validationFactureForm.notes || undefined,
                    conditions: validationFactureForm.conditions || undefined,
                  });
                }
              }}
              disabled={validerFacture.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {validerFacture.isPending ? 'Validation...' : 'Valider la facture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}

export default CommercePage;
