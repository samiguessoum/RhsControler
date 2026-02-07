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
  // Produits/Services (Dolibarr-style)
  createProduitServiceSchema,
  updateProduitServiceSchema,
  createCategorieProduitSchema,
  updateCategorieProduitSchema,
  createEntrepotSchema,
  updateEntrepotSchema,
  createPrixFournisseurSchema,
  updatePrixFournisseurSchema,
  createPrixClientSchema,
  updatePrixClientSchema,
  createMouvementProduitServiceSchema,
  // Commerce
  createDevisSchema,
  updateDevisSchema,
  createCommandeSchema,
  updateCommandeSchema,
  createFactureSchema,
  updateFactureSchema,
  createPaiementSchema,
  createFactureRelanceSchema,
  // Commandes Fournisseurs
  createCommandeFournisseurSchema,
  updateCommandeFournisseurSchema,
  receptionCommandeFournisseurSchema,
  // Facturation
  createFactureFournisseurSchema,
  updateFactureFournisseurSchema,
  createPaiementFournisseurSchema,
  createChargeSchema,
  updateChargeSchema,
  createPaiementChargeSchema,
  createPaiementDiversSchema,
  updatePaiementDiversSchema,
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
import produitsServicesController from '../controllers/produits-services.controller.js';
import commerceController from '../controllers/commerce.controller.js';
import commandeFournisseurController from '../controllers/commande-fournisseur.controller.js';
import factureFournisseurController from '../controllers/facture-fournisseur.controller.js';
import chargeController from '../controllers/charge.controller.js';
import paiementDiversController from '../controllers/paiement-divers.controller.js';
import facturationStatsController from '../controllers/facturation-stats.controller.js';

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

// ============ PRODUITS/SERVICES (Dolibarr-style) ============
router.get('/produits-services/stats', authMiddleware, produitsServicesController.getStats);
router.get('/produits-services/alertes', authMiddleware, produitsServicesController.getAlertes);
router.get('/produits-services', authMiddleware, produitsServicesController.list);
router.get('/produits-services/:id', authMiddleware, produitsServicesController.get);
router.post('/produits-services', authMiddleware, canDo('manageStock'), validate(createProduitServiceSchema), produitsServicesController.create);
router.put('/produits-services/:id', authMiddleware, canDo('manageStock'), validate(updateProduitServiceSchema), produitsServicesController.update);
router.delete('/produits-services/:id', authMiddleware, canDo('manageStock'), produitsServicesController.delete);
router.post('/produits-services/:id/mouvement', authMiddleware, canDo('manageStock'), validate(createMouvementProduitServiceSchema), produitsServicesController.createMouvementProduitService);

// Catégories de produits
router.get('/categories-produits', authMiddleware, produitsServicesController.listCategories);
router.get('/categories-produits/:id', authMiddleware, produitsServicesController.getCategorie);
router.post('/categories-produits', authMiddleware, canDo('manageStock'), validate(createCategorieProduitSchema), produitsServicesController.createCategorie);
router.put('/categories-produits/:id', authMiddleware, canDo('manageStock'), validate(updateCategorieProduitSchema), produitsServicesController.updateCategorie);
router.delete('/categories-produits/:id', authMiddleware, canDo('manageStock'), produitsServicesController.deleteCategorie);

// Entrepôts
router.get('/entrepots', authMiddleware, produitsServicesController.listEntrepots);
router.get('/entrepots/:id', authMiddleware, produitsServicesController.getEntrepot);
router.post('/entrepots', authMiddleware, canDo('manageStock'), validate(createEntrepotSchema), produitsServicesController.createEntrepot);
router.put('/entrepots/:id', authMiddleware, canDo('manageStock'), validate(updateEntrepotSchema), produitsServicesController.updateEntrepot);
router.delete('/entrepots/:id', authMiddleware, canDo('manageStock'), produitsServicesController.deleteEntrepot);

// Prix fournisseurs
router.get('/prix-fournisseurs', authMiddleware, produitsServicesController.listPrixFournisseurs);
router.post('/prix-fournisseurs', authMiddleware, canDo('manageStock'), validate(createPrixFournisseurSchema), produitsServicesController.createPrixFournisseur);
router.put('/prix-fournisseurs/:id', authMiddleware, canDo('manageStock'), validate(updatePrixFournisseurSchema), produitsServicesController.updatePrixFournisseur);
router.delete('/prix-fournisseurs/:id', authMiddleware, canDo('manageStock'), produitsServicesController.deletePrixFournisseur);

