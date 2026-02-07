import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export const facturationStatsController = {
  // Statistiques globales de facturation
  async getGlobalStats(req: AuthRequest, res: Response) {
    try {
      const { annee } = req.query;
      const year = annee ? parseInt(annee as string) : new Date().getFullYear();

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      // Factures clients
      const facturesClientsStats = await prisma.facture.aggregate({
        where: {
          dateFacture: { gte: startDate, lte: endDate },
          statut: { not: 'BROUILLON' },
        },
        _sum: {
          totalHT: true,
          totalTVA: true,
          totalTTC: true,
          montantPaye: true,
        },
        _count: true,
      });

      // Factures fournisseurs
      const facturesFournisseursStats = await prisma.factureFournisseur.aggregate({
        where: {
          dateFacture: { gte: startDate, lte: endDate },
          statut: { not: 'BROUILLON' },
        },
        _sum: {
          totalHT: true,
          totalTVA: true,
          totalTTC: true,
          montantPaye: true,
        },
        _count: true,
      });

      // Charges
      const chargesStats = await prisma.charge.aggregate({
        where: {
          dateCharge: { gte: startDate, lte: endDate },
          statut: { not: 'ANNULEE' },
        },
        _sum: {
          montantHT: true,
          montantTVA: true,
          montantTTC: true,
          montantPaye: true,
        },
        _count: true,
      });

      // Paiements divers
      const paiementsDiversStats = await prisma.paiementDivers.groupBy({
        by: ['typeOperation'],
        where: {
          datePaiement: { gte: startDate, lte: endDate },
        },
        _sum: { montant: true },
        _count: true,
      });

      const encaissementsDivers = paiementsDiversStats.find((p) => p.typeOperation === 'ENCAISSEMENT')?._sum.montant || 0;
      const decaissementsDivers = paiementsDiversStats.find((p) => p.typeOperation === 'DECAISSEMENT')?._sum.montant || 0;

      res.json({
        annee: year,
        facturesClients: {
          count: facturesClientsStats._count,
          totalHT: facturesClientsStats._sum.totalHT || 0,
          totalTVA: facturesClientsStats._sum.totalTVA || 0,
          totalTTC: facturesClientsStats._sum.totalTTC || 0,
          montantPaye: facturesClientsStats._sum.montantPaye || 0,
          resteAPayer: (facturesClientsStats._sum.totalTTC || 0) - (facturesClientsStats._sum.montantPaye || 0),
        },
        facturesFournisseurs: {
          count: facturesFournisseursStats._count,
          totalHT: facturesFournisseursStats._sum.totalHT || 0,
          totalTVA: facturesFournisseursStats._sum.totalTVA || 0,
          totalTTC: facturesFournisseursStats._sum.totalTTC || 0,
          montantPaye: facturesFournisseursStats._sum.montantPaye || 0,
          resteAPayer: (facturesFournisseursStats._sum.totalTTC || 0) - (facturesFournisseursStats._sum.montantPaye || 0),
        },
        charges: {
          count: chargesStats._count,
          montantHT: chargesStats._sum.montantHT || 0,
          montantTVA: chargesStats._sum.montantTVA || 0,
          montantTTC: chargesStats._sum.montantTTC || 0,
          montantPaye: chargesStats._sum.montantPaye || 0,
          resteAPayer: (chargesStats._sum.montantTTC || 0) - (chargesStats._sum.montantPaye || 0),
        },
        paiementsDivers: {
          encaissements: encaissementsDivers,
          decaissements: decaissementsDivers,
          solde: encaissementsDivers - decaissementsDivers,
        },
        resume: {
          totalVentes: facturesClientsStats._sum.totalTTC || 0,
          totalAchats: (facturesFournisseursStats._sum.totalTTC || 0) + (chargesStats._sum.montantTTC || 0),
          resultatBrut: (facturesClientsStats._sum.totalTTC || 0) - (facturesFournisseursStats._sum.totalTTC || 0) - (chargesStats._sum.montantTTC || 0),
        },
      });
    } catch (error) {
      console.error('Get global stats error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Résumé TVA (collectée vs déductible)
  async getTVASummary(req: AuthRequest, res: Response) {
    try {
      const { annee, trimestre, mois } = req.query;
      const year = annee ? parseInt(annee as string) : new Date().getFullYear();

      let startDate: Date;
      let endDate: Date;

      if (mois) {
        const month = parseInt(mois as string) - 1;
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month + 1, 0, 23, 59, 59);
      } else if (trimestre) {
        const q = parseInt(trimestre as string);
        startDate = new Date(year, (q - 1) * 3, 1);
        endDate = new Date(year, q * 3, 0, 23, 59, 59);
      } else {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59);
      }

      // TVA collectée (factures clients payées)
      const tvaCollectee = await prisma.facture.aggregate({
        where: {
          dateFacture: { gte: startDate, lte: endDate },
          statut: { in: ['PAYEE', 'PARTIELLEMENT_PAYEE'] },
        },
        _sum: { totalTVA: true },
      });

      // TVA déductible sur achats (factures fournisseurs payées)
      const tvaDeductibleAchats = await prisma.factureFournisseur.aggregate({
        where: {
          dateFacture: { gte: startDate, lte: endDate },
          statut: { in: ['PAYEE', 'PARTIELLEMENT_PAYEE'] },
        },
        _sum: { totalTVA: true },
      });

      // TVA déductible sur charges (charges payées)
      const tvaDeductibleCharges = await prisma.charge.aggregate({
        where: {
          dateCharge: { gte: startDate, lte: endDate },
          statut: { in: ['PAYEE', 'PARTIELLEMENT_PAYEE'] },
        },
        _sum: { montantTVA: true },
      });

      // Détail par taux de TVA pour factures clients
      const detailTVACollectee = await prisma.factureLigne.groupBy({
        by: ['tauxTVA'],
        where: {
          facture: {
            dateFacture: { gte: startDate, lte: endDate },
            statut: { in: ['PAYEE', 'PARTIELLEMENT_PAYEE'] },
          },
        },
        _sum: { totalHT: true, totalTVA: true },
      });

      // Détail par taux de TVA pour factures fournisseurs
      const detailTVADeductible = await prisma.factureFournisseurLigne.groupBy({
        by: ['tauxTVA'],
        where: {
          factureFournisseur: {
            dateFacture: { gte: startDate, lte: endDate },
            statut: { in: ['PAYEE', 'PARTIELLEMENT_PAYEE'] },
          },
        },
        _sum: { totalHT: true, totalTVA: true },
      });

      const tvaCollecteeMontant = tvaCollectee._sum.totalTVA || 0;
      const tvaDeductibleMontant = (tvaDeductibleAchats._sum.totalTVA || 0) + (tvaDeductibleCharges._sum.montantTVA || 0);
      const tvaNette = tvaCollecteeMontant - tvaDeductibleMontant;

      res.json({
        periode: {
          annee: year,
          trimestre: trimestre ? parseInt(trimestre as string) : undefined,
          mois: mois ? parseInt(mois as string) : undefined,
          debut: startDate,
          fin: endDate,
        },
        tvaCollectee: {
          montant: tvaCollecteeMontant,
          detail: detailTVACollectee,
        },
        tvaDeductible: {
          montant: tvaDeductibleMontant,
          achats: tvaDeductibleAchats._sum.totalTVA || 0,
          charges: tvaDeductibleCharges._sum.montantTVA || 0,
          detail: detailTVADeductible,
        },
        tvaNette,
        aPayer: tvaNette > 0 ? tvaNette : 0,
        credit: tvaNette < 0 ? Math.abs(tvaNette) : 0,
      });
    } catch (error) {
      console.error('Get TVA summary error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Analyse des marges par produit
  async getMarges(req: AuthRequest, res: Response) {
    try {
      const { annee, produitId } = req.query;
      const year = annee ? parseInt(annee as string) : new Date().getFullYear();

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      const whereVentes: any = {
        facture: {
          dateFacture: { gte: startDate, lte: endDate },
          statut: { not: 'BROUILLON' },
        },
      };
      const whereAchats: any = {
        factureFournisseur: {
          dateFacture: { gte: startDate, lte: endDate },
          statut: { not: 'BROUILLON' },
        },
      };

      if (produitId) {
        whereVentes.produitServiceId = produitId;
        whereAchats.produitServiceId = produitId;
      }

      // Ventes par produit
      const ventes = await prisma.factureLigne.groupBy({
        by: ['produitServiceId'],
        where: whereVentes,
        _sum: {
          quantite: true,
          totalHT: true,
        },
      });

      // Achats par produit
      const achats = await prisma.factureFournisseurLigne.groupBy({
        by: ['produitServiceId'],
        where: whereAchats,
        _sum: {
          quantite: true,
          totalHT: true,
        },
      });

      // Récupérer les infos produits
      const produitIds = [
        ...new Set([
          ...ventes.map((v) => v.produitServiceId).filter(Boolean),
          ...achats.map((a) => a.produitServiceId).filter(Boolean),
        ]),
      ] as string[];

      const produits = await prisma.produitService.findMany({
        where: { id: { in: produitIds } },
        select: { id: true, nom: true, reference: true },
      });

      const produitMap = new Map(produits.map((p) => [p.id, p]));

      // Calculer les marges
      const marges = produitIds.map((id) => {
        const vente = ventes.find((v) => v.produitServiceId === id);
        const achat = achats.find((a) => a.produitServiceId === id);
        const produit = produitMap.get(id);

        const totalVentes = vente?._sum.totalHT || 0;
        const totalAchats = achat?._sum.totalHT || 0;
        const marge = totalVentes - totalAchats;
        const tauxMarge = totalVentes > 0 ? (marge / totalVentes) * 100 : 0;

        return {
          produitId: id,
          produit: produit || { nom: 'Produit inconnu', reference: null },
          quantiteVendue: vente?._sum.quantite || 0,
          quantiteAchetee: achat?._sum.quantite || 0,
          totalVentes,
          totalAchats,
          marge,
          tauxMarge,
        };
      });

      // Trier par marge décroissante
      marges.sort((a, b) => b.marge - a.marge);

      // Totaux
      const totaux = marges.reduce(
        (acc, m) => ({
          totalVentes: acc.totalVentes + m.totalVentes,
          totalAchats: acc.totalAchats + m.totalAchats,
          marge: acc.marge + m.marge,
        }),
        { totalVentes: 0, totalAchats: 0, marge: 0 }
      );

      res.json({
        annee: year,
        marges,
        totaux: {
          ...totaux,
          tauxMarge: totaux.totalVentes > 0 ? (totaux.marge / totaux.totalVentes) * 100 : 0,
        },
      });
    } catch (error) {
      console.error('Get marges error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Commandes facturables (commandes clients confirmées sans facture)
  async getCommandesFacturables(req: AuthRequest, res: Response) {
    try {
      const commandesClients = await prisma.commande.findMany({
        where: {
          statut: { in: ['CONFIRMEE', 'EN_COURS', 'LIVREE'] },
          factures: { none: {} },
        },
        include: {
          client: { select: { id: true, nomEntreprise: true, code: true } },
        },
        orderBy: { dateCommande: 'desc' },
        take: 100,
      });

      const commandesFournisseurs = await prisma.commandeFournisseur.findMany({
        where: {
          statut: { in: ['CONFIRMEE', 'EN_RECEPTION', 'RECUE'] },
          facturesFournisseur: { none: {} },
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
        },
        orderBy: { dateCommande: 'desc' },
        take: 100,
      });

      res.json({
        commandesClients,
        commandesFournisseurs,
      });
    } catch (error) {
      console.error('Get commandes facturables error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Flux de trésorerie
  async getTresorerie(req: AuthRequest, res: Response) {
    try {
      const { annee } = req.query;
      const year = annee ? parseInt(annee as string) : new Date().getFullYear();

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      // Paiements reçus (factures clients)
      const paiementsRecus = await prisma.paiement.aggregate({
        where: {
          datePaiement: { gte: startDate, lte: endDate },
        },
        _sum: { montant: true },
      });

      // Paiements effectués (factures fournisseurs)
      const paiementsFournisseurs = await prisma.paiementFournisseur.aggregate({
        where: {
          datePaiement: { gte: startDate, lte: endDate },
        },
        _sum: { montant: true },
      });

      // Paiements charges
      const paiementsCharges = await prisma.paiementCharge.aggregate({
        where: {
          datePaiement: { gte: startDate, lte: endDate },
        },
        _sum: { montant: true },
      });

      // Paiements divers
      const paiementsDivers = await prisma.paiementDivers.groupBy({
        by: ['typeOperation'],
        where: {
          datePaiement: { gte: startDate, lte: endDate },
        },
        _sum: { montant: true },
      });

      const encaissementsDivers = paiementsDivers.find((p) => p.typeOperation === 'ENCAISSEMENT')?._sum.montant || 0;
      const decaissementsDivers = paiementsDivers.find((p) => p.typeOperation === 'DECAISSEMENT')?._sum.montant || 0;

      // Évolution mensuelle
      const evolutionMensuelle = [];
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

        const [recus, fournis, charges, divers] = await Promise.all([
          prisma.paiement.aggregate({
            where: { datePaiement: { gte: monthStart, lte: monthEnd } },
            _sum: { montant: true },
          }),
          prisma.paiementFournisseur.aggregate({
            where: { datePaiement: { gte: monthStart, lte: monthEnd } },
            _sum: { montant: true },
          }),
          prisma.paiementCharge.aggregate({
            where: { datePaiement: { gte: monthStart, lte: monthEnd } },
            _sum: { montant: true },
          }),
          prisma.paiementDivers.groupBy({
            by: ['typeOperation'],
            where: { datePaiement: { gte: monthStart, lte: monthEnd } },
            _sum: { montant: true },
          }),
        ]);

        const encaissements = (recus._sum.montant || 0) + (divers.find((d) => d.typeOperation === 'ENCAISSEMENT')?._sum.montant || 0);
        const decaissements =
          (fournis._sum.montant || 0) +
          (charges._sum.montant || 0) +
          (divers.find((d) => d.typeOperation === 'DECAISSEMENT')?._sum.montant || 0);

        evolutionMensuelle.push({
          mois: month + 1,
          nomMois: new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long' }),
          encaissements,
          decaissements,
          solde: encaissements - decaissements,
        });
      }

      const totalEncaissements = (paiementsRecus._sum.montant || 0) + encaissementsDivers;
      const totalDecaissements =
        (paiementsFournisseurs._sum.montant || 0) + (paiementsCharges._sum.montant || 0) + decaissementsDivers;

      res.json({
        annee: year,
        encaissements: {
          facturesClients: paiementsRecus._sum.montant || 0,
          paiementsDivers: encaissementsDivers,
          total: totalEncaissements,
        },
        decaissements: {
          facturesFournisseurs: paiementsFournisseurs._sum.montant || 0,
          charges: paiementsCharges._sum.montant || 0,
          paiementsDivers: decaissementsDivers,
          total: totalDecaissements,
        },
        solde: totalEncaissements - totalDecaissements,
        evolutionMensuelle,
      });
    } catch (error) {
      console.error('Get tresorerie error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Factures en retard
  async getFacturesEnRetard(req: AuthRequest, res: Response) {
    try {
      const today = new Date();

      // Factures clients en retard
      const facturesClientsEnRetard = await prisma.facture.findMany({
        where: {
          dateEcheance: { lt: today },
          statut: { in: ['ENVOYEE', 'PARTIELLEMENT_PAYEE'] },
        },
        include: {
          client: { select: { id: true, nomEntreprise: true, code: true } },
        },
        orderBy: { dateEcheance: 'asc' },
      });

      // Factures fournisseurs en retard
      const facturesFournisseursEnRetard = await prisma.factureFournisseur.findMany({
        where: {
          dateEcheance: { lt: today },
          statut: { in: ['VALIDEE', 'PARTIELLEMENT_PAYEE'] },
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
        },
        orderBy: { dateEcheance: 'asc' },
      });

      // Charges en retard
      const chargesEnRetard = await prisma.charge.findMany({
        where: {
          dateEcheance: { lt: today },
          statut: { in: ['A_PAYER', 'PARTIELLEMENT_PAYEE'] },
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
        },
        orderBy: { dateEcheance: 'asc' },
      });

      res.json({
        facturesClients: facturesClientsEnRetard.map((f) => ({
          ...f,
          joursRetard: Math.floor((today.getTime() - f.dateEcheance!.getTime()) / (1000 * 60 * 60 * 24)),
          resteAPayer: f.totalTTC - f.montantPaye,
        })),
        facturesFournisseurs: facturesFournisseursEnRetard.map((f) => ({
          ...f,
          joursRetard: Math.floor((today.getTime() - f.dateEcheance!.getTime()) / (1000 * 60 * 60 * 24)),
          resteAPayer: f.totalTTC - f.montantPaye,
        })),
        charges: chargesEnRetard.map((c) => ({
          ...c,
          joursRetard: Math.floor((today.getTime() - c.dateEcheance!.getTime()) / (1000 * 60 * 60 * 24)),
          resteAPayer: c.montantTTC - c.montantPaye,
        })),
      });
    } catch (error) {
      console.error('Get factures en retard error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default facturationStatsController;
