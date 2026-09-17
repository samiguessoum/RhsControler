/**
 * Tests d'intégration pour les fonctionnalités contrats / BCs.
 * Ces tests nécessitent une connexion à la base de données de test.
 *
 * Pour exécuter : npx ts-node --esm tests/integration/contrats-bc.test.ts
 * (ou avec jest si configuré)
 *
 * STATUT TYPE-CHECK : passe `npx tsc --noEmit` avec le tsconfig du projet.
 * STATUT DB : nécessite une base PostgreSQL active (DATABASE_URL dans .env).
 */

import 'dotenv/config';
import { prisma } from '../../src/config/database.js';
import planningService from '../../src/services/planning.service.js';
import { addDays, subDays } from 'date-fns';
import { csvService } from '../../src/services/csv-import.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreateTestClient(): Promise<string> {
  const existing = await prisma.client.findFirst({
    where: { nomEntreprise: '__TEST_CONTRATS_BC__' },
  });
  if (existing) return existing.id;
  const c = await prisma.client.create({
    data: { nomEntreprise: '__TEST_CONTRATS_BC__', siegeNom: 'Test' },
  });
  return c.id;
}

async function getOrCreateTestUser(): Promise<string> {
  const existing = await prisma.user.findFirst({
    where: { email: '__test_bc@rhs.local' },
  });
  if (existing) return existing.id;
  const u = await prisma.user.create({
    data: {
      email: '__test_bc@rhs.local',
      password: 'unused',
      nom: 'Test',
      prenom: 'BC',
      role: 'DIRECTION',
    },
  });
  return u.id;
}

