import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ArrowLeft, Plus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { contratsApi, interventionsApi } from '@/services/api';
import { formatDate, getStatutColor, getStatutLabel } from '@/lib/utils';
import type { Frequence } from '@/types';

const FREQUENCE_LABELS: Record<Frequence, string> = {
  HEBDOMADAIRE: 'Hebdomadaire',
  MENSUELLE: 'Mensuelle',
  TRIMESTRIELLE: 'Trimestrielle',
  SEMESTRIELLE: 'Semestrielle',
  ANNUELLE: 'Annuelle',
  PERSONNALISEE: 'Personnalisée',
};

export function ContratDetailPage() {
  const { id } = useParams();

  const { data: contrat, isLoading } = useQuery({
    queryKey: ['contrat', id],
    queryFn: () => contratsApi.get(id!),
    enabled: !!id,
  });

  const { data: interventionsData } = useQuery({
    queryKey: ['interventions-contrat', id],
    queryFn: () => interventionsApi.list({ contratId: id!, limit: 50 }),
    enabled: !!id,
  });

  if (isLoading || !contrat) {
    return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;
  }

  const interventions = interventionsData?.interventions || [];
  const isPonctuel = contrat.type === 'PONCTUEL';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/contrats">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{contrat.client?.nomEntreprise}</h1>
            <p className="text-muted-foreground">
              {isPonctuel ? (
                <span className="text-yellow-600 font-medium">Ponctuel</span>
              ) : (
                'Annuel'
              )} • {contrat.statut}
              {contrat.numeroBonCommande && (
                <span className="ml-2">• BC: {contrat.numeroBonCommande}</span>
              )}
            </p>
          </div>
        </div>
        <Link to="/planning">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle intervention
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Détails du contrat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <span>
                Début: {formatDate(contrat.dateDebut)}{' '}
                {contrat.dateFin && `• Fin: ${formatDate(contrat.dateFin)}`}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {contrat.prestations.map((p) => (
                <Badge key={p} variant="outline" className="text-xs">
                  {p}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {contrat.frequenceOperations && (
                <Badge variant="secondary" className="text-xs">
                  Opérations: {FREQUENCE_LABELS[contrat.frequenceOperations]}
                </Badge>
              )}
              {contrat.frequenceControle && (
                <Badge variant="secondary" className="text-xs">
                  Contrôles: {FREQUENCE_LABELS[contrat.frequenceControle]}
                </Badge>
              )}
            </div>
            {contrat.notes && (
              <div>
                <span className="text-muted-foreground">Notes:</span>
                <p className="mt-1">{contrat.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interventions</span>
              <span className="font-medium">{interventions.length}</span>
            </div>
            {isPonctuel && contrat.nombreOperations && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opérations prévues</span>
                <span className="font-medium">{contrat.nombreOperations}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-créer prochaine</span>
              <span className="font-medium">{contrat.autoCreerProchaine ? 'Oui' : 'Non'}</span>
            </div>
            {!isPonctuel && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reconduction auto</span>
                <span className="font-medium">{contrat.reconductionAuto ? 'Oui' : 'Non'}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sites du contrat */}
      {contrat.contratSites && contrat.contratSites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Sites du contrat ({contrat.contratSites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contrat.contratSites.map((cs) => (
                <div key={cs.id} className="p-4 rounded-lg border bg-gray-50/50">
                  <h4 className="font-medium">{cs.site?.nom}</h4>
                  {cs.site?.adresse && (
                    <p className="text-sm text-muted-foreground">{cs.site.adresse}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cs.frequenceOperations && (
                      <Badge variant="secondary" className="text-xs">
                        Opérations: {FREQUENCE_LABELS[cs.frequenceOperations]}
                      </Badge>
                    )}
                    {cs.frequenceControle && (
                      <Badge variant="secondary" className="text-xs">
                        Contrôles: {FREQUENCE_LABELS[cs.frequenceControle]}
                      </Badge>
                    )}
                    {isPonctuel && cs.nombreOperations && (
                      <Badge variant="outline" className="text-xs">
                        {cs.nombreOperations} opération(s)
                      </Badge>
                    )}
                    {isPonctuel && cs.nombreVisitesControle && (
                      <Badge variant="outline" className="text-xs">
                        {cs.nombreVisitesControle} visite(s) contrôle
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Interventions liées</CardTitle>
        </CardHeader>
        <CardContent>
          {interventions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune intervention liée à ce contrat
            </p>
          ) : (
            <div className="space-y-2">
              {interventions.map((i) => (
                <Link
                  key={i.id}
                  to={`/planning?interventionId=${i.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      {formatDate(i.datePrevue)}
                      {i.heurePrevue && ` • ${i.heurePrevue}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {i.prestation || getStatutLabel(i.type)}
                      {i.site && <span className="ml-2">• {i.site.nom}</span>}
                    </p>
                  </div>
                  <Badge className={getStatutColor(i.statut)} variant="secondary">
                    {getStatutLabel(i.statut)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
