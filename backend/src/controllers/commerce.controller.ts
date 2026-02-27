import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import { facturationEvents } from '../services/events.service.js';
import { stockService } from '../services/stock.service.js';

// Préfixes par défaut (utilisés si aucun paramètre en base)
const DEFAULT_PREFIX: Record<'DEVIS' | 'COMMANDE' | 'FACTURE' | 'FACTURE_AVOIR', string> = {
  DEVIS: 'DV',
  COMMANDE: 'CMD',
  FACTURE: 'FAC',
  FACTURE_AVOIR: 'AV',
};

// Mapping entre type de document et champ de préfixe dans CompanySettings
const PREFIX_FIELD_MAP: Record<'DEVIS' | 'COMMANDE' | 'FACTURE' | 'FACTURE_AVOIR', string> = {
  DEVIS: 'prefixDevis',
  COMMANDE: 'prefixCommande',
  FACTURE: 'prefixFacture',
  FACTURE_AVOIR: 'prefixAvoir',
};

// Mapping entre type de document et champ de décalage dans CompanySettings
const OFFSET_FIELD_MAP: Record<'DEVIS' | 'COMMANDE' | 'FACTURE' | 'FACTURE_AVOIR', string> = {
  DEVIS: 'offsetDevis',
  COMMANDE: 'offsetCommande',
  FACTURE: 'offsetFacture',
  FACTURE_AVOIR: 'offsetAvoir',
};

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// Génère une référence au format: PRÉFIXE0000/2026
async function generateReference(type: 'DEVIS' | 'COMMANDE' | 'FACTURE' | 'FACTURE_AVOIR', date: Date): Promise<string> {
  const annee = date.getFullYear();

  // Récupérer les paramètres de numérotation
  const settings = await prisma.companySettings.findFirst();
  const prefixField = PREFIX_FIELD_MAP[type];
  const prefixValue = settings ? (settings as Record<string, unknown>)[prefixField] : null;
  const prefix = (typeof prefixValue === 'string' ? prefixValue : null) || DEFAULT_PREFIX[type];
  const longueur = settings?.longueurNumero || 4;
  const separateur = settings?.separateur ?? '/';
  const inclureAnnee = settings?.inclureAnnee ?? true;

  // Récupérer le décalage (offset) pour ce type de document
  const offsetField = OFFSET_FIELD_MAP[type];
  const offsetValue = settings ? (settings as Record<string, unknown>)[offsetField] : null;
  const offset = (typeof offsetValue === 'number' ? offsetValue : 0);

  const counter = await prisma.compteurDocument.upsert({
    where: { type_annee: { type, annee } },
    update: { prochainNumero: { increment: 1 } },
    create: { type, annee, prochainNumero: 2 },
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
            site: { select: { id: true, nom: true, ville: true } },
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
          client: {
            select: {
              id: true,
              nomEntreprise: true,
              code: true,
              siegeNIF: true,
              siegeNIS: true,
              siegeRC: true,
              siegeAdresse: true,
              siegeVille: true,
              siegeCodePostal: true,
              siegeTel: true,
              siegeEmail: true,
            },
          },
          site: {
            select: {
              id: true,
              nom: true,
              adresse: true,
              ville: true,
              codePostal: true,
            },
          },
          lignes: {
            orderBy: { ordre: 'asc' },
            include: {
              produitService: { select: { id: true, nom: true, reference: true } },
            },
          },
          createdBy: { select: { id: true, nom: true, prenom: true } },
          updatedBy: { select: { id: true, nom: true, prenom: true } },
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
          siteId: data.siteId || null,
          typeDocument: data.typeDocument || null,
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
          site: { select: { id: true, nom: true, ville: true } },
          lignes: true,
        },
      });

      // Si c'est un devis SERVICE avec un site, sauvegarder la note par défaut du site
      if (data.typeDocument === 'SERVICE' && data.siteId && lignes.length > 0) {
        const firstLineDescription = lignes[0].description;
        if (firstLineDescription && firstLineDescription.trim()) {
          await prisma.site.update({
            where: { id: data.siteId },
            data: { noteServiceDefaut: firstLineDescription.trim() },
          });
          console.log(`[Devis SERVICE] Note sauvegardée pour site ${data.siteId}: "${firstLineDescription.trim().substring(0, 50)}..."`);
        }
      }

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
          siteId: data.siteId !== undefined ? (data.siteId || null) : undefined,
          typeDocument: data.typeDocument !== undefined ? (data.typeDocument || null) : undefined,
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
          site: { select: { id: true, nom: true, ville: true } },
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

  async validerDevis(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const existing = await prisma.devis.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Devis non trouvé' });
      }

      if (existing.statut !== 'BROUILLON') {
        return res.status(400).json({ error: 'Seul un devis en brouillon peut être validé' });
      }

      const devis = await prisma.devis.update({
        where: { id },
        data: {
          statut: 'VALIDE',
          updatedById: req.user?.id,
        },
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          lignes: true,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Devis', devis.id, { action: 'VALIDATION', after: devis });

      res.json({ devis, message: 'Devis validé avec succès' });
    } catch (error) {
      console.error('Valider devis error:', error);
      res.status(500).json({ error: 'Erreur lors de la validation du devis' });
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
          siteId: devis.siteId,
          typeDocument: devis.typeDocument,
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
        include: { client: { select: { id: true, nomEntreprise: true } }, site: { select: { id: true, nom: true, ville: true } }, lignes: true },
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
          select: {
            id: true,
            ref: true,
            clientId: true,
            siteId: true,
            typeDocument: true,
            devisId: true,
            dateCommande: true,
            dateLivraisonSouhaitee: true,
            refBonCommandeClient: true,
            statut: true,
            totalHT: true,
            totalTVA: true,
            totalTTC: true,
            client: { select: { id: true, nomEntreprise: true } },
            site: { select: { id: true, nom: true, ville: true } },
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
          client: {
            select: {
              id: true,
              nomEntreprise: true,
              code: true,
              siegeNIF: true,
              siegeNIS: true,
              siegeRC: true,
              siegeAdresse: true,
              siegeVille: true,
              siegeCodePostal: true,
              siegeTel: true,
              siegeEmail: true,
            },
          },
          site: {
            select: {
              id: true,
              nom: true,
              adresse: true,
              ville: true,
              codePostal: true,
            },
          },
          devis: { select: { id: true, ref: true } },
          lignes: {
            orderBy: { ordre: 'asc' },
            include: {
              produitService: { select: { id: true, nom: true, reference: true } },
            },
          },
          createdBy: { select: { id: true, nom: true, prenom: true } },
          updatedBy: { select: { id: true, nom: true, prenom: true } },
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
          siteId: data.siteId || null,
          typeDocument: data.typeDocument || null,
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
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          site: { select: { id: true, nom: true, ville: true } },
          lignes: true,
        },
      });

      // Si c'est une commande SERVICE avec un site, sauvegarder la note par défaut du site
      if (data.typeDocument === 'SERVICE' && data.siteId && lignes.length > 0) {
        const firstLineDescription = lignes[0].description;
        if (firstLineDescription && firstLineDescription.trim()) {
          await prisma.site.update({
            where: { id: data.siteId },
            data: { noteServiceDefaut: firstLineDescription.trim() },
          });
        }
      }

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
          siteId: data.siteId !== undefined ? (data.siteId || null) : undefined,
          typeDocument: data.typeDocument !== undefined ? (data.typeDocument || null) : undefined,
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
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          site: { select: { id: true, nom: true, ville: true } },
          lignes: true,
        },
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

  async validerCommande(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { refBonCommandeClient, dateCommande, dateLivraisonSouhaitee, notes, conditions } = req.body;

      // Vérifier que le numéro de BC client est fourni
      if (!refBonCommandeClient || refBonCommandeClient.trim() === '') {
        return res.status(400).json({ error: 'Le numéro de bon de commande client est obligatoire pour valider la commande' });
      }

      const existing = await prisma.commande.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      if (existing.statut !== 'BROUILLON') {
        return res.status(400).json({ error: 'Seule une commande en brouillon peut être validée' });
      }

      const commande = await prisma.commande.update({
        where: { id },
        data: {
          statut: 'VALIDEE',
          refBonCommandeClient: refBonCommandeClient.trim(),
          dateCommande: parseDate(dateCommande) || existing.dateCommande,
          dateLivraisonSouhaitee: parseDate(dateLivraisonSouhaitee),
          notes: notes !== undefined ? notes : existing.notes,
          conditions: conditions !== undefined ? conditions : existing.conditions,
          updatedById: req.user?.id,
        },
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          lignes: true,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Commande', commande.id, { action: 'VALIDATION', after: commande });

      res.json({ commande, message: 'Commande validée avec succès' });
    } catch (error) {
      console.error('Valider commande error:', error);
      res.status(500).json({ error: 'Erreur lors de la validation de la commande' });
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
          client: {
            select: {
              id: true,
              nomEntreprise: true,
              code: true,
              siegeNIF: true,
              siegeNIS: true,
              siegeRC: true,
              siegeAdresse: true,
              siegeVille: true,
              siegeCodePostal: true,
              siegeTel: true,
              siegeEmail: true,
            },
          },
          devis: { select: { id: true, ref: true } },
          commande: { select: { id: true, ref: true } },
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
          relances: {
            orderBy: { dateRelance: 'desc' },
            include: { createdBy: { select: { id: true, nom: true, prenom: true } } },
          },
          createdBy: { select: { id: true, nom: true, prenom: true } },
          updatedBy: { select: { id: true, nom: true, prenom: true } },
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

      // Calculer le délai de paiement et la date d'échéance
      const delaiPaiementJours = data.delaiPaiementJours !== undefined ? parseInt(data.delaiPaiementJours, 10) : 45;
      const dateEcheance = new Date(dateFacture);
      dateEcheance.setDate(dateEcheance.getDate() + delaiPaiementJours);

      // Utiliser une transaction pour garantir l'atomicité
      const facture = await prisma.$transaction(async (tx) => {
        const newFacture = await tx.facture.create({
          data: {
            ref,
            clientId: data.clientId,
            devisId: data.devisId,
            commandeId: data.commandeId,
            adresseFacturationId: data.adresseFacturationId,
            adresseLivraisonId: data.adresseLivraisonId,
            dateFacture,
            dateEcheance,
            delaiPaiementJours,
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

        // Si la facture est validée, mettre à jour le stock (sortie)
        if (statut === 'VALIDEE' && factureType === 'FACTURE' && req.user?.id) {
          const stockResult = await stockService.processFactureValidation(
            newFacture.id,
            newFacture.lignes,
            req.user.id,
            undefined, // entrepotId - peut être ajouté plus tard
            tx
          );
          if (!stockResult.success) {
            throw new Error(`Erreur stock: ${stockResult.errors.join(', ')}`);
          }
        }

        return newFacture;
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Facture', facture.id, { after: facture });

      // Émettre l'événement de création
      facturationEvents.emitEvent({
        type: 'facture.created',
        entityId: facture.id,
        entityType: 'Facture',
        data: {
          ref: facture.ref,
          clientNom: facture.client.nomEntreprise,
          totalTTC: facture.totalTTC,
          type: factureType,
        },
        userId: req.user?.id,
        timestamp: new Date(),
      });

      res.status(201).json({ facture });
    } catch (error) {
      console.error('Create facture error:', error);
      const message = error instanceof Error ? error.message : 'Erreur lors de la création de la facture';
      res.status(500).json({ error: message });
    }
  },

  async updateFacture(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.facture.findUnique({
        where: { id },
        include: { lignes: true, client: { select: { nomEntreprise: true } } },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Facture non trouvée' });
      }

      let lignesData = undefined;
      let totals = undefined;
      const nextType = data.type ?? existing.type;
      const sign = nextType === 'AVOIR' ? -1 : 1;
      const newStatut = data.statut ?? existing.statut;
      const wasValidated = existing.statut === 'BROUILLON' && newStatut === 'VALIDEE';

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

      // Calculer le délai de paiement et la date d'échéance si modifiés
      let dateEcheanceUpdate = undefined;
      let delaiPaiementJoursUpdate = undefined;

      if (data.delaiPaiementJours !== undefined || data.dateFacture !== undefined) {
        const delai = data.delaiPaiementJours !== undefined
          ? parseInt(data.delaiPaiementJours, 10)
          : existing.delaiPaiementJours ?? 45;
        const dateFactureBase = parseDate(data.dateFacture) || existing.dateFacture || new Date();
        const newDateEcheance = new Date(dateFactureBase);
        newDateEcheance.setDate(newDateEcheance.getDate() + delai);
        dateEcheanceUpdate = newDateEcheance;
        delaiPaiementJoursUpdate = delai;
      }

      // Utiliser une transaction pour garantir l'atomicité
      const facture = await prisma.$transaction(async (tx) => {
        const updatedFacture = await tx.facture.update({
          where: { id },
          data: {
            adresseFacturationId: data.adresseFacturationId,
            adresseLivraisonId: data.adresseLivraisonId,
            dateFacture: parseDate(data.dateFacture),
            dateEcheance: dateEcheanceUpdate,
            delaiPaiementJours: delaiPaiementJoursUpdate,
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

        // Si passage en VALIDEE, mettre à jour le stock
        if (wasValidated && nextType === 'FACTURE' && req.user?.id) {
          const stockResult = await stockService.processFactureValidation(
            updatedFacture.id,
            updatedFacture.lignes,
            req.user.id,
            undefined, // entrepotId
            tx
          );
          if (!stockResult.success) {
            throw new Error(`Erreur stock: ${stockResult.errors.join(', ')}`);
          }
        }

        // Si annulation d'une facture validée, reverser le stock
        if (existing.statut === 'VALIDEE' && newStatut === 'ANNULEE' && existing.type === 'FACTURE' && req.user?.id) {
          await stockService.reverseFactureMouvements(
            existing.id,
            existing.lignes,
            req.user.id,
            undefined, // entrepotId
            tx
          );
        }

        return updatedFacture;
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Facture', facture.id, { after: facture });

      // Émettre des événements selon le changement de statut
      if (wasValidated) {
        facturationEvents.emitEvent({
          type: 'facture.validated',
          entityId: facture.id,
          entityType: 'Facture',
          data: {
            ref: facture.ref,
            clientNom: facture.client.nomEntreprise,
            totalTTC: facture.totalTTC,
          },
          userId: req.user?.id,
          timestamp: new Date(),
        });
      }

      res.json({ facture });
    } catch (error) {
      console.error('Update facture error:', error);
      const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour de la facture';
      res.status(500).json({ error: message });
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

  async validerFacture(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { delaiPaiementJours, dateFacture: dateFactureBody, notes, conditions } = req.body;

      const existing = await prisma.facture.findUnique({
        where: { id },
        include: { lignes: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Facture non trouvée' });
      }

      if (existing.statut !== 'BROUILLON') {
        return res.status(400).json({ error: 'Seule une facture en brouillon peut être validée' });
      }

      // Utiliser le délai de paiement: body > existant > défaut 45j
      const delai = delaiPaiementJours !== undefined
        ? parseInt(delaiPaiementJours, 10)
        : (existing.delaiPaiementJours ?? 45);

      // Utiliser la date de facture: body > existante > maintenant
      const dateFacture = parseDate(dateFactureBody) || existing.dateFacture || new Date();
      const dateEcheance = new Date(dateFacture);
      dateEcheance.setDate(dateEcheance.getDate() + delai);

      const facture = await prisma.$transaction(async (tx) => {
        const updated = await tx.facture.update({
          where: { id },
          data: {
            statut: 'VALIDEE',
            dateFacture,
            delaiPaiementJours: delai,
            dateEcheance,
            notes: notes !== undefined ? notes : existing.notes,
            conditions: conditions !== undefined ? conditions : existing.conditions,
            updatedById: req.user?.id,
          },
          include: {
            client: { select: { id: true, nomEntreprise: true } },
            lignes: { include: { produitService: true } },
          },
        });

        // Gérer le stock si c'est une facture de vente
        if (updated.type === 'FACTURE' && req.user?.id) {
          const stockResult = await stockService.processFactureValidation(
            updated.id,
            updated.lignes,
            req.user.id,
            undefined,
            tx
          );
          if (!stockResult.success) {
            throw new Error(`Erreur stock: ${stockResult.errors.join(', ')}`);
          }
        }

        return updated;
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Facture', facture.id, { action: 'VALIDATION', after: facture });

      // Émettre l'événement
      facturationEvents.emitEvent({
        type: 'facture.validated',
        entityId: facture.id,
        entityType: 'Facture',
        data: {
          ref: facture.ref,
          clientNom: facture.client.nomEntreprise,
          totalTTC: facture.totalTTC,
        },
        userId: req.user?.id,
        timestamp: new Date(),
      });

      res.json({ facture, message: 'Facture validée avec succès' });
    } catch (error) {
      console.error('Valider facture error:', error);
      res.status(500).json({ error: 'Erreur lors de la validation de la facture' });
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

      const facture = await prisma.facture.findUnique({
        where: { id: data.factureId },
        include: { client: { select: { nomEntreprise: true } } },
      });
      if (!facture) {
        return res.status(404).json({ error: 'Facture non trouvée' });
      }

      if (facture.statut === 'BROUILLON') {
        return res.status(400).json({ error: 'Impossible d\'ajouter un paiement à une facture en brouillon' });
      }

      const resteAPayer = facture.totalTTC - facture.totalPaye;
      if (data.montant > resteAPayer) {
        return res.status(400).json({ error: `Le montant dépasse le reste à payer (${resteAPayer.toFixed(2)})` });
      }

      // Utiliser une transaction pour garantir l'atomicité
      const { paiement, nouveauStatut } = await prisma.$transaction(async (tx) => {
        const newPaiement = await tx.paiement.create({
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

        // Calculer le nouveau statut
        const totalPaye = facture.totalPaye + data.montant;
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

        await tx.facture.update({
          where: { id: data.factureId },
          data: { totalPaye, statut },
        });

        return { paiement: newPaiement, nouveauStatut: statut };
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Paiement', paiement.id, { after: paiement });

      // Émettre des événements selon le statut
      if (nouveauStatut === 'PAYEE') {
        facturationEvents.emitEvent({
          type: 'facture.paid',
          entityId: facture.id,
          entityType: 'Facture',
          data: {
            ref: facture.ref,
            clientNom: facture.client.nomEntreprise,
            totalTTC: facture.totalTTC,
          },
          userId: req.user?.id,
          timestamp: new Date(),
        });
      } else if (nouveauStatut === 'PARTIELLEMENT_PAYEE') {
        facturationEvents.emitEvent({
          type: 'facture.partially_paid',
          entityId: facture.id,
          entityType: 'Facture',
          data: {
            ref: facture.ref,
            clientNom: facture.client.nomEntreprise,
            montantPaye: paiement.montant,
            resteAPayer: facture.totalTTC - facture.totalPaye - paiement.montant,
          },
          userId: req.user?.id,
          timestamp: new Date(),
        });
      }

      res.status(201).json({ paiement, nouveauStatut });
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
          client: {
            select: {
              id: true,
              nomEntreprise: true,
              code: true,
              siegeAdresse: true,
              siegeVille: true,
              siegePays: true,
              siegeRC: true,
              siegeNIF: true,
              siegeAI: true,
              siegeNIS: true,
            },
          },
          site: {
            select: {
              nom: true,
              ville: true,
              adresse: true,
            },
          },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });

      if (!devis) {
        return res.status(404).json({ error: 'Devis non trouvé' });
      }

      const { generateDevisPDF } = await import('../services/pdf.service.js');
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

      const { generateCommandePDF } = await import('../services/pdf.service.js');
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
          client: {
            select: {
              id: true,
              nomEntreprise: true,
              code: true,
              siegeNom: true,
              siegeAdresse: true,
              siegeVille: true,
              siegePays: true,
              siegeRC: true,
              siegeNIF: true,
              siegeAI: true,
              siegeNIS: true,
            },
          },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });

      if (!facture) {
        return res.status(404).json({ error: 'Facture non trouvée' });
      }

      const { generateFacturePDF } = await import('../services/pdf.service.js');
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
