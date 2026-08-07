import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  AlertCircle,
  Users,
  Sun,
  ChevronRight,
  X,
  CalendarDays,
  ShieldAlert,
  ClipboardList,
  UserCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { dashboardApi } from '@/services/api';
import { getStatutColor, getStatutLabel, formatDate } from '@/lib/utils';
import type { Intervention, Alerte } from '@/types';
import { useAuthStore } from '@/store/auth.store';

const QUERY_CONFIG = {
  refetchOnWindowFocus: true,
  refetchOnMount: true,
  staleTime: 30000,
  refetchInterval: 60000,
};

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  link,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'red' | 'amber' | 'orange' | 'green' | 'gray';
  link?: string;
  onClick?: () => void;
}) {
  const active = value > 0;

  const palette = {
    red:    { bar: 'bg-red-500',    icon: 'text-red-500',    num: 'text-red-600',    bg: 'bg-red-50' },
    amber:  { bar: 'bg-amber-400',  icon: 'text-amber-500',  num: 'text-amber-600',  bg: 'bg-amber-50' },
    orange: { bar: 'bg-orange-400', icon: 'text-orange-500', num: 'text-orange-600', bg: 'bg-orange-50' },
    green:  { bar: 'bg-green-500',  icon: 'text-green-600',  num: 'text-green-700',  bg: 'bg-green-50' },
    gray:   { bar: 'bg-gray-300',   icon: 'text-gray-300',   num: 'text-gray-300',   bg: 'bg-gray-50' },
  };

  const p = active ? palette[color] : palette.gray;

  const inner = (
    <div
      className={`relative bg-white rounded-xl p-5 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${active ? 'shadow-sm' : 'shadow-none'}`}
      onClick={onClick}
    >
      {/* colored bottom bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${p.bar} rounded-b-xl transition-all`} />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
          <p className={`text-4xl font-black tabular-nums leading-none ${p.num}`}>{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${active ? p.bg : 'bg-gray-50'}`}>
          <Icon className={`h-5 w-5 ${p.icon}`} />
        </div>
      </div>
    </div>
  );

  if (link && active) return <Link to={link}>{inner}</Link>;
  return inner;
}

/* ─────────────────────────────────────────────
   Semaine Calendar
───────────────────────────────────────────── */
function WeekStrip({ jours }: { jours: { date: string; jour: string; count: number; isToday: boolean }[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="h-4 w-4 text-gray-400" />
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Cette semaine</span>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {jours.map((jour) => (
          <Link
            key={jour.date}
            to={`/planning?date=${jour.date}`}
            className={`flex flex-col items-center py-2.5 px-1 rounded-xl transition-all duration-150 hover:scale-105 ${
              jour.isToday
                ? 'bg-green-600 shadow-md shadow-green-200'
                : jour.count > 0
                  ? 'bg-green-50 hover:bg-green-100'
                  : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${jour.isToday ? 'text-green-200' : 'text-gray-400'}`}>
              {jour.jour.slice(0, 3)}
            </span>
            <span className={`text-lg font-black leading-tight ${jour.isToday ? 'text-white' : 'text-gray-700'}`}>
              {new Date(jour.date + 'T12:00:00').getDate()}
            </span>
            <span className={`text-xs font-bold ${
              jour.count === 0
                ? jour.isToday ? 'text-green-300' : 'text-gray-300'
                : jour.isToday ? 'text-green-100' : 'text-green-600'
            }`}>
              {jour.count > 0 ? jour.count : '·'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section Aujourd'hui (Hero)
───────────────────────────────────────────── */
function TodayHero({
  interventions,
  total,
  realisees,
}: {
  interventions: Intervention[];
  total: number;
  realisees: number;
}) {
  const progress = total > 0 ? Math.round((realisees / total) * 100) : 0;

  const statutConfig: Record<string, { dot: string; badge: string }> = {
    REALISEE:  { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
    PLANIFIEE: { dot: 'bg-blue-500',  badge: 'bg-blue-100 text-blue-700' },
    REPORTEE:  { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
    ANNULEE:   { dot: 'bg-red-400',   badge: 'bg-red-100 text-red-600' },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header strip */}
      <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sun className="h-5 w-5 text-green-200" />
            <span className="text-white font-bold text-lg tracking-tight">Aujourd'hui</span>
            {total > 0 && (
              <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {realisees}/{total} réalisées
              </span>
            )}
          </div>
          <Link
            to="/planning"
            className="text-green-100 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            Planning complet <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {total > 0 && (
          <div className="mt-3">
            <Progress value={progress} className="h-1.5 bg-green-700 [&>div]:bg-white" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {interventions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-3">
              <Sun className="h-7 w-7 text-green-400" />
            </div>
            <p className="font-semibold text-gray-700">Journée libre</p>
            <p className="text-sm text-gray-400 mt-1">Aucune intervention planifiée aujourd'hui</p>
          </div>
        ) : (
          <div className="space-y-2">
            {interventions.map((i) => {
              const cfg = statutConfig[i.statut] || { dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-600' };
              return (
                <Link
                  key={i.id}
                  to={`/planning?interventionId=${i.id}`}
                  className="group flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {/* Hour */}
                  <div className="w-12 text-right flex-shrink-0">
                    <span className="text-sm font-black text-gray-800 tabular-nums">
                      {i.heurePrevue || '—'}
                    </span>
                  </div>

                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />

                  {/* Client + prestation */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {i.client?.nomEntreprise || '—'}
                    </p>
                    {i.prestation && (
                      <p className="text-xs text-gray-400 truncate">{i.prestation}</p>
                    )}
                  </div>

                  {/* Badge statut */}
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}>
                    {getStatutLabel(i.statut)}
                  </span>

                  <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Alertes Contrats
───────────────────────────────────────────── */
function AlertesPanel({ alertes }: { alertes: Alerte[] }) {
  const visible = alertes.slice(0, 5);
  const more = alertes.length - 5;

  if (alertes.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        </div>
        <p className="font-semibold text-gray-700">Tout est en ordre</p>
        <p className="text-sm text-gray-400 mt-1">Aucune alerte contrat active</p>
      </div>
    );
  }

  const getConfig = (type: string, joursRestants?: number) => {
    if (type === 'CONTRAT_SANS_INTERVENTION' || type === 'CONTRAT_HORS_VALIDITE') {
      return { dot: 'bg-red-500', pill: 'bg-red-100 text-red-700', label: 'text-red-600' };
    }
    if (type === 'ANNUEL_FIN_PROCHE') {
      return joursRestants && joursRestants <= 30
        ? { dot: 'bg-orange-500', pill: 'bg-orange-100 text-orange-700', label: 'text-orange-600' }
        : { dot: 'bg-amber-400', pill: 'bg-amber-100 text-amber-700', label: 'text-amber-600' };
    }
    if (type === 'PONCTUEL_FIN_PROCHE') {
      return { dot: 'bg-purple-500', pill: 'bg-purple-100 text-purple-700', label: 'text-purple-600' };
    }
    return { dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-600', label: 'text-gray-600' };
  };

  const getTypeLabel = (type: string) => {
    if (type === 'CONTRAT_SANS_INTERVENTION') return 'Sans intervention';
    if (type === 'CONTRAT_HORS_VALIDITE') return 'Hors validité';
    if (type === 'ANNUEL_FIN_PROCHE') return 'Renouvellement';
    if (type === 'PONCTUEL_FIN_PROCHE') return 'Op. restantes';
    return type;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-4.5 w-4.5 text-red-500 h-5 w-5" />
          <span className="font-bold text-gray-800">Alertes contrats</span>
          <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            {alertes.length}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-1.5">
        {visible.map((a) => {
          const cfg = getConfig(a.type, a.joursRestants);
          return (
            <Link
              key={a.id}
              to={`/contrats/${a.contratId}`}
              className="group flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {a.client?.nomEntreprise || '—'}
                </p>
                <p className={`text-xs ${cfg.label}`}>{getTypeLabel(a.type)}</p>
              </div>
              <div className={`text-center px-3 py-1.5 rounded-xl ${cfg.pill} flex-shrink-0`}>
                {a.type === 'ANNUEL_FIN_PROCHE' && a.joursRestants !== undefined ? (
                  <>
                    <p className="text-base font-black leading-none">{a.joursRestants}</p>
                    <p className="text-[9px] font-semibold mt-0.5 opacity-70">jours</p>
                  </>
                ) : a.type === 'PONCTUEL_FIN_PROCHE' && a.operationsRestantes !== undefined ? (
                  <>
                    <p className="text-base font-black leading-none">{a.operationsRestantes}</p>
                    <p className="text-[9px] font-semibold mt-0.5 opacity-70">op.</p>
                  </>
                ) : (
                  <p className="text-xs font-bold">!</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
            </Link>
          );
        })}

        {more > 0 && (
          <Link
            to="/contrats"
            className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
          >
            +{more} autres alertes <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Équipe du Jour
───────────────────────────────────────────── */
function EquipePanel({
  employes,
  stats,
  missionsNonAssignees,
  employesSansMission,
  onSelectEmploye,
}: {
  employes: { id: string; nom: string; prenom: string; totalMissionsSemaine: number; postes: { nom: string }[]; detailsMissions: { id: string; date: string; client: string; statut: string; heure: string | null }[] }[];
  stats: { totalEmployes: number; employesAvecMission: number; employesSansMissionCount: number; totalMissionsSemaine: number };
  missionsNonAssignees: number;
  employesSansMission: { id: string; nom: string; prenom: string; postes: { nom: string }[] }[];
  onSelectEmploye: (id: string) => void;
}) {
  const enMission = employes.filter(e => e.totalMissionsSemaine > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-blue-500" />
            <span className="font-bold text-gray-800">Équipe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-green-100 text-green-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {stats.employesAvecMission} en mission
            </span>
            <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {stats.employesSansMissionCount} dispo
            </span>
            <span className="bg-gray-100 text-gray-500 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {stats.totalMissionsSemaine} missions
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-1">
        {/* Missions non assignées */}
        {missionsNonAssignees > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 mb-2">
            <ClipboardList className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-800 flex-1">
              {missionsNonAssignees} mission{missionsNonAssignees > 1 ? 's' : ''} sans équipier
            </p>
            <Link to="/planning" className="text-[11px] font-bold text-amber-600 hover:text-amber-800">
              Assigner →
            </Link>
          </div>
        )}

        {/* Employés en mission */}
        {enMission.length > 0 && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 pt-1">En mission cette semaine</p>
            {enMission.map((e) => (
              <button
                key={e.id}
                onClick={() => onSelectEmploye(e.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-green-700">
                    {e.prenom[0]}{e.nom[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{e.prenom} {e.nom}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {e.postes.map(p => p.nom).join(', ') || '—'}
                  </p>
                </div>
                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                  {e.totalMissionsSemaine}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-200" />
              </button>
            ))}
          </>
        )}

        {/* Séparateur */}
        {enMission.length > 0 && employesSansMission.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">disponibles</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
        )}

        {/* Employés disponibles */}
        {employesSansMission.length > 0 && (
          <>
            {employesSansMission.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 p-3 rounded-xl"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-gray-400">
                    {e.prenom[0]}{e.nom[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500">{e.prenom} {e.nom}</p>
                  <p className="text-xs text-gray-300 truncate">
                    {e.postes.map(p => p.nom).join(', ') || '—'}
                  </p>
                </div>
                <UserCheck className="h-4 w-4 text-gray-300" />
              </div>
            ))}
          </>
        )}

        {enMission.length === 0 && employesSansMission.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <Users className="h-8 w-8 text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Aucun employé</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Modal Détail Employé (unchanged)
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   Dashboard Principal
───────────────────────────────────────────── */
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

  const stats = statsData?.stats;
  const prochains7Jours = statsData?.prochains7Jours || [];
  const alertes: Alerte[] = alertesData?.alertes || [];
  const selectedEmploye = employesData?.employes.find((e: any) => e.id === selectedEmployeId) || null;

  const totalAlertes =
    (stats?.contratsEnAlerte || 0) +
    (stats?.ponctuelAlerte || 0) +
    (stats?.contratsAnnuelsFinProche || 0);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── Zone 1 : Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              {getGreeting()}, {user?.prenom || 'Utilisateur'}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 capitalize">{dateLabel}</p>
          </div>
          <Link to="/planning">
            <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm shadow-green-200 h-10">
              <Plus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Nouvelle intervention</span>
            </Button>
          </Link>
        </div>

        {/* ── Zone 2 : KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="En retard"
            value={stats?.enRetard || 0}
            icon={AlertTriangle}
            color="red"
            link="/planning?view=en-retard"
          />
          <KpiCard
            label="À planifier"
            value={stats?.aPlanifier || 0}
            icon={Clock}
            color="amber"
            link="/planning?view=a-planifier"
          />
          <KpiCard
            label="Alertes contrats"
            value={totalAlertes}
            icon={AlertCircle}
            color="orange"
          />
          <KpiCard
            label="Réalisées ce mois"
            value={stats?.realiseeMois || 0}
            icon={CheckCircle2}
            color="green"
          />
        </div>

        {/* ── Zone 3 : Hero Aujourd'hui ── */}
        <TodayHero
          interventions={aujourdhuiData?.interventions || []}
          total={stats?.interventionsAujourdhui || 0}
          realisees={stats?.realiseeAujourdhui || 0}
        />

        {/* ── Zone 4 : Calendrier semaine ── */}
        {prochains7Jours.length > 0 && <WeekStrip jours={prochains7Jours} />}

        {/* ── Zone 5 : Alertes + Équipe ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AlertesPanel alertes={alertes} />
          <EquipePanel
            employes={employesData?.employes || []}
            stats={employesData?.stats || {
              totalEmployes: 0,
              employesAvecMission: 0,
              employesSansMissionCount: 0,
              totalMissionsSemaine: 0,
            }}
            missionsNonAssignees={employesData?.stats?.totalMissionsNonAssignees || 0}
            employesSansMission={employesData?.employesSansMission || []}
            onSelectEmploye={setSelectedEmployeId}
          />
        </div>

      </div>

      {/* Modal détail employé */}
      {selectedEmploye && (
        <EmployeDetailModal
          employe={selectedEmploye}
          onClose={() => setSelectedEmployeId(null)}
        />
      )}
    </div>
  );
}
