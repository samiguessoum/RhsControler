import { useParams, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ArrowLeft, Plus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { contratsApi, interventionsApi, prestationsApi } from '@/services/api';
import { formatDate, getStatutColor, getStatutLabel } from '@/lib/utils';
import type { Frequence, Prestation } from '@/types';

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
  const [selectedPrestationName, setSelectedPrestationName] = useState<string | null>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<any | null>(null);

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

  const { data: selectedInterventionDetail } = useQuery({
    queryKey: ['intervention', selectedIntervention?.id],
    queryFn: () => interventionsApi.get(selectedIntervention!.id),
    enabled: !!selectedIntervention?.id,
  });

  const { data: prestations = [] } = useQuery({
    queryKey: ['prestations-active'],
    queryFn: () => prestationsApi.list(true),
  });

  const interventions = interventionsData?.interventions || [];
  const isPonctuel = contrat?.type === 'PONCTUEL';
  const prestationDetail = useMemo(
    () => prestations.find((p) => p.nom === selectedPrestationName) as Prestation | undefined,
    [prestations, selectedPrestationName]
  );
  const prestationSites = useMemo(() => {
    if (!selectedPrestationName) return [];
    return (
      contrat?.contratSites?.filter((cs) =>
        (cs.prestations || []).includes(selectedPrestationName)
      ) || []
    );
  }, [contrat?.contratSites, selectedPrestationName]);

  if (isLoading || !contrat) {
    return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;
  }

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
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPrestationName(p)}
                  className="inline-flex"
                >
                  <Badge variant="outline" className="text-xs hover:bg-muted">
                    {p}
                  </Badge>
                </button>
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
                  {cs.prestations?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cs.prestations.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSelectedPrestationName(p)}
                          className="inline-flex"
                        >
                          <Badge variant="outline" className="text-xs hover:bg-muted">
                            {p}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  ) : null}
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
                <button
                  key={i.id}
                  className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setSelectedIntervention(i)}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-base">
                      {formatDate(i.datePrevue)}
                      {i.heurePrevue && ` • ${i.heurePrevue}`}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {i.prestation || getStatutLabel(i.type)}
                      {i.site && <span className="ml-2">• {i.site.nom}</span>}
                    </p>
                  </div>
                  <Badge className={getStatutColor(i.statut)} variant="secondary">
                    {getStatutLabel(i.statut)}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedPrestationName}
        onOpenChange={(open) => !open && setSelectedPrestationName(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Prestation — {selectedPrestationName}</DialogTitle>
            <DialogDescription>Détails de la prestation liée au contrat</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <div className="text-muted-foreground">Description</div>
              <div className="mt-1 whitespace-pre-wrap">
                {prestationDetail?.description?.trim() || 'Aucune description'}
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-muted-foreground">Sites concernés</div>
              {prestationSites.length === 0 ? (
                <div className="mt-1">—</div>
              ) : (
                <ul className="mt-2 space-y-1">
                  {prestationSites.map((cs) => (
                    <li key={cs.id} className="flex items-center justify-between">
                      <span>{cs.site?.nom}</span>
                      {cs.site?.adresse && (
                        <span className="text-xs text-muted-foreground">{cs.site.adresse}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPrestationName(null)}>
              Fermer
            </Button>
            {selectedPrestationName && (
              <Button asChild>
                <Link
                  to={`/planning?view=week&prestation=${encodeURIComponent(
                    selectedPrestationName
                  )}`}
                >
                  Voir sur planning (semaine)
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedIntervention}
        onOpenChange={(open) => !open && setSelectedIntervention(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail de l'intervention</DialogTitle>
            <DialogDescription>
              {selectedInterventionDetail?.client?.nomEntreprise || selectedIntervention?.client?.nomEntreprise}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Date prévue:</span>{' '}
              <span className="font-medium">
                {formatDate(
                  selectedInterventionDetail?.datePrevue || selectedIntervention?.datePrevue
                )}
              </span>
            </div>
            {(selectedInterventionDetail?.heurePrevue || selectedIntervention?.heurePrevue) && (
              <div>
                <span className="text-muted-foreground">Heure:</span>{' '}
                <span className="font-medium">
                  {selectedInterventionDetail?.heurePrevue || selectedIntervention?.heurePrevue}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Type:</span>{' '}
              <span className="font-medium">
                {getStatutLabel(selectedInterventionDetail?.type || selectedIntervention?.type)}
              </span>
            </div>
            {(selectedInterventionDetail?.prestation || selectedIntervention?.prestation) && (
              <div>
                <span className="text-muted-foreground">Prestation:</span>{' '}
                <span className="font-medium">
                  {selectedInterventionDetail?.prestation || selectedIntervention?.prestation}
                </span>
              </div>
            )}
            {(selectedInterventionDetail?.site || selectedIntervention?.site) && (
              <div>
                <span className="text-muted-foreground">Site:</span>{' '}
                <span className="font-medium">
                  {(selectedInterventionDetail?.site || selectedIntervention?.site)?.nom}
                </span>
              </div>
            )}
            {(selectedInterventionDetail?.notesTerrain || selectedIntervention?.notesTerrain) && (
              <div>
                <span className="text-muted-foreground">Notes terrain:</span>
                <div className="mt-1 whitespace-pre-wrap">
                  {selectedInterventionDetail?.notesTerrain || selectedIntervention?.notesTerrain}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedIntervention(null)}>
              Fermer
            </Button>
            {selectedIntervention && (
              <Button asChild>
                <Link to={`/planning?interventionId=${selectedIntervention.id}`}>
                  Ouvrir sur planning
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
