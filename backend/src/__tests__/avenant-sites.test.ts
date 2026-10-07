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
});
