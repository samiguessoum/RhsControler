import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = {
  contrat: { findUnique: vi.fn() },
  avenant: { findUnique: vi.fn() },
  intervention: { findFirst: vi.fn() },
  bonCommande: { findMany: vi.fn() },
};
vi.mock('../config/database.js', () => ({ prisma }));

const { construireEnTeteFacture, mentionLibre } = await import('../utils/bc.utils.js');

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const contrat = {
  refExterne: 'CONV-12',
  dateDebutConvention: d('2025-01-01'),
  numeroBonCommande: null,
  bonsCommandes: [
    { id: 'conv', numero: 'BC-CONV', date: d('2025-02-01'), sites: [] },
    { id: 'site', numero: 'BC-SITE', date: d('2025-03-15'), sites: [{ siteId: 's1' }] },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  prisma.contrat.findUnique.mockResolvedValue(contrat);
  prisma.intervention.findFirst.mockResolvedValue(null);
  prisma.bonCommande.findMany.mockResolvedValue([]);
});

describe('en-tête de facture', () => {
  it('convention, BC du site, mention libre', async () => {
    const r = await construireEnTeteFacture({ clientId: 'c', contratId: 'ct', siteId: 's1', mentionSpeciale: 'Passage de nuit' });
    expect(r).toEqual({
      convention: 'La convention CONV-12 du 01/01/2025',
      bonCommande: 'Selon le bon de commande N° BC-SITE du 15/03/2025',
      mention: 'Passage de nuit',
    });
  });

  it('BC du contrat quand le site n’a pas de BC ; pas de convention sans réf ni date', async () => {
    prisma.contrat.findUnique.mockResolvedValue({ ...contrat, refExterne: null, dateDebutConvention: null });
    const r = await construireEnTeteFacture({ clientId: 'c', contratId: 'ct', siteId: 's2' });
    expect(r.convention).toBeNull();
    expect(r.bonCommande).toBe('Selon le bon de commande N° BC-CONV du 01/02/2025');
  });

  it('le BC consommé par l’opération facturée prime', async () => {
    prisma.intervention.findFirst.mockResolvedValue({ bonCommande: { numero: 'BC-OP', date: d('2026-01-10') } });
    const r = await construireEnTeteFacture({ clientId: 'c', contratId: 'ct', siteId: 's1', dateOperation: d('2026-10-06') });
    expect(r.bonCommande).toBe('Selon le bon de commande N° BC-OP du 10/01/2026');
  });

  it('avenant : son propre BC', async () => {
    prisma.avenant.findUnique.mockResolvedValue({ numeroBonCommande: 'AV-7', dateSignature: d('2026-05-05') });
    const r = await construireEnTeteFacture({ clientId: 'c', contratId: 'ct', siteId: 's1', avenantId: 'av' });
    expect(r.bonCommande).toBe('Selon le bon de commande N° AV-7 du 05/05/2026');
  });

  it('les anciennes mentions pré-remplies ne sont pas répétées', () => {
    expect(mentionLibre('Contrat « JDIIDID » — Convention signée le 01/01/2025 — BC N° 12 du 01/02/2025')).toBeNull();
    expect(mentionLibre('Contrat « X » — Avenant n°2 « Extension » — Livraison urgente')).toBe('Avenant n°2 « Extension » — Livraison urgente');
    expect(mentionLibre('  ')).toBeNull();
  });
});
