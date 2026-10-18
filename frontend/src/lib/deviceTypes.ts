import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { zoningApi } from '@/services/api';
import type { DeviceTypeConfig } from '@/types';

export const DEVICE_TYPE_MODE_LABELS: Record<DeviceTypeConfig['mode'], string> = {
  APPATAGE: "Appâtage (états de contrôle)",
  PIEGE: 'Piège (états de contrôle)',
  COMPTAGE: "Comptage d'insectes (type FK)",
};

// Type inconnu (supprimé ou pas encore chargé) : affichage neutre avec le code brut
const fallbackType = (code: string): DeviceTypeConfig => ({
  id: code,
  code,
  label: code,
  abreviation: code.slice(0, 2),
  emoji: null,
  color: '#64748b',
  mode: 'PIEGE',
  actif: false,
  ordre: 999,
});

/** Tous les types (actifs et inactifs), triés, avec un accès par code. */
export function useDeviceTypes() {
  const { data = [], isLoading } = useQuery<DeviceTypeConfig[]>({
    queryKey: ['device-types', 'all'],
    queryFn: () => zoningApi.listDeviceTypes(true),
    staleTime: 5 * 60 * 1000,
  });
  return useMemo(() => {
    const byCode = new Map(data.map((t) => [t.code, t]));
    return {
      types: data,
      activeTypes: data.filter((t) => t.actif),
      isLoading,
      get: (code: string) => byCode.get(code) ?? fallbackType(code),
    };
  }, [data, isLoading]);
}
