import { prisma } from '../config/database.js';
import { InterventionStatut, ContratStatut, InterventionType } from '@prisma/client';
import { getProchaineDateIntervention, maxDate, isOverdue, isWithinDays, getCurrentWeekBounds } from '../utils/date.utils.js';
import { startOfDay, endOfDay, startOfMonth, addDays, addMonths, differenceInDays } from 'date-fns';

/**
 * Une visite de contrôle est couverte par une opération si celle-ci tombe dans la période de la
 * visite ; l'opération remplace alors la visite.
 *  - Fréquence en mois : la période couvre les mois calendaires de la visite jusqu'à la suivante
 *    (visites mensuelles le 15, opération le 1er septembre → la visite de septembre saute).
 *  - Fréquence en jours : l'opération remplace la visite la plus proche (demi-fréquence de part
 *    et d'autre ; à égale distance, la visite la plus tôt).
 */
function visiteCouverteParOperation(
  visiteDate: Date,
  freqJours: number | null,
  freqMois: number | null,
  opDates: Date[],
): boolean {
  if (freqMois) {
    const debut = startOfMonth(visiteDate).getTime();
    const fin = startOfMonth(addMonths(visiteDate, freqMois)).getTime();
    return opDates.some((d) => d.getTime() >= debut && d.getTime() < fin);
  }
  const v = visiteDate.getTime();
  const demi = (addDays(visiteDate, freqJours || 30).getTime() - v) / 2;
  return opDates.some((d) => d.getTime() > v - demi && d.getTime() <= v + demi);
}

/** Statut d'une visite de contrôle selon qu'elle est couverte ou non par une opération. */
function statutVisite(couverte: boolean) {
  return couverte
    ? { statut: 'ANNULEE' as const, remplaceeParOperation: true }
    : { statut: 'A_PLANIFIER' as const, remplaceeParOperation: false };
}

/**
 * Interventions encore "en attente" d'une série : non réalisées, non supprimées par un
 * utilisateur. Inclut les visites masquées car remplacées par une opération, afin qu'elles
 * suivent les décalages de leur série.
 */
