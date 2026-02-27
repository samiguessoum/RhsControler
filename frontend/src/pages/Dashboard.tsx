import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowRight,
  Plus,
  AlertCircle,
  Users,
  FileText,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  ClipboardList,
  Activity,
  ChevronRight,
  ChevronDown,
  Sun,
  Sparkles,
  UserCheck,
  UserX,
  Briefcase,
  MapPin,
  Building2,
  BarChart3,
  ExternalLink,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { dashboardApi } from '@/services/api';
import { getStatutColor, getStatutLabel, formatDate } from '@/lib/utils';
import type { Intervention, Alerte } from '@/types';
import { useAuthStore } from '@/store/auth.store';

// Config pour auto-refresh
const QUERY_CONFIG = {
  refetchOnWindowFocus: true,
  refetchOnMount: true,
  staleTime: 30000, // 30 secondes
  refetchInterval: 60000, // Refresh toutes les minutes
};

// Composant pour les statistiques principales (compact)
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
  const variants = {
    default: { iconBg: 'bg-gray-100', iconColor: 'text-gray-600', border: 'border-gray-100' },
    success: { iconBg: 'bg-green-50', iconColor: 'text-green-600', border: 'border-green-100' },
    warning: { iconBg: 'bg-amber-50', iconColor: 'text-amber-600', border: 'border-amber-100' },
    error: { iconBg: 'bg-red-50', iconColor: 'text-red-600', border: 'border-red-100' },
  };
  const style = variants[variant];

  const content = (
    <div className={`bg-white ${style.border} border rounded-lg p-3 hover:shadow-sm transition-all cursor-pointer group`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-1.5 rounded-lg ${style.iconBg}`}>
          <Icon className={`h-4 w-4 ${style.iconColor}`} />
        </div>
      </div>
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
}

// Mini calendrier semaine (plus compact)
function WeekCalendar({ jours }: { jours: { date: string; jour: string; count: number; isToday: boolean }[] }) {
  return (
    <div className="flex gap-1">
      {jours.map((jour) => (
        <Link
          key={jour.date}
          to={`/planning?date=${jour.date}`}
          className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-lg transition-all hover:scale-105 ${
            jour.isToday ? 'bg-green-600 text-white shadow' : 'bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <span className={`text-[9px] font-medium uppercase ${jour.isToday ? 'text-green-100' : 'text-gray-400'}`}>
            {jour.jour}
          </span>
          <span className={`text-sm font-bold ${jour.isToday ? 'text-white' : 'text-gray-700'}`}>
            {new Date(jour.date).getDate()}
          </span>
          <span className={`text-[10px] font-semibold ${
            jour.count === 0 ? (jour.isToday ? 'text-green-200' : 'text-gray-300') :
            jour.isToday ? 'text-white' : 'text-green-600'
          }`}>
            {jour.count}
          </span>
        </Link>
      ))}
    </div>
  );
}

// Section Aujourd'hui
function TodaySection({ interventions, total, realisees }: { interventions: Intervention[]; total: number; realisees: number }) {
  const progress = total > 0 ? Math.round((realisees / total) * 100) : 0;

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-2 px-3 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-gray-800">Aujourd'hui</span>
            {total > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px]">
                {realisees}/{total}
              </Badge>
            )}
          </div>
          <Link to="/planning" className="text-[10px] text-green-600 hover:text-green-700 font-medium flex items-center gap-0.5">
            Planning <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {total > 0 && <Progress value={progress} className="h-1 mt-2" />}
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {interventions.length === 0 ? (
          <div className="text-center py-3 text-gray-400">
            <Sparkles className="h-6 w-6 mx-auto mb-1 text-green-200" />
            <p className="text-xs">Aucune intervention</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[140px] overflow-y-auto">
            {interventions.map((i) => (
              <Link
                key={i.id}
                to={`/planning?interventionId=${i.id}`}
                className="flex items-center justify-between p-1.5 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-1 h-6 rounded-full flex-shrink-0 ${
                    i.statut === 'REALISEE' ? 'bg-green-500' : i.statut === 'PLANIFIEE' ? 'bg-blue-500' : 'bg-amber-500'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{i.client?.nomEntreprise}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {i.heurePrevue && <span className="font-medium">{i.heurePrevue}</span>}
                      {i.prestation && <span> • {i.prestation}</span>}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Section Employés disponibles (avec scroll)
function EmployesSansMission({ employes }: { employes: { id: string; nom: string; prenom: string; postes: { nom: string }[] }[] }) {
  if (employes.length === 0) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-100">
        <UserCheck className="h-4 w-4 text-green-600" />
        <span className="text-xs text-green-700 font-medium">Tous les employés sont occupés</span>
      </div>
    );
  }

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-1 px-3 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-gray-800 text-sm">Disponibles</span>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">{employes.length}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="space-y-1 max-h-[120px] overflow-y-auto">
          {employes.map((e) => (
            <div key={e.id} className="flex items-center gap-2 p-1.5 rounded bg-gray-50">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-amber-700">{e.prenom[0]}{e.nom[0]}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{e.prenom} {e.nom}</p>
                <p className="text-[10px] text-gray-500 truncate">{e.postes.map(p => p.nom).join(', ') || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Section Charge de travail (cliquable avec détails)
function ChargeEmployes({
  employes,
  onSelect,
}: {
  employes: { id: string; nom: string; prenom: string; totalMissionsSemaine: number; heuresTravaillees: number; tendance: number }[];
  onSelect: (id: string) => void;
}) {
  const maxMissions = Math.max(...employes.map(e => e.totalMissionsSemaine), 1);

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-1 px-3 pt-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-green-600" />
          <span className="font-semibold text-gray-800 text-sm">Charge de travail</span>
        </div>
        <CardDescription className="text-[10px]">Cliquez pour voir les détails</CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {employes.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">Aucune donnée</p>
        ) : (
          <div className="space-y-2 max-h-[150px] overflow-y-auto">
            {employes.map((e, idx) => (
              <button
                key={e.id}
                onClick={() => onSelect(e.id)}
                className="w-full text-left p-1.5 rounded hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      idx === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>{idx + 1}</span>
                    <span className="text-xs font-medium text-gray-800">{e.prenom} {e.nom}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-gray-900">{e.totalMissionsSemaine}</span>
                    {e.tendance !== 0 && (
                      <span className={`text-[9px] ${e.tendance > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {e.tendance > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${(e.totalMissionsSemaine / maxMissions) * 100}%` }} />
                  </div>
                  <span className="text-[9px] text-gray-400 w-6 text-right">{e.heuresTravaillees}h</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Modal détails employé
function EmployeDetailModal({
  employe,
  onClose,
}: {
  employe: {
    id: string;
    nom: string;
    prenom: string;
    postes: { nom: string }[];
    totalMissionsSemaine: number;
    heuresTravaillees: number;
    detailsMissions: { id: string; date: string; client: string; statut: string; heure: string | null }[];
  } | null;
  onClose: () => void;
}) {
  if (!employe) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-sm font-bold text-green-700">{employe.prenom[0]}{employe.nom[0]}</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{employe.prenom} {employe.nom}</h3>
              <p className="text-xs text-gray-500">{employe.postes.map(p => p.nom).join(', ')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-green-50 text-center">
              <p className="text-2xl font-bold text-green-600">{employe.totalMissionsSemaine}</p>
              <p className="text-[10px] text-green-700">Missions</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 text-center">
              <p className="text-2xl font-bold text-gray-600">{employe.heuresTravaillees}h</p>
              <p className="text-[10px] text-gray-500">Travaillées</p>
            </div>
          </div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Missions cette semaine</h4>
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
            {employe.detailsMissions.map((m) => (
              <Link
                key={m.id}
                to={`/planning?interventionId=${m.id}`}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={onClose}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.client}</p>
                  <p className="text-[10px] text-gray-500">
                    {formatDate(m.date)} {m.heure && `à ${m.heure}`}
                  </p>
                </div>
                <Badge className={`${getStatutColor(m.statut)} text-[9px]`} variant="secondary">
                  {getStatutLabel(m.statut)}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Activité équipe (clients visités)
function ActiviteEquipe({
  employes,
  onSelectEmploye,
}: {
  employes: { id: string; nom: string; prenom: string; totalMissionsSemaine: number; detailsMissions: { client: string; statut: string }[] }[];
  onSelectEmploye: (id: string) => void;
}) {
  const withMissions = employes.filter(e => e.totalMissionsSemaine > 0);
  if (withMissions.length === 0) return null;

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-1 px-3 pt-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-green-600" />
          <span className="font-semibold text-gray-800 text-sm">Activité équipe</span>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
          {withMissions.slice(0, 10).map((e) => (
            <button
              key={e.id}
              onClick={() => onSelectEmploye(e.id)}
              className="w-full text-left p-1.5 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-green-700">{e.prenom[0]}{e.nom[0]}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-800">{e.prenom}</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700 text-[9px]">{e.totalMissionsSemaine}</Badge>
              </div>
              <div className="flex flex-wrap gap-0.5">
                {e.detailsMissions.slice(0, 3).map((m, i) => (
                  <span key={i} className={`text-[9px] px-1 py-0.5 rounded ${
                    m.statut === 'REALISEE' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>{m.client}</span>
                ))}
                {e.detailsMissions.length > 3 && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">+{e.detailsMissions.length - 3}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Stats par type
function OperationsParType({ data }: { data: { type: string; count: number }[] }) {
  const labels: Record<string, string> = {
    OPERATION: 'Opérations',
    CONTROLE: 'Contrôles',
    RECLAMATION: 'Réclamations',
    PREMIERE_VISITE: '1ère visite',
    DEPLACEMENT_COMMERCIAL: 'Commercial',
  };
  const colors: Record<string, string> = {
    OPERATION: 'bg-green-500',
    CONTROLE: 'bg-blue-500',
    RECLAMATION: 'bg-red-500',
    PREMIERE_VISITE: 'bg-purple-500',
    DEPLACEMENT_COMMERCIAL: 'bg-amber-500',
  };
  const total = data.reduce((a, d) => a + d.count, 0);

  // S'assurer que RECLAMATION est dans la liste même si count = 0
  const allTypes = ['OPERATION', 'CONTROLE', 'RECLAMATION', 'PREMIERE_VISITE', 'DEPLACEMENT_COMMERCIAL'];
  const dataWithAll = allTypes.map(type => {
    const found = data.find(d => d.type === type);
    return { type, count: found?.count || 0 };
  }).filter(d => d.count > 0 || d.type === 'RECLAMATION');

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-1 px-3 pt-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-green-600" />
          <span className="font-semibold text-gray-800 text-sm">Par type</span>
        </div>
        <CardDescription className="text-[10px]">Ce mois</CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="space-y-1.5">
          {dataWithAll.map((d) => (
            <div key={d.type} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${colors[d.type] || 'bg-gray-400'}`} />
              <span className="text-[11px] text-gray-600 flex-1">{labels[d.type] || d.type}</span>
              <span className="text-xs font-semibold text-gray-900">{d.count}</span>
              <span className="text-[9px] text-gray-400 w-6 text-right">
                {total > 0 ? Math.round((d.count / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Top Clients
function TopClients({ clients }: { clients: { clientId: string; nomEntreprise: string; count: number }[] }) {
  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-1 px-3 pt-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-green-600" />
          <span className="font-semibold text-gray-800 text-sm">Top clients</span>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="space-y-1 max-h-[120px] overflow-y-auto">
          {clients.slice(0, 10).map((c, i) => (
            <Link
              key={c.clientId}
              to={`/clients/${c.clientId}`}
              className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 transition-colors"
            >
              <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold ${
                i === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>{i + 1}</span>
              <span className="text-xs text-gray-700 flex-1 truncate">{c.nomEntreprise}</span>
              <Badge variant="secondary" className="text-[9px]">{c.count}</Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Performance mois
function MonthProgress({ realisees, annulees, enAttente, tauxRealisation, moisCourant }: {
  realisees: number; annulees: number; enAttente: number; tauxRealisation: number; moisCourant: string;
}) {
  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader className="pb-1 px-3 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-gray-800 text-sm">Performance</span>
          </div>
          <span className="text-[10px] text-gray-400 capitalize">{moisCourant}</span>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" stroke="#f3f4f6" strokeWidth="5" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="#16a34a" strokeWidth="5"
                strokeLinecap="round" strokeDasharray={`${tauxRealisation * 1.38} 138`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-gray-800">{tauxRealisation}%</span>
            </div>
          </div>
          <div className="flex-1 space-y-0.5 text-[11px]">
            <div className="flex justify-between"><span className="text-gray-500">Réalisées</span><span className="font-semibold text-green-600">{realisees}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">En attente</span><span className="font-semibold text-gray-600">{enAttente}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Annulées</span><span className="font-semibold text-gray-400">{annulees}</span></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Alertes
function AlertesSection({ alertes }: { alertes: Alerte[] }) {
  if (alertes.length === 0) return null;

  // Grouper les alertes par type pour mieux les afficher
  const alertesCritiques = alertes.filter(a =>
    a.type === 'CONTRAT_SANS_INTERVENTION' || a.type === 'CONTRAT_HORS_VALIDITE'
  );
  const alertesPonctuels = alertes.filter(a => a.type === 'PONCTUEL_FIN_PROCHE');
  const alertesAnnuels = alertes.filter(a => a.type === 'ANNUEL_FIN_PROCHE');

  const getAlertStyle = (type: string, joursRestants?: number) => {
    if (type === 'ANNUEL_FIN_PROCHE') {
      if (joursRestants && joursRestants <= 30) {
        return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' };
      }
      return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' };
    }
    if (type === 'PONCTUEL_FIN_PROCHE') {
      return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' };
    }
    return { bg: 'bg-white', border: 'border-red-100', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
  };

  return (
    <Card className="shadow-sm border-red-100 bg-red-50/30">
      <CardHeader className="pb-1 px-3 pt-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="font-semibold text-red-700 text-sm">Alertes Contrats</span>
          <Badge variant="secondary" className="bg-red-100 text-red-700 text-[10px]">{alertes.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
          {/* Alertes critiques (sans intervention, hors validité) */}
          {alertesCritiques.length > 0 && (
            <div className="space-y-1">
              {alertesCritiques.map((a) => {
                const style = getAlertStyle(a.type);
                return (
                  <Link key={a.id} to={`/contrats/${a.contratId}`}
                    className={`flex items-center justify-between p-1.5 rounded ${style.bg} border ${style.border} hover:opacity-80`}>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{a.client.nomEntreprise}</p>
                      <p className={`text-[10px] ${style.text}`}>
                        {a.type === 'CONTRAT_SANS_INTERVENTION' ? 'Sans intervention planifiée' : 'Interventions hors validité'}
                      </p>
                    </div>
                    <ChevronRight className="h-3 w-3 text-gray-300" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* Alertes contrats ponctuels - avec nombre d'opérations bien visible */}
          {alertesPonctuels.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] font-semibold text-purple-600 uppercase tracking-wide mt-1">Ponctuels - Opérations restantes</p>
              {alertesPonctuels.map((a) => {
                const style = getAlertStyle(a.type);
                return (
                  <Link key={a.id} to={`/contrats/${a.contratId}`}
                    className={`flex items-center justify-between p-2 rounded ${style.bg} border ${style.border} hover:opacity-80`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 truncate">{a.client.nomEntreprise}</p>
                      {a.numeroBonCommande && (
                        <p className="text-[9px] text-gray-500">BC: {a.numeroBonCommande}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded-lg ${style.badge} text-center min-w-[50px]`}>
                        <p className="text-lg font-bold leading-none">{a.operationsRestantes}</p>
                        <p className="text-[8px] leading-tight">op.</p>
                      </div>
                      <ChevronRight className="h-3 w-3 text-gray-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Alertes contrats annuels à reconduire - avec jours restants bien visibles */}
          {alertesAnnuels.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] font-semibold text-amber-600 uppercase tracking-wide mt-1">Annuels - Validité restante</p>
              {alertesAnnuels.map((a) => {
                const style = getAlertStyle(a.type, a.joursRestants);
                const isUrgent = a.joursRestants && a.joursRestants <= 30;
                return (
                  <Link key={a.id} to={`/contrats/${a.contratId}`}
                    className={`flex items-center justify-between p-2 rounded ${style.bg} border ${style.border} hover:opacity-80`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium text-gray-900 truncate">{a.client.nomEntreprise}</p>
                        {a.reconductionAuto && (
                          <Badge variant="outline" className="text-[8px] py-0 px-1 h-3 bg-green-50 text-green-600 border-green-200">Auto</Badge>
                        )}
                      </div>
                      {a.dateFin && (
                        <p className="text-[9px] text-gray-500">Fin: {formatDate(a.dateFin)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded-lg ${style.badge} text-center min-w-[50px] ${isUrgent ? 'animate-pulse' : ''}`}>
                        <p className="text-lg font-bold leading-none">{a.joursRestants}</p>
                        <p className="text-[8px] leading-tight">jours</p>
                      </div>
                      <ChevronRight className="h-3 w-3 text-gray-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Missions non assignées
function MissionsNonAssignees({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
      <ClipboardList className="h-4 w-4 text-amber-600" />
      <div className="flex-1">
        <span className="text-xs font-medium text-amber-800">Missions sans employé</span>
      </div>
      <span className="text-lg font-bold text-amber-700">{count}</span>
    </div>
  );
}

// Dashboard principal
export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [selectedEmployeId, setSelectedEmployeId] = useState<string | null>(null);

  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats-extended'],
    queryFn: dashboardApi.statsExtended,
    ...QUERY_CONFIG,
  });

  const { data: alertesData } = useQuery({
    queryKey: ['dashboard-alertes'],
    queryFn: dashboardApi.alertes,
    ...QUERY_CONFIG,
  });

  const { data: aujourdhuiData } = useQuery({
    queryKey: ['dashboard-aujourdhui'],
    queryFn: dashboardApi.aujourdhui,
    ...QUERY_CONFIG,
  });

  const { data: employesData } = useQuery({
    queryKey: ['dashboard-employes-stats'],
    queryFn: dashboardApi.employesStats,
    ...QUERY_CONFIG,
  });

  const { data: operationsData } = useQuery({
    queryKey: ['dashboard-operations-stats'],
    queryFn: dashboardApi.operationsStats,
    ...QUERY_CONFIG,
  });

  const stats = statsData?.stats;
  const prochains7Jours = statsData?.prochains7Jours || [];
  const selectedEmploye = employesData?.employes.find(e => e.id === selectedEmployeId) || null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <div className="space-y-3 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{getGreeting()}, {user?.prenom || 'Utilisateur'}</h1>
          <p className="text-xs text-gray-500">Vue d'ensemble</p>
        </div>
        <Link to="/planning">
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Intervention
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <StatCard title="À planifier" value={stats?.aPlanifier || 0} icon={Clock} variant="warning" link="/planning?view=a-planifier" />
        <StatCard title="En retard" value={stats?.enRetard || 0} icon={AlertTriangle} variant={stats?.enRetard ? 'error' : 'default'} link="/planning?view=en-retard" />
        <StatCard title="Contrôles" value={stats?.controles30j || 0} icon={CheckCircle} variant="success" link="/planning?type=CONTROLE" />
        <StatCard
          title="Alertes"
          value={(stats?.contratsEnAlerte || 0) + (stats?.ponctuelAlerte || 0) + (stats?.contratsAnnuelsFinProche || 0)}
          icon={AlertCircle}
          variant={(stats?.contratsEnAlerte || stats?.ponctuelAlerte || stats?.contratsAnnuelsFinProche) ? 'error' : 'default'}
        />
        <StatCard title="Clients" value={stats?.totalClients || 0} icon={Users} link="/clients" />
        <StatCard title="Contrats" value={stats?.totalContrats || 0} icon={FileText} link="/contrats" />
      </div>

      {/* Calendrier */}
      {prochains7Jours.length > 0 && (
        <Card className="shadow-sm border-gray-100 p-3">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-gray-800 text-sm">Semaine</span>
          </div>
          <WeekCalendar jours={prochains7Jours} />
        </Card>
      )}

      {/* Grid 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Colonne gauche */}
        <div className="space-y-3">
          <TodaySection
            interventions={aujourdhuiData?.interventions || []}
            total={stats?.interventionsAujourdhui || 0}
            realisees={stats?.realiseeAujourdhui || 0}
          />

          {alertesData && alertesData.alertes.length > 0 && (
            <AlertesSection alertes={alertesData.alertes} />
          )}

          <MonthProgress
            realisees={stats?.realiseeMois || 0}
            annulees={stats?.annuleeMois || 0}
            enAttente={stats?.enAttenteMois || 0}
            tauxRealisation={stats?.tauxRealisationMois || 0}
            moisCourant={statsData?.moisCourant || ''}
          />

          <OperationsParType data={operationsData?.parType || []} />

          <TopClients clients={operationsData?.topClients || []} />
        </div>

        {/* Colonne droite - Employés */}
        <div className="space-y-3">
          {/* Résumé équipe */}
          <Card className="shadow-sm border-gray-100">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-gray-800 text-sm">Équipe</span>
                {employesData && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px]">
                    {employesData.stats.totalEmployes}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-lg font-bold text-green-600">{employesData?.stats.employesAvecMission || 0}</p>
                  <p className="text-[9px] text-green-700">Actifs</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-lg font-bold text-amber-600">{employesData?.stats.employesSansMissionCount || 0}</p>
                  <p className="text-[9px] text-amber-700">Dispo</p>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-lg font-bold text-gray-600">{employesData?.stats.totalMissionsSemaine || 0}</p>
                  <p className="text-[9px] text-gray-500">Missions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {employesData && employesData.stats.totalMissionsNonAssignees > 0 && (
            <MissionsNonAssignees count={employesData.stats.totalMissionsNonAssignees} />
          )}

          <EmployesSansMission employes={employesData?.employesSansMission || []} />

          <ChargeEmployes
            employes={employesData?.topEmployes || []}
            onSelect={setSelectedEmployeId}
          />

          <ActiviteEquipe
            employes={employesData?.employes || []}
            onSelectEmploye={setSelectedEmployeId}
          />
        </div>
      </div>

      {/* Modal détails employé */}
      {selectedEmploye && (
        <EmployeDetailModal
          employe={selectedEmploye}
          onClose={() => setSelectedEmployeId(null)}
        />
      )}
    </div>
  );
}
