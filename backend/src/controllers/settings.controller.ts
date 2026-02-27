import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware.js';

const prisma = new PrismaClient();

export const settingsController = {
  // Récupérer les paramètres (créer si inexistants)
  async getSettings(req: AuthRequest, res: Response) {
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
      console.error('Get settings error:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des paramètres' });
    }
  },

  // Mettre à jour les paramètres
  async updateSettings(req: AuthRequest, res: Response) {
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
      } = req.body;

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
      console.error('Update settings error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres' });
    }
  },

  // Upload du logo principal
  async uploadLogo(req: AuthRequest, res: Response) {
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

      res.json({ settings, logoPath, message: 'Logo mis à jour avec succès' });
    } catch (error) {
      console.error('Upload logo error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'upload du logo' });
    }
  },

  // Upload du logo carré
  async uploadLogoCarre(req: AuthRequest, res: Response) {
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

      res.json({ settings, logoCarrePath, message: 'Logo carré mis à jour avec succès' });
    } catch (error) {
      console.error('Upload logo carre error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'upload du logo carré' });
    }
  },
};
