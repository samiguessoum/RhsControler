import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { facturationStatsApi, commerceApi } from '@/services/api';
import { cn } from '@/lib/utils';

function formatMontant(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0,00 DA';
  return new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' DA';
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variantStyles = {
    default: 'bg-white',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-orange-50 border-orange-200',
    danger: 'bg-red-50 border-red-200',
  };

  const iconStyles = {
    default: 'text-primary bg-primary/10',
    success: 'text-green-600 bg-green-100',
    warning: 'text-orange-600 bg-orange-100',
    danger: 'text-red-600 bg-red-100',
  };

  return (
    <Card className={cn('border', variantStyles[variant])}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && trendValue && (
              <div className={cn(
                'flex items-center gap-1 text-xs font-medium',
                trend === 'up' ? 'text-green-600' : 'text-red-600'
              )}>
                {trend === 'up' ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {trendValue}
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-lg', iconStyles[variant])}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ CSV EXPORT HELPERS ============

function fmtCsv(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMoisG50Csv(mois: any, annee: number) {
  const S = ';';
  const rows: string[] = [];

  rows.push(`G50 - ${mois.nomMois} ${annee}`);
  rows.push(`Généré le${S}${new Date().toLocaleDateString('fr-FR')}`);
  rows.push('');

  rows.push(['Section', 'Date', 'Référence', 'Client / Fournisseur', 'Base HT (DA)', 'TVA (DA)', 'TTC (DA)'].join(S));

  for (const f of mois.tvaCollectee?.produits?.factures ?? []) {
    const sign = f.type === 'AVOIR' ? -1 : 1;
    rows.push([
      f.type === 'AVOIR' ? 'Avoir - réduction TVA collectée' : 'TVA Collectée - Produit (date facturation)',
      new Date(f.dateFacture).toLocaleDateString('fr-FR'),
      f.ref,
      f.client?.nomEntreprise ?? '',
      fmtCsv(f.totalHT * sign),
      fmtCsv(f.totalTVA * sign),
      fmtCsv(f.totalTTC * sign),
    ].join(S));
  }

  for (const p of mois.tvaCollectee?.services?.paiements ?? []) {
    rows.push([
      'TVA Collectée - Service (date encaissement)',
      new Date(p.dateEncaissement ?? p.datePaiement).toLocaleDateString('fr-FR'),
      p.factureRef,
      p.client?.nomEntreprise ?? '',
      fmtCsv(p.htProportionnel),
      fmtCsv(p.tvaProportionnelle),
      fmtCsv(p.montantEncaisse),
    ].join(S));
  }

  for (const f of mois.tvaDeductible?.achats?.factures ?? []) {
    rows.push([
      'TVA Déductible - Achat fournisseur',
      new Date(f.dateFacture).toLocaleDateString('fr-FR'),
      f.ref ?? '',
      f.fournisseur?.nomEntreprise ?? '',
      fmtCsv(f.totalHT),
      fmtCsv(f.totalTVA),
      fmtCsv(f.totalTTC),
    ].join(S));
  }

  for (const c of mois.tvaDeductible?.charges?.charges ?? []) {
    rows.push([
      'TVA Déductible - Charge',
      new Date(c.dateCharge).toLocaleDateString('fr-FR'),
      '',
      c.libelle,
      fmtCsv(c.montantHT),
      fmtCsv(c.montantTVA),
      fmtCsv(c.montantTTC),
    ].join(S));
  }

  rows.push('');
  rows.push(['RÉSUMÉ', '', '', '', 'Base HT', 'TVA', ''].join(S));
  rows.push(['TVA Collectée Produits', '', '', '', fmtCsv(mois.tvaCollectee?.produits?.montantHT ?? 0), fmtCsv(mois.tvaCollectee?.produits?.montantTVA ?? 0), ''].join(S));
  rows.push(['TVA Collectée Services', '', '', '', fmtCsv(mois.tvaCollectee?.services?.montantHT ?? 0), fmtCsv(mois.tvaCollectee?.services?.montantTVA ?? 0), ''].join(S));
  rows.push(['TVA Collectée TOTALE', '', '', '', fmtCsv(mois.tvaCollectee?.total?.montantHT ?? 0), fmtCsv(mois.tvaCollectee?.total?.montantTVA ?? 0), ''].join(S));
  rows.push(['TVA Déductible Achats', '', '', '', fmtCsv(mois.tvaDeductible?.achats?.montantHT ?? 0), fmtCsv(mois.tvaDeductible?.achats?.montantTVA ?? 0), ''].join(S));
  rows.push(['TVA Déductible Charges', '', '', '', fmtCsv(mois.tvaDeductible?.charges?.montantHT ?? 0), fmtCsv(mois.tvaDeductible?.charges?.montantTVA ?? 0), ''].join(S));
  rows.push(['TVA Déductible TOTALE', '', '', '', fmtCsv(mois.tvaDeductible?.total?.montantHT ?? 0), fmtCsv(mois.tvaDeductible?.total?.montantTVA ?? 0), ''].join(S));
  rows.push('');
  rows.push([`TVA NETTE ${(mois.tvaNette ?? 0) > 0 ? 'À VERSER' : 'CRÉDIT'}`, '', '', '', '', fmtCsv(Math.abs(mois.tvaNette ?? 0)), ''].join(S));

  downloadCsv(rows.join('\n'), `G50_${mois.nomMois}_${annee}.csv`);
}

function exportAnnuelG50Csv(g50Data: any) {
  const S = ';';
  const rows: string[] = [];

  rows.push(`RAPPORT G50 ANNUEL - ${g50Data.annee}`);
  rows.push(`Généré le${S}${new Date().toLocaleDateString('fr-FR')}`);
  rows.push('');

  // Tableau récap mensuel
  rows.push('TABLEAU RÉCAPITULATIF');
  rows.push(['Mois', 'CA HT (DA)', 'TVA Collectée (DA)', 'TVA Déductible (DA)', 'TVA Nette (DA)', 'Statut G50'].join(S));
  for (const m of g50Data.moisDetails ?? []) {
    rows.push([
      m.nomMois,
      fmtCsv(m.tvaCollectee?.total?.montantHT ?? 0),
      fmtCsv(m.tvaCollectee?.total?.montantTVA ?? 0),
      fmtCsv(m.tvaDeductible?.total?.montantTVA ?? 0),
      fmtCsv(m.tvaNette ?? 0),
      (m.tvaNette ?? 0) > 0 ? 'À VERSER' : (m.tvaNette ?? 0) < 0 ? 'CRÉDIT' : 'NÉANT',
    ].join(S));
  }
  rows.push([
    `TOTAL ${g50Data.annee}`,
    fmtCsv((g50Data.moisDetails ?? []).reduce((s: number, m: any) => s + (m.tvaCollectee?.total?.montantHT ?? 0), 0)),
    fmtCsv(g50Data.totalAnnuel?.tvaCollectee ?? 0),
    fmtCsv(g50Data.totalAnnuel?.tvaDeductible ?? 0),
    fmtCsv(g50Data.totalAnnuel?.tvaNette ?? 0),
    (g50Data.totalAnnuel?.tvaNette ?? 0) > 0 ? 'À VERSER' : 'CRÉDIT',
  ].join(S));

  // Détail ligne par ligne
  rows.push('');
  rows.push('');
  rows.push('DÉTAIL PAR OPÉRATION');
  rows.push(['Mois', 'Section', 'Date', 'Référence', 'Client / Fournisseur', 'Base HT (DA)', 'TVA (DA)', 'TTC (DA)'].join(S));

  for (const m of g50Data.moisDetails ?? []) {
    for (const f of m.tvaCollectee?.produits?.factures ?? []) {
      const sign = f.type === 'AVOIR' ? -1 : 1;
      rows.push([m.nomMois, f.type === 'AVOIR' ? 'Avoir (collectée)' : 'Produit (collectée)', new Date(f.dateFacture).toLocaleDateString('fr-FR'), f.ref, f.client?.nomEntreprise ?? '', fmtCsv(f.totalHT * sign), fmtCsv(f.totalTVA * sign), fmtCsv(f.totalTTC * sign)].join(S));
    }
    for (const p of m.tvaCollectee?.services?.paiements ?? []) {
      rows.push([m.nomMois, 'Service (collectée)', new Date(p.dateEncaissement ?? p.datePaiement).toLocaleDateString('fr-FR'), p.factureRef, p.client?.nomEntreprise ?? '', fmtCsv(p.htProportionnel), fmtCsv(p.tvaProportionnelle), fmtCsv(p.montantEncaisse)].join(S));
    }
    for (const f of m.tvaDeductible?.achats?.factures ?? []) {
      rows.push([m.nomMois, 'Achat fournisseur (déductible)', new Date(f.dateFacture).toLocaleDateString('fr-FR'), f.ref ?? '', f.fournisseur?.nomEntreprise ?? '', fmtCsv(f.totalHT), fmtCsv(f.totalTVA), fmtCsv(f.totalTTC)].join(S));
    }
    for (const c of m.tvaDeductible?.charges?.charges ?? []) {
      rows.push([m.nomMois, 'Charge (déductible)', new Date(c.dateCharge).toLocaleDateString('fr-FR'), '', c.libelle, fmtCsv(c.montantHT), fmtCsv(c.montantTVA), fmtCsv(c.montantTTC)].join(S));
    }
  }

  downloadCsv(rows.join('\n'), `G50_Annuel_${g50Data.annee}.csv`);
}

// ============ END CSV EXPORT ============

export function FinancePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expandedMois, setExpandedMois] = useState<number | null>(null);

  // Active tab — synced with ?tab= query param
  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab');
  const activeTab = ['dashboard', 'g50'].includes(tabFromUrl ?? '') ? tabFromUrl! : 'dashboard';
  const setActiveTab = (tab: string) => navigate(`${location.pathname}?tab=${tab}`, { replace: true });

  // Queries
  const { data: anneesDisponibles } = useQuery({
    queryKey: ['finance', 'annees'],
    queryFn: () => facturationStatsApi.getAnneesDisponibles(),
  });

  const years: number[] = anneesDisponibles ?? (selectedYear ? [selectedYear] : [currentYear]);

  const { data: globalStats, isLoading: loadingGlobal, error: errorGlobal } = useQuery({
    queryKey: ['finance', 'global', selectedYear],
    queryFn: () => facturationStatsApi.getGlobal(selectedYear),
  });

  const { data: tresorerieStats, isLoading: loadingTresorerie, error: errorTresorerie } = useQuery({
    queryKey: ['finance', 'tresorerie', selectedYear],
    queryFn: () => facturationStatsApi.getTresorerie(selectedYear),
  });

  const { data: retardsData } = useQuery({
    queryKey: ['finance', 'retards'],
    queryFn: () => facturationStatsApi.getRetards(),
  });

  const { data: facturesData } = useQuery({
    queryKey: ['commerce', 'factures', 'recent'],
    queryFn: () => commerceApi.listFactures({ limit: 10 }),
  });

  const { data: tvaStats } = useQuery({
    queryKey: ['finance', 'tva', selectedYear],
    queryFn: () => facturationStatsApi.getTva(selectedYear),
  });

  const { data: g50Data, isLoading: loadingG50 } = useQuery({
    queryKey: ['finance', 'g50', selectedYear],
    queryFn: () => facturationStatsApi.getG50(selectedYear),
    enabled: activeTab === 'g50',
  });

  // Calculs dashboard
  const caTotal = globalStats?.facturesClients?.totalTTC || 0;
  const achatsTotal = globalStats?.facturesFournisseurs?.totalTTC || 0;
  const chargesTotal = globalStats?.charges?.montantTTC || 0;
  const resultatBrut = globalStats?.resume?.resultatBrut || (caTotal - achatsTotal - chargesTotal);

  const encaissements = tresorerieStats?.encaissements?.total || 0;
  const decaissements = tresorerieStats?.decaissements?.total || 0;
  const soldeTresorerie = tresorerieStats?.solde || (encaissements - decaissements);

  const facturesEnRetard = retardsData?.facturesClients || [];
  const montantRetard = facturesEnRetard.reduce((sum: number, f: any) => sum + (f.resteAPayer || 0), 0);

  const tvaCollectee = tvaStats?.tvaCollectee?.montant || 0;
  const tvaDeductible = tvaStats?.tvaDeductible?.montant || 0;
  const tvaAPayer = tvaStats?.tvaNette || (tvaCollectee - tvaDeductible);

  const recentFactures = facturesData?.factures?.slice(0, 5) || [];

  const currentMonth = new Date().getMonth() + 1;
  const currentMoisData = g50Data?.moisDetails?.find((m: any) => m.mois === currentMonth);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Finance & Trésorerie</h1>
          <p className="text-muted-foreground">Vue consolidée de votre situation financière</p>
        </div>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="g50" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Déclarations TVA (G50)
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB: DASHBOARD ===== */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          {(errorGlobal || errorTresorerie) && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Erreur lors du chargement des données. Vérifiez que vous avez les permissions nécessaires.</span>
                </div>
              </CardContent>
            </Card>
          )}

          {(loadingGlobal || loadingTresorerie) && (
            <div className="text-center py-4 text-muted-foreground">
              Chargement des données financières...
            </div>
          )}

          {/* KPIs principaux */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Chiffre d'affaires"
              value={formatMontant(caTotal)}
              subtitle={`Année ${selectedYear}`}
              icon={TrendingUp}
              variant="success"
            />
            <StatCard
              title="Résultat brut"
              value={formatMontant(resultatBrut)}
              subtitle="CA - Achats - Charges"
              icon={resultatBrut >= 0 ? TrendingUp : TrendingDown}
              variant={resultatBrut >= 0 ? 'success' : 'danger'}
            />
            <StatCard
              title="Solde trésorerie"
              value={formatMontant(soldeTresorerie)}
              subtitle="Encaissements - Décaissements"
              icon={Wallet}
              variant={soldeTresorerie >= 0 ? 'default' : 'warning'}
            />
            <StatCard
              title="Factures en retard"
              value={formatMontant(montantRetard)}
              subtitle={`${facturesEnRetard.length} facture(s)`}
              icon={AlertTriangle}
              variant={facturesEnRetard.length > 0 ? 'danger' : 'default'}
            />
          </div>

          {/* Section détaillée */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Flux de trésorerie */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Flux de trésorerie
                </CardTitle>
                <CardDescription>Entrées et sorties de cash</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-100">
                        <ArrowUpRight className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Encaissements</p>
                        <p className="text-xl font-bold text-green-600">{formatMontant(encaissements)}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paiements clients reçus</span>
                        <span className="font-medium">{formatMontant(tresorerieStats?.encaissements?.facturesClients || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Encaissements divers</span>
                        <span className="font-medium">{formatMontant(tresorerieStats?.encaissements?.paiementsDivers || 0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-red-100">
                        <ArrowDownRight className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Décaissements</p>
                        <p className="text-xl font-bold text-red-600">{formatMontant(decaissements)}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paiements fournisseurs</span>
                        <span className="font-medium">{formatMontant(tresorerieStats?.decaissements?.facturesFournisseurs || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Charges payées</span>
                        <span className="font-medium">{formatMontant(tresorerieStats?.decaissements?.charges || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Décaissements divers</span>
                        <span className="font-medium">{formatMontant(tresorerieStats?.decaissements?.paiementsDivers || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Ratio encaissements/décaissements</span>
                    <span className="font-medium">
                      {decaissements > 0 ? ((encaissements / decaissements) * 100).toFixed(0) : '100'}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        encaissements >= decaissements ? "bg-green-500" : "bg-orange-500"
                      )}
                      style={{ width: `${Math.min((encaissements / Math.max(decaissements, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* TVA résumé annuel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Situation TVA
                </CardTitle>
                <CardDescription>Année {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm">TVA collectée</span>
                  <span className="font-bold text-green-700">{formatMontant(tvaCollectee)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm">TVA déductible</span>
                  <span className="font-bold text-blue-700">{formatMontant(tvaDeductible)}</span>
                </div>
                <div className="h-px bg-gray-200" />
                <div className={cn(
                  "flex justify-between items-center p-3 rounded-lg",
                  tvaAPayer >= 0 ? "bg-orange-50" : "bg-green-50"
                )}>
                  <span className="text-sm font-medium">
                    {tvaAPayer >= 0 ? 'TVA à payer' : 'Crédit de TVA'}
                  </span>
                  <span className={cn(
                    "font-bold",
                    tvaAPayer >= 0 ? "text-orange-700" : "text-green-700"
                  )}>
                    {formatMontant(Math.abs(tvaAPayer))}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setActiveTab('g50')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Voir détail mensuel G50
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Tableaux */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Factures en retard */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-red-500" />
                    Factures en retard
                  </CardTitle>
                  <CardDescription>{facturesEnRetard.length} facture(s) impayée(s)</CardDescription>
                </div>
                {facturesEnRetard.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => navigate('/commerce?tab=factures&statut=EN_RETARD')}>
                    Voir tout
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {facturesEnRetard.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>Aucune facture en retard</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Facture</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Retard</TableHead>
                        <TableHead className="text-right">Reste dû</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facturesEnRetard.slice(0, 5).map((facture: any) => (
                        <TableRow
                          key={facture.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/commerce?tab=factures&openId=${facture.id}`)}
                        >
                          <TableCell className="font-medium">{facture.ref}</TableCell>
                          <TableCell>{facture.client?.nomEntreprise || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">
                              {facture.joursRetard}j
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {formatMontant(facture.resteAPayer)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Dernières factures */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Dernières factures clients
                  </CardTitle>
                  <CardDescription>Activité récente</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/commerce')}>
                  Voir tout
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facture</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentFactures.map((facture: any) => (
                      <TableRow key={facture.id}>
                        <TableCell className="font-medium">{facture.ref}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[120px]">
                              {facture.client?.nomEntreprise || '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {facture.statut === 'PAYEE' ? (
                            <Badge variant="default" className="bg-green-100 text-green-700">Payée</Badge>
                          ) : facture.statut === 'VALIDEE' ? (
                            <Badge variant="secondary">Validée</Badge>
                          ) : facture.statut === 'PARTIELLEMENT_PAYEE' ? (
                            <Badge variant="outline" className="border-orange-300 text-orange-600">Partiel</Badge>
                          ) : (
                            <Badge variant="outline">Brouillon</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMontant(facture.totalTTC)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Résumé achats/charges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Chiffre d'affaires</p>
                    <p className="text-xl font-bold">{formatMontant(caTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-orange-100">
                    <TrendingDown className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Achats fournisseurs</p>
                    <p className="text-xl font-bold">{formatMontant(achatsTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-purple-100">
                    <Wallet className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Charges</p>
                    <p className="text-xl font-bold">{formatMontant(chargesTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== TAB: G50 TVA ===== */}
        <TabsContent value="g50" className="space-y-6 mt-4">
          {/* Bandeau mois en cours */}
          {currentMoisData && selectedYear === currentYear && (
            <Card className={cn(
              'border-2',
              (currentMoisData.tvaNette || 0) > 0 ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <Receipt className={cn('h-6 w-6', (currentMoisData.tvaNette || 0) > 0 ? 'text-orange-600' : 'text-green-600')} />
                    <div>
                      <p className="font-semibold text-sm">
                        G50 — {currentMoisData.nomMois} {selectedYear}
                      </p>
                      <p className="text-xs text-muted-foreground">Déclaration du mois en cours</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground">Collectée</p>
                      <p className="font-bold text-green-700">{formatMontant(currentMoisData.tvaCollectee?.total?.montantTVA || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Déductible</p>
                      <p className="font-bold text-blue-700">{formatMontant(currentMoisData.tvaDeductible?.total?.montantTVA || 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">
                        {(currentMoisData.tvaNette || 0) > 0 ? 'TVA à verser' : 'Crédit TVA'}
                      </p>
                      <p className={cn('font-bold text-lg', (currentMoisData.tvaNette || 0) > 0 ? 'text-orange-700' : 'text-green-700')}>
                        {formatMontant(Math.abs(currentMoisData.tvaNette || 0))}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* KPIs annuels G50 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="TVA collectée (total)"
              value={formatMontant(g50Data?.totalAnnuel?.tvaCollectee || 0)}
              subtitle={`Année ${selectedYear}`}
              icon={TrendingUp}
              variant="default"
            />
            <StatCard
              title="dont Produits"
              value={formatMontant(g50Data?.moisDetails?.reduce((s: number, m: any) => s + (m.tvaCollectee?.produits?.montantTVA || 0), 0) || 0)}
              subtitle="TVA sur date de facturation"
              icon={Receipt}
              variant="default"
            />
            <StatCard
              title="dont Services"
              value={formatMontant(g50Data?.moisDetails?.reduce((s: number, m: any) => s + (m.tvaCollectee?.services?.montantTVA || 0), 0) || 0)}
              subtitle="TVA sur encaissement"
              icon={Receipt}
              variant="default"
            />
            <StatCard
              title="TVA à verser (total)"
              value={formatMontant(g50Data?.totalAnnuel?.aPayer || 0)}
              subtitle="Collectée − Déductible"
              icon={AlertTriangle}
              variant={(g50Data?.totalAnnuel?.aPayer || 0) > 0 ? 'warning' : 'success'}
            />
          </div>

          {/* Tableau mensuel G50 */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Situation mensuelle TVA — G50 {selectedYear}
                </CardTitle>
                <CardDescription>
                  Produits : TVA exigible à la facturation · Services : TVA exigible à l'encaissement — Cliquez sur un mois pour voir le détail
                </CardDescription>
              </div>
              {g50Data && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportAnnuelG50Csv(g50Data)}
                  className="shrink-0"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporter CSV annuel
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loadingG50 ? (
                <div className="text-center py-10 text-muted-foreground">Chargement des données G50...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-10" />
                      <TableHead>Mois</TableHead>
                      <TableHead className="text-right">CA HT</TableHead>
                      <TableHead className="text-right text-green-700">TVA Collectée</TableHead>
                      <TableHead className="text-right text-blue-700">TVA Déductible</TableHead>
                      <TableHead className="text-right">TVA Nette</TableHead>
                      <TableHead className="text-center">Statut G50</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g50Data?.moisDetails?.map((mois: any) => {
                      const isExpanded = expandedMois === mois.mois;
                      const isCurrentMonth = mois.mois === currentMonth && selectedYear === currentYear;
                      const hasData = (mois.tvaCollectee?.total?.montantTVA || 0) !== 0 || (mois.tvaDeductible?.total?.montantTVA || 0) !== 0;

                      return (
                        <>
                          <TableRow
                            key={mois.mois}
                            className={cn(
                              'cursor-pointer hover:bg-muted/50 transition-colors',
                              isCurrentMonth && 'bg-amber-50 hover:bg-amber-100',
                              isExpanded && 'bg-muted/30'
                            )}
                            onClick={() => setExpandedMois(isExpanded ? null : mois.mois)}
                          >
                            <TableCell>
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              }
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {mois.nomMois}
                                {isCurrentMonth && (
                                  <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">Ce mois</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatMontant(mois.tvaCollectee?.total?.montantHT || 0)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-700">
                              {formatMontant(mois.tvaCollectee?.total?.montantTVA || 0)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-blue-700">
                              {formatMontant(mois.tvaDeductible?.total?.montantTVA || 0)}
                            </TableCell>
                            <TableCell className={cn(
                              'text-right font-bold',
                              (mois.tvaNette || 0) > 0 ? 'text-orange-700' :
                              (mois.tvaNette || 0) < 0 ? 'text-green-700' : 'text-muted-foreground'
                            )}>
                              {(mois.tvaNette || 0) < 0 && '− '}
                              {formatMontant(Math.abs(mois.tvaNette || 0))}
                            </TableCell>
                            <TableCell className="text-center">
                              {!hasData ? (
                                <Badge variant="outline" className="text-xs">Néant</Badge>
                              ) : (mois.tvaNette || 0) > 0 ? (
                                <Badge className="bg-orange-100 text-orange-700 border border-orange-200 text-xs">
                                  À verser
                                </Badge>
                              ) : (mois.tvaNette || 0) < 0 ? (
                                <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">
                                  Crédit
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Équilibré</Badge>
                              )}
                            </TableCell>
                          </TableRow>

                          {/* Ligne expandable — détail du mois */}
                          {isExpanded && (
                            <TableRow key={`detail-${mois.mois}`}>
                              <TableCell colSpan={7} className="p-0 bg-slate-50/80 border-b">
                                <div className="p-5 space-y-5">
                                  {/* Résumé TVA du mois */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                      <p className="text-xs text-muted-foreground mb-1">Collectée Produits</p>
                                      <p className="font-bold text-green-700">{formatMontant(mois.tvaCollectee?.produits?.montantTVA || 0)}</p>
                                      <p className="text-xs text-muted-foreground">{mois.tvaCollectee?.produits?.factures?.length || 0} facture(s)</p>
                                    </div>
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                      <p className="text-xs text-muted-foreground mb-1">Collectée Services</p>
                                      <p className="font-bold text-emerald-700">{formatMontant(mois.tvaCollectee?.services?.montantTVA || 0)}</p>
                                      <p className="text-xs text-muted-foreground">{mois.tvaCollectee?.services?.paiements?.length || 0} paiement(s)</p>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                      <p className="text-xs text-muted-foreground mb-1">Déductible Achats</p>
                                      <p className="font-bold text-blue-700">{formatMontant(mois.tvaDeductible?.achats?.montantTVA || 0)}</p>
                                      <p className="text-xs text-muted-foreground">{mois.tvaDeductible?.achats?.factures?.length || 0} facture(s)</p>
                                    </div>
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                                      <p className="text-xs text-muted-foreground mb-1">Déductible Charges</p>
                                      <p className="font-bold text-indigo-700">{formatMontant(mois.tvaDeductible?.charges?.montantTVA || 0)}</p>
                                      <p className="text-xs text-muted-foreground">{mois.tvaDeductible?.charges?.charges?.length || 0} charge(s)</p>
                                    </div>
                                  </div>

                                  {/* Factures Produits */}
                                  {(mois.tvaCollectee?.produits?.factures?.length || 0) > 0 && (
                                    <div>
                                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                        Factures Produits — TVA collectée (date de facturation)
                                      </h4>
                                      <div className="rounded-md border overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/30">
                                              <TableHead className="text-xs">Référence</TableHead>
                                              <TableHead className="text-xs">Client</TableHead>
                                              <TableHead className="text-xs">Date facture</TableHead>
                                              <TableHead className="text-xs">Type</TableHead>
                                              <TableHead className="text-right text-xs">Base HT</TableHead>
                                              <TableHead className="text-right text-xs">TVA</TableHead>
                                              <TableHead className="text-right text-xs">TTC</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {mois.tvaCollectee.produits.factures.map((f: any) => (
                                              <TableRow key={f.id} className={f.type === 'AVOIR' ? 'bg-red-50' : ''}>
                                                <TableCell className="font-mono text-xs">{f.ref}</TableCell>
                                                <TableCell className="text-xs">{f.client?.nomEntreprise || '—'}</TableCell>
                                                <TableCell className="text-xs">{new Date(f.dateFacture).toLocaleDateString('fr-FR')}</TableCell>
                                                <TableCell>
                                                  {f.type === 'AVOIR'
                                                    ? <Badge variant="outline" className="text-xs border-red-300 text-red-600">Avoir</Badge>
                                                    : <Badge variant="outline" className="text-xs">Facture</Badge>
                                                  }
                                                </TableCell>
                                                <TableCell className="text-right text-xs">{formatMontant(f.totalHT)}</TableCell>
                                                <TableCell className={cn('text-right text-xs font-medium', f.type === 'AVOIR' ? 'text-red-600' : 'text-green-700')}>
                                                  {f.type === 'AVOIR' ? '−' : ''}{formatMontant(f.totalTVA)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs">{formatMontant(f.totalTTC)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Paiements Services */}
                                  {(mois.tvaCollectee?.services?.paiements?.length || 0) > 0 && (
                                    <div>
                                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                        Paiements Services encaissés — TVA collectée (date d'encaissement)
                                      </h4>
                                      <div className="rounded-md border overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/30">
                                              <TableHead className="text-xs">Facture</TableHead>
                                              <TableHead className="text-xs">Client</TableHead>
                                              <TableHead className="text-xs">Date encaiss.</TableHead>
                                              <TableHead className="text-right text-xs">Montant encaissé</TableHead>
                                              <TableHead className="text-right text-xs">Base HT proport.</TableHead>
                                              <TableHead className="text-right text-xs">TVA proport.</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {mois.tvaCollectee.services.paiements.map((p: any) => (
                                              <TableRow key={p.id}>
                                                <TableCell className="font-mono text-xs">{p.factureRef}</TableCell>
                                                <TableCell className="text-xs">{p.client?.nomEntreprise || '—'}</TableCell>
                                                <TableCell className="text-xs">
                                                  {new Date(p.dateEncaissement || p.datePaiement).toLocaleDateString('fr-FR')}
                                                </TableCell>
                                                <TableCell className="text-right text-xs">{formatMontant(p.montantEncaisse)}</TableCell>
                                                <TableCell className="text-right text-xs">{formatMontant(p.htProportionnel)}</TableCell>
                                                <TableCell className="text-right text-xs font-medium text-emerald-700">{formatMontant(p.tvaProportionnelle)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Factures Fournisseurs */}
                                  {(mois.tvaDeductible?.achats?.factures?.length || 0) > 0 && (
                                    <div>
                                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                        Factures Fournisseurs — TVA déductible
                                      </h4>
                                      <div className="rounded-md border overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/30">
                                              <TableHead className="text-xs">Référence</TableHead>
                                              <TableHead className="text-xs">Fournisseur</TableHead>
                                              <TableHead className="text-xs">Date facture</TableHead>
                                              <TableHead className="text-right text-xs">Base HT</TableHead>
                                              <TableHead className="text-right text-xs">TVA</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {mois.tvaDeductible.achats.factures.map((f: any) => (
                                              <TableRow key={f.id}>
                                                <TableCell className="font-mono text-xs">{f.ref || f.id.substring(0, 8)}</TableCell>
                                                <TableCell className="text-xs">{f.fournisseur?.nomEntreprise || '—'}</TableCell>
                                                <TableCell className="text-xs">{new Date(f.dateFacture).toLocaleDateString('fr-FR')}</TableCell>
                                                <TableCell className="text-right text-xs">{formatMontant(f.totalHT)}</TableCell>
                                                <TableCell className="text-right text-xs font-medium text-blue-700">{formatMontant(f.totalTVA)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Charges */}
                                  {(mois.tvaDeductible?.charges?.charges?.length || 0) > 0 && (
                                    <div>
                                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                                        Charges — TVA déductible
                                      </h4>
                                      <div className="rounded-md border overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/30">
                                              <TableHead className="text-xs">Libellé</TableHead>
                                              <TableHead className="text-xs">Fournisseur</TableHead>
                                              <TableHead className="text-xs">Date</TableHead>
                                              <TableHead className="text-right text-xs">Base HT</TableHead>
                                              <TableHead className="text-right text-xs">TVA</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {mois.tvaDeductible.charges.charges.map((c: any) => (
                                              <TableRow key={c.id}>
                                                <TableCell className="text-xs">{c.libelle}</TableCell>
                                                <TableCell className="text-xs">{c.fournisseur?.nomEntreprise || '—'}</TableCell>
                                                <TableCell className="text-xs">{new Date(c.dateCharge).toLocaleDateString('fr-FR')}</TableCell>
                                                <TableCell className="text-right text-xs">{formatMontant(c.montantHT)}</TableCell>
                                                <TableCell className="text-right text-xs font-medium text-indigo-700">{formatMontant(c.montantTVA)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Aucune donnée */}
                                  {(mois.tvaCollectee?.produits?.factures?.length || 0) === 0 &&
                                   (mois.tvaCollectee?.services?.paiements?.length || 0) === 0 &&
                                   (mois.tvaDeductible?.achats?.factures?.length || 0) === 0 &&
                                   (mois.tvaDeductible?.charges?.charges?.length || 0) === 0 && (
                                    <div className="text-center py-6 text-muted-foreground text-sm">
                                      Aucune opération TVA ce mois-ci
                                    </div>
                                  )}

                                  {/* Bouton export mois */}
                                  <div className="flex justify-end pt-2 border-t">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => exportMoisG50Csv(mois, selectedYear)}
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Exporter {mois.nomMois} (.csv)
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}

                    {/* Ligne total annuel */}
                    {g50Data?.moisDetails && (
                      <TableRow className="font-bold border-t-2 bg-muted/20">
                        <TableCell />
                        <TableCell>TOTAL {selectedYear}</TableCell>
                        <TableCell className="text-right">
                          {formatMontant(g50Data.moisDetails.reduce((s: number, m: any) => s + (m.tvaCollectee?.total?.montantHT || 0), 0))}
                        </TableCell>
                        <TableCell className="text-right text-green-700">
                          {formatMontant(g50Data.totalAnnuel?.tvaCollectee || 0)}
                        </TableCell>
                        <TableCell className="text-right text-blue-700">
                          {formatMontant(g50Data.totalAnnuel?.tvaDeductible || 0)}
                        </TableCell>
                        <TableCell className={cn(
                          'text-right',
                          (g50Data.totalAnnuel?.tvaNette || 0) > 0 ? 'text-orange-700' : 'text-green-700'
                        )}>
                          {formatMontant(Math.abs(g50Data.totalAnnuel?.tvaNette || 0))}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Note explicative */}
          <Card className="border-dashed border-muted-foreground/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                <strong>Règles de TVA appliquées :</strong>{' '}
                Factures produits → TVA exigible à la date de facturation (régime des débits).{' '}
                Factures services → TVA exigible à la date d'encaissement du paiement (régime des encaissements).{' '}
                Les avoirs réduisent la TVA collectée du mois de leur émission.{' '}
                Pour la déclaration G50, reportez la TVA nette positive dans la rubrique "TVA à verser" de votre formulaire.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FinancePage;
