import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import { facturationEvents } from '../services/events.service.js';
import { stockService } from '../services/stock.service.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';


// Préfixes par défaut (utilisés si aucun paramètre en base)
const DEFAULT_PREFIX: Record<'DEVIS' | 'COMMANDE' | 'BON_LIVRAISON' | 'FACTURE' | 'FACTURE_AVOIR', string> = {
  DEVIS: 'DV',
  COMMANDE: 'CMD',
  BON_LIVRAISON: 'BL',
  FACTURE: 'FAC',
  FACTURE_AVOIR: 'AV',
};

// Mapping entre type de document et champ de préfixe dans CompanySettings
const PREFIX_FIELD_MAP: Record<'DEVIS' | 'COMMANDE' | 'BON_LIVRAISON' | 'FACTURE' | 'FACTURE_AVOIR', string> = {
  DEVIS: 'prefixDevis',
  COMMANDE: 'prefixCommande',
  BON_LIVRAISON: 'prefixBonLivraison',
  FACTURE: 'prefixFacture',
  FACTURE_AVOIR: 'prefixAvoir',
};

// Mapping entre type de document et champ de décalage dans CompanySettings
const OFFSET_FIELD_MAP: Record<'DEVIS' | 'COMMANDE' | 'BON_LIVRAISON' | 'FACTURE' | 'FACTURE_AVOIR', string> = {
  DEVIS: 'offsetDevis',
  COMMANDE: 'offsetCommande',
  BON_LIVRAISON: 'offsetBonLivraison',
  FACTURE: 'offsetFacture',
  FACTURE_AVOIR: 'offsetAvoir',
};

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// Génère une référence au format: PRÉFIXE0000/2026
async function generateReference(type: 'DEVIS' | 'COMMANDE' | 'BON_LIVRAISON' | 'FACTURE' | 'FACTURE_AVOIR', date: Date): Promise<string> {
  const annee = date.getFullYear();

  // Récupérer les paramètres de numérotation
  const settings = await prisma.companySettings.findFirst();
  const prefixField = PREFIX_FIELD_MAP[type];
  const prefixValue = settings ? (settings as Record<string, unknown>)[prefixField] : null;
  const prefix = (typeof prefixValue === 'string') ? prefixValue : DEFAULT_PREFIX[type];
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
    create: { id: crypto.randomUUID(), type, annee, prochainNumero: 2, updatedAt: new Date() },
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

async function updateFacturePaiementStatus(factureId: string, tx?: any) {
  const db = tx ?? prisma;
  const facture = await db.facture.findUnique({
    where: { id: factureId },
    include: { paiements: { where: { statut: { not: 'ANNULE' } } } },
  });

  if (!facture) return;
  if (facture.statut === 'BROUILLON' || facture.statut === 'ANNULEE') return;

  // Seuls les paiements ENCAISSE comptent comme réellement encaissés
  const totalPaye = facture.paiements
    .filter((p: any) => p.statut === 'ENCAISSE')
    .reduce((sum: number, p: any) => sum + p.montant, 0);

  // Chèques en attente (RECU ou DEPOSE)
  const totalEnAttente = facture.paiements
    .filter((p: any) => p.statut === 'RECU' || p.statut === 'DEPOSE')
    .reduce((sum: number, p: any) => sum + p.montant, 0);

  let statut: string;
  if (facture.totalTTC <= 0) {
    statut = 'PAYEE';
  } else if (totalPaye >= facture.totalTTC) {
    statut = 'PAYEE';
  } else if (totalEnAttente > 0 && totalPaye + totalEnAttente >= facture.totalTTC) {
    statut = 'EN_ATTENTE_ENCAISSEMENT';
  } else if (totalPaye > 0 || totalEnAttente > 0) {
    statut = 'PARTIELLEMENT_PAYEE';
  } else {
    statut = 'VALIDEE';
  }

  await db.facture.update({
    where: { id: factureId },
    data: { totalPaye, totalEnAttente, statut },
  });
}

export const commerceController = {
  // ============ DEVIS ============
  async listDevis(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'List devis error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  async getDevis(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'Get devis error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  async createDevis(req: AuthRequest, res: Response, next: NextFunction) {
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
          logger.info(`[Devis SERVICE] Note sauvegardée pour site ${data.siteId}: "${firstLineDescription.trim().substring(0, 50)}..."`);
        }
      }

      await createAuditLog(req.user!.id, 'CREATE', 'Devis', devis.id, { after: devis });

      res.status(201).json({ devis });
    } catch (error) {
      logger.error({ err: error }, 'Create devis error');
      return next(new AppError(500, 'Erreur lors de la création du devis'));
    }
  },

  async updateDevis(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'Update devis error');
      return next(new AppError(500, 'Erreur lors de la mise à jour du devis'));
    }
  },

  async deleteDevis(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.devis.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'Devis', id);
      res.json({ message: 'Devis supprimé' });
    } catch (error) {
      logger.error({ err: error }, 'Delete devis error');
      return next(new AppError(500, 'Erreur lors de la suppression du devis'));
    }
  },

  async validerDevis(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'Valider devis error');
      return next(new AppError(500, 'Erreur lors de la validation du devis'));
    }
  },

  async convertirDevisCommande(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'Convert devis -> commande error');
      return next(new AppError(500, 'Erreur lors de la conversion'));
    }
  },

  // ============ COMMANDES ============
  async listCommandes(req: AuthRequest, res: Response, next: NextFunction) {
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
            lignes: { select: { id: true, quantite: true } },
            bonsLivraison: {
              where: { statut: { not: 'ANNULE' } },
              select: {
                id: true,
                ref: true,
                statut: true,
                dateBonLivraison: true,
                dateLivraisonEffective: true,
                lignes: { select: { commandeLigneId: true, quantiteCommandee: true, quantiteLivree: true } },
              },
            },
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
      logger.error({ err: error }, 'List commandes error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  async getCommande(req: AuthRequest, res: Response, next: NextFunction) {
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
          bonsLivraison: {
            where: { statut: { not: 'ANNULE' } },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              ref: true,
              statut: true,
              dateBonLivraison: true,
              dateLivraisonEffective: true,
              createdBy: { select: { nom: true, prenom: true } },
              lignes: {
                select: {
                  libelle: true,
                  quantiteCommandee: true,
                  quantiteLivree: true,
                  unite: true,
                },
              },
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
      logger.error({ err: error }, 'Get commande error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  async createCommande(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'Create commande error');
      return next(new AppError(500, 'Erreur lors de la création de la commande'));
    }
  },

  async updateCommande(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'Update commande error');
      return next(new AppError(500, 'Erreur lors de la mise à jour de la commande'));
    }
  },

  async deleteCommande(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.commande.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'Commande', id);
      res.json({ message: 'Commande supprimée' });
    } catch (error) {
      logger.error({ err: error }, 'Delete commande error');
      return next(new AppError(500, 'Erreur lors de la suppression de la commande'));
    }
  },

  async validerCommande(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'Valider commande error');
      return next(new AppError(500, 'Erreur lors de la validation de la commande'));
    }
  },

  async convertirCommandeFacture(req: AuthRequest, res: Response, next: NextFunction) {
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
          siteId: commande.siteId,
          typeDocument: commande.typeDocument,
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
      logger.error({ err: error }, 'Convert commande -> facture error');
      return next(new AppError(500, 'Erreur lors de la conversion'));
    }
  },

  // ============ FACTURES ============
  async listFactures(req: AuthRequest, res: Response, next: NextFunction) {
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
          select: {
            id: true,
            ref: true,
            clientId: true,
            siteId: true,
            typeDocument: true,
            devisId: true,
            commandeId: true,
            dateFacture: true,
            dateEcheance: true,
            delaiPaiementJours: true,
            type: true,
            statut: true,
            totalHT: true,
            totalTVA: true,
            totalTTC: true,
            totalPaye: true,
            totalEnAttente: true,
            remiseGlobalPct: true,
            remiseGlobalMontant: true,
            createdAt: true,
            client: { select: { id: true, nomEntreprise: true } },
            site: { select: { id: true, nom: true, ville: true } },
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
      logger.error({ err: error }, 'List factures error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  async getFacture(req: AuthRequest, res: Response, next: NextFunction) {
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
          site: { select: { id: true, nom: true, ville: true } },
          devis: { select: { id: true, ref: true } },
          commande: { select: { id: true, ref: true } },
          lignes: {
            orderBy: { ordre: 'asc' },
            include: {
              produitService: {
                select: {
                  id: true,
                  nom: true,
                  reference: true,
                  type: true,
                  aStock: true,
                  quantite: true,
                  stockMinimum: true,
                },
              },
            },
          },
          paiements: {
            orderBy: { datePaiement: 'desc' },
            include: {
              modePaiement: { select: { id: true, code: true, libelle: true } },
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
      logger.error({ err: error }, 'Get facture error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  async createFacture(req: AuthRequest, res: Response, next: NextFunction) {
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
            siteId: data.siteId || null,
            typeDocument: data.typeDocument || null,
            devisId: data.devisId,
            commandeId: data.commandeId,
            adresseFacturationId: data.adresseFacturationId,
            adresseLivraisonId: data.adresseLivraisonId,
            dateFacture,
            dateOperation: parseDate(data.dateOperation) ?? null,
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
            mentionSpeciale: data.mentionSpeciale || null,
            createdById: req.user?.id,
            updatedById: req.user?.id,
            lignes: { create: lignes },
          },
          include: {
            client: { select: { id: true, nomEntreprise: true } },
            site: { select: { id: true, nom: true, ville: true } },
            lignes: true
          },
        });

        // Si c'est une facture SERVICE avec un site, sauvegarder la note par défaut du site
        if (data.typeDocument === 'SERVICE' && data.siteId && lignes.length > 0) {
          const firstLineDescription = lignes[0].description;
          if (firstLineDescription && firstLineDescription.trim()) {
            await tx.site.update({
              where: { id: data.siteId },
              data: { noteServiceDefaut: firstLineDescription.trim() },
            });
            logger.info(`[Facture SERVICE] Note sauvegardée pour site ${data.siteId}: "${firstLineDescription.trim().substring(0, 50)}..."`);
          }
        }

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
      logger.error({ err: error }, 'Create facture error');
      const message = error instanceof Error ? error.message : 'Erreur lors de la création de la facture';
      return next(new AppError(500, message));
    }
  },

  async updateFacture(req: AuthRequest, res: Response, next: NextFunction) {
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

      // Seules les factures BROUILLON sont modifiables librement.
      // Exception : passer une facture VALIDEE à ANNULEE est autorisé.
      if (existing.statut !== 'BROUILLON') {
        const isAnnulation = data.statut === 'ANNULEE' && Object.keys(data).length === 1;
        if (!isAnnulation) {
          return next(new AppError(400, 'Seule une facture en brouillon peut être modifiée. Utilisez les actions dédiées (valider, annuler).'));
        }
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
            siteId: data.siteId !== undefined ? (data.siteId || null) : undefined,
            typeDocument: data.typeDocument !== undefined ? (data.typeDocument || null) : undefined,
            adresseFacturationId: data.adresseFacturationId,
            adresseLivraisonId: data.adresseLivraisonId,
            dateFacture: parseDate(data.dateFacture),
            dateOperation: data.dateOperation !== undefined ? (parseDate(data.dateOperation) ?? null) : undefined,
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
            mentionSpeciale: data.mentionSpeciale !== undefined ? (data.mentionSpeciale || null) : undefined,
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
            lignes: true
          },
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
      logger.error({ err: error }, 'Update facture error');
      const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour de la facture';
      return next(new AppError(500, message));
    }
  },

  async deleteFacture(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.facture.delete({ where: { id } });
      await createAuditLog(req.user!.id, 'DELETE', 'Facture', id);
      res.json({ message: 'Facture supprimée' });
    } catch (error) {
      logger.error({ err: error }, 'Delete facture error');
      return next(new AppError(500, 'Erreur lors de la suppression de la facture'));
    }
  },

  async validerFacture(req: AuthRequest, res: Response, next: NextFunction) {
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

        // Gérer le stock si c'est une facture de vente (pas un avoir, pas de service)
        if (updated.type === 'FACTURE' && updated.typeDocument !== 'SERVICE' && req.user?.id) {
          const stockResult = await stockService.processFactureValidation(
            updated.id,
            updated.lignes,
            req.user.id,
            undefined,
            tx
          );
          if (!stockResult.success) {
            throw Object.assign(new Error(stockResult.errors.join(', ')), { isStockError: true });
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
    } catch (error: any) {
      logger.error({ err: error }, 'Valider facture error');
      if (error?.isStockError) {
        return res.status(400).json({ error: `Stock insuffisant : ${error.message}` });
      }
      return next(new AppError(500, 'Erreur lors de la validation de la facture'));
    }
  },

  // Relances factures clients
  async listRelances(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const relances = await prisma.factureRelance.findMany({
        where: { factureId: id },
        orderBy: { dateRelance: 'desc' },
        include: { createdBy: { select: { id: true, nom: true, prenom: true } } },
      });
      res.json({ relances });
    } catch (error) {
      logger.error({ err: error }, 'List relances error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  async createRelance(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'Create relance error');
      return next(new AppError(500, 'Erreur lors de la création de la relance'));
    }
  },

  // ============ PAIEMENTS ============
  async createPaiement(req: AuthRequest, res: Response, next: NextFunction) {
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

      // Pour les chèques, on vérifie le reste incluant ce qui est en attente
      const resteAPayer = facture.totalTTC - facture.totalPaye - (facture.totalEnAttente ?? 0);
      if (data.montant > resteAPayer + 0.01) {
        return res.status(400).json({ error: `Le montant dépasse le reste à payer (${resteAPayer.toFixed(2)})` });
      }

      // Statut initial : CHEQUE → RECU, autres modes → ENCAISSE directement
      const isCheque = data.modePaiement === 'CHEQUE';
      const statutInitial = isCheque ? 'RECU' : 'ENCAISSE';

      const paiement = await prisma.$transaction(async (tx) => {
        const newPaiement = await tx.paiement.create({
          data: {
            factureId: data.factureId,
            modePaiementId: data.modePaiementId,
            datePaiement: parseDate(data.datePaiement) ?? new Date(),
            montant: data.montant,
            reference: data.reference,
            banque: data.banque,
            notes: data.notes,
            statut: statutInitial,
            createdById: req.user?.id,
          },
        });

        await updateFacturePaiementStatus(data.factureId, tx);

        return newPaiement;
      });

      // Récupérer le nouveau statut de la facture pour les événements
      const factureUpdated = await prisma.facture.findUnique({
        where: { id: data.factureId },
        select: { statut: true, totalTTC: true, totalPaye: true },
      });
      const nouveauStatut = factureUpdated?.statut ?? facture.statut;

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
      } else if (nouveauStatut === 'PARTIELLEMENT_PAYEE' || nouveauStatut === 'EN_ATTENTE_ENCAISSEMENT') {
        facturationEvents.emitEvent({
          type: 'facture.partially_paid',
          entityId: facture.id,
          entityType: 'Facture',
          data: {
            ref: facture.ref,
            clientNom: facture.client.nomEntreprise,
            montantPaye: paiement.montant,
            resteAPayer: facture.totalTTC - (factureUpdated?.totalPaye ?? 0),
          },
          userId: req.user?.id,
          timestamp: new Date(),
        });
      }

      res.status(201).json({ paiement, nouveauStatut });
    } catch (error) {
      logger.error({ err: error }, 'Create paiement error');
      return next(new AppError(500, 'Erreur lors de la création du paiement'));
    }
  },

  async updateStatutCheque(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { statut, date } = req.body;

      const paiement = await prisma.paiement.findUnique({ where: { id } });
      if (!paiement) {
        return res.status(404).json({ error: 'Paiement non trouvé' });
      }

      const transitionsValides: Record<string, string[]> = {
        RECU: ['DEPOSE', 'REJETE'],
        DEPOSE: ['ENCAISSE', 'REJETE'],
      };
      if (!transitionsValides[paiement.statut]?.includes(statut)) {
        return res.status(400).json({ error: `Transition ${paiement.statut} → ${statut} invalide` });
      }

      const updateData: any = { statut };
      if (statut === 'DEPOSE') updateData.dateDepot = date ? new Date(date) : new Date();
      if (statut === 'ENCAISSE') updateData.dateEncaissement = date ? new Date(date) : new Date();

      await prisma.$transaction(async (tx) => {
        await tx.paiement.update({ where: { id }, data: updateData });
        await updateFacturePaiementStatus(paiement.factureId, tx);
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Paiement', id, { after: { statut, date } });

      res.json({ success: true, statut });
    } catch (error) {
      logger.error({ err: error }, 'Update statut cheque error');
      return next(new AppError(500, 'Erreur lors de la mise à jour du statut'));
    }
  },

  async deletePaiement(req: AuthRequest, res: Response, next: NextFunction) {
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
      logger.error({ err: error }, 'Delete paiement error');
      return next(new AppError(500, 'Erreur lors de la suppression du paiement'));
    }
  },

  // ============ EXPORT PDF ============
  async exportDevisPDF(req: AuthRequest, res: Response, next: NextFunction) {
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
              siegeNIN: true,
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
      res.setHeader('Content-Disposition', `inline; filename="${devis.ref.replace(/\//g, '-')}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error({ err: error }, 'Export devis PDF error');
      return next(new AppError(500, 'Erreur lors de la génération du PDF'));
    }
  },

  async exportCommandePDF(req: AuthRequest, res: Response, next: NextFunction) {
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
              siegeAdresse: true,
              siegeVille: true,
              siegePays: true,
              siegeRC: true,
              siegeNIF: true,
              siegeAI: true,
              siegeNIS: true,
              siegeNIN: true,
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

      if (!commande) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      const { generateCommandePDF } = await import('../services/pdf.service.js');
      const pdfBuffer = await generateCommandePDF(commande as any);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${commande.ref.replace(/\//g, '-')}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error({ err: error }, 'Export commande PDF error');
      return next(new AppError(500, 'Erreur lors de la génération du PDF'));
    }
  },

  async exportFacturePDF(req: AuthRequest, res: Response, next: NextFunction) {
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
              siegeNIN: true,
            },
          },
          commande: { select: { refBonCommandeClient: true } },
          site: { select: { id: true, nom: true, ville: true, adresse: true } },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });

      if (!facture) {
        return res.status(404).json({ error: 'Facture non trouvée' });
      }

      const { generateFacturePDF } = await import('../services/pdf.service.js');
      const pdfBuffer = await generateFacturePDF({
        ...facture,
        refBonCommandeClient: facture.commande?.refBonCommandeClient ?? null,
      } as any);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${facture.ref.replace(/\//g, '-')}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error({ err: error }, 'Export facture PDF error');
      return next(new AppError(500, 'Erreur lors de la génération du PDF'));
    }
  },

  // ── Bons de Livraison ──────────────────────────────────────────────────────

  async listBonsLivraison(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { clientId, commandeId, statut, search, page = '1', limit = '50' } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const where: Record<string, unknown> = {};
      if (clientId) where.clientId = clientId;
      if (commandeId) where.commandeId = commandeId;
      if (statut) where.statut = statut;
      if (search) {
        where.OR = [
          { ref: { contains: search, mode: 'insensitive' } },
          { client: { nomEntreprise: { contains: search, mode: 'insensitive' } } },
        ];
      }
      const [total, items] = await Promise.all([
        prisma.bonLivraison.count({ where }),
        prisma.bonLivraison.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { dateBonLivraison: 'desc' },
          include: {
            client: { select: { id: true, nomEntreprise: true, code: true } },
            commande: { select: { id: true, ref: true } },
            site: { select: { id: true, nom: true, ville: true } },
            lignes: { select: { quantiteCommandee: true, quantiteLivree: true } },
          },
        }),
      ]);
      res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
      logger.error({ err: error }, 'List bons livraison error');
      return next(new AppError(500, 'Erreur lors de la récupération des bons de livraison'));
    }
  },

  async getBonLivraison(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const bl = await prisma.bonLivraison.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, nomEntreprise: true, code: true, siegeAdresse: true, siegeVille: true, siegePays: true, siegeRC: true, siegeNIF: true, siegeAI: true, siegeNIS: true } },
          commande: { select: { id: true, ref: true } },
          site: { select: { id: true, nom: true, ville: true, adresse: true } },
          adresseLivraison: true,
          lignes: { orderBy: { ordre: 'asc' } },
          createdBy: { select: { id: true, nom: true, prenom: true } },
        },
      });
      if (!bl) return next(new AppError(404, 'Bon de livraison non trouvé'));
      res.json(bl);
    } catch (error) {
      logger.error({ err: error }, 'Get bon livraison error');
      return next(new AppError(500, 'Erreur lors de la récupération du bon de livraison'));
    }
  },

  async createBonLivraison(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const userId = req.user?.id;

      // Validation livraison partielle : vérifier que quantiteLivree ne dépasse pas ce qui reste
      if (data.commandeId && data.lignes) {
        await Promise.all(
          data.lignes
            .filter((l: { commandeLigneId?: string; quantiteLivree: number }) => l.commandeLigneId)
            .map(async (l: { commandeLigneId: string; quantiteLivree: number }) => {
              const [cmdLigne, dejaLivree] = await Promise.all([
                prisma.commandeLigne.findUnique({ where: { id: l.commandeLigneId } }),
                prisma.bonLivraisonLigne.aggregate({
                  where: {
                    commandeLigneId: l.commandeLigneId,
                    bonLivraison: { statut: { not: 'ANNULE' } },
                  },
                  _sum: { quantiteLivree: true },
                }),
              ]);
              if (!cmdLigne) throw new AppError(400, `Ligne de commande introuvable: ${l.commandeLigneId}`);
              const totalApres = (dejaLivree._sum.quantiteLivree || 0) + l.quantiteLivree;
              if (totalApres > cmdLigne.quantite) {
                throw new AppError(400, `Quantité livrée (${totalApres}) dépasse la quantité commandée (${cmdLigne.quantite}) pour "${cmdLigne.libelle}"`);
              }
            })
        );
      }

      const ref = await generateReference('BON_LIVRAISON', new Date());
      const id = crypto.randomUUID();

      const bl = await prisma.bonLivraison.create({
        data: {
          id,
          ref,
          clientId: data.clientId,
          commandeId: data.commandeId || null,
          adresseLivraisonId: data.adresseLivraisonId || null,
          siteId: data.siteId || null,
          dateBonLivraison: data.dateBonLivraison ? new Date(data.dateBonLivraison) : new Date(),
          notes: data.notes || null,
          devise: data.devise || 'DZD',
          createdById: userId || null,
          updatedById: userId || null,
          updatedAt: new Date(),
          lignes: {
            create: data.lignes.map((l: {
              commandeLigneId?: string; produitServiceId?: string; libelle: string;
              description?: string; quantiteCommandee?: number; quantiteLivree: number;
              unite?: string; prixUnitaireHT?: number; tauxTVA?: number; remisePct?: number; ordre?: number;
            }, idx: number) => {
              const prixHT = l.prixUnitaireHT ?? 0;
              const tva = l.tauxTVA ?? 0;
              const remise = l.remisePct ?? 0;
              const totalHT = l.quantiteLivree * prixHT * (1 - remise / 100);
              const totalTVA = totalHT * (tva / 100);
              return {
                id: crypto.randomUUID(),
                commandeLigneId: l.commandeLigneId || null,
                produitServiceId: l.produitServiceId || null,
                libelle: l.libelle,
                description: l.description || null,
                quantiteCommandee: l.quantiteCommandee ?? null,
                quantiteLivree: l.quantiteLivree,
                unite: l.unite || null,
                prixUnitaireHT: prixHT,
                tauxTVA: tva,
                remisePct: remise,
                totalHT,
                totalTVA,
                totalTTC: totalHT + totalTVA,
                ordre: l.ordre ?? idx,
              };
            }),
          },
        },
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          commande: { select: { id: true, ref: true } },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });

      await commerceController._checkAndUpdateCommandeStatut(data.commandeId);
      await createAuditLog(userId || 'system', 'CREATE', 'BonLivraison', bl.id, { after: bl });
      res.status(201).json(bl);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      logger.error({ err: error }, 'Create bon livraison error');
      return next(new AppError(500, 'Erreur lors de la création du bon de livraison'));
    }
  },

  async updateBonLivraison(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;
      const userId = req.user?.id;

      const existing = await prisma.bonLivraison.findUnique({ where: { id } });
      if (!existing) return next(new AppError(404, 'Bon de livraison non trouvé'));
      if (existing.statut !== 'BROUILLON') {
        return next(new AppError(400, 'Seul un bon de livraison en brouillon peut être modifié'));
      }

      const bl = await prisma.bonLivraison.update({
        where: { id },
        data: {
          ...(data.adresseLivraisonId !== undefined && { adresseLivraisonId: data.adresseLivraisonId }),
          ...(data.siteId !== undefined && { siteId: data.siteId }),
          ...(data.dateBonLivraison && { dateBonLivraison: new Date(data.dateBonLivraison) }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.devise && { devise: data.devise }),
          updatedById: userId || null,
          updatedAt: new Date(),
          ...(data.lignes && {
            lignes: {
              deleteMany: {},
              create: data.lignes.map((l: {
                commandeLigneId?: string; produitServiceId?: string; libelle: string;
                description?: string; quantiteCommandee?: number; quantiteLivree: number;
                unite?: string; prixUnitaireHT?: number; tauxTVA?: number; remisePct?: number; ordre?: number;
              }, idx: number) => {
                const prixHT = l.prixUnitaireHT ?? 0;
                const tva = l.tauxTVA ?? 0;
                const remise = l.remisePct ?? 0;
                const totalHT = l.quantiteLivree * prixHT * (1 - remise / 100);
                const totalTVA = totalHT * (tva / 100);
                return {
                  id: crypto.randomUUID(),
                  commandeLigneId: l.commandeLigneId || null,
                  produitServiceId: l.produitServiceId || null,
                  libelle: l.libelle,
                  description: l.description || null,
                  quantiteCommandee: l.quantiteCommandee ?? null,
                  quantiteLivree: l.quantiteLivree,
                  unite: l.unite || null,
                  prixUnitaireHT: prixHT,
                  tauxTVA: tva,
                  remisePct: remise,
                  totalHT,
                  totalTVA,
                  totalTTC: totalHT + totalTVA,
                  ordre: l.ordre ?? idx,
                };
              }),
            },
          }),
        },
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          commande: { select: { id: true, ref: true } },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });

      await createAuditLog(userId || 'system', 'UPDATE', 'BonLivraison', bl.id, { before: existing, after: bl });
      res.json(bl);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      logger.error({ err: error }, 'Update bon livraison error');
      return next(new AppError(500, 'Erreur lors de la mise à jour du bon de livraison'));
    }
  },

  async deleteBonLivraison(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const existing = await prisma.bonLivraison.findUnique({ where: { id } });
      if (!existing) return next(new AppError(404, 'Bon de livraison non trouvé'));
      if (existing.statut !== 'BROUILLON') {
        return next(new AppError(400, 'Seul un bon de livraison en brouillon peut être supprimé'));
      }
      await prisma.bonLivraison.delete({ where: { id } });
      await createAuditLog(userId || 'system', 'DELETE', 'BonLivraison', id, { before: existing });
      res.status(204).send();
    } catch (error) {
      logger.error({ err: error }, 'Delete bon livraison error');
      return next(new AppError(500, 'Erreur lors de la suppression du bon de livraison'));
    }
  },

  async validerBonLivraison(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.bonLivraison.findUnique({ where: { id } });
      if (!existing) return next(new AppError(404, 'Bon de livraison non trouvé'));
      if (existing.statut !== 'BROUILLON') {
        return next(new AppError(400, 'Seul un BL en brouillon peut être validé'));
      }
      const bl = await prisma.bonLivraison.update({
        where: { id },
        data: { statut: 'CONFIRME', updatedAt: new Date(), updatedById: req.user?.id || null },
      });
      res.json(bl);
    } catch (error) {
      logger.error({ err: error }, 'Valider bon livraison error');
      return next(new AppError(500, 'Erreur lors de la validation du bon de livraison'));
    }
  },

  async livrerBonLivraison(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.bonLivraison.findUnique({ where: { id } });
      if (!existing) return next(new AppError(404, 'Bon de livraison non trouvé'));
      if (existing.statut !== 'CONFIRME') {
        return next(new AppError(400, 'Seul un BL confirmé peut être marqué livré'));
      }
      const bl = await prisma.bonLivraison.update({
        where: { id },
        data: {
          statut: 'LIVRE',
          dateLivraisonEffective: new Date(),
          updatedAt: new Date(),
          updatedById: req.user?.id || null,
        },
      });
      await commerceController._checkAndUpdateCommandeStatut(existing.commandeId);
      res.json(bl);
    } catch (error) {
      logger.error({ err: error }, 'Livrer bon livraison error');
      return next(new AppError(500, 'Erreur lors de la livraison du bon de livraison'));
    }
  },

  async annulerBonLivraison(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.bonLivraison.findUnique({ where: { id } });
      if (!existing) return next(new AppError(404, 'Bon de livraison non trouvé'));
      if (existing.statut === 'LIVRE') {
        return next(new AppError(400, 'Un BL livré ne peut pas être annulé'));
      }
      const bl = await prisma.bonLivraison.update({
        where: { id },
        data: { statut: 'ANNULE', updatedAt: new Date(), updatedById: req.user?.id || null },
      });
      res.json(bl);
    } catch (error) {
      logger.error({ err: error }, 'Annuler bon livraison error');
      return next(new AppError(500, 'Erreur lors de l\'annulation du bon de livraison'));
    }
  },

  async creerBLFromCommande(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: commandeId } = req.params;
      const userId = req.user?.id;

      const commande = await prisma.commande.findUnique({
        where: { id: commandeId },
        include: { lignes: { orderBy: { ordre: 'asc' } } },
      });
      if (!commande) return next(new AppError(404, 'Commande non trouvée'));

      // Calculer les quantités déjà livrées par ligne
      const dejaLivrees = await prisma.bonLivraisonLigne.groupBy({
        by: ['commandeLigneId'],
        where: {
          commandeLigneId: { in: commande.lignes.map(l => l.id) },
          bonLivraison: { statut: { not: 'ANNULE' } },
        },
        _sum: { quantiteLivree: true },
      });
      const livreeMap = new Map(dejaLivrees.map(d => [d.commandeLigneId, d._sum.quantiteLivree || 0]));

      // Ne garder que les lignes avec quantité restante > 0
      const lignesRestantes = commande.lignes.filter(l => {
        const dejaLivree = livreeMap.get(l.id) || 0;
        return l.quantite - dejaLivree > 0;
      });

      if (lignesRestantes.length === 0) {
        return next(new AppError(400, 'Toutes les lignes de cette commande ont déjà été livrées'));
      }

      const ref = await generateReference('BON_LIVRAISON', new Date());
      const id = crypto.randomUUID();

      const bl = await prisma.bonLivraison.create({
        data: {
          id,
          ref,
          clientId: commande.clientId,
          commandeId: commande.id,
          siteId: commande.siteId || null,
          adresseLivraisonId: commande.adresseLivraisonId || null,
          dateBonLivraison: new Date(),
          devise: commande.devise || 'DZD',
          createdById: userId || null,
          updatedById: userId || null,
          updatedAt: new Date(),
          lignes: {
            create: lignesRestantes.map((l, idx) => {
              const dejaLivree = livreeMap.get(l.id) || 0;
              const qteRestante = l.quantite - dejaLivree;
              const totalHT = qteRestante * l.prixUnitaireHT * (1 - (l.remisePct || 0) / 100);
              const totalTVA = totalHT * (l.tauxTVA / 100);
              return {
                id: crypto.randomUUID(),
                commandeLigneId: l.id,
                produitServiceId: l.produitServiceId || null,
                libelle: l.libelle,
                description: l.description || null,
                quantiteCommandee: l.quantite,
                quantiteLivree: qteRestante,
                unite: l.unite || null,
                prixUnitaireHT: l.prixUnitaireHT,
                tauxTVA: l.tauxTVA,
                remisePct: l.remisePct || 0,
                totalHT,
                totalTVA,
                totalTTC: totalHT + totalTVA,
                ordre: l.ordre ?? idx,
              };
            }),
          },
        },
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          commande: { select: { id: true, ref: true } },
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });

      await createAuditLog(userId || 'system', 'CREATE', 'BonLivraison', bl.id, { after: bl });
      res.status(201).json(bl);
    } catch (error) {
      if (error instanceof AppError) return next(error);
      logger.error({ err: error }, 'Creer BL from commande error');
      return next(new AppError(500, 'Erreur lors de la création du bon de livraison'));
    }
  },

  async getCommandeProgressionLivraison(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: commandeId } = req.params;
      const commande = await prisma.commande.findUnique({
        where: { id: commandeId },
        include: { lignes: { orderBy: { ordre: 'asc' } } },
      });
      if (!commande) return next(new AppError(404, 'Commande non trouvée'));

      const dejaLivrees = await prisma.bonLivraisonLigne.groupBy({
        by: ['commandeLigneId'],
        where: {
          commandeLigneId: { in: commande.lignes.map(l => l.id) },
          bonLivraison: { statut: { not: 'ANNULE' } },
        },
        _sum: { quantiteLivree: true },
      });
      const livreeMap = new Map(dejaLivrees.map(d => [d.commandeLigneId, d._sum.quantiteLivree || 0]));

      const progression = commande.lignes.map(l => ({
        commandeLigneId: l.id,
        libelle: l.libelle,
        quantiteCommandee: l.quantite,
        quantiteDejaLivree: livreeMap.get(l.id) || 0,
        quantiteRestante: Math.max(0, l.quantite - (livreeMap.get(l.id) || 0)),
      }));

      const totalCommandee = progression.reduce((s, l) => s + l.quantiteCommandee, 0);
      const totalLivree = progression.reduce((s, l) => s + l.quantiteDejaLivree, 0);

      res.json({
        lignes: progression,
        pctLivre: totalCommandee > 0 ? Math.round((totalLivree / totalCommandee) * 100) : 0,
      });
    } catch (error) {
      logger.error({ err: error }, 'Progression livraison error');
      return next(new AppError(500, 'Erreur lors du calcul de la progression'));
    }
  },

  async exportBonLivraisonPDF(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const bl = await prisma.bonLivraison.findUnique({
        where: { id },
        include: {
          client: true,
          commande: { select: { ref: true, refBonCommandeClient: true, typeDocument: true } },
          site: { select: { nom: true, ville: true, adresse: true } },
          adresseLivraison: true,
          lignes: { orderBy: { ordre: 'asc' } },
        },
      });
      if (!bl) return next(new AppError(404, 'Bon de livraison non trouvé'));

      const { generateBonLivraisonPDF } = await import('../services/pdf.service.js');
      const pdfBuffer = await generateBonLivraisonPDF({
        ref: bl.ref,
        client: {
          nomEntreprise: bl.client.nomEntreprise,
          code: bl.client.code,
          siegeAdresse: bl.client.siegeAdresse,
          siegeVille: bl.client.siegeVille,
          siegePays: bl.client.siegePays,
          siegeRC: bl.client.siegeRC,
          siegeNIF: bl.client.siegeNIF,
          siegeAI: bl.client.siegeAI,
          siegeNIS: bl.client.siegeNIS,
          siegeNIN: bl.client.siegeNIN,
        },
        commande: bl.commande ? { ref: bl.commande.ref, refBonCommandeClient: bl.commande.refBonCommandeClient, typeDocument: bl.commande.typeDocument } : null,
        site: bl.site,
        dateBonLivraison: bl.dateBonLivraison,
        dateLivraisonEffective: bl.dateLivraisonEffective,
        statut: bl.statut,
        notes: bl.notes,
        lignes: bl.lignes.map(l => ({
          libelle: l.libelle,
          description: l.description,
          quantiteCommandee: l.quantiteCommandee ?? undefined,
          quantiteLivree: l.quantiteLivree,
          unite: l.unite,
          prixUnitaireHT: l.prixUnitaireHT,
          tauxTVA: l.tauxTVA,
        })),
        adresseLivraison: bl.adresseLivraison ? {
          adresse: bl.adresseLivraison.adresse ?? undefined,
          ville: bl.adresseLivraison.ville ?? undefined,
          codePostal: bl.adresseLivraison.codePostal ?? undefined,
        } : null,
      });

      const fileName = `${bl.ref.replace(/\//g, '-')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error({ err: error }, 'Export BL PDF error');
      return next(new AppError(500, 'Erreur lors de la génération du PDF'));
    }
  },

  // Méthode interne : met à jour le statut de la commande si toutes les lignes sont livrées
  async _checkAndUpdateCommandeStatut(commandeId: string | null | undefined) {
    if (!commandeId) return;
    try {
      const commande = await prisma.commande.findUnique({
        where: { id: commandeId },
        include: { lignes: true },
      });
      if (!commande || commande.statut === 'ANNULEE' || commande.statut === 'LIVREE') return;

      const dejaLivrees = await prisma.bonLivraisonLigne.groupBy({
        by: ['commandeLigneId'],
        where: {
          commandeLigneId: { in: commande.lignes.map(l => l.id) },
          bonLivraison: { statut: { not: 'ANNULE' } },
        },
        _sum: { quantiteLivree: true },
      });
      const livreeMap = new Map(dejaLivrees.map(d => [d.commandeLigneId, d._sum.quantiteLivree || 0]));
      const toutLivre = commande.lignes.every(l => (livreeMap.get(l.id) || 0) >= l.quantite);
      if (toutLivre) {
        await prisma.commande.update({ where: { id: commandeId }, data: { statut: 'LIVREE', updatedAt: new Date() } });
      }
    } catch {
      // non-bloquant
    }
  },
};

export default commerceController;