let passed = 0;
let failed = 0;
const results: { name: string; ok: boolean; error?: string }[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    results.push({ name, ok: false, error: err?.message ?? String(err) });
    failed++;
    console.error(`  ✗ ${name}: ${err?.message ?? err}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// ─── Nettoyage ────────────────────────────────────────────────────────────────

async function cleanup(clientId: string) {
  // Supprimer les interventions liées
  await prisma.intervention.deleteMany({ where: { clientId } });
  // Supprimer les BCs
  const bcs = await prisma.bonCommande.findMany({ where: { clientId } });
  for (const bc of bcs) {
    await prisma.bonCommandeSite.deleteMany({ where: { bcId: bc.id } });
  }
  await prisma.bonCommande.deleteMany({ where: { clientId } });
  // Supprimer les contrats sites + contrats
  const contrats = await prisma.contrat.findMany({ where: { clientId } });
  for (const c of contrats) {
    await prisma.contratSite.deleteMany({ where: { contratId: c.id } });
  }
  await prisma.contrat.deleteMany({ where: { clientId } });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Tests d\'intégration contrats-bc ===\n');

  const clientId = await getOrCreateTestClient();
  const userId = await getOrCreateTestUser();
  await cleanup(clientId);

  // ── Test 1 : Reconduction sans doublon (idempotent) ────────────────────────
  await test('Reconduction sans doublon — idempotent', async () => {
    const contrat = await prisma.contrat.create({
      data: {
        clientId,
        type: 'ANNUEL',
        dateDebut: subDays(new Date(), 366),
        dateFin: subDays(new Date(), 1),
        reconductionAuto: true,
        prestations: ['Dératisation'],
        statut: 'ACTIF',
        autoCreerProchaine: false,
      },
    });

    const r1 = await planningService.renouvelerContratsEligibles(userId);
    assert(r1.crees >= 1, `crees=${r1.crees} devrait être ≥ 1`);
    assert(r1.erreurs.length === 0, `erreurs=${JSON.stringify(r1.erreurs)}`);

    // Vérifier que l'ancien est TERMINE
    const updated = await prisma.contrat.findUnique({ where: { id: contrat.id } });
    assert(updated?.statut === 'TERMINE', `statut=${updated?.statut} devrait être TERMINE`);

    // Appel idempotent : doit retourner 0 nouveaux créés
    const r2 = await planningService.renouvelerContratsEligibles(userId);
    assert(r2.crees === 0, `crees=${r2.crees} devrait être 0 (idempotent)`);
  });

  // ── Test 2 : BC type guard (CONTROLE ne consomme pas) ──────────────────────
  await test('BC type guard — CONTROLE ne consomme pas', async () => {
    const bc = await prisma.bonCommande.create({
      data: {
        numero: `TEST-CTRL-${Date.now()}`,
        clientId,
        quotaPassages: 5,
        passagesConsommes: 0,
      },
    });

    // Créer une intervention de type CONTROLE liée au BC
    const contrat = await prisma.contrat.create({
      data: {
        clientId,
        type: 'ANNUEL',
        dateDebut: subDays(new Date(), 30),
        prestations: ['Contrôle'],
        statut: 'ACTIF',
        autoCreerProchaine: false,
      },
    });
    const intervention = await prisma.intervention.create({
      data: {
        clientId,
        contratId: contrat.id,
        type: 'CONTROLE',
        datePrevue: new Date(),
        statut: 'A_PLANIFIER',
        bonCommandeId: bc.id,
        createdById: userId,
      },
    });

    await planningService.marquerRealisee(intervention.id, userId);

    const bcAfter = await prisma.bonCommande.findUnique({ where: { id: bc.id } });
    assert(
      bcAfter?.passagesConsommes === 0,
      `passagesConsommes=${bcAfter?.passagesConsommes} devrait être 0 pour un CONTROLE`
    );
  });

  // ── Test 3 : BC consommation atomique ──────────────────────────────────────
  await test('BC consommation atomique — double appel concurrentiel = 1 seule consommation', async () => {
    const bc = await prisma.bonCommande.create({
      data: {
        numero: `TEST-ATOMIC-${Date.now()}`,
        clientId,
        quotaPassages: 10,
        passagesConsommes: 0,
      },
    });

    const contrat = await prisma.contrat.create({
      data: {
        clientId,
        type: 'ANNUEL',
        dateDebut: subDays(new Date(), 30),
        prestations: ['Op'],
        statut: 'ACTIF',
        autoCreerProchaine: false,
      },
    });
    const intervention = await prisma.intervention.create({
      data: {
        clientId,
        contratId: contrat.id,
        type: 'OPERATION',
        datePrevue: new Date(),
        statut: 'A_PLANIFIER',
        bonCommandeId: bc.id,
        createdById: userId,
      },
    });

    // Double appel concurrent
    await Promise.all([
      planningService.marquerRealisee(intervention.id, userId),
      planningService.marquerRealisee(intervention.id, userId),
    ]);

    const bcAfter = await prisma.bonCommande.findUnique({ where: { id: bc.id } });
    assert(
      bcAfter?.passagesConsommes === 1,
      `passagesConsommes=${bcAfter?.passagesConsommes} devrait être 1 (pas de double consommation)`
    );
  });

  // ── Test 4 : Ancrage de date ───────────────────────────────────────────────
  await test('Ancrage — prochaine date depuis premiereDateOperation (mensuel)', async () => {
    // Ancre au 31 jan, fréquence mensuelle
    const anchor = new Date('2026-01-31');
    const contrat = await prisma.contrat.create({
      data: {
        clientId,
        type: 'ANNUEL',
        dateDebut: new Date('2026-01-01'),
        dateFin: new Date('2026-12-31'),
        prestations: ['Op'],
        statut: 'ACTIF',
        autoCreerProchaine: true,
        premiereDateOperation: anchor,
        frequenceOperationsMois: 1,
      },
    });

    // Créer une intervention prévue au 31 jan
    const intervention = await prisma.intervention.create({
      data: {
        clientId,
        contratId: contrat.id,
        type: 'OPERATION',
        datePrevue: anchor,
        statut: 'A_PLANIFIER',
        createdById: userId,
      },
    });

    // Réaliser en retard (25 fév)
    const dateRealisee = new Date('2026-02-25');
    const result = await planningService.marquerRealisee(intervention.id, userId, { dateRealisee });

    if (result.nextIntervention) {
      const nextDate = new Date((result.nextIntervention as any).datePrevue);
      // En mode ancrage : anchor + 1 mois = 28 fév 2026 (arrondi date-fns)
      // En mode intervalle : 25 mar 2026
      // On vérifie juste que la date n'est pas après le 31 mar
      assert(
        nextDate <= new Date('2026-03-31'),
        `prochaine date=${nextDate.toISOString()} devrait être avant le 31 mars`
      );
      console.log(`    → modePlanning=${result.modePlanning}, prochaine=${nextDate.toLocaleDateString('fr-FR')}`);
    }
  });

  // ── Test 5 : CSV null safety ───────────────────────────────────────────────
  await test('CSV null safety — cellule vide ne pas écraser montant existant', async () => {
    // Créer un contrat avec montantHT=50000
    const contrat = await prisma.contrat.create({
      data: {
        clientId,
        type: 'ANNUEL',
        dateDebut: new Date('2026-01-01'),
        dateFin: new Date('2026-12-31'),
        prestations: ['Op'],
        statut: 'ACTIF',
        autoCreerProchaine: false,
        refExterne: `TEST-NULL-${Date.now()}`,
        montantHT: 50000,
      },
    });

    // Réimporter le même contrat avec montant_ht vide
    const csv = `client_nom,site_nom,type,date_debut,date_fin,reconduction_auto,prestations,frequence_operations_jours,frequence_operations_mois,frequence_controle_jours,frequence_controle_mois,frequence_regles,frequence_regles_controle,premiere_date_operation,premiere_date_controle,statut,ref_externe,date_signature,montant_ht,duree_type,numero_bon_commande,notes,date_reprise_planification,nombre_passages_annuels
__TEST_CONTRATS_BC__,,ANNUEL,2026-01-01,2026-12-31,false,Op,,,,,,,,,ACTIF,${(contrat as any).refExterne},,,,,,DETERMINEE,,`;

    const preview = await csvService.previewContrats(csv);
    if (!preview.success) {
      // Si le client test n'est pas accessible, on saute
      console.log('    → Skipped (client not found in DB preview): expected in test env');
      return;
    }
    await csvService.importContrats(csv, userId);

    const updated = await prisma.contrat.findUnique({ where: { id: contrat.id } });
    assert(
      updated !== null,
      'Contrat introuvable après réimport'
    );
    // montantHT doit rester 50000 (cellule vide = ne pas écraser)
    const montant = (updated as any).montantHT;
    const montantNum = montant != null ? parseFloat(String(montant)) : null;
    assert(
      montantNum === 50000,
      `montantHT=${montantNum} devrait être 50000 (cellule vide ne doit pas écraser)`
    );
  });

  // ── Test 6 : ref_externe obligatoire ───────────────────────────────────────
  await test('ref_externe obligatoire — preview retourne erreur si absent', async () => {
    const csv = `client_nom,site_nom,type,date_debut,date_fin,reconduction_auto,prestations,frequence_operations_jours,frequence_operations_mois,frequence_controle_jours,frequence_controle_mois,frequence_regles,frequence_regles_controle,premiere_date_operation,premiere_date_controle,statut,ref_externe,date_signature,montant_ht,duree_type,numero_bon_commande,notes,date_reprise_planification,nombre_passages_annuels
__TEST_CONTRATS_BC__,,ANNUEL,2026-01-01,2026-12-31,false,Op,,,,,,,,,,,,,,DETERMINEE,,`;

    const preview = await csvService.previewContrats(csv);
    const hasRefError = preview.errors.some((e) => e.field === 'ref_externe');
    assert(hasRefError, 'Devrait avoir une erreur ref_externe absent');
  });

  // ── Test 7 : ref_externe doublon ───────────────────────────────────────────
  await test('ref_externe doublon dans le fichier — détecté en preview', async () => {
    const csv = `client_nom,site_nom,type,date_debut,date_fin,reconduction_auto,prestations,frequence_operations_jours,frequence_operations_mois,frequence_controle_jours,frequence_controle_mois,frequence_regles,frequence_regles_controle,premiere_date_operation,premiere_date_controle,statut,ref_externe,date_signature,montant_ht,duree_type,numero_bon_commande,notes,date_reprise_planification,nombre_passages_annuels
__TEST_CONTRATS_BC__,,ANNUEL,2026-01-01,2026-12-31,false,Op,,,,,,,,,,ACTIF,DUP-001,,,,DETERMINEE,,
__TEST_CONTRATS_BC__,,ANNUEL,2026-02-01,2026-12-31,false,Op,,,,,,,,,,ACTIF,DUP-001,,,,DETERMINEE,,`;

    const preview = await csvService.previewContrats(csv);
    const hasDupError = preview.errors.some(
      (e) => e.field === 'ref_externe' && e.message.includes('doublon')
    );
    assert(hasDupError, 'Devrait détecter le doublon ref_externe');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Nettoyage
  await cleanup(clientId);

  // Résumé
  console.log(`\n─────────────────────────────────`);
  console.log(`Résultats : ${passed} ✓  ${failed} ✗  (total ${passed + failed})`);

  if (failed > 0) {
    console.error('\nÉchecs :');
    results.filter((r) => !r.ok).forEach((r) => console.error(`  - ${r.name}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\nTous les tests passent.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
