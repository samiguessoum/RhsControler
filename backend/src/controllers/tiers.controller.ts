import { Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import { TypeTiers } from '@prisma/client';

// Génération automatique du code tiers
async function generateCodeTiers(type: TypeTiers): Promise<string> {
  const prefix = type === 'FOURNISSEUR' ? 'FOU' : type === 'PROSPECT' ? 'PRO' : 'CLI';
  const year = new Date().getFullYear().toString().slice(-2);

  // Trouver le dernier code pour ce préfixe cette année
  const lastTiers = await prisma.client.findFirst({
    where: {
      code: {
        startsWith: `${prefix}${year}`,
      },
    },
    orderBy: { code: 'desc' },
  });

  let sequence = 1;
  if (lastTiers?.code) {
    const lastNum = parseInt(lastTiers.code.slice(-4), 10);
    sequence = lastNum + 1;
  }

  return `${prefix}${year}${sequence.toString().padStart(4, '0')}`;
}

export const tiersController = {
  // ============ TIERS (CLIENTS/FOURNISSEURS/PROSPECTS) ============

  /**
   * GET /api/tiers
   * Liste des tiers avec filtres avancés
   */
  async list(req: AuthRequest, res: Response) {
    try {
      const {
        search,
        typeTiers,
        actif,
        formeJuridique,
        secteur,
        page = '1',
        limit = '20',
      } = req.query;

      const where: any = {};

      // Filtre par type de tiers
      if (typeTiers) {
        if (typeTiers === 'CLIENT') {
          where.typeTiers = { in: ['CLIENT', 'CLIENT_FOURNISSEUR'] };
        } else if (typeTiers === 'FOURNISSEUR') {
          where.typeTiers = { in: ['FOURNISSEUR', 'CLIENT_FOURNISSEUR'] };
        } else {
          where.typeTiers = typeTiers;
        }
      }

      if (actif !== undefined) {
        where.actif = actif === 'true';
      }

      if (formeJuridique) {
        where.formeJuridique = formeJuridique;
      }

      if (secteur) {
        where.secteur = { contains: secteur as string, mode: 'insensitive' };
      }

      if (search) {
        where.OR = [
          { code: { contains: search as string, mode: 'insensitive' } },
          { nomEntreprise: { contains: search as string, mode: 'insensitive' } },
          { nomAlias: { contains: search as string, mode: 'insensitive' } },
          { siegeVille: { contains: search as string, mode: 'insensitive' } },
          { siegeRC: { contains: search as string, mode: 'insensitive' } },
          { siegeNIF: { contains: search as string, mode: 'insensitive' } },
          {
            siegeContacts: {
              some: {
                OR: [
                  { nom: { contains: search as string, mode: 'insensitive' } },
                  { email: { contains: search as string, mode: 'insensitive' } },
                ],
              },
            },
          },
        ];
      }

      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 20, 100);
      const skip = (pageNum - 1) * limitNum;

      const [tiers, total] = await Promise.all([
        prisma.client.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { nomEntreprise: 'asc' },
          include: {
            siegeContacts: {
              where: { estPrincipal: true },
              take: 1,
            },
            sites: {
              where: { actif: true },
              orderBy: { nom: 'asc' },
              select: {
                id: true,
                nom: true,
                ville: true,
                adresse: true,
                noteServiceDefaut: true,
              },
            },
            modePaiement: true,
            conditionPaiement: true,
            _count: {
              select: { contrats: true, interventions: true, comptesBancaires: true },
            },
          },
        }),
        prisma.client.count({ where }),
      ]);

      res.json({
        tiers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('List tiers error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/tiers/:id
   * Détail complet d'un tiers
   */
  async get(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const tiers = await prisma.client.findUnique({
        where: { id },
        include: {
          siegeContacts: {
            orderBy: [{ estPrincipal: 'desc' }, { nom: 'asc' }],
          },
          sites: {
            include: {
              contacts: {
                orderBy: [{ estPrincipal: 'desc' }, { nom: 'asc' }],
              },
              _count: {
                select: { contratSites: true, interventions: true },
              },
            },
            orderBy: { nom: 'asc' },
          },
          adresses: {
            orderBy: [{ estDefaut: 'desc' }, { type: 'asc' }],
          },
          comptesBancaires: {
            orderBy: [{ estDefaut: 'desc' }, { libelle: 'asc' }],
          },
          modePaiement: true,
          conditionPaiement: true,
          contrats: {
            orderBy: { dateDebut: 'desc' },
            include: {
              responsablePlanning: {
                select: { id: true, nom: true, prenom: true },
              },
            },
          },
          interventions: {
            orderBy: { datePrevue: 'desc' },
            take: 20,
            include: {
              site: { select: { id: true, nom: true } },
            },
          },
        },
      });

      if (!tiers) {
        return res.status(404).json({ error: 'Tiers non trouvé' });
      }

      res.json({ tiers });
    } catch (error) {
      console.error('Get tiers error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/tiers
   * Créer un nouveau tiers
   */
  async create(req: AuthRequest, res: Response) {
    try {
      const data = req.body;

      // Générer le code automatiquement si non fourni
      const code = data.code || await generateCodeTiers(data.typeTiers || 'CLIENT');

      const tiers = await prisma.client.create({
        data: {
          // Identification
          code,
          nomEntreprise: data.nomEntreprise,
          nomAlias: data.nomAlias,
          typeTiers: data.typeTiers || 'CLIENT',

          // Informations légales
          formeJuridique: data.formeJuridique,
          siegeRC: data.siegeRC,
          siegeNIF: data.siegeNIF,
          siegeAI: data.siegeAI,
          siegeNIS: data.siegeNIS,
          siegeTIN: data.siegeTIN,
          tvaIntracom: data.tvaIntracom,
          capital: data.capital,
          dateCreation: data.dateCreation ? new Date(data.dateCreation) : null,

          // Siège social
          siegeNom: data.siegeNom || data.nomEntreprise,
          siegeAdresse: data.siegeAdresse,
          siegeCodePostal: data.siegeCodePostal,
          siegeVille: data.siegeVille,
          siegePays: data.siegePays || 'Algérie',
          siegeTel: data.siegeTel,
          siegeFax: data.siegeFax,
          siegeEmail: data.siegeEmail || null,
          siegeWebsite: data.siegeWebsite,
          siegeNotes: data.siegeNotes,

          // Classification
          secteur: data.secteur,
          categorie: data.categorie,
          codeComptaClient: data.codeComptaClient,
          codeComptaFournisseur: data.codeComptaFournisseur,

          // Conditions commerciales
          modePaiementId: data.modePaiementId,
          conditionPaiementId: data.conditionPaiementId,
          remiseParDefaut: data.remiseParDefaut,
          encoursMaximum: data.encoursMaximum,

          // Devises
          devise: data.devise || 'DZD',

          // Notes
          notePublique: data.notePublique,
          notePrivee: data.notePrivee,

          // Prospect
          prospectNiveau: data.prospectNiveau,
          prospectStatut: data.prospectStatut,

          // Relations
          siegeContacts: {
            create: data.contacts?.map((c: any, i: number) => ({
              civilite: c.civilite,
              nom: c.nom,
              prenom: c.prenom,
              fonction: c.fonction || '',
              tel: c.tel,
              telMobile: c.telMobile,
              fax: c.fax,
              email: c.email,
              notes: c.notes,
              estPrincipal: i === 0 || c.estPrincipal,
            })) || [],
          },
          sites: {
            create: data.sites?.map((s: any) => ({
              code: s.code,
              nom: s.nom,
              adresse: s.adresse,
              complement: s.complement,
              codePostal: s.codePostal,
              ville: s.ville,
              pays: s.pays || 'Algérie',
              latitude: s.latitude,
              longitude: s.longitude,
              tel: s.tel,
              fax: s.fax,
              email: s.email,
              horairesOuverture: s.horairesOuverture,
              accessibilite: s.accessibilite,
              notes: s.notes,
              contacts: {
                create: s.contacts?.map((c: any, i: number) => ({
                  civilite: c.civilite,
                  nom: c.nom,
                  prenom: c.prenom,
                  fonction: c.fonction,
                  tel: c.tel,
                  telMobile: c.telMobile,
                  email: c.email,
                  notes: c.notes,
                  estPrincipal: i === 0 || c.estPrincipal,
                })) || [],
              },
            })) || [],
          },
          adresses: {
            create: data.adresses?.map((a: any) => ({
              type: a.type || 'SITE',
              libelle: a.libelle,
              adresse: a.adresse,
              complement: a.complement,
              codePostal: a.codePostal,
              ville: a.ville,
              pays: a.pays || 'Algérie',
              contactNom: a.contactNom,
              contactTel: a.contactTel,
              contactEmail: a.contactEmail,
              estDefaut: a.estDefaut,
              notes: a.notes,
            })) || [],
          },
          comptesBancaires: {
            create: data.comptesBancaires?.map((cb: any, i: number) => ({
              libelle: cb.libelle,
              banque: cb.banque,
              agence: cb.agence,
              codeBanque: cb.codeBanque,
              codeGuichet: cb.codeGuichet,
              numeroCompte: cb.numeroCompte,
              cleRib: cb.cleRib,
              iban: cb.iban,
              bic: cb.bic,
              titulaire: cb.titulaire,
              devise: cb.devise || 'DZD',
              estDefaut: i === 0 || cb.estDefaut,
            })) || [],
          },
        },
        include: {
          siegeContacts: true,
          sites: {
            include: { contacts: true },
          },
          adresses: true,
          comptesBancaires: true,
          modePaiement: true,
          conditionPaiement: true,
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Tiers', tiers.id, { after: tiers });

      res.status(201).json({ tiers });
    } catch (error: any) {
      console.error('Create tiers error:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Un tiers avec ce code existe déjà' });
      }
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/tiers/:id
   * Mettre à jour un tiers
   */
  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.client.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Tiers non trouvé' });
      }

      const contactsInput = Array.isArray(data.contacts)
        ? data.contacts
            .filter((c: any) => c?.nom && String(c.nom).trim())
            .map((c: any, i: number) => ({
              civilite: c.civilite,
              nom: c.nom,
              prenom: c.prenom,
              fonction: c.fonction || '',
              tel: c.tel,
              telMobile: c.telMobile,
              fax: c.fax,
              email: c.email,
              notes: c.notes,
              estPrincipal: i === 0 || c.estPrincipal,
            }))
        : undefined;

      // Gérer les sites séparément pour éviter de supprimer ceux qui ont des données liées
      const hasSitesData = Array.isArray(data.sites) && data.sites.some((s: any) => s?.nom && String(s.nom).trim());

      const tiers = await prisma.client.update({
        where: { id },
        data: {
          // Identification
          nomEntreprise: data.nomEntreprise,
          nomAlias: data.nomAlias,
          typeTiers: data.typeTiers,

          // Informations légales
          formeJuridique: data.formeJuridique,
          siegeRC: data.siegeRC,
          siegeNIF: data.siegeNIF,
          siegeAI: data.siegeAI,
          siegeNIS: data.siegeNIS,
          siegeTIN: data.siegeTIN,
          tvaIntracom: data.tvaIntracom,
          capital: data.capital,
          dateCreation: data.dateCreation ? new Date(data.dateCreation) : undefined,

          // Siège social
          siegeNom: data.siegeNom,
          siegeAdresse: data.siegeAdresse,
          siegeCodePostal: data.siegeCodePostal,
          siegeVille: data.siegeVille,
          siegePays: data.siegePays,
          siegeTel: data.siegeTel,
          siegeFax: data.siegeFax,
          siegeEmail: data.siegeEmail,
          siegeWebsite: data.siegeWebsite,
          siegeNotes: data.siegeNotes,

          // Classification
          secteur: data.secteur,
          categorie: data.categorie,
          codeComptaClient: data.codeComptaClient,
          codeComptaFournisseur: data.codeComptaFournisseur,

          // Conditions commerciales
          modePaiementId: data.modePaiementId,
          conditionPaiementId: data.conditionPaiementId,
          remiseParDefaut: data.remiseParDefaut,
          encoursMaximum: data.encoursMaximum,

          // Devises
          devise: data.devise,

          // Notes
          notePublique: data.notePublique,
          notePrivee: data.notePrivee,

          // Prospect
          prospectNiveau: data.prospectNiveau,
          prospectStatut: data.prospectStatut,

          // Statut
          actif: data.actif,

          // Relations éditées depuis le formulaire Tiers
          ...(Array.isArray(data.contacts)
            ? {
                siegeContacts: {
                  deleteMany: {},
                  create: contactsInput,
                },
              }
            : {}),
          // Les sites sont gérés séparément après l'update principal
        },
        include: {
          siegeContacts: true,
          sites: {
            include: { contacts: true },
          },
          adresses: true,
          comptesBancaires: true,
          modePaiement: true,
          conditionPaiement: true,
        },
      });

      // Gérer les sites séparément pour ne pas supprimer ceux avec des données liées
      if (hasSitesData) {
        const sitesFromInput = data.sites
          .filter((s: any) => s?.nom && String(s.nom).trim())
          .map((s: any) => ({
            id: s.id || null, // ID du site existant (null si nouveau)
            nom: s.nom,
            adresse: s.adresse || null,
            complement: s.complement || null,
            codePostal: s.codePostal || null,
            ville: s.ville || null,
            pays: s.pays || 'Algérie',
            tel: s.tel || null,
            fax: s.fax || null,
            email: s.email || null,
            notes: s.notes || null,
          }));

        // Récupérer les sites existants
        const existingSites = await prisma.site.findMany({
          where: { clientId: id },
          select: { id: true, nom: true },
        });

        const existingSiteIds = existingSites.map(s => s.id);

        // Mettre à jour ou créer les sites
        for (const siteData of sitesFromInput) {
          // Correspondance par ID (prioritaire) ou par nom (fallback pour compatibilité)
          const existingSiteById = siteData.id ? existingSites.find(s => s.id === siteData.id) : null;
          const existingSiteByName = !existingSiteById
            ? existingSites.find(s => s.nom.toLowerCase().trim() === siteData.nom.toLowerCase().trim())
            : null;
          const existingSite = existingSiteById || existingSiteByName;

          if (existingSite) {
            // Mettre à jour le site existant (y compris le nom)
            await prisma.site.update({
              where: { id: existingSite.id },
              data: {
                nom: siteData.nom, // Permettre la modification du nom
                adresse: siteData.adresse,
                complement: siteData.complement,
                codePostal: siteData.codePostal,
                ville: siteData.ville,
                pays: siteData.pays,
                tel: siteData.tel,
                fax: siteData.fax,
                email: siteData.email,
                notes: siteData.notes,
              },
            });
          } else {
            // Créer un nouveau site
            await prisma.site.create({
              data: {
                clientId: id,
                nom: siteData.nom,
                adresse: siteData.adresse,
                complement: siteData.complement,
                codePostal: siteData.codePostal,
                ville: siteData.ville,
                pays: siteData.pays,
                tel: siteData.tel,
                fax: siteData.fax,
                email: siteData.email,
                notes: siteData.notes,
              },
            });
          }
        }

        // Supprimer les sites qui ne sont plus dans la liste
        const siteIdsFromInput = sitesFromInput
          .filter((s: any) => s.id)
          .map((s: any) => s.id);

        const sitesToDelete = existingSites.filter(s => !siteIdsFromInput.includes(s.id));
        const sitesNotDeleted: { nom: string; reason: string }[] = [];

        for (const siteToDelete of sitesToDelete) {
          try {
            // Vérifier si le site a des contrats ou interventions liés
            const hasRelatedData = await prisma.contratSite.findFirst({
              where: { siteId: siteToDelete.id },
            });
            const hasInterventions = await prisma.intervention.findFirst({
              where: { siteId: siteToDelete.id },
            });

            if (!hasRelatedData && !hasInterventions) {
              // Supprimer les contacts du site d'abord
              await prisma.siteContact.deleteMany({
                where: { siteId: siteToDelete.id },
              });
              // Puis supprimer le site
              await prisma.site.delete({
                where: { id: siteToDelete.id },
              });
            } else {
              // Collecter les sites non supprimés avec la raison
              const reasons: string[] = [];
              if (hasRelatedData) reasons.push('contrat en cours');
              if (hasInterventions) reasons.push('interventions liées');
              sitesNotDeleted.push({
                nom: siteToDelete.nom,
                reason: reasons.join(' et '),
              });
            }
          } catch (deleteError) {
            // En cas d'erreur de contrainte, ajouter à la liste
            sitesNotDeleted.push({
              nom: siteToDelete.nom,
              reason: 'données liées',
            });
          }
        }

        // Stocker les sites non supprimés pour la réponse
        (req as any).sitesNotDeleted = sitesNotDeleted;
      }

      // Recharger le tiers avec toutes les relations
      const updatedTiers = await prisma.client.findUnique({
        where: { id },
        include: {
          siegeContacts: true,
          sites: { include: { contacts: true } },
          adresses: true,
          comptesBancaires: true,
          modePaiement: true,
          conditionPaiement: true,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Tiers', tiers.id, {
        before: existing,
        after: updatedTiers,
      });

      // Inclure les sites non supprimés dans la réponse
      const sitesNotDeleted = (req as any).sitesNotDeleted || [];
      res.json({
        tiers: updatedTiers,
        ...(sitesNotDeleted.length > 0 && { sitesNotDeleted }),
      });
    } catch (error) {
      console.error('Update tiers error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/tiers/:id
   */
  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const existing = await prisma.client.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Tiers non trouvé' });
      }

      // Suppression en cascade
      await prisma.$transaction([
        prisma.intervention.deleteMany({ where: { clientId: id } }),
        prisma.contratSite.deleteMany({ where: { contrat: { clientId: id } } }),
        prisma.contrat.deleteMany({ where: { clientId: id } }),
        prisma.siteContact.deleteMany({ where: { site: { clientId: id } } }),
        prisma.site.deleteMany({ where: { clientId: id } }),
        prisma.adresse.deleteMany({ where: { clientId: id } }),
        prisma.compteBancaire.deleteMany({ where: { clientId: id } }),
        prisma.siegeContact.deleteMany({ where: { clientId: id } }),
        prisma.client.delete({ where: { id } }),
      ]);

      await createAuditLog(req.user!.id, 'DELETE', 'Tiers', id);

      res.json({ message: 'Tiers supprimé' });
    } catch (error) {
      console.error('Delete tiers error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/tiers/:id/convertir
   * Convertir un prospect en client
   */
  async convertirProspect(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const tiers = await prisma.client.findUnique({ where: { id } });
      if (!tiers) {
        return res.status(404).json({ error: 'Tiers non trouvé' });
      }

      if (tiers.typeTiers !== 'PROSPECT') {
        return res.status(400).json({ error: 'Ce tiers n\'est pas un prospect' });
      }

      // Générer un nouveau code client
      const newCode = await generateCodeTiers('CLIENT');

      const updated = await prisma.client.update({
        where: { id },
        data: {
          typeTiers: 'CLIENT',
          code: newCode,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Tiers', id, {
        before: { typeTiers: 'PROSPECT' },
        after: { typeTiers: 'CLIENT', action: 'CONVERT_TO_CLIENT' },
      });

      res.json({ tiers: updated, message: 'Prospect converti en client' });
    } catch (error) {
      console.error('Convertir prospect error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ CONTACTS ============

  /**
   * POST /api/tiers/:id/contacts
   */
  async addContact(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const contact = await prisma.siegeContact.create({
        data: {
          clientId: id,
          civilite: data.civilite,
          nom: data.nom,
          prenom: data.prenom,
          fonction: data.fonction || '',
          tel: data.tel,
          telMobile: data.telMobile,
          fax: data.fax,
          email: data.email,
          dateNaissance: data.dateNaissance ? new Date(data.dateNaissance) : null,
          notes: data.notes,
          estPrincipal: data.estPrincipal || false,
        },
      });

      // Si ce contact est principal, retirer le flag des autres
      if (contact.estPrincipal) {
        await prisma.siegeContact.updateMany({
          where: { clientId: id, id: { not: contact.id } },
          data: { estPrincipal: false },
        });
      }

      res.status(201).json({ contact });
    } catch (error) {
      console.error('Add contact error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/tiers/:tiersId/contacts/:id
   */
  async updateContact(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const contact = await prisma.siegeContact.update({
        where: { id },
        data: {
          civilite: data.civilite,
          nom: data.nom,
          prenom: data.prenom,
          fonction: data.fonction,
          tel: data.tel,
          telMobile: data.telMobile,
          fax: data.fax,
          email: data.email,
          dateNaissance: data.dateNaissance ? new Date(data.dateNaissance) : undefined,
          notes: data.notes,
          estPrincipal: data.estPrincipal,
          actif: data.actif,
        },
      });

      // Si ce contact devient principal, retirer le flag des autres
      if (data.estPrincipal) {
        await prisma.siegeContact.updateMany({
          where: { clientId: contact.clientId, id: { not: contact.id } },
          data: { estPrincipal: false },
        });
      }

      res.json({ contact });
    } catch (error) {
      console.error('Update contact error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/tiers/:tiersId/contacts/:id
   */
  async deleteContact(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      await prisma.siegeContact.delete({ where: { id } });

      res.json({ message: 'Contact supprimé' });
    } catch (error) {
      console.error('Delete contact error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ ADRESSES ============

  /**
   * POST /api/tiers/:id/adresses
   */
  async addAdresse(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const adresse = await prisma.adresse.create({
        data: {
          clientId: id,
          type: data.type || 'SITE',
          libelle: data.libelle,
          adresse: data.adresse,
          complement: data.complement,
          codePostal: data.codePostal,
          ville: data.ville,
          pays: data.pays || 'Algérie',
          contactNom: data.contactNom,
          contactTel: data.contactTel,
          contactEmail: data.contactEmail,
          estDefaut: data.estDefaut || false,
          notes: data.notes,
        },
      });

      // Si cette adresse est par défaut, retirer le flag des autres du même type
      if (adresse.estDefaut) {
        await prisma.adresse.updateMany({
          where: { clientId: id, type: adresse.type, id: { not: adresse.id } },
          data: { estDefaut: false },
        });
      }

      res.status(201).json({ adresse });
    } catch (error) {
      console.error('Add adresse error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/tiers/:tiersId/adresses/:id
   */
  async updateAdresse(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const adresse = await prisma.adresse.update({
        where: { id },
        data: {
          type: data.type,
          libelle: data.libelle,
          adresse: data.adresse,
          complement: data.complement,
          codePostal: data.codePostal,
          ville: data.ville,
          pays: data.pays,
          contactNom: data.contactNom,
          contactTel: data.contactTel,
          contactEmail: data.contactEmail,
          estDefaut: data.estDefaut,
          notes: data.notes,
          actif: data.actif,
        },
      });

      if (data.estDefaut) {
        await prisma.adresse.updateMany({
          where: { clientId: adresse.clientId, type: adresse.type, id: { not: adresse.id } },
          data: { estDefaut: false },
        });
      }

      res.json({ adresse });
    } catch (error) {
      console.error('Update adresse error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/tiers/:tiersId/adresses/:id
   */
  async deleteAdresse(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      await prisma.adresse.delete({ where: { id } });

      res.json({ message: 'Adresse supprimée' });
    } catch (error) {
      console.error('Delete adresse error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ COMPTES BANCAIRES ============

  /**
   * POST /api/tiers/:id/comptes-bancaires
   */
  async addCompteBancaire(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const compte = await prisma.compteBancaire.create({
        data: {
          clientId: id,
          libelle: data.libelle,
          banque: data.banque,
          agence: data.agence,
          codeBanque: data.codeBanque,
          codeGuichet: data.codeGuichet,
          numeroCompte: data.numeroCompte,
          cleRib: data.cleRib,
          iban: data.iban,
          bic: data.bic,
          titulaire: data.titulaire,
          devise: data.devise || 'DZD',
          estDefaut: data.estDefaut || false,
        },
      });

      if (compte.estDefaut) {
        await prisma.compteBancaire.updateMany({
          where: { clientId: id, id: { not: compte.id } },
          data: { estDefaut: false },
        });
      }

      res.status(201).json({ compte });
    } catch (error) {
      console.error('Add compte bancaire error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/tiers/:tiersId/comptes-bancaires/:id
   */
  async updateCompteBancaire(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const compte = await prisma.compteBancaire.update({
        where: { id },
        data: {
          libelle: data.libelle,
          banque: data.banque,
          agence: data.agence,
          codeBanque: data.codeBanque,
          codeGuichet: data.codeGuichet,
          numeroCompte: data.numeroCompte,
          cleRib: data.cleRib,
          iban: data.iban,
          bic: data.bic,
          titulaire: data.titulaire,
          devise: data.devise,
          estDefaut: data.estDefaut,
          actif: data.actif,
        },
      });

      if (data.estDefaut) {
        await prisma.compteBancaire.updateMany({
          where: { clientId: compte.clientId, id: { not: compte.id } },
          data: { estDefaut: false },
        });
      }

      res.json({ compte });
    } catch (error) {
      console.error('Update compte bancaire error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/tiers/:tiersId/comptes-bancaires/:id
   */
  async deleteCompteBancaire(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      await prisma.compteBancaire.delete({ where: { id } });

      res.json({ message: 'Compte bancaire supprimé' });
    } catch (error) {
      console.error('Delete compte bancaire error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ SITES ============

  /**
   * GET /api/tiers/:id/sites
   * Liste des sites d'un tiers
   */
  async listSites(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const sites = await prisma.site.findMany({
        where: { clientId: id },
        include: {
          contacts: {
            orderBy: [{ estPrincipal: 'desc' }, { nom: 'asc' }],
          },
          _count: {
            select: { contratSites: true, interventions: true },
          },
        },
        orderBy: { nom: 'asc' },
      });

      res.json({ sites });
    } catch (error) {
      console.error('List sites error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/sites/:id
   * Détail d'un site
   */
  async getSite(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const site = await prisma.site.findUnique({
        where: { id },
        include: {
          client: {
            select: { id: true, code: true, nomEntreprise: true },
          },
          contacts: {
            orderBy: [{ estPrincipal: 'desc' }, { nom: 'asc' }],
          },
          contratSites: {
            include: {
              contrat: {
                select: { id: true, type: true, statut: true, dateDebut: true, dateFin: true },
              },
            },
          },
          interventions: {
            orderBy: { datePrevue: 'desc' },
            take: 10,
          },
        },
      });

      if (!site) {
        return res.status(404).json({ error: 'Site non trouvé' });
      }

      res.json({ site });
    } catch (error) {
      console.error('Get site error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/tiers/:id/sites
   * Créer un site pour un tiers
   */
  async addSite(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const site = await prisma.site.create({
        data: {
          clientId: id,
          code: data.code,
          nom: data.nom,
          adresse: data.adresse,
          complement: data.complement,
          codePostal: data.codePostal,
          ville: data.ville,
          pays: data.pays || 'Algérie',
          latitude: data.latitude,
          longitude: data.longitude,
          tel: data.tel,
          fax: data.fax,
          email: data.email,
          horairesOuverture: data.horairesOuverture,
          accessibilite: data.accessibilite,
          notes: data.notes,
          contacts: {
            create: data.contacts?.map((c: any, i: number) => ({
              civilite: c.civilite,
              nom: c.nom,
              prenom: c.prenom,
              fonction: c.fonction,
              tel: c.tel,
              telMobile: c.telMobile,
              email: c.email,
              notes: c.notes,
              estPrincipal: i === 0 || c.estPrincipal,
            })) || [],
          },
        },
        include: {
          contacts: true,
        },
      });

      await createAuditLog(req.user!.id, 'CREATE', 'Site', site.id, { after: site });

      res.status(201).json({ site });
    } catch (error) {
      console.error('Add site error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/sites/:id
   * Mettre à jour un site
   */
  async updateSite(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await prisma.site.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Site non trouvé' });
      }

      const site = await prisma.site.update({
        where: { id },
        data: {
          code: data.code,
          nom: data.nom,
          adresse: data.adresse,
          complement: data.complement,
          codePostal: data.codePostal,
          ville: data.ville,
          pays: data.pays,
          latitude: data.latitude,
          longitude: data.longitude,
          tel: data.tel,
          fax: data.fax,
          email: data.email,
          horairesOuverture: data.horairesOuverture,
          accessibilite: data.accessibilite,
          notes: data.notes,
          actif: data.actif,
        },
        include: {
          contacts: true,
        },
      });

      await createAuditLog(req.user!.id, 'UPDATE', 'Site', site.id, {
        before: existing,
        after: site,
      });

      res.json({ site });
    } catch (error) {
      console.error('Update site error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/sites/:id
   * Supprimer un site
   */
  async deleteSite(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const site = await prisma.site.findUnique({
        where: { id },
        include: {
          _count: { select: { contratSites: true, interventions: true } },
        },
      });

      if (!site) {
        return res.status(404).json({ error: 'Site non trouvé' });
      }

      // Vérifier qu'il n'y a pas de contrats/interventions liés
      if (site._count.contratSites > 0 || site._count.interventions > 0) {
        return res.status(400).json({
          error: 'Impossible de supprimer ce site car il est lié à des contrats ou interventions',
        });
      }

      await prisma.$transaction([
        prisma.siteContact.deleteMany({ where: { siteId: id } }),
        prisma.site.delete({ where: { id } }),
      ]);

      await createAuditLog(req.user!.id, 'DELETE', 'Site', id);

      res.json({ message: 'Site supprimé' });
    } catch (error) {
      console.error('Delete site error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ CONTACTS DE SITE ============

  /**
   * POST /api/sites/:id/contacts
   * Ajouter un contact à un site
   */
  async addSiteContact(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const contact = await prisma.siteContact.create({
        data: {
          siteId: id,
          civilite: data.civilite,
          nom: data.nom,
          prenom: data.prenom,
          fonction: data.fonction,
          tel: data.tel,
          telMobile: data.telMobile,
          email: data.email,
          notes: data.notes,
          estPrincipal: data.estPrincipal || false,
        },
      });

      // Si ce contact est principal, retirer le flag des autres
      if (contact.estPrincipal) {
        await prisma.siteContact.updateMany({
          where: { siteId: id, id: { not: contact.id } },
          data: { estPrincipal: false },
        });
      }

      res.status(201).json({ contact });
    } catch (error) {
      console.error('Add site contact error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * PUT /api/sites/:siteId/contacts/:id
   * Mettre à jour un contact de site
   */
  async updateSiteContact(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const contact = await prisma.siteContact.update({
        where: { id },
        data: {
          civilite: data.civilite,
          nom: data.nom,
          prenom: data.prenom,
          fonction: data.fonction,
          tel: data.tel,
          telMobile: data.telMobile,
          email: data.email,
          notes: data.notes,
          estPrincipal: data.estPrincipal,
          actif: data.actif,
        },
      });

      // Si ce contact devient principal, retirer le flag des autres
      if (data.estPrincipal) {
        await prisma.siteContact.updateMany({
          where: { siteId: contact.siteId, id: { not: contact.id } },
          data: { estPrincipal: false },
        });
      }

      res.json({ contact });
    } catch (error) {
      console.error('Update site contact error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * DELETE /api/sites/:siteId/contacts/:id
   * Supprimer un contact de site
   */
  async deleteSiteContact(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      await prisma.siteContact.delete({ where: { id } });

      res.json({ message: 'Contact supprimé' });
    } catch (error) {
      console.error('Delete site contact error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ RÉFÉRENTIELS ============

  /**
   * GET /api/modes-paiement
   */
  async listModesPaiement(req: AuthRequest, res: Response) {
    try {
      const modes = await prisma.modePaiement.findMany({
        where: { actif: true },
        orderBy: { ordre: 'asc' },
      });
      res.json({ modes });
    } catch (error) {
      console.error('List modes paiement error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/modes-paiement
   */
  async createModePaiement(req: AuthRequest, res: Response) {
    try {
      const { code, libelle, ordre } = req.body;
      const mode = await prisma.modePaiement.create({
        data: { code, libelle, ordre: ordre || 0 },
      });
      res.status(201).json({ mode });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ce code existe déjà' });
      }
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/conditions-paiement
   */
  async listConditionsPaiement(req: AuthRequest, res: Response) {
    try {
      const conditions = await prisma.conditionPaiement.findMany({
        where: { actif: true },
        orderBy: { ordre: 'asc' },
      });
      res.json({ conditions });
    } catch (error) {
      console.error('List conditions paiement error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * POST /api/conditions-paiement
   */
  async createConditionPaiement(req: AuthRequest, res: Response) {
    try {
      const { code, libelle, nbJours, ordre } = req.body;
      const condition = await prisma.conditionPaiement.create({
        data: { code, libelle, nbJours: nbJours || 0, ordre: ordre || 0 },
      });
      res.status(201).json({ condition });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ce code existe déjà' });
      }
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  // ============ STATISTIQUES ============

  /**
   * GET /api/tiers/stats
   */
  async getStats(req: AuthRequest, res: Response) {
    try {
      const [
        totalClients,
        totalFournisseurs,
        totalProspects,
        clientsActifs,
        fournisseursActifs,
        prospectsActifs,
      ] = await Promise.all([
        prisma.client.count({ where: { typeTiers: { in: ['CLIENT', 'CLIENT_FOURNISSEUR'] } } }),
        prisma.client.count({ where: { typeTiers: { in: ['FOURNISSEUR', 'CLIENT_FOURNISSEUR'] } } }),
        prisma.client.count({ where: { typeTiers: 'PROSPECT' } }),
        prisma.client.count({ where: { typeTiers: { in: ['CLIENT', 'CLIENT_FOURNISSEUR'] }, actif: true } }),
        prisma.client.count({ where: { typeTiers: { in: ['FOURNISSEUR', 'CLIENT_FOURNISSEUR'] }, actif: true } }),
        prisma.client.count({ where: { typeTiers: 'PROSPECT', actif: true } }),
      ]);

      res.json({
        stats: {
          clients: { total: totalClients, actifs: clientsActifs },
          fournisseurs: { total: totalFournisseurs, actifs: fournisseursActifs },
          prospects: { total: totalProspects, actifs: prospectsActifs },
        },
      });
    } catch (error) {
      console.error('Get tiers stats error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default tiersController;
