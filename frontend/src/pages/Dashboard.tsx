import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowRight,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dashboardApi, interventionsApi } from '@/services/api';
import { formatDate, getStatutColor, getStatutLabel } from '@/lib/utils';
import type { Intervention, Alerte } from '@/types';

function StatCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
  link,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'error' | 'success';
  link?: string;
}) {
  const colors = {
    default: 'bg-blue-50 text-blue-600',
    warning: 'bg-yellow-50 text-yellow-600',
    error: 'bg-red-50 text-red-600',
    success: 'bg-green-50 text-green-600',
  };

  const content = (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${colors[variant]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (link) {
    return <Link to={link}>{content}</Link>;
  }

  return content;
}

function InterventionsList({
  title,
  interventions,
  emptyMessage,
  showDate = true,
}: {
  title: string;
  interventions: Intervention[];
  emptyMessage: string;
  showDate?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {interventions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-3">
            {interventions.slice(0, 5).map((intervention) => (
              <Link
                key={intervention.id}
                to={`/planning?interventionId=${intervention.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {intervention.client?.nomEntreprise}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getStatutColor(intervention.statut)} variant="secondary">
                      {getStatutLabel(intervention.statut)}
                    </Badge>
                    {intervention.prestation && (
                      <span className="text-xs text-muted-foreground">
                        {intervention.prestation}
                      </span>
                    )}
                  </div>
                </div>
                {showDate && (
                  <div className="text-right ml-4">
                    <p className="text-sm font-medium">
                      {formatDate(intervention.datePrevue)}
                    </p>
                    {intervention.heurePrevue && (
                      <p className="text-xs text-muted-foreground">
                        {intervention.heurePrevue}
                      </p>
                    )}
                  </div>
                )}
              </Link>
            ))}
            {interventions.length > 5 && (
              <Link
                to="/planning"
                className="flex items-center justify-center gap-2 p-2 text-sm text-primary hover:underline"
              >
                Voir tout ({interventions.length})
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertesList({ alertes }: { alertes: Alerte[] }) {
  if (alertes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Aucune alerte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tous les contrats actifs ont des interventions planifiées.
          </p>
        </CardContent>
      </Card>
    );
  }

  const contratsAlertes = alertes.filter(a => a.type === 'CONTRAT_SANS_INTERVENTION');
  const ponctuelAlertes = alertes.filter(a => a.type === 'PONCTUEL_DERNIERE_OPERATION');
  const horsValiditeAlertes = alertes.filter(a => a.type === 'CONTRAT_HORS_VALIDITE');

  return (
    <div className="space-y-4">
      {ponctuelAlertes.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-5 w-5" />
              Dernière opération ({ponctuelAlertes.length})
            </CardTitle>
            <CardDescription className="text-yellow-600">
              Ces contrats ponctuels n'ont plus qu'une seule opération restante
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ponctuelAlertes.map((alerte) => (
                <Link
                  key={alerte.id}
                  to={`/contrats/${alerte.contratId}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-white border border-yellow-100 hover:border-yellow-300 transition-colors"
                >
                  <div>
                    <p className="font-medium">{alerte.client.nomEntreprise}</p>
                    <p className="text-sm text-muted-foreground">
                      {alerte.numeroBonCommande && <span className="font-medium">BC: {alerte.numeroBonCommande} • </span>}
                      {alerte.prestations.slice(0, 2).join(', ')}
                      {alerte.prestations.length > 2 && '...'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-700">
                    Voir
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {contratsAlertes.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              Contrats sans intervention ({contratsAlertes.length})
            </CardTitle>
            <CardDescription className="text-red-600">
              Ces contrats actifs n'ont aucune intervention future planifiée
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {contratsAlertes.map((alerte) => (
                <Link
                  key={alerte.id}
                  to={`/contrats/${alerte.contratId}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-white border border-red-100 hover:border-red-300 transition-colors"
                >
                  <div>
                    <p className="font-medium">{alerte.client.nomEntreprise}</p>
                    <p className="text-sm text-muted-foreground">
                      {alerte.prestations.slice(0, 2).join(', ')}
                      {alerte.prestations.length > 2 && '...'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="border-red-300 text-red-700">
                    Voir
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {horsValiditeAlertes.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
              <AlertTriangle className="h-5 w-5" />
              Interventions après date de fin ({horsValiditeAlertes.length})
            </CardTitle>
            <CardDescription className="text-blue-600">
              Des interventions sont planifiées après la date de validité du contrat annuel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {horsValiditeAlertes.map((alerte) => (
                <Link
                  key={alerte.id}
                  to={`/contrats/${alerte.contratId}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-white border border-blue-100 hover:border-blue-300 transition-colors"
                >
                  <div>
                    <p className="font-medium">{alerte.client.nomEntreprise}</p>
                    <p className="text-sm text-muted-foreground">
                      {alerte.count ? `${alerte.count} intervention(s) au-delà de la date` : 'Interventions hors validité'}
                      {alerte.dateFin && (
                        <span> • fin: {formatDate(alerte.dateFin as string)}</span>
                      )}
                      {alerte.nextDate && (
                        <span> • prochaine: {formatDate(alerte.nextDate as string)}</span>
                      )}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="border-blue-300 text-blue-700">
                    Voir
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.stats,
  });

  const { data: alertesData } = useQuery({
    queryKey: ['dashboard-alertes'],
    queryFn: dashboardApi.alertes,
  });

  const { data: enRetard = [] } = useQuery({
    queryKey: ['interventions-en-retard'],
    queryFn: interventionsApi.enRetard,
  });

  const { data: aPlanifier = [] } = useQuery({
    queryKey: ['interventions-a-planifier'],
    queryFn: () => interventionsApi.aPlanifier(7),
  });

  const { data: semaine = [] } = useQuery({
    queryKey: ['interventions-semaine'],
    queryFn: interventionsApi.semaine,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble du planning et des alertes
          </p>
        </div>
        <Link to="/planning">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle intervention
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="À planifier (7j)"
          value={stats?.aPlanifier || 0}
          icon={Clock}
          variant="warning"
          link="/planning?view=a-planifier"
        />
        <StatCard
          title="En retard"
          value={stats?.enRetard || 0}
          icon={AlertTriangle}
          variant={stats?.enRetard ? 'error' : 'default'}
          link="/planning?view=en-retard"
        />
        <StatCard
          title="Contrôles (30j)"
          value={stats?.controles30j || 0}
          icon={CheckCircle}
          variant="success"
          link="/planning?type=CONTROLE"
        />
        <StatCard
          title="Contrats en alerte"
          value={(stats?.contratsEnAlerte || 0) + (stats?.ponctuelAlerte || 0)}
          icon={AlertCircle}
          variant={(stats?.contratsEnAlerte || stats?.ponctuelAlerte) ? 'error' : 'default'}
        />
      </div>

      {/* Alertes */}
      {alertesData && alertesData.alertes.length > 0 && (
        <AlertesList alertes={alertesData.alertes} />
      )}

      {/* Listes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InterventionsList
          title="En retard"
          interventions={enRetard}
          emptyMessage="Aucune intervention en retard"
        />
        <InterventionsList
          title="À planifier cette semaine"
          interventions={aPlanifier}
          emptyMessage="Aucune intervention à planifier"
        />
      </div>

      {/* Cette semaine */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cette semaine
          </CardTitle>
          <CardDescription>
            {semaine.length} intervention(s) prévue(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {semaine.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune intervention prévue cette semaine
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {semaine.slice(0, 9).map((intervention) => (
                <Link
                  key={intervention.id}
                  to={`/planning?interventionId=${intervention.id}`}
                  className="p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getStatutColor(intervention.statut)} variant="secondary">
                      {getStatutLabel(intervention.type)}
                    </Badge>
                    <span className="text-sm font-medium">
                      {formatDate(intervention.datePrevue, 'EEE dd')}
                    </span>
                  </div>
                  <p className="font-medium truncate">
                    {intervention.client?.nomEntreprise}
                  </p>
                  {intervention.prestation && (
                    <p className="text-sm text-muted-foreground truncate">
                      {intervention.prestation}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
