import { useState, useMemo } from 'react';
import { Plus, X, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Employe, Poste, InterventionEmployeInput } from '@/types';

interface EmployeSelectorProps {
  employes: Employe[];
  postes: Poste[];
  value: InterventionEmployeInput[];
  onChange: (value: InterventionEmployeInput[]) => void;
  label?: string;
}

// Ordre de priorité des postes (les autres seront à la fin par ordre alphabétique)
const POSTE_ORDER: Record<string, number> = {
  'opérateur': 1,
  'operateur': 1,
  'chauffeur': 2,
};

function getPosteOrder(posteName: string): number {
  const normalized = posteName.toLowerCase().trim();
  return POSTE_ORDER[normalized] || 100;
}

export function EmployeSelector({
  employes,
  postes,
  value,
  onChange,
  label = 'Equipe',
}: EmployeSelectorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedPosteId, setSelectedPosteId] = useState<string>('');
  const [selectedEmployeId, setSelectedEmployeId] = useState<string>('');

  // Postes actifs triés (Opérateur en premier, Chauffeur en deuxième)
  const sortedPostes = useMemo(() => {
    return postes
      .filter((p) => p.actif)
      .sort((a, b) => {
        const orderA = getPosteOrder(a.nom);
        const orderB = getPosteOrder(b.nom);
        if (orderA !== orderB) return orderA - orderB;
        return a.nom.localeCompare(b.nom);
      });
  }, [postes]);

  // Employés déjà sélectionnés pour le poste actuel
  const selectedEmployeIdsForCurrentPoste = useMemo(() => {
    if (!selectedPosteId) return new Set<string>();
    return new Set(
      value
        .filter((v) => v.posteId === selectedPosteId)
        .map((v) => v.employeId)
    );
  }, [value, selectedPosteId]);

  // Employés filtrés par le poste sélectionné ET non déjà sélectionnés pour ce poste
  const availableEmployes = useMemo(() => {
    if (!selectedPosteId) return [];
    return employes
      .filter((emp) =>
        emp.postes.some((p) => p.id === selectedPosteId) &&
        !selectedEmployeIdsForCurrentPoste.has(emp.id)
      )
      .sort((a, b) => {
        const nameA = `${a.prenom} ${a.nom}`.toLowerCase();
        const nameB = `${b.prenom} ${b.nom}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [employes, selectedPosteId, selectedEmployeIdsForCurrentPoste]);

  // Regrouper les employés sélectionnés par poste
  const groupedByPoste = useMemo(() => {
    const groups: Record<string, { poste: Poste | undefined; employes: { employe: Employe | undefined; index: number }[] }> = {};

    value.forEach((item, index) => {
      const poste = postes.find((p) => p.id === item.posteId);
      const employe = employes.find((e) => e.id === item.employeId);
      const posteId = item.posteId;

      if (!groups[posteId]) {
        groups[posteId] = { poste, employes: [] };
      }
      groups[posteId].employes.push({ employe, index });
    });

    // Trier les groupes par ordre de poste
    return Object.entries(groups)
      .sort(([, a], [, b]) => {
        const orderA = getPosteOrder(a.poste?.nom || '');
        const orderB = getPosteOrder(b.poste?.nom || '');
        if (orderA !== orderB) return orderA - orderB;
        return (a.poste?.nom || '').localeCompare(b.poste?.nom || '');
      })
      .map(([posteId, data]) => ({ posteId, ...data }));
  }, [value, postes, employes]);

  const handleAddEmploye = () => {
    if (!selectedEmployeId || !selectedPosteId) return;

    // Vérifier si cette combinaison existe déjà
    const exists = value.some(
      (v) => v.employeId === selectedEmployeId && v.posteId === selectedPosteId
    );
    if (exists) return;

    onChange([
      ...value,
      { employeId: selectedEmployeId, posteId: selectedPosteId },
    ]);

    // Fermer le formulaire après ajout
    setSelectedPosteId('');
    setSelectedEmployeId('');
    setIsAdding(false);
  };

  const handleRemoveEmploye = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const cancelAdd = () => {
    setSelectedPosteId('');
    setSelectedEmployeId('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {label}
        </Label>
        {!isAdding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="h-7 text-xs"
          >
            <UserPlus className="h-3 w-3 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Liste des employés sélectionnés - Groupés par poste */}
      {groupedByPoste.length > 0 && (
        <div className="space-y-3">
          {groupedByPoste.map(({ posteId, poste, employes: groupEmployes }) => (
            <div key={posteId} className="rounded-md border bg-gray-50/50">
              <div className="px-3 py-2 border-b bg-gray-100/50">
                <Badge variant="secondary" className="text-xs font-medium">
                  {poste?.nom || 'Poste inconnu'}
                  <span className="ml-1.5 text-muted-foreground">
                    ({groupEmployes.length})
                  </span>
                </Badge>
              </div>
              <div className="p-2 space-y-1">
                {groupEmployes.map(({ employe, index }) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-2 py-1.5 bg-white rounded border"
                  >
                    <span className="text-sm">
                      {employe
                        ? `${employe.prenom} ${employe.nom}`
                        : 'Employé inconnu'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEmploye(index)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire d'ajout */}
      {isAdding && (
        <div className="p-3 border rounded-md bg-blue-50/50 border-blue-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fonction</Label>
              <Select
                value={selectedPosteId}
                onValueChange={(v) => {
                  setSelectedPosteId(v);
                  setSelectedEmployeId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedPostes.map((poste) => (
                    <SelectItem key={poste.id} value={poste.id}>
                      {poste.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Employé</Label>
              <Select
                value={selectedEmployeId}
                onValueChange={setSelectedEmployeId}
                disabled={!selectedPosteId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedPosteId
                        ? availableEmployes.length === 0
                          ? 'Tous assignés'
                          : 'Sélectionner...'
                        : 'Choisir fonction'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableEmployes.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.prenom} {emp.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelAdd}
            >
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddEmploye}
              disabled={!selectedEmployeId || !selectedPosteId}
            >
              <Plus className="h-3 w-3 mr-1" />
              Ajouter
            </Button>
          </div>
        </div>
      )}

      {/* Message si aucun employé */}
      {value.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground italic">
          Aucun employé assigné
        </p>
      )}
    </div>
  );
}
