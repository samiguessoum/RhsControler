import { Response } from 'express';
import { prisma } from '../config/database.js';
import { FactureFournisseurStatut } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import { facturationEvents } from '../services/events.service.js';

const REF_PREFIX = 'FF';

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function generateReference(date: Date): Promise<string> {
  const annee = date.getFullYear();
  const counter = await prisma.compteurDocument.upsert({
    where: { type_annee: { type: 'FACTURE_FOURNISSEUR', annee } },
    update: { prochainNumero: { increment: 1 } },
    create: { type: 'FACTURE_FOURNISSEUR', annee, prochainNumero: 2 },
    select: { prochainNumero: true },
  });
  const numero = counter.prochainNumero - 1;
  return `${REF_PREFIX}${annee}-${String(numero).padStart(5, '0')}`;
}

function computeTotals(
  lignes: Array<{ totalHT: number; totalTVA: number }>,
  remiseGlobalPct?: number | null,
  remiseGlobalMontant?: number | null,
) {
  const totalHTBrut = lignes.reduce((sum, l) => sum + l.totalHT, 0);
  const totalTVABrut = lignes.reduce((sum, l) => sum + l.totalTVA, 0);

  let remise = 0;
  if (remiseGlobalMontant && remiseGlobalMontant > 0) {
    remise = remiseGlobalMontant;
  } else if (remiseGlobalPct && remiseGlobalPct > 0) {
    remise = totalHTBrut * (remiseGlobalPct / 100);
  }

  const totalHT = Math.max(totalHTBrut - remise, 0);
  const ratio = totalHTBrut > 0 ? totalHT / totalHTBrut : 0;
  const totalTVA = totalTVABrut * ratio;
  const totalTTC = totalHT + totalTVA;

  return { totalHT, totalTVA, totalTTC };
}

async function buildLignes(lignes: Array<any>): Promise<Array<any>> {
  const produitIds = lignes
    .map((ligne) => ligne.produitServiceId)
    .filter(Boolean);

  const produits = produitIds.length
    ? await prisma.produitService.findMany({
        where: { id: { in: produitIds } },
        select: {
          id: true,
          nom: true,
          unite: true,
          prixAchatHT: true,
          tauxTVA: true,
        },
      })
    : [];

  const produitMap = new Map(produits.map((p) => [p.id, p]));

  return lignes.map((ligne: any, index: number) => {
    const produit = ligne.produitServiceId ? produitMap.get(ligne.produitServiceId) : undefined;
    if (ligne.produitServiceId && !produit) {
      throw new Error('Produit/Service invalide');
    }

    const libelle = ligne.libelle || produit?.nom;
    if (!libelle) {
      throw new Error('Libellé de ligne requis');
    }

    const quantite = Number(ligne.quantite || 0);
    const prixUnitaireHT = Number(ligne.prixUnitaireHT ?? produit?.prixAchatHT ?? 0);
    const tauxTVA = Number(ligne.tauxTVA ?? produit?.tauxTVA ?? 0);
    const remisePct = Number(ligne.remisePct ?? 0);
    const totalHT = quantite * prixUnitaireHT * (1 - remisePct / 100);
    const totalTVA = totalHT * (tauxTVA / 100);
    const totalTTC = totalHT + totalTVA;

    return {
      produitServiceId: ligne.produitServiceId,
      libelle,
      description: ligne.description,
      quantite,
      unite: ligne.unite ?? produit?.unite,
      prixUnitaireHT,
      tauxTVA,
      remisePct,
      totalHT,
      totalTVA,
      totalTTC,
      ordre: ligne.ordre ?? index + 1,
    };
  });
}

function determineStatut(totalTTC: number, totalPaye: number, dateEcheance?: Date | null): FactureFournisseurStatut {
  if (totalPaye >= totalTTC) return 'PAYEE';
  if (totalPaye > 0) return 'PARTIELLEMENT_PAYEE';
  if (dateEcheance && dateEcheance < new Date()) return 'EN_RETARD';
  return 'VALIDEE';
}