// Prix clients
router.get('/prix-clients', authMiddleware, produitsServicesController.listPrixClients);
router.post('/prix-clients', authMiddleware, canDo('manageStock'), validate(createPrixClientSchema), produitsServicesController.createPrixClient);
router.put('/prix-clients/:id', authMiddleware, canDo('manageStock'), validate(updatePrixClientSchema), produitsServicesController.updatePrixClient);
router.delete('/prix-clients/:id', authMiddleware, canDo('manageStock'), produitsServicesController.deletePrixClient);

// ============ COMMERCE (Dolibarr-style) ============
// Devis
router.get('/commerce/devis', authMiddleware, commerceController.listDevis);
router.get('/commerce/devis/:id', authMiddleware, commerceController.getDevis);
router.get('/commerce/devis/:id/pdf', authMiddleware, commerceController.exportDevisPDF);
router.post('/commerce/devis', authMiddleware, canDo('manageCommerce'), validate(createDevisSchema), commerceController.createDevis);
router.put('/commerce/devis/:id', authMiddleware, canDo('manageCommerce'), validate(updateDevisSchema), commerceController.updateDevis);
router.delete('/commerce/devis/:id', authMiddleware, canDo('manageCommerce'), commerceController.deleteDevis);
router.post('/commerce/devis/:id/convertir-commande', authMiddleware, canDo('manageCommerce'), commerceController.convertirDevisCommande);

// Commandes
router.get('/commerce/commandes', authMiddleware, commerceController.listCommandes);
router.get('/commerce/commandes/:id', authMiddleware, commerceController.getCommande);
router.get('/commerce/commandes/:id/pdf', authMiddleware, commerceController.exportCommandePDF);
router.post('/commerce/commandes', authMiddleware, canDo('manageCommerce'), validate(createCommandeSchema), commerceController.createCommande);
router.put('/commerce/commandes/:id', authMiddleware, canDo('manageCommerce'), validate(updateCommandeSchema), commerceController.updateCommande);
router.delete('/commerce/commandes/:id', authMiddleware, canDo('manageCommerce'), commerceController.deleteCommande);
router.post('/commerce/commandes/:id/convertir-facture', authMiddleware, canDo('manageCommerce'), commerceController.convertirCommandeFacture);

// Factures
router.get('/commerce/factures', authMiddleware, commerceController.listFactures);
router.get('/commerce/factures/:id', authMiddleware, commerceController.getFacture);
router.get('/commerce/factures/:id/pdf', authMiddleware, commerceController.exportFacturePDF);
router.post('/commerce/factures', authMiddleware, canDo('manageCommerce'), validate(createFactureSchema), commerceController.createFacture);
router.put('/commerce/factures/:id', authMiddleware, canDo('manageCommerce'), validate(updateFactureSchema), commerceController.updateFacture);
router.delete('/commerce/factures/:id', authMiddleware, canDo('manageCommerce'), commerceController.deleteFacture);
router.get('/commerce/factures/:id/relances', authMiddleware, canDo('manageCommerce'), commerceController.listRelances);
router.post('/commerce/factures/:id/relances', authMiddleware, canDo('manageCommerce'), validate(createFactureRelanceSchema), commerceController.createRelance);

// Paiements
router.post('/commerce/paiements', authMiddleware, canDo('manageCommerce'), validate(createPaiementSchema), commerceController.createPaiement);
router.delete('/commerce/paiements/:id', authMiddleware, canDo('manageCommerce'), commerceController.deletePaiement);

// ============ COMMANDES FOURNISSEURS ============
router.get('/commandes-fournisseurs', authMiddleware, commandeFournisseurController.list);
router.get('/commandes-fournisseurs/:id', authMiddleware, commandeFournisseurController.get);
router.get('/commandes-fournisseurs/:id/pdf', authMiddleware, commandeFournisseurController.exportPDF);
router.post('/commandes-fournisseurs', authMiddleware, canDo('manageCommerce'), validate(createCommandeFournisseurSchema), commandeFournisseurController.create);
router.put('/commandes-fournisseurs/:id', authMiddleware, canDo('manageCommerce'), validate(updateCommandeFournisseurSchema), commandeFournisseurController.update);
router.delete('/commandes-fournisseurs/:id', authMiddleware, canDo('manageCommerce'), commandeFournisseurController.delete);
router.post('/commandes-fournisseurs/:id/reception', authMiddleware, canDo('manageCommerce'), validate(receptionCommandeFournisseurSchema), commandeFournisseurController.reception);

