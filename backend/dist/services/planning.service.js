"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planningService = void 0;
const database_js_1 = require("../config/database.js");
const date_utils_js_1 = require("../utils/date.utils.js");
const date_fns_1 = require("date-fns");
/**
 * Service de gestion du planning avec logique anti-oubli
 */
exports.planningService = {
    /**
     * Récupère les statistiques du dashboard
     */
    async getStats() {
        const today = (0, date_fns_1.startOfDay)(new Date());
        const in7Days = (0, date_fns_1.endOfDay)((0, date_fns_1.addDays)(today, 7));
        const in30Days = (0, date_fns_1.endOfDay)((0, date_fns_1.addDays)(today, 30));
        const [aPlanifier, enRetard, controles30j, contratsEnAlerte, ponctuelAlerte] = await Promise.all([
            // Interventions à planifier dans les 7 prochains jours
            database_js_1.prisma.intervention.count({
                where: {
                    datePrevue: { gte: today, lte: in7Days },
                    statut: 'A_PLANIFIER',
                },
            }),
            // Interventions en retard
            database_js_1.prisma.intervention.count({
                where: {
                    datePrevue: { lt: today },
                    statut: { notIn: ['REALISEE', 'ANNULEE'] },
                },
            }),
            // Contrôles à venir dans 30 jours
            database_js_1.prisma.intervention.count({
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
        const today = (0, date_fns_1.startOfDay)(new Date());
        const contrats = await database_js_1.prisma.contrat.findMany({
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
     * Récupère les contrats ponctuels avec 1 seule opération restante
     */
    async getContratsPonctuelAlerte() {
        const contrats = await database_js_1.prisma.contrat.findMany({
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
        // Filtrer ceux avec exactement 1 opération restante
        return contrats.filter((c) => {
            const remaining = c.interventions.filter((i) => i.type === 'OPERATION').length;
            return remaining === 1;
        });
    },
    /**
     * Récupère les interventions à planifier (dans les X prochains jours)
     */
    async getAPlanifier(days = 7) {
        const today = (0, date_fns_1.startOfDay)(new Date());
        const futureDate = (0, date_fns_1.endOfDay)((0, date_fns_1.addDays)(today, days));
        return database_js_1.prisma.intervention.findMany({
            where: {
                datePrevue: { gte: today, lte: futureDate },
                statut: 'A_PLANIFIER',
            },
            include: {
                client: { select: { id: true, nomEntreprise: true, sites: { select: { id: true, nom: true, adresse: true } } } },
                contrat: { select: { id: true, type: true, prestations: true } },
                site: { select: { id: true, nom: true, adresse: true } },
            },
            orderBy: { datePrevue: 'asc' },
        });
    },
    /**
     * Récupère les interventions en retard
     */
    async getEnRetard() {
        const today = (0, date_fns_1.startOfDay)(new Date());
        return database_js_1.prisma.intervention.findMany({
            where: {
                datePrevue: { lt: today },
                statut: { notIn: ['REALISEE', 'ANNULEE'] },
            },
            include: {
                client: { select: { id: true, nomEntreprise: true, sites: { select: { id: true, nom: true, adresse: true } } } },
                contrat: { select: { id: true, type: true, prestations: true } },
                site: { select: { id: true, nom: true, adresse: true } },
            },
            orderBy: { datePrevue: 'asc' },
        });
    },
    /**
     * Récupère les interventions de la semaine courante
     */
    async getSemaineCourante() {
        const { start, end } = (0, date_utils_js_1.getCurrentWeekBounds)();
        return database_js_1.prisma.intervention.findMany({
            where: {
                datePrevue: { gte: start, lte: end },
            },
            include: {
                client: { select: { id: true, nomEntreprise: true, sites: { select: { id: true, nom: true, adresse: true } } } },
                contrat: { select: { id: true, type: true, prestations: true } },
                site: { select: { id: true, nom: true, adresse: true } },
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
        const intervention = await database_js_1.prisma.intervention.findUnique({
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
        // Mettre à jour l'intervention
        const updated = await database_js_1.prisma.intervention.update({
            where: { id: interventionId },
            data: {
                statut: 'REALISEE',
                dateRealisee: dateRealiseeEffective,
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
        // Si l'intervention est liée à un contrat avec fréquence
        if (intervention.contrat) {
            // Pour un contrat ponctuel, pas de prochaine auto-création au-delà du nombre d'opérations
            if (intervention.contrat.type === 'PONCTUEL') {
                // Compter les opérations restantes (non réalisées/annulées)
                const remaining = await database_js_1.prisma.intervention.count({
                    where: {
                        contratId: intervention.contratId,
                        type: 'OPERATION',
                        statut: { notIn: ['REALISEE', 'ANNULEE'] },
                    },
                });
                // Ne pas créer de prochaine si on est déjà au bout
                return {
                    intervention: updated,
                    nextCreated: false,
                    nextIntervention: null,
                    suggestedDate: null,
                    operationsRestantes: remaining,
                };
            }
            // Déterminer la fréquence : depuis le ContratSite si siteId, sinon depuis le contrat
            let frequence = null;
            let joursPerso = null;
            if (intervention.siteId && intervention.contrat.contratSites) {
                const cs = intervention.contrat.contratSites.find((s) => s.siteId === intervention.siteId);
                if (cs) {
                    frequence = intervention.type === 'OPERATION' ? cs.frequenceOperations : cs.frequenceControle;
                    joursPerso = intervention.type === 'OPERATION' ? cs.frequenceOperationsJours : cs.frequenceControleJours;
                }
            }
            if (!frequence) {
                frequence = intervention.type === 'OPERATION'
                    ? intervention.contrat.frequenceOperations
                    : intervention.contrat.frequenceControle;
                joursPerso = intervention.type === 'OPERATION'
                    ? intervention.contrat.frequenceOperationsJours
                    : intervention.contrat.frequenceControleJours;
            }
            if (frequence) {
                // Calculer la prochaine date à partir de la DATE RÉELLE de réalisation
                suggestedDate = (0, date_utils_js_1.getProchaineDateIntervention)(dateRealiseeEffective, frequence, joursPerso);
                // Auto-créer si option activée sur le contrat ou demandée explicitement
                if (intervention.contrat.autoCreerProchaine || options.creerProchaine) {
                    nextIntervention = await database_js_1.prisma.intervention.create({
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
                        include: {
                            client: true,
                        },
                    });
                }
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
        const intervention = await database_js_1.prisma.intervention.findUnique({
            where: { id: interventionId },
        });
        if (!intervention) {
            throw new Error('Intervention non trouvée');
        }
        const noteUpdate = raison
            ? `${intervention.notesTerrain || ''}\n[Reportée le ${new Date().toLocaleDateString('fr-FR')}] ${raison}`.trim()
            : intervention.notesTerrain;
        return database_js_1.prisma.intervention.update({
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
    async genererPlanningContrat(contratId, userId) {
        const contrat = await database_js_1.prisma.contrat.findUnique({
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
                if (contrat.type === 'PONCTUEL') {
                    // Contrat ponctuel : générer selon le nombre d'opérations du site
                    const nbOps = cs.nombreOperations || 0;
                    const nbControles = cs.nombreVisitesControle || 0;
                    if (cs.frequenceOperations && cs.premiereDateOperation && nbOps > 0) {
                        let currentDate = new Date(cs.premiereDateOperation);
                        for (let i = 0; i < nbOps; i++) {
                            for (const prestation of sitePrestations) {
                                const intervention = await database_js_1.prisma.intervention.create({
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
                            currentDate = (0, date_utils_js_1.getProchaineDateIntervention)(currentDate, cs.frequenceOperations, cs.frequenceOperationsJours);
                        }
                    }
                    if (cs.frequenceControle && cs.premiereDateControle && nbControles > 0) {
                        let currentDate = new Date(cs.premiereDateControle);
                        for (let i = 0; i < nbControles; i++) {
                            const intervention = await database_js_1.prisma.intervention.create({
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
                            currentDate = (0, date_utils_js_1.getProchaineDateIntervention)(currentDate, cs.frequenceControle, cs.frequenceControleJours);
                        }
                    }
                }
                else {
                    // Contrat annuel : générer jusqu'à dateFin
                    const dateFin = contrat.dateFin || (0, date_fns_1.addDays)(new Date(), 365);
                    if (cs.frequenceOperations && cs.premiereDateOperation) {
                        let currentDate = new Date(cs.premiereDateOperation);
                        while (currentDate <= dateFin) {
                            for (const prestation of sitePrestations) {
                                const intervention = await database_js_1.prisma.intervention.create({
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
                            currentDate = (0, date_utils_js_1.getProchaineDateIntervention)(currentDate, cs.frequenceOperations, cs.frequenceOperationsJours);
                        }
                    }
                    if (cs.frequenceControle && cs.premiereDateControle) {
                        let currentDate = new Date(cs.premiereDateControle);
                        while (currentDate <= dateFin) {
                            const intervention = await database_js_1.prisma.intervention.create({
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
                            currentDate = (0, date_utils_js_1.getProchaineDateIntervention)(currentDate, cs.frequenceControle, cs.frequenceControleJours);
                        }
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
                            const intervention = await database_js_1.prisma.intervention.create({
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
                        currentDate = (0, date_utils_js_1.getProchaineDateIntervention)(currentDate, contrat.frequenceOperations, contrat.frequenceOperationsJours);
                    }
                }
                if (contrat.frequenceControle && contrat.premiereDateControle) {
                    let currentDate = new Date(contrat.premiereDateControle);
                    // Pour ponctuel, limiter aux nombre d'opérations aussi pour les contrôles
                    const nbCtrl = nbOps || 1;
                    for (let i = 0; i < nbCtrl; i++) {
                        const intervention = await database_js_1.prisma.intervention.create({
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
                        currentDate = (0, date_utils_js_1.getProchaineDateIntervention)(currentDate, contrat.frequenceControle, contrat.frequenceControleJours);
                    }
                }
            }
            else {
                // Contrat annuel sans sites
                const dateFin = contrat.dateFin || (0, date_fns_1.addDays)(new Date(), 365);
                if (contrat.frequenceOperations && contrat.premiereDateOperation) {
                    let currentDate = new Date(contrat.premiereDateOperation);
                    while (currentDate <= dateFin) {
                        for (const prestation of contrat.prestations) {
                            const intervention = await database_js_1.prisma.intervention.create({
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
                        currentDate = (0, date_utils_js_1.getProchaineDateIntervention)(currentDate, contrat.frequenceOperations, contrat.frequenceOperationsJours);
                    }
                }
                if (contrat.frequenceControle && contrat.premiereDateControle) {
                    let currentDate = new Date(contrat.premiereDateControle);
                    while (currentDate <= dateFin) {
                        const intervention = await database_js_1.prisma.intervention.create({
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
                        currentDate = (0, date_utils_js_1.getProchaineDateIntervention)(currentDate, contrat.frequenceControle, contrat.frequenceControleJours);
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
exports.default = exports.planningService;
//# sourceMappingURL=planning.service.js.map