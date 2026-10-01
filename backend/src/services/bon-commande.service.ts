import { Prisma } from '@prisma/client';
import { startOfDay, differenceInCalendarDays } from 'date-fns';
import { prisma } from '../config/database.js';

/**
 * Bons de commande (BC) d'un contrat : rattachement des opérations réalisées et prévisions.
 *
 * Outil d'aide à la décision uniquement : rien ici ne crée, ne supprime ni ne bloque une
 * intervention. Quand les BC ne couvrent plus les opérations, on alerte et l'humain décide.
 *
 * Règle de couverture d'une opération (site S, date D) — mêmes priorités que la facture :
 *   1. BC actifs liés explicitement au site S,
 *   2. puis BC « convention » (sans site) du contrat,
 *   chacun dans l'ordre FIFO (date de signature, puis création), hors BC expirés à la date D.
 */

/** Jours avant la fin de validité à partir desquels on alerte. */
export const JOURS_ALERTE_FIN_VALIDITE = 30;

export type BcCouverture = {
  id: string;
  date: Date | null;
  dateFinValidite: Date | null;
  createdAt: Date;
  quotaPassages: number | null;
  passagesConsommes: number;
  sites: { siteId: string }[];
};

/** Le BC est-il encore valable à cette date ? (fin de validité incluse) */
export function bcValideA(bc: Pick<BcCouverture, 'dateFinValidite'>, date: Date): boolean {
  if (!bc.dateFinValidite) return true;
  return startOfDay(date).getTime() <= startOfDay(bc.dateFinValidite).getTime();
}

const ordreFifo = (a: BcCouverture, b: BcCouverture) =>
  (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity) ||
  a.createdAt.getTime() - b.createdAt.getTime();

/** BC pouvant couvrir une opération du site à cette date, par ordre de consommation. */
export function bcsCandidats<T extends BcCouverture>(bcs: T[], siteId: string | null, date: Date): T[] {
  const valides = bcs.filter((bc) => bcValideA(bc, date));
  const duSite = siteId ? valides.filter((bc) => bc.sites.some((s) => s.siteId === siteId)).sort(ordreFifo) : [];
  const convention = valides.filter((bc) => bc.sites.length === 0).sort(ordreFifo);
  return [...duSite, ...convention];
}

/** Le BC couvre-t-il ce site (indépendamment des dates) ? */
export function bcCouvreSite(bc: Pick<BcCouverture, 'sites'>, siteId: string | null): boolean {
  return bc.sites.length === 0 || (!!siteId && bc.sites.some((s) => s.siteId === siteId));
}

/**
 * BC à consommer pour une opération réalisée : le premier candidat qui a encore du quota
 * (ou sans quota). Si tous sont épuisés, le dernier candidat est quand même consommé pour
 * que le dépassement soit visible (compteur > quota → alerte « dépassé »). Aucun candidat
 * valable → null (l'opération reste sans BC, les alertes signalent le BC expiré).
 */
export function choisirBC<T extends BcCouverture>(bcs: T[], siteId: string | null, date: Date): T | null {
  const candidats = bcsCandidats(bcs, siteId, date);
  if (candidats.length === 0) return null;
  return (
    candidats.find((bc) => bc.quotaPassages == null || bc.passagesConsommes < bc.quotaPassages) ??
    candidats[candidats.length - 1]
  );
}

const selectCouverture = {
  id: true,
  numero: true,
  date: true,
  dateFinValidite: true,
  createdAt: true,
  quotaPassages: true,
  passagesConsommes: true,
  sites: { select: { siteId: true } },
} as const;

/**
 * À la réalisation d'une opération de contrat sans BC : rattache le BC applicable et le consomme.
 * À appeler dans la transaction qui passe l'intervention à REALISEE (une seule fois).
 * Hors périmètre : contrôles, types hors contrat, opérations d'avenant (BC propre à l'avenant).
 */
export async function rattacherEtConsommerBC(
  tx: Prisma.TransactionClient,
  intervention: { id: string; type: string; contratId: string | null; siteId: string | null; avenantId: string | null },
  dateRealisee: Date,
): Promise<{ id: string; numero: string } | null> {
  if (intervention.type !== 'OPERATION' || !intervention.contratId || intervention.avenantId) return null;

  const bcs = await tx.bonCommande.findMany({
    where: { contratId: intervention.contratId, actif: true },
    select: selectCouverture,
  });
  const bc = choisirBC(bcs, intervention.siteId, dateRealisee);
  if (!bc) return null;

  await tx.intervention.update({ where: { id: intervention.id }, data: { bonCommandeId: bc.id } });
  await tx.bonCommande.update({ where: { id: bc.id }, data: { passagesConsommes: { increment: 1 } } });
  return { id: bc.id, numero: bc.numero };
}

