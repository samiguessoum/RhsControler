import { Response } from 'express';
import { prisma } from '../config/database.js';
import { ChargeStatut } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';

const DEFAULT_PREFIX = 'CHG';

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// Génère une référence au format: PRÉFIXE0000/2026
async function generateReference(date: Date): Promise<string> {
  const annee = date.getFullYear();

  // Récupérer les paramètres de numérotation
  const settings = await prisma.companySettings.findFirst();
  const prefix = settings?.prefixCharge || DEFAULT_PREFIX;
  const longueur = settings?.longueurNumero || 4;
  const separateur = settings?.separateur ?? '/';
  const inclureAnnee = settings?.inclureAnnee ?? true;
  const offset = settings?.offsetCharge || 0;

  const counter = await prisma.compteurDocument.upsert({
    where: { type_annee: { type: 'CHARGE', annee } },
    update: { prochainNumero: { increment: 1 } },
    create: { type: 'CHARGE', annee, prochainNumero: 2 },
    select: { prochainNumero: true },
  });
  // Appliquer le décalage au numéro
  const numero = (counter.prochainNumero - 1) + offset;
  const numeroFormate = String(numero).padStart(longueur, '0');

  // Format: PRÉFIXE0000/2026 (préfixe + numéro + séparateur + année)
  if (inclureAnnee) {
    return `${prefix}${numeroFormate}${separateur}${annee}`;
  }
  return `${prefix}${numeroFormate}`;
}

function determineStatut(montantTTC: number, montantPaye: number): ChargeStatut {
  if (montantPaye >= montantTTC) return 'PAYEE';
  if (montantPaye > 0) return 'PARTIELLEMENT_PAYEE';
  return 'A_PAYER';
}

