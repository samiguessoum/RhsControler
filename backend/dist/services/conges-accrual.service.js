import { prisma } from '../config/database.js';
import logger from '../lib/logger.js';
/**
 * Determine a partir de quel mois (1-12) un employe commence a acquerir des conges
 * pour une annee donnee, en fonction de sa date d'entree.
 * - Entre avant cette annee -> acquisition depuis janvier
 * - Entre pendant cette annee -> acquisition depuis son mois d'entree
 * - Entre apres cette annee (pas encore embauche) -> aucune acquisition (13 = hors plage)
 */
function moisDebutAccrual(dateEntree, annee) {
    if (!dateEntree)
        return 1;
    const anneeEntree = dateEntree.getFullYear();
    if (anneeEntree < annee)
        return 1;
    if (anneeEntree > annee)
        return 13;
    return dateEntree.getMonth() + 1;
}
/**
 * Credite un employe pour un mois donne s'il ne l'a pas deja ete.
 * Idempotent : verifie l'historique des mouvements avant de crediter.
 */
export async function accruerEmployePourMois(employeId, annee, mois, auteurId) {
    const dejaCredite = await prisma.mouvementConge.findFirst({
        where: { employeId, typeOp: 'ACQUISITION', annee, mois },
    });
    if (dejaCredite)
        return false;
    const settings = await prisma.companySettings.findFirst();
    const joursParMois = settings?.joursCongesMensuels ?? 2.5;
    const solde = await prisma.soldeConge.findUnique({
        where: { employeId_annee_type: { employeId, annee, type: 'ANNUEL' } },
    });
    const nouvelAcquis = (solde?.joursAcquis ?? 0) + joursParMois;
    const nouveauRestant = (solde?.joursRestants ?? 0) + joursParMois;
    await prisma.soldeConge.upsert({
        where: { employeId_annee_type: { employeId, annee, type: 'ANNUEL' } },
        update: { joursAcquis: nouvelAcquis, joursRestants: nouveauRestant },
        create: { employeId, annee, type: 'ANNUEL', joursAcquis: joursParMois, joursRestants: joursParMois },
    });
    await prisma.mouvementConge.create({
        data: {
            employeId,
            typeOp: 'ACQUISITION',
            sens: 'CREDIT',
            jours: joursParMois,
            soldeApres: nouveauRestant,
            motif: `Acquisition mensuelle ${mois}/${annee}`,
            annee,
            mois,
            auteurId,
        },
    });
    return true;
}
/**
 * Rattrape tous les mois dus (depuis l'entree ou depuis janvier de l'annee en cours)
 * jusqu'au mois actuel pour un employe donne. Sans effet sur les mois deja credites.
 */
export async function rattraperAccrualEmploye(employeId, dateEntree, auteurId) {
    const maintenant = new Date();
    const annee = maintenant.getFullYear();
    const moisActuel = maintenant.getMonth() + 1;
    const moisDebut = moisDebutAccrual(dateEntree, annee);
    let credites = 0;
    for (let mois = moisDebut; mois <= moisActuel; mois++) {
        const ok = await accruerEmployePourMois(employeId, annee, mois, auteurId);
        if (ok)
            credites++;
    }
    return credites;
}
/**
 * Passe en revue tous les employes et credite les mois dus.
 * Concu pour etre appele automatiquement (au demarrage puis periodiquement).
 */
export async function rattraperAccrualTousEmployes() {
    const employes = await prisma.employe.findMany({ select: { id: true, dateEntree: true } });
    let total = 0;
    for (const emp of employes) {
        try {
            total += await rattraperAccrualEmploye(emp.id, emp.dateEntree);
        }
        catch (err) {
            logger.error({ err, employeId: emp.id }, 'Echec acquisition automatique des conges');
        }
    }
    if (total > 0) {
        logger.info(`[CONGES] Acquisition automatique: ${total} mois credite(s)`);
    }
    return total;
}
const INTERVALLE_VERIFICATION_MS = 6 * 60 * 60 * 1000; // 6 heures
/**
 * Demarre la verification periodique d'acquisition de conges.
 * Une passe immediate au demarrage rattrape les mois manques pendant un arret,
 * puis une verification reguliere credite le nouveau mois des qu'il commence.
 */
export function startAccrualScheduler() {
    rattraperAccrualTousEmployes().catch((err) => {
        logger.error({ err }, 'Echec acquisition automatique des conges (demarrage)');
    });
    setInterval(() => {
        rattraperAccrualTousEmployes().catch((err) => {
            logger.error({ err }, 'Echec acquisition automatique des conges (verification periodique)');
        });
    }, INTERVALLE_VERIFICATION_MS);
}
//# sourceMappingURL=conges-accrual.service.js.map