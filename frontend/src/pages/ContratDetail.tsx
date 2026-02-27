import { useParams, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  ArrowLeft,
  Plus,
  MapPin,
  User,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  Calendar,
  RefreshCw,
  ClipboardList,
  TrendingUp,
  Eye,
  Wrench,
  ClipboardCheck,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { contratsApi, interventionsApi, prestationsApi } from '@/services/api';
import { formatDate, getStatutColor, getStatutLabel, cn } from '@/lib/utils';
import type { Frequence, Prestation, InterventionStatut } from '@/types';

const FREQUENCE_LABELS: Record<Frequence, string> = {
  HEBDOMADAIRE: 'Hebdomadaire',
  MENSUELLE: 'Mensuelle',
  TRIMESTRIELLE: 'Trimestrielle',
  SEMESTRIELLE: 'Semestrielle',
  ANNUELLE: 'Annuelle',
  PERSONNALISEE: 'Personnalisée',
};

const STATUT_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ACTIF: { label: 'Actif', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
  SUSPENDU: { label: 'Suspendu', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertCircle },
  TERMINE: { label: 'Terminé', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Clock },
};

const INTERVENTION_STATUT_CONFIG: Record<InterventionStatut, { color: string; bgColor: string }> = {
  A_PLANIFIER: { color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
  PLANIFIEE: { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  REALISEE: { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  REPORTEE: { color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  ANNULEE: { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

export function ContratDetailPage() {
  const { id } = useParams();
  const [selectedPrestationName, setSelectedPrestationName] = useState<string | null>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<any | null>(null);
  const [interventionFilter, setInterventionFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'operations' | 'controles'>('all');

  const { data: contrat, isLoading } = useQuery({
    queryKey: ['contrat', id],
    queryFn: () => contratsApi.get(id!),
    enabled: !!id,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always', // Recharger à chaque montage du composant
    staleTime: 0,
  });

  const { data: interventionsData } = useQuery({
    queryKey: ['interventions-contrat', id],
    queryFn: () => interventionsApi.list({ contratId: id!, limit: 100 }),
    enabled: !!id,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always', // Recharger à chaque retour sur la page
    staleTime: 0,
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

  // Stats des interventions
  const interventionStats = useMemo(() => {
    const total = interventions.length;
    const realisees = interventions.filter((i) => i.statut === 'REALISEE').length;
    const planifiees = interventions.filter((i) => i.statut === 'PLANIFIEE').length;
    const aPlanifier = interventions.filter((i) => i.statut === 'A_PLANIFIER').length;
    const reportees = interventions.filter((i) => i.statut === 'REPORTEE').length;
    const annulees = interventions.filter((i) => i.statut === 'ANNULEE').length;
    const progressPercent = total > 0 ? Math.round((realisees / total) * 100) : 0;

    // Stats par type (Opérations vs Contrôles)
    const operations = interventions.filter((i) => i.type === 'OPERATION');
    const controles = interventions.filter((i) => i.type === 'CONTROLE');
    const operationsRealisees = operations.filter((i) => i.statut === 'REALISEE').length;
    const controlesRealises = controles.filter((i) => i.statut === 'REALISEE').length;

    return {
      total, realisees, planifiees, aPlanifier, reportees, annulees, progressPercent,
      operations: {
        total: operations.length,
        realisees: operationsRealisees,
        percent: operations.length > 0 ? Math.round((operationsRealisees / operations.length) * 100) : 0,
      },
      controles: {
        total: controles.length,
        realisees: controlesRealises,
        percent: controles.length > 0 ? Math.round((controlesRealises / controles.length) * 100) : 0,
      },
    };
  }, [interventions]);

  // Filtrer les interventions
  const filteredInterventions = useMemo(() => {
    let filtered = interventions;

    // Filtre par statut
    if (interventionFilter === 'done') {
      filtered = filtered.filter((i) => i.statut === 'REALISEE');
    } else if (interventionFilter === 'pending') {
      filtered = filtered.filter((i) => ['A_PLANIFIER', 'PLANIFIEE'].includes(i.statut));
    }

    // Filtre par type (Opération vs Contrôle)
    if (typeFilter === 'operations') {
      filtered = filtered.filter((i) => i.type === 'OPERATION');
    } else if (typeFilter === 'controles') {
      filtered = filtered.filter((i) => i.type === 'CONTROLE');
    }

    return filtered;
  }, [interventions, interventionFilter, typeFilter]);

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

  // Calcul durée restante du contrat
  const contractDuration = useMemo(() => {
    if (!contrat?.dateFin) return null;
    const today = new Date();
    const end = new Date(contrat.dateFin);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { days: 0, label: 'Expiré', isExpired: true };
    if (diffDays < 30) return { days: diffDays, label: `${diffDays} jour(s)`, isUrgent: true };
    const months = Math.floor(diffDays / 30);
    return { days: diffDays, label: `${months} mois`, isUrgent: false };
  }, [contrat?.dateFin]);

  if (isLoading || !contrat) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement du contrat...</p>
        </div>
      </div>
    );
  }

  const statutConfig = STATUT_CONFIG[contrat.statut] || STATUT_CONFIG.ACTIF;
  const StatutIcon = statutConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header amélioré */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link to="/contrats">
            <Button variant="outline" size="icon" className="mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{contrat.client?.nomEntreprise}</h1>
              <Badge variant="outline" className={cn('font-medium', statutConfig.color)}>
                <StatutIcon className="h-3 w-3 mr-1" />
                {statutConfig.label}
              </Badge>
              <Badge variant={isPonctuel ? 'secondary' : 'default'} className="font-medium">
                {isPonctuel ? 'Ponctuel' : 'Annuel'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(contrat.dateDebut)}
                {contrat.dateFin && ` → ${formatDate(contrat.dateFin)}`}
              </span>
              {contractDuration && (
                <span
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    contractDuration.isExpired
                      ? 'bg-red-100 text-red-700'
                      : contractDuration.isUrgent
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {contractDuration.isExpired ? 'Expiré' : `Reste ${contractDuration.label}`}
                </span>
              )}
              {isPonctuel && contrat.numeroBonCommande && (
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  BC: {contrat.numeroBonCommande}
                </span>
              )}
            </div>
          </div>
        </div>
        <Link to="/planning">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle intervention
          </Button>
        </Link>
      </div>

      {/* Grille principale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche - Détails */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carte Détails du contrat */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-5 w-5 text-primary" />
                Détails du contrat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Prestations */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Prestations</p>
                <div className="flex flex-wrap gap-2">
                  {contrat.prestations.map((p) => (
                    <button key={p} type="button" onClick={() => setSelectedPrestationName(p)}>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10 transition-colors"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {p}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fréquences globales */}
              {(contrat.frequenceOperations || contrat.frequenceControle) && (
                <div className="grid grid-cols-2 gap-4">
                  {contrat.frequenceOperations && (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                      <p className="text-xs font-medium text-blue-600 mb-1">Fréquence opérations</p>
                      <p className="text-sm font-semibold text-blue-900">
                        {FREQUENCE_LABELS[contrat.frequenceOperations]}
                      </p>
                    </div>
                  )}
                  {contrat.frequenceControle && (
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                      <p className="text-xs font-medium text-purple-600 mb-1">Fréquence contrôles</p>
                      <p className="text-sm font-semibold text-purple-900">
                        {FREQUENCE_LABELS[contrat.frequenceControle]}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Responsable */}
              {contrat.responsablePlanning && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Responsable planning</p>
                    <p className="text-sm font-semibold">
                      {contrat.responsablePlanning.prenom} {contrat.responsablePlanning.nom}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {contrat.notes && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-xs font-medium text-amber-600 mb-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Notes
                  </p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{contrat.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sites du contrat */}
          {contrat.contratSites && contrat.contratSites.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                  Sites du contrat
                  <Badge variant="secondary" className="ml-2">
                    {contrat.contratSites.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contrat.contratSites.map((cs) => (
                    <div
                      key={cs.id}
                      className="p-4 rounded-xl border bg-gradient-to-br from-gray-50 to-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm">{cs.site?.nom}</h4>
                            {cs.site?.adresse && (
                              <p className="text-xs text-muted-foreground">{cs.site.adresse}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contact du site */}
                      {cs.site?.contacts && cs.site.contacts.length > 0 && (
                        <div className="mb-3 p-2 rounded-lg bg-white border text-xs">
                          <p className="font-medium text-gray-700">
                            {cs.site.contacts[0].nom}
                            {cs.site.contacts[0].fonction && (
                              <span className="text-muted-foreground">
                                {' '}
                                - {cs.site.contacts[0].fonction}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                            {cs.site.contacts[0].tel && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {cs.site.contacts[0].tel}
                              </span>
                            )}
                            {cs.site.contacts[0].email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {cs.site.contacts[0].email}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Fréquences du site */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {cs.frequenceOperations && (
                          <Badge variant="secondary" className="text-xs">
                            Op: {FREQUENCE_LABELS[cs.frequenceOperations]}
                          </Badge>
                        )}
                        {cs.frequenceControle && (
                          <Badge variant="outline" className="text-xs">
                            Ctrl: {FREQUENCE_LABELS[cs.frequenceControle]}
                          </Badge>
                        )}
                        {isPonctuel && cs.nombreOperations && (
                          <Badge variant="outline" className="text-xs bg-blue-50">
                            {cs.nombreOperations} op.
                          </Badge>
                        )}
                        {isPonctuel && cs.nombreVisitesControle && (
                          <Badge variant="outline" className="text-xs bg-purple-50">
                            {cs.nombreVisitesControle} ctrl.
                          </Badge>
                        )}
                      </div>

                      {/* Dates 1ère intervention */}
                      {(cs.premiereDateOperation || cs.premiereDateControle) && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {cs.premiereDateOperation && (
                            <div className="p-2 rounded bg-blue-50">
                              <span className="text-blue-600">1ère op:</span>{' '}
                              <span className="font-medium">{formatDate(cs.premiereDateOperation)}</span>
                            </div>
                          )}
                          {cs.premiereDateControle && (
                            <div className="p-2 rounded bg-purple-50">
                              <span className="text-purple-600">1er ctrl:</span>{' '}
                              <span className="font-medium">{formatDate(cs.premiereDateControle)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Prestations du site */}
                      {cs.prestations?.length ? (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex flex-wrap gap-1">
                            {cs.prestations.map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setSelectedPrestationName(p)}
                              >
                                <Badge
                                  variant="outline"
                                  className="text-xs cursor-pointer hover:bg-primary/10"
                                >
                                  {p}
                                </Badge>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne droite - Stats et options */}
        <div className="space-y-6">
          {/* Carte Progression */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Progression
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progression globale */}
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">
                  {interventionStats.progressPercent}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {interventionStats.realisees} / {interventionStats.total} interventions
                </p>
              </div>
              <Progress value={interventionStats.progressPercent} className="h-2" />

              {/* Progression Opérations vs Contrôles */}
              <div className="space-y-3 pt-2">
                {/* Opérations */}
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Opérations</span>
                    </div>
                    <span className="text-sm font-bold text-blue-700">
                      {interventionStats.operations.realisees}/{interventionStats.operations.total}
                    </span>
                  </div>
                  <Progress value={interventionStats.operations.percent} className="h-1.5" />
                </div>

                {/* Contrôles */}
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">Contrôles</span>
                    </div>
                    <span className="text-sm font-bold text-purple-700">
                      {interventionStats.controles.realisees}/{interventionStats.controles.total}
                    </span>
                  </div>
                  <Progress value={interventionStats.controles.percent} className="h-1.5" />
                </div>
              </div>

              {/* Stats par statut */}
              <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                <div className="p-2 rounded-lg bg-green-50 border border-green-100 text-center">
                  <div className="text-lg font-bold text-green-700">
                    {interventionStats.realisees}
                  </div>
                  <div className="text-xs text-green-600">Réalisées</div>
                </div>
                <div className="p-2 rounded-lg bg-yellow-50 border border-yellow-100 text-center">
                  <div className="text-lg font-bold text-yellow-700">
                    {interventionStats.aPlanifier}
                  </div>
                  <div className="text-xs text-yellow-600">À planifier</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Carte Options */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Options du contrat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Auto-créer prochaine</span>
                </div>
                <Badge variant={contrat.autoCreerProchaine ? 'default' : 'secondary'}>
                  {contrat.autoCreerProchaine ? 'Oui' : 'Non'}
                </Badge>
              </div>
              {!isPonctuel && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Reconduction auto</span>
                  </div>
                  <Badge variant={contrat.reconductionAuto ? 'default' : 'secondary'}>
                    {contrat.reconductionAuto ? 'Oui' : 'Non'}
                  </Badge>
                </div>
              )}
              {isPonctuel && contrat.nombreOperations && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Opérations prévues</span>
                  </div>
                  <Badge variant="outline">{contrat.nombreOperations}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section Interventions liées */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarClock className="h-5 w-5 text-primary" />
                Interventions liées
                <Badge variant="secondary" className="ml-2">
                  {filteredInterventions.length}
                </Badge>
              </CardTitle>
              <Tabs
                value={interventionFilter}
                onValueChange={(v) => setInterventionFilter(v as any)}
                className="w-auto"
              >
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-3">
                    Toutes
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs px-3">
                    En attente
                  </TabsTrigger>
                  <TabsTrigger value="done" className="text-xs px-3">
                    Réalisées
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {/* Filtre par type */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Type :</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition-colors',
                    typeFilter === 'all'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white hover:bg-gray-50'
                  )}
                >
                  Tous
                </button>
                <button
                  onClick={() => setTypeFilter('operations')}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition-colors flex items-center gap-1',
                    typeFilter === 'operations'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200'
                  )}
                >
                  <Wrench className="h-3 w-3" />
                  Opérations ({interventionStats.operations.total})
                </button>
                <button
                  onClick={() => setTypeFilter('controles')}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition-colors flex items-center gap-1',
                    typeFilter === 'controles'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white hover:bg-purple-50 text-purple-700 border-purple-200'
                  )}
                >
                  <ClipboardCheck className="h-3 w-3" />
                  Contrôles ({interventionStats.controles.total})
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInterventions.length === 0 ? (
            <div className="text-center py-8">
              <CalendarClock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {typeFilter !== 'all'
                  ? `Aucune ${typeFilter === 'operations' ? 'opération' : 'visite de contrôle'} trouvée`
                  : interventionFilter === 'all'
                    ? 'Aucune intervention liée à ce contrat'
                    : interventionFilter === 'done'
                      ? 'Aucune intervention réalisée'
                      : 'Aucune intervention en attente'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInterventions.map((i) => {
                const statutStyle = INTERVENTION_STATUT_CONFIG[i.statut as InterventionStatut];
                const isOperation = i.type === 'OPERATION';
                const TypeIcon = isOperation ? Wrench : ClipboardCheck;
                return (
                  <button
                    key={i.id}
                    className={cn(
                      'w-full flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md text-left',
                      statutStyle?.bgColor || 'bg-gray-50'
                    )}
                    onClick={() => setSelectedIntervention(i)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Indicateur de type */}
                      <div
                        className={cn(
                          'flex flex-col items-center justify-center w-14 h-14 rounded-lg border shadow-sm',
                          isOperation
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-purple-50 border-purple-200'
                        )}
                      >
                        <TypeIcon
                          className={cn(
                            'h-5 w-5 mb-0.5',
                            isOperation ? 'text-blue-600' : 'text-purple-600'
                          )}
                        />
                        <span className={cn(
                          'text-[10px] font-medium',
                          isOperation ? 'text-blue-600' : 'text-purple-600'
                        )}>
                          {isOperation ? 'OP' : 'CTRL'}
                        </span>
                      </div>
                      {/* Date */}
                      <div className="flex flex-col items-center justify-center w-12 h-14 rounded-lg bg-white border shadow-sm">
                        <span className="text-lg font-bold">
                          {new Date(i.datePrevue).getDate().toString().padStart(2, '0')}
                        </span>
                        <span className="text-xs text-muted-foreground uppercase">
                          {new Date(i.datePrevue).toLocaleDateString('fr-FR', { month: 'short' })}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {i.prestation || getStatutLabel(i.type)}
                          </p>
                          {i.heurePrevue && (
                            <span className="text-xs text-muted-foreground bg-white px-2 py-0.5 rounded">
                              {i.heurePrevue}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {i.site?.nom || 'Site non défini'}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('font-medium', statutStyle?.color || '')}
                    >
                      {getStatutLabel(i.statut)}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Prestation */}
      <Dialog
        open={!!selectedPrestationName}
        onOpenChange={(open) => !open && setSelectedPrestationName(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              {selectedPrestationName}
            </DialogTitle>
            <DialogDescription>Détails de la prestation liée au contrat</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-lg bg-gray-50">
              <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
              <div className="whitespace-pre-wrap">
                {prestationDetail?.description?.trim() || 'Aucune description disponible'}
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Sites concernés ({prestationSites.length})
              </div>
              {prestationSites.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  Aucun site concerné
                </div>
              ) : (
                <div className="space-y-2">
                  {prestationSites.map((cs) => (
                    <div
                      key={cs.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{cs.site?.nom}</span>
                      </div>
                      {cs.site?.adresse && (
                        <span className="text-xs text-muted-foreground">{cs.site.adresse}</span>
                      )}
                    </div>
                  ))}
                </div>
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
                  to={`/planning?view=week&prestation=${encodeURIComponent(selectedPrestationName)}`}
                >
                  Voir sur planning
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Intervention */}
      <Dialog
        open={!!selectedIntervention}
        onOpenChange={(open) => !open && setSelectedIntervention(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Détail de l'intervention
            </DialogTitle>
            <DialogDescription>
              {selectedInterventionDetail?.client?.nomEntreprise ||
                selectedIntervention?.client?.nomEntreprise}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date et heure */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-white border shadow-sm">
                <span className="text-xl font-bold">
                  {new Date(
                    selectedInterventionDetail?.datePrevue || selectedIntervention?.datePrevue
                  )
                    .getDate()
                    .toString()
                    .padStart(2, '0')}
                </span>
                <span className="text-xs text-muted-foreground uppercase">
                  {new Date(
                    selectedInterventionDetail?.datePrevue || selectedIntervention?.datePrevue
                  ).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div>
                <p className="font-semibold">
                  {formatDate(
                    selectedInterventionDetail?.datePrevue || selectedIntervention?.datePrevue
                  )}
                </p>
                {(selectedInterventionDetail?.heurePrevue || selectedIntervention?.heurePrevue) && (
                  <p className="text-sm text-muted-foreground">
                    à {selectedInterventionDetail?.heurePrevue || selectedIntervention?.heurePrevue}
                  </p>
                )}
              </div>
            </div>

            {/* Infos */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <p className="font-medium">
                  {getStatutLabel(selectedInterventionDetail?.type || selectedIntervention?.type)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-muted-foreground mb-1">Statut</p>
                <Badge
                  variant="outline"
                  className={cn(
                    INTERVENTION_STATUT_CONFIG[
                      (selectedInterventionDetail?.statut ||
                        selectedIntervention?.statut) as InterventionStatut
                    ]?.color
                  )}
                >
                  {getStatutLabel(
                    selectedInterventionDetail?.statut || selectedIntervention?.statut
                  )}
                </Badge>
              </div>
            </div>

            {(selectedInterventionDetail?.prestation || selectedIntervention?.prestation) && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-xs text-blue-600 mb-1">Prestation</p>
                <p className="font-medium text-blue-900">
                  {selectedInterventionDetail?.prestation || selectedIntervention?.prestation}
                </p>
              </div>
            )}

            {(selectedInterventionDetail?.site || selectedIntervention?.site) && (
              <div className="p-3 rounded-lg bg-gray-50 border">
                <p className="text-xs text-muted-foreground mb-1">Site</p>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {(selectedInterventionDetail?.site || selectedIntervention?.site)?.nom}
                  </span>
                </div>
              </div>
            )}

            {(selectedInterventionDetail?.notesTerrain || selectedIntervention?.notesTerrain) && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-600 mb-1 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Notes terrain
                </p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">
                  {selectedInterventionDetail?.notesTerrain || selectedIntervention?.notesTerrain}
                </p>
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
