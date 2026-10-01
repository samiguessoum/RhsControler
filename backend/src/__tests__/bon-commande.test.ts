import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/database.js', () => ({ prisma: {} }));

const { choisirBC, bcsCandidats, simulerContrat, bcValideA } = await import('../services/bon-commande.service.js');

const d = (s: string) => new Date(`${s}T00:00:00Z`);
let seq = 0;
const bc = (o: Partial<{ id: string; date: Date | null; dateFinValidite: Date | null; quotaPassages: number | null; passagesConsommes: number; sites: string[]; seuilAlerte: number }> = {}) => ({
  id: o.id ?? `bc${++seq}`,
  date: o.date ?? null,
  dateFinValidite: o.dateFinValidite ?? null,
  createdAt: d('2026-01-01'),
  quotaPassages: o.quotaPassages === undefined ? 10 : o.quotaPassages,
  passagesConsommes: o.passagesConsommes ?? 0,
  sites: (o.sites ?? []).map((siteId) => ({ siteId })),
  seuilAlerte: o.seuilAlerte ?? 2,
});
const op = (siteId: string | null, date: string, bonCommandeId: string | null = null) => ({ siteId, datePrevue: d(date), bonCommandeId });

describe('choix du BC à la réalisation', () => {
  it('priorité au BC du site, puis au BC convention', () => {
    const conv = bc({ id: 'conv' });
    const siteA = bc({ id: 'A', sites: ['sA'] });
    expect(choisirBC([conv, siteA], 'sA', d('2026-03-01'))?.id).toBe('A');
    expect(choisirBC([conv, siteA], 'sB', d('2026-03-01'))?.id).toBe('conv');
    expect(choisirBC([siteA], 'sB', d('2026-03-01'))).toBeNull();
    expect(choisirBC([siteA], null, d('2026-03-01'))).toBeNull();
  });

  it('FIFO par date de signature, passe au suivant quand épuisé', () => {
    const ancien = bc({ id: 'ancien', sites: ['s'], date: d('2026-01-01'), quotaPassages: 2, passagesConsommes: 2 });
    const recent = bc({ id: 'recent', sites: ['s'], date: d('2026-06-01'), quotaPassages: 5 });
    expect(choisirBC([recent, ancien], 's', d('2026-07-01'))?.id).toBe('recent');
    expect(bcsCandidats([recent, ancien], 's', d('2026-07-01')).map((b) => b.id)).toEqual(['ancien', 'recent']);
  });

  it('tous épuisés : le dernier candidat est consommé (dépassement visible)', () => {
    const a = bc({ id: 'a', sites: ['s'], quotaPassages: 1, passagesConsommes: 1 });
    const conv = bc({ id: 'conv', quotaPassages: 1, passagesConsommes: 1 });
    expect(choisirBC([a, conv], 's', d('2026-03-01'))?.id).toBe('conv');
  });

  it('BC sans quota : jamais épuisé', () => {
    const libre = bc({ id: 'libre', quotaPassages: null, passagesConsommes: 50 });
    expect(choisirBC([libre], 's', d('2026-03-01'))?.id).toBe('libre');
  });

  it('BC expiré ignoré (fin de validité incluse)', () => {
    const exp = bc({ id: 'exp', dateFinValidite: d('2026-03-01') });
    expect(bcValideA(exp, d('2026-03-01'))).toBe(true);
    expect(choisirBC([exp], 's', d('2026-03-01'))?.id).toBe('exp');
    expect(choisirBC([exp], 's', d('2026-03-02'))).toBeNull();
  });
});

