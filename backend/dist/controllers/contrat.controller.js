"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contratController = void 0;
const database_js_1 = require("../config/database.js");
const audit_controller_js_1 = require("./audit.controller.js");
const planning_service_js_1 = __importDefault(require("../services/planning.service.js"));
exports.contratController = {
    /**
     * GET /api/contrats
     */
    async list(req, res) {
        try {
            const { clientId, statut, type, page = '1', limit = '20' } = req.query;
            const where = {};
            if (clientId)
                where.clientId = clientId;
            if (statut)
                where.statut = statut;
            if (type)
                where.type = type;
            const pageNum = parseInt(page) || 1;
            const limitNum = Math.min(parseInt(limit) || 20, 100);
            const skip = (pageNum - 1) * limitNum;
            const [contrats, total] = await Promise.all([
                database_js_1.prisma.contrat.findMany({
                    where,
                    skip,
                    take: limitNum,
                    orderBy: { dateDebut: 'desc' },
                    include: {
                        client: {
                            select: {
                                id: true,
                                nomEntreprise: true,
                                sites: { select: { id: true, nom: true, adresse: true } },
                            },
                        },
                        responsablePlanning: {
                            select: { id: true, nom: true, prenom: true },
                        },
                        contratSites: {
                            include: {
                                site: { select: { id: true, nom: true, adresse: true } },
                            },
                        },
                        _count: {
                            select: { interventions: true },
                        },
                    },
                }),
                database_js_1.prisma.contrat.count({ where }),
            ]);
            res.json({
                contrats,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            });
        }
        catch (error) {
            console.error('List contrats error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * GET /api/contrats/:id
     */
    async get(req, res) {
        try {
            const { id } = req.params;
            const contrat = await database_js_1.prisma.contrat.findUnique({
                where: { id },
                include: {
                    client: {
                        include: { sites: true },
                    },
                    responsablePlanning: {
                        select: { id: true, nom: true, prenom: true, email: true },
                    },
                    contratSites: {
                        include: {
                            site: true,
                        },
                    },
                    interventions: {
                        orderBy: { datePrevue: 'desc' },
                        take: 50,
                        include: {
                            createdBy: {
                                select: { id: true, nom: true, prenom: true },
                            },
                            site: {
                                select: { id: true, nom: true, adresse: true },
                            },
                        },
                    },
                },
            });
            if (!contrat) {
                return res.status(404).json({ error: 'Contrat non trouvé' });
            }
            res.json({ contrat });
        }
        catch (error) {
            console.error('Get contrat error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * POST /api/contrats
     * Crée le contrat ET génère automatiquement le planning
     */
    async create(req, res) {
        try {
            const data = req.body;
            // Vérifier que le client existe
            const client = await database_js_1.prisma.client.findUnique({
                where: { id: data.clientId },
            });
            if (!client) {
                return res.status(400).json({ error: 'Client non trouvé' });
            }
            if (!client.actif) {
                return res.status(400).json({ error: 'Impossible de créer un contrat pour un client inactif' });
            }
            const contrat = await database_js_1.prisma.contrat.create({
                data: {
                    clientId: data.clientId,
                    type: data.type,
                    dateDebut: data.dateDebut,
                    dateFin: data.dateFin,
                    reconductionAuto: data.reconductionAuto ?? false,
                    prestations: data.prestations,
                    frequenceOperations: data.frequenceOperations,
                    frequenceOperationsJours: data.frequenceOperationsJours,
                    frequenceControle: data.frequenceControle,
                    frequenceControleJours: data.frequenceControleJours,
                    premiereDateOperation: data.premiereDateOperation,
                    premiereDateControle: data.premiereDateControle,
                    responsablePlanningId: data.responsablePlanningId,
                    statut: data.statut ?? 'ACTIF',
                    notes: data.notes,
                    autoCreerProchaine: true,
                    numeroBonCommande: data.numeroBonCommande,
                    nombreOperations: data.nombreOperations,
                },
                include: {
                    client: {
                        select: { id: true, nomEntreprise: true },
                    },
                },
            });
            // Créer les ContratSites si fournis
            if (data.contratSites && data.contratSites.length > 0) {
                for (const cs of data.contratSites) {
                    await database_js_1.prisma.contratSite.create({
                        data: {
                            contratId: contrat.id,
                            siteId: cs.siteId,
                            prestations: cs.prestations || [],
                            frequenceOperations: cs.frequenceOperations,
                            frequenceOperationsJours: cs.frequenceOperationsJours,
                            frequenceControle: cs.frequenceControle,
                            frequenceControleJours: cs.frequenceControleJours,
                            premiereDateOperation: cs.premiereDateOperation,
                            premiereDateControle: cs.premiereDateControle,
                            nombreOperations: cs.nombreOperations,
                            nombreVisitesControle: cs.nombreVisitesControle,
                            notes: cs.notes,
                        },
                    });
                }
            }
            // Audit log
            await (0, audit_controller_js_1.createAuditLog)(req.user.id, 'CREATE', 'Contrat', contrat.id, { after: contrat });
            // Générer automatiquement le planning si le contrat est ACTIF
            let planningResult = null;
            if (contrat.statut === 'ACTIF') {
                try {
                    planningResult = await planning_service_js_1.default.genererPlanningContrat(contrat.id, req.user.id);
                }
                catch (planningError) {
                    console.error('Auto-planning generation error:', planningError);
                    // On ne bloque pas la création du contrat si le planning échoue
                }
            }
            res.status(201).json({
                contrat,
                planning: planningResult
                    ? { interventionsCreees: planningResult.count }
                    : null,
            });
        }
        catch (error) {
            console.error('Create contrat error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * PUT /api/contrats/:id
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const existing = await database_js_1.prisma.contrat.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Contrat non trouvé' });
            }
            // Validation spéciale si on passe en ACTIF
            if (data.statut === 'ACTIF' && existing.statut !== 'ACTIF') {
                const hasContratSites = data.contratSites && data.contratSites.length > 0;
                if (!hasContratSites) {
                    const hasFrequenceOp = data.frequenceOperations ?? existing.frequenceOperations;
                    const hasFrequenceCtrl = data.frequenceControle ?? existing.frequenceControle;
                    const hasDateOp = data.premiereDateOperation ?? existing.premiereDateOperation;
                    const hasDateCtrl = data.premiereDateControle ?? existing.premiereDateControle;
                    if (!hasFrequenceOp && !hasFrequenceCtrl) {
                        return res.status(400).json({
                            error: 'Un contrat actif nécessite au moins une fréquence (opérations ou contrôle)',
                        });
                    }
                    if (hasFrequenceOp && !hasDateOp) {
                        return res.status(400).json({
                            error: 'Date de première opération requise pour la fréquence d\'opérations',
                        });
                    }
                    if (hasFrequenceCtrl && !hasDateCtrl) {
                        return res.status(400).json({
                            error: 'Date de premier contrôle requise pour la fréquence de contrôle',
                        });
                    }
                }
            }
            const contrat = await database_js_1.prisma.contrat.update({
                where: { id },
                data: {
                    clientId: data.clientId ?? existing.clientId,
                    type: data.type ?? existing.type,
                    dateDebut: data.dateDebut ?? existing.dateDebut,
                    dateFin: data.dateFin !== undefined ? data.dateFin : existing.dateFin,
                    reconductionAuto: data.reconductionAuto ?? existing.reconductionAuto,
                    prestations: data.prestations ?? existing.prestations,
                    frequenceOperations: data.frequenceOperations !== undefined ? data.frequenceOperations : existing.frequenceOperations,
                    frequenceOperationsJours: data.frequenceOperationsJours !== undefined ? data.frequenceOperationsJours : existing.frequenceOperationsJours,
                    frequenceControle: data.frequenceControle !== undefined ? data.frequenceControle : existing.frequenceControle,
                    frequenceControleJours: data.frequenceControleJours !== undefined ? data.frequenceControleJours : existing.frequenceControleJours,
                    premiereDateOperation: data.premiereDateOperation !== undefined ? data.premiereDateOperation : existing.premiereDateOperation,
                    premiereDateControle: data.premiereDateControle !== undefined ? data.premiereDateControle : existing.premiereDateControle,
                    responsablePlanningId: data.responsablePlanningId !== undefined ? data.responsablePlanningId : existing.responsablePlanningId,
                    statut: data.statut ?? existing.statut,
                    notes: data.notes ?? existing.notes,
                    autoCreerProchaine: true,
                    numeroBonCommande: data.numeroBonCommande !== undefined ? data.numeroBonCommande : existing.numeroBonCommande,
                    nombreOperations: data.nombreOperations !== undefined ? data.nombreOperations : existing.nombreOperations,
                },
                include: {
                    client: {
                        select: { id: true, nomEntreprise: true },
                    },
                },
            });
            // Mettre à jour les ContratSites si fournis
            if (data.contratSites !== undefined) {
                // Supprimer les anciens
                await database_js_1.prisma.contratSite.deleteMany({ where: { contratId: id } });
                // Créer les nouveaux
                if (data.contratSites && data.contratSites.length > 0) {
                    for (const cs of data.contratSites) {
                        await database_js_1.prisma.contratSite.create({
                            data: {
                                contratId: id,
                                siteId: cs.siteId,
                                prestations: cs.prestations || [],
                                frequenceOperations: cs.frequenceOperations,
                                frequenceOperationsJours: cs.frequenceOperationsJours,
                                frequenceControle: cs.frequenceControle,
                                frequenceControleJours: cs.frequenceControleJours,
                                premiereDateOperation: cs.premiereDateOperation,
                                premiereDateControle: cs.premiereDateControle,
                                nombreOperations: cs.nombreOperations,
                                nombreVisitesControle: cs.nombreVisitesControle,
                                notes: cs.notes,
                            },
                        });
                    }
                }
            }
            // Regénérer le planning si contrat actif (met à jour les interventions futures)
            if (contrat.statut === 'ACTIF') {
                await database_js_1.prisma.intervention.deleteMany({
                    where: {
                        contratId: id,
                        statut: { notIn: ['REALISEE', 'ANNULEE'] },
                    },
                });
                try {
                    await planning_service_js_1.default.genererPlanningContrat(id, req.user.id);
                }
                catch (planningError) {
                    console.error('Auto-planning update error:', planningError);
                }
            }
            // Audit log
            await (0, audit_controller_js_1.createAuditLog)(req.user.id, 'UPDATE', 'Contrat', contrat.id, {
                before: existing,
                after: contrat,
            });
            res.json({ contrat });
        }
        catch (error) {
            console.error('Update contrat error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * DELETE /api/contrats/:id
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const existing = await database_js_1.prisma.contrat.findUnique({
                where: { id },
            });
            if (!existing) {
                return res.status(404).json({ error: 'Contrat non trouvé' });
            }
            // Supprimer toutes les interventions associées
            await database_js_1.prisma.intervention.deleteMany({
                where: { contratId: id },
            });
            // ContratSites supprimés en cascade (onDelete: Cascade)
            await database_js_1.prisma.contrat.delete({
                where: { id },
            });
            // Audit log
            await (0, audit_controller_js_1.createAuditLog)(req.user.id, 'DELETE', 'Contrat', id);
            res.json({ message: 'Contrat supprimé' });
        }
        catch (error) {
            console.error('Delete contrat error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
};
exports.default = exports.contratController;
//# sourceMappingURL=contrat.controller.js.map