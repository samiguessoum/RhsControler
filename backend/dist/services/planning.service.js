import { prisma } from '../config/database.js';
import { getProchaineDateIntervention, getCurrentWeekBounds } from '../utils/date.utils.js';
import { startOfDay, endOfDay, addDays } from 'date-fns';
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
        const [aPlanifier, enRetard, controles30j, contratsEnAlerte, ponctuelAlerte] = await Promise.all([
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
        ]);
        return {
            aPlanifier,
            enRetard,
            controles30j,
            contratsEnAlerte: contratsEnAlerte.length,
            ponctuelAlerte: ponctuelAlerte.length,
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
     * Récupère les contrats annuels proches de la fin (dans les 60 jours)
     * pour faciliter la reconduction
     */
    async getContratsAnnuelsFinProche(joursAvantFin = 60) {
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
        const filtered = interventions.filter((i) => i.contrat?.dateFin && i.datePrevue > i.contrat.dateFin);
        const grouped = new Map();
        for (const i of filtered) {
            if (!i.contrat)
                continue;
            const key = i.contrat.id;
            const existing = grouped.get(key);
            if (existing) {
                existing.count += 1;
                if (i.datePrevue < existing.nextDate)
                    existing.nextDate = i.datePrevue;
            }
            else {
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
    async getAPlanifier(days = 7) {
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
    async marquerRealisee(interventionId, userId, options = {}) {
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
        // Mettre à jour l'intervention
        const updated = await prisma.intervention.update({
            where: { id: interventionId },
            data: {
                statut: 'REALISEE',
                dateRealisee: dateRealiseeEffective,
                datePrevue: dateRealiseeEffective,
                updatedById: userId,
                notesTerrain: options.notesTerrain || intervention.notesTerrain,
            },
            include: {
                client: true,
                contrat: true,
            },
        });
        let nextIntervention = null;
        let suggestedDate = null;
        // Les types hors-contrat ne créent pas de prochaine intervention (réclamations, visites commerciales, etc.)
        const typesHorsContrat = ['RECLAMATION', 'PREMIERE_VISITE', 'DEPLACEMENT_COMMERCIAL'];
        // Si l'intervention est liée à un contrat avec fréquence (et n'est pas un type hors-contrat)
        if (intervention.contrat && !typesHorsContrat.includes(intervention.type)) {
            // Déterminer la fréquence : depuis le ContratSite si siteId, sinon depuis le contrat
            let frequence = null;
            let joursPerso = null;
            let maxCount = null;
            if (intervention.siteId && intervention.contrat.contratSites) {
                const cs = intervention.contrat.contratSites.find((s) => s.siteId === intervention.siteId);
                if (cs) {
                    frequence = intervention.type === 'OPERATION' ? cs.frequenceOperations : cs.frequenceControle;
                    joursPerso = intervention.type === 'OPERATION' ? cs.frequenceOperationsJours : cs.frequenceControleJours;
                    maxCount = intervention.type === 'OPERATION' ? cs.nombreOperations ?? null : cs.nombreVisitesControle ?? null;
                }
            }
            if (!frequence) {
                frequence = intervention.type === 'OPERATION'
                    ? intervention.contrat.frequenceOperations
                    : intervention.contrat.frequenceControle;
                joursPerso = intervention.type === 'OPERATION'
                    ? intervention.contrat.frequenceOperationsJours
                    : intervention.contrat.frequenceControleJours;
                if (maxCount === null) {
                    maxCount = intervention.type === 'OPERATION'
                        ? intervention.contrat.nombreOperations ?? null
                        : intervention.contrat.nombreVisitesControle ?? null;
                }
            }
            // ── Étape 1 : Décaler les interventions futures si la date de réalisation
            //   diffère de la date prévue (ex : réalisé le 17 juin au lieu du 15 juin).
            //   S'applique à TOUS les types de contrat (annuel ET ponctuel).
            if (dateRealiseeEffective.getTime() !== datePrevueInitiale.getTime() &&
                intervention.contratId) {
                const deltaMs = dateRealiseeEffective.getTime() - datePrevueInitiale.getTime();
                const futures = await prisma.intervention.findMany({
                    where: {
                        contratId: intervention.contratId,
                        siteId: intervention.siteId || undefined,
                        type: intervention.type,
                        statut: { notIn: ['REALISEE', 'ANNULEE'] },
                        datePrevue: { gt: datePrevueInitiale },
                    },
                    orderBy: { datePrevue: 'asc' },
                });
                for (const f of futures) {
                    await prisma.intervention.update({
                        where: { id: f.id },
                        data: { datePrevue: new Date(f.datePrevue.getTime() + deltaMs) },
                    });
                }
            }
            // ── Étape 2 : Calcul de la prochaine date (contrats ANNUELS avec fréquence).
            //   Pour les ponctuels, les interventions sont pré-générées ; le décalage
            //   ci-dessus (step 1 + reporter) suffit à maintenir la cohérence.
            if (frequence) {
                suggestedDate = getProchaineDateIntervention(dateRealiseeEffective, frequence, joursPerso);
                if (intervention.contrat.autoCreerProchaine || options.creerProchaine) {
                    const nextExisting = await prisma.intervention.findFirst({
                        where: {
                            contratId: intervention.contratId,
                            siteId: intervention.siteId || undefined,
                            type: intervention.type,
                            statut: { notIn: ['REALISEE', 'ANNULEE'] },
                            datePrevue: { gt: dateRealiseeEffective },
                            id: { not: intervention.id },
                        },
                        orderBy: { datePrevue: 'asc' },
                    });
                    if (nextExisting) {
                        // La prochaine existe déjà (pré-générée ou décalée) : caler sur suggestedDate
                        if (nextExisting.datePrevue.getTime() !== suggestedDate.getTime()) {
                            nextIntervention = await prisma.intervention.update({
                                where: { id: nextExisting.id },
                                data: { datePrevue: suggestedDate },
                                include: { client: true },
                            });
                        }
                        else {
                            nextIntervention = nextExisting;
                        }
                    }
                    else {
                        // Aucune future : vérifier le quota avant d'en créer une
                        if (maxCount !== null) {
                            const countWhere = {
                                contratId: intervention.contratId,
                                type: intervention.type,
                                statut: { not: 'ANNULEE' },
                            };
                            if (intervention.siteId)
                                countWhere.siteId = intervention.siteId;
                            const count = await prisma.intervention.count({ where: countWhere });
                            if (count >= maxCount) {
                                return { intervention: updated, nextCreated: false, nextIntervention: null, suggestedDate };
                            }
                        }
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
            else if (intervention.contratId) {
                // ── Étape 2b : Pour les ponctuels (sans fréquence), identifier la prochaine
                //   intervention existante (déjà décalée par le reporter ou par l'étape 1).
                nextIntervention = await prisma.intervention.findFirst({
                    where: {
                        contratId: intervention.contratId,
                        siteId: intervention.siteId || undefined,
                        type: intervention.type,
                        statut: { notIn: ['REALISEE', 'ANNULEE'] },
                        datePrevue: { gt: dateRealiseeEffective },
                        id: { not: intervention.id },
                    },
                    orderBy: { datePrevue: 'asc' },
                    include: { client: true },
                });
            }
        }
        return {
            intervention: updated,
            nextCreated: !!nextIntervention,
            nextIntervention,
            suggestedDate,
        };
    },
    /**
     * Reporter une intervention
     */
    async reporter(interventionId, userId, nouvelleDatePrevue, raison) {
        const intervention = await prisma.intervention.findUnique({
            where: { id: interventionId },
        });
        if (!intervention) {
            throw new Error('Intervention non trouvée');
        }
        const deltaMs = nouvelleDatePrevue.getTime() - intervention.datePrevue.getTime();
        const noteUpdate = raison
            ? `${intervention.notesTerrain || ''}\n[Reportée le ${new Date().toLocaleDateString('fr-FR')}] ${raison}`.trim()
            : intervention.notesTerrain;
        // Cascader le décalage à toutes les interventions futures du même contrat/site/type
        // afin que la chaîne planning reste cohérente avec la date réelle de réalisation.
        if (deltaMs !== 0 && intervention.contratId) {
            const futures = await prisma.intervention.findMany({
                where: {
                    contratId: intervention.contratId,
                    siteId: intervention.siteId ?? undefined,
                    type: intervention.type,
                    statut: { notIn: ['REALISEE', 'ANNULEE'] },
                    datePrevue: { gt: intervention.datePrevue },
                    id: { not: interventionId },
                },
                orderBy: { datePrevue: 'asc' },
            });
            for (const f of futures) {
                await prisma.intervention.update({
                    where: { id: f.id },
                    data: { datePrevue: new Date(f.datePrevue.getTime() + deltaMs) },
                });
            }
        }
        return prisma.intervention.update({
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
    },
    /**
     * Génère le planning initial pour un contrat.
     * Appelé automatiquement à la création du contrat.
     * Supporte les ContratSites (fréquences par site) et les contrats ponctuels (par nombre d'opérations).
     */
    async genererPlanningContrat(contratId, userId, siteOverrides) {
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
        const interventionsCreees = [];
        const hasContratSites = contrat.contratSites && contrat.contratSites.length > 0;
        if (hasContratSites) {
            // Génération par site
            for (const cs of contrat.contratSites) {
                // Utiliser les prestations du site, ou fallback sur celles du contrat
                const sitePrestations = cs.prestations && cs.prestations.length > 0 ? cs.prestations : contrat.prestations;
                const siteOverride = siteOverrides?.find((o) => o.siteId === cs.siteId);
                if (contrat.type === 'PONCTUEL') {
                    // Contrat ponctuel : générer selon le nombre d'opérations du site
                    const nbOps = cs.nombreOperations || 0;
                    const nbControles = cs.nombreVisitesControle || 0;
                    if (cs.premiereDateOperation && (nbOps > 0 || siteOverride?.datesPrevuesOperations?.length)) {
                        if (siteOverride?.datesPrevuesOperations?.length) {
                            for (const date of siteOverride.datesPrevuesOperations) {
                                for (const prestation of sitePrestations) {
                                    const intervention = await prisma.intervention.create({
                                        data: { contratId: contrat.id, clientId: contrat.clientId, siteId: cs.siteId, type: 'OPERATION', prestation, datePrevue: date, statut: 'A_PLANIFIER', createdById: userId },
                                    });
                                    interventionsCreees.push(intervention);
                                }
                            }
                        }
                        else if (cs.frequenceOperations && nbOps > 0) {
                            let currentDate = new Date(cs.premiereDateOperation);
                            for (let i = 0; i < nbOps; i++) {
                                for (const prestation of sitePrestations) {
                                    const intervention = await prisma.intervention.create({
                                        data: { contratId: contrat.id, clientId: contrat.clientId, siteId: cs.siteId, type: 'OPERATION', prestation, datePrevue: currentDate, statut: 'A_PLANIFIER', createdById: userId },
                                    });
                                    interventionsCreees.push(intervention);
                                }
                                currentDate = getProchaineDateIntervention(currentDate, cs.frequenceOperations, cs.frequenceOperationsJours);
                            }
                        }
                    }
                    if (cs.premiereDateControle && (nbControles > 0 || siteOverride?.datesPrevuesControles?.length)) {
                        if (siteOverride?.datesPrevuesControles?.length) {
                            for (const date of siteOverride.datesPrevuesControles) {
                                const intervention = await prisma.intervention.create({
                                    data: { contratId: contrat.id, clientId: contrat.clientId, siteId: cs.siteId, type: 'CONTROLE', datePrevue: date, statut: 'A_PLANIFIER', createdById: userId },
                                });
                                interventionsCreees.push(intervention);
                            }
                        }
                        else if (cs.frequenceControle && nbControles > 0) {
                            let currentDate = new Date(cs.premiereDateControle);
                            for (let i = 0; i < nbControles; i++) {
                                const intervention = await prisma.intervention.create({
                                    data: { contratId: contrat.id, clientId: contrat.clientId, siteId: cs.siteId, type: 'CONTROLE', datePrevue: currentDate, statut: 'A_PLANIFIER', createdById: userId },
                                });
                                interventionsCreees.push(intervention);
                                currentDate = getProchaineDateIntervention(currentDate, cs.frequenceControle, cs.frequenceControleJours);
                            }
                        }
                    }
                }
                else {
                    // Contrat annuel : générer par nombre si renseigné, sinon jusqu'à dateFin
                    const dateFin = contrat.dateFin || addDays(new Date(), 365);
                    const nbOps = cs.nombreOperations || 0;
                    const nbControles = cs.nombreVisitesControle || 0;
                    if (cs.frequenceOperations && cs.premiereDateOperation) {
                        if (siteOverride?.datesPrevuesOperations?.length) {
                            for (const date of siteOverride.datesPrevuesOperations) {
                                for (const prestation of sitePrestations) {
                                    const intervention = await prisma.intervention.create({
                                        data: { contratId: contrat.id, clientId: contrat.clientId, siteId: cs.siteId, type: 'OPERATION', prestation, datePrevue: date, statut: 'A_PLANIFIER', createdById: userId },
                                    });
                                    interventionsCreees.push(intervention);
                                }
                            }
                        }
                        else {
                            let currentDate = new Date(cs.premiereDateOperation);
                            if (nbOps > 0) {
                                for (let i = 0; i < nbOps; i++) {
                                    for (const prestation of sitePrestations) {
                                        const intervention = await prisma.intervention.create({
                                            data: {
                                                contratId: contrat.id,
                                                clientId: contrat.clientId,
                                                siteId: cs.siteId,
                                                type: 'OPERATION',
                                                prestation,
                                                datePrevue: currentDate,
                                                statut: 'A_PLANIFIER',
                                                createdById: userId,
                                            },
                                        });
                                        interventionsCreees.push(intervention);
                                    }
                                    currentDate = getProchaineDateIntervention(currentDate, cs.frequenceOperations, cs.frequenceOperationsJours);
                                }
                            }
                            else {
                                while (currentDate <= dateFin) {
                                    for (const prestation of sitePrestations) {
                                        const intervention = await prisma.intervention.create({
                                            data: {
                                                contratId: contrat.id,
                                                clientId: contrat.clientId,
                                                siteId: cs.siteId,
                                                type: 'OPERATION',
                                                prestation,
                                                datePrevue: currentDate,
                                                statut: 'A_PLANIFIER',
                                                createdById: userId,
                                            },
                                        });
                                        interventionsCreees.push(intervention);
                                    }
                                    currentDate = getProchaineDateIntervention(currentDate, cs.frequenceOperations, cs.frequenceOperationsJours);
                                }
                            }
                        } // end else (frequency-based ops)
                    }
                    if (cs.frequenceControle && cs.premiereDateControle) {
                        if (siteOverride?.datesPrevuesControles?.length) {
                            for (const date of siteOverride.datesPrevuesControles) {
                                const intervention = await prisma.intervention.create({
                                    data: { contratId: contrat.id, clientId: contrat.clientId, siteId: cs.siteId, type: 'CONTROLE', datePrevue: date, statut: 'A_PLANIFIER', createdById: userId },
                                });
                                interventionsCreees.push(intervention);
                            }
                        }
                        else {
                            let currentDate = new Date(cs.premiereDateControle);
                            if (nbControles > 0) {
                                for (let i = 0; i < nbControles; i++) {
                                    const intervention = await prisma.intervention.create({
                                        data: {
                                            contratId: contrat.id,
                                            clientId: contrat.clientId,
                                            siteId: cs.siteId,
                                            type: 'CONTROLE',
                                            datePrevue: currentDate,
                                            statut: 'A_PLANIFIER',
                                            createdById: userId,
                                        },
                                    });
                                    interventionsCreees.push(intervention);
                                    currentDate = getProchaineDateIntervention(currentDate, cs.frequenceControle, cs.frequenceControleJours);
                                }
                            }
                            else {
                                while (currentDate <= dateFin) {
                                    const intervention = await prisma.intervention.create({
                                        data: {
                                            contratId: contrat.id,
                                            clientId: contrat.clientId,
                                            siteId: cs.siteId,
                                            type: 'CONTROLE',
                                            datePrevue: currentDate,
                                            statut: 'A_PLANIFIER',
                                            createdById: userId,
                                        },
                                    });
                                    interventionsCreees.push(intervention);
                                    currentDate = getProchaineDateIntervention(currentDate, cs.frequenceControle, cs.frequenceControleJours);
                                }
                            }
                        } // end else (frequency-based controls)
                    }
                }
            }
        }
        else {
            // Pas de sites spécifiques - utiliser les fréquences au niveau contrat (comportement legacy)
            if (contrat.type === 'PONCTUEL') {
                const nbOps = contrat.nombreOperations || 0;
                if (contrat.frequenceOperations && contrat.premiereDateOperation && nbOps > 0) {
                    let currentDate = new Date(contrat.premiereDateOperation);
                    for (let i = 0; i < nbOps; i++) {
                        for (const prestation of contrat.prestations) {
                            const intervention = await prisma.intervention.create({
                                data: {
                                    contratId: contrat.id,
                                    clientId: contrat.clientId,
                                    type: 'OPERATION',
                                    prestation,
                                    datePrevue: currentDate,
                                    statut: 'A_PLANIFIER',
                                    createdById: userId,
                                },
                            });
                            interventionsCreees.push(intervention);
                        }
                        currentDate = getProchaineDateIntervention(currentDate, contrat.frequenceOperations, contrat.frequenceOperationsJours);
                    }
                }
                if (contrat.frequenceControle && contrat.premiereDateControle) {
                    let currentDate = new Date(contrat.premiereDateControle);
                    const nbCtrl = contrat.nombreVisitesControle ?? nbOps ?? 0;
                    if (nbCtrl > 0) {
                        for (let i = 0; i < nbCtrl; i++) {
                            const intervention = await prisma.intervention.create({
                                data: {
                                    contratId: contrat.id,
                                    clientId: contrat.clientId,
                                    type: 'CONTROLE',
                                    datePrevue: currentDate,
                                    statut: 'A_PLANIFIER',
                                    createdById: userId,
                                },
                            });
                            interventionsCreees.push(intervention);
                            currentDate = getProchaineDateIntervention(currentDate, contrat.frequenceControle, contrat.frequenceControleJours);
                        }
                    }
                }
            }
            else {
                // Contrat annuel sans sites
                const dateFin = contrat.dateFin || addDays(new Date(), 365);
                const nbOps = contrat.nombreOperations || 0;
                const nbCtrl = contrat.nombreVisitesControle || 0;
                if (contrat.frequenceOperations && contrat.premiereDateOperation) {
                    let currentDate = new Date(contrat.premiereDateOperation);
                    if (nbOps > 0) {
                        for (let i = 0; i < nbOps; i++) {
                            for (const prestation of contrat.prestations) {
                                const intervention = await prisma.intervention.create({
                                    data: {
                                        contratId: contrat.id,
                                        clientId: contrat.clientId,
                                        type: 'OPERATION',
                                        prestation,
                                        datePrevue: currentDate,
                                        statut: 'A_PLANIFIER',
                                        createdById: userId,
                                    },
                                });
                                interventionsCreees.push(intervention);
                            }
                            currentDate = getProchaineDateIntervention(currentDate, contrat.frequenceOperations, contrat.frequenceOperationsJours);
                        }
                    }
                    else {
                        while (currentDate <= dateFin) {
                            for (const prestation of contrat.prestations) {
                                const intervention = await prisma.intervention.create({
                                    data: {
                                        contratId: contrat.id,
                                        clientId: contrat.clientId,
                                        type: 'OPERATION',
                                        prestation,
                                        datePrevue: currentDate,
                                        statut: 'A_PLANIFIER',
                                        createdById: userId,
                                    },
                                });
                                interventionsCreees.push(intervention);
                            }
                            currentDate = getProchaineDateIntervention(currentDate, contrat.frequenceOperations, contrat.frequenceOperationsJours);
                        }
                    }
                }
                if (contrat.frequenceControle && contrat.premiereDateControle) {
                    let currentDate = new Date(contrat.premiereDateControle);
                    if (nbCtrl > 0) {
                        for (let i = 0; i < nbCtrl; i++) {
                            const intervention = await prisma.intervention.create({
                                data: {
                                    contratId: contrat.id,
                                    clientId: contrat.clientId,
                                    type: 'CONTROLE',
                                    datePrevue: currentDate,
                                    statut: 'A_PLANIFIER',
                                    createdById: userId,
                                },
                            });
                            interventionsCreees.push(intervention);
                            currentDate = getProchaineDateIntervention(currentDate, contrat.frequenceControle, contrat.frequenceControleJours);
                        }
                    }
                    else {
                        while (currentDate <= dateFin) {
                            const intervention = await prisma.intervention.create({
                                data: {
                                    contratId: contrat.id,
                                    clientId: contrat.clientId,
                                    type: 'CONTROLE',
                                    datePrevue: currentDate,
                                    statut: 'A_PLANIFIER',
                                    createdById: userId,
                                },
                            });
                            interventionsCreees.push(intervention);
                            currentDate = getProchaineDateIntervention(currentDate, contrat.frequenceControle, contrat.frequenceControleJours);
                        }
                    }
                }
            }
        }
        return {
            contrat,
            interventionsCreees,
            count: interventionsCreees.length,
        };
    },
};
export default planningService;
//# sourceMappingURL=planning.service.js.map