export const factureFournisseurController = {
  // Liste des factures fournisseurs
  async list(req: AuthRequest, res: Response) {
    try {
      const { search, fournisseurId, statut, dateDebut, dateFin, page = '1', limit = '50' } = req.query;

      const where: any = {};
      if (fournisseurId) where.fournisseurId = fournisseurId;
      if (statut) where.statut = statut;
      if (search) {
        where.OR = [
          { ref: { contains: search as string, mode: 'insensitive' } },
          { refFournisseur: { contains: search as string, mode: 'insensitive' } },
          { fournisseur: { nomEntreprise: { contains: search as string, mode: 'insensitive' } } },
        ];
      }
      if (dateDebut || dateFin) {
        where.dateFacture = {};
        if (dateDebut) where.dateFacture.gte = new Date(dateDebut as string);
        if (dateFin) where.dateFacture.lte = new Date(dateFin as string);
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [factures, total] = await Promise.all([
        prisma.factureFournisseur.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { dateFacture: 'desc' },
          include: {
            fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
            commandeFournisseur: { select: { id: true, ref: true } },
            _count: { select: { lignes: true, paiements: true } },
          },
        }),
        prisma.factureFournisseur.count({ where }),
      ]);

      res.json({
        factures,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('List factures fournisseur error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Détail d'une facture
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const facture = await prisma.factureFournisseur.findUnique({
        where: { id },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true, code: true, siegeEmail: true, siegeTel: true, siegeAdresse: true } },
          commandeFournisseur: { select: { id: true, ref: true } },
          lignes: {
            orderBy: { ordre: 'asc' },
            include: {
              produitService: { select: { id: true, nom: true, reference: true } },
            },
          },
          paiements: {
            orderBy: { datePaiement: 'desc' },
            include: {
              modePaiement: { select: { id: true, libelle: true } },
            },
          },
        },
      });

      if (!facture) {
        return res.status(404).json({ error: 'Facture fournisseur non trouvée' });
      }

      res.json({ facture });
    } catch (error) {
      console.error('Get facture fournisseur error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Créer une facture
  async create(req: AuthRequest, res: Response) {
    try {
      const data = req.body;

      // Vérifier que le fournisseur existe et est un fournisseur
      const fournisseur = await prisma.client.findUnique({
        where: { id: data.fournisseurId },
      });
      if (!fournisseur || !fournisseur.actif) {
        return res.status(400).json({ error: 'Fournisseur non trouvé ou inactif' });
      }
      if (fournisseur.typeTiers !== 'FOURNISSEUR' && fournisseur.typeTiers !== 'CLIENT_FOURNISSEUR') {
        return res.status(400).json({ error: "Le tiers sélectionné n'est pas un fournisseur" });
      }

      const dateFacture = parseDate(data.dateFacture) ?? new Date();
      const lignes = await buildLignes(data.lignes);
      const totals = computeTotals(lignes, data.remiseGlobalPct, data.remiseGlobalMontant);
      const ref = data.ref || (await generateReference(dateFacture));

      // Utiliser une transaction pour garantir l'atomicité
      const facture = await prisma.$transaction(async (tx) => {
        const newFacture = await tx.factureFournisseur.create({
          data: {
            ref,
            refFournisseur: data.refFournisseur,
            fournisseurId: data.fournisseurId,
            commandeFournisseurId: data.commandeFournisseurId,
            dateFacture,
            dateReception: parseDate(data.dateReception),
            dateEcheance: parseDate(data.dateEcheance),
            statut: data.statut ?? 'BROUILLON',
            remiseGlobalPct: data.remiseGlobalPct,
            remiseGlobalMontant: data.remiseGlobalMontant,
            totalHT: totals.totalHT,
            totalTVA: totals.totalTVA,
            totalTTC: totals.totalTTC,
            totalPaye: 0,
            devise: data.devise,
            notes: data.notes,
            createdById: req.user?.id,
            updatedById: req.user?.id,
            lignes: { create: lignes },
          },
          include: {
            fournisseur: { select: { id: true, nomEntreprise: true } },
            lignes: true,
          },
        });

        return newFacture;
      });

      await createAuditLog(req.user!.id, 'CREATE', 'FactureFournisseur', facture.id, { after: facture });

      // Émettre l'événement de création
      facturationEvents.emitEvent({
        type: 'facture_fournisseur.created',
        entityId: facture.id,
        entityType: 'FactureFournisseur',
        data: {
          ref: facture.ref,
          fournisseurNom: facture.fournisseur.nomEntreprise,
          totalTTC: facture.totalTTC,
        },
        userId: req.user?.id,
        timestamp: new Date(),
      });

      res.status(201).json({ facture });
    } catch (error) {
      console.error('Create facture fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la facture fournisseur' });
    }
  },

  // Mettre à jour une facture
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.factureFournisseur.findUnique({
        where: { id },
        include: { lignes: true },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Facture fournisseur non trouvée' });
      }

      // Ne pas permettre la modification d'une facture payée
      if (existing.statut === 'PAYEE' && data.lignes) {
        return res.status(400).json({ error: 'Impossible de modifier les lignes d\'une facture payée' });
      }

      let lignesData = undefined;
      let totals = undefined;

      if (data.lignes) {
        lignesData = await buildLignes(data.lignes);
        totals = computeTotals(
          lignesData,
          data.remiseGlobalPct ?? existing.remiseGlobalPct,
          data.remiseGlobalMontant ?? existing.remiseGlobalMontant
        );
      } else if (data.remiseGlobalPct !== undefined || data.remiseGlobalMontant !== undefined) {
        totals = computeTotals(
          existing.lignes,
          data.remiseGlobalPct ?? existing.remiseGlobalPct,
          data.remiseGlobalMontant ?? existing.remiseGlobalMontant
        );
      }

      const facture = await prisma.factureFournisseur.update({
        where: { id },
        data: {
          refFournisseur: data.refFournisseur,
          dateFacture: parseDate(data.dateFacture),
          dateReception: parseDate(data.dateReception),
          dateEcheance: parseDate(data.dateEcheance),
          statut: data.statut,
          remiseGlobalPct: data.remiseGlobalPct,
          remiseGlobalMontant: data.remiseGlobalMontant,
          totalHT: totals?.totalHT,
          totalTVA: totals?.totalTVA,
          totalTTC: totals?.totalTTC,
          devise: data.devise,
          notes: data.notes,
          updatedById: req.user?.id,
          lignes: lignesData
            ? {
                deleteMany: {},
                create: lignesData,
              }
            : undefined,
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
          lignes: true,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'FactureFournisseur', facture.id, { after: facture });

      res.json({ facture });
    } catch (error) {
      console.error('Update facture fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour de la facture fournisseur' });
    }
  },

  // Supprimer une facture
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.factureFournisseur.findUnique({
        where: { id },
        include: { paiements: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Facture fournisseur non trouvée' });
      }

      if (existing.statut !== 'BROUILLON' && existing.statut !== 'ANNULEE') {
        return res.status(400).json({ error: 'Seules les factures en brouillon ou annulées peuvent être supprimées' });
      }

      if (existing.paiements.length > 0) {
        return res.status(400).json({ error: 'Impossible de supprimer une facture avec des paiements' });
      }

      await prisma.factureFournisseur.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'FactureFournisseur', id);

      res.json({ message: 'Facture fournisseur supprimée' });
    } catch (error) {
      console.error('Delete facture fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la facture fournisseur' });
    }
  },

  // Ajouter un paiement
  async createPaiement(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { montant, datePaiement, modePaiementId, reference, banque, notes } = req.body;

      const facture = await prisma.factureFournisseur.findUnique({
        where: { id },
        include: { fournisseur: { select: { nomEntreprise: true } } },
      });

      if (!facture) {
        return res.status(404).json({ error: 'Facture fournisseur non trouvée' });
      }

      if (facture.statut === 'BROUILLON') {
        return res.status(400).json({ error: 'Impossible d\'ajouter un paiement à une facture en brouillon' });
      }

      if (facture.statut === 'ANNULEE') {
        return res.status(400).json({ error: 'Impossible d\'ajouter un paiement à une facture annulée' });
      }

      const resteAPayer = facture.totalTTC - facture.totalPaye;
      if (montant > resteAPayer) {
        return res.status(400).json({ error: `Le montant dépasse le reste à payer (${resteAPayer.toFixed(2)})` });
      }

      // Utiliser une transaction pour garantir l'atomicité
      const { paiement, nouveauStatut, nouveauMontantPaye } = await prisma.$transaction(async (tx) => {
        const newPaiement = await tx.paiementFournisseur.create({
          data: {
            factureFournisseurId: id,
            modePaiementId,
            datePaiement: parseDate(datePaiement) ?? new Date(),
            montant,
            reference,
            banque,
            notes,
            createdById: req.user?.id,
          },
          include: {
            modePaiement: { select: { id: true, libelle: true } },
          },
        });

        // Mettre à jour le montant payé et le statut
        const newMontantPaye = facture.totalPaye + montant;
        const newStatut = determineStatut(facture.totalTTC, newMontantPaye, facture.dateEcheance);

        await tx.factureFournisseur.update({
          where: { id },
          data: {
            totalPaye: newMontantPaye,
            statut: newStatut,
            updatedById: req.user?.id,
          },
        });

        return { paiement: newPaiement, nouveauStatut: newStatut, nouveauMontantPaye: newMontantPaye };
      });

      await createAuditLog(req.user!.id, 'CREATE', 'PaiementFournisseur', paiement.id, { after: paiement });

      // Émettre des événements selon le statut
      if (nouveauStatut === 'PAYEE') {
        facturationEvents.emitEvent({
          type: 'facture_fournisseur.paid',
          entityId: facture.id,
          entityType: 'FactureFournisseur',
          data: {
            ref: facture.ref,
            fournisseurNom: facture.fournisseur.nomEntreprise,
            totalTTC: facture.totalTTC,
          },
          userId: req.user?.id,
          timestamp: new Date(),
        });
      }

      res.status(201).json({ paiement, nouveauStatut, montantPaye: nouveauMontantPaye });
    } catch (error) {
      console.error('Create paiement fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la création du paiement' });
    }
  },

  // Supprimer un paiement
  async deletePaiement(req: AuthRequest, res: Response) {
    try {
      const { id, paiementId } = req.params;

      const paiement = await prisma.paiementFournisseur.findUnique({
        where: { id: paiementId },
        include: { factureFournisseur: true },
      });

      if (!paiement || paiement.factureFournisseurId !== id) {
        return res.status(404).json({ error: 'Paiement non trouvé' });
      }

      await prisma.paiementFournisseur.delete({ where: { id: paiementId } });

      // Mettre à jour le montant payé et le statut
      const facture = paiement.factureFournisseur;
      const nouveauMontantPaye = Math.max(0, facture.totalPaye - paiement.montant);
      const nouveauStatut = determineStatut(facture.totalTTC, nouveauMontantPaye, facture.dateEcheance);

      await prisma.factureFournisseur.update({
        where: { id },
        data: {
          totalPaye: nouveauMontantPaye,
          statut: nouveauStatut,
          updatedById: req.user?.id,
        },
      });

      await createAuditLog(req.user!.id, 'DELETE', 'PaiementFournisseur', paiementId);

      res.json({ message: 'Paiement supprimé', nouveauStatut, montantPaye: nouveauMontantPaye });
    } catch (error) {
      console.error('Delete paiement fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du paiement' });
    }
  },

  // Créer une facture depuis une commande fournisseur
  async convertirFromCommande(req: AuthRequest, res: Response) {
    try {
      const { commandeId } = req.params;
      const data = req.body;

      const commande = await prisma.commandeFournisseur.findUnique({
        where: { id: commandeId },
        include: {
          fournisseur: true,
          lignes: {
            include: { produitService: true },
          },
        },
      });

      if (!commande) {
        return res.status(404).json({ error: 'Commande fournisseur non trouvée' });
      }

      // Vérifier si une facture existe déjà pour cette commande
      const factureExistante = await prisma.factureFournisseur.findFirst({
        where: { commandeFournisseurId: commandeId },
      });

      if (factureExistante) {
        return res.status(400).json({
          error: 'Une facture existe déjà pour cette commande',
          factureId: factureExistante.id,
        });
      }

      const dateFacture = parseDate(data.dateFacture) ?? new Date();
      const ref = await generateReference(dateFacture);

      // Construire les lignes depuis la commande
      const lignes = commande.lignes.map((ligne, index) => ({
        produitServiceId: ligne.produitServiceId,
        libelle: ligne.libelle,
        description: ligne.description,
        quantite: ligne.quantite,
        unite: ligne.unite,
        prixUnitaireHT: ligne.prixUnitaireHT,
        tauxTVA: ligne.tauxTVA,
        remisePct: ligne.remisePct,
        totalHT: ligne.totalHT,
        totalTVA: ligne.totalTVA,
        totalTTC: ligne.totalTTC,
        ordre: index + 1,
      }));

      const totals = computeTotals(lignes, commande.remiseGlobalPct, commande.remiseGlobalMontant);

      const facture = await prisma.factureFournisseur.create({
        data: {
          ref,
          refFournisseur: data.refFournisseur,
          fournisseurId: commande.fournisseurId,
          commandeFournisseurId: commandeId,
          dateFacture,
          dateReception: parseDate(data.dateReception),
          dateEcheance: parseDate(data.dateEcheance),
          statut: 'BROUILLON',
          remiseGlobalPct: commande.remiseGlobalPct,
          remiseGlobalMontant: commande.remiseGlobalMontant,
          totalHT: totals.totalHT,
          totalTVA: totals.totalTVA,
          totalTTC: totals.totalTTC,
          totalPaye: 0,
          devise: commande.devise,
          notes: data.notes || commande.notes,
          createdById: req.user?.id,
          updatedById: req.user?.id,
          lignes: { create: lignes },
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
          commandeFournisseur: { select: { id: true, ref: true } },
          lignes: true,
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'FactureFournisseur', facture.id, {
        after: facture,
      });

      res.status(201).json({ facture });
    } catch (error) {
      console.error('Convertir commande en facture error:', error);
      res.status(500).json({ error: 'Erreur lors de la conversion de la commande en facture' });
    }
  },

  // Valider une facture fournisseur (passer de BROUILLON à VALIDEE)
  async valider(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.factureFournisseur.findUnique({
        where: { id },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Facture fournisseur non trouvée' });
      }

      if (existing.statut !== 'BROUILLON') {
        return res.status(400).json({ error: 'Seules les factures en brouillon peuvent être validées' });
      }

      const facture = await prisma.factureFournisseur.update({
        where: { id },
        data: {
          statut: 'VALIDEE',
          updatedById: req.user?.id,
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
          lignes: true,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'FactureFournisseur', facture.id, {
        before: { statut: 'BROUILLON' },
        after: { statut: 'VALIDEE' },
      });

      // Émettre un événement de validation
      facturationEvents.emitEvent({
        type: 'facture_fournisseur.validated',
        entityId: facture.id,
        entityType: 'FactureFournisseur',
        data: {
          ref: facture.ref,
          fournisseurNom: facture.fournisseur.nomEntreprise,
          totalTTC: facture.totalTTC,
        },
        userId: req.user?.id,
        timestamp: new Date(),
      });

      res.json({ facture, message: 'Facture fournisseur validée avec succès' });
    } catch (error) {
      console.error('Valider facture fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la validation de la facture fournisseur' });
    }
  },

  // Export PDF
  async exportPDF(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const facture = await prisma.factureFournisseur.findUnique({
        where: { id },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true, code: true, siegeAdresse: true, siegeEmail: true, siegeTel: true } },
          lignes: { orderBy: { ordre: 'asc' } },
          paiements: {
            orderBy: { datePaiement: 'desc' },
            include: { modePaiement: { select: { libelle: true } } },
          },
        },
      });

      if (!facture) {
        return res.status(404).json({ error: 'Facture fournisseur non trouvée' });
      }

      const { generateFactureFournisseurPDF } = await import('../services/pdf.service.js');
      const pdfBuffer = await generateFactureFournisseurPDF(facture as any);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${facture.ref}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Export facture fournisseur PDF error:', error);
      res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
  },
};

export default factureFournisseurController;
