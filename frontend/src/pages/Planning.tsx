import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfQuarter,
  endOfQuarter,
  addQuarters,
  subQuarters,
  startOfYear,
  endOfYear,
  addYears,
  subYears,
  eachMonthOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Filter,
  X,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Users,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Receipt,
  CalendarDays,
  XCircle,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Search,
  Truck,
  PackageCheck,
  Map,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  interventionsApi,
  clientsApi,
  prestationsApi,
  importExportApi,
  employesApi,
  postesApi,
  commerceApi,
  rhApi,
} from '@/services/api';
import { cn, formatDate, getStatutColor, getStatutLabel } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { EmployeSelector } from '@/components/EmployeSelector';
import { PlanningMap } from '@/components/PlanningMap';
import type { Intervention, CreateInterventionInput, Client, Employe, Poste, InterventionEmployeInput, Conge } from '@/types';

// ============ TYPES ============
type ViewMode = 'day' | 'week' | 'biweek' | 'month' | 'quarter' | 'year' | 'list';
type FilterStatut = 'ALL' | 'A_PLANIFIER' | 'PLANIFIEE' | 'REALISEE' | 'REPORTEE' | 'ANNULEE' | 'EN_RETARD';
type PlanningFilters = {
  clientId: string;
  siteId: string;
  prestation: string;
  statut: FilterStatut;
  type: string;
  responsable: string;
  employeId: string;
  searchClient: string;
};

