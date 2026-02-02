import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole, canDo } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  loginSchema,
  createUserSchema,
  updateUserSchema,
  createClientSchema,
  updateClientSchema,
  createPrestationSchema,
  updatePrestationSchema,
  createPosteSchema,
  updatePosteSchema,
  createEmployeSchema,
  updateEmployeSchema,
  createContratSchema,
  updateContratSchema,
  createInterventionSchema,
  updateInterventionSchema,
  realiserInterventionSchema,
  reporterInterventionSchema,
  createProduitSchema,
  updateProduitSchema,
  createMouvementSchema,
  createCongeSchema,
  approuverCongeSchema,
  createWeekendTravailleSchema,
  updateSoldeSchema,
  // Tiers
  createTiersSchema,
  updateTiersSchema,
  createContactSchema,
  updateContactSchema,
  createAdresseSchema,
  updateAdresseSchema,
  createCompteBancaireSchema,
  updateCompteBancaireSchema,
  createModePaiementSchema,
  createConditionPaiementSchema,
  // Sites
  createSiteSchema,
  updateSiteSchema,
  createSiteContactSchema,
  updateSiteContactSchema,
} from '../validators/schemas.js';

import authController from '../controllers/auth.controller.js';
import userController from '../controllers/user.controller.js';
import clientController from '../controllers/client.controller.js';
import prestationController from '../controllers/prestation.controller.js';
import employeController from '../controllers/employe.controller.js';
import posteController from '../controllers/poste.controller.js';
import contratController from '../controllers/contrat.controller.js';
import interventionController from '../controllers/intervention.controller.js';
import dashboardController from '../controllers/dashboard.controller.js';
import importExportController from '../controllers/import-export.controller.js';
import stockController from '../controllers/stock.controller.js';
import rhController from '../controllers/rh.controller.js';
import tiersController from '../controllers/tiers.controller.js';

const router = Router();

// ============ AUTH (public) ============
router.post('/auth/login', validate(loginSchema), authController.login);

// ============ AUTH (protected) ============
router.get('/auth/me', authMiddleware, authController.me);
router.post('/auth/logout', authMiddleware, authController.logout);
router.post('/auth/change-password', authMiddleware, authController.changePassword);

// ============ USERS (DIRECTION only) ============
router.get('/users', authMiddleware, canDo('manageUsers'), userController.list);
router.get('/users/:id', authMiddleware, canDo('manageUsers'), userController.get);
router.post('/users', authMiddleware, canDo('manageUsers'), validate(createUserSchema), userController.create);
router.put('/users/:id', authMiddleware, canDo('manageUsers'), validate(updateUserSchema), userController.update);
router.delete('/users/:id', authMiddleware, canDo('manageUsers'), userController.delete);

// ============ CLIENTS ============
router.get('/clients', authMiddleware, clientController.list);
router.get('/clients/:id', authMiddleware, clientController.get);
router.post('/clients', authMiddleware, canDo('createClient'), validate(createClientSchema), clientController.create);
router.put('/clients/:id', authMiddleware, canDo('editClient'), validate(updateClientSchema), clientController.update);
router.delete('/clients/:id', authMiddleware, canDo('deleteClient'), clientController.delete);

// ============ PRESTATIONS ============
router.get('/prestations', authMiddleware, prestationController.list);
router.post('/prestations', authMiddleware, canDo('managePrestations'), validate(createPrestationSchema), prestationController.create);
router.put('/prestations/:id', authMiddleware, canDo('managePrestations'), validate(updatePrestationSchema), prestationController.update);
router.delete('/prestations/:id', authMiddleware, canDo('managePrestations'), prestationController.delete);

// Employés
router.get('/employes', authMiddleware, canDo('viewEmployes'), employeController.list);
router.get('/employes/:id', authMiddleware, canDo('viewEmployes'), employeController.get);
router.post('/employes', authMiddleware, canDo('manageEmployes'), validate(createEmployeSchema), employeController.create);
router.put('/employes/:id', authMiddleware, canDo('manageEmployes'), validate(updateEmployeSchema), employeController.update);
router.delete('/employes/:id', authMiddleware, canDo('manageEmployes'), employeController.delete);

// Postes
router.get('/postes', authMiddleware, canDo('viewPostes'), posteController.list);
router.get('/postes/:id', authMiddleware, canDo('viewPostes'), posteController.get);
router.post('/postes', authMiddleware, canDo('managePostes'), validate(createPosteSchema), posteController.create);
router.put('/postes/:id', authMiddleware, canDo('managePostes'), validate(updatePosteSchema), posteController.update);
router.delete('/postes/:id', authMiddleware, canDo('managePostes'), posteController.delete);