describe('prévisions', () => {
  const auj = d('2026-10-01');

  it('aucune alerte si le BC couvre toutes les opérations planifiées', () => {
    const b = bc({ id: 'b', quotaPassages: 10, passagesConsommes: 2 });
    const p = simulerContrat([b], [op('s', '2026-11-01'), op('s', '2026-12-01')], auj).get('b')!;
    expect(p.operationsPlanifiees).toBe(2);
    expect(p.operationsNonCouvertes).toBe(0);
    expect(p.niveauAlerte).toBeNull();
  });

  it('alerte INSUFFISANT avec date d’épuisement et première opération non couverte', () => {
    const b = bc({ id: 'b', quotaPassages: 5, passagesConsommes: 2 }); // 3 restants
    const ops = ['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01'].map((x) => op('s', x));
    const p = simulerContrat([b], ops, auj).get('b')!;
    expect(p.operationsPlanifiees).toBe(3);
    expect(p.operationsNonCouvertes).toBe(2);
    expect(p.dateEpuisementPrevue).toEqual(d('2027-01-01'));
    expect(p.datePremiereNonCouverte).toEqual(d('2027-02-01'));
    expect(p.niveauAlerte).toBe('INSUFFISANT');
  });

  it('le seuil bas reste prioritaire sur la prévision', () => {
    const b = bc({ id: 'b', quotaPassages: 5, passagesConsommes: 3, seuilAlerte: 2 });
    const p = simulerContrat([b], [op('s', '2026-11-01'), op('s', '2026-12-01'), op('s', '2027-01-01')], auj).get('b')!;
    expect(p.niveauAlerte).toBe('ALERTE');
    expect(p.motifs).toHaveLength(2);
  });

  it('le BC suivant prend le relais : pas d’alerte de couverture', () => {
    const a = bc({ id: 'a', sites: ['s'], date: d('2026-01-01'), quotaPassages: 3, passagesConsommes: 2, seuilAlerte: 0 });
    const b = bc({ id: 'b', sites: ['s'], date: d('2026-06-01'), quotaPassages: 10, seuilAlerte: 0 });
    const sim = simulerContrat([a, b], [op('s', '2026-11-01'), op('s', '2026-12-01')], auj);
    expect(sim.get('a')!.operationsPlanifiees).toBe(1);
    expect(sim.get('b')!.operationsPlanifiees).toBe(1);
    expect(sim.get('a')!.niveauAlerte).toBe('DERNIER');
    expect(sim.get('b')!.niveauAlerte).toBeNull();
  });

  it('BC choisi manuellement sur l’intervention : imputé à ce BC', () => {
    const a = bc({ id: 'a', sites: ['s'], seuilAlerte: 0 });
    const conv = bc({ id: 'conv', seuilAlerte: 0 });
    const sim = simulerContrat([a, conv], [op('s', '2026-11-01', 'conv')], auj);
    expect(sim.get('conv')!.operationsPlanifiees).toBe(1);
    expect(sim.get('a')!.operationsPlanifiees).toBe(0);
  });

  it('site non couvert par un BC : rien à signaler', () => {
    const a = bc({ id: 'a', sites: ['s1'], seuilAlerte: 0 });
    const p = simulerContrat([a], [op('s2', '2026-11-01')], auj).get('a')!;
    expect(p.operationsNonCouvertes).toBe(0);
    expect(p.niveauAlerte).toBeNull();
  });

  it('opérations après la fin de validité : non couvertes', () => {
    const a = bc({ id: 'a', dateFinValidite: d('2026-12-31'), seuilAlerte: 0 });
    const p = simulerContrat([a], [op('s', '2026-11-01'), op('s', '2027-01-15')], auj).get('a')!;
    expect(p.operationsPlanifiees).toBe(1);
    expect(p.operationsNonCouvertes).toBe(1);
    expect(p.niveauAlerte).toBe('INSUFFISANT');
  });

  it('fin de validité proche / dépassée', () => {
    const proche = bc({ id: 'p', dateFinValidite: d('2026-10-20'), seuilAlerte: 0 });
    const exp = bc({ id: 'e', dateFinValidite: d('2026-09-30'), seuilAlerte: 0 });
    const loin = bc({ id: 'l', dateFinValidite: d('2027-06-30'), seuilAlerte: 0 });
    const sim = simulerContrat([proche, exp, loin], [], auj);
    expect(sim.get('p')!.niveauAlerte).toBe('EXPIRATION_PROCHE');
    expect(sim.get('p')!.joursAvantFinValidite).toBe(19);
    expect(sim.get('e')!.niveauAlerte).toBe('EXPIRE');
    expect(sim.get('l')!.niveauAlerte).toBeNull();
  });

  it('épuisé / dépassé', () => {
    const ep = bc({ id: 'ep', quotaPassages: 4, passagesConsommes: 4 });
    const dep = bc({ id: 'dep', quotaPassages: 4, passagesConsommes: 6 });
    const sim = simulerContrat([ep, dep], [], auj);
    expect(sim.get('ep')!.niveauAlerte).toBe('EPUISE');
    expect(sim.get('dep')!.niveauAlerte).toBe('DEPASSE');
    expect(sim.get('dep')!.passagesRestants).toBe(-2);
  });

  it('ne modifie pas les BC fournis', () => {
    const b = bc({ id: 'b', quotaPassages: 2 });
    const copie = JSON.stringify(b);
    simulerContrat([b], [op('s', '2026-11-01'), op('s', '2026-12-01'), op('s', '2027-01-01')], auj);
    expect(JSON.stringify(b)).toBe(copie);
  });
});
