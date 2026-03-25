import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../services/cache.service.js';

export const facturationStatsController = {
  // Statistiques globales de facturation
  async getGlobalStats(req: AuthRequest, res: Response) {
    try {
      const { annee, noCache } = req.query;
      const year = annee ? parseInt(annee as string) : new Date().getFullYear();

      // Vérifier le cache sauf si noCache est spécifié
      if (noCache !== 'true') {
        const cached = cacheService.get(CACHE_KEYS.STATS_GLOBAL(year));
        if (cached) {
          return res.json({ ...cached, fromCache: true });
        }
      }

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
          totalPaye: true,
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
          totalPaye: true,
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

      const result = {
        annee: year,
        facturesClients: {
          count: facturesClientsStats._count,
          totalHT: facturesClientsStats._sum?.totalHT || 0,
          totalTVA: facturesClientsStats._sum?.totalTVA || 0,
          totalTTC: facturesClientsStats._sum?.totalTTC || 0,
          totalPaye: facturesClientsStats._sum?.totalPaye || 0,
          resteAPayer: (facturesClientsStats._sum?.totalTTC || 0) - (facturesClientsStats._sum?.totalPaye || 0),
        },
        facturesFournisseurs: {
          count: facturesFournisseursStats._count,
          totalHT: facturesFournisseursStats._sum?.totalHT || 0,
          totalTVA: facturesFournisseursStats._sum?.totalTVA || 0,
          totalTTC: facturesFournisseursStats._sum?.totalTTC || 0,
          totalPaye: facturesFournisseursStats._sum?.totalPaye || 0,
          resteAPayer: (facturesFournisseursStats._sum?.totalTTC || 0) - (facturesFournisseursStats._sum?.totalPaye || 0),
        },
        charges: {
          count: chargesStats._count,
          montantHT: chargesStats._sum?.montantHT || 0,
          montantTVA: chargesStats._sum?.montantTVA || 0,
          montantTTC: chargesStats._sum?.montantTTC || 0,
          montantPaye: chargesStats._sum?.montantPaye || 0,
          resteAPayer: (chargesStats._sum?.montantTTC || 0) - (chargesStats._sum?.montantPaye || 0),
        },
        paiementsDivers: {
          encaissements: encaissementsDivers,
          decaissements: decaissementsDivers,
          solde: encaissementsDivers - decaissementsDivers,
        },
        resume: {
          totalVentes: facturesClientsStats._sum?.totalTTC || 0,
          totalAchats: (facturesFournisseursStats._sum?.totalTTC || 0) + (chargesStats._sum?.montantTTC || 0),
          resultatBrut: (facturesClientsStats._sum?.totalTTC || 0) - (facturesFournisseursStats._sum?.totalTTC || 0) - (chargesStats._sum?.montantTTC || 0),
        },
      };

      // Mettre en cache pour 5 minutes
      cacheService.set(CACHE_KEYS.STATS_GLOBAL(year), result, CACHE_TTL.MEDIUM);

      res.json(result);
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
          statut: { in: ['VALIDEE', 'EN_PREPARATION', 'EXPEDIEE', 'LIVREE'] },
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
          statut: { in: ['VALIDEE', 'EN_RETARD', 'PARTIELLEMENT_PAYEE'] },
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
          resteAPayer: f.totalTTC - f.totalPaye,
        })),
        facturesFournisseurs: facturesFournisseursEnRetard.map((f) => ({
          ...f,
          joursRetard: Math.floor((today.getTime() - f.dateEcheance!.getTime()) / (1000 * 60 * 60 * 24)),
          resteAPayer: f.totalTTC - f.totalPaye,
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

  // Années ayant des données TVA (factures non brouillon/annulées)
  async getAnneesDisponibles(_req: AuthRequest, res: Response) {
    try {
      const factures = await prisma.facture.findMany({
        where: { statut: { notIn: ['BROUILLON', 'ANNULEE'] } },
        select: { dateFacture: true },
      });
      const years = [...new Set(factures.map(f => new Date(f.dateFacture).getFullYear()))]
        .sort((a, b) => b - a);
      res.json(years);
    } catch (error) {
      console.error('Get annees disponibles error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Déclaration G50 — TVA mensuelle (produits sur date facture, services sur encaissement)
  async getG50(req: AuthRequest, res: Response) {
    try {
      const { annee } = req.query;
      const year = annee ? parseInt(annee as string) : new Date().getFullYear();
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

      // 1. TVA collectée produits — exigible à la date de facturation
      const facturesProduits = await prisma.facture.findMany({
        where: {
          dateFacture: { gte: startDate, lte: endDate },
          typeDocument: { not: 'SERVICE' }, // PRODUIT ou null → TVA à la facturation
          statut: { notIn: ['BROUILLON', 'ANNULEE'] },
          type: { not: 'ACOMPTE' },
        },
        select: {
          id: true, ref: true, type: true,
          client: { select: { nomEntreprise: true } },
          dateFacture: true, totalHT: true, totalTVA: true, totalTTC: true, statut: true,
        },
        orderBy: { dateFacture: 'asc' },
      });

      // 2. TVA collectée services — exigible à l'encaissement
      const paiementsServices = await prisma.paiement.findMany({
        where: {
          statut: 'ENCAISSE',
          OR: [
            { dateEncaissement: { gte: startDate, lte: endDate } },
            { dateEncaissement: null, datePaiement: { gte: startDate, lte: endDate } },
          ],
          facture: {
            typeDocument: 'SERVICE',
            statut: { notIn: ['BROUILLON', 'ANNULEE'] },
          },
        },
        include: {
          facture: {
            select: {
              id: true, ref: true, type: true,
              client: { select: { nomEntreprise: true } },
              totalHT: true, totalTVA: true, totalTTC: true,
            },
          },
        },
        orderBy: { datePaiement: 'asc' },
      });

      // 3. TVA déductible — achats fournisseurs
      const facturesFournisseurs = await prisma.factureFournisseur.findMany({
        where: {
          dateFacture: { gte: startDate, lte: endDate },
          statut: { not: 'BROUILLON' },
        },
        select: {
          id: true, ref: true,
          fournisseur: { select: { nomEntreprise: true } },
          dateFacture: true, totalHT: true, totalTVA: true, totalTTC: true,
        },
        orderBy: { dateFacture: 'asc' },
      });

      // 4. TVA déductible — charges
      const charges = await prisma.charge.findMany({
        where: {
          dateCharge: { gte: startDate, lte: endDate },
          statut: { not: 'ANNULEE' },
        },
        select: {
          id: true, libelle: true,
          fournisseur: { select: { nomEntreprise: true } },
          dateCharge: true, montantHT: true, montantTVA: true, montantTTC: true,
        },
        orderBy: { dateCharge: 'asc' },
      });

      const moisDetails = Array.from({ length: 12 }, (_, i) => {
        const mois = i + 1;

        // Factures produits du mois (AVOIR = signe négatif)
        const factProduitsMois = facturesProduits.filter(f => new Date(f.dateFacture).getMonth() === i);
        const tvaCollecteeProduits = factProduitsMois.reduce((sum, f) => sum + (f.type === 'AVOIR' ? -f.totalTVA : f.totalTVA), 0);
        const htCollecteeProduits = factProduitsMois.reduce((sum, f) => sum + (f.type === 'AVOIR' ? -f.totalHT : f.totalHT), 0);

        // Paiements services du mois
        const paiServMois = paiementsServices.filter(p => {
          const d = new Date((p.dateEncaissement ?? p.datePaiement) as Date);
          return d.getMonth() === i;
        });
        const paiementsServicesDetail = paiServMois.map(p => {
          const tvaRate = p.facture.totalTTC > 0 ? p.facture.totalTVA / p.facture.totalTTC : 0;
          const sign = p.facture.type === 'AVOIR' ? -1 : 1;
          const tvaProportionnelle = p.montant * tvaRate * sign;
          const htProportionnel = (p.montant - p.montant * tvaRate) * sign;
          return {
            id: p.id,
            factureId: p.factureId,
            factureRef: p.facture.ref,
            factureType: p.facture.type,
            client: p.facture.client,
            datePaiement: p.datePaiement,
            dateEncaissement: p.dateEncaissement,
            montantEncaisse: p.montant,
            htProportionnel,
            tvaProportionnelle,
          };
        });
        const tvaCollecteeServices = paiementsServicesDetail.reduce((s, p) => s + p.tvaProportionnelle, 0);
        const htCollecteeServices = paiementsServicesDetail.reduce((s, p) => s + p.htProportionnel, 0);

        // Fournisseurs du mois
        const fournMois = facturesFournisseurs.filter(f => new Date(f.dateFacture).getMonth() === i);
        const tvaDeductibleAchats = fournMois.reduce((s, f) => s + f.totalTVA, 0);

        // Charges du mois
        const chargesMois = charges.filter(c => new Date(c.dateCharge).getMonth() === i);
        const tvaDeductibleCharges = chargesMois.reduce((s, c) => s + c.montantTVA, 0);

        const tvaCollecteeTotale = tvaCollecteeProduits + tvaCollecteeServices;
        const tvaDeductibleTotale = tvaDeductibleAchats + tvaDeductibleCharges;
        const tvaNette = tvaCollecteeTotale - tvaDeductibleTotale;

        return {
          mois,
          nomMois: MOIS_NOMS[i],
          tvaCollectee: {
            produits: {
              montantHT: htCollecteeProduits,
              montantTVA: tvaCollecteeProduits,
              factures: factProduitsMois,
            },
            services: {
              montantHT: htCollecteeServices,
              montantTVA: tvaCollecteeServices,
              paiements: paiementsServicesDetail,
            },
            total: {
              montantHT: htCollecteeProduits + htCollecteeServices,
              montantTVA: tvaCollecteeTotale,
            },
          },
          tvaDeductible: {
            achats: {
              montantHT: fournMois.reduce((s, f) => s + f.totalHT, 0),
              montantTVA: tvaDeductibleAchats,
              factures: fournMois,
            },
            charges: {
              montantHT: chargesMois.reduce((s, c) => s + c.montantHT, 0),
              montantTVA: tvaDeductibleCharges,
              charges: chargesMois,
            },
            total: {
              montantHT: fournMois.reduce((s, f) => s + f.totalHT, 0) + chargesMois.reduce((s, c) => s + c.montantHT, 0),
              montantTVA: tvaDeductibleTotale,
            },
          },
          tvaNette,
          aPayer: tvaNette > 0 ? tvaNette : 0,
          credit: tvaNette < 0 ? Math.abs(tvaNette) : 0,
        };
      });

      const totalAnnuel = moisDetails.reduce((acc, m) => ({
        tvaCollectee: acc.tvaCollectee + m.tvaCollectee.total.montantTVA,
        tvaDeductible: acc.tvaDeductible + m.tvaDeductible.total.montantTVA,
        tvaNette: acc.tvaNette + m.tvaNette,
        aPayer: acc.aPayer + (m.tvaNette > 0 ? m.tvaNette : 0),
        credit: acc.credit + (m.tvaNette < 0 ? Math.abs(m.tvaNette) : 0),
      }), { tvaCollectee: 0, tvaDeductible: 0, tvaNette: 0, aPayer: 0, credit: 0 });

      res.json({ annee: year, moisDetails, totalAnnuel });
    } catch (error) {
      console.error('Get G50 error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default facturationStatsController;