export const chargeController = {
  // Liste des charges
  async list(req: AuthRequest, res: Response) {
    try {
      const {
        search,
        typeCharge,
        categorie,
        statut,
        fournisseurId,
        dateDebut,
        dateFin,
        page = '1',
        limit = '50',
      } = req.query;

      const where: any = {};
      if (typeCharge) where.typeCharge = typeCharge;
      if (categorie) where.categorie = categorie;
      if (statut) where.statut = statut;
      if (fournisseurId) where.fournisseurId = fournisseurId;
      if (search) {
        where.OR = [
          { ref: { contains: search as string, mode: 'insensitive' } },
          { libelle: { contains: search as string, mode: 'insensitive' } },
          { fournisseur: { nomEntreprise: { contains: search as string, mode: 'insensitive' } } },
        ];
      }
      if (dateDebut || dateFin) {
        where.dateCharge = {};
        if (dateDebut) where.dateCharge.gte = new Date(dateDebut as string);
        if (dateFin) where.dateCharge.lte = new Date(dateFin as string);
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [charges, total] = await Promise.all([
        prisma.charge.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { dateCharge: 'desc' },
          include: {
            fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
            _count: { select: { paiements: true } },
          },
        }),
        prisma.charge.count({ where }),
      ]);

      res.json({
        charges,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('List charges error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Détail d'une charge
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const charge = await prisma.charge.findUnique({
        where: { id },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true, code: true, siegeEmail: true } },
          paiements: {
            orderBy: { datePaiement: 'desc' },
            include: {
              modePaiement: { select: { id: true, libelle: true } },
            },
          },
        },
      });

      if (!charge) {
        return res.status(404).json({ error: 'Charge non trouvée' });
      }

      res.json({ charge });
    } catch (error) {
      console.error('Get charge error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Créer une charge
  async create(req: AuthRequest, res: Response) {
    try {
      const data = req.body;

      // Si type FOURNISSEUR, vérifier le fournisseur
      if (data.typeCharge === 'FOURNISSEUR' && data.fournisseurId) {
        const fournisseur = await prisma.client.findUnique({
          where: { id: data.fournisseurId },
        });
        if (!fournisseur || !fournisseur.actif) {
          return res.status(400).json({ error: 'Fournisseur non trouvé ou inactif' });
        }
        if (fournisseur.typeTiers !== 'FOURNISSEUR' && fournisseur.typeTiers !== 'CLIENT_FOURNISSEUR') {
          return res.status(400).json({ error: "Le tiers sélectionné n'est pas un fournisseur" });
        }
      }

      const dateCharge = parseDate(data.dateCharge) ?? new Date();
      const ref = data.ref || (await generateReference(dateCharge));

      // Calculer les montants
      const montantHT = Number(data.montantHT || 0);
      const tauxTVA = Number(data.tauxTVA || 0);
      const montantTVA = montantHT * (tauxTVA / 100);
      const montantTTC = montantHT + montantTVA;

      const charge = await prisma.charge.create({
        data: {
          ref,
          typeCharge: data.typeCharge,
          libelle: data.libelle,
          description: data.description,
          categorie: data.categorie,
          sousCategorie: data.sousCategorie,
          fournisseurId: data.fournisseurId,
          dateCharge,
          dateEcheance: parseDate(data.dateEcheance),
          periodeDebut: parseDate(data.periodeDebut),
          periodeFin: parseDate(data.periodeFin),
          montantHT,
          tauxTVA,
          montantTVA,
          montantTTC,
          montantPaye: 0,
          statut: 'A_PAYER',
          estRecurrente: data.estRecurrente ?? false,
          frequenceRecurrence: data.frequenceRecurrence,
          notes: data.notes,
          pieceJointe: data.pieceJointe,
          createdById: req.user?.id,
          updatedById: req.user?.id,
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Charge', charge.id, { after: charge });

      res.status(201).json({ charge });
    } catch (error) {
      console.error('Create charge error:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la charge' });
    }
  },

  // Mettre à jour une charge
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.charge.findUnique({
        where: { id },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Charge non trouvée' });
      }

      // Ne pas permettre la modification d'une charge payée (sauf notes)
      if (existing.statut === 'PAYEE' && (data.montantHT !== undefined || data.montantTTC !== undefined)) {
        return res.status(400).json({ error: 'Impossible de modifier les montants d\'une charge payée' });
      }

      // Recalculer les montants si nécessaire
      let montantHT = existing.montantHT;
      let tauxTVA = existing.tauxTVA;
      let montantTVA = existing.montantTVA;
      let montantTTC = existing.montantTTC;

      if (data.montantHT !== undefined || data.tauxTVA !== undefined) {
        montantHT = Number(data.montantHT ?? existing.montantHT);
        tauxTVA = Number(data.tauxTVA ?? existing.tauxTVA);
        montantTVA = montantHT * (tauxTVA / 100);
        montantTTC = montantHT + montantTVA;
      }

      const charge = await prisma.charge.update({
        where: { id },
        data: {
          typeCharge: data.typeCharge,
          libelle: data.libelle,
          description: data.description,
          categorie: data.categorie,
          sousCategorie: data.sousCategorie,
          fournisseurId: data.fournisseurId,
          dateCharge: parseDate(data.dateCharge),
          dateEcheance: parseDate(data.dateEcheance),
          periodeDebut: parseDate(data.periodeDebut),
          periodeFin: parseDate(data.periodeFin),
          montantHT,
          tauxTVA,
          montantTVA,
          montantTTC,
          estRecurrente: data.estRecurrente,
          frequenceRecurrence: data.frequenceRecurrence,
          notes: data.notes,
          pieceJointe: data.pieceJointe,
          updatedById: req.user?.id,
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Charge', charge.id, { after: charge });

      res.json({ charge });
    } catch (error) {
      console.error('Update charge error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour de la charge' });
    }
  },

  // Supprimer une charge
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.charge.findUnique({
        where: { id },
        include: { paiements: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Charge non trouvée' });
      }

      if (existing.paiements.length > 0) {
        return res.status(400).json({ error: 'Impossible de supprimer une charge avec des paiements' });
      }

      await prisma.charge.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'Charge', id);

      res.json({ message: 'Charge supprimée' });
    } catch (error) {
      console.error('Delete charge error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la charge' });
    }
  },

  // Ajouter un paiement
  async createPaiement(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { montant, datePaiement, modePaiementId, reference, notes } = req.body;

      const charge = await prisma.charge.findUnique({
        where: { id },
      });

      if (!charge) {
        return res.status(404).json({ error: 'Charge non trouvée' });
      }

      if (charge.statut === 'ANNULEE') {
        return res.status(400).json({ error: 'Impossible d\'ajouter un paiement à une charge annulée' });
      }

      const resteAPayer = charge.montantTTC - charge.montantPaye;
      if (montant > resteAPayer) {
        return res.status(400).json({ error: `Le montant dépasse le reste à payer (${resteAPayer.toFixed(2)})` });
      }

      const paiement = await prisma.paiementCharge.create({
        data: {
          chargeId: id,
          modePaiementId,
          datePaiement: parseDate(datePaiement) ?? new Date(),
          montant,
          reference,
          notes,
          createdById: req.user?.id,
        },
        include: {
          modePaiement: { select: { id: true, libelle: true } },
        },
      });

      // Mettre à jour le montant payé et le statut
      const nouveauMontantPaye = charge.montantPaye + montant;
      const nouveauStatut = determineStatut(charge.montantTTC, nouveauMontantPaye) as 'A_PAYER' | 'PARTIELLEMENT_PAYEE' | 'PAYEE';

      await prisma.charge.update({
        where: { id },
        data: {
          montantPaye: nouveauMontantPaye,
          statut: nouveauStatut,
          updatedById: req.user?.id,
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'PaiementCharge', paiement.id, { after: paiement });

      res.status(201).json({ paiement, nouveauStatut, montantPaye: nouveauMontantPaye });
    } catch (error) {
      console.error('Create paiement charge error:', error);
      res.status(500).json({ error: 'Erreur lors de la création du paiement' });
    }
  },

  // Supprimer un paiement
  async deletePaiement(req: AuthRequest, res: Response) {
    try {
      const { id, paiementId } = req.params;

      const paiement = await prisma.paiementCharge.findUnique({
        where: { id: paiementId },
        include: { charge: true },
      });

      if (!paiement || paiement.chargeId !== id) {
        return res.status(404).json({ error: 'Paiement non trouvé' });
      }

      await prisma.paiementCharge.delete({ where: { id: paiementId } });

      // Mettre à jour le montant payé et le statut
      const charge = paiement.charge;
      const nouveauMontantPaye = Math.max(0, charge.montantPaye - paiement.montant);
      const nouveauStatut = determineStatut(charge.montantTTC, nouveauMontantPaye) as 'A_PAYER' | 'PARTIELLEMENT_PAYEE' | 'PAYEE';

      await prisma.charge.update({
        where: { id },
        data: {
          montantPaye: nouveauMontantPaye,
          statut: nouveauStatut,
          updatedById: req.user?.id,
        },
      });

      await createAuditLog(req.user!.id, 'DELETE', 'PaiementCharge', paiementId);

      res.json({ message: 'Paiement supprimé', nouveauStatut, montantPaye: nouveauMontantPaye });
    } catch (error) {
      console.error('Delete paiement charge error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du paiement' });
    }
  },

  // Liste des catégories distinctes
  async getCategories(req: AuthRequest, res: Response) {
    try {
      const { typeCharge } = req.query;

      const where: any = {};
      if (typeCharge) where.typeCharge = typeCharge;

      const charges = await prisma.charge.findMany({
        where,
        select: { categorie: true, sousCategorie: true },
        distinct: ['categorie', 'sousCategorie'],
      });

      // Grouper par catégorie
      const categoriesMap = new Map<string, Set<string>>();
      charges.forEach((c) => {
        if (c.categorie) {
          if (!categoriesMap.has(c.categorie)) {
            categoriesMap.set(c.categorie, new Set());
          }
          if (c.sousCategorie) {
            categoriesMap.get(c.categorie)!.add(c.sousCategorie);
          }
        }
      });

      const categories = Array.from(categoriesMap.entries()).map(([categorie, sousCats]) => ({
        categorie,
        sousCategories: Array.from(sousCats),
      }));

      res.json({ categories });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Statistiques par type de charge
  async getStatsByType(req: AuthRequest, res: Response) {
    try {
      const { annee } = req.query;
      const year = annee ? parseInt(annee as string) : new Date().getFullYear();

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      const stats = await prisma.charge.groupBy({
        by: ['typeCharge'],
        where: {
          dateCharge: { gte: startDate, lte: endDate },
        },
        _sum: {
          montantHT: true,
          montantTVA: true,
          montantTTC: true,
          montantPaye: true,
        },
        _count: true,
      });

      // Stats par catégorie pour chaque type
      const statsByCategorie = await prisma.charge.groupBy({
        by: ['typeCharge', 'categorie'],
        where: {
          dateCharge: { gte: startDate, lte: endDate },
        },
        _sum: {
          montantTTC: true,
        },
        _count: true,
      });

      res.json({ stats, statsByCategorie, annee: year });
    } catch (error) {
      console.error('Get stats by type error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Annuler une charge
  async annuler(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.charge.findUnique({
        where: { id },
        include: { paiements: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Charge non trouvée' });
      }

      if (existing.paiements.length > 0) {
        return res.status(400).json({ error: 'Impossible d\'annuler une charge avec des paiements' });
      }

      const charge = await prisma.charge.update({
        where: { id },
        data: {
          statut: 'ANNULEE',
          updatedById: req.user?.id,
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Charge', charge.id, { after: charge });

      res.json({ charge, message: 'Charge annulée' });
    } catch (error) {
      console.error('Annuler charge error:', error);
      res.status(500).json({ error: 'Erreur lors de l\'annulation de la charge' });
    }
  },
};

export default chargeController;
