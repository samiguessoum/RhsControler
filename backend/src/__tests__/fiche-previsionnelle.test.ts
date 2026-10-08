import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/database.js', () => ({ prisma: {} }));

const {
  construireFichePrevisionnelle, resoudreOptions, libelleDate, pluriel, OBSERVATIONS_DEFAUT, TITRE_DEFAUT,
} = await import('../services/fiche-previsionnelle.service.js');

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const aujourdhui = d('2026-10-08');

const contrat = {
  id: 'abcdef12-0000',
  refExterne: 'CONV-7',
  nom: 'Dératisation 2026',
  type: 'ANNUEL',
  dateDebut: d('2026-01-01'),
  dateDebutConvention: d('2026-01-01'),
  dateFinConvention: d('2026-12-31'),
  prestations: ['Dératisation'],
  numeroBonCommande: null,
  client: { nomEntreprise: 'ACME', siegeAdresse: '1 rue A', siegeVille: 'Alger' },
  contratSites: [
    { siteId: 's1', site: { nom: 'Usine', ville: 'Alger' }, prestations: ['Dératisation', 'Désinsectisation'], prixPrestations: { 'Dératisation': 1000, 'Désinsectisation': 500 } },
    { siteId: 's2', site: { nom: 'Entrepôt' }, prestations: ['Dératisation'], prixPrestations: {} },
  ],
};

const iv = (o: Record<string, any>) => ({
  type: 'OPERATION', statut: 'A_PLANIFIER', siteId: 's1', prestation: 'Dératisation',
  remplaceeParOperation: false, avenantId: null, avenant: null, bonCommande: null, ...o,
});

const interventions = [
  iv({ datePrevue: d('2026-03-01'), statut: 'REALISEE', dateRealisee: d('2026-03-02') }),
  iv({ datePrevue: d('2026-11-02') }),
  iv({ datePrevue: d('2026-11-02'), prestation: 'Désinsectisation', bonCommande: { numero: 'BC-1' } }),
  iv({ datePrevue: d('2026-11-16'), type: 'CONTROLE', prestation: null }),
  iv({ datePrevue: d('2026-11-20'), type: 'CONTROLE', prestation: null, statut: 'ANNULEE' }),
  iv({ datePrevue: d('2026-11-21'), type: 'CONTROLE', prestation: null, remplaceeParOperation: true }),
  iv({ datePrevue: d('2026-12-01'), siteId: 's2' }),
  iv({ datePrevue: d('2026-12-05'), avenantId: 'av1', avenant: { numero: 1, nom: null } }),
];

const fiche = (opts: Record<string, any> = {}) =>
  construireFichePrevisionnelle(contrat, interventions, resoudreOptions(opts, null), aujourdhui);

describe('fiche prévisionnelle', () => {
  it('par défaut : passages à venir, opérations + contrôles, regroupés par site', () => {
    const f = fiche();
    expect(f.periode).toEqual({ debut: '2026-10-08', fin: '2026-12-31' });
    expect(f.groupes.map((g) => g.titre)).toEqual(['Entrepôt', 'Usine']);
    const usine = f.groupes[1];
    // les deux prestations du 02/11 forment un seul passage ; annulé et contrôle couvert exclus
    expect(usine.lignes.map((l) => [l.jour, l.type])).toEqual([
      ['2026-11-02', 'OPERATION'], ['2026-11-16', 'CONTROLE'], ['2026-12-05', 'OPERATION'],
    ]);
    expect(usine.lignes[0].prestations).toEqual(['Dératisation', 'Désinsectisation']);
    expect(usine.lignes[0].bonsCommande).toEqual(['BC-1']);
    expect(usine.lignes[2].avenant).toBe('Avenant n°1');
    expect(f.totaux).toMatchObject({ operations: 3, controles: 1 });
    expect(f.titre).toBe(TITRE_DEFAUT);
    expect(f.observations).toBe(OBSERVATIONS_DEFAUT);
    expect(f.ref).toBe('FP-CONV-7-20261008');
  });

  it('opérations seules, sans avenants, un seul site', () => {
    const f = fiche({ contenu: 'OPERATIONS', inclureAvenants: false, siteIds: ['s1'] });
    expect(f.groupes).toHaveLength(1);
    expect(f.groupes[0].lignes.map((l) => l.jour)).toEqual(['2026-11-02']);
    expect(f.avecControles).toBe(false);
    expect(f.sites.map((s) => s.nom)).toEqual(['Usine']);
  });

  it('convention entière avec passages réalisés (date de réalisation)', () => {
    const f = fiche({ periode: 'CONVENTION', afficherRealises: true, presentation: 'CHRONO' });
    expect(f.groupes[0].titre).toBe('Mars 2026');
    expect(f.groupes[0].lignes[0]).toMatchObject({ jour: '2026-03-02', realise: true });
    expect(f.colonnes.site).toBe(true);
    expect(f.colonnes.statut).toBe(true);
  });

  it('période personnalisée', () => {
    const f = fiche({ periode: 'PERSONNALISEE', dateDebut: '2026-11-10', dateFin: '2026-12-01' });
    expect(f.groupes.flatMap((g) => g.lignes.map((l) => l.jour)).sort()).toEqual(['2026-11-16', '2026-12-01']);
  });

  it('prix : somme des prestations du passage, contrôles non chiffrés', () => {
    const f = fiche({ afficherPrix: true });
    const usine = f.groupes.find((g) => g.titre === 'Usine')!;
    expect(usine.lignes[0].montantHT).toBe(1500);
    expect(usine.lignes[1].montantHT).toBeNull();
    expect(f.groupes.find((g) => g.titre === 'Entrepôt')!.lignes[0].montantHT).toBeNull();
    expect(f.totaux.montantHT).toBe(2500);
  });

  it('libellés personnalisés', () => {
    const f = fiche({ libelleOperation: 'Traitement', libelleControle: 'Passage de suivi', titre: 'Calendrier 2026' });
    expect(f.libelles).toEqual({ operation: 'Traitement', operations: 'Traitements', controle: 'Passage de suivi', controles: 'Passages de suivi' });
    expect(f.titre).toBe('Calendrier 2026');
  });

  it('réglages : ceux transmis priment sur ceux mémorisés', () => {
    expect(resoudreOptions({ precision: 'MOIS' }, { precision: 'SEMAINE', afficherBC: true })).toMatchObject({ precision: 'MOIS', afficherBC: true });
    expect(() => resoudreOptions({ periode: 'N_IMPORTE' }, null)).toThrow();
  });

  it('précision des dates', () => {
    expect(libelleDate('2026-10-08', 'JOUR')).toBe('jeu. 08/10/2026');
    expect(libelleDate('2026-10-08', 'SEMAINE')).toBe('Semaine du 05/10/2026');
    expect(libelleDate('2026-10-08', 'MOIS')).toBe('Octobre 2026');
    expect(pluriel('Visite de contrôle')).toBe('Visites de contrôle');
  });
});