// ============ PLANNING STAT CARD ============
function PlanningStatCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
  onClick,
  isActive,
  showProgress,
  progressValue,
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'error' | 'success' | 'orange';
  onClick?: () => void;
  isActive?: boolean;
  showProgress?: boolean;
  progressValue?: number;
  subtitle?: string;
}) {
  const palette = {
    default: { bar: 'bg-blue-500',   icon: 'text-blue-500',   num: 'text-blue-700',   bg: 'bg-blue-50',   ring: 'ring-blue-300' },
    warning: { bar: 'bg-amber-400',  icon: 'text-amber-500',  num: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-300' },
    error:   { bar: 'bg-red-500',    icon: 'text-red-500',    num: 'text-red-700',    bg: 'bg-red-50',    ring: 'ring-red-300' },
    success: { bar: 'bg-green-500',  icon: 'text-green-600',  num: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-300' },
    orange:  { bar: 'bg-orange-400', icon: 'text-orange-500', num: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-300' },
  };
  const p = palette[variant];

  return (
    <div
      className={cn(
        'relative bg-white rounded-xl p-4 overflow-hidden transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        isActive ? `ring-2 ${p.ring} shadow-sm` : 'shadow-sm'
      )}
      onClick={onClick}
    >
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${p.bar} rounded-b-xl`} />
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1 truncate">{title}</p>
          <p className={`text-3xl font-black tabular-nums leading-none ${p.num}`}>{value}</p>
          {subtitle && <p className="text-[11px] text-gray-400 mt-1">{subtitle}</p>}
          {showProgress && progressValue !== undefined && (
            <div className="mt-2">
              <Progress value={progressValue} className="h-1.5" />
            </div>
          )}
        </div>
        <div className={cn('p-2 rounded-xl ml-3 flex-shrink-0', p.bg)}>
          <Icon className={cn('h-4 w-4', p.icon)} />
        </div>
      </div>
    </div>
  );
}

// ============ DRAGGABLE INTERVENTION CARD ============
function getTimeRange(intervention: Intervention) {
  if (!intervention.heurePrevue) return '';
  if (!intervention.duree) return intervention.heurePrevue;
  const [h, m] = intervention.heurePrevue.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return intervention.heurePrevue;
  const total = h * 60 + m + intervention.duree;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${intervention.heurePrevue}-${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

function getInterventionTypeLabel(type: Intervention['type']) {
  const labels: Record<string, string> = {
    'OPERATION': 'OPÉRATION',
    'CONTROLE': 'VISITE CONTRÔLE',
    'RECLAMATION': 'RÉCLAMATION',
    'PREMIERE_VISITE': 'PREMIÈRE VISITE',
    'DEPLACEMENT_COMMERCIAL': 'DÉPLACEMENT COMMERCIAL',
  };
  return labels[type] || type;
}

function getInterventionTypeBadgeClass(type: Intervention['type']) {
  const classes: Record<string, string> = {
    'OPERATION': 'bg-red-100 text-red-800',
    'CONTROLE': 'bg-blue-100 text-blue-800',
    'RECLAMATION': 'bg-orange-100 text-orange-800',
    'PREMIERE_VISITE': 'bg-purple-100 text-purple-800',
    'DEPLACEMENT_COMMERCIAL': 'bg-amber-200 text-amber-900',
  };
  return classes[type] || 'bg-gray-100 text-gray-800';
}

function getInterventionTypeIcon(type: Intervention['type']) {
  const icons: Record<string, string> = {
    'OPERATION': '🔧',
    'CONTROLE': '🔍',
    'RECLAMATION': '⚠️',
    'PREMIERE_VISITE': '🏢',
    'DEPLACEMENT_COMMERCIAL': '📦',
  };
  return icons[type] || '📋';
}

function DraggableInterventionCard({
  intervention,
  onClick,
  compact = false,
}: {
  intervention: Intervention;
  onClick: () => void;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: intervention.id,
    data: { intervention },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 1000 : undefined,
      }
    : undefined;

  const timeRange = getTimeRange(intervention);

  if (compact) {
    const siteName = intervention.site?.nom || intervention.client?.sites?.[0]?.nom;
    const typeLabel = getInterventionTypeLabel(intervention.type);
    const typeBadgeClass = getInterventionTypeBadgeClass(intervention.type);
    const hasTeam = intervention.interventionEmployes && intervention.interventionEmployes.length > 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = parseISO(intervention.datePrevue) < today &&
      intervention.statut !== 'REALISEE' &&
      intervention.statut !== 'ANNULEE';

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          'w-full text-left p-1 rounded text-[10px] cursor-grab active:cursor-grabbing transition-all',
          getStatutColor(intervention.statut),
          isDragging && 'opacity-50 shadow-lg',
          isOverdue && 'ring-2 ring-red-400',
          hasTeam && 'border-l-2 border-l-green-500'
        )}
      >
        <div className="flex items-center justify-between gap-0.5">
          <div className="font-medium truncate flex-1">{intervention.client?.nomEntreprise}</div>
          {hasTeam && <Users className="h-2.5 w-2.5 text-green-600 flex-shrink-0" />}
        </div>
        {siteName && (
          <div className="text-[10px] opacity-80 truncate">{siteName}</div>
        )}
        {timeRange && (
          <div className="text-[9px] opacity-80 truncate">{timeRange}</div>
        )}
        <div className="mt-1">
          <span className={cn('px-1.5 py-0.5 rounded-full text-[9px] font-semibold', typeBadgeClass)}>
            {typeLabel}
          </span>
        </div>
      </div>
    );
  }

  const siteName = intervention.site?.nom || intervention.client?.sites?.[0]?.nom;
  const typeLabel = getInterventionTypeLabel(intervention.type);
  const typeBadgeClass = getInterventionTypeBadgeClass(intervention.type);

  // Vérifications pour les indicateurs visuels
  const hasTeam = intervention.interventionEmployes && intervention.interventionEmployes.length > 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = parseISO(intervention.datePrevue) < today &&
    intervention.statut !== 'REALISEE' &&
    intervention.statut !== 'ANNULEE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'w-full text-left p-2 rounded text-xs cursor-grab active:cursor-grabbing transition-all',
        getStatutColor(intervention.statut),
        isDragging && 'opacity-50 shadow-lg',
        isOverdue && 'ring-2 ring-red-400',
        hasTeam && 'border-l-4 border-l-green-500'
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="font-medium truncate flex-1">{intervention.client?.nomEntreprise}</div>
        {hasTeam && (
          <Users className="h-3 w-3 text-green-600 flex-shrink-0" />
        )}
      </div>
      {siteName && (
        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          {siteName}
        </div>
      )}
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        {timeRange && (
          <span className="opacity-75 flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {timeRange}
          </span>
        )}
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', typeBadgeClass)}>
          {typeLabel}
        </span>
        {isOverdue && (
          <span className="text-red-600 text-[9px] font-medium">En retard</span>
        )}
      </div>
    </div>
  );
}

function DraggableInterventionBlock({
  intervention,
  onClick,
  style,
  compact = false,
}: {
  intervention: Intervention;
  onClick: () => void;
  style: React.CSSProperties;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: intervention.id,
    data: { intervention },
  });

  const siteName = intervention.site?.nom || intervention.client?.sites?.[0]?.nom;
  const typeLabel = getInterventionTypeLabel(intervention.type);
  const typeBadgeClass = getInterventionTypeBadgeClass(intervention.type);
  const timeRange = getTimeRange(intervention);

  // Indicateurs visuels
  const hasTeam = intervention.interventionEmployes && intervention.interventionEmployes.length > 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = parseISO(intervention.datePrevue) < today &&
    intervention.statut !== 'REALISEE' &&
    intervention.statut !== 'ANNULEE';

  const mergedStyle: React.CSSProperties = {
    ...style,
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : style.transform,
    zIndex: isDragging ? 1000 : style.zIndex,
  };

  return (
    <div
      ref={setNodeRef}
      style={mergedStyle}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'absolute left-1 right-2 rounded p-2 cursor-grab active:cursor-grabbing transition-all shadow-sm overflow-hidden',
        getStatutColor(intervention.statut),
        compact ? 'text-xs' : 'text-sm',
        isDragging && 'opacity-60 shadow-lg',
        isOverdue && 'ring-2 ring-red-400',
        hasTeam && 'border-l-4 border-l-green-500'
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className={cn('font-semibold truncate flex-1', compact ? 'text-sm' : 'text-base')}>
          {intervention.client?.nomEntreprise}
        </div>
        {hasTeam && <Users className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
      </div>
      {!compact && siteName && (
        <div className="text-[12px] text-muted-foreground truncate flex items-center gap-1">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          {siteName}
        </div>
      )}
      <div className={cn('flex items-center gap-2 mt-1 flex-wrap', compact && 'mt-0.5')}>
        {timeRange && <span className={cn('opacity-75', compact ? 'text-[10px]' : 'text-xs')}>{timeRange}</span>}
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', typeBadgeClass)}>
          {typeLabel}
        </span>
        {isOverdue && !compact && (
          <span className="text-red-600 text-[10px] font-medium">En retard</span>
        )}
      </div>
    </div>
  );
}

// ============ DROPPABLE DAY CELL ============
function DroppableDayCell({
  date,
  interventions,
  onInterventionClick,
  isCurrentMonth = true,
  isToday = false,
  compact = false,
  onDayDoubleClick,
  onDayClick,
}: {
  date: Date;
  interventions: Intervention[];
  onInterventionClick: (intervention: Intervention) => void;
  isCurrentMonth?: boolean;
  isToday?: boolean;
  compact?: boolean;
  onDayDoubleClick?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: format(date, 'yyyy-MM-dd'),
    data: { date },
  });
  const clickTimeoutRef = useRef<number | null>(null);

  const handleClick = () => {
    if (!onDayClick) return;
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = window.setTimeout(() => {
      onDayClick(date);
      clickTimeoutRef.current = null;
    }, 200);
  };

  const handleDoubleClick = () => {
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    onDayDoubleClick?.(date);
  };

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'rounded-xl p-1.5 min-h-[64px] transition-all border border-transparent hover:border-green-400 hover:shadow-sm',
          isOver && 'bg-green-50 border-green-400',
          !isCurrentMonth && 'opacity-35',
          isToday ? 'bg-green-50 border-green-300' : 'bg-white'
        )}
      >
        <div className={cn(
          'text-[11px] font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
          isToday ? 'bg-green-600 text-white' : 'text-gray-500'
        )}>
          {format(date, 'd')}
        </div>
        <div className="space-y-0.5">
          {interventions.map((intervention) => (
            <DraggableInterventionCard
              key={intervention.id}
              intervention={intervention}
              onClick={() => onInterventionClick(intervention)}
              compact
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'rounded-xl p-3 min-h-[150px] transition-all border border-transparent hover:border-green-400 hover:shadow-sm',
        isOver && 'bg-green-50 border-green-400',
        !isCurrentMonth && 'opacity-40',
        isToday ? 'bg-green-50 border-green-300' : 'bg-white shadow-sm'
      )}
    >
      <div className={cn(
        'text-sm font-bold mb-2 w-7 h-7 flex items-center justify-center rounded-full',
        isToday ? 'bg-green-600 text-white' : 'text-gray-600'
      )}>
        {format(date, 'd')}
      </div>
      <div className="space-y-1">
        {interventions.length === 0 ? null : (
          interventions.map((intervention) => (
            <DraggableInterventionCard
              key={intervention.id}
              intervention={intervention}
              onClick={() => onInterventionClick(intervention)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============ DROPPABLE HOUR SLOT (for day view) ============
function DroppableHourSlot({
  date,
  hour,
}: {
  date: Date;
  hour: number;
}) {
  const slotId = `${format(date, 'yyyy-MM-dd')}-${hour.toString().padStart(2, '0')}`;
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    data: { date, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border-b h-[60px] transition-colors',
        isOver && 'bg-primary/10'
      )}
    />
  );
}

// ============ DAY VIEW ============
function DayView({
  date,
  interventions,
  onInterventionClick,
}: {
  date: Date;
  interventions: Intervention[];
  onInterventionClick: (intervention: Intervention) => void;
}) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 6); // 6h to 20h
  const hourHeight = 60;
  const startDayMin = 6 * 60;
  const endDayMin = 21 * 60;

  // Separate interventions with and without time
  const withTime = interventions.filter((i) => i.heurePrevue);
  const withoutTime = interventions.filter((i) => !i.heurePrevue);

  const timedBlocks = withTime
    .map((i) => {
      const [h, m] = i.heurePrevue!.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      const startMin = h * 60 + m;
      const duration = i.duree && i.duree > 0 ? i.duree : 60;
      const endMin = startMin + duration;
      return { intervention: i, startMin, endMin };
    })
    .filter(Boolean) as { intervention: Intervention; startMin: number; endMin: number }[];

  const timedLayout = (() => {
    const sorted = [...timedBlocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    const clusters: { blocks: typeof sorted; end: number }[] = [];
    for (const b of sorted) {
      const last = clusters[clusters.length - 1];
      if (!last || b.startMin >= last.end) {
        clusters.push({ blocks: [b], end: b.endMin });
      } else {
        last.blocks.push(b);
        last.end = Math.max(last.end, b.endMin);
      }
    }

    const laidOut: {
      intervention: Intervention;
      startMin: number;
      endMin: number;
      col: number;
      cols: number;
    }[] = [];

    for (const cluster of clusters) {
      const colsEnd: number[] = [];
      const clusterBlocks = cluster.blocks.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
      const assignments: { block: typeof clusterBlocks[number]; col: number }[] = [];

      for (const block of clusterBlocks) {
        let colIndex = colsEnd.findIndex((end) => block.startMin >= end);
        if (colIndex === -1) {
          colIndex = colsEnd.length;
          colsEnd.push(block.endMin);
        } else {
          colsEnd[colIndex] = block.endMin;
        }
        assignments.push({ block, col: colIndex });
      }

      const totalCols = colsEnd.length || 1;
      for (const { block, col } of assignments) {
        laidOut.push({
          intervention: block.intervention,
          startMin: block.startMin,
          endMin: block.endMin,
          col,
          cols: totalCols,
        });
      }
    }

    return laidOut;
  })();

  const { setNodeRef: setNoTimeRef, isOver: isOverNoTime } = useDroppable({
    id: `${format(date, 'yyyy-MM-dd')}-notime`,
    data: { date, noTime: true },
  });

  // Calcul stats du jour
  const dayStats = useMemo(() => {
    const realisees = interventions.filter((i) => i.statut === 'REALISEE').length;
    const restantes = interventions.filter((i) => i.statut !== 'REALISEE' && i.statut !== 'ANNULEE').length;
    const uniqueEmployes = new Set<string>();
    interventions.forEach((i) => {
      i.interventionEmployes?.forEach((ie) => {
        if (ie.employeId) uniqueEmployes.add(ie.employeId);
      });
    });
    return { total: interventions.length, realisees, restantes, equipes: uniqueEmployes.size };
  }, [interventions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
      {/* Main hour grid */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>{format(date, 'EEEE d MMMM yyyy', { locale: fr })}</CardTitle>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                {dayStats.total} intervention{dayStats.total > 1 ? 's' : ''}
              </span>
              {dayStats.realisees > 0 && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {dayStats.realisees} réalisée{dayStats.realisees > 1 ? 's' : ''}
                </span>
              )}
              {dayStats.restantes > 0 && (
                <span className="text-yellow-600 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {dayStats.restantes} restante{dayStats.restantes > 1 ? 's' : ''}
                </span>
              )}
              {dayStats.equipes > 0 && (
                <span className="text-blue-600 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {dayStats.equipes} personne{dayStats.equipes > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[60px_1fr]">
            <div>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] p-2 text-xs text-muted-foreground font-medium border-b border-r bg-gray-50"
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>
            <div className="relative" style={{ height: hours.length * hourHeight }}>
              <div className="absolute inset-0">
                {hours.map((hour) => (
                  <DroppableHourSlot key={hour} date={date} hour={hour} />
                ))}
              </div>
              {timedLayout.map(({ intervention, startMin, endMin, col, cols }) => {
                const clampedStart = Math.max(startMin, startDayMin);
                const clampedEnd = Math.min(endMin, endDayMin);
                if (clampedEnd <= clampedStart) return null;
                const top = ((clampedStart - startDayMin) / 60) * hourHeight;
                const height = ((clampedEnd - clampedStart) / 60) * hourHeight;
                const isCompact = height < 70;
                const widthPercent = 100 / cols;
                const leftPercent = col * widthPercent;
                return (
                  <DraggableInterventionBlock
                    key={intervention.id}
                    intervention={intervention}
                    onClick={() => onInterventionClick(intervention)}
                    compact={isCompact}
                    style={{
                      top,
                      height,
                      left: `calc(${leftPercent}% + 4px)`,
                      width: `calc(${widthPercent}% - 8px)`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No-time section */}
      <Card
        ref={setNoTimeRef}
        className={cn('h-fit', isOverNoTime && 'bg-primary/10 border-primary')}
      >
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Sans heure définie
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          {withoutTime.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Déposez ici les interventions sans heure
            </p>
          ) : (
            withoutTime.map((intervention) => (
              <DraggableInterventionCard
                key={intervention.id}
                intervention={intervention}
                onClick={() => onInterventionClick(intervention)}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ WEEK VIEW ============
function WeekView({
  weekStart,
  interventions,
  onInterventionClick,
  onDayDoubleClick,
  onDayClick,
}: {
  weekStart: Date;
  interventions: Intervention[];
  onInterventionClick: (intervention: Intervention) => void;
  onDayDoubleClick?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
}) {
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  const getInterventionsForDay = (day: Date) =>
    interventions.filter((i) => isSameDay(parseISO(i.datePrevue), day));

  return (
    <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <DroppableDayCell
            key={day.toISOString()}
            date={day}
            interventions={getInterventionsForDay(day)}
            onInterventionClick={onInterventionClick}
            isToday={isSameDay(day, new Date())}
            onDayDoubleClick={onDayDoubleClick}
            onDayClick={onDayClick}
          />
        ))}
      </div>
  );
}

// ============ BI-WEEK VIEW ============
function BiWeekView({
  startDate,
  interventions,
  onInterventionClick,
  onDayDoubleClick,
  onDayClick,
}: {
  startDate: Date;
  interventions: Intervention[];
  onInterventionClick: (intervention: Intervention) => void;
  onDayDoubleClick?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, 13),
  });

  const getInterventionsForDay = (day: Date) =>
    interventions.filter((i) => isSameDay(parseISO(i.datePrevue), day));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2">
        {days.slice(0, 7).map((day) => (
          <DroppableDayCell
            key={day.toISOString()}
            date={day}
            interventions={getInterventionsForDay(day)}
            onInterventionClick={onInterventionClick}
            isToday={isSameDay(day, new Date())}
            onDayDoubleClick={onDayDoubleClick}
            onDayClick={onDayClick}
          />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.slice(7, 14).map((day) => (
          <DroppableDayCell
            key={day.toISOString()}
            date={day}
            interventions={getInterventionsForDay(day)}
            onInterventionClick={onInterventionClick}
            isToday={isSameDay(day, new Date())}
            onDayDoubleClick={onDayDoubleClick}
            onDayClick={onDayClick}
          />
        ))}
      </div>
    </div>
  );
}

// ============ MONTH VIEW ============
function MonthView({
  month,
  interventions,
  onInterventionClick,
  onDayDoubleClick,
  onDayClick,
}: {
  month: Date;
  interventions: Intervention[];
  onInterventionClick: (intervention: Intervention) => void;
  onDayDoubleClick?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getInterventionsForDay = (day: Date) =>
    interventions.filter((i) => isSameDay(parseISO(i.datePrevue), day));

  return (
    <div className="space-y-2">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2">
        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d) => (
          <div key={d} className="text-center text-sm font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>
      {/* Weeks */}
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-2">
          {week.map((day) => (
            <DroppableDayCell
              key={day.toISOString()}
              date={day}
              interventions={getInterventionsForDay(day)}
              onInterventionClick={onInterventionClick}
              isCurrentMonth={isSameMonth(day, month)}
              isToday={isSameDay(day, new Date())}
              compact
              onDayDoubleClick={onDayDoubleClick}
              onDayClick={onDayClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============ QUARTER VIEW ============
function QuarterView({
  quarter,
  interventions,
  onInterventionClick,
  onDayDoubleClick,
  onDayClick,
}: {
  quarter: Date;
  interventions: Intervention[];
  onInterventionClick: (intervention: Intervention) => void;
  onDayDoubleClick?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
}) {
  const quarterStart = startOfQuarter(quarter);
  const months = eachMonthOfInterval({
    start: quarterStart,
    end: addMonths(quarterStart, 2),
  });

  const getInterventionsForMonth = (month: Date) =>
    interventions.filter((i) => isSameMonth(parseISO(i.datePrevue), month));

  return (
    <div className="grid grid-cols-3 gap-4">
      {months.map((month) => (
        <Card key={month.toISOString()}>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">{format(month, 'MMMM yyyy', { locale: fr })}</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
          <MiniMonthView
            month={month}
            interventions={getInterventionsForMonth(month)}
            onInterventionClick={onInterventionClick}
            onDayDoubleClick={onDayDoubleClick}
            onDayClick={onDayClick}
          />
        </CardContent>
      </Card>
    ))}
  </div>
  );
}

// ============ MINI MONTH VIEW (for quarter/year) ============
function MiniMonthView({
  month,
  interventions,
  onInterventionClick,
  onDayDoubleClick,
  onDayClick,
}: {
  month: Date;
  interventions: Intervention[];
  onInterventionClick: (intervention: Intervention) => void;
  onDayDoubleClick?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
}) {
  const clickTimeoutRef = useRef<number | null>(null);
  const pendingDayRef = useRef<Date | null>(null);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getInterventionsForDay = (day: Date) =>
    interventions.filter((i) => isSameDay(parseISO(i.datePrevue), day));

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-7 gap-0.5">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-0.5">
          {week.map((day) => {
            const dayInterventions = getInterventionsForDay(day);
            const isCurrentMonth = isSameMonth(day, month);
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  if (onDayClick) {
                    if (clickTimeoutRef.current) {
                      window.clearTimeout(clickTimeoutRef.current);
                    }
                    pendingDayRef.current = day;
                    clickTimeoutRef.current = window.setTimeout(() => {
                      if (pendingDayRef.current) onDayClick(pendingDayRef.current);
                      clickTimeoutRef.current = null;
                      pendingDayRef.current = null;
                    }, 200);
                    return;
                  }
                  if (dayInterventions.length === 1) {
                    onInterventionClick(dayInterventions[0]);
                  }
                }}
                onDoubleClick={() => {
                  if (clickTimeoutRef.current) {
                    window.clearTimeout(clickTimeoutRef.current);
                    clickTimeoutRef.current = null;
                    pendingDayRef.current = null;
                  }
                  onDayDoubleClick?.(day);
                }}
                className={cn(
                  'text-center text-[10px] p-0.5 rounded cursor-pointer hover:ring-1 hover:ring-green-500',
                  !isCurrentMonth && 'opacity-30',
                  isToday && 'ring-1 ring-primary',
                  dayInterventions.length > 0 && 'bg-primary/20 font-medium'
                )}
                title={dayInterventions.length > 0 ? `${dayInterventions.length} intervention(s)` : undefined}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ============ YEAR VIEW ============
function YearView({
  year,
  interventions,
  onInterventionClick,
  onDayDoubleClick,
  onDayClick,
}: {
  year: Date;
  interventions: Intervention[];
  onInterventionClick: (intervention: Intervention) => void;
  onDayDoubleClick?: (date: Date) => void;
  onDayClick?: (date: Date) => void;
}) {
  const yearStart = startOfYear(year);
  const months = eachMonthOfInterval({
    start: yearStart,
    end: addMonths(yearStart, 11),
  });

  const getInterventionsForMonth = (month: Date) =>
    interventions.filter((i) => isSameMonth(parseISO(i.datePrevue), month));

  return (
    <div className="grid grid-cols-4 gap-4">
      {months.map((month) => (
        <Card key={month.toISOString()} className="overflow-hidden">
          <CardHeader className="p-2 pb-1 bg-gray-50">
            <CardTitle className="text-xs">{format(month, 'MMMM', { locale: fr })}</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
          <MiniMonthView
            month={month}
            interventions={getInterventionsForMonth(month)}
            onInterventionClick={onInterventionClick}
            onDayDoubleClick={onDayDoubleClick}
            onDayClick={onDayClick}
          />
        </CardContent>
      </Card>
      ))}
    </div>
  );
}

// ============ LIST VIEW ============
function ListView({
  interventions,
  onInterventionClick,
}: {
  interventions: Intervention[];
  onInterventionClick: (intervention: Intervention) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {interventions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Aucune intervention pour cette période
            </p>
          ) : (
            interventions.map((intervention) => (
              <button
                key={intervention.id}
                onClick={() => onInterventionClick(intervention)}
                className="w-full text-left p-3 sm:p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center gap-3 sm:gap-4"
              >
                {/* Date block */}
                <div className="shrink-0 w-10 sm:w-24 text-center sm:text-left">
                  <div className="text-xs font-black text-gray-900 uppercase sm:hidden">
                    {new Date(intervention.datePrevue + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).replace(' ', '\n')}
                  </div>
                  <div className="hidden sm:block text-sm">
                    <div className="font-medium">{formatDate(intervention.datePrevue, 'EEE d MMM')}</div>
                    {intervention.heurePrevue && (
                      <div className="text-muted-foreground">{intervention.heurePrevue}</div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{intervention.client?.nomEntreprise}</div>
                  {intervention.site?.nom && (
                    <div className="text-xs text-muted-foreground truncate">{intervention.site.nom}</div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge className={cn('text-[10px] font-semibold', getInterventionTypeBadgeClass(intervention.type))}>
                      {getInterventionTypeLabel(intervention.type)}
                    </Badge>
                    <Badge className={cn('text-[10px]', getStatutColor(intervention.statut))}>
                      {getStatutLabel(intervention.statut)}
                    </Badge>
                    {intervention.heurePrevue && (
                      <span className="text-[10px] text-muted-foreground sm:hidden">{intervention.heurePrevue}</span>
                    )}
                  </div>
                </div>

                {/* Prestation — desktop only */}
                <div className="hidden sm:block text-sm text-muted-foreground truncate max-w-[120px]">
                  {intervention.prestation}
                </div>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ INTERVENTION DETAIL DIALOG ============
function InterventionDetailDialog({
  intervention,
  onClose,
  onRealiser,
  onReporter,
  onAnnuler,
  onUpdateHoraire,
  onUpdateEmployes,
  onGenerateFacture,
  onDownloadAttestation,
  onDownloadAttestationGarantie,
  onDownloadAttestationControle,
  onCreateBL,
  canRealiser,
  canManage,
  canExport,
  canEdit,
  employes,
  postes,
  congesActifs = [],
}: {
  intervention: Intervention | null;
  onClose: () => void;
  onRealiser: () => void;
  onReporter: () => void;
  onAnnuler: () => void;
  onUpdateHoraire: (data: { heurePrevue?: string; duree?: number }) => void;
  onUpdateEmployes: (employes: InterventionEmployeInput[]) => void;
  onGenerateFacture: () => void;
  onDownloadAttestation: () => void;
  onDownloadAttestationGarantie: () => void;
  onDownloadAttestationControle: () => void;
  onCreateBL: () => void;
  canRealiser: boolean;
  canManage: boolean;
  canExport: boolean;
  canEdit: boolean;
  employes: Employe[];
  postes: Poste[];
  congesActifs?: Pick<Conge, 'employeId' | 'dateDebut' | 'dateFin'>[];
}) {
  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const [showContacts, setShowContacts] = useState(false);
  const [horaireDebut, setHoraireDebut] = useState('');
  const [horaireFin, setHoraireFin] = useState('');
  const [horaireError, setHoraireError] = useState<string | null>(null);
  const [selectedEmployes, setSelectedEmployes] = useState<InterventionEmployeInput[]>([]);
  const [employesModified, setEmployesModified] = useState(false);

  // Initialiser les employés sélectionnés à partir de l'intervention
  const interventionEmployesJson = JSON.stringify(
    intervention?.interventionEmployes?.map((ie) => ({ employeId: ie.employeId, posteId: ie.posteId })) || []
  );
  useEffect(() => {
    if (intervention) {
      const empList = intervention.interventionEmployes || [];
      setSelectedEmployes(
        empList.map((ie) => ({
          employeId: ie.employeId,
          posteId: ie.posteId,
        }))
      );
      setEmployesModified(false);
    }
  }, [intervention?.id, interventionEmployesJson]);

  useEffect(() => {
    if (!intervention) return;
    const start = intervention.heurePrevue || '';
    let end = '';
    if (start && intervention.duree) {
      const [h, m] = start.split(':').map(Number);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        const total = h * 60 + m + intervention.duree;
        const endH = Math.floor(total / 60) % 24;
        const endM = total % 60;
        end = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
      }
    }
    setHoraireDebut(start);
    setHoraireFin(end);
    setHoraireError(null);
  }, [intervention]);

  // Early return APRÈS tous les hooks
  if (!intervention) return null;

  // Variables dérivées (après le early return car elles utilisent intervention)
  const site = intervention.site || intervention.client?.sites?.[0];
  const clientContacts = intervention.client?.siegeContacts || [];
  const siteContacts = site?.contacts || [];
  const hasSiteContact = siteContacts.length > 0;
  const principalSiteContact = siteContacts.find((c) => c.estPrincipal) || siteContacts[0];
  const typeLabel = getInterventionTypeLabel(intervention.type);
  const typeBadgeClass = getInterventionTypeBadgeClass(intervention.type);

  const handleEmployesChange = (newEmployes: InterventionEmployeInput[]) => {
    setSelectedEmployes(newEmployes);
    setEmployesModified(true);
  };

  const saveEmployes = () => {
    onUpdateEmployes(selectedEmployes);
    setEmployesModified(false);
  };

  const saveHoraire = () => {
    if (!horaireDebut && !horaireFin) {
      onUpdateHoraire({ heurePrevue: undefined, duree: undefined });
      return;
    }

    if (!horaireDebut || !horaireFin) {
      setHoraireError('Renseignez un horaire de début et de fin');
      return;
    }

    const [sh, sm] = horaireDebut.split(':').map(Number);
    const [eh, em] = horaireFin.split(':').map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) {
      setHoraireError('Horaire invalide');
      return;
    }

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    if (endMinutes <= startMinutes) {
      setHoraireError("L'horaire de fin doit être après le début");
      return;
    }

    setHoraireError(null);
    onUpdateHoraire({
      heurePrevue: horaireDebut,
      duree: endMinutes - startMinutes,
    });
  };

  return (
    <Dialog open={!!intervention} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] max-w-[1200px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{getInterventionTypeIcon(intervention.type)}</span>
            {intervention.type === 'RECLAMATION' ? 'Détail de la réclamation' : "Détail de l'intervention"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Type badges */}
          <div className="flex items-center justify-between">
            <Badge className={getStatutColor(intervention.statut)}>
              {getStatutLabel(intervention.statut)}
            </Badge>
            <Badge className={cn('font-semibold', typeBadgeClass)}>
              {typeLabel}
            </Badge>
          </div>

          <Separator />

          {/* Client Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Client
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowContacts((v) => !v)}
                className="h-7 px-2 text-xs"
              >
                {showContacts ? (
                  <>
                    Masquer contacts <ChevronUp className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  <>
                    Voir contacts <ChevronDown className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
            </div>
            <div className="pl-6 space-y-1 text-sm">
              <p className="font-medium">{intervention.client?.nomEntreprise}</p>
              {intervention.client?.siegeTel && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {intervention.client.siegeTel}
                </p>
              )}
              {intervention.client?.siegeEmail && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {intervention.client.siegeEmail}
                </p>
              )}
            </div>
            {showContacts && (
              <div className="pl-6 space-y-3 text-sm">
                <div className="rounded-md border bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Contacts client</p>
                  {clientContacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun contact client</p>
                  ) : (
                    <div className="space-y-2">
                      {clientContacts.map((c) => (
                        <div key={c.id} className="space-y-1">
                          <p className="font-medium">
                            {c.nom}
                            {c.fonction && (
                              <span className="text-muted-foreground"> • {c.fonction}</span>
                            )}
                          </p>
                          {(c.tel || c.email) && (
                            <div className="flex flex-col gap-1 text-muted-foreground">
                              {c.tel && (
                                <span className="flex items-center gap-2">
                                  <Phone className="h-3 w-3" />
                                  <a href={`tel:${c.tel}`} className="hover:underline">{c.tel}</a>
                                </span>
                              )}
                              {c.email && (
                                <span className="flex items-center gap-2">
                                  <Mail className="h-3 w-3" />
                                  <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-md border bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Contacts site</p>
                  {!hasSiteContact ? (
                    <p className="text-xs text-muted-foreground">Aucun contact site</p>
                  ) : (
                    <div className="space-y-3">
                      {siteContacts.map((contact) => (
                        <div key={contact.id} className="space-y-1">
                          <p className="font-medium">
                            {contact.nom}
                            {contact.fonction && (
                              <span className="text-muted-foreground"> • {contact.fonction}</span>
                            )}
                          </p>
                          {(contact.tel || contact.email) && (
                            <div className="flex flex-col gap-1 text-muted-foreground">
                              {contact.tel && (
                                <span className="flex items-center gap-2">
                                  <Phone className="h-3 w-3" />
                                  <a href={`tel:${contact.tel}`} className="hover:underline">{contact.tel}</a>
                                </span>
                              )}
                              {contact.email && (
                                <span className="flex items-center gap-2">
                                  <Mail className="h-3 w-3" />
                                  <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Site Info */}
          {site && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Site d'intervention
                </h4>
                <div className="pl-6 space-y-1 text-sm">
                  <p className="font-medium">{site.nom}</p>
                  {site.adresse && (
                    <p className="text-muted-foreground">{site.adresse}</p>
                  )}
                  {principalSiteContact && (
                    <p className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {principalSiteContact.nom}
                      {principalSiteContact.fonction && (
                        <span className="text-muted-foreground">({principalSiteContact.fonction})</span>
                      )}
                    </p>
                  )}
                  {site.tel && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${site.tel}`} className="hover:underline">
                        {site.tel}
                      </a>
                    </p>
                  )}
                  {site.email && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <a href={`mailto:${site.email}`} className="hover:underline">
                        {site.email}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Equipe assignée */}
          {intervention.statut !== 'REALISEE' && intervention.statut !== 'ANNULEE' && (
            <>
              <Separator />
              <div className="space-y-3">
                {canEdit ? (
                  <>
                    <EmployeSelector
                      employes={employes}
                      postes={postes}
                      value={selectedEmployes}
                      onChange={handleEmployesChange}
                      label="Equipe assignée"
                      datePrevue={intervention.datePrevue?.slice(0, 10)}
                      congesActifs={congesActifs}
                    />
                    {employesModified && (
                      <Button variant="outline" size="sm" onClick={saveEmployes}>
                        Enregistrer l'équipe
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" /> Équipe assignée
                    </h4>
                    {selectedEmployes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun employé assigné</p>
                    ) : (
                      selectedEmployes.map((e, i) => {
                        const emp = employes.find((em) => em.id === e.employeId);
                        const poste = postes.find((p) => p.id === e.posteId);
                        return (
                          <p key={i} className="text-sm">
                            {emp ? `${emp.prenom} ${emp.nom}` : e.employeId}
                            {poste && <span className="text-muted-foreground ml-1">({poste.nom})</span>}
                          </p>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Affichage lecture seule pour interventions réalisées/annulées */}
          {(intervention.statut === 'REALISEE' || intervention.statut === 'ANNULEE') &&
            intervention.interventionEmployes &&
            intervention.interventionEmployes.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Equipe assignée
                  </h4>
                  <div className="space-y-2">
                    {(() => {
                      // Regrouper par poste
                      const groups: Record<string, { posteName: string; employes: string[] }> = {};
                      intervention.interventionEmployes!.forEach((ie) => {
                        const posteId = ie.posteId;
                        const posteName = ie.poste?.nom || 'Poste inconnu';
                        const employeName = ie.employe ? `${ie.employe.prenom} ${ie.employe.nom}` : 'Employé inconnu';
                        if (!groups[posteId]) {
                          groups[posteId] = { posteName, employes: [] };
                        }
                        groups[posteId].employes.push(employeName);
                      });
                      // Trier par ordre: Opérateur, Chauffeur, puis alphabétique
                      const getOrder = (name: string) => {
                        const n = name.toLowerCase();
                        if (n.includes('opérateur') || n.includes('operateur')) return 1;
                        if (n.includes('chauffeur')) return 2;
                        return 100;
                      };
                      return Object.entries(groups)
                        .sort(([, a], [, b]) => {
                          const orderA = getOrder(a.posteName);
                          const orderB = getOrder(b.posteName);
                          if (orderA !== orderB) return orderA - orderB;
                          return a.posteName.localeCompare(b.posteName);
                        })
                        .map(([posteId, { posteName, employes }]) => (
                          <div key={posteId} className="rounded-md border bg-gray-50/50">
                            <div className="px-3 py-1.5 border-b bg-gray-100/50">
                              <Badge variant="secondary" className="text-xs font-medium">
                                {posteName}
                                <span className="ml-1.5 text-muted-foreground">({employes.length})</span>
                              </Badge>
                            </div>
                            <div className="px-3 py-2 space-y-1">
                              {employes.map((name, idx) => (
                                <div key={idx} className="text-sm">{name}</div>
                              ))}
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </div>
              </>
            )}

          <Separator />

          {/* Intervention Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="min-w-0">
              <span className="text-muted-foreground">Date prévue:</span>
              <p className="font-medium break-words">
                {formatDate(intervention.datePrevue, 'EEEE d MMMM yyyy')}
              </p>
            </div>
            {intervention.heurePrevue && (
              <div className="min-w-0">
                <span className="text-muted-foreground">Heure:</span>
                <p className="font-medium break-words">{intervention.heurePrevue}</p>
              </div>
            )}
            {intervention.prestation && (
              <div className="min-w-0">
                <span className="text-muted-foreground">Prestation:</span>
                <p className="font-medium break-words">{intervention.prestation}</p>
              </div>
            )}
            {intervention.responsable && (
              <div className="min-w-0">
                <span className="text-muted-foreground">Responsable:</span>
                <p className="font-medium break-words">{intervention.responsable}</p>
              </div>
            )}
            {intervention.duree && (
              <div className="min-w-0">
                <span className="text-muted-foreground">Durée:</span>
                <p className="font-medium break-words">{intervention.duree} min</p>
              </div>
            )}
            {intervention.dateRealisee && (
              <div className="min-w-0">
                <span className="text-muted-foreground">Date réalisée:</span>
                <p className="font-medium break-words">
                  {formatDate(intervention.dateRealisee, 'd MMMM yyyy')}
                </p>
              </div>
            )}
          </div>

          {/* Remaining to planify */}
          {(intervention.contrat || intervention.remainingOperations != null || intervention.remainingControles != null) && (
            <>
              <Separator />
              <div className="text-sm space-y-2">
                {intervention.type === 'OPERATION' && (
                  <>
                    {intervention.contrat?.frequenceOperations && (
                      <p>
                        <span className="text-muted-foreground">Fréquence du contrat:</span>{' '}
                        <span className="font-medium">
                          {getStatutLabel(intervention.contrat.frequenceOperations)}
                        </span>
                      </p>
                    )}
                    {(intervention as any).frequenceOperations &&
                      (intervention as any).frequenceOperations !== intervention.contrat?.frequenceOperations && (
                        <p>
                          <span className="text-muted-foreground">Fréquence du site:</span>{' '}
                          <span className="font-medium">
                            {getStatutLabel((intervention as any).frequenceOperations as string)}
                          </span>
                        </p>
                      )}
                  </>
                )}
                {intervention.type === 'CONTROLE' && (
                  <>
                    {intervention.contrat?.frequenceControle && (
                      <p>
                        <span className="text-muted-foreground">Fréquence du contrat:</span>{' '}
                        <span className="font-medium">
                          {getStatutLabel(intervention.contrat.frequenceControle)}
                        </span>
                      </p>
                    )}
                    {(intervention as any).frequenceControle &&
                      (intervention as any).frequenceControle !== intervention.contrat?.frequenceControle && (
                        <p>
                          <span className="text-muted-foreground">Fréquence du site:</span>{' '}
                          <span className="font-medium">
                            {getStatutLabel((intervention as any).frequenceControle as string)}
                          </span>
                        </p>
                      )}
                  </>
                )}
                {intervention.type === 'OPERATION' && intervention.remainingOperations != null && (
                  <p>
                    <span className="text-muted-foreground">Opérations restantes à réaliser :</span>{' '}
                    <span className="font-medium">{intervention.remainingOperations}</span>
                  </p>
                )}
                {intervention.type === 'OPERATION' && intervention.remainingOperations == null && (
                  <p>
                    <span className="text-muted-foreground">Opérations restantes à réaliser :</span>{' '}
                    <span className="font-medium">—</span>
                  </p>
                )}
                {intervention.type === 'CONTROLE' && intervention.remainingControles != null && (
                  <p>
                    <span className="text-muted-foreground">Visites de contrôle restantes à réaliser :</span>{' '}
                    <span className="font-medium">{intervention.remainingControles}</span>
                  </p>
                )}
                {intervention.type === 'CONTROLE' && intervention.remainingControles == null && (
                  <p>
                    <span className="text-muted-foreground">Visites de contrôle restantes à réaliser :</span>{' '}
                    <span className="font-medium">—</span>
                  </p>
                )}
              </div>
            </>
          )}

          {/* Horaire */}
          {(intervention.statut === 'A_PLANIFIER' || intervention.statut === 'PLANIFIEE' || intervention.statut === 'REPORTEE') && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold">Horaire</h4>
                {canEdit ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>De</Label>
                        <Input
                          type="time"
                          value={horaireDebut}
                          onChange={(e) => setHoraireDebut(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>À</Label>
                        <Input
                          type="time"
                          value={horaireFin}
                          onChange={(e) => setHoraireFin(e.target.value)}
                        />
                      </div>
                    </div>
                    {horaireError && (
                      <p className="text-xs text-red-600">{horaireError}</p>
                    )}
                    <Button variant="outline" size="sm" onClick={saveHoraire}>
                      Enregistrer l'horaire
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {horaireDebut && horaireFin
                      ? `${horaireDebut} - ${horaireFin}`
                      : 'Non defini'}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Contract info */}
          {intervention.contrat && (
            <>
              <Separator />
              <div className="text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  Contrat: {intervention.contrat.type}
                  {intervention.contrat.type === 'PONCTUEL' &&
                    (intervention.contrat as any).numeroBonCommande &&
                    ` - BC: ${(intervention.contrat as any).numeroBonCommande}`}
                </span>
              </div>
            </>
          )}

          {/* Notes de l'intervention précédente */}
          {intervention.previousIntervention && (
            <div className="rounded-md border border-amber-200 bg-amber-50">
              <div className="px-3 py-2 border-b border-amber-200 bg-amber-100/50">
                <span className="text-sm font-medium text-amber-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Notes de {getStatutLabel(intervention.previousIntervention.type)} du{' '}
                  {formatDate(intervention.previousIntervention.dateRealisee, 'd MMMM yyyy')}
                </span>
              </div>
              <div className="px-3 py-2">
                <p className="text-sm text-amber-900 whitespace-pre-wrap">
                  {intervention.previousIntervention.notesTerrain}
                </p>
              </div>
            </div>
          )}

          {/* Notes terrain actuelles */}
          {intervention.notesTerrain && (
            <div>
              <span className="text-sm text-muted-foreground">Notes terrain:</span>
              <p className="text-sm mt-1 p-2 bg-gray-50 rounded">{intervention.notesTerrain}</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            {canExport && intervention.type === 'OPERATION' && intervention.statut === 'REALISEE' && (
              <>
                <Button
                  variant="outline"
                  onClick={onDownloadAttestation}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Attestation de passage
                </Button>
                <Button
                  variant="outline"
                  onClick={onDownloadAttestationGarantie}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Attestation de Garantie
                </Button>
              </>
            )}
            {canExport && intervention.type === 'CONTROLE' && intervention.statut === 'REALISEE' && (
              <Button
                variant="outline"
                onClick={onDownloadAttestationControle}
              >
                <Download className="h-4 w-4 mr-2" />
                Attestation de Visite de Contrôle
              </Button>
            )}
            {canManage && intervention.statut !== 'ANNULEE' && intervention.type === 'OPERATION' && (
              <>
                <Button
                  variant="secondary"
                  onClick={onCreateBL}
                  className="text-blue-700 bg-blue-100 hover:bg-blue-200"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Créer un BL
                </Button>
                <Button
                  variant="secondary"
                  onClick={onGenerateFacture}
                  className="text-green-700 bg-green-100 hover:bg-green-200"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Générer facture
                </Button>
              </>
            )}
            {intervention.statut !== 'REALISEE' &&
              intervention.statut !== 'ANNULEE' &&
              canManage && (
                <>
                  <Button
                    variant="outline"
                    onClick={onReporter}
                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Reporter
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onAnnuler}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </>
              )}
            {intervention.statut !== 'REALISEE' &&
              intervention.statut !== 'ANNULEE' &&
              canRealiser && (
                <Button onClick={onRealiser}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marquer réalisée
                </Button>
              )}
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ REALISER DIALOG ============
function RealiserDialog({
  intervention,
  onClose,
  onConfirm,
  isPending,
}: {
  intervention: Intervention | null;
  onClose: () => void;
  onConfirm: (data: { dateRealisee: string; notesTerrain?: string; creerProchaine: boolean }) => void;
  isPending: boolean;
}) {
  const [dateRealisee, setDateRealisee] = useState('');
  const [notesTerrain, setNotesTerrain] = useState('');

  useEffect(() => {
    if (intervention?.datePrevue) {
      setDateRealisee(format(parseISO(intervention.datePrevue), 'yyyy-MM-dd'));
    } else {
      setDateRealisee('');
    }
    setNotesTerrain(intervention?.notesTerrain || '');
  }, [intervention]);

  if (!intervention) return null;

  const isDateDifferent =
    dateRealisee !== format(parseISO(intervention.datePrevue), 'yyyy-MM-dd');

  return (
    <Dialog open={!!intervention} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marquer l'intervention comme réalisée</DialogTitle>
          <DialogDescription>
            {intervention.client?.nomEntreprise} - {getStatutLabel(intervention.type)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dateRealisee">Date de réalisation effective</Label>
            <Input
              id="dateRealisee"
              type="date"
              value={dateRealisee}
              onChange={(e) => setDateRealisee(e.target.value)}
            />
            {isDateDifferent && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                La date est différente de la date prévue. La prochaine intervention sera
                calculée à partir de cette date.
              </p>
            )}
          </div>

          {/* Notes de l'intervention précédente */}
          {intervention.previousIntervention && (
            <div className="rounded-md border border-amber-200 bg-amber-50">
              <div className="px-3 py-2 border-b border-amber-200 bg-amber-100/50">
                <span className="text-xs font-medium text-amber-800 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Notes de {getStatutLabel(intervention.previousIntervention.type)} du{' '}
                  {formatDate(intervention.previousIntervention.dateRealisee, 'd MMM yyyy')}
                </span>
              </div>
              <div className="px-3 py-2">
                <p className="text-xs text-amber-900 whitespace-pre-wrap">
                  {intervention.previousIntervention.notesTerrain}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notesTerrain">Notes terrain (optionnel)</Label>
            <Textarea
              id="notesTerrain"
              value={notesTerrain}
              onChange={(e) => setNotesTerrain(e.target.value)}
              placeholder="Observations, remarques à noter pour la prochaine intervention..."
              rows={3}
            />
          </div>

          {intervention.contrat && (
            <p className="text-xs text-muted-foreground">
              La prochaine intervention sera créée automatiquement.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                dateRealisee,
                notesTerrain: notesTerrain || undefined,
                creerProchaine: true,
              })
            }
            disabled={isPending || !dateRealisee}
          >
            {isPending ? 'En cours...' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ REPORTER DIALOG ============
function ReporterDialog({
  intervention,
  onClose,
  onConfirm,
  isPending,
}: {
  intervention: Intervention | null;
  onClose: () => void;
  onConfirm: (data: { nouvelleDatePrevue: string; raison: string }) => void;
  isPending: boolean;
}) {
  const [nouvelleDatePrevue, setNouvelleDatePrevue] = useState('');
  const [raison, setRaison] = useState('');

  useEffect(() => {
    if (intervention?.datePrevue) {
      // Proposer par défaut une semaine plus tard
      const dateActuelle = parseISO(intervention.datePrevue);
      const dateSuggérée = new Date(dateActuelle);
      dateSuggérée.setDate(dateSuggérée.getDate() + 7);
      setNouvelleDatePrevue(format(dateSuggérée, 'yyyy-MM-dd'));
    } else {
      setNouvelleDatePrevue('');
    }
    setRaison('');
  }, [intervention]);

  if (!intervention) return null;

  const canConfirm = nouvelleDatePrevue && raison.trim().length > 0;

  return (
    <Dialog open={!!intervention} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-orange-500" />
            Reporter l'intervention
          </DialogTitle>
          <DialogDescription>
            {intervention.client?.nomEntreprise} - {getStatutLabel(intervention.type)}
            <br />
            <span className="text-xs">
              Date actuelle : {formatDate(intervention.datePrevue, 'd MMMM yyyy')}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nouvelleDatePrevue">Nouvelle date prévue *</Label>
            <Input
              id="nouvelleDatePrevue"
              type="date"
              value={nouvelleDatePrevue}
              onChange={(e) => setNouvelleDatePrevue(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="raison">Raison du report *</Label>
            <Textarea
              id="raison"
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="Indiquez la raison du report (client absent, météo, etc.)..."
              rows={3}
            />
          </div>

          <div className="rounded-md bg-orange-50 border border-orange-200 p-3">
            <p className="text-xs text-orange-800 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              L'intervention passera au statut "Reportée". Vous pourrez la replanifier ultérieurement.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => onConfirm({ nouvelleDatePrevue, raison })}
            disabled={isPending || !canConfirm}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isPending ? 'En cours...' : 'Confirmer le report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ ANNULER DIALOG ============
function AnnulerDialog({
  intervention,
  onClose,
  onConfirm,
  isPending,
}: {
  intervention: Intervention | null;
  onClose: () => void;
  onConfirm: (data: { raison: string }) => void;
  isPending: boolean;
}) {
  const [raison, setRaison] = useState('');

  useEffect(() => {
    setRaison('');
  }, [intervention]);

  if (!intervention) return null;

  const canConfirm = raison.trim().length > 0;

  return (
    <Dialog open={!!intervention} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Annuler l'intervention
          </DialogTitle>
          <DialogDescription>
            {intervention.client?.nomEntreprise} - {getStatutLabel(intervention.type)}
            <br />
            <span className="text-xs">
              Date prévue : {formatDate(intervention.datePrevue, 'd MMMM yyyy')}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <strong>Attention :</strong> Cette action est irréversible.
            </p>
            <p className="text-xs text-red-700 mt-1">
              Une intervention annulée ne pourra plus être modifiée ni déplacée.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="raison">Raison de l'annulation *</Label>
            <Textarea
              id="raison"
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="Indiquez la raison de l'annulation..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Retour
          </Button>
          <Button
            onClick={() => onConfirm({ raison })}
            disabled={isPending || !canConfirm}
            variant="destructive"
          >
            {isPending ? 'En cours...' : 'Confirmer l\'annulation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttestationBodyDialog({
  open,
  bodyText,
  title,
  description,
  isLoading,
  isSaving,
  onBodyChange,
  onClose,
  onGenerate,
}: {
  open: boolean;
  bodyText: string;
  title: string;
  description: string;
  isLoading: boolean;
  isSaving: boolean;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onGenerate: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const applyMarker = (marker: '**' | '__') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = bodyText.slice(start, end);
    const wrapped = `${marker}${selected || 'texte'}${marker}`;
    const next = bodyText.slice(0, start) + wrapped + bodyText.slice(end);
    onBodyChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-3xl sm:w-full">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Chargement du message...</div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => applyMarker('**')}>
                Gras
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => applyMarker('__')}>
                Souligné
              </Button>
              <span className="text-xs text-muted-foreground break-words">
                Syntaxe: `**texte**` (gras), `__texte__` (souligné)
              </span>
            </div>
            <Label htmlFor="attestation-body">Corps du message</Label>
            <Textarea
              id="attestation-body"
              ref={textareaRef}
              value={bodyText}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={8}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button onClick={onGenerate} disabled={isLoading || isSaving || !bodyText.trim()}>
            {isSaving ? 'Génération...' : 'Générer PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ CREATE INTERVENTION DIALOG (Hors contrat) ============
// Types d'intervention disponibles pour création manuelle (hors contrat)
type InterventionHorsContratType = 'RECLAMATION' | 'PREMIERE_VISITE' | 'DEPLACEMENT_COMMERCIAL';

const INTERVENTION_TYPES_CONFIG: Record<InterventionHorsContratType, {
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  'RECLAMATION': {
    label: 'Réclamation',
    description: 'Intervention urgente suite à un problème client',
    icon: '⚠️',
    color: 'text-orange-800',
    bgColor: 'bg-orange-50 border-orange-200',
  },
  'PREMIERE_VISITE': {
    label: 'Première visite',
    description: 'Visite commerciale pour établir un devis',
    icon: '🏢',
    color: 'text-purple-800',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  'DEPLACEMENT_COMMERCIAL': {
    label: 'Déplacement commercial',
    description: 'Livraison de marchandise ou visite commerciale',
    icon: '📦',
    color: 'text-amber-900',
    bgColor: 'bg-amber-100 border-amber-300',
  },
};

function CreateInterventionDialog({
  open,
  onClose,
  clients,
  prestations,
  employes,
  postes,
  congesActifs = [],
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  prestations: { id: string; nom: string }[];
  employes: Employe[];
  postes: Poste[];
  congesActifs?: Pick<Conge, 'employeId' | 'dateDebut' | 'dateFin'>[];
  onSubmit: (data: CreateInterventionInput) => void;
  isPending: boolean;
}) {
  const [clientId, setClientId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [interventionType, setInterventionType] = useState<InterventionHorsContratType>('RECLAMATION');
  const [prestation, setPrestation] = useState('');
  const [datePrevue, setDatePrevue] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [heureDebut, setHeureDebut] = useState('');
  const [heureFin, setHeureFin] = useState('');
  const [notesTerrain, setNotesTerrain] = useState('');
  const [selectedEmployes, setSelectedEmployes] = useState<InterventionEmployeInput[]>([]);
  const [previousNotes, setPreviousNotes] = useState<{
    notesTerrain: string;
    dateRealisee: string;
    type: string;
    site?: { id: string; nom: string };
  } | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const selectedClient = clients.find((c) => c.id === clientId);
  const sites = selectedClient?.sites || [];
  const typeConfig = INTERVENTION_TYPES_CONFIG[interventionType];

  // Fetch last notes when client or site changes
  useEffect(() => {
    if (!clientId) {
      setPreviousNotes(null);
      return;
    }

    const fetchLastNotes = async () => {
      setLoadingNotes(true);
      try {
        const result = await interventionsApi.getLastNotes(clientId, siteId || undefined);
        if (result.previousIntervention) {
          setPreviousNotes({
            notesTerrain: result.previousIntervention.notesTerrain,
            dateRealisee: result.previousIntervention.dateRealisee,
            type: result.previousIntervention.type,
            site: result.previousIntervention.site,
          });
        } else {
          setPreviousNotes(null);
        }
      } catch (error) {
        console.error('Error fetching last notes:', error);
        setPreviousNotes(null);
      } finally {
        setLoadingNotes(false);
      }
    };

    fetchLastNotes();
  }, [clientId, siteId]);

  const resetForm = () => {
    setClientId('');
    setSiteId('');
    setInterventionType('RECLAMATION');
    setPrestation('');
    setDatePrevue(format(new Date(), 'yyyy-MM-dd'));
    setHeureDebut('');
    setHeureFin('');
    setNotesTerrain('');
    setSelectedEmployes([]);
    setPreviousNotes(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error('Client requis');
      return;
    }

    // Calculate duration if both times are provided
    let duree: number | undefined;
    if (heureDebut && heureFin) {
      const [startH, startM] = heureDebut.split(':').map(Number);
      const [endH, endM] = heureFin.split(':').map(Number);
      duree = (endH * 60 + endM) - (startH * 60 + startM);
      if (duree < 0) duree += 24 * 60; // Handle crossing midnight
    }

    onSubmit({
      clientId,
      siteId: siteId || undefined,
      type: interventionType,
      prestation: prestation || undefined,
      datePrevue,
      heurePrevue: heureDebut || undefined,
      duree: duree || undefined,
      notesTerrain: notesTerrain || undefined,
      statut: 'A_PLANIFIER',
      employes: selectedEmployes.length > 0 ? selectedEmployes : undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nouvelle intervention
          </DialogTitle>
          <DialogDescription>Créer une intervention hors contrat</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selection */}
          <div className="space-y-2">
            <Label>Type d'intervention *</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(INTERVENTION_TYPES_CONFIG) as InterventionHorsContratType[]).map((type) => {
                const config = INTERVENTION_TYPES_CONFIG[type];
                const isSelected = interventionType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setInterventionType(type);
                      if (type !== 'RECLAMATION') setPrestation('');
                    }}
                    className={cn(
                      'p-2 rounded-md border text-center transition-all',
                      isSelected
                        ? `${config.bgColor} border-2 ring-2 ring-offset-1`
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    )}
                  >
                    <div className="text-xl mb-1">{config.icon}</div>
                    <div className={cn('text-xs font-medium', isSelected ? config.color : 'text-gray-700')}>
                      {config.label}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{typeConfig.description}</p>
          </div>

          <div className="space-y-2">
            <Label>Client *</Label>
            <Select
              value={clientId}
              onValueChange={(v) => {
                setClientId(v);
                setSiteId(''); // Reset site when client changes
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.nomEntreprise}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sites.length > 0 && (
            <div className="space-y-2">
              <Label>Site</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un site (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.nom}
                      {site.adresse && ` - ${site.adresse}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Previous notes display */}
          {loadingNotes && (
            <div className="p-3 rounded-md bg-gray-50 border text-sm text-muted-foreground">
              Chargement des notes précédentes...
            </div>
          )}
          {!loadingNotes && previousNotes && (
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <FileText className="h-4 w-4" />
                Notes de la dernière intervention
                {previousNotes.site && (
                  <span className="text-amber-600">({previousNotes.site.nom})</span>
                )}
              </div>
              <p className="text-xs text-amber-600">
                {getInterventionTypeLabel(previousNotes.type as Intervention['type'])} du{' '}
                {format(parseISO(previousNotes.dateRealisee), 'dd/MM/yyyy', { locale: fr })}
              </p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{previousNotes.notesTerrain}</p>
            </div>
          )}

          {interventionType === 'RECLAMATION' && (
            <div className="space-y-2">
              <Label>Prestation</Label>
              <Select value={prestation} onValueChange={setPrestation}>
                <SelectTrigger>
                  <SelectValue placeholder="Optionnel" />
                </SelectTrigger>
                <SelectContent>
                  {prestations.map((p) => (
                    <SelectItem key={p.id} value={p.nom}>
                      {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Date *</Label>
            <Input
              type="date"
              value={datePrevue}
              onChange={(e) => setDatePrevue(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horaire - De</Label>
              <Input
                type="time"
                value={heureDebut}
                onChange={(e) => setHeureDebut(e.target.value)}
                placeholder="Heure de début"
              />
            </div>

            <div className="space-y-2">
              <Label>Horaire - À</Label>
              <Input
                type="time"
                value={heureFin}
                onChange={(e) => setHeureFin(e.target.value)}
                placeholder="Heure de fin"
              />
            </div>
          </div>

          <EmployeSelector
            employes={employes}
            postes={postes}
            value={selectedEmployes}
            onChange={setSelectedEmployes}
            label="Equipe"
            datePrevue={datePrevue}
            congesActifs={congesActifs}
          />

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notesTerrain}
              onChange={(e) => setNotesTerrain(e.target.value)}
              placeholder="Description..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============ ADVANCED FILTERS SHEET ============
function FiltersSheet({
  clients,
  prestations,
  employes,
  filters,
  onFiltersChange,
}: {
  clients: Client[];
  prestations: { id: string; nom: string }[];
  employes: Employe[];
  filters: PlanningFilters;
  onFiltersChange: (filters: PlanningFilters) => void;
}) {
  const selectedClient = clients.find((c) => c.id === filters.clientId);
  const sites = selectedClient?.sites || [];

  const activeFiltersCount = [
    filters.clientId,
    filters.siteId,
    filters.prestation,
    filters.statut !== 'ALL' ? filters.statut : '',
    filters.type !== 'ALL' ? filters.type : '',
    filters.responsable,
    filters.employeId,
    filters.searchClient,
  ].filter(Boolean).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filtres
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filtres avancés</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <div className="space-y-6 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Vue</div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select
                value={filters.statut}
                onValueChange={(v) => onFiltersChange({ ...filters, statut: v as FilterStatut })}
              >
                <SelectTrigger className="focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0 hover:border-input">
                  <SelectValue placeholder="Tous statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous statuts</SelectItem>
                  <SelectItem value="A_PLANIFIER">À planifier</SelectItem>
                  <SelectItem value="PLANIFIEE">Planifiée</SelectItem>
                  <SelectItem value="EN_RETARD">En retard</SelectItem>
                  <SelectItem value="REALISEE">Réalisée</SelectItem>
                  <SelectItem value="REPORTEE">Reportée</SelectItem>
                  <SelectItem value="ANNULEE">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={filters.type}
                onValueChange={(v) => onFiltersChange({ ...filters, type: v })}
              >
                <SelectTrigger className="focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0 hover:border-input">
                  <SelectValue placeholder="Tous types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous types</SelectItem>
                  <SelectItem value="OPERATION">Opération</SelectItem>
                  <SelectItem value="CONTROLE">Contrôle</SelectItem>
                  <SelectItem value="RECLAMATION">Réclamation</SelectItem>
                  <SelectItem value="PREMIERE_VISITE">Première visite</SelectItem>
                  <SelectItem value="DEPLACEMENT_COMMERCIAL">Déplacement commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="text-xs uppercase tracking-wide text-muted-foreground">Entreprise & site</div>
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <Select
                value={filters.clientId || 'ALL'}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, clientId: v === 'ALL' ? '' : v, siteId: '' })
                }
              >
                <SelectTrigger className="focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0 hover:border-input">
                  <SelectValue placeholder="Toutes entreprises" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes entreprises</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nomEntreprise}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sites.length > 0 && (
              <div className="space-y-2">
                <Label>Site</Label>
                <Select
                  value={filters.siteId || 'ALL'}
                  onValueChange={(v) =>
                    onFiltersChange({ ...filters, siteId: v === 'ALL' ? '' : v })
                  }
                >
                  <SelectTrigger className="focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0 hover:border-input">
                    <SelectValue placeholder="Tous sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous sites</SelectItem>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            <div className="text-xs uppercase tracking-wide text-muted-foreground">Prestation</div>
            <div className="space-y-2">
              <Label>Prestation</Label>
              <Select
                value={filters.prestation || 'ALL'}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, prestation: v === 'ALL' ? '' : v })
                }
              >
                <SelectTrigger className="focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0 hover:border-input">
                  <SelectValue placeholder="Toutes prestations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes prestations</SelectItem>
                  {prestations.map((p) => (
                    <SelectItem key={p.id} value={p.nom}>
                      {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs uppercase tracking-wide text-muted-foreground">Équipe</div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Input
                list="employes-list"
                value={filters.responsable}
                onChange={(e) => onFiltersChange({ ...filters, responsable: e.target.value })}
                placeholder="Filtrer par responsable"
              />
            </div>

            <div className="space-y-2">
              <Label>Employé</Label>
              <Select
                value={filters.employeId || 'ALL'}
                onValueChange={(v) =>
                  onFiltersChange({ ...filters, employeId: v === 'ALL' ? '' : v })
                }
              >
                <SelectTrigger className="focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-offset-0 hover:border-input">
                  <SelectValue placeholder="Tous employés" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous employés</SelectItem>
                  {employes.map((employe) => (
                    <SelectItem key={employe.id} value={employe.id}>
                      {employe.prenom} {employe.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                onFiltersChange({
                  clientId: '',
                  siteId: '',
                  prestation: '',
                  statut: 'ALL',
                  type: 'ALL',
                  responsable: '',
                  employeId: '',
                  searchClient: '',
                })
              }
            >
              <X className="h-4 w-4 mr-2" />
              Réinitialiser les filtres
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ============ EXPORT CALENDAR DIALOG ============
type ExportPeriod = 'day' | 'week' | 'biweek' | 'month' | 'quarter' | 'year' | 'custom';

function ExportCalendarDialog({
  open,
  onClose,
  currentDate,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  currentDate: Date;
  onExport: (dateDebut: string, dateFin: string) => void;
}) {
  const [period, setPeriod] = useState<ExportPeriod>('month');
  const [customStart, setCustomStart] = useState(format(startOfMonth(currentDate), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(currentDate), 'yyyy-MM-dd'));

  useEffect(() => {
    // Mettre à jour les dates par défaut quand la période change
    const now = currentDate;
    switch (period) {
      case 'day':
        setCustomStart(format(startOfDay(now), 'yyyy-MM-dd'));
        setCustomEnd(format(endOfDay(now), 'yyyy-MM-dd'));
        break;
      case 'week':
        setCustomStart(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setCustomEnd(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'biweek':
        const biweekStart = startOfWeek(now, { weekStartsOn: 1 });
        setCustomStart(format(biweekStart, 'yyyy-MM-dd'));
        setCustomEnd(format(addDays(biweekStart, 13), 'yyyy-MM-dd'));
        break;
      case 'month':
        setCustomStart(format(startOfMonth(now), 'yyyy-MM-dd'));
        setCustomEnd(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'quarter':
        setCustomStart(format(startOfQuarter(now), 'yyyy-MM-dd'));
        setCustomEnd(format(endOfQuarter(now), 'yyyy-MM-dd'));
        break;
      case 'year':
        setCustomStart(format(startOfYear(now), 'yyyy-MM-dd'));
        setCustomEnd(format(endOfYear(now), 'yyyy-MM-dd'));
        break;
    }
  }, [period, currentDate]);

  const handleExport = () => {
    onExport(customStart, customEnd);
    onClose();
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'day':
        return format(parseISO(customStart), 'EEEE d MMMM yyyy', { locale: fr });
      case 'week':
        return `Semaine du ${format(parseISO(customStart), 'd MMM', { locale: fr })} au ${format(parseISO(customEnd), 'd MMM yyyy', { locale: fr })}`;
      case 'biweek':
        return `Du ${format(parseISO(customStart), 'd MMM', { locale: fr })} au ${format(parseISO(customEnd), 'd MMM yyyy', { locale: fr })}`;
      case 'month':
        return format(parseISO(customStart), 'MMMM yyyy', { locale: fr });
      case 'quarter':
        return `${format(parseISO(customStart), 'MMM', { locale: fr })} - ${format(parseISO(customEnd), 'MMM yyyy', { locale: fr })}`;
      case 'year':
        return format(parseISO(customStart), 'yyyy', { locale: fr });
      case 'custom':
        return `Du ${format(parseISO(customStart), 'd MMM yyyy', { locale: fr })} au ${format(parseISO(customEnd), 'd MMM yyyy', { locale: fr })}`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Exporter le calendrier
          </DialogTitle>
          <DialogDescription>
            Téléchargez le planning au format iCal compatible avec Google Calendar, Outlook, Apple Calendar, etc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Période à exporter</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as ExportPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Jour</SelectItem>
                <SelectItem value="week">Semaine</SelectItem>
                <SelectItem value="biweek">2 semaines</SelectItem>
                <SelectItem value="month">Mois</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Année</SelectItem>
                <SelectItem value="custom">Personnalisé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === 'custom' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-muted rounded-md text-sm">
              <span className="text-muted-foreground">Période sélectionnée : </span>
              <span className="font-medium">{getPeriodLabel()}</span>
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
            <p className="font-medium mb-1">Informations exportées :</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Client et site</li>
              <li>Type d'intervention et prestation</li>
              <li>Date, heure et durée</li>
              <li>Équipe assignée</li>
              <li>Notes et observations</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger (.ics)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ MAIN PLANNING PAGE ============
export function PlanningPage() {
  const queryClient = useQueryClient();
  const routerNavigate = useNavigate();
  const { canDo } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const interventionIdParam = searchParams.get('interventionId');
  const viewParam = searchParams.get('view');
  const prestationParam = searchParams.get('prestation');

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>(() => window.innerWidth < 768 ? 'list' : 'month');
  const [showMap, setShowMap] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dayPreviewDate, setDayPreviewDate] = useState<Date | null>(null);

  // Force list view on mobile when screen changes
  useEffect(() => {
    if (isMobile && viewMode !== 'list' && viewMode !== 'day') {
      setViewMode('list');
    }
  }, [isMobile]);

  // Filters state
  const [filters, setFilters] = useState<PlanningFilters>({
    clientId: '',
    siteId: '',
    prestation: '',
    statut: 'ALL',
    type: 'ALL',
    responsable: '',
    employeId: '',
    searchClient: '',
  });

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [realiserIntervention, setRealiserIntervention] = useState<Intervention | null>(null);
  const [reporterIntervention, setReporterIntervention] = useState<Intervention | null>(null);
  const [annulerIntervention, setAnnulerIntervention] = useState<Intervention | null>(null);
  const [attestationIntervention, setAttestationIntervention] = useState<Intervention | null>(null);
  const [attestationKind, setAttestationKind] = useState<'passage' | 'garantie' | 'controle'>('passage');
  const [blDialogIntervention, setBLDialogIntervention] = useState<Intervention | null>(null);
  const [blDialogCommandes, setBLDialogCommandes] = useState<Array<{ id: string; ref: string }>>([]);
  const [blDialogLoading, setBLDialogLoading] = useState(false);
  const [blCreating, setBLCreating] = useState(false);
  const [attestationBody, setAttestationBody] = useState('');
  const [attestationInitialBody, setAttestationInitialBody] = useState('');
  const [attestationLoading, setAttestationLoading] = useState(false);
  const [attestationSaving, setAttestationSaving] = useState(false);
  const [draggedIntervention, setDraggedIntervention] = useState<Intervention | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const handleDayDoubleClick = (day: Date) => {
    setCurrentDate(day);
    switch (viewMode) {
      case 'year':
        setViewMode('quarter');
        break;
      case 'quarter':
        setViewMode('month');
        break;
      case 'month':
        setViewMode('biweek');
        break;
      case 'biweek':
        setViewMode('week');
        break;
      case 'week':
        setViewMode('day');
        break;
      default:
        break;
    }
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Calculate date range based on view
  const getDateRange = () => {
    switch (viewMode) {
      case 'day':
        return {
          start: startOfDay(currentDate),
          end: endOfDay(currentDate),
        };
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 0 }),
          end: endOfWeek(currentDate, { weekStartsOn: 0 }),
        };
      case 'biweek':
        const biweekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        return {
          start: biweekStart,
          end: addDays(biweekStart, 13),
        };
      case 'month':
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate),
        };
      case 'quarter':
        return {
          start: startOfQuarter(currentDate),
          end: endOfQuarter(currentDate),
        };
      case 'year':
        return {
          start: startOfYear(currentDate),
          end: endOfYear(currentDate),
        };
      default:
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 0 }),
          end: endOfWeek(currentDate, { weekStartsOn: 0 }),
        };
    }
  };

  const { start: dateRangeStart, end: dateRangeEnd } = getDateRange();

  // Navigation functions
  const navigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    const add = direction === 'next';
    switch (viewMode) {
      case 'day':
        setCurrentDate(add ? addDays(currentDate, 1) : subDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(add ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
        break;
      case 'biweek':
        setCurrentDate(add ? addWeeks(currentDate, 2) : subWeeks(currentDate, 2));
        break;
      case 'month':
        setCurrentDate(add ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
        break;
      case 'quarter':
        setCurrentDate(add ? addQuarters(currentDate, 1) : subQuarters(currentDate, 1));
        break;
      case 'year':
        setCurrentDate(add ? addYears(currentDate, 1) : subYears(currentDate, 1));
        break;
    }
  };

  const getDateRangeLabel = () => {
    switch (viewMode) {
      case 'day':
        return format(currentDate, 'EEEE d MMMM yyyy', { locale: fr });
      case 'week':
        return `${format(dateRangeStart, 'd MMM', { locale: fr })} - ${format(dateRangeEnd, 'd MMM yyyy', { locale: fr })}`;
      case 'biweek':
        return `${format(dateRangeStart, 'd MMM', { locale: fr })} - ${format(dateRangeEnd, 'd MMM yyyy', { locale: fr })}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: fr });
      case 'quarter':
        return `T${Math.ceil((currentDate.getMonth() + 1) / 3)} ${format(currentDate, 'yyyy')}`;
      case 'year':
        return format(currentDate, 'yyyy');
      default:
        return '';
    }
  };

  // Queries
  const { data: interventionsData, isLoading } = useQuery({
    queryKey: [
      'interventions',
      format(dateRangeStart, 'yyyy-MM-dd'),
      format(dateRangeEnd, 'yyyy-MM-dd'),
      filters,
    ],
    queryFn: () =>
      interventionsApi.list({
        dateDebut: format(dateRangeStart, 'yyyy-MM-dd'),
        dateFin: format(dateRangeEnd, 'yyyy-MM-dd'),
        clientId: filters.clientId || undefined,
        // EN_RETARD est un filtre virtuel géré côté client
        statut: filters.statut !== 'ALL' && filters.statut !== 'EN_RETARD' ? filters.statut : undefined,
        type: filters.type !== 'ALL' ? filters.type : undefined,
        prestation: filters.prestation || undefined,
        limit: 500,
      }),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients-active'],
    queryFn: () => clientsApi.list({ actif: true, limit: 200 }),
  });

  const { data: prestations = [] } = useQuery({
    queryKey: ['prestations-active'],
    queryFn: () => prestationsApi.list(true),
  });

  const { data: selectedInterventionDetail } = useQuery({
    queryKey: ['intervention', selectedIntervention?.id],
    queryFn: () => interventionsApi.get(selectedIntervention!.id),
    enabled: !!selectedIntervention,
  });

  const { data: interventionFromParam } = useQuery({
    queryKey: ['intervention', interventionIdParam],
    queryFn: () => interventionsApi.get(interventionIdParam!),
    enabled: !!interventionIdParam,
  });

  const { data: employes = [] } = useQuery({
    queryKey: ['employes'],
    queryFn: employesApi.list,
    enabled: canDo('viewEmployes'),
  });

  const { data: postes = [] } = useQuery({
    queryKey: ['postes'],
    queryFn: () => postesApi.list(true),
  });

  const { data: congesApprouves } = useQuery({
    queryKey: ['conges-approuves-planning'],
    queryFn: () => rhApi.listConges({ statut: 'APPROUVE' }),
    enabled: canDo('viewEmployes'),
  });
  const congesActifs: Pick<Conge, 'employeId' | 'dateDebut' | 'dateFin'>[] = congesApprouves?.conges || [];

  // Stats queries
  const { data: interventionsEnRetard = [] } = useQuery({
    queryKey: ['interventions-en-retard'],
    queryFn: interventionsApi.enRetard,
  });

  const { data: interventionsAPlanifier7j = [] } = useQuery({
    queryKey: ['interventions-a-planifier-7j'],
    queryFn: () => interventionsApi.aPlanifier(7),
  });

  const employeNames = useMemo(() => {
    const names = (employes as Employe[])
      .map((e) => `${e.prenom} ${e.nom}`.trim())
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [employes]);

  // Filter interventions client-side for additional filters
  const interventions = useMemo(() => {
    let result = interventionsData?.interventions || [];

    if (filters.siteId) {
      result = result.filter((i) => i.siteId === filters.siteId);
    }

    if (filters.responsable) {
      result = result.filter((i) =>
        i.responsable?.toLowerCase().includes(filters.responsable.toLowerCase())
      );
    }

    if (filters.employeId) {
      result = result.filter((i) =>
        i.interventionEmployes?.some((ie) => ie.employeId === filters.employeId)
      );
    }

    // Filtre virtuel EN_RETARD (interventions passées non réalisées)
    if (filters.statut === 'EN_RETARD') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      result = result.filter((i) => {
        const datePrevue = parseISO(i.datePrevue);
        return datePrevue < today && i.statut !== 'REALISEE' && i.statut !== 'ANNULEE';
      });
    }

    // Recherche par nom de client
    if (filters.searchClient) {
      const search = filters.searchClient.toLowerCase();
      result = result.filter((i) =>
        i.client?.nomEntreprise?.toLowerCase().includes(search)
      );
    }

    return result;
  }, [
    interventionsData?.interventions,
    filters.siteId,
    filters.responsable,
    filters.employeId,
    filters.statut,
    filters.searchClient,
  ]);

  // Calculate planning stats
  const planningStats = useMemo(() => {
    const allInterventions = interventionsData?.interventions || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Interventions d'aujourd'hui
    const todayInterventions = allInterventions.filter((i) =>
      isSameDay(parseISO(i.datePrevue), today)
    );

    // Interventions de la semaine courante
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
    const weekInterventions = allInterventions.filter((i) => {
      const date = parseISO(i.datePrevue);
      return date >= weekStart && date <= weekEnd;
    });

    // Par statut (sur la période affichée)
    const aPlanifier = allInterventions.filter((i) => i.statut === 'A_PLANIFIER').length;
    const planifiees = allInterventions.filter((i) => i.statut === 'PLANIFIEE').length;
    const realisees = allInterventions.filter((i) => i.statut === 'REALISEE').length;
    const reportees = allInterventions.filter((i) => i.statut === 'REPORTEE').length;

    // Réclamations actives
    const reclamationsActives = allInterventions.filter((i) =>
      i.type === 'RECLAMATION' && i.statut !== 'REALISEE' && i.statut !== 'ANNULEE'
    ).length;

    // Taux de réalisation
    const total = allInterventions.filter((i) => i.statut !== 'ANNULEE').length;
    const tauxRealisation = total > 0 ? Math.round((realisees / total) * 100) : 0;

    return {
      aujourdhui: todayInterventions.length,
      cetteSemaine: weekInterventions.length,
      aPlanifier,
      planifiees,
      realisees,
      reportees,
      reclamationsActives,
      tauxRealisation,
      enRetard: interventionsEnRetard.length,
    };
  }, [interventionsData?.interventions, interventionsEnRetard]);

  const dayPreviewInterventions = useMemo(() => {
    if (!dayPreviewDate) return [];
    return interventions.filter((i) => isSameDay(parseISO(i.datePrevue), dayPreviewDate));
  }, [dayPreviewDate, interventions]);

  useEffect(() => {
    if (!interventionIdParam) return;
    const fromList = interventions.find((i) => i.id === interventionIdParam);
    const target = fromList || interventionFromParam;
    if (target) {
      setSelectedIntervention(target);
      setCurrentDate(parseISO(target.datePrevue));
      setViewMode('day');
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('interventionId');
      setSearchParams(nextParams, { replace: true });
    }
  }, [interventionIdParam, interventions, interventionFromParam, searchParams, setSearchParams]);

  useEffect(() => {
    if (!viewParam && !prestationParam) return;
    if (viewParam === 'week') {
      setViewMode('week');
    } else if (viewParam === 'day') {
      setViewMode('day');
    } else if (viewParam === 'biweek') {
      setViewMode('biweek');
    } else if (viewParam === 'month') {
      setViewMode('month');
    } else if (viewParam === 'quarter') {
      setViewMode('quarter');
    } else if (viewParam === 'year') {
      setViewMode('year');
    }
    if (prestationParam) {
      setFilters((prev) => ({ ...prev, prestation: prestationParam }));
    }
    const nextParams = new URLSearchParams(searchParams);
    if (viewParam) nextParams.delete('view');
    if (prestationParam) nextParams.delete('prestation');
    setSearchParams(nextParams, { replace: true });
  }, [viewParam, prestationParam, searchParams, setSearchParams]);

  const clients = clientsData?.clients || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: interventionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.refetchQueries({ queryKey: ['interventions'] });
      toast.success('Intervention créée');
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateInterventionInput> }) =>
      interventionsApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.refetchQueries({ queryKey: ['interventions'] });
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: ['intervention', variables.id] });
        queryClient.refetchQueries({ queryKey: ['intervention', variables.id] });
      }
      toast.success('Intervention mise à jour');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const realiserMutation = useMutation({
    mutationFn: ({
      id,
      options,
    }: {
      id: string;
      options: { notesTerrain?: string; creerProchaine?: boolean; dateRealisee?: string };
    }) => interventionsApi.realiser(id, options),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.refetchQueries({ queryKey: ['interventions'] });
      // Invalider TOUTES les queries d'interventions individuelles
      // car les notes terrain affectent previousIntervention des autres interventions du même site
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'intervention'
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (data.nextCreated) {
        toast.success(
          `Intervention réalisée. Prochaine créée pour le ${formatDate(data.nextIntervention.datePrevue)}`
        );
      } else {
        toast.success('Intervention marquée comme réalisée');
      }
      setRealiserIntervention(null);
      setSelectedIntervention(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la réalisation');
    },
  });

  const reporterMutation = useMutation({
    mutationFn: ({
      id,
      nouvelleDatePrevue,
      raison,
    }: {
      id: string;
      nouvelleDatePrevue: string;
      raison: string;
    }) => interventionsApi.reporter(id, nouvelleDatePrevue, raison),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.refetchQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      // Invalider le cache de l'intervention individuelle pour que le dialog
      // Réaliser reçoive la nouvelle datePrevue (date de report) et non l'ancienne.
      queryClient.invalidateQueries({ queryKey: ['intervention', variables.id] });
      toast.success('Intervention reportée avec succès');
      setReporterIntervention(null);
      setSelectedIntervention(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors du report');
    },
  });

  const annulerMutation = useMutation({
    mutationFn: ({
      id,
      raison,
    }: {
      id: string;
      raison: string;
    }) => interventionsApi.annuler(id, raison),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.refetchQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Intervention annulée');
      setAnnulerIntervention(null);
      setSelectedIntervention(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'annulation');
    },
  });

  const closeAttestationDialog = () => {
    setAttestationIntervention(null);
    setAttestationKind('passage');
    setAttestationBody('');
    setAttestationInitialBody('');
    setAttestationLoading(false);
    setAttestationSaving(false);
  };

  const openAttestationDialog = async (intervention: Intervention, kind: 'passage' | 'garantie' | 'controle') => {
    setAttestationIntervention(intervention);
    setAttestationKind(kind);
    setAttestationLoading(true);
    setAttestationBody('');
    setAttestationInitialBody('');
    try {
      const data = kind === 'garantie'
        ? await interventionsApi.getAttestationGarantieBody(intervention.id)
        : kind === 'controle'
          ? await interventionsApi.getAttestationControleBody(intervention.id)
          : await interventionsApi.getAttestationBody(intervention.id);
      setAttestationBody(data.bodyText || '');
      setAttestationInitialBody(data.bodyText || '');
    } catch (error: any) {
      const message = error?.response?.data?.error || "Erreur lors du chargement du message de l'attestation";
      toast.error(message);
      setAttestationIntervention(null);
    } finally {
      setAttestationLoading(false);
    }
  };

  const openBLDialog = async (intervention: Intervention) => {
    setBLDialogIntervention(intervention);
    setBLDialogLoading(true);
    setBLDialogCommandes([]);
    try {
      // Fetch commandes du client
      const commandesResult = await commerceApi.listCommandes({ clientId: intervention.clientId, limit: 50 });
      const commandes = (commandesResult.commandes || []).filter((c: any) => c.statut !== 'ANNULEE' && c.statut !== 'LIVREE');
      setBLDialogCommandes(commandes.map((c: any) => ({ id: c.id, ref: c.ref })));
    } catch {
      toast.error('Erreur lors du chargement des commandes');
      setBLDialogIntervention(null);
    } finally {
      setBLDialogLoading(false);
    }
  };

  const handleCreerBLFromCommande = async (commandeId: string) => {
    setBLCreating(true);
    try {
      const bl = await commerceApi.creerBLFromCommande(commandeId);
      toast.success(`Bon de livraison ${bl.ref} créé`);
      setBLDialogIntervention(null);
      setBLDialogCommandes([]);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Erreur lors de la création du BL');
    } finally {
      setBLCreating(false);
    }
  };

  const generateAttestationWithBody = async () => {
    if (!attestationIntervention) return;
    try {
      setAttestationSaving(true);

      if (attestationBody.trim() !== attestationInitialBody.trim()) {
        if (attestationKind === 'garantie') {
          await interventionsApi.updateAttestationGarantieBody(attestationIntervention.id, {
            bodyText: attestationBody.trim(),
          });
        } else if (attestationKind === 'controle') {
          await interventionsApi.updateAttestationControleBody(attestationIntervention.id, {
            bodyText: attestationBody.trim(),
          });
        } else {
          await interventionsApi.updateAttestationBody(attestationIntervention.id, {
            bodyText: attestationBody.trim(),
          });
        }
      }

      const blob = attestationKind === 'garantie'
        ? await interventionsApi.downloadAttestationGarantie(attestationIntervention.id)
        : attestationKind === 'controle'
          ? await interventionsApi.downloadAttestationControle(attestationIntervention.id)
        : await interventionsApi.downloadAttestationPassage(attestationIntervention.id);
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `attestation-${attestationKind}-${attestationIntervention.id}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Attestation générée avec succès');
      closeAttestationDialog();
    } catch (error: any) {
      const message = error?.response?.data?.error || "Erreur lors de la generation de l'attestation";
      toast.error(message);
    } finally {
      setAttestationSaving(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const intervention = event.active.data.current?.intervention as Intervention;
    setDraggedIntervention(intervention);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedIntervention(null);

    const { active, over } = event;
    if (!over || !active.data.current?.intervention) return;

    const intervention = active.data.current.intervention as Intervention;
    const dropData = over.data.current as { date?: Date; hour?: number; noTime?: boolean };

    if (!dropData?.date) return;

    // Don't allow moving realized or cancelled interventions
    if (intervention.statut === 'REALISEE' || intervention.statut === 'ANNULEE') {
      toast.error("Impossible de déplacer une intervention réalisée ou annulée");
      return;
    }

    const newDatePrevue = format(dropData.date, 'yyyy-MM-dd');
    let newHeurePrevue: string | undefined = intervention.heurePrevue || undefined;

    // If dropped on an hour slot, update the time
    if (typeof dropData.hour === 'number') {
      newHeurePrevue = `${dropData.hour.toString().padStart(2, '0')}:00`;
    }

    // If dropped on "no time" zone, remove the time
    if (dropData.noTime) {
      newHeurePrevue = undefined;
    }

    // Only update if something changed
    if (
      newDatePrevue !== format(parseISO(intervention.datePrevue), 'yyyy-MM-dd') ||
      newHeurePrevue !== intervention.heurePrevue
    ) {
      updateMutation.mutate({
        id: intervention.id,
        data: {
          datePrevue: newDatePrevue,
          heurePrevue: newHeurePrevue,
        },
      });
    }
  };

  const handleExportCalendar = () => {
    // Pour les vues jour et liste, ouvrir le dialogue pour choisir la période
    if (viewMode === 'day' || viewMode === 'list') {
      setIsExportDialogOpen(true);
    } else {
      // Pour les autres vues, exporter directement la période actuelle
      downloadCalendar(format(dateRangeStart, 'yyyy-MM-dd'), format(dateRangeEnd, 'yyyy-MM-dd'));
    }
  };

  const downloadCalendar = async (dateDebut: string, dateFin: string) => {
    try {
      const blob = await importExportApi.downloadGoogleCalendar({
        dateDebut,
        dateFin,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `planning-${dateDebut}-${dateFin}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Calendrier téléchargé avec succès');
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Erreur lors du téléchargement';
      toast.error(message);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-5">
        {employeNames.length > 0 && (
          <datalist id="employes-list">
            {employeNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Planning</h1>
            <p className="text-sm text-gray-400 mt-0.5 capitalize hidden sm:block">
              {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex h-9 text-gray-600 border-gray-200" onClick={handleExportCalendar}>
              <Calendar className="h-4 w-4 mr-1.5" />
              Exporter
            </Button>
            {canDo('createIntervention') && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm shadow-green-200 h-9"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Nouvelle intervention</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <PlanningStatCard
            title="Aujourd'hui"
            value={planningStats.aujourdhui}
            icon={Calendar}
            variant="default"
            onClick={() => { setCurrentDate(new Date()); setViewMode('day'); }}
            isActive={viewMode === 'day' && isSameDay(currentDate, new Date())}
          />
          <PlanningStatCard
            title="Cette semaine"
            value={planningStats.cetteSemaine}
            icon={CalendarDays}
            variant="default"
            onClick={() => { setCurrentDate(new Date()); setViewMode('week'); }}
            isActive={viewMode === 'week'}
          />
          <PlanningStatCard
            title="À planifier"
            value={interventionsAPlanifier7j.length}
            icon={Clock}
            variant="warning"
            subtitle="7 prochains jours"
            onClick={() => setFilters({ ...filters, statut: 'A_PLANIFIER' })}
            isActive={filters.statut === 'A_PLANIFIER'}
          />
          <PlanningStatCard
            title="En retard"
            value={planningStats.enRetard}
            icon={AlertTriangle}
            variant={planningStats.enRetard > 0 ? 'error' : 'default'}
            onClick={() => setFilters({ ...filters, statut: 'EN_RETARD' })}
            isActive={filters.statut === 'EN_RETARD'}
          />
          <PlanningStatCard
            title="Réclamations"
            value={planningStats.reclamationsActives}
            icon={AlertCircle}
            variant={planningStats.reclamationsActives > 0 ? 'orange' : 'default'}
            subtitle="actives"
            onClick={() => setFilters({ ...filters, type: 'RECLAMATION', statut: 'ALL' })}
            isActive={filters.type === 'RECLAMATION'}
          />
          <PlanningStatCard
            title="Taux réalisation"
            value={`${planningStats.tauxRealisation}%`}
            icon={TrendingUp}
            variant="success"
            showProgress
            progressValue={planningStats.tauxRealisation}
            subtitle="sur la période"
          />
        </div>

        {/* ── Barre de contrôles ── */}
        <div className="bg-white rounded-xl shadow-sm px-4 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">

            {/* Navigation date */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate('prev')}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-bold text-gray-900 min-w-[140px] sm:min-w-[180px] text-center capitalize">
                {getDateRangeLabel()}
              </span>
              <button
                onClick={() => navigate('next')}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('today')}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
              >
                Auj.
              </button>
            </div>

            {/* Filtres + vue */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Recherche client — masquée sur mobile */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Rechercher client..."
                  className="pl-8 w-[160px] h-8 text-sm border-gray-200"
                  value={filters.searchClient || ''}
                  onChange={(e) => setFilters({ ...filters, searchClient: e.target.value })}
                />
              </div>

              {/* Quick status pills */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
                {[
                  { value: 'ALL',        label: 'Tous',    count: null },
                  { value: 'A_PLANIFIER',label: 'À plan.', count: planningStats.aPlanifier },
                  { value: 'PLANIFIEE',  label: 'Planif.', count: planningStats.planifiees },
                  { value: 'EN_RETARD',  label: 'Retard',  count: planningStats.enRetard },
                  { value: 'REALISEE',   label: 'Réal.',   count: planningStats.realisees },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setFilters({ ...filters, statut: item.value as FilterStatut })}
                    className={cn(
                      'h-6 px-2 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 whitespace-nowrap',
                      filters.statut === item.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {item.label}
                    {item.count !== null && item.count > 0 && (
                      <span className={cn(
                        'text-[10px] font-bold px-1 rounded',
                        filters.statut === item.value ? 'text-green-600' : 'text-gray-400'
                      )}>
                        {item.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Type filter — masqué sur mobile */}
              <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
                <SelectTrigger className="hidden sm:flex w-[130px] h-8 text-xs border-gray-200">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous types</SelectItem>
                  <SelectItem value="OPERATION">Opération</SelectItem>
                  <SelectItem value="CONTROLE">Contrôle</SelectItem>
                  <SelectItem value="RECLAMATION">Réclamation</SelectItem>
                  <SelectItem value="PREMIERE_VISITE">1ère visite</SelectItem>
                  <SelectItem value="DEPLACEMENT_COMMERCIAL">Dépl. comm.</SelectItem>
                </SelectContent>
              </Select>

              {/* Advanced filters */}
              <FiltersSheet
                clients={clients}
                prestations={prestations}
                employes={employes as Employe[]}
                filters={filters}
                onFiltersChange={setFilters}
              />

              {/* Vue selector — masqué sur mobile (forcé en liste) */}
              {!isMobile && (
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                  <SelectTrigger className="w-[110px] h-8 text-xs border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Jour</SelectItem>
                    <SelectItem value="week">Semaine</SelectItem>
                    <SelectItem value="biweek">2 semaines</SelectItem>
                    <SelectItem value="month">Mois</SelectItem>
                    <SelectItem value="quarter">Trimestre</SelectItem>
                    <SelectItem value="year">Année</SelectItem>
                    <SelectItem value="list">Liste</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Carte — masquée sur mobile */}
              {!isMobile && (
                <button
                  onClick={() => setShowMap((v) => !v)}
                  className={cn(
                    'h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all',
                    showMap
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <Map className="h-3.5 w-3.5" />
                  Carte
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Vue calendrier / liste ── */}
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Chargement du planning...</p>
          </div>
        ) : (
          <div className={cn(showMap && 'grid grid-cols-2 gap-4 items-start')}>
            <div>
            {viewMode === 'day' && (
              <DayView
                date={currentDate}
                interventions={interventions}
                onInterventionClick={setSelectedIntervention}
              />
            )}
            {viewMode === 'week' && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-sm px-1">
                  <span className="font-medium text-muted-foreground">
                    {interventions.length} intervention{interventions.length > 1 ? 's' : ''} cette semaine
                  </span>
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {interventions.filter((i) => i.statut === 'REALISEE').length} réalisée{interventions.filter((i) => i.statut === 'REALISEE').length > 1 ? 's' : ''}
                  </span>
                  <span className="text-yellow-600 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {interventions.filter((i) => i.statut !== 'REALISEE' && i.statut !== 'ANNULEE').length} en cours
                  </span>
                </div>
                <WeekView
                  weekStart={dateRangeStart}
                  interventions={interventions}
                  onInterventionClick={setSelectedIntervention}
                  onDayDoubleClick={handleDayDoubleClick}
                  onDayClick={setDayPreviewDate}
                />
              </div>
            )}
            {viewMode === 'biweek' && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-sm px-1">
                  <span className="font-medium text-muted-foreground">
                    {interventions.length} intervention{interventions.length > 1 ? 's' : ''} sur 2 semaines
                  </span>
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {interventions.filter((i) => i.statut === 'REALISEE').length} réalisée{interventions.filter((i) => i.statut === 'REALISEE').length > 1 ? 's' : ''}
                  </span>
                  <span className="text-yellow-600 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {interventions.filter((i) => i.statut !== 'REALISEE' && i.statut !== 'ANNULEE').length} en cours
                  </span>
                </div>
                <BiWeekView
                  startDate={dateRangeStart}
                  interventions={interventions}
                  onInterventionClick={setSelectedIntervention}
                  onDayDoubleClick={handleDayDoubleClick}
                  onDayClick={setDayPreviewDate}
                />
              </div>
            )}
            {viewMode === 'month' && (
              <MonthView
                month={currentDate}
                interventions={interventions}
                onInterventionClick={setSelectedIntervention}
                onDayDoubleClick={handleDayDoubleClick}
                onDayClick={setDayPreviewDate}
              />
            )}
            {viewMode === 'quarter' && (
              <QuarterView
                quarter={currentDate}
                interventions={interventions}
                onInterventionClick={setSelectedIntervention}
                onDayDoubleClick={handleDayDoubleClick}
                onDayClick={setDayPreviewDate}
              />
            )}
            {viewMode === 'year' && (
              <YearView
                year={currentDate}
                interventions={interventions}
                onInterventionClick={setSelectedIntervention}
                onDayDoubleClick={handleDayDoubleClick}
                onDayClick={setDayPreviewDate}
              />
            )}
            {viewMode === 'list' && (
              <ListView
                interventions={interventions}
                onInterventionClick={setSelectedIntervention}
              />
            )}
            </div>
            {showMap && (
              <div className={cn(showMap ? 'block' : 'hidden')}>
                <PlanningMap
                  interventions={interventions}
                  onInterventionClick={setSelectedIntervention}
                />
              </div>
            )}
          </div>
        )}

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedIntervention && (
            <div className={cn('p-2 rounded text-xs shadow-lg', getStatutColor(draggedIntervention.statut))}>
              <div className="font-medium">{draggedIntervention.client?.nomEntreprise}</div>
              <div className="opacity-75">
                {getInterventionTypeIcon(draggedIntervention.type)}
              </div>
            </div>
          )}
        </DragOverlay>

        {/* Day Preview Dialog */}
        <Dialog
          open={!!dayPreviewDate}
          onOpenChange={(open) => {
            if (!open) setDayPreviewDate(null);
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {dayPreviewDate
                  ? `Programme du ${format(dayPreviewDate, 'EEEE d MMMM yyyy', { locale: fr })}`
                  : 'Programme du jour'}
              </DialogTitle>
              <DialogDescription>
                {dayPreviewInterventions.length} intervention(s)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {dayPreviewInterventions.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  Aucune intervention prévue.
                </div>
              ) : (
                dayPreviewInterventions.map((intervention) => {
                  const timeRange = getTimeRange(intervention);
                  const siteName = intervention.site?.nom || intervention.client?.sites?.[0]?.nom;
                  return (
                    <button
                      key={intervention.id}
                      type="button"
                      onClick={() => {
                        setSelectedIntervention(intervention);
                        setDayPreviewDate(null);
                      }}
                      className="w-full text-left p-3 rounded-md border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{intervention.client?.nomEntreprise}</div>
                          {siteName && (
                            <div className="text-xs text-muted-foreground truncate">{siteName}</div>
                          )}
                          {intervention.prestation && (
                            <div className="text-xs text-muted-foreground truncate">
                              {intervention.prestation}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {timeRange && (
                            <span className="text-xs text-muted-foreground">{timeRange}</span>
                          )}
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                              getInterventionTypeBadgeClass(intervention.type)
                            )}
                          >
                            {getInterventionTypeLabel(intervention.type)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  if (dayPreviewDate) {
                    setCurrentDate(dayPreviewDate);
                    setViewMode('day');
                  }
                  setDayPreviewDate(null);
                }}
              >
                Voir la vue Jour
              </Button>
              <Button variant="outline" onClick={() => setDayPreviewDate(null)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Intervention Detail Dialog */}
        <InterventionDetailDialog
          intervention={selectedInterventionDetail || selectedIntervention}
          onClose={() => setSelectedIntervention(null)}
          onRealiser={() => {
            setRealiserIntervention(selectedInterventionDetail || selectedIntervention);
          }}
          onReporter={() => {
            setReporterIntervention(selectedInterventionDetail || selectedIntervention);
          }}
          onAnnuler={() => {
            setAnnulerIntervention(selectedInterventionDetail || selectedIntervention);
          }}
          onUpdateHoraire={(data) => {
            if (!selectedIntervention) return;
            updateMutation.mutate({
              id: selectedIntervention.id,
              data,
            });
          }}
          onUpdateEmployes={(employesData) => {
            if (!selectedIntervention) return;
            updateMutation.mutate({
              id: selectedIntervention.id,
              data: { employes: employesData },
            });
          }}
          onGenerateFacture={() => {
            const intervention = selectedInterventionDetail || selectedIntervention;
            if (!intervention) return;
            const site = intervention.site || intervention.client?.sites?.[0];

            // Chercher le prix de la prestation dans le ContratSite correspondant
            let prixPrestation: number | undefined;
            if (intervention.contrat?.contratSites && intervention.siteId && intervention.prestation) {
              const cs = intervention.contrat.contratSites.find((s: any) => s.siteId === intervention.siteId);
              if (cs?.prixPrestations && typeof cs.prixPrestations === 'object') {
                prixPrestation = (cs.prixPrestations as Record<string, number>)[intervention.prestation];
              }
            }

            routerNavigate('/commerce', {
              state: {
                generateFacture: true,
                clientId: intervention.clientId,
                clientNom: intervention.client?.nomEntreprise,
                siteId: site?.id,
                siteNom: site?.nom,
                prestation: intervention.prestation,
                prixPrestation,
                interventionId: intervention.id,
                interventionRef: intervention.type,
                dateIntervention: intervention.dateRealisee || intervention.datePrevue,
                contratType: intervention.contrat?.type,
                contratNumeroBonCommande: intervention.contrat?.numeroBonCommande,
                contratDateDebut: intervention.contrat?.dateDebut,
              },
            });
            setSelectedIntervention(null);
          }}
          onDownloadAttestation={async () => {
            const intervention = selectedInterventionDetail || selectedIntervention;
            if (!intervention) return;
            if (intervention.type !== 'OPERATION') {
              toast.error("Ce document est disponible uniquement pour les interventions de type OPERATION");
              return;
            }
            await openAttestationDialog(intervention, 'passage');
          }}
          onDownloadAttestationGarantie={async () => {
            const intervention = selectedInterventionDetail || selectedIntervention;
            if (!intervention) return;
            if (intervention.type !== 'OPERATION') {
              toast.error("Ce document est disponible uniquement pour les interventions de type OPERATION");
              return;
            }
            await openAttestationDialog(intervention, 'garantie');
          }}
          onDownloadAttestationControle={async () => {
            const intervention = selectedInterventionDetail || selectedIntervention;
            if (!intervention) return;
            if (intervention.type !== 'CONTROLE') {
              toast.error("Ce document est disponible uniquement pour les visites de contrôle");
              return;
            }
            await openAttestationDialog(intervention, 'controle');
          }}
          onCreateBL={async () => {
            const intervention = selectedInterventionDetail || selectedIntervention;
            if (!intervention) return;
            await openBLDialog(intervention);
          }}
          canEdit={canDo('editIntervention')}
          canRealiser={canDo('realiserIntervention')}
          canManage={canDo('manageCommerce')}
          canExport={canDo('exportData')}
          employes={employes as Employe[]}
          postes={postes as Poste[]}
          congesActifs={congesActifs}
        />

        {/* Export Calendar Dialog */}
        <ExportCalendarDialog
          open={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          currentDate={currentDate}
          onExport={downloadCalendar}
        />

        {/* Realiser Dialog */}
        <RealiserDialog
          intervention={realiserIntervention}
          onClose={() => setRealiserIntervention(null)}
          onConfirm={(data) => {
            if (realiserIntervention) {
              realiserMutation.mutate({
                id: realiserIntervention.id,
                options: data,
              });
            }
          }}
          isPending={realiserMutation.isPending}
        />

        {/* Reporter Dialog */}
        <ReporterDialog
          intervention={reporterIntervention}
          onClose={() => setReporterIntervention(null)}
          onConfirm={(data) => {
            if (reporterIntervention) {
              reporterMutation.mutate({
                id: reporterIntervention.id,
                nouvelleDatePrevue: data.nouvelleDatePrevue,
                raison: data.raison,
              });
            }
          }}
          isPending={reporterMutation.isPending}
        />

        {/* Annuler Dialog */}
        <AnnulerDialog
          intervention={annulerIntervention}
          onClose={() => setAnnulerIntervention(null)}
          onConfirm={(data) => {
            if (annulerIntervention) {
              annulerMutation.mutate({
                id: annulerIntervention.id,
                raison: data.raison,
              });
            }
          }}
          isPending={annulerMutation.isPending}
        />

        <AttestationBodyDialog
          open={!!attestationIntervention}
          bodyText={attestationBody}
          title={
            attestationKind === 'garantie'
              ? 'Attestation de Garantie'
              : attestationKind === 'controle'
                ? 'Attestation de Visite de Controle'
                : 'Attestation de passage'
          }
          description={
            attestationKind === 'garantie'
              ? 'Modifiez le corps du message. Cette version sera mémorisée pour ce contrat (attestation de garantie).'
              : attestationKind === 'controle'
                ? 'Modifiez le corps du message. Cette version est partagée et mémorisée pour ce contrat.'
              : 'Modifiez le corps du message. Cette version sera mémorisée pour ce contrat.'
          }
          isLoading={attestationLoading}
          isSaving={attestationSaving}
          onBodyChange={setAttestationBody}
          onClose={closeAttestationDialog}
          onGenerate={generateAttestationWithBody}
        />

        {/* BL Creation Dialog */}
        <Dialog open={!!blDialogIntervention} onOpenChange={(open) => { if (!open) { setBLDialogIntervention(null); setBLDialogCommandes([]); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                Créer un Bon de Livraison
              </DialogTitle>
              <DialogDescription>
                Sélectionnez la commande client pour laquelle générer un BL.
              </DialogDescription>
            </DialogHeader>
            {blDialogLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : blDialogCommandes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <PackageCheck className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Aucune commande ouverte pour ce client.</p>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {blDialogCommandes.map((commande) => (
                  <Button
                    key={commande.id}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3"
                    disabled={blCreating}
                    onClick={() => handleCreerBLFromCommande(commande.id)}
                  >
                    <Truck className="h-4 w-4 mr-3 text-blue-500 shrink-0" />
                    <span className="font-medium">{commande.ref}</span>
                  </Button>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setBLDialogIntervention(null); setBLDialogCommandes([]); }}>
                Annuler
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Intervention Dialog */}
        <CreateInterventionDialog
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          clients={clients}
          prestations={prestations}
          employes={employes as Employe[]}
          postes={postes as Poste[]}
          congesActifs={congesActifs}
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />
      </div>{/* inner max-w container */}
      </div>{/* bg-gray-50 wrapper */}
    </DndContext>
  );
}
