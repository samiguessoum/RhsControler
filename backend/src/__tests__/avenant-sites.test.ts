import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = {
  contrat: { findUnique: vi.fn() },
  intervention: { createManyAndReturn: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
};
vi.mock('../config/database.js', () => ({ prisma }));

const { planningService } = await import('../services/planning.service.js');

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const site = (siteId: string) => ({ siteId, site: { nom: siteId }, prestations: ['DERAT'], frequenceOperationsJours: 90, periodesFrequence: [] });

describe('interventions d\'avenant : sites concernés', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.contrat.findUnique.mockResolvedValue({
      id: 'ct', clientId: 'cl', prestations: ['DERAT'], dateFin: d('2026-12-31'), dateFinConvention: null,
      contratSites: [site('sA'), site('sB'), site('sC')],
    });
    prisma.intervention.createManyAndReturn.mockImplementation(async ({ data }: any) => data);
  });

  const generer = (siteIds?: string[]) =>
    planningService.genererInterventionsAvenant('ct', 'av', 'u', 1, 0, { datesOperations: [d('2026-11-12')], siteIds });

  it('sans sélection : tous les sites du contrat', async () => {
    const r = await generer();
    expect(r.interventionsCreees.map((i: any) => i.siteId)).toEqual(['sA', 'sB', 'sC']);
  });

  it('avec sélection : seuls les sites cochés', async () => {
    const r = await generer(['sA', 'sC']);
    expect(r.interventionsCreees.map((i: any) => i.siteId)).toEqual(['sA', 'sC']);
    expect(r.interventionsCreees.every((i: any) => i.avenantId === 'av')).toBe(true);
  });

  it('BC de l\'avenant posé sur ses opérations, pas sur ses contrôles', async () => {
    const r = await planningService.genererInterventionsAvenant('ct', 'av', 'u', 1, 0, {
      datesOperations: [d('2026-11-12')], datesControles: [d('2026-12-12')], siteIds: ['sA'], bonCommandeId: 'bcAv',
    });
    expect(r.interventionsCreees.map((i: any) => [i.type, i.bonCommandeId ?? null])).toEqual([['OPERATION', 'bcAv'], ['CONTROLE', null]]);
  });
});

describe('interventions d\'avenant : VC entre opérations selon la saison', () => {
  it('90 j / 2 VC à l\'année, 30 j / 1 VC de juin à août', async () => {
    vi.clearAllMocks();
    prisma.contrat.findUnique.mockResolvedValue({
      id: 'ct', clientId: 'cl', prestations: ['DERAT'], dateFin: d('2027-03-31'), dateFinConvention: null,
      contratSites: [site('sA')],
    });
    prisma.intervention.createManyAndReturn.mockImplementation(async ({ data }: any) => data);
    prisma.intervention.findFirst.mockResolvedValue({ datePrevue: d('2026-03-02') });
    prisma.intervention.findMany.mockResolvedValue([{ datePrevue: d('2026-03-02') }]);

    const r = await planningService.genererInterventionsAvenant('ct', 'av', 'u', 6, 2, {
      frequence: { jours: 90, mois: null },
      periodes: [{ debut: '06-01', fin: '08-31', frequenceJours: 30, frequenceMois: null, nombreVisitesControleEntreOps: 1 }],
      fin: d('2027-03-31'),
    });
    const ops = r.interventionsCreees.filter((i: any) => i.type === 'OPERATION').map((i: any) => i.datePrevue as Date);
    const ctrl = r.interventionsCreees.filter((i: any) => i.type === 'CONTROLE').map((i: any) => i.datePrevue as Date);
    const toutes = [d('2026-03-02'), ...ops];
    // Nombre de VC dans chaque intervalle entre deux opérations
    const parIntervalle = toutes.slice(1).map((fin, i) => ctrl.filter((c) => c > toutes[i] && c < fin).length);
    const ecarts = toutes.slice(1).map((fin, i) => Math.round((fin.getTime() - toutes[i].getTime()) / 864e5));
    // 2 mars → 31 mai (90 j, hors saison) : 2 VC ; saison à 30 j : 1 VC (y compris l'intervalle
    // qui entre en saison et celui qui en sort) ; retour à 90 j : 2 VC
    expect(ecarts.map((e, i) => [e > 60 ? 'long' : 'court', parIntervalle[i]])).toEqual([
      ['long', 2], ['court', 1], ['court', 1], ['court', 1], ['court', 1], ['long', 2],
    ]);
    // Visites en queue jusqu'à la fin de l'avenant, à 90 j : 2 VC
    expect(ctrl.filter((c) => c > ops[ops.length - 1])).toHaveLength(2);
  });
});
