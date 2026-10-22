import { prisma } from '../config/database.js';

/**
 * Recensement des opérations rattachées à un employé ou un utilisateur,
 * affiché avant suppression pour savoir qui remplacer et où.
 */

export interface UsageItem {
  kind: 'intervention' | 'fiche_terrain' | 'contrat';
  id: string;
  libelle: string;
  date: Date | null;
  statut: string;
}

export interface UsagesResult {
  // Opérations encore actives : la personne doit y être remplacée
  aRemplacer: UsageItem[];
  // Historique (opérations terminées / journaux) : conservé, mais la personne n'y apparaîtra plus
  historique: Record<string, number>;
  compteLie?: { prenom: string; nom: string; email?: string } | null;
}

const INTERVENTION_ACTIVE = ['A_PLANIFIER', 'PLANIFIEE', 'REPORTEE'] as const;
const FI_ACTIVE = ['DRAFT', 'IN_PROGRESS', 'SUBMITTED'] as const;

function clientLabel(client: { nomEntreprise: string } | null, site?: { nom: string } | null) {
  const c = client?.nomEntreprise ?? 'Client inconnu';
  return site?.nom ? `${c} — ${site.nom}` : c;
}

export async function getEmployeUsages(
  employeId: string,
  user?: { id: string; prenom: string; nom: string; email?: string } | null,
): Promise<UsagesResult> {
  // Le compte utilisateur lié est supprimé avec l'employé : ses opérations comptent aussi
  const userUsages = user ? await getUserUsages(user.id) : null;

  const [interventions, fiches, interventionsPassees, fichesPassees, conges] = await Promise.all([
    prisma.interventionEmploye.findMany({
      where: { employeId, intervention: { statut: { in: [...INTERVENTION_ACTIVE] } } },
      select: {
        intervention: {
          select: {
            id: true, type: true, datePrevue: true, statut: true,
            client: { select: { nomEntreprise: true } },
            site: { select: { nom: true } },
          },
        },
      },
      orderBy: { intervention: { datePrevue: 'asc' } },
    }),
    prisma.fIApplicateur.findMany({
      where: { employeId, fieldIntervention: { statut: { in: [...FI_ACTIVE] } } },
      select: {
        fieldIntervention: {
          select: {
            id: true, type: true, dateIntervention: true, statut: true,
            client: { select: { nomEntreprise: true } },
            site: { select: { nom: true } },
          },
        },
      },
      orderBy: { fieldIntervention: { dateIntervention: 'asc' } },
    }),
    prisma.interventionEmploye.count({
      where: { employeId, intervention: { statut: { notIn: [...INTERVENTION_ACTIVE] } } },
    }),
    prisma.fIApplicateur.count({
      where: { employeId, fieldIntervention: { statut: { notIn: [...FI_ACTIVE] } } },
    }),
    prisma.conge.count({ where: { employeId } }),
  ]);

  // Un même employé peut être affecté sur plusieurs postes d'une intervention
  const seen = new Set<string>();
  const aRemplacer: UsageItem[] = [];
  for (const { intervention: i } of interventions) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    aRemplacer.push({ kind: 'intervention', id: i.id, libelle: `${i.type} · ${clientLabel(i.client, i.site)}`, date: i.datePrevue, statut: i.statut });
  }
  for (const { fieldIntervention: f } of fiches) {
    aRemplacer.push({ kind: 'fiche_terrain', id: f.id, libelle: `Fiche terrain ${f.type} · ${clientLabel(f.client, f.site)}`, date: f.dateIntervention, statut: f.statut });
  }

  if (userUsages) {
    const ficheIds = new Set(aRemplacer.filter((u) => u.kind === 'fiche_terrain').map((u) => u.id));
    aRemplacer.push(...userUsages.aRemplacer.filter((u) => !(u.kind === 'fiche_terrain' && ficheIds.has(u.id))));
  }

  return {
    aRemplacer,
    historique: {
      'interventions terminées': interventionsPassees,
      'fiches terrain clôturées': fichesPassees,
      'congés': conges,
    },
    compteLie: user ? { prenom: user.prenom, nom: user.nom, email: user.email } : null,
  };
}

export async function getUserUsages(userId: string): Promise<UsagesResult> {
  const [contrats, fiches, interventionsCreees, fichesHisto, auditLogs] = await Promise.all([
    prisma.contrat.findMany({
      where: { responsablePlanningId: userId, statut: { not: 'TERMINE' } },
      select: { id: true, nom: true, dateDebut: true, statut: true, client: { select: { nomEntreprise: true } } },
      orderBy: { dateDebut: 'asc' },
    }),
    prisma.fieldIntervention.findMany({
      where: { createdById: userId, statut: { in: [...FI_ACTIVE] } },
      select: {
        id: true, type: true, dateIntervention: true, statut: true,
        client: { select: { nomEntreprise: true } },
        site: { select: { nom: true } },
      },
      orderBy: { dateIntervention: 'asc' },
    }),
    prisma.intervention.count({ where: { createdById: userId } }),
    prisma.fieldIntervention.count({ where: { createdById: userId, statut: { notIn: [...FI_ACTIVE] } } }),
    prisma.auditLog.count({ where: { userId } }),
  ]);

  const aRemplacer: UsageItem[] = [
    ...contrats.map((c) => ({
      kind: 'contrat' as const,
      id: c.id,
      libelle: `Responsable planning · ${c.nom ? `${c.nom} — ` : ''}${clientLabel(c.client)}`,
      date: c.dateDebut,
      statut: c.statut,
    })),
    ...fiches.map((f) => ({
      kind: 'fiche_terrain' as const,
      id: f.id,
      libelle: `Fiche terrain ${f.type} en cours · ${clientLabel(f.client, f.site)}`,
      date: f.dateIntervention,
      statut: f.statut,
    })),
  ];

  return {
    aRemplacer,
    historique: {
      'interventions créées': interventionsCreees,
      'fiches terrain clôturées': fichesHisto,
      "entrées du journal d'audit": auditLogs,
    },
  };
}
