import path from 'path';
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';

const UPLOADS_DIR = path.resolve('uploads');

function assertSafePath(filePath: string | undefined): void {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep) && resolved !== UPLOADS_DIR) {
    throw new AppError(400, 'Chemin de fichier non autorisé');
  }
}


const prisma = new PrismaClient();

export const settingsController = {
  // Récupérer les paramètres (créer si inexistants)
  async getSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let settings = await prisma.companySettings.findFirst();

      // Si aucun paramètre n'existe, créer les valeurs par défaut
      if (!settings) {
        settings = await prisma.companySettings.create({
          data: {
            nomEntreprise: 'Mon Entreprise',
          },
        });
      }

      res.json({ settings });
    } catch (error) {
      logger.error({ err: error }, 'Get settings error');
      return next(new AppError(500, 'Erreur lors de la récupération des paramètres'));
    }
  },

  // Mettre à jour les paramètres
  async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const {
        // Informations générales
        nomEntreprise,
        formeJuridique,
        logoPath,
        logoCarrePath,
        // Coordonnées
        adresse,
        codePostal,
        ville,
        pays,
        telephone,
        fax,
        email,
        siteWeb,
        // Informations légales
        rc,
        nif,
        ai,
        nis,
        nin,
        capitalSocial,
        compteBancaire,
        rib,
        banque,
        // Paramètres commerciaux
        devisePrincipale,
        tauxTVADefaut,
        // Préfixes de numérotation - Documents vente
        prefixDevis,
        prefixCommande,
        prefixFacture,
        prefixAvoir,
        // Préfixes de numérotation - Documents achat
        prefixCommandeFournisseur,
        prefixFactureFournisseur,
        prefixCharge,
        // Préfixes de numérotation - Tiers
        prefixClient,
        prefixFournisseur,
        prefixProspect,
        // Préfixes de numérotation - Autres
        prefixProduit,
        prefixService,
        // Format numérotation
        longueurNumero,
        inclureAnnee,
        separateur,
        // Décalages de numérotation
        offsetDevis,
        offsetCommande,
        offsetFacture,
        offsetAvoir,
        offsetCommandeFournisseur,
        offsetFactureFournisseur,
        offsetCharge,
        offsetClient,
        offsetFournisseur,
        offsetProspect,
        // RH - Congés
        modeAllocationConges,
        joursCongesAnnuels,
        joursCongesMensuels,
      } = req.body;

      // Valider les chemins de fichiers contre le path traversal
      assertSafePath(logoPath);
      assertSafePath(logoCarrePath);

      // Récupérer ou créer les settings
      let settings = await prisma.companySettings.findFirst();

      const data = {
        nomEntreprise,
        formeJuridique,
        logoPath,
        logoCarrePath,
        adresse,
        codePostal,
        ville,
        pays,
        telephone,
        fax,
        email,
        siteWeb,
        rc,
        nif,
        ai,
        nis,
        nin,
        capitalSocial,
        compteBancaire,
        rib,
        banque,
        devisePrincipale,
        tauxTVADefaut: tauxTVADefaut !== undefined ? parseFloat(tauxTVADefaut) : undefined,
        prefixDevis,
        prefixCommande,
        prefixFacture,
        prefixAvoir,
        prefixCommandeFournisseur,
        prefixFactureFournisseur,
        prefixCharge,
        prefixClient,
        prefixFournisseur,
        prefixProspect,
        prefixProduit,
        prefixService,
        longueurNumero: longueurNumero !== undefined ? parseInt(longueurNumero, 10) : undefined,
        inclureAnnee,
        separateur,
        // Décalages de numérotation
        offsetDevis: offsetDevis !== undefined ? parseInt(offsetDevis, 10) : undefined,
        offsetCommande: offsetCommande !== undefined ? parseInt(offsetCommande, 10) : undefined,
        offsetFacture: offsetFacture !== undefined ? parseInt(offsetFacture, 10) : undefined,
        offsetAvoir: offsetAvoir !== undefined ? parseInt(offsetAvoir, 10) : undefined,
        offsetCommandeFournisseur: offsetCommandeFournisseur !== undefined ? parseInt(offsetCommandeFournisseur, 10) : undefined,
        offsetFactureFournisseur: offsetFactureFournisseur !== undefined ? parseInt(offsetFactureFournisseur, 10) : undefined,
        offsetCharge: offsetCharge !== undefined ? parseInt(offsetCharge, 10) : undefined,
        offsetClient: offsetClient !== undefined ? parseInt(offsetClient, 10) : undefined,
        offsetFournisseur: offsetFournisseur !== undefined ? parseInt(offsetFournisseur, 10) : undefined,
        offsetProspect: offsetProspect !== undefined ? parseInt(offsetProspect, 10) : undefined,
        // RH - Congés
        modeAllocationConges,
        joursCongesAnnuels: joursCongesAnnuels !== undefined ? parseFloat(joursCongesAnnuels) : undefined,
        joursCongesMensuels: joursCongesMensuels !== undefined ? parseFloat(joursCongesMensuels) : undefined,
      };

      // Filtrer les valeurs undefined
      const filteredData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );

      if (settings) {
        // Mettre à jour
        settings = await prisma.companySettings.update({
          where: { id: settings.id },
          data: filteredData,
        });
      } else {
        // Créer
        settings = await prisma.companySettings.create({
          data: filteredData as any,
        });
      }

      res.json({ settings, message: 'Paramètres mis à jour avec succès' });
    } catch (error) {
      logger.error({ err: error }, 'Update settings error');
      return next(new AppError(500, 'Erreur lors de la mise à jour des paramètres'));
    }
  },

  // Upload du logo principal
  async uploadLogo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const logoPath = req.file.path;

      let settings = await prisma.companySettings.findFirst();

      if (settings) {
        settings = await prisma.companySettings.update({
          where: { id: settings.id },
          data: { logoPath },
        });
      } else {
        settings = await prisma.companySettings.create({
          data: {
            nomEntreprise: 'Mon Entreprise',
            logoPath,
          },
        });
      }

      res.json({ settings, message: 'Logo mis à jour avec succès' });
    } catch (error) {
      logger.error({ err: error }, 'Upload logo error');
      return next(new AppError(500, 'Erreur lors de l\'upload du logo'));
    }
  },

  // Upload du logo carré
  async uploadLogoCarre(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const logoCarrePath = req.file.path;

      let settings = await prisma.companySettings.findFirst();

      if (settings) {
        settings = await prisma.companySettings.update({
          where: { id: settings.id },
          data: { logoCarrePath },
        });
      } else {
        settings = await prisma.companySettings.create({
          data: {
            nomEntreprise: 'Mon Entreprise',
            logoCarrePath,
          },
        });
      }

      res.json({ settings, message: 'Logo carré mis à jour avec succès' });
    } catch (error) {
      logger.error({ err: error }, 'Upload logo carre error');
      return next(new AppError(500, 'Erreur lors de l\'upload du logo carré'));
    }
  },
};
