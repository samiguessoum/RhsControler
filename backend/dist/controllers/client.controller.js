import { prisma } from '../config/database.js';
import { createAuditLog } from './audit.controller.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
export const clientController = {
    /**
     * GET /api/clients
     */
    async list(req, res, next) {
        try {
            const { search, actif, page = '1', limit = '20' } = req.query;
            const where = {};
            if (actif !== undefined) {
                where.actif = actif === 'true';
            }
            if (search) {
                where.OR = [
                    { nomEntreprise: { contains: search, mode: 'insensitive' } },
                    {
                        sites: {
                            some: {
                                OR: [
                                    { nom: { contains: search, mode: 'insensitive' } },
                                    { adresse: { contains: search, mode: 'insensitive' } },
                                    { email: { contains: search, mode: 'insensitive' } },
                                    { tel: { contains: search, mode: 'insensitive' } },
                                ],
                            },
                        },
                    },
                    {
                        sites: {
                            some: {
                                contacts: {
                                    some: {
                                        OR: [
                                            { nom: { contains: search, mode: 'insensitive' } },
                                            { fonction: { contains: search, mode: 'insensitive' } },
                                            { tel: { contains: search, mode: 'insensitive' } },
                                            { email: { contains: search, mode: 'insensitive' } },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                    {
                        siegeContacts: {
                            some: {
                                OR: [
                                    { nom: { contains: search, mode: 'insensitive' } },
                                    { fonction: { contains: search, mode: 'insensitive' } },
                                    { tel: { contains: search, mode: 'insensitive' } },
                                    { email: { contains: search, mode: 'insensitive' } },
                                ],
                            },
                        },
                    },
                ];
            }
            const pageNum = parseInt(page) || 1;
            const limitNum = Math.min(parseInt(limit) || 20, 100);
            const skip = (pageNum - 1) * limitNum;
            const [clients, total] = await Promise.all([
                prisma.client.findMany({
                    where,
                    skip,
                    take: limitNum,
                    orderBy: { nomEntreprise: 'asc' },
                    include: {
                        siegeContacts: true,
                        sites: { include: { contacts: true } },
                        _count: {
                            select: { contrats: true, interventions: true },
                        },
                    },
                }),
                prisma.client.count({ where }),
            ]);
            res.json({
                clients,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            });
        }
        catch (error) {
            logger.error({ err: error }, 'List clients error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    /**
     * GET /api/clients/:id
     */
    async get(req, res, next) {
        try {
            const { id } = req.params;
            const client = await prisma.client.findUnique({
                where: { id },
                include: {
                    siegeContacts: true,
                    sites: { include: { contacts: true } },
                    contrats: {
                        orderBy: { dateDebut: 'desc' },
                        include: {
                            responsablePlanning: {
                                select: { id: true, nom: true, prenom: true },
                            },
                        },
                    },
                    interventions: {
                        orderBy: { datePrevue: 'desc' },
                        take: 20,
                    },
                },
            });
            if (!client) {
                return res.status(404).json({ error: 'Client non trouvé' });
            }
            res.json({ client });
        }
        catch (error) {
            logger.error({ err: error }, 'Get client error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    /**
     * POST /api/clients
     */
    async create(req, res, next) {
        try {
            const data = req.body;
            const mappedSites = (data.sites || []).map((site) => ({
                code: site.code,
                nom: site.nom,
                adresse: site.adresse,
                complement: site.complement,
                codePostal: site.codePostal,
                ville: site.ville,
                pays: site.pays,
                latitude: site.latitude,
                longitude: site.longitude,
                tel: site.tel,
                fax: site.fax,
                email: site.email || null,
                horairesOuverture: site.horairesOuverture,
                accessibilite: site.accessibilite,
                notes: site.notes,
                ...(site.contacts?.length
                    ? { contacts: { create: site.contacts } }
                    : {}),
            }));
            const client = await prisma.client.create({
                data: {
                    nomEntreprise: data.nomEntreprise,
                    secteur: data.secteur,
                    siegeNom: data.siegeNom,
                    siegeAdresse: data.siegeAdresse,
                    siegeTel: data.siegeTel,
                    siegeEmail: data.siegeEmail || null,
                    siegeNotes: data.siegeNotes,
                    siegeRC: data.siegeRC,
                    siegeNIF: data.siegeNIF,
                    siegeAI: data.siegeAI,
                    siegeNIS: data.siegeNIS,
                    siegeNIN: data.siegeNIN,
                    siegeTIN: data.siegeTIN,
                    siegeContacts: {
                        create: data.siegeContacts || [],
                    },
                    sites: {
                        create: mappedSites,
                    },
                },
                include: { sites: { include: { contacts: true } }, siegeContacts: true },
            });
            // Audit log
            await createAuditLog(req.user.id, 'CREATE', 'Client', client.id, { after: client });
            res.status(201).json({ client });
        }
        catch (error) {
            logger.error({ err: error }, 'Create client error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    /**
     * PUT /api/clients/:id
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const data = req.body;
            const existing = await prisma.client.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ error: 'Client non trouvé' });
            }
            const mappedSites = data.sites
                ? data.sites.map((site) => ({
                    code: site.code,
                    nom: site.nom,
                    adresse: site.adresse,
                    complement: site.complement,
                    codePostal: site.codePostal,
                    ville: site.ville,
                    pays: site.pays,
                    latitude: site.latitude,
                    longitude: site.longitude,
                    tel: site.tel,
                    fax: site.fax,
                    email: site.email || null,
                    horairesOuverture: site.horairesOuverture,
                    accessibilite: site.accessibilite,
                    notes: site.notes,
                    ...(site.contacts?.length
                        ? { contacts: { create: site.contacts } }
                        : {}),
                }))
                : null;
            const client = await prisma.client.update({
                where: { id },
                data: {
                    nomEntreprise: data.nomEntreprise ?? existing.nomEntreprise,
                    secteur: data.secteur ?? existing.secteur,
                    siegeNom: data.siegeNom ?? existing.siegeNom,
                    siegeAdresse: data.siegeAdresse ?? existing.siegeAdresse,
                    siegeTel: data.siegeTel ?? existing.siegeTel,
                    siegeEmail: data.siegeEmail ?? existing.siegeEmail,
                    siegeNotes: data.siegeNotes ?? existing.siegeNotes,
                    siegeRC: data.siegeRC ?? existing.siegeRC,
                    siegeNIF: data.siegeNIF ?? existing.siegeNIF,
                    siegeAI: data.siegeAI ?? existing.siegeAI,
                    siegeNIS: data.siegeNIS ?? existing.siegeNIS,
                    siegeNIN: data.siegeNIN ?? existing.siegeNIN,
                    siegeTIN: data.siegeTIN ?? existing.siegeTIN,
                    actif: data.actif ?? existing.actif,
                    ...(data.siegeContacts
                        ? {
                            siegeContacts: {
                                deleteMany: {},
                                create: data.siegeContacts,
                            },
                        }
                        : {}),
                    ...(mappedSites
                        ? {
                            sites: {
                                deleteMany: {},
                                create: mappedSites,
                            },
                        }
                        : {}),
                },
                include: { sites: { include: { contacts: true } }, siegeContacts: true },
            });
            // Audit log
            await createAuditLog(req.user.id, 'UPDATE', 'Client', client.id, {
                before: existing,
                after: client,
            });
            res.json({ client });
        }
        catch (error) {
            logger.error({ err: error }, 'Update client error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    /**
     * DELETE /api/clients/:id (désactivation)
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const existing = await prisma.client.findUnique({
                where: { id },
            });
            if (!existing) {
                return res.status(404).json({ error: 'Client non trouvé' });
            }
            await prisma.$transaction([
                prisma.intervention.deleteMany({ where: { clientId: id } }),
                prisma.contratSite.deleteMany({ where: { contrat: { clientId: id } } }),
                prisma.contrat.deleteMany({ where: { clientId: id } }),
                prisma.site.deleteMany({ where: { clientId: id } }),
                prisma.siegeContact.deleteMany({ where: { clientId: id } }),
                prisma.client.delete({ where: { id } }),
            ]);
            // Audit log
            await createAuditLog(req.user.id, 'DELETE', 'Client', id);
            res.json({ message: 'Client supprimé' });
        }
        catch (error) {
            logger.error({ err: error }, 'Delete client error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
};
export default clientController;
//# sourceMappingURL=client.controller.js.map