// ============ CONTRATS ============
router.get('/contrats', authMiddleware, contratController.list);
router.get('/contrats/:id', authMiddleware, contratController.get);
router.post('/contrats', authMiddleware, canDo('createContrat'), validate(createContratSchema), contratController.create);
router.put('/contrats/:id', authMiddleware, canDo('editContrat'), validate(updateContratSchema), contratController.update);
router.delete('/contrats/:id', authMiddleware, canDo('deleteContrat'), contratController.delete);

// ============ INTERVENTIONS ============
router.get('/interventions', authMiddleware, interventionController.list);
router.get('/interventions/a-planifier', authMiddleware, interventionController.aPlanifier);
router.get('/interventions/en-retard', authMiddleware, interventionController.enRetard);
router.get('/interventions/semaine', authMiddleware, interventionController.semaine);
router.get('/interventions/last-notes/:clientId', authMiddleware, interventionController.getLastNotes);
router.get('/interventions/:id', authMiddleware, interventionController.get);
router.post('/interventions', authMiddleware, canDo('createIntervention'), validate(createInterventionSchema), interventionController.create);
router.put('/interventions/:id', authMiddleware, canDo('editIntervention'), validate(updateInterventionSchema), interventionController.update);
router.put('/interventions/:id/realiser', authMiddleware, canDo('realiserIntervention'), validate(realiserInterventionSchema), interventionController.realiser);
router.post('/interventions/:id/reporter', authMiddleware, canDo('editIntervention'), validate(reporterInterventionSchema), interventionController.reporter);
router.delete('/interventions/:id', authMiddleware, canDo('deleteIntervention'), interventionController.delete);

// ============ DASHBOARD ============
router.get('/dashboard/stats', authMiddleware, dashboardController.stats);
router.get('/dashboard/alertes', authMiddleware, dashboardController.alertes);

// ============ IMPORT/EXPORT ============
router.get('/export/clients', authMiddleware, canDo('exportData'), importExportController.exportClients);
router.get('/export/contrats', authMiddleware, canDo('exportData'), importExportController.exportContrats);
router.get('/export/interventions', authMiddleware, canDo('exportData'), importExportController.exportInterventions);
router.get('/export/employes', authMiddleware, canDo('exportData'), importExportController.exportEmployes);
router.get('/export/google-calendar', authMiddleware, canDo('exportData'), importExportController.exportGoogleCalendar);
router.get('/import/templates/:type', authMiddleware, importExportController.getTemplate);
router.post('/import/preview', authMiddleware, canDo('importData'), importExportController.preview);
router.post('/import/execute', authMiddleware, canDo('importData'), importExportController.execute);

// ============ STOCK ============
router.get('/produits', authMiddleware, stockController.listProduits);
router.get('/produits/:id', authMiddleware, stockController.getProduit);
router.post('/produits', authMiddleware, canDo('manageStock'), validate(createProduitSchema), stockController.createProduit);
router.put('/produits/:id', authMiddleware, canDo('manageStock'), validate(updateProduitSchema), stockController.updateProduit);
router.delete('/produits/:id', authMiddleware, canDo('manageStock'), stockController.deleteProduit);

router.get('/mouvements-stock', authMiddleware, stockController.listMouvements);
router.post('/mouvements-stock', authMiddleware, canDo('manageStock'), validate(createMouvementSchema), stockController.createMouvement);

router.get('/stock/alertes', authMiddleware, stockController.getAlertes);
router.get('/stock/stats', authMiddleware, stockController.getStats);

// ============ RH ============
router.get('/rh/dashboard', authMiddleware, canDo('viewRH'), rhController.getDashboard);

// Congés
router.get('/rh/conges', authMiddleware, canDo('viewRH'), rhController.listConges);
router.post('/rh/conges', authMiddleware, canDo('viewRH'), validate(createCongeSchema), rhController.createConge);
router.put('/rh/conges/:id/approuver', authMiddleware, canDo('manageRH'), validate(approuverCongeSchema), rhController.approuverConge);
router.delete('/rh/conges/:id', authMiddleware, canDo('manageRH'), rhController.annulerConge);

