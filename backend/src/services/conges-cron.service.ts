import cron from 'node-cron';
import { prisma } from '../config/database.js';
import logger from '../lib/logger.js';

// Credite 2.5 jours de conge a tous les employes le 1er de chaque mois
async function crediterMoisCourant(): Promise<void> {
  const now = new Date();
  const annee = now.getFullYear();
  const mois = now.getMonth() + 1; // 1-based

  const settings = await prisma.companySettings.findFirst();
  const joursParMois = settings?.joursCongesMensuels ?? 2.5;

  const employes = await prisma.employe.findMany({ select: { id: true } });
  let credites = 0;

  for (const emp of employes) {
    // Anti-doublon : ne pas crediter deux fois le meme mois
    const dejaCredite = await prisma.mouvementConge.findFirst({
      where: { employeId: emp.id, typeOp: 'ACQUISITION', annee, mois },
    });
    if (dejaCredite) continue;

    const solde = await prisma.soldeConge.findUnique({
      where: { employeId_annee_type: { employeId: emp.id, annee, type: 'ANNUEL' } },
    });

    const nouvelAcquis = (solde?.joursAcquis ?? 0) + joursParMois;
    const nouveauRestant = (solde?.joursRestants ?? 0) + joursParMois;

    await prisma.soldeConge.upsert({
      where: { employeId_annee_type: { employeId: emp.id, annee, type: 'ANNUEL' } },
      update: { joursAcquis: nouvelAcquis, joursRestants: nouveauRestant },
      create: {
        employeId: emp.id, annee, type: 'ANNUEL',
        joursAcquis: joursParMois, joursRestants: joursParMois,
      },
    });

    await prisma.mouvementConge.create({
      data: {
        employeId: emp.id, typeOp: 'ACQUISITION', sens: 'CREDIT',
        jours: joursParMois, soldeApres: nouveauRestant,
        motif: `Acquisition automatique ${mois}/${annee}`,
        annee, mois,
      },
    });
    credites++;
  }

  logger.info(`Cron conges : ${joursParMois}j credites pour ${credites} employe(s) - ${mois}/${annee}`);
}

export function startCongesCron(): void {
  // Le 1er de chaque mois a 00:05
  cron.schedule('5 0 1 * *', () => {
    crediterMoisCourant().catch((err) => {
      logger.error({ err }, 'Erreur cron acquisition conges mensuelle');
    });
  });

  logger.info('Cron conges : planifie (1er de chaque mois a 00:05)');
}