// ============ FACTURATION ============
// Factures fournisseurs
router.get('/factures-fournisseurs', authMiddleware, canDo('viewFacturation'), factureFournisseurController.list);
router.get('/factures-fournisseurs/:id', authMiddleware, canDo('viewFacturation'), factureFournisseurController.get);
router.get('/factures-fournisseurs/:id/pdf', authMiddleware, canDo('viewFacturation'), factureFournisseurController.exportPDF);
router.post('/factures-fournisseurs', authMiddleware, canDo('manageFacturation'), validate(createFactureFournisseurSchema), factureFournisseurController.create);
router.put('/factures-fournisseurs/:id', authMiddleware, canDo('manageFacturation'), validate(updateFactureFournisseurSchema), factureFournisseurController.update);
router.delete('/factures-fournisseurs/:id', authMiddleware, canDo('manageFacturation'), factureFournisseurController.delete);
router.post('/factures-fournisseurs/:id/paiements', authMiddleware, canDo('manageFacturation'), validate(createPaiementFournisseurSchema), factureFournisseurController.createPaiement);
router.delete('/factures-fournisseurs/:id/paiements/:paiementId', authMiddleware, canDo('manageFacturation'), factureFournisseurController.deletePaiement);
router.post('/factures-fournisseurs/convertir-commande/:commandeId', authMiddleware, canDo('manageFacturation'), factureFournisseurController.convertirFromCommande);

// Charges
router.get('/charges/categories', authMiddleware, canDo('viewFacturation'), chargeController.getCategories);
router.get('/charges/stats', authMiddleware, canDo('viewFacturation'), chargeController.getStatsByType);
router.get('/charges', authMiddleware, canDo('viewFacturation'), chargeController.list);
router.get('/charges/:id', authMiddleware, canDo('viewFacturation'), chargeController.get);
router.post('/charges', authMiddleware, canDo('manageFacturation'), validate(createChargeSchema), chargeController.create);
router.put('/charges/:id', authMiddleware, canDo('manageFacturation'), validate(updateChargeSchema), chargeController.update);
router.delete('/charges/:id', authMiddleware, canDo('manageFacturation'), chargeController.delete);
router.post('/charges/:id/paiements', authMiddleware, canDo('manageFacturation'), validate(createPaiementChargeSchema), chargeController.createPaiement);
router.delete('/charges/:id/paiements/:paiementId', authMiddleware, canDo('manageFacturation'), chargeController.deletePaiement);
router.post('/charges/:id/annuler', authMiddleware, canDo('manageFacturation'), chargeController.annuler);

// Paiements divers
router.get('/paiements-divers/categories', authMiddleware, canDo('viewFacturation'), paiementDiversController.getCategories);
router.get('/paiements-divers/stats', authMiddleware, canDo('viewFacturation'), paiementDiversController.getStats);
router.get('/paiements-divers', authMiddleware, canDo('viewFacturation'), paiementDiversController.list);
router.get('/paiements-divers/:id', authMiddleware, canDo('viewFacturation'), paiementDiversController.get);
router.post('/paiements-divers', authMiddleware, canDo('manageFacturation'), validate(createPaiementDiversSchema), paiementDiversController.create);
router.put('/paiements-divers/:id', authMiddleware, canDo('manageFacturation'), validate(updatePaiementDiversSchema), paiementDiversController.update);
router.delete('/paiements-divers/:id', authMiddleware, canDo('manageFacturation'), paiementDiversController.delete);

// Statistiques facturation
router.get('/facturation/stats/global', authMiddleware, canDo('viewFacturation'), facturationStatsController.getGlobalStats);
router.get('/facturation/stats/tva', authMiddleware, canDo('viewFacturation'), facturationStatsController.getTVASummary);
router.get('/facturation/stats/marges', authMiddleware, canDo('viewFacturation'), facturationStatsController.getMarges);
router.get('/facturation/stats/commandes-facturables', authMiddleware, canDo('viewFacturation'), facturationStatsController.getCommandesFacturables);
router.get('/facturation/stats/tresorerie', authMiddleware, canDo('viewFacturation'), facturationStatsController.getTresorerie);
router.get('/facturation/stats/retards', authMiddleware, canDo('viewFacturation'), facturationStatsController.getFacturesEnRetard);

export default router;
