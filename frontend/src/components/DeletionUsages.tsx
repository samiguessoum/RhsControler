import { Loader2 } from 'lucide-react';
import type { DeletionUsages as Usages } from '@/services/api';

const STATUT_LABELS: Record<string, string> = {
  A_PLANIFIER: 'À planifier',
  PLANIFIEE: 'Planifiée',
  REPORTEE: 'Reportée',
  DRAFT: 'Brouillon',
  IN_PROGRESS: 'En cours',
  SUBMITTED: 'Soumise',
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
};

/**
 * Avertissement avant suppression : liste les opérations où la personne
 * est encore affectée, pour penser à la remplacer.
 */
export function DeletionUsages({ usages, isLoading, nom }: { usages?: Usages; isLoading: boolean; nom: string }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Vérification des opérations associées...
      </div>
    );
  }
  if (!usages) return null;

  const historique = Object.entries(usages.historique).filter(([, n]) => n > 0);

  return (
    <div className="space-y-2">
      {usages.aRemplacer.length > 0 ? (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          <p>
            <strong>Attention :</strong> {nom} est associé(e) à{' '}
            <strong>{usages.aRemplacer.length} opération{usages.aRemplacer.length > 1 ? 's' : ''} en cours</strong>.
            Pensez à le/la remplacer :
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {usages.aRemplacer.map((u) => (
              <li key={`${u.kind}-${u.id}`} className="flex justify-between gap-3 text-xs">
                <span>{u.libelle}</span>
                <span className="shrink-0 text-orange-700">
                  {u.date ? new Date(u.date).toLocaleDateString('fr-FR') : ''} · {STATUT_LABELS[u.statut] ?? u.statut}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune opération en cours n'est associée.</p>
      )}
      {historique.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Historique : {historique.map(([label, n]) => `${n} ${label}`).join(', ')}. Ces données sont conservées, mais {nom} n'y apparaîtra plus.
        </p>
      )}
      {usages.compteLie && (
        <p className="text-xs text-muted-foreground">
          Le compte utilisateur {usages.compteLie.prenom} {usages.compteLie.nom}{usages.compteLie.email ? ` (${usages.compteLie.email})` : ''} sera également supprimé.
        </p>
      )}
    </div>
  );
}
