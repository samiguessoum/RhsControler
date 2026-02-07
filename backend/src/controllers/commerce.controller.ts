import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import { generateDevisPDF, generateCommandePDF, generateFacturePDF } from '../services/pdf.service.js';

const REF_PREFIX: Record<'DEVIS' | 'COMMANDE' | 'FACTURE' | 'FACTURE_AVOIR', string> = {
  DEVIS: 'DV',
  COMMANDE: 'CMD',
  FACTURE: 'FAC',
  FACTURE_AVOIR: 'AV',
};

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function generateReference(type: 'DEVIS' | 'COMMANDE' | 'FACTURE' | 'FACTURE_AVOIR', date: Date): Promise<string> {
  const annee = date.getFullYear();
  const counter = await prisma.compteurDocument.upsert({
    where: { type_annee: { type, annee } },
    update: { prochainNumero: { increment: 1 } },
    create: { type, annee, prochainNumero: 2 },
    select: { prochainNumero: true },
  });
  const numero = counter.prochainNumero - 1;
  return `${REF_PREFIX[type]}${annee}-${String(numero).padStart(5, '0')}`;
}

function computeTotals(
  lignes: Array<{ totalHT: number; totalTVA: number }>,
  remiseGlobalPct?: number | null,
  remiseGlobalMontant?: number | null,
  sign: number = 1,
) {
  const totalHTBrut = lignes.reduce((sum, l) => sum + l.totalHT, 0) * sign;
  const totalTVABrut = lignes.reduce((sum, l) => sum + l.totalTVA, 0) * sign;

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

async function buildLignes(
  lignes: Array<any>,
  sign: number = 1
): Promise<Array<any>> {
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
          prixVenteHT: true,
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
    const prixUnitaireHT = Number(
      ligne.prixUnitaireHT ?? produit?.prixVenteHT ?? 0
    );
    const tauxTVA = Number(ligne.tauxTVA ?? produit?.tauxTVA ?? 0);
    const remisePct = Number(ligne.remisePct ?? 0);
    const totalHT = quantite * prixUnitaireHT * (1 - remisePct / 100) * sign;
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

async function updateFacturePaiementStatus(factureId: string) {
  const facture = await prisma.facture.findUnique({
    where: { id: factureId },
    include: { paiements: { where: { statut: 'RECU' } } },
  });

  if (!facture) return;
  if (facture.statut === 'BROUILLON' || facture.statut === 'ANNULEE') return;

  const totalPaye = facture.paiements.reduce((sum, p) => sum + p.montant, 0);
  let statut = facture.statut;

  if (facture.totalTTC <= 0) {
    statut = 'PAYEE';
  } else if (totalPaye <= 0) {
    statut = 'VALIDEE';
  } else if (totalPaye < facture.totalTTC) {
    statut = 'PARTIELLEMENT_PAYEE';
  } else {
    statut = 'PAYEE';
  }

  await prisma.facture.update({
    where: { id: factureId },
    data: { totalPaye, statut },
  });
}

export const commerceController = {
  // ============ DEVIS ============
  async listDevis(req: AuthRequest, res: Response) {
    try {
      const { search, clientId, statut, page = '1', limit = '50' } = req.query;

      const where: any = {};
      if (clientId) where.clientId = clientId;
      if (statut) where.statut = statut;
      if (search) {
        where.OR = [
          { ref: { contains: search as string, mode: 'insensitive' } },
          { client: { nomEntreprise: { contains: search as string, mode: 'insensitive' } } },
        ];
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [devis, total] = await Promise.all([
        prisma.devis.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { dateDevis: 'desc' },
          include: {
            client: { select: { id: true, nomEntreprise: true } },
            _count: { select: { lignes: true } },
          },
        }),
        prisma.devis.count({ where }),
      ]);

      res.json({
        devis,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('List devis error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getDevis(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const devis = await prisma.devis.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, nomEntreprise: true, code: true } },
          lignes: {
            orderBy: { ordre: 'asc' },
            include: {
              produitService: { select: { id: true, nom: true, reference: true } },
            },
          },
        },
      });

      if (!devis) {
        return res.status(404).json({ error: 'Devis non trouvé' });
      }

      res.json({ devis });
    } catch (error) {
      console.error('Get devis error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createDevis(req: AuthRequest, res: Response) {
    try {
      const data = req.body;

      const client = await prisma.client.findUnique({ where: { id: data.clientId } });
      if (!client || !client.actif) {
        return res.status(400).json({ error: 'Client non trouvé ou inactif' });
      }

      const dateDevis = parseDate(data.dateDevis) ?? new Date();
      const lignes = await buildLignes(data.lignes);
      const totals = computeTotals(lignes, data.remiseGlobalPct, data.remiseGlobalMontant);
      const ref = data.ref || (await generateReference('DEVIS', dateDevis));

      const devis = await prisma.devis.create({
        data: {
          ref,
          clientId: data.clientId,
          adresseFacturationId: data.adresseFacturationId,
          adresseLivraisonId: data.adresseLivraisonId,
          dateDevis,
          dateValidite: parseDate(data.dateValidite),
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
          client: { select: { id: true, nomEntreprise: true } },
          lignes: true,
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Devis', devis.id, { after: devis });

      res.status(201).json({ devis });
    } catch (error) {
      console.error('Create devis error:', error);
      res.status(500).json({ error: 'Erreur lors de la création du devis' });
    }
  },

  async updateDevis(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.devis.findUnique({
        where: { id },
        include: { lignes: true },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Devis non trouvé' });
      }

      let lignesData = undefined;
      let totals = undefined;

      if (data.lignes) {
        lignesData = await buildLignes(data.lignes);
        totals = computeTotals(lignesData, data.remiseGlobalPct ?? existing.remiseGlobalPct, data.remiseGlobalMontant ?? existing.remiseGlobalMontant);
      } else if (data.remiseGlobalPct !== undefined || data.remiseGlobalMontant !== undefined) {
        totals = computeTotals(existing.lignes, data.remiseGlobalPct ?? existing.remiseGlobalPct, data.remiseGlobalMontant ?? existing.remiseGlobalMontant);
      }

      const devis = await prisma.devis.update({
        where: { id },
        data: {
          adresseFacturationId: data.adresseFacturationId,
          adresseLivraisonId: data.adresseLivraisonId,
          dateDevis: parseDate(data.dateDevis),
          dateValidite: parseDate(data.dateValidite),
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
          client: { select: { id: true, nomEntreprise: true } },
          lignes: true,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Devis', devis.id, { after: devis });

      res.json({ devis });
    } catch (error) {
      console.error('Update devis error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du devis' });
    }
  },

  async deleteDevis(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await prisma.devis.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'Devis', id);
      res.json({ message: 'Devis supprimé' });
    } catch (error) {
      console.error('Delete devis error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du devis' });
    }
  },

  async convertirDevisCommande(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const devis = await prisma.devis.findUnique({
        where: { id },
        include: { lignes: true },
      });

      if (!devis) {
        return res.status(404).json({ error: 'Devis non trouvé' });
      }

      const ref = await generateReference('COMMANDE', new Date());

      const commande = await prisma.commande.create({
        data: {
          ref,
          clientId: devis.clientId,
          devisId: devis.id,
          adresseFacturationId: devis.adresseFacturationId ?? undefined,
          adresseLivraisonId: devis.adresseLivraisonId ?? undefined,
          dateCommande: new Date(),
          statut: 'BROUILLON',
          remiseGlobalPct: devis.remiseGlobalPct,
          remiseGlobalMontant: devis.remiseGlobalMontant,
          totalHT: devis.totalHT,
          totalTVA: devis.totalTVA,
          totalTTC: devis.totalTTC,
          devise: devis.devise,
          notes: devis.notes,
          conditions: devis.conditions,
          createdById: req.user?.id,
          updatedById: req.user?.id,
          lignes: {
            create: devis.lignes.map((ligne) => ({
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
              ordre: ligne.ordre,
            })),
          },
        },
        include: { client: { select: { id: true, nomEntreprise: true } }, lignes: true },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Commande', commande.id, { after: commande });

      res.status(201).json({ commande, message: 'Commande créée à partir du devis' });
    } catch (error) {
      console.error('Convert devis -> commande error:', error);
      res.status(500).json({ error: 'Erreur lors de la conversion' });
    }
  },

  // ============ COMMANDES ============
  async listCommandes(req: AuthRequest, res: Response) {
    try {
      const { search, clientId, statut, page = '1', limit = '50' } = req.query;

      const where: any = {};
      if (clientId) where.clientId = clientId;
      if (statut) where.statut = statut;
      if (search) {
        where.OR = [
          { ref: { contains: search as string, mode: 'insensitive' } },
          { client: { nomEntreprise: { contains: search as string, mode: 'insensitive' } } },
        ];
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [commandes, total] = await Promise.all([
        prisma.commande.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { dateCommande: 'desc' },
          include: {
            client: { select: { id: true, nomEntreprise: true } },
            _count: { select: { lignes: true } },
          },
        }),
        prisma.commande.count({ where }),
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
      console.error('List commandes error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getCommande(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const commande = await prisma.commande.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, nomEntreprise: true, code: true } },
          lignes: {
            orderBy: { ordre: 'asc' },
            include: {
              produitService: { select: { id: true, nom: true, reference: true } },
            },
          },
        },
      });

      if (!commande) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      res.json({ commande });
    } catch (error) {
      console.error('Get commande error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createCommande(req: AuthRequest, res: Response) {
    try {
      const data = req.body;

      const client = await prisma.client.findUnique({ where: { id: data.clientId } });
      if (!client || !client.actif) {
        return res.status(400).json({ error: 'Client non trouvé ou inactif' });
      }

      const dateCommande = parseDate(data.dateCommande) ?? new Date();
      const lignes = await buildLignes(data.lignes);
      const totals = computeTotals(lignes, data.remiseGlobalPct, data.remiseGlobalMontant);
      const ref = data.ref || (await generateReference('COMMANDE', dateCommande));

      const commande = await prisma.commande.create({
        data: {
          ref,
          clientId: data.clientId,
          devisId: data.devisId,
          adresseFacturationId: data.adresseFacturationId,
          adresseLivraisonId: data.adresseLivraisonId,
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
        include: { client: { select: { id: true, nomEntreprise: true } }, lignes: true },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Commande', commande.id, { after: commande });

      res.status(201).json({ commande });
    } catch (error) {
      console.error('Create commande error:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la commande' });
    }
  },

  async updateCommande(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.commande.findUnique({
        where: { id },
        include: { lignes: true },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      let lignesData = undefined;
      let totals = undefined;

      if (data.lignes) {
        lignesData = await buildLignes(data.lignes);
        totals = computeTotals(lignesData, data.remiseGlobalPct ?? existing.remiseGlobalPct, data.remiseGlobalMontant ?? existing.remiseGlobalMontant);
      } else if (data.remiseGlobalPct !== undefined || data.remiseGlobalMontant !== undefined) {
        totals = computeTotals(existing.lignes, data.remiseGlobalPct ?? existing.remiseGlobalPct, data.remiseGlobalMontant ?? existing.remiseGlobalMontant);
      }

      const commande = await prisma.commande.update({
        where: { id },
        data: {
          adresseFacturationId: data.adresseFacturationId,
          adresseLivraisonId: data.adresseLivraisonId,
          dateCommande: parseDate(data.dateCommande),
          dateLivraisonSouhaitee: parseDate(data.dateLivraisonSouhaitee),
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
        include: { client: { select: { id: true, nomEntreprise: true } }, lignes: true },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Commande', commande.id, { after: commande });

      res.json({ commande });
    } catch (error) {
      console.error('Update commande error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour de la commande' });
    }
  },

  async deleteCommande(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await prisma.commande.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'Commande', id);
      res.json({ message: 'Commande supprimée' });
    } catch (error) {
      console.error('Delete commande error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la commande' });
    }
  },

  async convertirCommandeFacture(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const commande = await prisma.commande.findUnique({
        where: { id },
        include: { lignes: true },
      });

      if (!commande) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      const ref = await generateReference('FACTURE', new Date());

      const facture = await prisma.facture.create({
        data: {
          ref,
          clientId: commande.clientId,
          devisId: commande.devisId,
          commandeId: commande.id,
          adresseFacturationId: commande.adresseFacturationId ?? undefined,
          adresseLivraisonId: commande.adresseLivraisonId ?? undefined,
          dateFacture: new Date(),
          statut: 'BROUILLON',
          remiseGlobalPct: commande.remiseGlobalPct,
          remiseGlobalMontant: commande.remiseGlobalMontant,
          totalHT: commande.totalHT,
          totalTVA: commande.totalTVA,
          totalTTC: commande.totalTTC,
          devise: commande.devise,
          notes: commande.notes,
          conditions: commande.conditions,
          createdById: req.user?.id,
          updatedById: req.user?.id,
          lignes: {
            create: commande.lignes.map((ligne) => ({
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
              ordre: ligne.ordre,
            })),
          },
        },
        include: { client: { select: { id: true, nomEntreprise: true } }, lignes: true },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Facture', facture.id, { after: facture });

      res.status(201).json({ facture, message: 'Facture créée à partir de la commande' });
    } catch (error) {
      console.error('Convert commande -> facture error:', error);
      res.status(500).json({ error: 'Erreur lors de la conversion' });
    }
  },

  // ============ FACTURES ============
  async listFactures(req: AuthRequest, res: Response) {
    try {
      const { search, clientId, statut, type, page = '1', limit = '50' } = req.query;

      const where: any = {};
      if (clientId) where.clientId = clientId;
      if (statut) where.statut = statut;
      if (type) where.type = type;
      if (search) {
        where.OR = [
          { ref: { contains: search as string, mode: 'insensitive' } },
          { client: { nomEntreprise: { contains: search as string, mode: 'insensitive' } } },
        ];
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [factures, total] = await Promise.all([
        prisma.facture.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { dateFacture: 'desc' },
          include: {
            client: { select: { id: true, nomEntreprise: true } },
            _count: { select: { lignes: true, paiements: true } },
          },
        }),
        prisma.facture.count({ where }),
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
      console.error('List factures error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async getFacture(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const facture = await prisma.facture.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, nomEntreprise: true, code: true } },
          lignes: {
            orderBy: { ordre: 'asc' },
            include: {
              produitService: { select: { id: true, nom: true, reference: true } },
            },
          },
          paiements: {
            orderBy: { datePaiement: 'desc' },
          },
          relances: {
            orderBy: { dateRelance: 'desc' },
            include: { createdBy: { select: { id: true, nom: true, prenom: true } } },
          },
        },
      });

      if (!facture) {
        return res.status(404).json({ error: 'Facture non trouvée' });
      }

      res.json({ facture });
    } catch (error) {
      console.error('Get facture error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createFacture(req: AuthRequest, res: Response) {
    try {
      const data = req.body;

      const client = await prisma.client.findUnique({ where: { id: data.clientId } });
      if (!client || !client.actif) {
        return res.status(400).json({ error: 'Client non trouvé ou inactif' });
      }

      const dateFacture = parseDate(data.dateFacture) ?? new Date();
      const factureType = data.type ?? 'FACTURE';
      const sign = factureType === 'AVOIR' ? -1 : 1;
      const lignes = await buildLignes(data.lignes, sign);
      const totals = computeTotals(lignes, data.remiseGlobalPct, data.remiseGlobalMontant, 1);
      const refType = factureType === 'AVOIR' ? 'FACTURE_AVOIR' : 'FACTURE';
      const ref = data.ref || (await generateReference(refType, dateFacture));
      const statut = data.statut ?? (factureType === 'AVOIR' ? 'VALIDEE' : 'BROUILLON');

      const facture = await prisma.facture.create({
        data: {
          ref,
          clientId: data.clientId,
          devisId: data.devisId,
          commandeId: data.commandeId,
          adresseFacturationId: data.adresseFacturationId,
          adresseLivraisonId: data.adresseLivraisonId,
          dateFacture,
          dateEcheance: parseDate(data.dateEcheance),
          type: factureType,
          statut,
          remiseGlobalPct: data.remiseGlobalPct,
          remiseGlobalMontant: data.remiseGlobalMontant,
          totalHT: totals.totalHT,
          totalTVA: totals.totalTVA,
          totalTTC: totals.totalTTC,
          totalPaye: 0,
          devise: data.devise,
          notes: data.notes,
          conditions: data.conditions,
          createdById: req.user?.id,
          updatedById: req.user?.id,
          lignes: { create: lignes },
        },
        include: { client: { select: { id: true, nomEntreprise: true } }, lignes: true },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Facture', facture.id, { after: facture });

      res.status(201).json({ facture });
    } catch (error) {
      console.error('Create facture error:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la facture' });
    }
  },

  async updateFacture(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.facture.findUnique({
        where: { id },
        include: { lignes: true },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Facture non trouvée' });
      }

      let lignesData = undefined;
      let totals = undefined;
      const nextType = data.type ?? existing.type;
      const sign = nextType === 'AVOIR' ? -1 : 1;

      if (data.lignes) {
        lignesData = await buildLignes(data.lignes, sign);
        totals = computeTotals(lignesData, data.remiseGlobalPct ?? existing.remiseGlobalPct, data.remiseGlobalMontant ?? existing.remiseGlobalMontant, 1);
      } else if (data.remiseGlobalPct !== undefined || data.remiseGlobalMontant !== undefined || data.type !== undefined) {
        const baseLines = existing.lignes.map((l) => ({
          totalHT: Math.abs(l.totalHT),
          totalTVA: Math.abs(l.totalTVA),
        }));
        totals = computeTotals(baseLines, data.remiseGlobalPct ?? existing.remiseGlobalPct, data.remiseGlobalMontant ?? existing.remiseGlobalMontant, sign);
      }

      const facture = await prisma.facture.update({
        where: { id },
        data: {
          adresseFacturationId: data.adresseFacturationId,
          adresseLivraisonId: data.adresseLivraisonId,
          dateFacture: parseDate(data.dateFacture),
          dateEcheance: parseDate(data.dateEcheance),
          type: data.type,
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
        include: { client: { select: { id: true, nomEntreprise: true } }, lignes: true },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Facture', facture.id, { after: facture });

      res.json({ facture });
    } catch (error) {
      console.error('Update facture error:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour de la facture' });
    }
  },

  async deleteFacture(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await prisma.facture.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'Facture', id);
      res.json({ message: 'Facture supprimée' });
    } catch (error) {
      console.error('Delete facture error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression de la facture' });
    }
  },

  // Relances factures clients
  async listRelances(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const relances = await prisma.factureRelance.findMany({
        where: { factureId: id },
        orderBy: { dateRelance: 'desc' },
        include: { createdBy: { select: { id: true, nom: true, prenom: true } } },
      });
      res.json({ relances });
    } catch (error) {
      console.error('List relances error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  async createRelance(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const facture = await prisma.facture.findUnique({ where: { id } });
      if (!facture) {
        return res.status(404).json({ error: 'Facture non trouvée' });
      }

      const relance = await prisma.factureRelance.create({
        data: {
          factureId: id,
          niveau: data.niveau ?? 1,
          canal: data.canal,
          commentaire: data.commentaire,
          dateRelance: parseDate(data.dateRelance) ?? new Date(),
          createdById: req.user?.id,
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'FactureRelance', relance.id, { after: relance });
      res.status(201).json({ relance });
    } catch (error) {
      console.error('Create relance error:', error);
      res.status(500).json({ error: 'Erreur lors de la création de la relance' });
    }
  },

  // ============ PAIEMENTS ============
  async createPaiement(req: AuthRequest, res: Response) {
    try {
      const data = req.body;

      const facture = await prisma.facture.findUnique({ where: { id: data.factureId } });
      if (!facture) {
        return res.status(404).json({ error: 'Facture non trouvée' });
      }

      const paiement = await prisma.paiement.create({
        data: {
          factureId: data.factureId,
          modePaiementId: data.modePaiementId,
          datePaiement: parseDate(data.datePaiement) ?? new Date(),
          montant: data.montant,
          reference: data.reference,
          notes: data.notes,
          createdById: req.user?.id,
        },
      });

      await updateFacturePaiementStatus(data.factureId);
      await createAuditLog(req.user!.id, 'CREATE', 'Paiement', paiement.id, { after: paiement });

      res.status(201).json({ paiement });
    } catch (error) {
      console.error('Create paiement error:', error);
      res.status(500).json({ error: 'Erreur lors de la création du paiement' });
    }
  },

  async deletePaiement(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const paiement = await prisma.paiement.findUnique({ where: { id } });
      if (!paiement) {
        return res.status(404).json({ error: 'Paiement non trouvé' });
      }

      await prisma.paiement.update({
        where: { id },
        data: { statut: 'ANNULE' },
      });

      await updateFacturePaiementStatus(paiement.factureId);
      await createAuditLog(req.user!.id, 'DELETE', 'Paiement', id);

      res.json({ message: 'Paiement annulé' });
    } catch (error) {
      console.error('Delete paiement error:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du paiement' });
    }
  },

  // ============ EXPORT PDF ============
  async exportDevisPDF(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const devis = await prisma.devis.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, nomEntreprise: true, code: true } },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });

      if (!devis) {
        return res.status(404).json({ error: 'Devis non trouvé' });
      }

      const pdfBuffer = await generateDevisPDF(devis as any);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${devis.ref}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Export devis PDF error:', error);
      res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
  },

  async exportCommandePDF(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const commande = await prisma.commande.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, nomEntreprise: true, code: true } },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });

      if (!commande) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      const pdfBuffer = await generateCommandePDF(commande as any);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${commande.ref}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Export commande PDF error:', error);
      res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
  },

  async exportFacturePDF(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const facture = await prisma.facture.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, nomEntreprise: true, code: true } },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });

      if (!facture) {
        return res.status(404).json({ error: 'Facture non trouvée' });
      }

      const pdfBuffer = await generateFacturePDF(facture as any);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${facture.ref}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Export facture PDF error:', error);
      res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
  },
};

export default commerceController;