// ─── Prévisions ──────────────────────────────────────────────────────────────

export type NiveauAlerteBC =
  | 'DEPASSE'
  | 'EPUISE'
  | 'EXPIRE'
  | 'DERNIER'
  | 'ALERTE'
  | 'INSUFFISANT'
  | 'EXPIRATION_PROCHE';

/** Du plus grave au moins grave. */
const ORDRE_NIVEAUX: NiveauAlerteBC[] = ['DEPASSE', 'EPUISE', 'EXPIRE', 'DERNIER', 'ALERTE', 'INSUFFISANT', 'EXPIRATION_PROCHE'];

export type PrevisionBC = {
  passagesRestants: number | null;
  /** Opérations planifiées (non réalisées) imputées à ce BC par la simulation */
  operationsPlanifiees: number;
  /** Opérations planifiées qu'aucun BC ne pourra couvrir (imputées à ce BC, dernier de la file) */
  operationsNonCouvertes: number;
  /** Date de l'opération planifiée qui consommera le dernier passage du BC */
  dateEpuisementPrevue: Date | null;
  /** Date de la première opération planifiée non couverte */
  datePremiereNonCouverte: Date | null;
  joursAvantFinValidite: number | null;
  niveauAlerte: NiveauAlerteBC | null;
  motifs: string[];
};

type OpPlanifiee = { siteId: string | null; datePrevue: Date; bonCommandeId: string | null };

const fmt = (d: Date) => new Intl.DateTimeFormat('fr-FR').format(d);
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Simule la consommation des BC d'un contrat par ses opérations planifiées (ordre chronologique)
 * et en déduit, pour chaque BC, quand il sera épuisé et combien d'opérations resteront sans BC.
 * Fonction pure : ne modifie rien.
 */
export function simulerContrat<T extends BcCouverture & { seuilAlerte: number }>(
  bcs: T[],
  ops: OpPlanifiee[],
  aujourdhui: Date = new Date(),
): Map<string, PrevisionBC> {
  const restant = new Map<string, number>();
  const res = new Map<string, PrevisionBC>();
  for (const bc of bcs) {
    restant.set(bc.id, bc.quotaPassages == null ? Infinity : bc.quotaPassages - bc.passagesConsommes);
    res.set(bc.id, {
      passagesRestants: bc.quotaPassages == null ? null : bc.quotaPassages - bc.passagesConsommes,
      operationsPlanifiees: 0,
      operationsNonCouvertes: 0,
      dateEpuisementPrevue: null,
      datePremiereNonCouverte: null,
      joursAvantFinValidite: bc.dateFinValidite
        ? differenceInCalendarDays(startOfDay(bc.dateFinValidite), startOfDay(aujourdhui))
        : null,
      niveauAlerte: null,
      motifs: [],
    });
  }
  const parId = new Map(bcs.map((bc) => [bc.id, bc]));

  const consommer = (bcId: string, date: Date, nonCouverte = false) => {
    const r = res.get(bcId)!;
    const n = restant.get(bcId)!;
    if (n > 0 && !nonCouverte) {
      r.operationsPlanifiees++;
      restant.set(bcId, n - 1);
      if (n === 1) r.dateEpuisementPrevue = date;
    } else {
      r.operationsNonCouvertes++;
      if (!r.datePremiereNonCouverte) r.datePremiereNonCouverte = date;
    }
  };

  for (const op of [...ops].sort((a, b) => a.datePrevue.getTime() - b.datePrevue.getTime())) {
    // BC déjà choisi par un humain sur l'intervention : il prime
    if (op.bonCommandeId && parId.has(op.bonCommandeId)) {
      consommer(op.bonCommandeId, op.datePrevue);
      continue;
    }
    const candidats = bcsCandidats(bcs, op.siteId, op.datePrevue);
    const libre = candidats.find((bc) => restant.get(bc.id)! > 0);
    if (libre) {
      consommer(libre.id, op.datePrevue);
      continue;
    }
    // Plus aucun BC disponible : imputer le manque au dernier BC qui couvrait ce site
    // (même expiré), pour que l'alerte remonte sur un BC concret.
    const couvrants = bcs.filter((bc) => bcCouvreSite(bc, op.siteId));
    const cible = candidats[candidats.length - 1] ?? [...couvrants].sort(ordreFifo).pop();
    if (cible) consommer(cible.id, op.datePrevue, true);
    // Aucun BC ne couvre ce site : le site n'est pas sous BC, rien à signaler.
  }

  for (const bc of bcs) {
    const r = res.get(bc.id)!;
    const niveaux: NiveauAlerteBC[] = [];
    const restants = r.passagesRestants;

    if (restants != null) {
      if (restants < 0) {
        niveaux.push('DEPASSE');
        r.motifs.push(`Quota dépassé de ${pluriel(-restants, 'opération')}`);
      } else if (restants === 0) {
        niveaux.push('EPUISE');
        r.motifs.push('BC épuisé');
      } else if (restants === 1) {
        niveaux.push('DERNIER');
        r.motifs.push('Dernier passage restant');
      } else if (restants <= bc.seuilAlerte) {
        niveaux.push('ALERTE');
        r.motifs.push(`${pluriel(restants, 'passage')} restant${restants > 1 ? 's' : ''}`);
      }
    }
    if (r.operationsNonCouvertes > 0) {
      niveaux.push('INSUFFISANT');
      r.motifs.push(
        `${pluriel(r.operationsNonCouvertes, 'opération')} planifiée${r.operationsNonCouvertes > 1 ? 's' : ''} sans BC disponible` +
          (r.datePremiereNonCouverte ? ` à partir du ${fmt(r.datePremiereNonCouverte)}` : '') +
          (r.dateEpuisementPrevue ? ` (épuisement prévu le ${fmt(r.dateEpuisementPrevue)})` : '') +
          ' — nouveau BC à demander',
      );
    }
    if (r.joursAvantFinValidite != null) {
      if (r.joursAvantFinValidite < 0) {
        niveaux.push('EXPIRE');
        r.motifs.push(`BC expiré depuis le ${fmt(bc.dateFinValidite!)}`);
      } else if (r.joursAvantFinValidite <= JOURS_ALERTE_FIN_VALIDITE) {
        niveaux.push('EXPIRATION_PROCHE');
        r.motifs.push(
          r.joursAvantFinValidite === 0
            ? "BC valable jusqu'à aujourd'hui"
            : `BC valable encore ${pluriel(r.joursAvantFinValidite, 'jour')} (jusqu'au ${fmt(bc.dateFinValidite!)})`,
        );
      }
    }
    r.niveauAlerte = ORDRE_NIVEAUX.find((n) => niveaux.includes(n)) ?? null;
  }
  return res;
}

