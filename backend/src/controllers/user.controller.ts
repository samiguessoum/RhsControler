import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { createAuditLog } from './audit.controller.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { getUserUsages } from '../services/usages.service.js';
import { rattraperAccrualEmploye } from '../services/conges-accrual.service.js';


/**
 * Un employé ne peut être lié qu'à un seul compte.
 * Retourne un message d'erreur, ou null si le lien est possible.
 */
async function checkEmployeLinkable(employeId: string, userId?: string): Promise<string | null> {
  const employe = await prisma.employe.findUnique({
    where: { id: employeId },
    select: { user: { select: { id: true, prenom: true, nom: true } } },
  });
  if (!employe) return 'Employé non trouvé';
  if (employe.user && employe.user.id !== userId) {
    return `Cet employé est déjà lié au compte de ${employe.user.prenom} ${employe.user.nom}`;
  }
  return null;
}

/**
 * Suppression définitive d'un utilisateur dans une transaction.
 * Ce qu'il a créé est réassigné à `adminId`, les références facultatives sont vidées.
 * La fiche employé liée éventuelle est conservée.
 */
export async function purgeUser(tx: Prisma.TransactionClient, id: string, adminId: string) {
  // FK requises (non nullable) → réassigner à l'admin qui supprime (l'historique est conservé)
  await tx.auditLog.deleteMany({ where: { userId: id } });
  await tx.mouvementStock.updateMany({ where: { userId: id }, data: { userId: adminId } });
  await tx.intervention.updateMany({ where: { createdById: id }, data: { createdById: adminId } });
  await tx.zoningVersion.updateMany({ where: { createdById: id }, data: { createdById: adminId } });
  await tx.fieldIntervention.updateMany({ where: { createdById: id }, data: { createdById: adminId } });
  await tx.fieldReport.updateMany({ where: { generatedById: id }, data: { generatedById: adminId } });
  await tx.reclamation.updateMany({ where: { createdById: id }, data: { createdById: adminId } });
  await tx.siteDocument.updateMany({ where: { uploadedById: id }, data: { uploadedById: adminId } });
  await tx.importLog.updateMany({ where: { createdById: id }, data: { createdById: adminId } });
  await tx.avenant.updateMany({ where: { createdById: id }, data: { createdById: adminId } });

  // FK optionnelles → mettre à null
  await tx.intervention.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.contrat.updateMany({ where: { responsablePlanningId: id }, data: { responsablePlanningId: null } });
  await tx.conge.updateMany({ where: { approuveParId: id }, data: { approuveParId: null } });
  await tx.mouvementConge.updateMany({ where: { auteurId: id }, data: { auteurId: null } });

  // Zoning / terrain
  await tx.fieldIntervention.updateMany({ where: { validatedById: id }, data: { validatedById: null } });
  await tx.deviceControl.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.fISimpleCheck.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.deviceControlAudit.updateMany({ where: { changedById: id }, data: { changedById: null } });

  // Commerce
  await tx.devis.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.devis.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.commande.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.commande.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.bonLivraison.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.bonLivraison.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.facture.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.facture.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.paiement.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.factureRelance.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.commandeFournisseur.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.commandeFournisseur.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.factureFournisseur.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.factureFournisseur.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.paiementFournisseur.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.charge.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.charge.updateMany({ where: { updatedById: id }, data: { updatedById: null } });
  await tx.paiementCharge.updateMany({ where: { createdById: id }, data: { createdById: null } });
  await tx.paiementDivers.updateMany({ where: { createdById: id }, data: { createdById: null } });

  await tx.user.delete({ where: { id } });
}

