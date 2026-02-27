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
import type { CreateCommandeInput, CreateDevisInput, CreateFactureInput, ProduitService, Tiers, FactureType } from '@/types';
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
              {canManage && onPayment && type === 'facture' && document.statut !== 'BROUILLON' && document.statut !== 'PAYEE' && (
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
          <div className="grid grid-cols-2 gap-4">
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
  const [searchFactures, setSearchFactures] = useState('');

  // Sort states
  const [sortDevis, setSortDevis] = useState<string>('recent');
  const [sortCommandes, setSortCommandes] = useState<string>('recent');

  // Detail sheet state
  const [viewingDocument, setViewingDocument] = useState<{
    type: 'devis' | 'commande' | 'facture';
    document: any;
  } | null>(null);

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
    modePaiement: 'VIREMENT' as 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'CARTE' | 'EFFET',
    reference: '',
    banque: '',
    emetteur: '',
    datePaiement: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState('devis');

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
    dateDevis?: string;
    dateCommande?: string;
    totalTTC: number;
    client?: { nomEntreprise: string };
  }>(documents: T[], sortBy: string): T[] => {
    return [...documents].sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.dateDevis || b.dateCommande || 0).getTime() -
                 new Date(a.dateDevis || a.dateCommande || 0).getTime();
        case 'oldest':
          return new Date(a.dateDevis || a.dateCommande || 0).getTime() -
                 new Date(b.dateDevis || b.dateCommande || 0).getTime();
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
      prestation?: string;
      interventionId?: string;
      dateIntervention?: string;
    } | null;

    if (state?.generateFacture && state.clientId) {
      // Basculer sur l'onglet Factures
      setActiveTab('factures');

      // Pré-remplir le formulaire de facture avec les données de l'intervention
      setFactureForm({
        clientId: state.clientId,
        lignes: [{
          ...EMPTY_LINE,
          libelle: state.prestation || 'Prestation de service',
          description: state.dateIntervention
            ? `Intervention du ${new Date(state.dateIntervention).toLocaleDateString('fr-FR')}`
            : '',
          quantite: 1,
        }],
        type: 'FACTURE',
        notes: state.interventionId ? `Réf. intervention: ${state.interventionId}` : '',
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
      setFactureForm({ clientId: '', lignes: [{ ...EMPTY_LINE }], type: 'FACTURE', dateFacture: new Date().toISOString().split('T')[0], delaiPaiementJours: 45 });
      setShowFactureDialog(false);
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
      setFactureForm({ clientId: '', lignes: [{ ...EMPTY_LINE }], type: 'FACTURE', dateFacture: new Date().toISOString().split('T')[0], delaiPaiementJours: 45 });
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
    mutationFn: (payload: { factureId: string; montant: number; datePaiement?: string; reference?: string; notes?: string }) =>
      commerceApi.createPaiement(payload),
    onSuccess: () => {
      toast.success('Paiement enregistré');
      queryClient.invalidateQueries({ queryKey: ['commerce', 'factures'] });
      setPaiementFacture(null);
      setPaiementForm({
        montant: 0,
        modePaiement: 'VIREMENT',
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ventes</h1>
          <p className="text-muted-foreground">Gestion des devis, commandes et factures clients</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Devis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{devisData?.devis?.filter((d: any) => d.statut !== 'BROUILLON').length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Commandes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{commandesData?.commandes?.filter((c: any) => c.statut !== 'BROUILLON').length || 0}</p>
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
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
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
                  <Select value={sortDevis} onValueChange={setSortDevis}>
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
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={async () => {
                            try {
                              const fullDevis = await commerceApi.getDevis(d.id);
                              setViewingDocument({ type: 'devis', document: fullDevis });
                            } catch {
                              toast.error('Erreur lors du chargement du devis');
                            }
                          }}
                        >
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
                  <Select value={sortCommandes} onValueChange={setSortCommandes}>
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
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={async () => {
                            try {
                              const fullCommande = await commerceApi.getCommande(c.id);
                              setViewingDocument({ type: 'commande', document: fullCommande });
                            } catch {
                              toast.error('Erreur lors du chargement de la commande');
                            }
                          }}
                        >
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
                          <TableCell>{statusBadge(c.statut)}</TableCell>
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
                                          devisId: fullFacture.devisId || undefined,
                                          commandeId: fullFacture.commandeId || undefined,
                                          dateFacture: fullFacture.dateFacture?.split('T')[0] || new Date().toISOString().split('T')[0],
                                          delaiPaiementJours: fullFacture.delaiPaiementJours ?? 45,
                                          notes: fullFacture.notes || '',
                                          conditions: fullFacture.conditions || '',
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
                                    onClick={() => {
                                      setValidationFactureForm({
                                        delaiPaiementJours: f.delaiPaiementJours ?? 45,
                                        dateFacture: f.dateFacture?.split('T')[0] || new Date().toISOString().split('T')[0],
                                        notes: f.notes || '',
                                        conditions: f.conditions || '',
                                      });
                                      setValidationFactureDialog(f);
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </Tooltip>
                              )}
                              {canManage && f.statut !== 'PAYEE' && f.statut !== 'BROUILLON' && (
                                <Tooltip content="Enregistrer un paiement">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => {
                                      setPaiementFacture(f);
                                      setPaiementForm({
                                        ...paiementForm,
                                        montant: f.totalTTC - (f.totalPaye || 0),
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
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

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
          setFactureForm({ clientId: '', lignes: [{ ...EMPTY_LINE }], type: 'FACTURE', dateFacture: new Date().toISOString().split('T')[0], delaiPaiementJours: 45 });
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFactureId ? 'Modifier la facture' : 'Créer une facture'}</DialogTitle>
            <DialogDescription>
              {editingFactureId
                ? 'Modifiez les informations de la facture en brouillon.'
                : 'Remplissez les informations pour créer une nouvelle facture client.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    {clients.filter((t: Tiers) => t.id && t.id !== '').map((t: Tiers) => (
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

            <LignesForm lignes={factureForm.lignes} setForm={setFactureForm} produitsList={produits} />

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
                : (editingFactureId ? 'Enregistrer les modifications' : 'Créer la facture')}
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
      />

      {/* Document Detail Sheet - Pour factures uniquement */}
      <DocumentDetailSheet
        open={viewingDocument?.type === 'facture'}
        onOpenChange={(open) => !open && setViewingDocument(null)}
        type="facture"
        document={viewingDocument?.document}
        canManage={canManage}
        onDownloadPdf={() => {
          if (viewingDocument?.type === 'facture') {
            commerceApi.downloadFacturePdf(viewingDocument.document.id).catch(() => toast.error('Erreur téléchargement'));
          }
        }}
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
        onDelete={() => {
          if (viewingDocument?.type === 'facture') {
            setDeleteTarget({ type: 'facture', item: viewingDocument.document });
          }
        }}
        canDelete={
          viewingDocument?.type === 'facture'
            ? (viewingDocument.document.statut === 'BROUILLON' || viewingDocument.document.statut === 'VALIDEE')
            : false
        }
        onPayment={() => {
          if (viewingDocument?.type === 'facture') {
            setPaiementFacture(viewingDocument.document);
            setPaiementForm({
              ...paiementForm,
              montant: viewingDocument.document.totalTTC - (viewingDocument.document.totalPaye || 0),
              emetteur: viewingDocument.document.client?.nomEntreprise || '',
            });
          }
        }}
        onNavigateToDocument={async (docType, docId) => {
          try {
            let doc: any;
            if (docType === 'devis') {
              doc = await commerceApi.getDevis(docId);
            } else if (docType === 'commande') {
              doc = await commerceApi.getCommande(docId);
            } else {
              doc = await commerceApi.getFacture(docId);
            }
            // Change tab and show the document
            const tabMap = { devis: 'devis', commande: 'commandes', facture: 'factures' };
            setActiveTab(tabMap[docType]);
            setViewingDocument({ type: docType, document: doc });
          } catch (error) {
            toast.error('Erreur lors de la récupération du document');
          }
        }}
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
                  <span className="text-muted-foreground">Déjà payé</span>
                  <span className="font-medium text-green-600">{formatMontant(paiementFacture.totalPaye || 0)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="font-medium">Reste à payer</span>
                  <span className="font-bold text-primary">
                    {formatMontant(paiementFacture.totalTTC - (paiementFacture.totalPaye || 0))}
                  </span>
                </div>
              </div>

              {/* Formulaire de paiement */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Montant du paiement <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={paiementFacture.totalTTC - (paiementFacture.totalPaye || 0)}
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
                  // Construire la référence avec les détails du paiement
                  let refParts: string[] = [];
                  refParts.push(paiementForm.modePaiement);
                  if (paiementForm.reference) refParts.push(paiementForm.reference);
                  if (paiementForm.banque) refParts.push(`Banque: ${paiementForm.banque}`);
                  if (paiementForm.emetteur && paiementForm.emetteur !== paiementFacture.client?.nomEntreprise) {
                    refParts.push(`Émetteur: ${paiementForm.emetteur}`);
                  }
                  const refStr = refParts.join(' - ');

                  createPaiementMutation.mutate({
                    factureId: paiementFacture.id,
                    montant: paiementForm.montant,
                    datePaiement: paiementForm.datePaiement,
                    reference: refStr,
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
  );
}

export default CommercePage;
