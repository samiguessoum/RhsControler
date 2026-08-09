import csvService from '../services/csv-import.service.js';
import icsService from '../services/ics-export.service.js';
import { parseISO, endOfDay } from 'date-fns';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
export const importExportController = {
    // ============ EXPORT CSV ============
    /**
     * GET /api/export/clients
     */
    async exportClients(req, res, next) {
        try {
            const csv = await csvService.exportClients();
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=clients.csv');
            res.send('\ufeff' + csv); // BOM pour Excel
        }
        catch (error) {
            logger.error({ err: error }, 'Export clients error');
            return next(new AppError(500, 'Erreur lors de l\'export'));
        }
    },
    /**
     * GET /api/export/contrats
     */
    async exportContrats(req, res, next) {
        try {
            const csv = await csvService.exportContrats();
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=contrats.csv');
            res.send('\ufeff' + csv);
        }
        catch (error) {
            logger.error({ err: error }, 'Export contrats error');
            return next(new AppError(500, 'Erreur lors de l\'export'));
        }
    },
    /**
     * GET /api/export/interventions
     */
    async exportInterventions(req, res, next) {
        try {
            const { dateDebut, dateFin } = req.query;
            const filters = {};
            if (dateDebut)
                filters.dateDebut = parseISO(dateDebut);
            if (dateFin)
                filters.dateFin = parseISO(dateFin);
            const csv = await csvService.exportInterventions(filters);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=interventions.csv');
            res.send('\ufeff' + csv);
        }
        catch (error) {
            logger.error({ err: error }, 'Export interventions error');
            return next(new AppError(500, 'Erreur lors de l\'export'));
        }
    },
    /**
     * GET /api/export/employes
     */
    async exportEmployes(req, res, next) {
        try {
            const csv = await csvService.exportEmployes();
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=employes.csv');
            res.send('\ufeff' + csv);
        }
        catch (error) {
            logger.error({ err: error }, 'Export employes error');
            return next(new AppError(500, 'Erreur lors de l\'export'));
        }
    },
    /**
     * GET /api/export/google-calendar
     */
    async exportGoogleCalendar(req, res, next) {
        try {
            const { dateDebut, dateFin, statuts, clientId } = req.query;
            const options = {};
            if (dateDebut)
                options.dateDebut = parseISO(dateDebut);
            if (dateFin)
                options.dateFin = endOfDay(parseISO(dateFin));
            if (statuts)
                options.statuts = statuts.split(',');
            if (clientId)
                options.clientId = clientId;
            const ics = await icsService.generateICS(options);
            res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=rhs-planning.ics');
            res.send(ics);
        }
        catch (error) {
            logger.error({ err: error }, 'Export Google Calendar error');
            return next(new AppError(500, 'Erreur lors de l\'export'));
        }
    },
    // ============ TEMPLATES CSV ============
    /**
     * GET /api/import/templates/:type
     */
    async getTemplate(req, res, next) {
        try {
            const { type } = req.params;
            const templates = {
                employes: {
                    filename: 'template_employes.csv',
                    content: `prenom,nom,postes
Ahmed,Karim,CHAUFFEUR
Sonia,Meziane,APPLICATEUR
Nadia,Benali,"CHAUFFEUR,APPLICATEUR"
Yacine,Amrani,ADMINISTRATION`,
                },
                clients: {
                    filename: 'template_clients.csv',
                    content: `nom_entreprise,siege_nom,siege_adresse,siege_contact_nom,siege_contact_fonction,siege_contact_tel,siege_contact_email,siege_tel,siege_email,siege_notes,siege_rc,siege_nif,siege_ai,siege_nis,siege_tin,site_nom,site_adresse,secteur,contact_nom,contact_fonction,tel,email,notes
"SARL Exemple","Siège Alger","1 Rue Principale, Alger","Ahmed Benali","Directeur Qualité","+213 555 123456","contact@exemple.dz","+213 555 000000","siege@exemple.dz","Siège principal","RC123","NIF123","AI123","NIS123","TIN123","Site 1","Zone Industrielle Oued Smar","Agroalimentaire","Ahmed Benali","Directeur Qualité","+213 555 123456","ahmed@exemple.dz","Client prioritaire"
"EURL Test","Siège Oran","12 Avenue Oran","Karim Hadj","Responsable Hygiène","+213 555 654321","contact@test.dz","+213 555 111111","siege@test.dz","","RC456","NIF456","AI456","NIS456","TIN456","Site 1","Rue des Palmiers, Alger","Pharmaceutique","Karim Hadj","Responsable Hygiène","+213 555 654321","karim@test.dz",""`,
                },
                contrats: {
                    filename: 'template_contrats.csv',
                    content: `client_nom,type,date_debut,date_fin,reconduction_auto,prestations,frequence_operations,jours_personnalises,frequence_controle,premiere_date_operation,premiere_date_controle,statut
"SARL Exemple","ANNUEL","2024-01-01","2024-12-31","true","dératisation,désinsectisation","MENSUELLE","","TRIMESTRIELLE","2024-01-15","2024-03-15","ACTIF"
"EURL Test","PONCTUEL","2024-02-01","","false","3D","","","","2024-02-15","","ACTIF"`,
                },
                interventions: {
                    filename: 'template_interventions.csv',
                    content: `client_nom,contrat_ref,type,prestation,date_prevue,heure_prevue,duree_minutes,statut,notes
"SARL Exemple","","OPERATION","dératisation","2024-02-15","09:00","60","PLANIFIEE","Accès par portail sud"
"SARL Exemple","","CONTROLE","","2024-03-15","14:00","30","A_PLANIFIER","Contrôle trimestriel"`,
                },
            };
            const template = templates[type];
            if (!template) {
                return res.status(404).json({ error: 'Template non trouvé' });
            }
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=${template.filename}`);
            res.send('\ufeff' + template.content);
        }
        catch (error) {
            logger.error({ err: error }, 'Get template error');
            return next(new AppError(500, 'Erreur serveur'));
        }
    },
    // ============ IMPORT ============
    /**
     * POST /api/import/preview
     */
    async preview(req, res, next) {
        try {
            const { type, content } = req.body;
            if (!type || !content) {
                return res.status(400).json({ error: 'Type et contenu requis' });
            }
            let result;
            switch (type) {
                case 'clients':
                    result = await csvService.previewClients(content);
                    break;
                case 'contrats':
                    result = await csvService.previewContrats(content);
                    break;
                case 'interventions':
                    result = await csvService.previewInterventions(content);
                    break;
                case 'employes':
                    result = await csvService.previewEmployes(content);
                    break;
                default:
                    return res.status(400).json({ error: 'Type invalide (clients, contrats, interventions, employes)' });
            }
            res.json(result);
        }
        catch (error) {
            logger.error({ err: error }, 'Preview error');
            res.status(400).json({ error: error.message || 'Erreur lors de l\'analyse du fichier' });
        }
    },
    /**
     * POST /api/import/execute
     */
    async execute(req, res, next) {
        try {
            const { type, content } = req.body;
            if (!type || !content) {
                return res.status(400).json({ error: 'Type et contenu requis' });
            }
            let result;
            switch (type) {
                case 'clients':
                    result = await csvService.importClients(content);
                    break;
                case 'contrats':
                    result = await csvService.importContrats(content, req.user.id);
                    break;
                case 'interventions':
                    result = await csvService.importInterventions(content, req.user.id);
                    break;
                case 'employes':
                    result = await csvService.importEmployes(content);
                    break;
                default:
                    return res.status(400).json({ error: 'Type invalide (clients, contrats, interventions, employes)' });
            }
            if (!result.success) {
                return res.status(400).json({
                    error: 'Erreurs lors de l\'import',
                    errors: result.errors,
                });
            }
            res.json({
                message: `Import réussi: ${result.created} créé(s), ${result.updated} mis à jour`,
                created: result.created,
                updated: result.updated,
            });
        }
        catch (error) {
            logger.error({ err: error }, 'Import execute error');
            res.status(400).json({ error: error.message || 'Erreur lors de l\'import' });
        }
    },
};
export default importExportController;
//# sourceMappingURL=import-export.controller.js.map