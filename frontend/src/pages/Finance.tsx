import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Wallet, AlertTriangle, Receipt,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, Building2,
  ChevronDown, ChevronRight, FileText, Download, Users,
  BadgeDollarSign, CreditCard, BarChart3, ShoppingCart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { facturationStatsApi, commerceApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

// ── Formatters ──────────────────────────────────────────
function fmt(v: number | null | undefined): string {
  if (!v) return '0 DA';
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.', ',') + ' M DA';
  if (Math.abs(v) >= 1_000) return Math.round(v).toLocaleString('fr-FR') + ' DA';
  return v.toFixed(0) + ' DA';
}
function fmtFull(v: number | null | undefined): string {
  if (v === null || v === undefined) return '0,00 DA';
  return new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' DA';
}
function fmtCsv(n: number) { return n.toFixed(2).replace('.', ','); }
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// ── KPI Card ─────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color = 'default', onClick }: {
  title: string; value: string; sub?: string; icon: React.ElementType;
  color?: 'default' | 'green' | 'red' | 'orange' | 'blue' | 'purple';
  onClick?: () => void;
}) {
  const palette = {
    default: { bar: 'bg-gray-300',   icon: 'text-gray-500 bg-gray-100',    num: 'text-gray-900' },
    green:   { bar: 'bg-green-500',  icon: 'text-green-600 bg-green-100',  num: 'text-green-700' },
    red:     { bar: 'bg-red-500',    icon: 'text-red-600 bg-red-100',      num: 'text-red-700' },
    orange:  { bar: 'bg-orange-400', icon: 'text-orange-600 bg-orange-100',num: 'text-orange-700' },
    blue:    { bar: 'bg-blue-500',   icon: 'text-blue-600 bg-blue-100',    num: 'text-blue-700' },
    purple:  { bar: 'bg-purple-500', icon: 'text-purple-600 bg-purple-100',num: 'text-purple-700' },
  };
  const p = palette[color];
  return (
    <div
      className={cn('relative bg-white rounded-xl p-5 shadow-sm overflow-hidden transition-all hover:shadow-md', onClick && 'cursor-pointer hover:-translate-y-0.5')}
      onClick={onClick}
    >
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${p.bar} rounded-b-xl`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">{title}</p>
          <p className={`text-xl font-black tabular-nums leading-none ${p.num}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${p.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ── Mini Bar Chart (pure CSS) ────────────────────────────
function BarChart({ data, height = 80 }: {
  data: { label: string; a: number; b?: number; aColor?: string; bColor?: string }[];
  height?: number;
}) {
  const max = Math.max(...data.map(d => Math.max(d.a, d.b ?? 0)), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity"
          >
            {d.label}: {fmt(d.a)}{d.b !== undefined ? ` / ${fmt(d.b)}` : ''}
          </div>
          <div className="w-full flex gap-px items-end" style={{ height: height - 20 }}>
            {d.b !== undefined && (
              <div
                className={`flex-1 rounded-t transition-all ${d.bColor || 'bg-blue-200'}`}
                style={{ height: `${Math.max(((d.b) / max) * 100, d.b > 0 ? 4 : 0)}%` }}
              />
            )}
            <div
              className={`flex-1 rounded-t transition-all ${d.aColor || 'bg-green-500'}`}
              style={{ height: `${Math.max((d.a / max) * 100, d.a > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className="text-[9px] text-gray-400 font-medium">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── CSV export helpers ────────────────────────────────────
function exportMoisG50Csv(mois: any, annee: number) {
  const S = ';';
  const rows: string[] = [];
  rows.push(`G50 - ${mois.nomMois} ${annee}`);
  rows.push(`Généré le${S}${new Date().toLocaleDateString('fr-FR')}`);
  rows.push('');
  rows.push(['Section', 'Date', 'Référence', 'Client / Fournisseur', 'Base HT (DA)', 'TVA (DA)', 'TTC (DA)'].join(S));
  for (const f of mois.tvaCollectee?.produits?.factures ?? []) {
    const sign = f.type === 'AVOIR' ? -1 : 1;
    rows.push([f.type === 'AVOIR' ? 'Avoir - réduction TVA collectée' : 'TVA Collectée - Produit', new Date(f.dateFacture).toLocaleDateString('fr-FR'), f.ref, f.client?.nomEntreprise ?? '', fmtCsv(f.totalHT * sign), fmtCsv(f.totalTVA * sign), fmtCsv(f.totalTTC * sign)].join(S));
  }
  for (const p of mois.tvaCollectee?.services?.paiements ?? []) {
    rows.push(['TVA Collectée - Service', new Date(p.dateEncaissement ?? p.datePaiement).toLocaleDateString('fr-FR'), p.factureRef, p.client?.nomEntreprise ?? '', fmtCsv(p.htProportionnel), fmtCsv(p.tvaProportionnelle), fmtCsv(p.montantEncaisse)].join(S));
  }
  for (const f of mois.tvaDeductible?.achats?.factures ?? []) {
    rows.push(['TVA Déductible - Achat', new Date(f.dateFacture).toLocaleDateString('fr-FR'), f.ref ?? '', f.fournisseur?.nomEntreprise ?? '', fmtCsv(f.totalHT), fmtCsv(f.totalTVA), fmtCsv(f.totalTTC)].join(S));
  }
  for (const c of mois.tvaDeductible?.charges?.charges ?? []) {
    rows.push(['TVA Déductible - Charge', new Date(c.dateCharge).toLocaleDateString('fr-FR'), '', c.libelle, fmtCsv(c.montantHT), fmtCsv(c.montantTVA), fmtCsv(c.montantTTC)].join(S));
  }
  rows.push(''); rows.push(['RÉSUMÉ', '', '', '', 'Base HT', 'TVA', ''].join(S));
  rows.push(['TVA Collectée', '', '', '', fmtCsv(mois.tvaCollectee?.total?.montantHT ?? 0), fmtCsv(mois.tvaCollectee?.total?.montantTVA ?? 0), ''].join(S));
  rows.push(['TVA Déductible', '', '', '', fmtCsv(mois.tvaDeductible?.total?.montantHT ?? 0), fmtCsv(mois.tvaDeductible?.total?.montantTVA ?? 0), ''].join(S));
  rows.push([`TVA NETTE ${(mois.tvaNette ?? 0) > 0 ? 'À VERSER' : 'CRÉDIT'}`, '', '', '', '', fmtCsv(Math.abs(mois.tvaNette ?? 0)), ''].join(S));
  downloadCsv(rows.join('\n'), `G50_${mois.nomMois}_${annee}.csv`);
}
function exportAnnuelG50Csv(g50Data: any) {
  const S = ';';
  const rows: string[] = [];
  rows.push(`RAPPORT G50 ANNUEL - ${g50Data.annee}`);
  rows.push(`Généré le${S}${new Date().toLocaleDateString('fr-FR')}`);
  rows.push('');
  rows.push('TABLEAU RÉCAPITULATIF');
  rows.push(['Mois', 'CA HT (DA)', 'TVA Collectée (DA)', 'TVA Déductible (DA)', 'TVA Nette (DA)', 'Statut G50'].join(S));
  for (const m of g50Data.moisDetails ?? []) {
    rows.push([m.nomMois, fmtCsv(m.tvaCollectee?.total?.montantHT ?? 0), fmtCsv(m.tvaCollectee?.total?.montantTVA ?? 0), fmtCsv(m.tvaDeductible?.total?.montantTVA ?? 0), fmtCsv(m.tvaNette ?? 0), (m.tvaNette ?? 0) > 0 ? 'À VERSER' : (m.tvaNette ?? 0) < 0 ? 'CRÉDIT' : 'NÉANT'].join(S));
  }
  rows.push([`TOTAL ${g50Data.annee}`, fmtCsv((g50Data.moisDetails ?? []).reduce((s: number, m: any) => s + (m.tvaCollectee?.total?.montantHT ?? 0), 0)), fmtCsv(g50Data.totalAnnuel?.tvaCollectee ?? 0), fmtCsv(g50Data.totalAnnuel?.tvaDeductible ?? 0), fmtCsv(g50Data.totalAnnuel?.tvaNette ?? 0), (g50Data.totalAnnuel?.tvaNette ?? 0) > 0 ? 'À VERSER' : 'CRÉDIT'].join(S));
  downloadCsv(rows.join('\n'), `G50_Annuel_${g50Data.annee}.csv`);
}

// ═══════════════════════════════════════════════════════
export function FinancePage() {
  const { canDo } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!canDo('viewDashboardFinance')) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground gap-3">
        <TrendingUp className="h-10 w-10 opacity-20" />
        <p className="font-medium text-base">Accès restreint</p>
        <p className="text-sm">Vous n'avez pas accès au tableau de bord financier.</p>
      </div>
    );
  }
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expandedMois, setExpandedMois] = useState<number | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab');
  const activeTab = ['dashboard', 'g50'].includes(tabFromUrl ?? '') ? tabFromUrl! : 'dashboard';
  const setActiveTab = (tab: string) => navigate(`${location.pathname}?tab=${tab}`, { replace: true });

  // ── Queries ──
  const { data: anneesDisponibles } = useQuery({
    queryKey: ['finance', 'annees'],
    queryFn: () => facturationStatsApi.getAnneesDisponibles(),
  });
  const years: number[] = anneesDisponibles ?? [currentYear];

  const { data: globalStats, isLoading: loadingGlobal } = useQuery({
    queryKey: ['finance', 'global', selectedYear],
    queryFn: () => facturationStatsApi.getGlobal(selectedYear),
  });
  const { data: tresorerieStats } = useQuery({
    queryKey: ['finance', 'tresorerie', selectedYear],
    queryFn: () => facturationStatsApi.getTresorerie(selectedYear),
  });
  const { data: retardsData } = useQuery({
    queryKey: ['finance', 'retards'],
    queryFn: () => facturationStatsApi.getRetards(),
  });
  const { data: tvaStats } = useQuery({
    queryKey: ['finance', 'tva', selectedYear],
    queryFn: () => facturationStatsApi.getTva(selectedYear),
  });
  const { data: mensuelData } = useQuery({
    queryKey: ['finance', 'mensuel', selectedYear],
    queryFn: () => facturationStatsApi.getMensuel(selectedYear),
  });
  const { data: topClientsData } = useQuery({
    queryKey: ['finance', 'top-clients', selectedYear],
    queryFn: () => facturationStatsApi.getTopClients(selectedYear),
  });
  const { data: commandesFacturables } = useQuery({
    queryKey: ['finance', 'commandes-facturables'],
    queryFn: () => facturationStatsApi.getCommandesFacturables(),
  });
  const { data: facturesData } = useQuery({
    queryKey: ['commerce', 'factures', 'recent'],
    queryFn: () => commerceApi.listFactures({ limit: 8 }),
  });
  const { data: g50Data, isLoading: loadingG50 } = useQuery({
    queryKey: ['finance', 'g50', selectedYear],
    queryFn: () => facturationStatsApi.getG50(selectedYear),
    enabled: activeTab === 'g50',
  });

  // ── Calculs ──
  const caTotal = globalStats?.facturesClients?.totalTTC || 0;
  const caHT = globalStats?.facturesClients?.totalHT || 0;
  const totalPaye = globalStats?.facturesClients?.totalPaye || 0;
  const resteAPayer = globalStats?.facturesClients?.resteAPayer || 0;
  const tauxRecouvrement = caTotal > 0 ? Math.round((totalPaye / caTotal) * 100) : 0;
  const achatsTotal = globalStats?.facturesFournisseurs?.totalTTC || 0;
  const chargesTotal = globalStats?.charges?.montantTTC || 0;
  const resultatBrut = globalStats?.resume?.resultatBrut || 0;
  const encaissements = tresorerieStats?.encaissements?.total || 0;
  const decaissements = tresorerieStats?.decaissements?.total || 0;
  const soldeTresorerie = tresorerieStats?.solde || 0;
  const facturesEnRetard = retardsData?.facturesClients || [];
  const montantRetard = facturesEnRetard.reduce((s: number, f: any) => s + (f.resteAPayer || 0), 0);
  const tvaCollectee = tvaStats?.tvaCollectee?.montant || 0;
  const tvaDeductible = tvaStats?.tvaDeductible?.montant || 0;
  const tvaAPayer = tvaStats?.tvaNette || 0;
  const nbCommandesFacturables = commandesFacturables?.commandesClients?.length || 0;
  const recentFactures = facturesData?.factures?.slice(0, 6) || [];
  const topClients = topClientsData?.topClients || [];
  const evolutionMensuelle = tresorerieStats?.evolutionMensuelle || [];
  const mensuelMois = mensuelData?.mois || [];

  const currentMonth = new Date().getMonth() + 1;
  const currentMoisData = g50Data?.moisDetails?.find((m: any) => m.mois === currentMonth);

  // ── Bar chart data (CA vs encaissements par mois) ──
  const chartData = mensuelMois.map((m: any) => {
    const enc = evolutionMensuelle.find((e: any) => e.mois === m.mois);
    return { label: m.label, a: m.caTTC, b: enc?.encaissements ?? 0, aColor: 'bg-green-500', bColor: 'bg-blue-200' };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Finance & Trésorerie</h1>
            <p className="text-sm text-gray-400 mt-0.5">Situation financière consolidée — {selectedYear}</p>
          </div>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-28 h-9 text-sm border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white shadow-sm border border-gray-100">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4" /> Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="g50" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <FileText className="h-4 w-4" /> Déclarations TVA (G50)
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB DASHBOARD ═══ */}
          <TabsContent value="dashboard" className="space-y-5 mt-5">

            {/* Row 1 : 6 KPIs */}
            {loadingGlobal ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl p-5 h-28 animate-pulse shadow-sm" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard title="CA TTC" value={fmt(caTotal)} sub={`${fmt(caHT)} HT`} icon={TrendingUp} color="green" />
                <KpiCard
                  title="Résultat brut"
                  value={fmt(resultatBrut)}
                  sub="CA − Achats − Charges"
                  icon={resultatBrut >= 0 ? TrendingUp : TrendingDown}
                  color={resultatBrut >= 0 ? 'green' : 'red'}
                />
                <KpiCard title="Solde tréso." value={fmt(soldeTresorerie)} sub="Encaiss. − Décaiss." icon={Wallet} color={soldeTresorerie >= 0 ? 'blue' : 'orange'} />
                <KpiCard
                  title="Recouvrement"
                  value={`${tauxRecouvrement}%`}
                  sub={`${fmt(resteAPayer)} restant`}
                  icon={CreditCard}
                  color={tauxRecouvrement >= 80 ? 'green' : tauxRecouvrement >= 50 ? 'orange' : 'red'}
                />
                <KpiCard
                  title="En retard"
                  value={fmt(montantRetard)}
                  sub={`${facturesEnRetard.length} facture(s)`}
                  icon={AlertTriangle}
                  color={facturesEnRetard.length > 0 ? 'red' : 'default'}
                  onClick={() => navigate('/commerce?tab=factures')}
                />
                <KpiCard
                  title="À facturer"
                  value={String(nbCommandesFacturables)}
                  sub="commande(s) sans facture"
                  icon={ShoppingCart}
                  color={nbCommandesFacturables > 0 ? 'orange' : 'default'}
                  onClick={() => navigate('/commerce?tab=commandes')}
                />
              </div>
            )}

            {/* Row 2 : Graphique mensuel + Trésorerie flux */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Évolution mensuelle CA vs Encaissements */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">Évolution mensuelle</h3>
                    <p className="text-xs text-gray-400 mt-0.5">CA facturé (vert) vs Encaissements (bleu) — {selectedYear}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />CA TTC</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" />Encaissé</span>
                  </div>
                </div>
                {chartData.length > 0 ? (
                  <BarChart data={chartData} height={120} />
                ) : (
                  <div className="flex items-center justify-center h-24 text-sm text-gray-400">Pas de données pour {selectedYear}</div>
                )}
              </div>

              {/* Flux trésorerie */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-gray-400" /> Flux de trésorerie
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-700">Encaissements</span>
                    </div>
                    <span className="font-bold text-green-700">{fmt(encaissements)}</span>
                  </div>
                  <div className="pl-4 space-y-1.5 text-xs text-gray-500">
                    <div className="flex justify-between"><span>Clients</span><span>{fmt(tresorerieStats?.encaissements?.facturesClients)}</span></div>
                    <div className="flex justify-between"><span>Divers</span><span>{fmt(tresorerieStats?.encaissements?.paiementsDivers)}</span></div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-gray-700">Décaissements</span>
                    </div>
                    <span className="font-bold text-red-700">{fmt(decaissements)}</span>
                  </div>
                  <div className="pl-4 space-y-1.5 text-xs text-gray-500">
                    <div className="flex justify-between"><span>Fournisseurs</span><span>{fmt(tresorerieStats?.decaissements?.facturesFournisseurs)}</span></div>
                    <div className="flex justify-between"><span>Charges</span><span>{fmt(tresorerieStats?.decaissements?.charges)}</span></div>
                    <div className="flex justify-between"><span>Divers</span><span>{fmt(tresorerieStats?.decaissements?.paiementsDivers)}</span></div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">Solde net</span>
                      <span className={cn('font-black text-lg', soldeTresorerie >= 0 ? 'text-green-700' : 'text-red-700')}>
                        {fmt(soldeTresorerie)}
                      </span>
                    </div>
                    <Progress
                      value={decaissements > 0 ? Math.min((encaissements / decaissements) * 100, 100) : 100}
                      className={cn('h-1.5 mt-2', encaissements >= decaissements ? '[&>div]:bg-green-500' : '[&>div]:bg-orange-400')}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      Ratio {decaissements > 0 ? ((encaissements / decaissements) * 100).toFixed(0) : '100'}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3 : Top clients + TVA + Charges répartition */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Top clients */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="font-bold text-gray-800">Top clients</span>
                  </div>
                  <span className="text-xs text-gray-400">par CA TTC — {selectedYear}</span>
                </div>
                {topClients.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">Aucune donnée</div>
                ) : (
                  <div className="p-3 space-y-2">
                    {topClients.map((c: any, i: number) => {
                      const pct = topClientsData?.totalCA > 0 ? (c.totalTTC / topClientsData.totalCA) * 100 : 0;
                      return (
                        <div key={c.client.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <span className="w-5 text-xs font-black text-gray-300 text-center">{i + 1}</span>
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-black text-green-700">{(c.client.nomEntreprise || '?')[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-900 truncate">{c.client.nomEntreprise}</span>
                              <span className="text-sm font-bold text-gray-900 flex-shrink-0 ml-2">{fmt(c.totalTTC)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">{pct.toFixed(0)}%</span>
                              <Badge
                                className={cn('text-[9px] px-1.5 py-0 flex-shrink-0', c.tauxRecouvrement >= 100 ? 'bg-green-100 text-green-700' : c.tauxRecouvrement >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700')}
                              >
                                {c.tauxRecouvrement}% rec.
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* TVA + Charges */}
              <div className="space-y-4">
                {/* TVA */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-gray-400" /> Situation TVA
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2.5 bg-green-50 rounded-lg text-sm">
                      <span className="text-gray-600">Collectée</span>
                      <span className="font-bold text-green-700">{fmt(tvaCollectee)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-blue-50 rounded-lg text-sm">
                      <span className="text-gray-600">Déductible</span>
                      <span className="font-bold text-blue-700">{fmt(tvaDeductible)}</span>
                    </div>
                    <div className={cn('flex justify-between items-center p-2.5 rounded-lg text-sm', tvaAPayer >= 0 ? 'bg-orange-50' : 'bg-green-50')}>
                      <span className="font-semibold text-gray-700">{tvaAPayer >= 0 ? 'À verser' : 'Crédit TVA'}</span>
                      <span className={cn('font-black', tvaAPayer >= 0 ? 'text-orange-700' : 'text-green-700')}>{fmt(Math.abs(tvaAPayer))}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setActiveTab('g50')}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Détail G50 mensuel
                  </Button>
                </div>

                {/* Dépenses */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <BadgeDollarSign className="h-4 w-4 text-gray-400" /> Dépenses
                  </h3>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Achats fournisseurs</span>
                      <span className="font-semibold">{fmt(achatsTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Charges</span>
                      <span className="font-semibold">{fmt(chargesTotal)}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-semibold text-gray-700">Total</span>
                      <span className="font-black text-red-700">{fmt(achatsTotal + chargesTotal)}</span>
                    </div>
                    {caTotal > 0 && (
                      <div className="pt-1">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Ratio dépenses / CA</span>
                          <span>{((achatsTotal + chargesTotal) / caTotal * 100).toFixed(0)}%</span>
                        </div>
                        <Progress
                          value={Math.min(((achatsTotal + chargesTotal) / caTotal) * 100, 100)}
                          className="h-1.5 [&>div]:bg-orange-400"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 4 : Factures en retard + Dernières factures */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Factures en retard */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-red-500" />
                    <span className="font-bold text-gray-800">Factures en retard</span>
                    {facturesEnRetard.length > 0 && (
                      <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{facturesEnRetard.length}</span>
                    )}
                  </div>
                  {facturesEnRetard.length > 0 && (
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate('/commerce?tab=factures')}>Voir tout</Button>
                  )}
                </div>
                {facturesEnRetard.length === 0 ? (
                  <div className="flex flex-col items-center py-10">
                    <CheckCircle2 className="h-10 w-10 text-green-400 mb-2" />
                    <p className="text-sm text-gray-500 font-semibold">Aucune facture en retard</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-1">
                    {facturesEnRetard.slice(0, 6).map((f: any) => (
                      <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/commerce?tab=factures`)}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{f.ref}</p>
                          <p className="text-xs text-gray-400 truncate">{f.client?.nomEntreprise || '—'}</p>
                        </div>
                        <Badge variant="destructive" className="text-[10px] px-1.5 flex-shrink-0">{f.joursRetard}j</Badge>
                        <span className="text-sm font-bold text-red-600 flex-shrink-0">{fmt(f.resteAPayer)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dernières factures */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Receipt className="h-4 w-4 text-gray-400" />
                    <span className="font-bold text-gray-800">Dernières factures</span>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate('/commerce?tab=factures')}>Voir tout</Button>
                </div>
                <div className="p-3 space-y-1">
                  {recentFactures.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-400">Aucune facture</div>
                  ) : recentFactures.map((f: any) => {
                    const statutCfg: Record<string, { bg: string; label: string }> = {
                      PAYEE:                { bg: 'bg-green-100 text-green-700', label: 'Payée' },
                      VALIDEE:              { bg: 'bg-blue-100 text-blue-700',   label: 'Validée' },
                      PARTIELLEMENT_PAYEE:  { bg: 'bg-orange-100 text-orange-700', label: 'Partiel' },
                      BROUILLON:            { bg: 'bg-gray-100 text-gray-600',   label: 'Brouillon' },
                      ANNULEE:              { bg: 'bg-red-100 text-red-600',     label: 'Annulée' },
                    };
                    const s = statutCfg[f.statut] || { bg: 'bg-gray-100 text-gray-600', label: f.statut };
                    return (
                      <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{f.ref}</p>
                          <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                            <Building2 className="h-3 w-3" />{f.client?.nomEntreprise || '—'}
                          </p>
                        </div>
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0', s.bg)}>{s.label}</span>
                        <span className="text-sm font-bold text-gray-900 flex-shrink-0">{fmt(f.totalTTC)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </TabsContent>

          {/* ═══ TAB G50 ═══ */}
          <TabsContent value="g50" className="space-y-6 mt-4">
            {/* Bandeau mois en cours */}
            {currentMoisData && selectedYear === currentYear && (
              <Card className={cn('border-2', (currentMoisData.tvaNette || 0) > 0 ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Receipt className={cn('h-6 w-6', (currentMoisData.tvaNette || 0) > 0 ? 'text-orange-600' : 'text-green-600')} />
                      <div>
                        <p className="font-semibold text-sm">G50 — {currentMoisData.nomMois} {selectedYear}</p>
                        <p className="text-xs text-muted-foreground">Déclaration du mois en cours</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground">Collectée</p>
                        <p className="font-bold text-green-700">{fmtFull(currentMoisData.tvaCollectee?.total?.montantTVA || 0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Déductible</p>
                        <p className="font-bold text-blue-700">{fmtFull(currentMoisData.tvaDeductible?.total?.montantTVA || 0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">{(currentMoisData.tvaNette || 0) > 0 ? 'TVA à verser' : 'Crédit TVA'}</p>
                        <p className={cn('font-bold text-lg', (currentMoisData.tvaNette || 0) > 0 ? 'text-orange-700' : 'text-green-700')}>
                          {fmtFull(Math.abs(currentMoisData.tvaNette || 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* KPIs G50 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="TVA collectée" value={fmt(g50Data?.totalAnnuel?.tvaCollectee || 0)} sub={`Année ${selectedYear}`} icon={TrendingUp} />
              <KpiCard title="dont Produits" value={fmt(g50Data?.moisDetails?.reduce((s: number, m: any) => s + (m.tvaCollectee?.produits?.montantTVA || 0), 0) || 0)} sub="Sur date de facturation" icon={Receipt} />
              <KpiCard title="dont Services" value={fmt(g50Data?.moisDetails?.reduce((s: number, m: any) => s + (m.tvaCollectee?.services?.montantTVA || 0), 0) || 0)} sub="Sur encaissement" icon={Receipt} />
              <KpiCard title="TVA à verser" value={fmt(g50Data?.totalAnnuel?.aPayer || 0)} sub="Collectée − Déductible" icon={AlertTriangle} color={(g50Data?.totalAnnuel?.aPayer || 0) > 0 ? 'orange' : 'green'} />
            </div>

            {/* Tableau G50 */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Situation TVA mensuelle — G50 {selectedYear}</CardTitle>
                  <CardDescription>Produits : exigible à la facturation · Services : exigible à l'encaissement · Cliquez sur un mois pour le détail</CardDescription>
                </div>
                {g50Data && (
                  <Button variant="outline" size="sm" onClick={() => exportAnnuelG50Csv(g50Data)} className="shrink-0">
                    <Download className="h-4 w-4 mr-2" />Export CSV annuel
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {loadingG50 ? (
                  <div className="text-center py-10 text-muted-foreground">Chargement...</div>
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
                        <TableHead className="text-center">Statut</TableHead>
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
                              className={cn('cursor-pointer hover:bg-muted/50 transition-colors', isCurrentMonth && 'bg-amber-50 hover:bg-amber-100', isExpanded && 'bg-muted/30')}
                              onClick={() => setExpandedMois(isExpanded ? null : mois.mois)}
                            >
                              <TableCell>{isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {mois.nomMois}
                                  {isCurrentMonth && <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">Ce mois</Badge>}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm">{fmtFull(mois.tvaCollectee?.total?.montantHT || 0)}</TableCell>
                              <TableCell className="text-right font-medium text-green-700">{fmtFull(mois.tvaCollectee?.total?.montantTVA || 0)}</TableCell>
                              <TableCell className="text-right font-medium text-blue-700">{fmtFull(mois.tvaDeductible?.total?.montantTVA || 0)}</TableCell>
                              <TableCell className={cn('text-right font-bold', (mois.tvaNette || 0) > 0 ? 'text-orange-700' : (mois.tvaNette || 0) < 0 ? 'text-green-700' : 'text-muted-foreground')}>
                                {(mois.tvaNette || 0) < 0 && '− '}{fmtFull(Math.abs(mois.tvaNette || 0))}
                              </TableCell>
                              <TableCell className="text-center">
                                {!hasData ? <Badge variant="outline" className="text-xs">Néant</Badge>
                                  : (mois.tvaNette || 0) > 0 ? <Badge className="bg-orange-100 text-orange-700 border border-orange-200 text-xs">À verser</Badge>
                                  : (mois.tvaNette || 0) < 0 ? <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">Crédit</Badge>
                                  : <Badge variant="outline" className="text-xs">Équilibré</Badge>}
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow key={`detail-${mois.mois}`}>
                                <TableCell colSpan={7} className="p-0 bg-slate-50/80 border-b">
                                  <div className="p-5 space-y-5">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                        <p className="text-xs text-muted-foreground mb-1">Collectée Produits</p>
                                        <p className="font-bold text-green-700">{fmtFull(mois.tvaCollectee?.produits?.montantTVA || 0)}</p>
                                        <p className="text-xs text-muted-foreground">{mois.tvaCollectee?.produits?.factures?.length || 0} facture(s)</p>
                                      </div>
                                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                        <p className="text-xs text-muted-foreground mb-1">Collectée Services</p>
                                        <p className="font-bold text-emerald-700">{fmtFull(mois.tvaCollectee?.services?.montantTVA || 0)}</p>
                                        <p className="text-xs text-muted-foreground">{mois.tvaCollectee?.services?.paiements?.length || 0} paiement(s)</p>
                                      </div>
                                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="text-xs text-muted-foreground mb-1">Déductible Achats</p>
                                        <p className="font-bold text-blue-700">{fmtFull(mois.tvaDeductible?.achats?.montantTVA || 0)}</p>
                                        <p className="text-xs text-muted-foreground">{mois.tvaDeductible?.achats?.factures?.length || 0} facture(s)</p>
                                      </div>
                                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                                        <p className="text-xs text-muted-foreground mb-1">Déductible Charges</p>
                                        <p className="font-bold text-indigo-700">{fmtFull(mois.tvaDeductible?.charges?.montantTVA || 0)}</p>
                                        <p className="text-xs text-muted-foreground">{mois.tvaDeductible?.charges?.charges?.length || 0} charge(s)</p>
                                      </div>
                                    </div>

                                    {(mois.tvaCollectee?.produits?.factures?.length || 0) > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Factures Produits — TVA collectée</h4>
                                        <div className="rounded-md border overflow-hidden">
                                          <Table>
                                            <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-xs">Référence</TableHead><TableHead className="text-xs">Client</TableHead><TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-right text-xs">Base HT</TableHead><TableHead className="text-right text-xs">TVA</TableHead><TableHead className="text-right text-xs">TTC</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                              {mois.tvaCollectee.produits.factures.map((f: any) => (
                                                <TableRow key={f.id} className={f.type === 'AVOIR' ? 'bg-red-50' : ''}>
                                                  <TableCell className="font-mono text-xs">{f.ref}</TableCell>
                                                  <TableCell className="text-xs">{f.client?.nomEntreprise || '—'}</TableCell>
                                                  <TableCell className="text-xs">{new Date(f.dateFacture).toLocaleDateString('fr-FR')}</TableCell>
                                                  <TableCell>{f.type === 'AVOIR' ? <Badge variant="outline" className="text-xs border-red-300 text-red-600">Avoir</Badge> : <Badge variant="outline" className="text-xs">Facture</Badge>}</TableCell>
                                                  <TableCell className="text-right text-xs">{fmtFull(f.totalHT)}</TableCell>
                                                  <TableCell className={cn('text-right text-xs font-medium', f.type === 'AVOIR' ? 'text-red-600' : 'text-green-700')}>{f.type === 'AVOIR' ? '−' : ''}{fmtFull(f.totalTVA)}</TableCell>
                                                  <TableCell className="text-right text-xs">{fmtFull(f.totalTTC)}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    )}

                                    {(mois.tvaCollectee?.services?.paiements?.length || 0) > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Paiements Services — TVA collectée sur encaissement</h4>
                                        <div className="rounded-md border overflow-hidden">
                                          <Table>
                                            <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-xs">Facture</TableHead><TableHead className="text-xs">Client</TableHead><TableHead className="text-xs">Date encaiss.</TableHead><TableHead className="text-right text-xs">Encaissé</TableHead><TableHead className="text-right text-xs">Base HT prop.</TableHead><TableHead className="text-right text-xs">TVA prop.</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                              {mois.tvaCollectee.services.paiements.map((p: any) => (
                                                <TableRow key={p.id}>
                                                  <TableCell className="font-mono text-xs">{p.factureRef}</TableCell>
                                                  <TableCell className="text-xs">{p.client?.nomEntreprise || '—'}</TableCell>
                                                  <TableCell className="text-xs">{new Date(p.dateEncaissement || p.datePaiement).toLocaleDateString('fr-FR')}</TableCell>
                                                  <TableCell className="text-right text-xs">{fmtFull(p.montantEncaisse)}</TableCell>
                                                  <TableCell className="text-right text-xs">{fmtFull(p.htProportionnel)}</TableCell>
                                                  <TableCell className="text-right text-xs font-medium text-emerald-700">{fmtFull(p.tvaProportionnelle)}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    )}

                                    {(mois.tvaDeductible?.achats?.factures?.length || 0) > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Factures Fournisseurs — TVA déductible</h4>
                                        <div className="rounded-md border overflow-hidden">
                                          <Table>
                                            <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-xs">Référence</TableHead><TableHead className="text-xs">Fournisseur</TableHead><TableHead className="text-xs">Date</TableHead><TableHead className="text-right text-xs">Base HT</TableHead><TableHead className="text-right text-xs">TVA</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                              {mois.tvaDeductible.achats.factures.map((f: any) => (
                                                <TableRow key={f.id}>
                                                  <TableCell className="font-mono text-xs">{f.ref || f.id.substring(0, 8)}</TableCell>
                                                  <TableCell className="text-xs">{f.fournisseur?.nomEntreprise || '—'}</TableCell>
                                                  <TableCell className="text-xs">{new Date(f.dateFacture).toLocaleDateString('fr-FR')}</TableCell>
                                                  <TableCell className="text-right text-xs">{fmtFull(f.totalHT)}</TableCell>
                                                  <TableCell className="text-right text-xs font-medium text-blue-700">{fmtFull(f.totalTVA)}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    )}

                                    {(mois.tvaDeductible?.charges?.charges?.length || 0) > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />Charges — TVA déductible</h4>
                                        <div className="rounded-md border overflow-hidden">
                                          <Table>
                                            <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-xs">Libellé</TableHead><TableHead className="text-xs">Fournisseur</TableHead><TableHead className="text-xs">Date</TableHead><TableHead className="text-right text-xs">Base HT</TableHead><TableHead className="text-right text-xs">TVA</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                              {mois.tvaDeductible.charges.charges.map((c: any) => (
                                                <TableRow key={c.id}>
                                                  <TableCell className="text-xs">{c.libelle}</TableCell>
                                                  <TableCell className="text-xs">{c.fournisseur?.nomEntreprise || '—'}</TableCell>
                                                  <TableCell className="text-xs">{new Date(c.dateCharge).toLocaleDateString('fr-FR')}</TableCell>
                                                  <TableCell className="text-right text-xs">{fmtFull(c.montantHT)}</TableCell>
                                                  <TableCell className="text-right text-xs font-medium text-indigo-700">{fmtFull(c.montantTVA)}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    )}

                                    {(mois.tvaCollectee?.produits?.factures?.length || 0) === 0 && (mois.tvaCollectee?.services?.paiements?.length || 0) === 0 && (mois.tvaDeductible?.achats?.factures?.length || 0) === 0 && (mois.tvaDeductible?.charges?.charges?.length || 0) === 0 && (
                                      <div className="text-center py-6 text-muted-foreground text-sm">Aucune opération TVA ce mois-ci</div>
                                    )}

                                    <div className="flex justify-end pt-2 border-t">
                                      <Button variant="outline" size="sm" onClick={() => exportMoisG50Csv(mois, selectedYear)}>
                                        <Download className="h-4 w-4 mr-2" />Exporter {mois.nomMois} (.csv)
                                      </Button>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}

                      {g50Data?.moisDetails && (
                        <TableRow className="font-bold border-t-2 bg-muted/20">
                          <TableCell /><TableCell>TOTAL {selectedYear}</TableCell>
                          <TableCell className="text-right">{fmtFull(g50Data.moisDetails.reduce((s: number, m: any) => s + (m.tvaCollectee?.total?.montantHT || 0), 0))}</TableCell>
                          <TableCell className="text-right text-green-700">{fmtFull(g50Data.totalAnnuel?.tvaCollectee || 0)}</TableCell>
                          <TableCell className="text-right text-blue-700">{fmtFull(g50Data.totalAnnuel?.tvaDeductible || 0)}</TableCell>
                          <TableCell className={cn('text-right', (g50Data.totalAnnuel?.tvaNette || 0) > 0 ? 'text-orange-700' : 'text-green-700')}>{fmtFull(Math.abs(g50Data.totalAnnuel?.tvaNette || 0))}</TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-dashed border-muted-foreground/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  <strong>Règles TVA :</strong> Factures produits → exigible à la date de facturation (régime des débits). Factures services → exigible à la date d'encaissement (régime des encaissements). Les avoirs réduisent la TVA collectée du mois d'émission.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default FinancePage;