// Weekend travaillés
router.get('/rh/weekend-travailles', authMiddleware, canDo('viewRH'), rhController.listWeekendTravailles);
router.post('/rh/weekend-travailles', authMiddleware, canDo('manageRH'), validate(createWeekendTravailleSchema), rhController.createWeekendTravaille);
router.delete('/rh/weekend-travailles/:id', authMiddleware, canDo('manageRH'), rhController.deleteWeekendTravaille);

// Soldes
router.get('/rh/soldes', authMiddleware, canDo('viewRH'), rhController.getSoldes);
router.put('/rh/soldes', authMiddleware, canDo('manageRH'), validate(updateSoldeSchema), rhController.updateSolde);

// Récap employé
router.get('/rh/employes/:id/recap', authMiddleware, canDo('viewRH'), rhController.getEmployeRecap);

// ============ TIERS (Dolibarr-style) ============
router.get('/tiers/stats', authMiddleware, tiersController.getStats);
router.get('/tiers', authMiddleware, tiersController.list);
router.get('/tiers/:id', authMiddleware, tiersController.get);
router.post('/tiers', authMiddleware, canDo('createClient'), validate(createTiersSchema), tiersController.create);
router.put('/tiers/:id', authMiddleware, canDo('editClient'), validate(updateTiersSchema), tiersController.update);
router.delete('/tiers/:id', authMiddleware, canDo('deleteClient'), tiersController.delete);
router.post('/tiers/:id/convertir', authMiddleware, canDo('editClient'), tiersController.convertirProspect);

// Contacts d'un tiers
router.post('/tiers/:id/contacts', authMiddleware, canDo('editClient'), validate(createContactSchema), tiersController.addContact);
router.put('/tiers/:tiersId/contacts/:id', authMiddleware, canDo('editClient'), validate(updateContactSchema), tiersController.updateContact);
router.delete('/tiers/:tiersId/contacts/:id', authMiddleware, canDo('editClient'), tiersController.deleteContact);

// Adresses d'un tiers
router.post('/tiers/:id/adresses', authMiddleware, canDo('editClient'), validate(createAdresseSchema), tiersController.addAdresse);
router.put('/tiers/:tiersId/adresses/:id', authMiddleware, canDo('editClient'), validate(updateAdresseSchema), tiersController.updateAdresse);
router.delete('/tiers/:tiersId/adresses/:id', authMiddleware, canDo('editClient'), tiersController.deleteAdresse);

// Comptes bancaires d'un tiers
router.post('/tiers/:id/comptes-bancaires', authMiddleware, canDo('editClient'), validate(createCompteBancaireSchema), tiersController.addCompteBancaire);
router.put('/tiers/:tiersId/comptes-bancaires/:id', authMiddleware, canDo('editClient'), validate(updateCompteBancaireSchema), tiersController.updateCompteBancaire);
router.delete('/tiers/:tiersId/comptes-bancaires/:id', authMiddleware, canDo('editClient'), tiersController.deleteCompteBancaire);

// Sites d'un tiers
router.get('/tiers/:id/sites', authMiddleware, tiersController.listSites);
router.post('/tiers/:id/sites', authMiddleware, canDo('editClient'), validate(createSiteSchema), tiersController.addSite);

// Sites (routes directes)
router.get('/sites/:id', authMiddleware, tiersController.getSite);
router.put('/sites/:id', authMiddleware, canDo('editClient'), validate(updateSiteSchema), tiersController.updateSite);
router.delete('/sites/:id', authMiddleware, canDo('editClient'), tiersController.deleteSite);

// Contacts d'un site
router.post('/sites/:id/contacts', authMiddleware, canDo('editClient'), validate(createSiteContactSchema), tiersController.addSiteContact);
router.put('/sites/:siteId/contacts/:id', authMiddleware, canDo('editClient'), validate(updateSiteContactSchema), tiersController.updateSiteContact);
router.delete('/sites/:siteId/contacts/:id', authMiddleware, canDo('editClient'), tiersController.deleteSiteContact);

// Référentiels
router.get('/modes-paiement', authMiddleware, tiersController.listModesPaiement);
router.post('/modes-paiement', authMiddleware, canDo('manageSettings'), validate(createModePaiementSchema), tiersController.createModePaiement);
router.get('/conditions-paiement', authMiddleware, tiersController.listConditionsPaiement);
router.post('/conditions-paiement', authMiddleware, canDo('manageSettings'), validate(createConditionPaiementSchema), tiersController.createConditionPaiement);

export default router;
