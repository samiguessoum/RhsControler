import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
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
  async exportClients(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const csv = await csvService.exportClients();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=clients.csv');
      res.send('\ufeff' + csv); // BOM pour Excel
    } catch (error) {
      logger.error({ err: error }, 'Export clients error');
      return next(new AppError(500, 'Erreur lors de l\'export'));
    }
  },

  /**
   * GET /api/export/contrats
   */
  async exportContrats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const csv = await csvService.exportContrats();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=contrats.csv');
      res.send('\ufeff' + csv);
    } catch (error) {
      logger.error({ err: error }, 'Export contrats error');
      return next(new AppError(500, 'Erreur lors de l\'export'));
    }
  },

  /**
   * GET /api/export/interventions
   */
  async exportInterventions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { dateDebut, dateFin } = req.query;

      const filters: any = {};
      if (dateDebut) filters.dateDebut = parseISO(dateDebut as string);
      if (dateFin) filters.dateFin = parseISO(dateFin as string);

      const csv = await csvService.exportInterventions(filters);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=interventions.csv');
      res.send('\ufeff' + csv);
    } catch (error) {
      logger.error({ err: error }, 'Export interventions error');
      return next(new AppError(500, 'Erreur lors de l\'export'));
    }
  },

  /**
   * GET /api/export/employes
   */
  async exportEmployes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const csv = await csvService.exportEmployes();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=employes.csv');
      res.send('\ufeff' + csv);
    } catch (error) {
      logger.error({ err: error }, 'Export employes error');
      return next(new AppError(500, 'Erreur lors de l\'export'));
    }
  },

  /**
   * GET /api/export/google-calendar
   */
  async exportGoogleCalendar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { dateDebut, dateFin, statuts, clientId } = req.query;

      const options: any = {};
      if (dateDebut) options.dateDebut = parseISO(dateDebut as string);
      if (dateFin) options.dateFin = endOfDay(parseISO(dateFin as string));
      if (statuts) options.statuts = (statuts as string).split(',');
      if (clientId) options.clientId = clientId;

      const ics = await icsService.generateICS(options);

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=rhs-planning.ics');
      res.send(ics);
    } catch (error) {
      logger.error({ err: error }, 'Export Google Calendar error');
      return next(new AppError(500, 'Erreur lors de l\'export'));
    }
  },

  // ============ TEMPLATES CSV ============

  /**
   * GET /api/import/templates/:type
   */
  async getTemplate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { type } = req.params;

      const templates: Record<string, { filename: string; content: string }> = {
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
          content: `nom_entreprise,siege_nom,siege_adresse,siege_code_postal,siege_ville,siege_pays,siege_contact_nom,siege_contact_fonction,siege_contact_tel,siege_contact_email,siege_tel,siege_email,siege_notes,siege_rc,siege_nif,siege_ai,siege_nis,siege_tin,site_code,site_nom,site_adresse,site_complement,site_code_postal,site_ville,site_pays,secteur,contact_nom,contact_fonction,tel,fax,email,horaires_ouverture,accessibilite,notes
"SARL Exemple","Siège Alger","1 Rue Principale","16000","Alger","Algérie","Ahmed Benali","Directeur Qualité","+213 555 123456","contact@exemple.dz","+213 555 000000","siege@exemple.dz","Siège principal","RC123","NIF123","AI123","NIS123","TIN123","SITE001","Site 1","Zone Industrielle Oued Smar","Lot 12","16270","Oued Smar","Algérie","Agroalimentaire","Ahmed Benali","Directeur Qualité","+213 555 123456","","ahmed@exemple.dz","Lun-Ven 8h-17h","Parking disponible","Client prioritaire"
"EURL Test","Siège Oran","12 Avenue Oran","31000","Oran","Algérie","Karim Hadj","Responsable Hygiène","+213 555 654321","contact@test.dz","+213 555 111111","siege@test.dz","","RC456","NIF456","AI456","NIS456","TIN456","","Site 1","Rue des Palmiers, Alger","","16000","Alger","Algérie","Pharmaceutique","Karim Hadj","Responsable Hygiène","+213 555 654321","","karim@test.dz","","",""`,
        },
        contrats: {
          filename: 'template_contrats.csv',
          content: `client_nom,type,date_debut,date_fin,reconduction_auto,prestations,frequence_operations_jours,frequence_controle_jours,premiere_date_operation,premiere_date_controle,statut
"SARL Exemple","ANNUEL","2024-01-01","2024-12-31","true","dératisation,désinsectisation","30","90","2024-01-15","2024-03-15","ACTIF"
"EURL Test","PONCTUEL","2024-02-01","","false","3D","","","2024-02-15","","ACTIF"`,
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
    } catch (error) {
      logger.error({ err: error }, 'Get template error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  // ============ IMPORT ============

  /**
   * POST /api/import/preview
   */
  async preview(req: AuthRequest, res: Response, next: NextFunction) {
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
    } catch (error: any) {
      logger.error({ err: error }, 'Preview error');
      res.status(400).json({ error: error.message || 'Erreur lors de l\'analyse du fichier' });
    }
  },

  /**
   * POST /api/import/execute
   */
  async execute(req: AuthRequest, res: Response, next: NextFunction) {
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
          result = await csvService.importContrats(content, req.user!.id);
          break;
        case 'interventions':
          result = await csvService.importInterventions(content, req.user!.id);
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
    } catch (error: any) {
      logger.error({ err: error }, 'Import execute error');
      res.status(400).json({ error: error.message || 'Erreur lors de l\'import' });
    }
  },
};

export default importExportController;
