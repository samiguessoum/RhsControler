import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useNavigate } from 'react-router-dom';

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

export function FinancePage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Queries
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

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Calculs - mapping correct depuis l'API
  const caTotal = globalStats?.facturesClients?.totalTTC || 0;
  const achatsTotal = globalStats?.facturesFournisseurs?.totalTTC || 0;
  const chargesTotal = globalStats?.charges?.montantTTC || 0;
  const resultatBrut = globalStats?.resume?.resultatBrut || (caTotal - achatsTotal - chargesTotal);

  // Trésorerie - structure correcte de l'API
  const encaissements = tresorerieStats?.encaissements?.total || 0;
  const decaissements = tresorerieStats?.decaissements?.total || 0;
  const soldeTresorerie = tresorerieStats?.solde || (encaissements - decaissements);

  const facturesEnRetard = retardsData?.facturesClients || [];
  const montantRetard = facturesEnRetard.reduce((sum: number, f: any) => sum + (f.resteAPayer || 0), 0);

  // TVA - structure correcte de l'API
  const tvaCollectee = tvaStats?.tvaCollectee?.montant || 0;
  const tvaDeductible = tvaStats?.tvaDeductible?.montant || 0;
  const tvaAPayer = tvaStats?.tvaNette || (tvaCollectee - tvaDeductible);

  const recentFactures = facturesData?.factures?.slice(0, 5) || [];

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

      {/* Indicateur d'erreur */}
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

      {/* Indicateur de chargement */}
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

            {/* Barre de progression */}
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

        {/* TVA */}
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
              <Button variant="outline" size="sm" onClick={() => navigate('/commerce')}>
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
                    <TableRow key={facture.id}>
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
    </div>
  );
}

export default FinancePage;