const PREVISION_VIDE = (bc: BcCouverture & { seuilAlerte: number }, aujourdhui: Date): PrevisionBC =>
  simulerContrat([bc], [], aujourdhui).get(bc.id)!;

/**
 * Ajoute la prévision à chaque BC fourni. Les opérations planifiées sont celles du contrat
 * du BC (hors avenants), non réalisées et non supprimées.
 */
export async function avecPrevisions<T extends BcCouverture & { seuilAlerte: number; contratId: string | null; actif: boolean }>(
  bcs: T[],
): Promise<(T & PrevisionBC)[]> {
  const aujourdhui = new Date();
  const contratIds = [...new Set(bcs.map((b) => b.contratId).filter((id): id is string => !!id))];
  if (contratIds.length === 0) return bcs.map((bc) => ({ ...bc, ...PREVISION_VIDE(bc, aujourdhui) }));

  // Tous les BC actifs des contrats concernés participent à la simulation (pas seulement ceux affichés)
  const [tousBcs, ops] = await Promise.all([
    prisma.bonCommande.findMany({
      where: { contratId: { in: contratIds }, actif: true },
      select: { ...selectCouverture, seuilAlerte: true, contratId: true },
    }),
    prisma.intervention.findMany({
      where: {
        contratId: { in: contratIds },
        type: 'OPERATION',
        avenantId: null,
        statut: { in: ['A_PLANIFIER', 'PLANIFIEE', 'REPORTEE'] },
      },
      select: { contratId: true, siteId: true, datePrevue: true, bonCommandeId: true },
    }),
  ]);

  const previsions = new Map<string, PrevisionBC>();
  for (const contratId of contratIds) {
    const sim = simulerContrat(
      tousBcs.filter((b) => b.contratId === contratId),
      ops.filter((o) => o.contratId === contratId),
      aujourdhui,
    );
    for (const [id, p] of sim) previsions.set(id, p);
  }
  // Un BC inactif ne participe pas à la simulation : seulement son état propre
  return bcs.map((bc) => ({ ...bc, ...(bc.actif && previsions.get(bc.id) ? previsions.get(bc.id)! : PREVISION_VIDE(bc, aujourdhui)) }));
}
