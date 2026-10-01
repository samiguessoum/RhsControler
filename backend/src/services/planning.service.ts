import { prisma } from '../config/database.js';
import { InterventionStatut, ContratStatut, InterventionType } from '@prisma/client';
import { getProchaineDateIntervention, parsePeriodesFrequence, type PeriodeFrequence, skipAlgerianWeekend, maxDate, isOverdue, isWithinDays, getCurrentWeekBounds } from '../utils/date.utils.js';
import { startOfDay, endOfDay, startOfMonth, addDays, addMonths, differenceInDays } from 'date-fns';
import logger from '../lib/logger.js';

/**
 * Règle métier : aucune visite de contrôle après la dernière opération du contrat (par site).
 * Appliquée uniquement à la génération du planning ; ensuite, le planning se gère manuellement.
 * Sans opération, pas de borne.
 */
function apresDerniereOperation(visiteDate: Date, opDates: Date[]): boolean {
  if (opDates.length === 0) return false;
  const derniere = Math.max(...opDates.map((d) => startOfDay(d).getTime()));
  return startOfDay(visiteDate).getTime() > derniere;
}

/**
 * Génère les dates de contrôles ancrées aux opérations : entre chaque paire consécutive
 * d'opérations, répartit `nbEntreOps` visites à espacement égal.
 */
function datesControlesEntreOps(datesOps: Date[], nbEntreOps: number): Date[] {
  if (nbEntreOps <= 0 || datesOps.length < 2) return [];
  const dates: Date[] = [];
  for (let i = 0; i < datesOps.length - 1; i++) {
    const debut = datesOps[i].getTime();
    const fin = datesOps[i + 1].getTime();
    const espacement = (fin - debut) / (nbEntreOps + 1);
    for (let j = 1; j <= nbEntreOps; j++) {
      dates.push(skipAlgerianWeekend(new Date(Math.round(debut + j * espacement))));
    }
  }
  return dates;
}

/** Interventions encore "en attente" d'une série : non réalisées et non annulées. */
const EN_ATTENTE = {
  statut: { notIn: ['REALISEE', 'ANNULEE'] as ['REALISEE', 'ANNULEE'] },
};

/**
 * Service de gestion du planning avec logique anti-oubli
 */