const EN_ATTENTE = {
  statut: { not: 'REALISEE' as const },
  OR: [{ statut: { not: 'ANNULEE' as const } }, { remplaceeParOperation: true }],
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
            statut: { in: ['A_PLANIFIER', 'PLANIFIEE'] },
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
  async getAPlanifier(days: number = 7) {
    const today = startOfDay(new Date());
    const futureDate = endOfDay(addDays(today, days));

    return prisma.intervention.findMany({
      where: {
        datePrevue: { gte: today, lte: futureDate },
        statut: 'A_PLANIFIER',
      },
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
  async getEnRetard() {
    const today = startOfDay(new Date());

    return prisma.intervention.findMany({
      where: {
        datePrevue: { lt: today },
        statut: { notIn: ['REALISEE', 'ANNULEE'] },
      },
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
  async getSemaineCourante() {
    const { start, end } = getCurrentWeekBounds();

    return prisma.intervention.findMany({
      where: {
        datePrevue: { gte: start, lte: end },
      },
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

      if (intervention.siteId && intervention.contrat.contratSites) {
        const cs = intervention.contrat.contratSites.find((s) => s.siteId === intervention.siteId);
        if (cs) {
          csForAnchor = cs;
          if (intervention.type === 'OPERATION') {
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
        if (anchor && moisPerso) {
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
          nextDate = getProchaineDateIntervention(dateRealiseeEffective, joursPerso, moisPerso);
        }
        suggestedDate = nextDate;

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

            // Une opération remplace la visite de contrôle qui tomberait sur la même période :
            // les échéances couvertes sont enregistrées masquées et on passe à la suivante.
            if (intervention.type === 'CONTROLE') {
              const ops = await prisma.intervention.findMany({
                where: { contratId: serie.contratId, siteId: serie.siteId, type: 'OPERATION', statut: { not: 'ANNULEE' } },
                select: { datePrevue: true },
              });
              const opDates = ops.map((o) => o.datePrevue);
              for (let i = 0; i < 24 && visiteCouverteParOperation(suggestedDate, joursPerso, moisPerso, opDates); i++) {
                if (await quotaAtteint()) break;
                const dejaLa = await prisma.intervention.findFirst({ where: { ...serie, datePrevue: suggestedDate } });
                if (!dejaLa) {
                  await prisma.intervention.create({
                    data: {
                      ...serie,
                      clientId: intervention.clientId,
                      datePrevue: suggestedDate,
                      createdById: userId,
                      ...statutVisite(true),
                    },
                  });
                }
                suggestedDate = getProchaineDateIntervention(suggestedDate, joursPerso, moisPerso);
              }
            }

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

          // Une nouvelle (ou décalée) opération peut désormais couvrir une visite en attente.
          if (intervention.type === 'OPERATION' && nextIntervention) {
            await this.recalculerVisites(intervention.contratId!, intervention.siteId);
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

    const futures = await prisma.intervention.findMany({
      where: {
        contratId: ref.contratId,
        siteId: ref.siteId ?? null,
        type: ref.type,
        datePrevue: { gt: ref.datePrevue },
        id: { not: ref.id },
        ...EN_ATTENTE,
      },
    });
    for (const f of futures) {
      await prisma.intervention.update({
        where: { id: f.id },
        data: { datePrevue: new Date(f.datePrevue.getTime() + deltaMs) },
      });
    }

    await this.recalculerVisites(ref.contratId, ref.siteId);
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
   * Remet les visites de contrôle en attente d'un contrat (et d'un site) en cohérence avec ses
   * opérations : une visite dont l'échéance est couverte par une opération est masquée
   * (statut ANNULEE + remplaceeParOperation), une visite masquée qui n'est plus couverte
   * réapparaît. Les visites réalisées ou supprimées par un utilisateur ne sont jamais touchées,
   * et les visites gardent leurs dates : leur fréquence propre est conservée.
   */
  async recalculerVisites(contratId: string, siteId: string | null): Promise<{ masquees: number; restaurees: number }> {
    const contrat = await prisma.contrat.findUnique({
      where: { id: contratId },
      include: { contratSites: true },
    });
    if (!contrat) return { masquees: 0, restaurees: 0 };

    const cs = siteId ? contrat.contratSites.find((c) => c.siteId === siteId) : null;
    let freqCtrlMois: number | null = (cs as any)?.frequenceControleMois ?? null;
    let freqCtrlJours: number | null = freqCtrlMois ? null : (cs?.frequenceControleJours ?? null);
    if (!freqCtrlMois && !freqCtrlJours) {
      freqCtrlMois = (contrat as any).frequenceControleMois ?? null;
      freqCtrlJours = freqCtrlMois ? null : (contrat.frequenceControleJours ?? null);
    }
    if (!freqCtrlJours && !freqCtrlMois) return { masquees: 0, restaurees: 0 };

    const operations = await prisma.intervention.findMany({
      where: { contratId, siteId: siteId ?? null, type: 'OPERATION', statut: { not: 'ANNULEE' } },
      select: { datePrevue: true },
    });
    const opDates = operations.map((o) => o.datePrevue);

    const visites = await prisma.intervention.findMany({
      where: { contratId, siteId: siteId ?? null, type: 'CONTROLE', ...EN_ATTENTE },
    });

    let masquees = 0;
    let restaurees = 0;
    for (const v of visites) {
      const couverte = visiteCouverteParOperation(v.datePrevue, freqCtrlJours, freqCtrlMois, opDates);
      if (couverte && !v.remplaceeParOperation) {
        await prisma.intervention.update({ where: { id: v.id }, data: statutVisite(true) });
        masquees++;
      } else if (!couverte && v.remplaceeParOperation) {
        await prisma.intervention.update({ where: { id: v.id }, data: statutVisite(false) });
        restaurees++;
      }
    }
    return { masquees, restaurees };
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

    // Interventions conservées (réalisées, avenants, BC…) : leurs opérations couvrent aussi des visites
    const conservees = await prisma.intervention.findMany({
      where: { contratId, type: { in: ['OPERATION', 'CONTROLE'] }, OR: [{ statut: { not: 'ANNULEE' } }, { remplaceeParOperation: true }] },
      select: { siteId: true, type: true, prestation: true, datePrevue: true, statut: true, avenantId: true, bonCommandeId: true, remplaceeParOperation: true },
    });
    const opsConservees = conservees.filter((i) => i.type === 'OPERATION' && i.statut !== 'ANNULEE');

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
          OR: [{ statut: 'REALISEE' }, { statut: 'ANNULEE', remplaceeParOperation: false }],
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
    const dateFinAnnuel = contrat.dateFin || addDays(new Date(), 365);

    type Freq = { jours: number | null; mois: number | null } | null;
    const frequence = (src: any, kind: 'Operations' | 'Controle'): Freq => {
      const mois: number | null = src?.[`frequence${kind}Mois`] ?? null;
      const jours: number | null = mois ? null : (src?.[`frequence${kind}Jours`] ?? null);
      return mois || jours ? { jours, mois } : null;
    };

    // Calcule les échéances théoriques d'une série
    const echeances = (premiere: Date | null, freq: Freq, nombre: number): Date[] => {
      if (!premiere) return [];
      const dates: Date[] = [];
      let d = new Date(premiere);
      if (contrat.type === 'PONCTUEL') {
        // Sans fréquence, getProchaineDateIntervention retombe sur 30 jours (utile surtout pour 1 échéance)
        for (let i = 0; i < nombre && i < MAX_ECHEANCES; i++) {
          dates.push(d);
          d = getProchaineDateIntervention(d, freq?.jours, freq?.mois);
        }
        return dates;
      }
      if (!freq) return [];
      if (dateReprise) {
        for (let i = 0; d < dateReprise && i < MAX_ECHEANCES; i++) d = getProchaineDateIntervention(d, freq.jours, freq.mois);
      }
      for (let i = 0; i < MAX_ECHEANCES && (nombre > 0 ? i < nombre : d <= dateFinAnnuel); i++) {
        dates.push(d);
        d = getProchaineDateIntervention(d, freq.jours, freq.mois);
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
            freqOps: frequence(cs, 'Operations'),
            freqCtrl: frequence(cs, 'Controle'),
            premiereOp: cs.premiereDateOperation,
            premiereCtrl: cs.premiereDateControle,
            nbOps: cs.nombreOperations || 0,
            nbCtrl: cs.nombreVisitesControle || 0,
            datesOps: override?.datesPrevuesOperations,
            datesCtrl: override?.datesPrevuesControles,
          };
        })
      : [{
          siteId: null as string | null,
          prestations: contrat.prestations,
          montantApplique: (contrat as any).montantHT ?? null,
          freqOps: frequence(contrat, 'Operations'),
          freqCtrl: frequence(contrat, 'Controle'),
          premiereOp: contrat.premiereDateOperation,
          premiereCtrl: contrat.premiereDateControle,
          nbOps: contrat.nombreOperations || 0,
          nbCtrl: contrat.type === 'PONCTUEL'
            ? (contrat.nombreVisitesControle ?? contrat.nombreOperations ?? 0)
            : (contrat.nombreVisitesControle || 0),
          datesOps: undefined as Date[] | undefined,
          datesCtrl: undefined as Date[] | undefined,
        }];

    for (const s of series) {
      const base = { contratId: contrat.id, clientId: contrat.clientId, siteId: s.siteId, createdById: userId, montantApplique: s.montantApplique };

      // ── Opérations
      const datesOps = s.datesOps?.length ? s.datesOps : echeances(s.premiereOp, s.freqOps, s.nbOps);
      for (const date of datesOps) {
        for (const prestation of s.prestations) {
          if (consommer(s.siteId, 'OPERATION', prestation)) continue;
          const intervention = await prisma.intervention.create({
            data: { ...base, type: 'OPERATION', prestation, datePrevue: date, statut: 'A_PLANIFIER' },
          });
          interventionsCreees.push(intervention);
        }
      }

      // ── Visites de contrôle (une opération sur la même période remplace la visite)
      const opDates = [
        ...interventionsCreees.filter((iv) => iv.type === 'OPERATION' && iv.siteId === s.siteId),
        ...opsConservees.filter((iv) => iv.siteId === s.siteId),
      ].map((iv) => iv.datePrevue as Date);
      const datesCtrl = s.datesCtrl?.length ? s.datesCtrl : echeances(s.premiereCtrl, s.freqCtrl, s.nbCtrl);
      for (const date of datesCtrl) {
        const couverte = visiteCouverteParOperation(date, s.freqCtrl?.jours ?? null, s.freqCtrl?.mois ?? null, opDates);
        if (!couverte && consommer(s.siteId, 'CONTROLE', null)) continue;
        const intervention = await prisma.intervention.create({
          data: { ...base, type: 'CONTROLE', datePrevue: date, ...statutVisite(couverte) },
        });
        if (!couverte) interventionsCreees.push(intervention);
      }
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
    await prisma.intervention.deleteMany({
      where: {
        contratId,
        type: { in: ['OPERATION', 'CONTROLE'] },
        avenantId: null,
        bonCommandeId: null,
        OR: [
          { statut: { in: ['A_PLANIFIER', 'PLANIFIEE', 'REPORTEE'] } },
          { remplaceeParOperation: true },
        ],
      },
    });
    return this.genererPlanningContrat(contratId, userId, siteOverrides, { ignorerEcheancesConsommees: true });
  },

  /**
   * Génère les interventions supplémentaires d'un avenant (contrat ponctuel uniquement).
   * Pour chaque site du contrat (ou au niveau contrat s'il n'a pas de sites), poursuit la série
   * à partir de la dernière intervention existante du type, avec la fréquence du site (à défaut
   * celle du contrat). Les visites de contrôle couvertes par une opération sont masquées, comme
   * à la génération initiale. Vérifie les fréquences avant de créer quoi que ce soit.
   */
  async genererInterventionsAvenant(
    contratId: string,
    avenantId: string,
    userId: string,
    nbOperations: number,
    nbControles: number,
    params: { dateDebut?: Date; frequenceJours?: number } = {},
  ) {
    const contrat = await prisma.contrat.findUnique({
      where: { id: contratId },
      include: { contratSites: { include: { site: { select: { nom: true } } } } },
    });

    if (!contrat) {
      throw new Error('Contrat non trouvé');
    }
    if (contrat.type !== 'PONCTUEL') {
      throw new Error('Les avenants ne concernent que les contrats ponctuels');
    }

    // Fréquence saisie dans l'avenant prioritaire, sinon celle du site, sinon celle du contrat
    const frequence = (src: any, kind: 'Operations' | 'Controle') => {
      if (params.frequenceJours) return { mois: null, jours: params.frequenceJours };
      const mois: number | null = src?.[`frequence${kind}Mois`] ?? null;
      const jours: number | null = mois ? null : (src?.[`frequence${kind}Jours`] ?? null);
      return mois || jours ? { mois, jours } : null;
    };

    const series = contrat.contratSites.length > 0
      ? contrat.contratSites.map((cs) => ({
          siteId: cs.siteId as string | null,
          nom: cs.site?.nom ?? 'site',
          prestations: cs.prestations?.length ? cs.prestations : contrat.prestations,
          montantApplique: (cs as any).montantHT ?? (contrat as any).montantHT ?? null,
          freqOps: frequence(cs, 'Operations') ?? frequence(contrat, 'Operations'),
          freqCtrl: frequence(cs, 'Controle') ?? frequence(contrat, 'Controle'),
          premiereOp: cs.premiereDateOperation ?? contrat.premiereDateOperation,
          premiereCtrl: cs.premiereDateControle ?? contrat.premiereDateControle,
        }))
      : [{
          siteId: null as string | null,
          nom: 'contrat',
          prestations: contrat.prestations,
          montantApplique: (contrat as any).montantHT ?? null,
          freqOps: frequence(contrat, 'Operations'),
          freqCtrl: frequence(contrat, 'Controle'),
          premiereOp: contrat.premiereDateOperation,
          premiereCtrl: contrat.premiereDateControle,
        }];

    for (const s of series) {
      // Une seule échéance ne nécessite pas de fréquence
      if (nbOperations > 1 && !s.freqOps) {
        throw new Error(`aucune fréquence d'opérations définie (${s.nom}) : indiquez une fréquence dans l'avenant`);
      }
      if (nbControles > 1 && !s.freqCtrl) {
        throw new Error(`aucune fréquence de visites de contrôle définie (${s.nom}) : indiquez une fréquence dans l'avenant`);
      }
    }

    const interventionsCreees: any[] = [];

    for (const s of series) {
      const serie = { contratId: contrat.id, siteId: s.siteId };

      // Point de départ : échéance suivant la dernière intervention de la série (les visites
      // masquées car remplacées par une opération comptent comme des échéances).
      const depart = async (type: InterventionType, freq: { mois: number | null; jours: number | null } | null, premiere: Date | null) => {
        if (params.dateDebut) return new Date(params.dateDebut);
        const derniere = await prisma.intervention.findFirst({
          where: { ...serie, type, OR: [{ statut: { not: 'ANNULEE' } }, { remplaceeParOperation: true }] },
          orderBy: { datePrevue: 'desc' },
        });
        if (derniere) return getProchaineDateIntervention(derniere.datePrevue, freq?.jours, freq?.mois);
        return premiere ? new Date(premiere) : startOfDay(new Date());
      };

      if (nbOperations > 0) {
        let currentDate = await depart('OPERATION', s.freqOps, s.premiereOp);
        for (let i = 0; i < nbOperations; i++) {
          for (const prestation of s.prestations) {
            const intervention = await prisma.intervention.create({
              data: {
                ...serie,
                clientId: contrat.clientId,
                avenantId,
                type: 'OPERATION',
                prestation,
                datePrevue: currentDate,
                statut: 'A_PLANIFIER',
                createdById: userId,
                montantApplique: s.montantApplique,
              },
            });
            interventionsCreees.push(intervention);
          }
          currentDate = getProchaineDateIntervention(currentDate, s.freqOps?.jours, s.freqOps?.mois);
        }
      }

      if (nbControles > 0) {
        const ops = await prisma.intervention.findMany({
          where: { ...serie, type: 'OPERATION', statut: { not: 'ANNULEE' } },
          select: { datePrevue: true },
        });
        const opDates = ops.map((o) => o.datePrevue);
        let currentDate = await depart('CONTROLE', s.freqCtrl, s.premiereCtrl);
        for (let i = 0; i < nbControles; i++) {
          const couverte = visiteCouverteParOperation(currentDate, s.freqCtrl?.jours ?? null, s.freqCtrl?.mois ?? null, opDates);
          const intervention = await prisma.intervention.create({
            data: {
              ...serie,
              clientId: contrat.clientId,
              avenantId,
              type: 'CONTROLE',
              datePrevue: currentDate,
              createdById: userId,
              montantApplique: s.montantApplique,
              ...statutVisite(couverte),
            },
          });
          if (!couverte) interventionsCreees.push(intervention);
          currentDate = getProchaineDateIntervention(currentDate, s.freqCtrl?.jours, s.freqCtrl?.mois);
        }
      }

      // Les nouvelles opérations peuvent couvrir des visites déjà planifiées
      if (nbOperations > 0) {
        await this.recalculerVisites(contrat.id, s.siteId);
      }
    }

    return { interventionsCreees, count: interventionsCreees.length };
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

        // Vérifier si un successeur existe déjà (idempotence)
        const successorExists = await prisma.contrat.findFirst({
          where: {
            clientId: contrat.clientId,
            dateDebut: { gt: contrat.dateFin },
            statut: { in: ['ACTIF', 'SUSPENDU'] },
            contratSites: contratSiteIds.length > 0
              ? { some: { siteId: { in: contratSiteIds } } }
              : undefined,
          },
        });

        if (successorExists) continue;

        const duration = differenceInDays(contrat.dateFin, contrat.dateDebut);
        const newDateDebut = addDays(contrat.dateFin, 1);
        const newDateFin = addDays(newDateDebut, duration);

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
              frequenceControleJours: contrat.frequenceControleJours,
              frequenceOperationsMois: (contrat as any).frequenceOperationsMois ?? null,
              frequenceControleMois: (contrat as any).frequenceControleMois ?? null,
              frequenceRegles: (contrat as any).frequenceRegles ?? null,
              frequenceReglesControle: (contrat as any).frequenceReglesControle ?? null,
              planningAajuster: (contrat as any).planningAajuster ?? false,
              montantHT: (contrat as any).montantHT ?? null,
              dureeType: (contrat as any).dureeType ?? null,
              notes: contrat.notes,
              autoCreerProchaine: contrat.autoCreerProchaine,
              nombreOperations: contrat.nombreOperations,
              nombreVisitesControle: contrat.nombreVisitesControle,
              nombrePassagesAnnuels: (contrat as any).nombrePassagesAnnuels ?? null,
              statut: 'ACTIF',
              refExterne: null, // Nouvelle période — la référence sera attribuée manuellement
              datePriseEnComptePlanification: newDateDebut,
            },
          });
          newContratId = newContrat.id;

          // Copier les ContratSites avec dates d'ancre avancées de la durée du contrat
          for (const cs of contrat.contratSites) {
            const advancePremiereDateOp = cs.premiereDateOperation
              ? addDays(cs.premiereDateOperation, duration + 1)
              : null;
            const advancePremiereDateCtrl = cs.premiereDateControle
              ? addDays(cs.premiereDateControle, duration + 1)
              : null;

            await tx.contratSite.create({
              data: {
                contratId: newContrat.id,
                siteId: cs.siteId,
                prestations: cs.prestations,
                prixPrestations: cs.prixPrestations as any,
                frequenceOperationsJours: cs.frequenceOperationsJours,
                frequenceControleJours: cs.frequenceControleJours,
                frequenceOperationsMois: (cs as any).frequenceOperationsMois ?? null,
                frequenceControleMois: (cs as any).frequenceControleMois ?? null,
                frequenceRegles: (cs as any).frequenceRegles ?? null,
                frequenceReglesControle: (cs as any).frequenceReglesControle ?? null,
                montantHT: (cs as any).montantHT ?? null,
                premiereDateOperation: advancePremiereDateOp,
                premiereDateControle: advancePremiereDateCtrl,
                nombreOperations: cs.nombreOperations,
                nombreVisitesControle: cs.nombreVisitesControle,
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
          } catch (_e) {
            // Non-bloquant : la génération peut échouer si la DB n'est pas encore prête
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
