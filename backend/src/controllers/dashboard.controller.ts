import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import planningService from '../services/planning.service.js';
import { prisma } from '../config/database.js';
import { startOfDay, endOfDay, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const dashboardController = {
  /**
   * GET /api/dashboard/stats
   */
  async stats(req: AuthRequest, res: Response) {
    try {
      const stats = await planningService.getStats();
      res.json({ stats });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/dashboard/stats-extended
   * Statistiques enrichies pour le nouveau dashboard
   */
  async statsExtended(req: AuthRequest, res: Response) {
    try {
      const today = startOfDay(new Date());
      const endToday = endOfDay(new Date());
      const in7Days = endOfDay(addDays(today, 7));
      const in30Days = endOfDay(addDays(today, 30));
      const startMonth = startOfMonth(today);
      const endMonth = endOfMonth(today);
      const lastMonth = subMonths(today, 1);
      const startLastMonth = startOfMonth(lastMonth);
      const endLastMonth = endOfMonth(lastMonth);

      // Stats de base
      const [
        aPlanifier,
        enRetard,
        controles30j,
        contratsEnAlerte,
        ponctuelAlerte,
        contratsAnnuelsFinProche,
        // Stats du jour
        interventionsAujourdhui,
        realiseeAujourdhui,
        // Stats du mois
        totalMois,
        realiseeMois,
        annuleeMois,
        // Stats mois précédent pour tendance
        totalMoisPrecedent,
        realiseeMoisPrecedent,
        // Totaux
        totalClients,
        totalContrats,
        // Prochaines 7 jours par jour
        interventionsParJour,
      ] = await Promise.all([
        // Interventions à planifier dans les 7 prochains jours
        prisma.intervention.count({
          where: {
            datePrevue: { gte: today, lte: in7Days },
            statut: 'A_PLANIFIER',
          },
        }),
        // En retard
        prisma.intervention.count({
          where: {
            datePrevue: { lt: today },
            statut: { notIn: ['REALISEE', 'ANNULEE'] },
          },
        }),
        // Contrôles 30j
        prisma.intervention.count({
          where: {
            datePrevue: { gte: today, lte: in30Days },
            type: 'CONTROLE',
            statut: { notIn: ['REALISEE', 'ANNULEE'] },
          },
        }),
        // Contrats en alerte
        planningService.getContratsEnAlerte(),
        planningService.getContratsPonctuelAlerte(),
        // Contrats annuels proches de la fin (60 jours)
        planningService.getContratsAnnuelsFinProche(60),
        // Interventions aujourd'hui
        prisma.intervention.count({
          where: {
            datePrevue: { gte: today, lte: endToday },
            statut: { notIn: ['ANNULEE'] },
          },
        }),
        // Réalisées aujourd'hui
        prisma.intervention.count({
          where: {
            dateRealisee: { gte: today, lte: endToday },
            statut: 'REALISEE',
          },
        }),
        // Total du mois
        prisma.intervention.count({
          where: {
            datePrevue: { gte: startMonth, lte: endMonth },
          },
        }),
        // Réalisées du mois
        prisma.intervention.count({
          where: {
            datePrevue: { gte: startMonth, lte: endMonth },
            statut: 'REALISEE',
          },
        }),
        // Annulées du mois
        prisma.intervention.count({
          where: {
            datePrevue: { gte: startMonth, lte: endMonth },
            statut: 'ANNULEE',
          },
        }),
        // Total mois précédent
        prisma.intervention.count({
          where: {
            datePrevue: { gte: startLastMonth, lte: endLastMonth },
          },
        }),
        // Réalisées mois précédent
        prisma.intervention.count({
          where: {
            datePrevue: { gte: startLastMonth, lte: endLastMonth },
            statut: 'REALISEE',
          },
        }),
        // Total clients actifs
        prisma.client.count({ where: { actif: true } }),
        // Total contrats actifs
        prisma.contrat.count({ where: { statut: 'ACTIF' } }),
        // Interventions des 7 prochains jours groupées par jour
        prisma.intervention.groupBy({
          by: ['datePrevue'],
          where: {
            datePrevue: { gte: today, lte: in7Days },
            statut: { notIn: ['ANNULEE'] },
          },
          _count: true,
        }),
      ]);

      // Calculer le taux de réalisation
      const tauxRealisationMois = totalMois > 0 ? Math.round((realiseeMois / totalMois) * 100) : 0;
      const tauxRealisationMoisPrecedent = totalMoisPrecedent > 0 ? Math.round((realiseeMoisPrecedent / totalMoisPrecedent) * 100) : 0;

      // Calculer la tendance (différence avec le mois précédent)
      const tendanceTaux = tauxRealisationMois - tauxRealisationMoisPrecedent;
      const tendanceVolume = totalMois - totalMoisPrecedent;

      // Formater les interventions par jour pour les 7 prochains jours
      const prochains7Jours = [];
      for (let i = 0; i < 7; i++) {
        const jour = addDays(today, i);
        const jourStr = format(jour, 'yyyy-MM-dd');
        const count = interventionsParJour.find(
          (g: any) => format(new Date(g.datePrevue), 'yyyy-MM-dd') === jourStr
        )?._count || 0;
        prochains7Jours.push({
          date: jourStr,
          jour: format(jour, 'EEE', { locale: fr }),
          jourComplet: format(jour, 'EEEE d MMMM', { locale: fr }),
          count,
          isToday: i === 0,
        });
      }

      res.json({
        stats: {
          // Stats de base
          aPlanifier,
          enRetard,
          controles30j,
          contratsEnAlerte: contratsEnAlerte.length,
          ponctuelAlerte: ponctuelAlerte.length,
          contratsAnnuelsFinProche: contratsAnnuelsFinProche.length,
          // Stats aujourd'hui
          interventionsAujourdhui,
          realiseeAujourdhui,
          // Stats mois
          totalMois,
          realiseeMois,
          annuleeMois,
          enAttenteMois: totalMois - realiseeMois - annuleeMois,
          tauxRealisationMois,
          // Tendances
          tendanceTaux,
          tendanceVolume,
          // Totaux
          totalClients,
          totalContrats,
        },
        prochains7Jours,
        moisCourant: format(today, 'MMMM yyyy', { locale: fr }),
      });
    } catch (error) {
      console.error('Dashboard stats extended error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/dashboard/aujourdhui
   * Interventions du jour avec détails
   */
  async aujourdhui(req: AuthRequest, res: Response) {
    try {
      const today = startOfDay(new Date());
      const endToday = endOfDay(new Date());

      const interventions = await prisma.intervention.findMany({
        where: {
          datePrevue: { gte: today, lte: endToday },
        },
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          site: { select: { id: true, nom: true, adresse: true } },
          contrat: { select: { id: true, type: true } },
          interventionEmployes: {
            include: {
              employe: { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
        orderBy: [{ heurePrevue: 'asc' }, { createdAt: 'asc' }],
      });

      res.json({ interventions, count: interventions.length });
    } catch (error) {
      console.error('Dashboard aujourdhui error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/dashboard/alertes
   */
  async alertes(req: AuthRequest, res: Response) {
    try {
      const [contrats, ponctuelContrats, contratsHorsValidite, contratsAnnuelsFinProche] = await Promise.all([
        planningService.getContratsEnAlerte(),
        planningService.getContratsPonctuelAlerte(),
        planningService.getContratsHorsValidite(),
        planningService.getContratsAnnuelsFinProche(60),
      ]);

      const alertes = contrats.map((c) => ({
        id: c.id,
        type: 'CONTRAT_SANS_INTERVENTION',
        message: `Le contrat avec ${c.client.nomEntreprise} n'a aucune intervention future planifiée`,
        client: c.client,
        contratId: c.id,
        dateDebut: c.dateDebut,
        dateFin: c.dateFin,
        prestations: c.prestations,
      }));

      const ponctuelAlertes = ponctuelContrats.map((c: any) => ({
        id: `ponctuel-${c.id}`,
        type: 'PONCTUEL_FIN_PROCHE',
        message: c.operationsRestantes === 1
          ? `Dernière opération restante pour ${c.client.nomEntreprise}`
          : `${c.operationsRestantes} opérations restantes pour ${c.client.nomEntreprise}`,
        client: c.client,
        contratId: c.id,
        dateDebut: c.dateDebut,
        dateFin: c.dateFin,
        prestations: c.prestations,
        numeroBonCommande: c.numeroBonCommande,
        operationsRestantes: c.operationsRestantes,
      }));

      const horsValiditeAlertes = contratsHorsValidite.map((c) => ({
        id: `hors-validite-${c.contrat.id}`,
        type: 'CONTRAT_HORS_VALIDITE',
        message: `Interventions planifiées après la date de fin pour ${c.client.nomEntreprise}`,
        client: c.client,
        contratId: c.contrat.id,
        dateDebut: null,
        dateFin: c.contrat.dateFin,
        prestations: c.contrat.prestations,
        nextDate: c.nextDate,
        count: c.count,
      }));

      const annuelFinProcheAlertes = contratsAnnuelsFinProche.map((c: any) => ({
        id: `annuel-fin-proche-${c.id}`,
        type: 'ANNUEL_FIN_PROCHE',
        message: c.joursRestants <= 30
          ? `Contrat avec ${c.client.nomEntreprise} expire dans ${c.joursRestants} jours - Reconduction à prévoir`
          : `Contrat avec ${c.client.nomEntreprise} expire dans ${c.joursRestants} jours`,
        client: c.client,
        contratId: c.id,
        dateDebut: c.dateDebut,
        dateFin: c.dateFin,
        prestations: c.prestations,
        joursRestants: c.joursRestants,
        reconductionAuto: c.reconductionAuto,
      }));

      res.json({
        alertes: [...alertes, ...ponctuelAlertes, ...horsValiditeAlertes, ...annuelFinProcheAlertes],
        count: alertes.length + ponctuelAlertes.length + horsValiditeAlertes.length + annuelFinProcheAlertes.length,
      });
    } catch (error) {
      console.error('Dashboard alertes error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/dashboard/employes-stats
   * Statistiques des employés : charge de travail, missions cette semaine
   */
  async employesStats(req: AuthRequest, res: Response) {
    try {
      const today = startOfDay(new Date());
      const startWeek = startOfWeek(today, { weekStartsOn: 1 }); // Lundi
      const endWeekDate = endOfWeek(today, { weekStartsOn: 1 }); // Dimanche
      const startLastWeek = subDays(startWeek, 7);
      const endLastWeek = subDays(startWeek, 1);

      // Récupérer tous les employés avec leurs postes
      const employes = await prisma.employe.findMany({
        include: {
          postes: { select: { id: true, nom: true } },
        },
        orderBy: { nom: 'asc' },
      });

      // Récupérer toutes les interventions de la semaine avec les employés assignés
      const interventionsSemaine = await prisma.intervention.findMany({
        where: {
          datePrevue: { gte: startWeek, lte: endWeekDate },
          statut: { notIn: ['ANNULEE'] },
        },
        include: {
          client: { select: { id: true, nomEntreprise: true } },
          site: { select: { id: true, nom: true, adresse: true } },
          interventionEmployes: {
            include: {
              employe: { select: { id: true, nom: true, prenom: true } },
              poste: { select: { id: true, nom: true } },
            },
          },
        },
        orderBy: { datePrevue: 'asc' },
      });

      // Interventions de la semaine dernière pour comparaison
      const interventionsLastWeek = await prisma.interventionEmploye.findMany({
        where: {
          intervention: {
            datePrevue: { gte: startLastWeek, lte: endLastWeek },
            statut: { notIn: ['ANNULEE'] },
          },
        },
        select: {
          employeId: true,
          intervention: {
            select: { duree: true },
          },
        },
      });

      // Calculer les stats par employé
      const employesStats = employes.map((employe) => {
        // Missions de cette semaine
        const missionsThisWeek = interventionsSemaine.filter((i) =>
          i.interventionEmployes.some((ie) => ie.employeId === employe.id)
        );

        // Missions réalisées cette semaine
        const missionsRealisees = missionsThisWeek.filter((i) => i.statut === 'REALISEE');

        // Missions à venir cette semaine
        const missionsAVenir = missionsThisWeek.filter(
          (i) => i.statut !== 'REALISEE' && new Date(i.datePrevue) >= today
        );

        // Durée totale cette semaine (en minutes)
        const dureeTotale = missionsThisWeek.reduce((acc, i) => acc + (i.duree || 60), 0);

        // Missions semaine dernière
        const missionsLastWeek = interventionsLastWeek.filter(
          (ie) => ie.employeId === employe.id
        ).length;

        // Détails des missions avec clients
        const detailsMissions = missionsThisWeek.map((i) => ({
          id: i.id,
          date: i.datePrevue,
          heure: i.heurePrevue,
          client: i.client.nomEntreprise,
          site: i.site?.nom || null,
          adresse: i.site?.adresse || null,
          statut: i.statut,
          duree: i.duree || 60,
        }));

        // Grouper les missions par jour
        const missionsParJour: Record<string, number> = {};
        missionsThisWeek.forEach((i) => {
          const jour = format(new Date(i.datePrevue), 'yyyy-MM-dd');
          missionsParJour[jour] = (missionsParJour[jour] || 0) + 1;
        });

        return {
          id: employe.id,
          nom: employe.nom,
          prenom: employe.prenom,
          postes: employe.postes,
          // Stats semaine
          totalMissionsSemaine: missionsThisWeek.length,
          missionsRealisees: missionsRealisees.length,
          missionsAVenir: missionsAVenir.length,
          dureeTotaleSemaine: dureeTotale, // en minutes
          heuresTravaillees: Math.round(dureeTotale / 60 * 10) / 10, // en heures
          // Comparaison
          missionsSemaineDerniere: missionsLastWeek,
          tendance: missionsThisWeek.length - missionsLastWeek,
          // Détails
          missionsParJour,
          detailsMissions,
        };
      });

      // Trier par nombre de missions (décroissant)
      const employesParCharge = [...employesStats].sort(
        (a, b) => b.totalMissionsSemaine - a.totalMissionsSemaine
      );

      // Employés sans mission cette semaine
      const employesSansMission = employesStats.filter(
        (e) => e.totalMissionsSemaine === 0
      );

      // Employés les plus chargés (top 5)
      const topEmployes = employesParCharge.slice(0, 5);

      // Stats globales
      const totalMissionsSemaine = interventionsSemaine.length;
      const totalMissionsAssignees = interventionsSemaine.filter(
        (i) => i.interventionEmployes.length > 0
      ).length;
      const totalMissionsNonAssignees = totalMissionsSemaine - totalMissionsAssignees;

      res.json({
        employes: employesStats,
        employesSansMission,
        topEmployes,
        stats: {
          totalEmployes: employes.length,
          employesAvecMission: employes.length - employesSansMission.length,
          employesSansMissionCount: employesSansMission.length,
          totalMissionsSemaine,
          totalMissionsAssignees,
          totalMissionsNonAssignees,
          moyenneMissionsParEmploye:
            employes.length > 0
              ? Math.round((totalMissionsAssignees / employes.length) * 10) / 10
              : 0,
        },
        periode: {
          debut: format(startWeek, 'yyyy-MM-dd'),
          fin: format(endWeekDate, 'yyyy-MM-dd'),
          debutFormate: format(startWeek, 'EEEE d MMMM', { locale: fr }),
          finFormate: format(endWeekDate, 'EEEE d MMMM', { locale: fr }),
        },
      });
    } catch (error) {
      console.error('Dashboard employes stats error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },

  /**
   * GET /api/dashboard/operations-stats
   * Statistiques détaillées des opérations
   */
  async operationsStats(req: AuthRequest, res: Response) {
    try {
      const today = startOfDay(new Date());
      const startWeek = startOfWeek(today, { weekStartsOn: 1 });
      const endWeekDate = endOfWeek(today, { weekStartsOn: 1 });
      const startMonth = startOfMonth(today);
      const endMonth = endOfMonth(today);

      // Stats par type d'intervention ce mois
      const statsByType = await prisma.intervention.groupBy({
        by: ['type'],
        where: {
          datePrevue: { gte: startMonth, lte: endMonth },
        },
        _count: true,
      });

      // Stats par statut ce mois
      const statsByStatut = await prisma.intervention.groupBy({
        by: ['statut'],
        where: {
          datePrevue: { gte: startMonth, lte: endMonth },
        },
        _count: true,
      });

      // Interventions par prestation ce mois
      const interventionsWithPrestation = await prisma.intervention.findMany({
        where: {
          datePrevue: { gte: startMonth, lte: endMonth },
          prestation: { not: null },
        },
        select: { prestation: true },
      });

      const statsByPrestation: Record<string, number> = {};
      interventionsWithPrestation.forEach((i) => {
        if (i.prestation) {
          statsByPrestation[i.prestation] = (statsByPrestation[i.prestation] || 0) + 1;
        }
      });

      // Top clients ce mois (par nombre d'interventions)
      const topClients = await prisma.intervention.groupBy({
        by: ['clientId'],
        where: {
          datePrevue: { gte: startMonth, lte: endMonth },
        },
        _count: true,
        orderBy: { _count: { clientId: 'desc' } },
        take: 10,
      });

      // Récupérer les noms des clients
      const clientIds = topClients.map((c) => c.clientId);
      const clients = await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, nomEntreprise: true },
      });

      const topClientsWithNames = topClients.map((c) => ({
        clientId: c.clientId,
        nomEntreprise: clients.find((cl) => cl.id === c.clientId)?.nomEntreprise || 'Inconnu',
        count: c._count,
      }));

      // Interventions par jour cette semaine
      const interventionsParJourSemaine = await prisma.intervention.groupBy({
        by: ['datePrevue'],
        where: {
          datePrevue: { gte: startWeek, lte: endWeekDate },
        },
        _count: true,
      });

      // Formater par jour de la semaine
      const joursStats = [];
      for (let i = 0; i < 7; i++) {
        const jour = addDays(startWeek, i);
        const jourStr = format(jour, 'yyyy-MM-dd');
        const data = interventionsParJourSemaine.find(
          (g: any) => format(new Date(g.datePrevue), 'yyyy-MM-dd') === jourStr
        );
        joursStats.push({
          date: jourStr,
          jour: format(jour, 'EEEE', { locale: fr }),
          jourCourt: format(jour, 'EEE', { locale: fr }),
          count: data?._count || 0,
          isToday: format(today, 'yyyy-MM-dd') === jourStr,
        });
      }

      // Durée moyenne des interventions
      const interventionsWithDuree = await prisma.intervention.aggregate({
        where: {
          datePrevue: { gte: startMonth, lte: endMonth },
          duree: { not: null },
        },
        _avg: { duree: true },
        _sum: { duree: true },
        _count: true,
      });

      res.json({
        parType: statsByType.map((s) => ({
          type: s.type,
          count: s._count,
        })),
        parStatut: statsByStatut.map((s) => ({
          statut: s.statut,
          count: s._count,
        })),
        parPrestation: Object.entries(statsByPrestation)
          .map(([prestation, count]) => ({ prestation, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        topClients: topClientsWithNames,
        semaineParJour: joursStats,
        durees: {
          moyenne: Math.round(interventionsWithDuree._avg.duree || 60),
          total: interventionsWithDuree._sum.duree || 0,
          totalHeures: Math.round((interventionsWithDuree._sum.duree || 0) / 60 * 10) / 10,
          count: interventionsWithDuree._count,
        },
        moisCourant: format(today, 'MMMM yyyy', { locale: fr }),
      });
    } catch (error) {
      console.error('Dashboard operations stats error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
};

export default dashboardController;
