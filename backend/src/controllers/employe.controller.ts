import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { rattraperAccrualEmploye } from '../services/conges-accrual.service.js';

const SALARY_ROLES = ['SUPER_ADMIN', 'DIRECTION'];

function canSeeSalary(role?: string) {
  return role ? SALARY_ROLES.includes(role) : false;
}

export const employeController = {
  /**
   * GET /api/employes
   */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const showSalary = canSeeSalary(req.user?.role);

      const employes = await prisma.employe.findMany({
        include: { postes: true, _count: { select: { interventionEmployes: true } } },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      });

      const result = employes.map((e) => ({
        ...e,
        salaireBase: showSalary ? e.salaireBase : undefined,
      }));

      res.json({ employes: result });
    } catch (error) {
      logger.error({ err: error }, 'List employes error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/employes/:id
   */
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const showSalary = canSeeSalary(req.user?.role);

      const employe = await prisma.employe.findUnique({
        where: { id },
        include: { postes: true },
      });

      if (!employe) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      res.json({
        employe: {
          ...employe,
          salaireBase: showSalary ? employe.salaireBase : undefined,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Get employe error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * POST /api/employes
   */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { prenom, nom, posteIds, salaireBase, dateEntree } = req.body;

      const employe = await prisma.employe.create({
        data: {
          prenom,
          nom,
          salaireBase: salaireBase !== undefined ? parseFloat(salaireBase) : undefined,
          dateEntree: dateEntree ? new Date(dateEntree) : undefined,
          postes: {
            connect: posteIds.map((id: string) => ({ id })),
          },
        },
        include: { postes: true },
      });

      // Rattrape les jours de conges deja dus depuis l'entree (ou depuis janvier de l'annee en cours)
      await rattraperAccrualEmploye(employe.id, employe.dateEntree, req.user?.id).catch((err) => {
        logger.error({ err }, 'rattraperAccrualEmploye failed after employe create');
      });

      res.status(201).json({ employe });
    } catch (error) {
      logger.error({ err: error }, 'Create employe error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * PUT /api/employes/:id
   */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { prenom, nom, posteIds, salaireBase, dateEntree } = req.body;
      const showSalary = canSeeSalary(req.user?.role);

      const existing = await prisma.employe.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      const employe = await prisma.employe.update({
        where: { id },
        data: {
          prenom: prenom ?? existing.prenom,
          nom: nom ?? existing.nom,
          // Seuls SUPER_ADMIN/DIRECTION peuvent modifier le salaire
          ...(showSalary && salaireBase !== undefined
            ? { salaireBase: salaireBase === '' || salaireBase === null ? null : parseFloat(salaireBase) }
            : {}),
          ...(dateEntree !== undefined
            ? { dateEntree: dateEntree === '' || dateEntree === null ? null : new Date(dateEntree) }
            : {}),
          postes: posteIds
            ? { set: [], connect: posteIds.map((pid: string) => ({ id: pid })) }
            : undefined,
        },
        include: { postes: true },
      });

      // Si la date d'entree a change, rattrape les mois de conges desormais dus
      if (dateEntree !== undefined) {
        await rattraperAccrualEmploye(employe.id, employe.dateEntree, req.user?.id).catch((err) => {
          logger.error({ err }, 'rattraperAccrualEmploye failed after employe update');
        });
      }

      res.json({
        employe: {
          ...employe,
          salaireBase: showSalary ? employe.salaireBase : undefined,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Update employe error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * GET /api/employes/:id/interventions-count
   */
  async interventionsCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const count = await prisma.interventionEmploye.count({
        where: { employeId: id },
      });
      res.json({ count });
    } catch (error) {
      logger.error({ err: error }, 'Employe interventions count error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },

  /**
   * DELETE /api/employes/:id
   */
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.employe.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: 'Employé non trouvé' });
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.updateMany({ where: { employeId: id }, data: { employeId: null } });
        await tx.interventionEmploye.deleteMany({ where: { employeId: id } });
        await tx.conge.deleteMany({ where: { employeId: id } });
        await tx.jourWeekendTravaille.deleteMany({ where: { employeId: id } });
        await tx.soldeConge.deleteMany({ where: { employeId: id } });
        await tx.recuperationAccordee.deleteMany({ where: { employeId: id } });
        await tx.mouvementConge.deleteMany({ where: { employeId: id } });
        await tx.employe.delete({ where: { id } });
      });
      res.json({ message: 'Employé supprimé' });
    } catch (error) {
      logger.error({ err: error }, 'Delete employe error');
      return next(new AppError(500, 'Erreur serveur'));
    }
  },
};

export default employeController;