export const userController = {
  /**
   * GET /api/users
   */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          tel: true,
          role: true,
          actif: true,
          employeId: true,
          createdAt: true,
        },
        orderBy: [{ role: 'asc' }, { nom: 'asc' }],
      });

      res.json({ users });
    } catch (error) {
      logger.error({ err: error }, 'List users error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/users/:id
   */
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          tel: true,
          role: true,
          actif: true,
          employeId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      res.json({ user });
    } catch (error) {
      logger.error({ err: error }, 'Get user error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/users
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, password, nom, prenom, tel, role, employeId, createEmploye } = req.body;

      // Vérifier si email existe déjà
      const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existing) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }

      if (employeId) {
        const linkError = await checkEmployeLinkable(employeId);
        if (linkError) return res.status(400).json({ error: linkError });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      // Compte + fiche employé éventuelle créés ensemble : tout ou rien
      const { user, newEmployeId } = await prisma.$transaction(async (tx) => {
        let linkedEmployeId: string | undefined = employeId;
        let createdEmployeId: string | undefined;
        if (!linkedEmployeId && createEmploye) {
          const employe = await tx.employe.create({
            data: {
              prenom,
              nom,
              dateEntree: createEmploye.dateEntree ? new Date(createEmploye.dateEntree) : undefined,
              postes: { connect: createEmploye.posteIds.map((pid: string) => ({ id: pid })) },
            },
          });
          linkedEmployeId = employe.id;
          createdEmployeId = employe.id;
        }

        const created = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            password: hashedPassword,
            nom,
            prenom,
            tel,
            role,
            employeId: linkedEmployeId,
          },
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            tel: true,
            role: true,
            actif: true,
            employeId: true,
            createdAt: true,
          },
        });
        return { user: created, newEmployeId: createdEmployeId };
      });

      // Congés déjà dus depuis l'entrée de la nouvelle fiche employé
      if (newEmployeId) {
        const employe = await prisma.employe.findUnique({ where: { id: newEmployeId }, select: { dateEntree: true } });
        await rattraperAccrualEmploye(newEmployeId, employe?.dateEntree ?? null, req.user?.id).catch((err) => {
          logger.error({ err }, 'rattraperAccrualEmploye failed after user create');
        });
      }

      // Audit log
      await createAuditLog(req.user!.id, 'CREATE', 'User', user.id, { after: user });

      res.status(201).json({ user });
    } catch (error) {
      logger.error({ err: error }, 'Create user error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * PUT /api/users/:id
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { email, password, nom, prenom, tel, role, actif, employeId } = req.body;

      const existing = await prisma.user.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Éviter de se bloquer soi-même
      if (id === req.user?.id) {
        if (actif === false) {
          return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' });
        }
        if (role && role !== existing.role) {
          return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' });
        }
      }

      // Toujours garder au moins un super administrateur actif
      if (existing.role === 'SUPER_ADMIN' && existing.actif && ((role && role !== 'SUPER_ADMIN') || actif === false)) {
        const autresSuperAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', actif: true, id: { not: id } } });
        if (autresSuperAdmins === 0) {
          return res.status(400).json({ error: 'Il doit rester au moins un super administrateur actif' });
        }
      }

      if (employeId && employeId !== existing.employeId) {
        const linkError = await checkEmployeLinkable(employeId, id);
        if (linkError) return res.status(400).json({ error: linkError });
      }

      // Vérifier email unique si modifié
      if (email && email.toLowerCase() !== existing.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (emailExists) {
          return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
      }

      const updateData: any = {};
      if (email) updateData.email = email.toLowerCase();
      if (password) {
        updateData.password = await bcrypt.hash(password, 12);
        // Invalide les sessions ouvertes avec l'ancien mot de passe
        updateData.passwordChangedAt = new Date();
      }
      if (nom) updateData.nom = nom;
      if (prenom) updateData.prenom = prenom;
      if (tel !== undefined) updateData.tel = tel;
      if (role) updateData.role = role;
      if (actif !== undefined) updateData.actif = actif;
      if (employeId !== undefined) updateData.employeId = employeId || null;

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          tel: true,
          role: true,
          actif: true,
          employeId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Audit log
      await createAuditLog(req.user!.id, 'UPDATE', 'User', user.id, {
        before: { ...existing, password: '[HIDDEN]' },
        after: { ...user, password: '[HIDDEN]' },
      });

      res.json({ user });
    } catch (error) {
      logger.error({ err: error }, 'Update user error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/users/:id (désactivation)
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Empêcher de se désactiver soi-même
      if (id === req.user?.id) {
        return res.status(400).json({ error: 'Vous ne pouvez pas vous désactiver vous-même' });
      }

      const existing = await prisma.user.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      if (existing.role === 'SUPER_ADMIN' && existing.actif) {
        const autresSuperAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', actif: true, id: { not: id } } });
        if (autresSuperAdmins === 0) {
          return res.status(400).json({ error: 'Il doit rester au moins un super administrateur actif' });
        }
      }

      await prisma.user.update({
        where: { id },
        data: { actif: false },
      });

      // Audit log
      await createAuditLog(req.user!.id, 'DELETE', 'User', id);

      res.json({ message: 'Utilisateur désactivé' });
    } catch (error) {
      logger.error({ err: error }, 'Delete user error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/users/:id/usages — opérations rattachées (à réaffecter avant suppression)
   */
  async usages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!existing) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      res.json(await getUserUsages(id));
    } catch (error) {
      logger.error({ err: error }, 'User usages error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/users/:id/permanent — suppression définitive (DIRECTION uniquement)
   */
  async permanentDelete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (id === req.user?.id) {
        return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
      }

      const existing = await prisma.user.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      if (existing.role === 'SUPER_ADMIN') {
        const autresSuperAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', actif: true, id: { not: id } } });
        if (autresSuperAdmins === 0) {
          return res.status(400).json({ error: 'Il doit rester au moins un super administrateur actif' });
        }
      }

      const adminId = req.user!.id;

      await prisma.$transaction((tx) => purgeUser(tx, id, adminId));

      await createAuditLog(adminId, 'DELETE', 'User', id);

      res.json({ message: 'Utilisateur supprimé définitivement' });
    } catch (error) {
      logger.error({ err: error }, 'Permanent delete user error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default userController;
