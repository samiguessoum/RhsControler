import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import { prochaineDateTheorique, type PeriodeFrequence } from '../utils/date.utils.js';

const jour = (s: string) => new Date(`${s}T00:00:00`);
const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

// 90 jours toute l'année, 30 jours du 1er mai au 30 septembre
const ete: PeriodeFrequence[] = [{ debut: '05-01', fin: '09-30', frequenceJours: 30, frequenceMois: null }];

describe('prochaineDateTheorique — périodes saisonnières', () => {
  it('hors période, loin de la saison : fréquence normale', () => {
    expect(fmt(prochaineDateTheorique(jour('2026-01-10'), 90, null, ete))).toBe('2026-04-10');
  });

  it('entrée en saison : avancée à la fréquence de la période', () => {
    // 20 avril + 90 j = 19 juillet, mais la saison commence le 1er mai → 20 avril + 30 j
    expect(fmt(prochaineDateTheorique(jour('2026-04-20'), 90, null, ete))).toBe('2026-05-20');
  });

  it("entrée en saison : jamais avant le début de la période", () => {
    // 10 février + 30 j = 12 mars < 1er mai → le 1er mai
    expect(fmt(prochaineDateTheorique(jour('2026-02-10'), 90, null, ete))).toBe('2026-05-01');
  });

  it('en saison : fréquence de la période', () => {
    expect(fmt(prochaineDateTheorique(jour('2026-06-15'), 90, null, ete))).toBe('2026-07-15');
  });

  it('sortie de saison : fréquence de la date du passage', () => {
    expect(fmt(prochaineDateTheorique(jour('2026-09-25'), 90, null, ete))).toBe('2026-10-25');
  });

  it('période à cheval sur deux années et fréquence en mois', () => {
    const hiver: PeriodeFrequence[] = [{ debut: '12-01', fin: '02-28', frequenceJours: null, frequenceMois: 1 }];
    expect(fmt(prochaineDateTheorique(jour('2026-11-10'), null, 3, hiver))).toBe('2026-12-10');
  });

  it('une période moins fréquente ne retarde pas le passage', () => {
    const lente: PeriodeFrequence[] = [{ debut: '05-01', fin: '09-30', frequenceJours: 120, frequenceMois: null }];
    expect(fmt(prochaineDateTheorique(jour('2026-04-20'), 30, null, lente))).toBe('2026-05-20');
  });

  it('sans période : comportement inchangé', () => {
    expect(fmt(prochaineDateTheorique(jour('2026-04-20'), 90, null, []))).toBe('2026-07-19');
    expect(fmt(prochaineDateTheorique(jour('2026-01-31'), null, 1, []))).toBe('2026-02-28');
  });
});
