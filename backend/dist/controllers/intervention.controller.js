"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interventionController = void 0;
const database_js_1 = require("../config/database.js");
const audit_controller_js_1 = require("./audit.controller.js");
const planning_service_js_1 = __importDefault(require("../services/planning.service.js"));
const date_fns_1 = require("date-fns");
exports.interventionController = {
    /**
     * GET /api/interventions
     */
    async list(req, res) {
        try {
            const { clientId, contratId, type, statut, prestation, dateDebut, dateFin, page = '1', limit = '50', } = req.query;
            const where = {};
            if (clientId)
                where.clientId = clientId;
            if (contratId)
                where.contratId = contratId;
            if (type)
                where.type = type;
            if (statut)
                where.statut = statut;
            if (prestation)
                where.prestation = { contains: prestation, mode: 'insensitive' };
            if (dateDebut || dateFin) {
                where.datePrevue = {};
                if (dateDebut)
                    where.datePrevue.gte = (0, date_fns_1.startOfDay)((0, date_fns_1.parseISO)(dateDebut));
                if (dateFin)
                    where.datePrevue.lte = (0, date_fns_1.endOfDay)((0, date_fns_1.parseISO)(dateFin));
            }
            const pageNum = parseInt(page) || 1;
            const limitNum = Math.min(parseInt(limit) || 50, 200);
            const skip = (pageNum - 1) * limitNum;
            const [interventions, total] = await Promise.all([
                database_js_1.prisma.intervention.findMany({
                    where,
                    skip,
                    take: limitNum,
                    orderBy: [{ datePrevue: 'asc' }, { heurePrevue: 'asc' }],
                    include: {
                        client: {
                            select: { id: true, nomEntreprise: true, sites: { select: { id: true, nom: true, adresse: true } } },
                        },
                        contrat: {
                            select: { id: true, type: true, prestations: true },
                        },
                        createdBy: {
                            select: { id: true, nom: true, prenom: true },
                        },
                    },
                }),
                database_js_1.prisma.intervention.count({ where }),
            ]);
            res.json({
                interventions,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            });
        }
        catch (error) {
            console.error('List interventions error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * GET /api/interventions/a-planifier
     */
    async aPlanifier(req, res) {
        try {
            const { days = '7' } = req.query;
            const interventions = await planning_service_js_1.default.getAPlanifier(parseInt(days));
            res.json({ interventions });
        }
        catch (error) {
            console.error('A planifier error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * GET /api/interventions/en-retard
     */
    async enRetard(req, res) {
        try {
            const interventions = await planning_service_js_1.default.getEnRetard();
            res.json({ interventions });
        }
        catch (error) {
            console.error('En retard error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * GET /api/interventions/semaine
     */
    async semaine(req, res) {
        try {
            const interventions = await planning_service_js_1.default.getSemaineCourante();
            res.json({ interventions });
        }
        catch (error) {
            console.error('Semaine error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * GET /api/interventions/:id
     */
    async get(req, res) {
        try {
            const { id } = req.params;
            const intervention = await database_js_1.prisma.intervention.findUnique({
                where: { id },
                include: {
                    client: true,
                    contrat: {
                        include: {
                            responsablePlanning: {
                                select: { id: true, nom: true, prenom: true },
                            },
                        },
                    },
                    createdBy: {
                        select: { id: true, nom: true, prenom: true, email: true },
                    },
                    updatedBy: {
                        select: { id: true, nom: true, prenom: true, email: true },
                    },
                },
            });
            if (!intervention) {
                return res.status(404).json({ error: 'Intervention non trouvée' });
            }
            res.json({ intervention });
        }
        catch (error) {
            console.error('Get intervention error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * POST /api/interventions
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
            // Si contratId fourni, vérifier qu'il existe
            if (data.contratId) {
                const contrat = await database_js_1.prisma.contrat.findUnique({
                    where: { id: data.contratId },
                });
                if (!contrat) {
                    return res.status(400).json({ error: 'Contrat non trouvé' });
                }
                if (contrat.clientId !== data.clientId) {
                    return res.status(400).json({ error: 'Le contrat n\'appartient pas à ce client' });
                }
            }
            const intervention = await database_js_1.prisma.intervention.create({
                data: {
                    contratId: data.contratId,
                    clientId: data.clientId,
                    type: data.type,
                    prestation: data.prestation,
                    datePrevue: data.datePrevue,
                    heurePrevue: data.heurePrevue,
                    duree: data.duree,
                    statut: data.statut ?? 'A_PLANIFIER',
                    notesTerrain: data.notesTerrain,
                    responsable: data.responsable,
                    createdById: req.user.id,
                },
                include: {
                    client: {
                        select: { id: true, nomEntreprise: true },
                    },
                },
            });
            // Audit log
            await (0, audit_controller_js_1.createAuditLog)(req.user.id, 'CREATE', 'Intervention', intervention.id, { after: intervention });
            res.status(201).json({ intervention });
        }
        catch (error) {
            console.error('Create intervention error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * PUT /api/interventions/:id
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const existing = await database_js_1.prisma.intervention.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Intervention non trouvée' });
            }
            const intervention = await database_js_1.prisma.intervention.update({
                where: { id },
                data: {
                    contratId: data.contratId !== undefined ? data.contratId : existing.contratId,
                    clientId: data.clientId ?? existing.clientId,
                    type: data.type ?? existing.type,
                    prestation: data.prestation ?? existing.prestation,
                    datePrevue: data.datePrevue ?? existing.datePrevue,
                    heurePrevue: data.heurePrevue !== undefined ? data.heurePrevue : existing.heurePrevue,
                    duree: data.duree !== undefined ? data.duree : existing.duree,
                    statut: data.statut ?? existing.statut,
                    notesTerrain: data.notesTerrain ?? existing.notesTerrain,
                    responsable: data.responsable !== undefined ? data.responsable : existing.responsable,
                    updatedById: req.user.id,
                },
                include: {
                    client: {
                        select: { id: true, nomEntreprise: true },
                    },
                },
            });
            // Audit log
            await (0, audit_controller_js_1.createAuditLog)(req.user.id, 'UPDATE', 'Intervention', intervention.id, {
                before: existing,
                after: intervention,
            });
            res.json({ intervention });
        }
        catch (error) {
            console.error('Update intervention error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * PUT /api/interventions/:id/realiser
     * @body dateRealisee - Date effective de réalisation (optionnel, défaut: date prévue)
     *                      La prochaine intervention sera calculée à partir de cette date
     */
    async realiser(req, res) {
        try {
            const { id } = req.params;
            const { notesTerrain, creerProchaine, dateRealisee } = req.body;
            const result = await planning_service_js_1.default.marquerRealisee(id, req.user.id, {
                notesTerrain,
                creerProchaine,
                dateRealisee: dateRealisee ? new Date(dateRealisee) : undefined,
            });
            res.json({
                intervention: result.intervention,
                nextCreated: result.nextCreated,
                nextIntervention: result.nextIntervention,
                suggestedDate: result.suggestedDate,
            });
        }
        catch (error) {
            console.error('Realiser error:', error);
            res.status(400).json({ error: error.message || 'Erreur lors de la réalisation' });
        }
    },
    /**
     * POST /api/interventions/:id/reporter
     */
    async reporter(req, res) {
        try {
            const { id } = req.params;
            const { nouvelleDatePrevue, raison } = req.body;
            if (!nouvelleDatePrevue) {
                return res.status(400).json({ error: 'Nouvelle date requise' });
            }
            const intervention = await planning_service_js_1.default.reporter(id, req.user.id, new Date(nouvelleDatePrevue), raison);
            res.json({ intervention });
        }
        catch (error) {
            console.error('Reporter error:', error);
            res.status(400).json({ error: error.message || 'Erreur lors du report' });
        }
    },
    /**
     * DELETE /api/interventions/:id
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const existing = await database_js_1.prisma.intervention.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Intervention non trouvée' });
            }
            if (existing.statut === 'REALISEE') {
                return res.status(400).json({
                    error: 'Impossible de supprimer une intervention réalisée',
                });
            }
            await database_js_1.prisma.intervention.delete({ where: { id } });
            // Audit log
            await (0, audit_controller_js_1.createAuditLog)(req.user.id, 'DELETE', 'Intervention', id);
            res.json({ message: 'Intervention supprimée' });
        }
        catch (error) {
            console.error('Delete intervention error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
};
exports.default = exports.interventionController;
//# sourceMappingURL=intervention.controller.js.map