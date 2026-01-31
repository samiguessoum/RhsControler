import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: fr });
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

export function formatDateLong(date: string | Date): string {
  return formatDate(date, 'EEEE d MMMM yyyy');
}

export function getStatutColor(statut: string): string {
  const colors: Record<string, string> = {
    A_PLANIFIER: 'bg-yellow-100 text-yellow-800',
    PLANIFIEE: 'bg-blue-100 text-blue-800',
    REALISEE: 'bg-green-100 text-green-800',
    REPORTEE: 'bg-orange-100 text-orange-800',
    ANNULEE: 'bg-gray-100 text-gray-800',
    ACTIF: 'bg-green-100 text-green-800',
    SUSPENDU: 'bg-yellow-100 text-yellow-800',
    TERMINE: 'bg-gray-100 text-gray-800',
  };
  return colors[statut] || 'bg-gray-100 text-gray-800';
}

export function getStatutLabel(statut: string): string {
  const labels: Record<string, string> = {
    A_PLANIFIER: 'À planifier',
    PLANIFIEE: 'Planifiée',
    REALISEE: 'Réalisée',
    REPORTEE: 'Reportée',
    ANNULEE: 'Annulée',
    ACTIF: 'Actif',
    SUSPENDU: 'Suspendu',
    TERMINE: 'Terminé',
    OPERATION: 'Opération',
    CONTROLE: 'Visite de contrôle',
    ANNUEL: 'Annuel',
    PONCTUEL: 'Ponctuel',
    HEBDOMADAIRE: 'Hebdomadaire',
    MENSUELLE: 'Mensuelle',
    TRIMESTRIELLE: 'Trimestrielle',
    SEMESTRIELLE: 'Semestrielle',
    ANNUELLE: 'Annuelle',
    PERSONNALISEE: 'Personnalisée',
  };
  return labels[statut] || statut;
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    DIRECTION: 'Direction',
    PLANNING: 'Planning',
    EQUIPE: 'Équipe',
    LECTURE: 'Lecture seule',
  };
  return labels[role] || role;
}

export function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    DIRECTION: 'bg-purple-100 text-purple-800',
    PLANNING: 'bg-blue-100 text-blue-800',
    EQUIPE: 'bg-green-100 text-green-800',
    LECTURE: 'bg-gray-100 text-gray-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