export const planningService = {
  /**
   * Récupère les statistiques du dashboard
   */
  async getStats() {
    const today = startOfDay(new Date());
    const in7Days = endOfDay(addDays(today, 7));
    const in30Days = endOfDay(addDays(today, 30));

    const [aPlanifier, enRetard, controles30j, contratsEnAlerte, ponctuelAlerte, bcsEnAlerte] = await Promise.all([
      // Interventions à planifier dans les 7 prochains jours
      prisma.intervention.count({
        where: {
          datePrevue: { gte: today, lte: in7Days },
          statut: 'A_PLANIFIER',
        },
      }),

      // Interventions en retard
      prisma.intervention.count({
        where: {
          datePrevue: { lt: today },
          statut: { notIn: ['REALISEE', 'ANNULEE'] },
        },
      }),

      // Contrôles à venir dans 30 jours
      prisma.intervention.count({
        where: {
          datePrevue: { gte: today, lte: in30Days },
          type: 'CONTROLE',
          statut: { notIn: ['REALISEE', 'ANNULEE'] },
        },
      }),

      // Contrats actifs sans intervention future
      this.getContratsEnAlerte(),

      // Contrats ponctuels avec 1 opération restante
      this.getContratsPonctuelAlerte(),

      // BCs en alerte (passagesConsommes >= quotaPassages - seuilAlerte)
      this.getBcsEnAlerte(),
    ]);

    return {
      aPlanifier,
      enRetard,
      controles30j,
      contratsEnAlerte: contratsEnAlerte.length,
      ponctuelAlerte: ponctuelAlerte.length,
      bcEnAlerte: bcsEnAlerte.length,
    };
  },

  /**
   * Récupère les contrats actifs sans intervention future planifiée
   */
  async getContratsEnAlerte() {
    const today = startOfDay(new Date());

    const contrats = await prisma.contrat.findMany({
      where: {
        statut: 'ACTIF',
      },
      include: {
        client: { select: { id: true, nomEntreprise: true } },
        interventions: {
          where: {
            datePrevue: { gte: today },
            statut: { in: ['A_PLANIFIER', 'PLANIFIEE', 'REPORTEE'] },
          },
          take: 1,
        },
      },
    });

    // Filtrer ceux sans intervention future
    return contrats.filter((c) => c.interventions.length === 0);
  },

  /**
   * Récupère les contrats ponctuels avec 2 ou moins opérations restantes
   */
  async getContratsPonctuelAlerte() {
    const contrats = await prisma.contrat.findMany({
      where: {
        statut: 'ACTIF',
        type: 'PONCTUEL',
      },
      include: {
        client: { select: { id: true, nomEntreprise: true } },
        interventions: {
          where: {
            statut: { notIn: ['REALISEE', 'ANNULEE'] },
          },
        },
        contratSites: true,
      },
    });

    // Filtrer ceux avec 2 ou moins opérations restantes
    return contrats.filter((c) => {
      const remaining = c.interventions.filter((i) => i.type === 'OPERATION').length;
      return remaining > 0 && remaining <= 2;
    }).map((c) => ({
      ...c,
      operationsRestantes: c.interventions.filter((i) => i.type === 'OPERATION').length,
    }));
  },

  /**
   * Récupère les BCs actifs avec peu de passages restants
   */
  async getBcsEnAlerte() {
    const bcs = await prisma.bonCommande.findMany({
      where: { actif: true },
      include: {
        client: { select: { id: true, nomEntreprise: true } },
        sites: { include: { site: { select: { id: true, nom: true } } } },
      },
    });
    return bcs
      .filter((bc) => {
        if (bc.quotaPassages === null) return false; // quota inconnu
        const restants = bc.quotaPassages - bc.passagesConsommes;
        return restants <= bc.seuilAlerte;
      })
      .map((bc) => ({
        ...bc,
        passagesRestants: (bc.quotaPassages ?? 0) - bc.passagesConsommes,
        niveauAlerte:
          bc.passagesConsommes >= (bc.quotaPassages ?? 0)
            ? 'EPUISE'
            : bc.passagesConsommes >= (bc.quotaPassages ?? 0) - 1
            ? 'DERNIER'
            : 'ALERTE',
      }));
  },

  /**
   * Récupère les contrats annuels proches de la fin (dans les 60 jours)
   * pour faciliter la reconduction
   */
  async getContratsAnnuelsFinProche(joursAvantFin: number = 60) {
    const today = startOfDay(new Date());
    const dateLimit = endOfDay(addDays(today, joursAvantFin));

    const contrats = await prisma.contrat.findMany({
      where: {
        statut: 'ACTIF',
        type: 'ANNUEL',
        dateFin: {
          gte: today,
          lte: dateLimit,
        },
      },
      include: {
        client: { select: { id: true, nomEntreprise: true } },
        interventions: {
          where: {
            statut: { notIn: ['REALISEE', 'ANNULEE'] },
          },
          take: 5,
        },
        contratSites: {
          include: {
            site: { select: { id: true, nom: true } },
          },
        },
      },
      orderBy: { dateFin: 'asc' },
    });

    return contrats.map((c) => {
      const joursRestants = c.dateFin
        ? Math.ceil((new Date(c.dateFin).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        ...c,
        joursRestants,
      };
    });
  },

  /**
   * Récupère les contrats annuels ayant des interventions planifiées au-delà de la date de fin
   */
  async getContratsHorsValidite() {
    const interventions = await prisma.intervention.findMany({
      where: {
        statut: { in: ['A_PLANIFIER', 'PLANIFIEE'] },
        contrat: {
          type: 'ANNUEL',
          dateFin: { not: null },
        },
      },
      include: {
        client: { select: { id: true, nomEntreprise: true } },
        contrat: { select: { id: true, dateFin: true, prestations: true } },
      },
      orderBy: { datePrevue: 'asc' },
    });

    const filtered = interventions.filter(
      (i) => i.contrat?.dateFin && i.datePrevue > i.contrat.dateFin
    );

    const grouped = new Map<string, { contrat: any; client: any; count: number; nextDate: Date }>();
    for (const i of filtered) {
      if (!i.contrat) continue;
      const key = i.contrat.id;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        if (i.datePrevue < existing.nextDate) existing.nextDate = i.datePrevue;
      } else {
        grouped.set(key, {
          contrat: i.contrat,
          client: i.client,
          count: 1,
          nextDate: i.datePrevue,
        });
      }
    }

    return Array.from(grouped.values());
  },

  /**
   * Récupère les interventions à planifier (dans les X prochains jours)
   */
  async getAPlanifier(days: number = 7, employeId?: string) {
    const today = startOfDay(new Date());
    const futureDate = endOfDay(addDays(today, days));

    const where: any = {
      datePrevue: { gte: today, lte: futureDate },
      statut: 'A_PLANIFIER',
    };
    if (employeId) where.interventionEmployes = { some: { employeId } };

    return prisma.intervention.findMany({
      where,
      include: {
        client: { select: { id: true, nomEntreprise: true, sites: { select: { id: true, nom: true, adresse: true } } } },
        contrat: { select: { id: true, type: true, prestations: true } },
        site: { select: { id: true, nom: true, adresse: true } },
        interventionEmployes: {
          include: {
            employe: { include: { postes: true } },
            poste: true,
          },
        },
      },
      orderBy: { datePrevue: 'asc' },
    });
  },

  /**
   * Récupère les interventions en retard
   */
  async getEnRetard(employeId?: string) {
    const today = startOfDay(new Date());

    const where: any = {
      datePrevue: { lt: today },
      statut: { notIn: ['REALISEE', 'ANNULEE'] },
    };
    if (employeId) where.interventionEmployes = { some: { employeId } };

    return prisma.intervention.findMany({
      where,
      include: {
        client: { select: { id: true, nomEntreprise: true, sites: { select: { id: true, nom: true, adresse: true } } } },
        contrat: { select: { id: true, type: true, prestations: true } },
        site: { select: { id: true, nom: true, adresse: true } },
        interventionEmployes: {
          include: {
            employe: { include: { postes: true } },
            poste: true,
          },
        },
      },
      orderBy: { datePrevue: 'asc' },
    });
  },

  /**
   * Récupère les interventions de la semaine courante
   */
  async getSemaineCourante(employeId?: string) {
    const { start, end } = getCurrentWeekBounds();

    const where: any = { datePrevue: { gte: start, lte: end } };
    if (employeId) where.interventionEmployes = { some: { employeId } };

    return prisma.intervention.findMany({
      where,
      include: {
        client: { select: { id: true, nomEntreprise: true, sites: { select: { id: true, nom: true, adresse: true } } } },
        contrat: { select: { id: true, type: true, prestations: true } },
        site: { select: { id: true, nom: true, adresse: true } },
        interventionEmployes: {
          include: {
            employe: { include: { postes: true } },
            poste: true,
          },
        },
      },
      orderBy: [{ datePrevue: 'asc' }, { heurePrevue: 'asc' }],
    });
  },

  /**
   * Marque une intervention comme réalisée et gère la création de la prochaine
   * @param dateRealisee - Date effective de réalisation (si différente de datePrevue)
   *                       La prochaine intervention sera calculée à partir de cette date
   */
  async marquerRealisee(interventionId: string, userId: string, options: { creerProchaine?: boolean; notesTerrain?: string; dateRealisee?: Date } = {}) {
    const intervention = await prisma.intervention.findUnique({
      where: { id: interventionId },
      include: {
        contrat: { include: { contratSites: true } },
        client: true,
      },
    });

    if (!intervention) {
      throw new Error('Intervention non trouvée');
    }

    // Date de réalisation effective (par défaut: date prévue)
    const dateRealiseeEffective = options.dateRealisee || intervention.datePrevue;
    const datePrevueInitiale = intervention.datePrevue;

    // Mise à jour atomique + consommation BC dans une transaction pour éviter les doubles consommations simultanées
    const updated = await prisma.$transaction(async (tx) => {
      // Tente le passage à REALISEE uniquement si pas déjà REALISEE (garde concurrente)
      const result = await tx.intervention.updateMany({
        where: { id: interventionId, statut: { not: 'REALISEE' } },
        data: {
          statut: 'REALISEE',
          dateRealisee: dateRealiseeEffective,
          datePrevue: dateRealiseeEffective,
          updatedById: userId,
          notesTerrain: options.notesTerrain || intervention.notesTerrain,
        },
      });

      const wasAlreadyRealisee = result.count === 0;

      // BC consumption — uniquement si cette requête a effectué le changement (pas une autre concurrente)
      // Ne jamais consommer un BC pour une visite de contrôle, même si bonCommandeId est renseigné manuellement
      if (!wasAlreadyRealisee && intervention.bonCommandeId && intervention.type !== 'CONTROLE') {
        const bc = await tx.bonCommande.findUnique({ where: { id: intervention.bonCommandeId } });
        if (bc && bc.actif) {
          await tx.bonCommande.update({
            where: { id: intervention.bonCommandeId },
            data: { passagesConsommes: { increment: 1 } },
          });
        }
      }

      return tx.intervention.findUnique({
        where: { id: interventionId },
        include: { client: true, contrat: true },
      });
    });

    let nextIntervention = null;
    let suggestedDate = null;
    let modePlanning: 'ANCRAGE' | 'INTERVALLE' = 'INTERVALLE';

    // Les types hors-contrat ne créent pas de prochaine intervention (réclamations, visites commerciales, etc.)
    const typesHorsContrat = ['RECLAMATION', 'PREMIERE_VISITE', 'DEPLACEMENT_COMMERCIAL'];
    // Si l'intervention est liée à un contrat avec fréquence (et n'est pas un type hors-contrat)
    if (intervention.contrat && !typesHorsContrat.includes(intervention.type)) {
      // Déterminer la fréquence : depuis le ContratSite si siteId, sinon depuis le contrat
      let joursPerso: number | null = null;
      let moisPerso: number | null = null;
      let maxCount: number | null = null;
      let csForAnchor: any = null;
      // Périodes saisonnières du site (opérations uniquement) : la fréquence suit la date du passage
      let periodes: PeriodeFrequence[] = [];

      if (intervention.siteId && intervention.contrat.contratSites) {
        const cs = intervention.contrat.contratSites.find((s) => s.siteId === intervention.siteId);
        if (cs) {
          csForAnchor = cs;
          if (intervention.type === 'OPERATION') {
            periodes = parsePeriodesFrequence((cs as any).periodesFrequence);
            moisPerso = (cs as any).frequenceOperationsMois ?? null;
            joursPerso = moisPerso ? null : (cs.frequenceOperationsJours ?? null);
          } else {
            moisPerso = (cs as any).frequenceControleMois ?? null;
            joursPerso = moisPerso ? null : (cs.frequenceControleJours ?? null);
          }
          maxCount = intervention.type === 'OPERATION' ? cs.nombreOperations ?? null : cs.nombreVisitesControle ?? null;
        }
      }

      if (!joursPerso && !moisPerso) {
        if (intervention.type === 'OPERATION') {
          moisPerso = (intervention.contrat as any).frequenceOperationsMois ?? null;
          joursPerso = moisPerso ? null : (intervention.contrat.frequenceOperationsJours ?? null);
        } else {
          moisPerso = (intervention.contrat as any).frequenceControleMois ?? null;
          joursPerso = moisPerso ? null : (intervention.contrat.frequenceControleJours ?? null);
        }
        if (maxCount === null) {
          maxCount = intervention.type === 'OPERATION'
            ? intervention.contrat.nombreOperations ?? null
            : intervention.contrat.nombreVisitesControle ?? null;
        }
      }

      // ── Étape 1 : Décaler les interventions futures si la date de réalisation
      //   diffère de la date prévue (ex : réalisé le 17 juin au lieu du 15 juin).
      //   S'applique à TOUS les types de contrat (annuel ET ponctuel), puis remet
      //   les visites de contrôle en cohérence avec les opérations.
      if (dateRealiseeEffective.getTime() !== datePrevueInitiale.getTime()) {
        await this.decalerSerie(
          { ...intervention, datePrevue: datePrevueInitiale },
          dateRealiseeEffective.getTime() - datePrevueInitiale.getTime(),
        );
      }

      // ── Étape 2 : Calcul de la prochaine date (contrats avec fréquence).
      if (joursPerso || moisPerso) {
        // Déterminer l'ancre de planification (premiereDateOperation / premiereDateControle)
        const anchor = csForAnchor
          ? (intervention.type === 'OPERATION' ? csForAnchor.premiereDateOperation : csForAnchor.premiereDateControle)
          : (intervention.type === 'OPERATION' ? intervention.contrat?.premiereDateOperation : intervention.contrat?.premiereDateControle);

        let nextDate: Date;
        if (anchor && moisPerso && periodes.length === 0) {
          // Mode ANCRAGE : prochaine échéance théorique de la série (ancre + k × fréquence)
          // strictement après l'échéance de l'intervention réalisée, pour éviter la dérive.
          modePlanning = 'ANCRAGE';
          let k = 0;
          nextDate = new Date(anchor);
          while (nextDate.getTime() <= datePrevueInitiale.getTime() && k < 1200) {
            k++;
            nextDate = addMonths(new Date(anchor), k * moisPerso);
          }
        } else {
          // getProchaineDateIntervention applique déjà skipAlgerianWeekend
          nextDate = getProchaineDateIntervention(dateRealiseeEffective, joursPerso, moisPerso, periodes);
        }
        suggestedDate = modePlanning === 'ANCRAGE' ? skipAlgerianWeekend(nextDate) : nextDate;

        if (intervention.contrat.autoCreerProchaine || options.creerProchaine) {
          const serie = {
            contratId: intervention.contratId!,
            siteId: intervention.siteId ?? null,
            type: intervention.type,
          };
          const nextExisting = await prisma.intervention.findFirst({
            where: {
              ...serie,
              statut: { notIn: ['REALISEE', 'ANNULEE'] },
              datePrevue: { gt: dateRealiseeEffective },
              id: { not: intervention.id },
            },
            orderBy: { datePrevue: 'asc' },
          });

          if (nextExisting) {
            // La prochaine existe déjà (pré-générée, éventuellement décalée à l'étape 1).
            // En mode ANCRAGE on la laisse telle quelle : l'étape 1 a déjà propagé le décalage.
            if (modePlanning === 'INTERVALLE' && nextExisting.datePrevue.getTime() !== suggestedDate.getTime()) {
              nextIntervention = await prisma.intervention.update({
                where: { id: nextExisting.id },
                data: { datePrevue: suggestedDate },
                include: { client: true },
              });
            } else {
              nextIntervention = nextExisting;
            }
          } else {
            // Quota : les visites remplacées par une opération consomment leur échéance
            const quotaAtteint = async () => {
              if (maxCount === null) return false;
              const count = await prisma.intervention.count({
                where: { ...serie, OR: [{ statut: { not: 'ANNULEE' } }, { remplaceeParOperation: true }] },
              });
              return count >= maxCount;
            };

            if (await quotaAtteint()) {
              return { intervention: updated, nextCreated: false, nextIntervention: null, suggestedDate, modePlanning };
            }

            // Vérifier qu'il n'existe pas déjà une intervention avec la même date (anti-doublon)
            const dupCheck = await prisma.intervention.findFirst({
              where: { ...serie, datePrevue: suggestedDate, statut: { not: 'ANNULEE' } },
            });

            if (!dupCheck) {
              nextIntervention = await prisma.intervention.create({
                data: {
                  contratId: intervention.contratId,
                  clientId: intervention.clientId,
                  siteId: intervention.siteId,
                  type: intervention.type,
                  prestation: intervention.prestation,
                  datePrevue: suggestedDate,
                  heurePrevue: intervention.heurePrevue,
                  duree: intervention.duree,
                  statut: 'A_PLANIFIER',
                  createdById: userId,
                },
                include: { client: true },
              });
            }
          }

        }
      } else if (intervention.contratId) {
        // ── Étape 2b : Pour les ponctuels (sans fréquence), identifier la prochaine
        //   intervention existante (déjà décalée par le reporter ou par l'étape 1).
        nextIntervention = await prisma.intervention.findFirst({
          where: {
            contratId: intervention.contratId,
            siteId: intervention.siteId ?? null,
            type: intervention.type,
            statut: { notIn: ['REALISEE', 'ANNULEE'] },
            datePrevue: { gt: dateRealiseeEffective },
            id: { not: intervention.id },
          },
          orderBy: { datePrevue: 'asc' },
          include: { client: true },
        }) as any;
      }
    }

    return {
      intervention: updated,
      nextCreated: !!nextIntervention,
      nextIntervention,
      suggestedDate,
      modePlanning,
    };
  },

  /**
   * Décale de `deltaMs` toutes les interventions en attente de la même série (contrat + site +
   * type) situées après `ref`, puis remet les visites de contrôle en cohérence avec les opérations.
   * Utilisé pour tout déplacement d'intervention (report, glisser-déposer, réalisation décalée).
   */
  async decalerSerie(
    ref: { id: string; contratId: string | null; siteId: string | null; type: InterventionType; datePrevue: Date },
    deltaMs: number,
  ) {
    if (!ref.contratId || deltaMs === 0) return;

    // Types à décaler : toujours le même type, plus les CONTROLEs si on décale une OPERATION
    const typesAChercher: InterventionType[] =
      ref.type === 'OPERATION' ? ['OPERATION', 'CONTROLE'] : [ref.type];

    const futures = await prisma.intervention.findMany({
      where: {
        contratId: ref.contratId,
        siteId: ref.siteId ?? null,
        type: { in: typesAChercher },
        datePrevue: { gt: ref.datePrevue },
        id: { not: ref.id },
        ...EN_ATTENTE,
      },
      select: { id: true, datePrevue: true },
    });
    if (futures.length > 0) {
      await prisma.$transaction(
        futures.map((f) =>
          prisma.intervention.update({
            where: { id: f.id },
            data: { datePrevue: new Date(f.datePrevue.getTime() + deltaMs) },
          }),
        ),
      );
    }
  },

  /**
   * Reporter une intervention
   */
  async reporter(interventionId: string, userId: string, nouvelleDatePrevue: Date, raison?: string) {
    const intervention = await prisma.intervention.findUnique({
      where: { id: interventionId },
    });

    if (!intervention) {
      throw new Error('Intervention non trouvée');
    }

    const noteUpdate = raison
      ? `${intervention.notesTerrain || ''}\n[Reportée le ${new Date().toLocaleDateString('fr-FR')}] ${raison}`.trim()
      : intervention.notesTerrain;

    const updated = await prisma.intervention.update({
      where: { id: interventionId },
      data: {
        datePrevue: nouvelleDatePrevue,
        statut: 'REPORTEE',
        notesTerrain: noteUpdate,
        updatedById: userId,
      },
      include: {
        client: true,
        contrat: true,
      },
    });

    // Cascader le décalage à toutes les interventions futures du même contrat/site/type afin que
    // la chaîne planning reste cohérente, puis recalculer les visites de contrôle.
    await this.decalerSerie(intervention, nouvelleDatePrevue.getTime() - intervention.datePrevue.getTime());

    return updated;
  },

  /**
   * Génère le planning d'un contrat (à la création, ou à la modification de ses paramètres).
   * Une série par site du contrat (ou une seule au niveau contrat s'il n'a pas de sites) :
   *  - dates explicites saisies dans le formulaire si fournies (siteOverrides),
   *  - sinon ponctuel : N échéances à partir de la 1ère date ; annuel : N échéances ou jusqu'à
   *    la date de fin, à la fréquence du site (mois prioritaire sur jours).
   * Les visites de contrôle couvertes par une opération sont enregistrées masquées.
   * Avec `ignorerEcheancesConsommees`, les premières échéances déjà réalisées (ou supprimées par
   * un utilisateur) de chaque série ne sont pas recréées : utilisé lors d'une régénération.
   */
  async genererPlanningContrat(
    contratId: string,
    userId: string,
    siteOverrides?: Array<{ siteId: string; datesPrevuesOperations?: Date[]; datesPrevuesControles?: Date[] }>,
    options: { ignorerEcheancesConsommees?: boolean } = {},
  ) {
    const contrat = await prisma.contrat.findUnique({
      where: { id: contratId },
      include: { client: true, contratSites: { include: { site: true } } },
    });

    if (!contrat) {
      throw new Error('Contrat non trouvé');
    }

    if (contrat.statut !== 'ACTIF') {
      throw new Error('Seuls les contrats actifs peuvent générer un planning');
    }

    // Contrats saisonniers : ne pas générer automatiquement, l'utilisateur doit ajuster manuellement
    if ((contrat as any).planningAajuster) {
      return {
        interventionsCreees: [],
        planningAajuster: true,
        message: 'Planning à ajuster manuellement — fréquence saisonnière ou complexe détectée. Règle conservée : ' +
          ([(contrat as any).frequenceRegles, (contrat as any).frequenceReglesControle].filter(Boolean).join(' | ') || 'voir notes contrat'),
      };
    }

    const interventionsCreees: any[] = [];
    const MAX_ECHEANCES = 500;

    // Opérations déjà réalisées ou issues d'avenants/BC : prises en compte pour la règle
    // "aucun contrôle après la dernière opération" mais ne bloquent pas la régénération.
    const opsConservees = await prisma.intervention.findMany({
      where: { contratId, type: 'OPERATION', statut: { not: 'ANNULEE' } },
      select: { siteId: true, datePrevue: true },
    });

    // Échéances déjà consommées par série : réalisées ou supprimées volontairement par un utilisateur
    const consommees = new Map<string, number>();
    const cle = (siteId: string | null, type: string, prestation: string | null) => `${siteId ?? ''}|${type}|${prestation ?? ''}`;
    if (options.ignorerEcheancesConsommees) {
      const faites = await prisma.intervention.findMany({
        where: {
          contratId,
          type: { in: ['OPERATION', 'CONTROLE'] },
          avenantId: null,
          bonCommandeId: null,
          OR: [{ statut: 'REALISEE' }, { statut: 'ANNULEE' }],
        },
        select: { siteId: true, type: true, prestation: true },
      });
      for (const f of faites) {
        const k = cle(f.siteId, f.type, f.type === 'OPERATION' ? f.prestation : null);
        consommees.set(k, (consommees.get(k) ?? 0) + 1);
      }
    }
    const consommer = (siteId: string | null, type: string, prestation: string | null) => {
      const k = cle(siteId, type, prestation);
      const n = consommees.get(k) ?? 0;
      if (n <= 0) return false;
      consommees.set(k, n - 1);
      return true;
    };

    // Date de reprise planification : les échéances avant cette date sont ignorées (annuels)
    const dateReprise: Date | null = (contrat as any).datePriseEnComptePlanification
      ? new Date((contrat as any).datePriseEnComptePlanification)
      : null;
    const dateFinAnnuel = contrat.dateFin || addDays(new Date(contrat.dateDebut), 365);
    // Garde-fou : rien avant la signature de la convention ni après sa fin (si renseignées)
    const debutConvention = contrat.dateDebutConvention ? startOfDay(contrat.dateDebutConvention) : null;
    const finConvention = contrat.dateFinConvention ? endOfDay(contrat.dateFinConvention) : null;
    const dansConvention = (d: Date) =>
      (!debutConvention || d >= debutConvention) && (!finConvention || d <= finConvention);

    type Freq = { jours: number | null; mois: number | null } | null;
    const frequenceOps = (src: any): Freq => {
      const mois: number | null = src?.frequenceOperationsMois ?? null;
      const jours: number | null = mois ? null : (src?.frequenceOperationsJours ?? null);
      return mois || jours ? { jours, mois } : null;
    };

    // Calcule les échéances théoriques d'une série d'opérations
    const echeances = (premiere: Date | null, freq: Freq, nombre: number, periodes: PeriodeFrequence[] = []): Date[] => {
      if (!premiere) return [];
      const dates: Date[] = [];
      let d = new Date(premiere);
      if (contrat.type === 'PONCTUEL') {
        for (let i = 0; i < nombre && i < MAX_ECHEANCES; i++) {
          if (!dateReprise || d >= dateReprise) dates.push(d);
          if (!freq) break; // Sans fréquence, toutes les ops tombent sur la même date : on en génère qu'une
          d = getProchaineDateIntervention(d, freq.jours, freq.mois, periodes);
        }
        return dates;
      }
      if (!freq) return [];
      if (dateReprise) {
        for (let i = 0; d < dateReprise && i < MAX_ECHEANCES; i++) d = getProchaineDateIntervention(d, freq.jours, freq.mois, periodes);
      }
      for (let i = 0; i < MAX_ECHEANCES && (nombre > 0 ? i < nombre : d <= dateFinAnnuel); i++) {
        dates.push(d);
        d = getProchaineDateIntervention(d, freq.jours, freq.mois, periodes);
      }
      return dates;
    };

    const series = contrat.contratSites.length > 0
      ? contrat.contratSites.map((cs) => {
          const override = siteOverrides?.find((o) => o.siteId === cs.siteId);
          return {
            siteId: cs.siteId as string | null,
            prestations: cs.prestations?.length ? cs.prestations : contrat.prestations,
            montantApplique: (cs as any).montantHT ?? (contrat as any).montantHT ?? null,
            freqOps: frequenceOps(cs) ?? frequenceOps(contrat),
            periodes: parsePeriodesFrequence((cs as any).periodesFrequence),
            nbCtrlEntreOps: (cs as any).nombreVisitesControleEntreOps ?? (contrat as any).nombreVisitesControleEntreOps ?? 0,
            premiereOp: cs.premiereDateOperation,
            nbOps: cs.nombreOperations || 0,
            datesOps: override?.datesPrevuesOperations,
            datesCtrl: override?.datesPrevuesControles,
          };
        })
      : [{
          siteId: null as string | null,
          prestations: contrat.prestations,
          montantApplique: (contrat as any).montantHT ?? null,
          freqOps: frequenceOps(contrat),
          periodes: [] as PeriodeFrequence[],
          nbCtrlEntreOps: (contrat as any).nombreVisitesControleEntreOps ?? 0,
          premiereOp: contrat.premiereDateOperation,
          nbOps: contrat.nombreOperations || 0,
          datesOps: undefined as Date[] | undefined,
          datesCtrl: undefined as Date[] | undefined,
        }];

    for (const s of series) {
      const base = { contratId: contrat.id, clientId: contrat.clientId, siteId: s.siteId, createdById: userId, montantApplique: s.montantApplique };

      // ── Opérations
      const datesOps = (s.datesOps?.length ? s.datesOps : echeances(s.premiereOp, s.freqOps, s.nbOps, s.periodes)).filter(dansConvention);
      const opsData = datesOps.flatMap((date) =>
        s.prestations
          .filter((prestation) => !consommer(s.siteId, 'OPERATION', prestation))
          .map((prestation) => ({ ...base, type: 'OPERATION' as const, prestation, datePrevue: date, statut: 'A_PLANIFIER' as const }))
      );
      const opsCreees = await prisma.intervention.createManyAndReturn({ data: opsData });
      interventionsCreees.push(...opsCreees);

      // ── Visites de contrôle ancrées aux opérations
      // Toutes les opérations du site (nouvelles + conservées) servent d'ancres.
      const toutesOpsDatesSite = [
        ...datesOps,
        ...opsConservees.filter((iv) => iv.siteId === s.siteId).map((iv) => iv.datePrevue),
      ].sort((a, b) => a.getTime() - b.getTime());

      const datesCtrl = s.datesCtrl?.length
        ? s.datesCtrl.filter(dansConvention)
        : datesControlesEntreOps(toutesOpsDatesSite, s.nbCtrlEntreOps).filter(dansConvention);

      const ctrlData = datesCtrl
        .filter((date) => !apresDerniereOperation(date, toutesOpsDatesSite) && !consommer(s.siteId, 'CONTROLE', null))
        .map((date) => ({ ...base, type: 'CONTROLE' as const, datePrevue: date, statut: 'A_PLANIFIER' as const }));
      const ctrlCreees = await prisma.intervention.createManyAndReturn({ data: ctrlData });
      interventionsCreees.push(...ctrlCreees);
    }

    return {
      contrat,
      interventionsCreees,
      count: interventionsCreees.length,
    };
  },

  /**
   * Régénère le planning d'un contrat après modification de ses paramètres : supprime les
   * interventions générées encore en attente puis régénère, sans recréer les échéances déjà
   * réalisées. Sont conservées : interventions réalisées, supprimées par un utilisateur, issues
   * d'avenants ou de bons de commande, et les autres types (réclamations…).
   */
  async regenererPlanningContrat(
    contratId: string,
    userId: string,
    siteOverrides?: Array<{ siteId: string; datesPrevuesOperations?: Date[]; datesPrevuesControles?: Date[] }>,
  ) {
    // Supprime les interventions générées encore en attente, puis régénère.
    // La suppression est dans sa propre transaction. Si la génération échoue ensuite,
    // le contrat est marqué planningAajuster pour traitement manuel.
    await prisma.$transaction(async (tx) => {
      await tx.intervention.deleteMany({
        where: {
          contratId,
          type: { in: ['OPERATION', 'CONTROLE'] },
          avenantId: null,
          bonCommandeId: null,
          statut: { in: ['A_PLANIFIER', 'PLANIFIEE', 'REPORTEE'] },
        },
      });
    });
    try {
      return await this.genererPlanningContrat(contratId, userId, siteOverrides, { ignorerEcheancesConsommees: true });
    } catch (genErr: any) {
      // Suppression réussie mais génération échouée : marquer le contrat pour ajustement manuel
      await prisma.contrat.update({ where: { id: contratId }, data: { planningAajuster: true } }).catch(() => {});
      logger.error({ contratId, err: genErr }, 'Régénération planning : échec après suppression — contrat marqué planningAajuster');
      throw genErr;
    }
  },

  /**
   * Génère les interventions supplémentaires d'un avenant.
   * Pour chaque site du contrat (ou au niveau contrat s'il n'a pas de sites) :
   *  - dates explicites issues de la projection de l'avenant si fournies,
   *  - sinon N opérations à la fréquence du site depuis la dernière intervention existante,
   *    et contrôles ancrés entre chaque paire d'opérations (même algo que genererPlanningContrat).
   */
  async genererInterventionsAvenant(
    contratId: string,
    avenantId: string,
    userId: string,
    nbOperations: number,
    nbCtrlEntreOps: number,
    params: {
      datesOperations?: Date[];
      datesControles?: Date[];
    } = {},
  ) {
    const contrat = await prisma.contrat.findUnique({
      where: { id: contratId },
      include: { contratSites: { include: { site: { select: { nom: true } } } } },
    });

    if (!contrat) {
      throw new Error('Contrat non trouvé');
    }

    const freqOpsSource = (src: any) => {
      const mois: number | null = src?.frequenceOperationsMois ?? null;
      const jours: number | null = mois ? null : (src?.frequenceOperationsJours ?? null);
      return mois || jours ? { mois, jours } : null;
    };

    const series = contrat.contratSites.length > 0
      ? contrat.contratSites.map((cs) => ({
          siteId: cs.siteId as string | null,
          nom: cs.site?.nom ?? 'site',
          prestations: cs.prestations?.length ? cs.prestations : contrat.prestations,
          montantApplique: (cs as any).montantHT ?? (contrat as any).montantHT ?? null,
          freqOps: freqOpsSource(cs) ?? freqOpsSource(contrat),
          periodes: parsePeriodesFrequence((cs as any).periodesFrequence),
          premiereOp: cs.premiereDateOperation ?? contrat.premiereDateOperation,
        }))
      : [{
          siteId: null as string | null,
          nom: 'contrat',
          prestations: contrat.prestations,
          montantApplique: (contrat as any).montantHT ?? null,
          freqOps: freqOpsSource(contrat),
          periodes: [] as PeriodeFrequence[],
          premiereOp: contrat.premiereDateOperation,
        }];

    for (const s of series) {
      if (nbOperations > 0 && !s.freqOps && !params.datesOperations) {
        throw new Error(`aucune fréquence d'opérations définie (${s.nom}) : indiquez une fréquence dans l'avenant`);
      }
    }

    const interventionsCreees: any[] = [];

    for (const s of series) {
      const serie = { contratId: contrat.id, siteId: s.siteId };

      // Dates des opérations de l'avenant
      let datesOps: Date[];
      if (params.datesOperations?.length) {
        datesOps = [...params.datesOperations].sort((a, b) => a.getTime() - b.getTime());
      } else if (nbOperations > 0) {
        const derniere = await prisma.intervention.findFirst({
          where: { ...serie, type: 'OPERATION', statut: { not: 'ANNULEE' } },
          orderBy: { datePrevue: 'desc' },
        });
        let d = derniere
          ? getProchaineDateIntervention(derniere.datePrevue, s.freqOps?.jours ?? null, s.freqOps?.mois ?? null, s.periodes)
          : (s.premiereOp ? new Date(s.premiereOp) : startOfDay(new Date()));
        datesOps = [];
        for (let i = 0; i < nbOperations; i++) {
          datesOps.push(d);
          d = getProchaineDateIntervention(d, s.freqOps?.jours ?? null, s.freqOps?.mois ?? null, s.periodes);
        }
      } else {
        datesOps = [];
      }

      const opsAvenantData = datesOps.flatMap((currentDate) =>
        s.prestations.map((prestation) => ({
          ...serie,
          clientId: contrat.clientId,
          avenantId,
          type: 'OPERATION' as const,
          prestation,
          datePrevue: currentDate,
          statut: 'A_PLANIFIER' as const,
          createdById: userId,
          montantApplique: s.montantApplique,
        }))
      );
      const opsAvenantCreees = await prisma.intervention.createManyAndReturn({ data: opsAvenantData });
      interventionsCreees.push(...opsAvenantCreees);

      // Dates des contrôles de l'avenant (explicites ou ancrées entre toutes les ops : existantes + nouvelles)
      let toutesOpsAvenant = datesOps;
      if (!params.datesControles?.length && nbCtrlEntreOps > 0) {
        const opsExistantes = await prisma.intervention.findMany({
          where: { contratId: contrat.id, siteId: s.siteId, type: 'OPERATION', statut: { not: 'ANNULEE' } },
          select: { datePrevue: true },
        });
        toutesOpsAvenant = [
          ...datesOps,
          ...opsExistantes.map((o) => o.datePrevue),
        ].sort((a, b) => a.getTime() - b.getTime());
      }
      const datesCtrl: Date[] = params.datesControles?.length
        ? [...params.datesControles].sort((a, b) => a.getTime() - b.getTime())
        : datesControlesEntreOps(toutesOpsAvenant, nbCtrlEntreOps);

      const ctrlAvenantData = datesCtrl
        .filter((d) => !apresDerniereOperation(d, toutesOpsAvenant))
        .map((currentDate) => ({
          ...serie,
          clientId: contrat.clientId,
          avenantId,
          type: 'CONTROLE' as const,
          datePrevue: currentDate,
          statut: 'A_PLANIFIER' as const,
          createdById: userId,
          montantApplique: s.montantApplique,
        }));
      const ctrlAvenantCreees = await prisma.intervention.createManyAndReturn({ data: ctrlAvenantData });
      interventionsCreees.push(...ctrlAvenantCreees);
    }

    return {
      interventionsCreees,
      count: interventionsCreees.length,
    };
  },

  /**
   * Renouvelle automatiquement les contrats dont reconductionAuto=true et dateFin <= today.
   * Idempotent : ne crée pas de successeur si un contrat fils existe déjà.
   * Gère le rattrapage : si le serveur était arrêté depuis plusieurs mois, la migration
   * est détectée et le contrat successeur est créé avec datePriseEnComptePlanification = newDateDebut
   * pour éviter de générer des interventions historiques.
   */
  async renouvelerContratsEligibles(userId: string): Promise<{
    traites: number;
    crees: number;
    erreurs: { contratId: string; error: string }[];
    planningAajusterIds: string[];
  }> {
    const today = startOfDay(new Date());
    const erreurs: { contratId: string; error: string }[] = [];
    const planningAajusterIds: string[] = [];
    let traites = 0;
    let crees = 0;

    const contratsExpires = await prisma.contrat.findMany({
      where: {
        reconductionAuto: true,
        statut: 'ACTIF',
        type: 'ANNUEL',
        dateFin: { not: null, lte: today },
      },
      include: {
        contratSites: true,
      },
    });

    for (const contrat of contratsExpires) {
      traites++;
      try {
        if (!contrat.dateFin) continue;

        const contratSiteIds = contrat.contratSites.map((cs) => cs.siteId);

        const duration = differenceInDays(contrat.dateFin, contrat.dateDebut);

        // Données corrompues : durée nulle ou négative
        if (duration <= 0) {
          erreurs.push({ contratId: contrat.id, error: 'Durée du contrat invalide (≤ 0 jours)' });
          continue;
        }

        const newDateDebut = addDays(contrat.dateFin, 1);
        let newDateFin = addDays(newDateDebut, duration);

        // Convention arrivée à son terme : pas de nouvelle période
        if (contrat.dateFinConvention && newDateDebut > endOfDay(contrat.dateFinConvention)) continue;

        // Si le nouveau contrat déborderait après la fin de convention, on l'écrête
        if (contrat.dateFinConvention && newDateFin > contrat.dateFinConvention) {
          newDateFin = contrat.dateFinConvention;
        }

        // Après écrêtage, le contrat serait d'une durée nulle (convention = jour de début)
        if (newDateFin <= newDateDebut) continue;

        // Vérifier si un successeur existe déjà (idempotence)
        // On filtre par type pour éviter qu'un contrat ponctuel indépendant bloque la reconduction
        const successorExists = await prisma.contrat.findFirst({
          where: {
            clientId: contrat.clientId,
            type: contrat.type,
            dateDebut: { gte: newDateDebut },
            statut: { in: ['ACTIF', 'SUSPENDU'] },
            ...(contratSiteIds.length > 0
              ? { contratSites: { some: { siteId: { in: contratSiteIds } } } }
              : {}),
          },
        });

        if (successorExists) continue;

        let newContratId: string = '';

        await prisma.$transaction(async (tx) => {
          // Terminer l'ancien contrat
          await tx.contrat.update({
            where: { id: contrat.id },
            data: { statut: 'TERMINE' },
          });

          // Créer le nouveau contrat
          const newContrat = await tx.contrat.create({
            data: {
              clientId: contrat.clientId,
              nom: contrat.nom,
              responsablePlanningId: contrat.responsablePlanningId,
              type: contrat.type,
              dateDebut: newDateDebut,
              dateFin: newDateFin,
              reconductionAuto: contrat.reconductionAuto,
              prestations: contrat.prestations,
              frequenceOperationsJours: contrat.frequenceOperationsJours,
              frequenceOperationsMois: (contrat as any).frequenceOperationsMois ?? null,
              nombreVisitesControleEntreOps: (contrat as any).nombreVisitesControleEntreOps ?? null,
              nombreVisitesControle: (contrat as any).nombreVisitesControle ?? null,
              frequenceControleJours: (contrat as any).frequenceControleJours ?? null,
              frequenceControleMois: (contrat as any).frequenceControleMois ?? null,
              frequenceRegles: (contrat as any).frequenceRegles ?? null,
              frequenceReglesControle: (contrat as any).frequenceReglesControle ?? null,
              planningAajuster: (contrat as any).planningAajuster ?? false,
              montantHT: (contrat as any).montantHT ?? null,
              dureeType: (contrat as any).dureeType ?? null,
              notes: contrat.notes,
              autoCreerProchaine: contrat.autoCreerProchaine,
              nombreOperations: contrat.nombreOperations,
              nombrePassagesAnnuels: (contrat as any).nombrePassagesAnnuels ?? null,
              statut: 'ACTIF',
              refExterne: null, // Nouvelle période — la référence sera attribuée manuellement
              // Copier les templates d'attestation personnalisés
              attestationMessageTemplate: (contrat as any).attestationMessageTemplate ?? null,
              attestationGarantieMessageTemplate: (contrat as any).attestationGarantieMessageTemplate ?? null,
              attestationControleMessageTemplate: (contrat as any).attestationControleMessageTemplate ?? null,
              // La convention reste la même d'une période à l'autre
              dateDebutConvention: contrat.dateDebutConvention,
              dateFinConvention: contrat.dateFinConvention,
              datePriseEnComptePlanification: newDateDebut,
              premiereDateOperation: (() => {
                if (!contrat.premiereDateOperation) return null;
                const advanced = addDays(contrat.premiereDateOperation, duration + 1);
                return contrat.dateFinConvention && advanced > contrat.dateFinConvention ? null : advanced;
              })(),
              premiereDateControle: (() => {
                if (!(contrat as any).premiereDateControle) return null;
                const advanced = addDays((contrat as any).premiereDateControle, duration + 1);
                return contrat.dateFinConvention && advanced > contrat.dateFinConvention ? null : advanced;
              })(),
            },
          });
          newContratId = newContrat.id;

          // Copier les ContratSites avec dates d'ancre avancées de la durée du contrat
          for (const cs of contrat.contratSites) {
            const advancePremiereDateOp = (() => {
              if (!cs.premiereDateOperation) return null;
              const advanced = addDays(cs.premiereDateOperation, duration + 1);
              return contrat.dateFinConvention && advanced > contrat.dateFinConvention ? null : advanced;
            })();
            await tx.contratSite.create({
              data: {
                contratId: newContrat.id,
                siteId: cs.siteId,
                prestations: cs.prestations,
                prixPrestations: cs.prixPrestations as any,
                frequenceOperationsJours: cs.frequenceOperationsJours,
                frequenceOperationsMois: (cs as any).frequenceOperationsMois ?? null,
                nombreVisitesControleEntreOps: (cs as any).nombreVisitesControleEntreOps ?? null,
                nombreVisitesControle: (cs as any).nombreVisitesControle ?? null,
                frequenceControleJours: (cs as any).frequenceControleJours ?? null,
                frequenceControleMois: (cs as any).frequenceControleMois ?? null,
                frequenceRegles: (cs as any).frequenceRegles ?? null,
                frequenceReglesControle: (cs as any).frequenceReglesControle ?? null,
                montantHT: (cs as any).montantHT ?? null,
                notes: (cs as any).notes ?? null,
                periodesFrequence: (cs as any).periodesFrequence ?? [],
                premiereDateOperation: advancePremiereDateOp,
                premiereDateControle: (() => {
                  if (!(cs as any).premiereDateControle) return null;
                  const advanced = addDays((cs as any).premiereDateControle, duration + 1);
                  return contrat.dateFinConvention && advanced > contrat.dateFinConvention ? null : advanced;
                })(),
                nombreOperations: cs.nombreOperations,
                nombrePassagesAnnuels: (cs as any).nombrePassagesAnnuels ?? null,
              },
            });
          }
        });

        crees++;

        // Générer le planning ou différer selon planningAajuster
        if ((contrat as any).planningAajuster) {
          planningAajusterIds.push(newContratId);
        } else {
          try {
            await this.genererPlanningContrat(newContratId, userId);
          } catch (genErr: any) {
            logger.warn({ contratId: newContratId, err: genErr?.message }, 'Reconduction : planning non généré, à ajuster manuellement');
            planningAajusterIds.push(newContratId);
          }
        }
      } catch (err: any) {
        erreurs.push({ contratId: contrat.id, error: err?.message ?? String(err) });
      }
    }

    return { traites, crees, erreurs, planningAajusterIds };
  },
};

export default planningService;
