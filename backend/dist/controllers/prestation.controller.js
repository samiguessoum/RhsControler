"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prestationController = void 0;
const database_js_1 = require("../config/database.js");
exports.prestationController = {
    /**
     * GET /api/prestations
     */
    async list(req, res) {
        try {
            const { actif } = req.query;
            const where = {};
            if (actif !== undefined) {
                where.actif = actif === 'true';
            }
            const prestations = await database_js_1.prisma.prestation.findMany({
                where,
                orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
            });
            res.json({ prestations });
        }
        catch (error) {
            console.error('List prestations error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * POST /api/prestations
     */
    async create(req, res) {
        try {
            const { nom, ordre, description } = req.body;
            // Vérifier unicité du nom
            const existing = await database_js_1.prisma.prestation.findUnique({
                where: { nom },
            });
            if (existing) {
                return res.status(400).json({ error: 'Cette prestation existe déjà' });
            }
            // Ordre par défaut = max + 1
            let ordreValue = ordre;
            if (ordreValue === undefined) {
                const maxOrdre = await database_js_1.prisma.prestation.aggregate({
                    _max: { ordre: true },
                });
                ordreValue = (maxOrdre._max.ordre || 0) + 1;
            }
            const prestation = await database_js_1.prisma.prestation.create({
                data: { nom, ordre: ordreValue, description },
            });
            res.status(201).json({ prestation });
        }
        catch (error) {
            console.error('Create prestation error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * PUT /api/prestations/:id
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const { nom, ordre, actif, description } = req.body;
            const existing = await database_js_1.prisma.prestation.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Prestation non trouvée' });
            }
            // Vérifier unicité du nom si modifié
            if (nom && nom !== existing.nom) {
                const duplicate = await database_js_1.prisma.prestation.findUnique({
                    where: { nom },
                });
                if (duplicate) {
                    return res.status(400).json({ error: 'Cette prestation existe déjà' });
                }
            }
            const prestation = await database_js_1.prisma.prestation.update({
                where: { id },
                data: {
                    nom: nom ?? existing.nom,
                    ordre: ordre ?? existing.ordre,
                    actif: actif ?? existing.actif,
                    description: description ?? existing.description,
                },
            });
            res.json({ prestation });
        }
        catch (error) {
            console.error('Update prestation error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
    /**
     * DELETE /api/prestations/:id (désactivation)
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const existing = await database_js_1.prisma.prestation.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Prestation non trouvée' });
            }
            await database_js_1.prisma.prestation.delete({
                where: { id },
            });
            res.json({ message: 'Prestation supprimée' });
        }
        catch (error) {
            console.error('Delete prestation error:', error);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    },
};
exports.default = exports.prestationController;
//# sourceMappingURL=prestation.controller.js.map