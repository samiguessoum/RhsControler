import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';

const DEFAULT_PREFIX = 'CF';

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
  const prefix = settings?.prefixCommandeFournisseur || DEFAULT_PREFIX;
  const longueur = settings?.longueurNumero || 4;
  const separateur = settings?.separateur ?? '/';
  const inclureAnnee = settings?.inclureAnnee ?? true;
  const offset = settings?.offsetCommandeFournisseur || 0;

  const counter = await prisma.compteurDocument.upsert({
    where: { type_annee: { type: 'COMMANDE_FOURNISSEUR', annee } },
    update: { prochainNumero: { increment: 1 } },
    create: { type: 'COMMANDE_FOURNISSEUR', annee, prochainNumero: 2 },
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
    // Pour les commandes fournisseurs, on utilise prixAchatHT
    const prixUnitaireHT = Number(
      ligne.prixUnitaireHT ?? produit?.prixAchatHT ?? 0
    );
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
      quantiteRecue: ligne.quantiteRecue ?? 0,
      ordre: ligne.ordre ?? index + 1,
    };
  });
}

export const commandeFournisseurController = {
  // Liste des commandes fournisseurs
  async list(req: AuthRequest, res: Response) {
    try {
      const { search, fournisseurId, statut, page = '1', limit = '50' } = req.query;

      const where: any = {};
      if (fournisseurId) where.fournisseurId = fournisseurId;
      if (statut) where.statut = statut;
      if (search) {
        where.OR = [
          { ref: { contains: search as string, mode: 'insensitive' } },
          { fournisseur: { nomEntreprise: { contains: search as string, mode: 'insensitive' } } },
        ];
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [commandes, total] = await Promise.all([
        prisma.commandeFournisseur.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { dateCommande: 'desc' },
          include: {
            fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
            _count: { select: { lignes: true } },
          },
        }),
        prisma.commandeFournisseur.count({ where }),
      ]);

      res.json({
        commandes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('List commandes fournisseur error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Détail d'une commande
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const commande = await prisma.commandeFournisseur.findUnique({
        where: { id },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
          lignes: {
            orderBy: { ordre: 'asc' },
            include: {
              produitService: { select: { id: true, nom: true, reference: true } },
            },
          },
        },
      });

      if (!commande) {
        return res.status(404).json({ error: 'Commande fournisseur non trouvée' });
      }

      res.json({ commande });
    } catch (error) {
      console.error('Get commande fournisseur error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // Créer une commande
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
        return res.status(400).json({ error: 'Le tiers sélectionné n\'est pas un fournisseur' });
      }

      const dateCommande = parseDate(data.dateCommande) ?? new Date();
      const lignes = await buildLignes(data.lignes);
      const totals = computeTotals(lignes, data.remiseGlobalPct, data.remiseGlobalMontant);
      const ref = data.ref || (await generateReference(dateCommande));

      const commande = await prisma.commandeFournisseur.create({
        data: {
          ref,
          fournisseurId: data.fournisseurId,
          dateCommande,
          dateLivraisonSouhaitee: parseDate(data.dateLivraisonSouhaitee),
          statut: data.statut ?? 'BROUILLON',
          remiseGlobalPct: data.remiseGlobalPct,
          remiseGlobalMontant: data.remiseGlobalMontant,
          totalHT: totals.totalHT,
          totalTVA: totals.totalTVA,
          totalTTC: totals.totalTTC,
          devise: data.devise,
          notes: data.notes,
          conditions: data.conditions,
          createdById: req.user?.id,
          updatedById: req.user?.id,
          lignes: { create: lignes },
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
          lignes: true,
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'CommandeFournisseur', commande.id, { after: commande });

      res.status(201).json({ commande });
    } catch (error) {
      console.error('Create commande fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la commande fournisseur' });
    }
  },

  // Mettre à jour une commande
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.commandeFournisseur.findUnique({
        where: { id },
        include: { lignes: true },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Commande fournisseur non trouvée' });
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

      const commande = await prisma.commandeFournisseur.update({
        where: { id },
        data: {
          dateCommande: parseDate(data.dateCommande),
          dateLivraisonSouhaitee: parseDate(data.dateLivraisonSouhaitee),
          dateLivraison: parseDate(data.dateLivraison),
          statut: data.statut,
          remiseGlobalPct: data.remiseGlobalPct,
          remiseGlobalMontant: data.remiseGlobalMontant,
          totalHT: totals?.totalHT,
          totalTVA: totals?.totalTVA,
          totalTTC: totals?.totalTTC,
          devise: data.devise,
          notes: data.notes,
          conditions: data.conditions,
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

      await createAuditLog(req.user!.id, 'UPDATE', 'CommandeFournisseur', commande.id, { after: commande });

      res.json({ commande });
    } catch (error) {
      console.error('Update commande fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour de la commande fournisseur' });
    }
  },

  // Supprimer une commande
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await prisma.commandeFournisseur.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'CommandeFournisseur', id);
      res.json({ message: 'Commande fournisseur supprimée' });
    } catch (error) {
      console.error('Delete commande fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la commande fournisseur' });
    }
  },

  // Marquer une commande comme reçue
  async reception(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { lignes, dateLivraison } = req.body;

      const existing = await prisma.commandeFournisseur.findUnique({
        where: { id },
        include: { lignes: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Commande fournisseur non trouvée' });
      }

      // Mettre à jour les quantités reçues si fournies
      if (lignes && Array.isArray(lignes)) {
        for (const ligne of lignes) {
          if (ligne.id && ligne.quantiteRecue !== undefined) {
            await prisma.commandeFournisseurLigne.update({
              where: { id: ligne.id },
              data: { quantiteRecue: ligne.quantiteRecue },
            });
          }
        }
      }

      // Déterminer le statut
      const updatedLignes = await prisma.commandeFournisseurLigne.findMany({
        where: { commandeFournisseurId: id },
      });

      const toutRecu = updatedLignes.every((l) => l.quantiteRecue >= l.quantite);
      const partielRecu = updatedLignes.some((l) => l.quantiteRecue > 0);

      let newStatut = existing.statut;
      if (toutRecu) {
        newStatut = 'RECUE';
      } else if (partielRecu) {
        newStatut = 'EN_RECEPTION';
      }

      const commande = await prisma.commandeFournisseur.update({
        where: { id },
        data: {
          statut: newStatut,
          dateLivraison: parseDate(dateLivraison) ?? (toutRecu ? new Date() : undefined),
          updatedById: req.user?.id,
        },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
          lignes: {
            include: {
              produitService: { select: { id: true, nom: true, reference: true } },
            },
          },
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'CommandeFournisseur', commande.id, { after: commande });

      res.json({ commande, message: toutRecu ? 'Commande entièrement reçue' : 'Réception partielle enregistrée' });
    } catch (error) {
      console.error('Reception commande fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la réception' });
    }
  },

  // Valider une commande fournisseur (passer de BROUILLON à VALIDEE)
  async valider(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.commandeFournisseur.findUnique({
        where: { id },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true } },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Commande fournisseur non trouvée' });
      }

      if (existing.statut !== 'BROUILLON') {
        return res.status(400).json({ error: 'Seules les commandes en brouillon peuvent être validées' });
      }

      const commande = await prisma.commandeFournisseur.update({
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

      await createAuditLog(req.user!.id, 'UPDATE', 'CommandeFournisseur', commande.id, {
        before: { statut: 'BROUILLON' },
        after: { statut: 'VALIDEE' },
      });

      res.json({ commande, message: 'Commande fournisseur validée avec succès' });
    } catch (error) {
      console.error('Valider commande fournisseur error:', error);
      res.status(500).json({ error: 'Erreur lors de la validation de la commande fournisseur' });
    }
  },

  // Export PDF
  async exportPDF(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const commande = await prisma.commandeFournisseur.findUnique({
        where: { id },
        include: {
          fournisseur: { select: { id: true, nomEntreprise: true, code: true } },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });

      if (!commande) {
        return res.status(404).json({ error: 'Commande fournisseur non trouvée' });
      }

      const { generateCommandeFournisseurPDF } = await import('../services/pdf.service.js');
      const pdfBuffer = await generateCommandeFournisseurPDF({
        ...commande,
        client: commande.fournisseur, // Pour compatibilité avec le template PDF
      } as any);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${commande.ref}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Export commande fournisseur PDF error:', error);
      res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
  },
};

export default commandeFournisseurController;
