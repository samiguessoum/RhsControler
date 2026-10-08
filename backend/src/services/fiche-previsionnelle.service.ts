import { z } from 'zod';
import { format, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { prisma } from '../config/database.js';
import { AppError } from '../lib/errors.js';

// ─── Réglages de la fiche (mémorisés sur le contrat) ──────────────────────────

export const fichePrevisionnelleOptionsSchema = z.object({
  contenu: z.enum(['OPERATIONS', 'OPERATIONS_CONTROLES']).default('OPERATIONS_CONTROLES'),
  periode: z.enum(['A_VENIR', 'CONVENTION', 'PERSONNALISEE']).default('A_VENIR'),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  precision: z.enum(['JOUR', 'SEMAINE', 'MOIS']).default('JOUR'),
  siteIds: z.array(z.string()).default([]), // vide = tous les sites
  presentation: z.enum(['SITE', 'CHRONO']).default('SITE'),
  afficherPrestations: z.boolean().default(true),
  afficherBC: z.boolean().default(false),
  inclureAvenants: z.boolean().default(true),
  afficherRealises: z.boolean().default(false),
  afficherPrix: z.boolean().default(false),
  bonPourAccord: z.boolean().default(false),
  titre: z.string().max(120).default(''),
  libelleOperation: z.string().max(60).default(''),
  libelleControle: z.string().max(60).default(''),
  observations: z.string().max(2000).nullish(),
});

export type FichePrevisionnelleOptions = z.infer<typeof fichePrevisionnelleOptionsSchema>;

export const TITRE_DEFAUT = 'Planning prévisionnel des interventions';
export const OBSERVATIONS_DEFAUT =
  'Les dates indiquées sont communiquées à titre prévisionnel et peuvent être ajustées en fonction des contraintes '
  + 'd\'exploitation et des conditions d\'intervention. Le client sera informé avant chaque passage.';

/** Réglages complets : ceux transmis, à défaut ceux mémorisés sur le contrat, à défaut les valeurs par défaut. */
export function resoudreOptions(transmis: unknown, memorises: unknown): FichePrevisionnelleOptions {
  const base = memorises && typeof memorises === 'object' ? memorises : {};
  const surcharge = transmis && typeof transmis === 'object' ? transmis : {};
  return fichePrevisionnelleOptionsSchema.parse({ ...base, ...surcharge });
}

// ─── Données de la fiche ──────────────────────────────────────────────────────

type TypePassage = 'OPERATION' | 'CONTROLE';

export interface LigneFiche {
  jour: string; // AAAA-MM-JJ
  dateLibelle: string;
  type: TypePassage;
  typeLibelle: string;
  siteId: string | null;
  siteNom: string;
  prestations: string[];
  bonsCommande: string[];
  avenant: string | null;
  realise: boolean;
  montantHT: number | null;
}

export interface GroupeFiche {
  titre: string;
  sousTitre?: string;
  lignes: LigneFiche[];
  nbOperations: number;
  nbControles: number;
  montantHT: number;
}

export interface FichePrevisionnelleData {
  ref: string;
  dateEmission: Date;
  titre: string;
  client: {
    nomEntreprise: string;
    adresse: string;
    contact?: string | null;
  };
  contrat: {
    ref: string | null;
    nom: string | null;
    type: string;
    conventionDebut: Date | null;
    conventionFin: Date | null;
    prestations: string[];
    bonsCommande: string[];
  };
  periode: { debut: string | null; fin: string | null };
  sites: Array<{ nom: string; adresse: string }>;
  avecControles: boolean;
  libelles: { operation: string; operations: string; controle: string; controles: string };
  colonnes: { date: boolean; site: boolean; prestations: boolean; bc: boolean; statut: boolean; prix: boolean };
  groupes: GroupeFiche[];
  totaux: { operations: number; controles: number; montantHT: number };
  observations: string;
  bonPourAccord: boolean;
}

const jourISO = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
// Midi UTC : le jour reste le même quel que soit le fuseau du serveur
const dateDuJour = (jour: string) => new Date(`${jour}T12:00:00Z`);
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Pluriel simple d'un libellé ("Visite de contrôle" → "Visites de contrôle", "Traitement" → "Traitements"). */
export function pluriel(libelle: string): string {
  const [premier, ...reste] = libelle.split(' ');
  const p = /[sxz]$/i.test(premier) ? premier : `${premier}s`;
  return [p, ...reste].join(' ');
}

export function libelleDate(jour: string, precision: FichePrevisionnelleOptions['precision']): string {
  const d = dateDuJour(jour);
  if (precision === 'MOIS') return majuscule(format(d, 'MMMM yyyy', { locale: fr }));
  if (precision === 'SEMAINE') return `Semaine du ${format(startOfWeek(d, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`;
  return format(d, 'EEE dd/MM/yyyy', { locale: fr });
}

/** Bornes de la période couverte (jours AAAA-MM-JJ, null = non bornée). */
export function bornesPeriode(contrat: any, options: FichePrevisionnelleOptions, aujourdhui: Date) {
  const debutConvention = jourISO(contrat.dateDebutConvention) ?? jourISO(contrat.dateDebut);
  const finConvention = jourISO(contrat.dateFinConvention) ?? jourISO(contrat.dateFin);
  if (options.periode === 'PERSONNALISEE') {
    return { debut: options.dateDebut ?? null, fin: options.dateFin ?? null };
  }
  if (options.periode === 'CONVENTION') return { debut: debutConvention, fin: finConvention };
  return { debut: jourISO(aujourdhui), fin: finConvention };
}

const adresseSite = (site: any) =>
  [site?.adresse, [site?.codePostal, site?.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');

/**
 * Construit la fiche à partir du contrat et de ses interventions (logique pure).
 * Une ligne = un passage (même jour, même site, même nature, même avenant) : les interventions
 * créées par prestation sont regroupées. Exclus : réclamations, visites commerciales, passages
 * annulés et visites couvertes par une opération.
 */
export function construireFichePrevisionnelle(
  contrat: any,
  interventions: any[],
  options: FichePrevisionnelleOptions,
  aujourdhui: Date = new Date(),
): FichePrevisionnelleData {
  const periode = bornesPeriode(contrat, options, aujourdhui);
  const libelleOp = options.libelleOperation.trim() || 'Opération';
  const libelleCtrl = options.libelleControle.trim() || 'Visite de contrôle';
  const types: TypePassage[] = options.contenu === 'OPERATIONS' ? ['OPERATION'] : ['OPERATION', 'CONTROLE'];
  const contratSites: any[] = contrat.contratSites || [];
  const csParSite = new Map(contratSites.map((cs) => [cs.siteId, cs]));
  const sitesRetenus = (siteId: string | null) => !options.siteIds.length || (siteId != null && options.siteIds.includes(siteId));

  // ── Sélection
  const retenues = interventions.filter((iv) => {
    if (!types.includes(iv.type)) return false;
    if (iv.statut === 'ANNULEE' || iv.remplaceeParOperation) return false;
    if (iv.statut === 'REALISEE' && !options.afficherRealises) return false;
    if (iv.avenantId && !options.inclureAvenants) return false;
    if (!sitesRetenus(iv.siteId ?? null)) return false;
    const jour = jourISO(iv.statut === 'REALISEE' ? iv.dateRealisee ?? iv.datePrevue : iv.datePrevue)!;
    if (periode.debut && jour < periode.debut) return false;
    if (periode.fin && jour > periode.fin) return false;
    return true;
  });

  // ── Regroupement en passages
  const passages = new Map<string, LigneFiche>();
  for (const iv of retenues) {
    const jour = jourISO(iv.statut === 'REALISEE' ? iv.dateRealisee ?? iv.datePrevue : iv.datePrevue)!;
    const siteId: string | null = iv.siteId ?? null;
    const cle = [jour, siteId, iv.type, iv.avenantId ?? ''].join('|');
    let ligne = passages.get(cle);
    if (!ligne) {
      const avenant = iv.avenant ? (iv.avenant.nom || `Avenant n°${iv.avenant.numero}`) : null;
      ligne = {
        jour,
        dateLibelle: libelleDate(jour, options.precision),
        type: iv.type,
        typeLibelle: iv.type === 'OPERATION' ? libelleOp : libelleCtrl,
        siteId,
        siteNom: iv.site?.nom || csParSite.get(siteId)?.site?.nom || 'Site principal',
        prestations: [],
        bonsCommande: [],
        avenant,
        realise: iv.statut === 'REALISEE',
        montantHT: null,
      };
      passages.set(cle, ligne);
    }
    if (iv.prestation && !ligne.prestations.includes(iv.prestation)) ligne.prestations.push(iv.prestation);
    const bc = iv.bonCommande?.numero;
    if (bc && !ligne.bonsCommande.includes(bc)) ligne.bonsCommande.push(bc);
    if (iv.statut !== 'REALISEE') ligne.realise = false;
    // Prix : opérations au tarif de la prestation sur le site ; visites de contrôle incluses
    if (iv.type === 'OPERATION' && iv.prestation) {
      const prix = Number((csParSite.get(siteId)?.prixPrestations as any)?.[iv.prestation]);
      if (Number.isFinite(prix) && prix > 0) ligne.montantHT = (ligne.montantHT ?? 0) + prix;
    }
  }

  const lignes = [...passages.values()].sort((a, b) =>
    a.jour.localeCompare(b.jour) || a.siteNom.localeCompare(b.siteNom) || a.type.localeCompare(b.type));

  // ── Groupes : par site ou par mois
  const groupesMap = new Map<string, GroupeFiche>();
  for (const l of lignes) {
    const cle = options.presentation === 'SITE' ? (l.siteId ?? '') : l.jour.slice(0, 7);
    let g = groupesMap.get(cle);
    if (!g) {
      const site = csParSite.get(l.siteId)?.site;
      g = options.presentation === 'SITE'
        ? { titre: l.siteNom, sousTitre: adresseSite(site) || undefined, lignes: [], nbOperations: 0, nbControles: 0, montantHT: 0 }
        : { titre: majuscule(format(dateDuJour(l.jour), 'MMMM yyyy', { locale: fr })), lignes: [], nbOperations: 0, nbControles: 0, montantHT: 0 };
      groupesMap.set(cle, g);
    }
    g.lignes.push(l);
    if (l.type === 'OPERATION') g.nbOperations++; else g.nbControles++;
    g.montantHT += l.montantHT ?? 0;
  }
  const groupes = [...groupesMap.values()];
  if (options.presentation === 'SITE') groupes.sort((a, b) => a.titre.localeCompare(b.titre));

  // ── Sites et BC concernés
  const sitesSelection = contratSites.filter((cs) => sitesRetenus(cs.siteId));
  const bonsCommande = [
    ...new Set([
      ...(contrat.numeroBonCommande ? [contrat.numeroBonCommande] : []),
      ...lignes.flatMap((l) => l.bonsCommande),
    ]),
  ];
  const prestations = [...new Set([
    ...(sitesSelection.length ? sitesSelection.flatMap((cs) => cs.prestations?.length ? cs.prestations : contrat.prestations || []) : contrat.prestations || []),
  ])];

  const client = contrat.client || {};
  const refContrat = contrat.refExterne || null;

  return {
    ref: `FP-${refContrat || String(contrat.id).slice(0, 8).toUpperCase()}-${format(aujourdhui, 'yyyyMMdd')}`,
    dateEmission: aujourdhui,
    titre: options.titre.trim() || TITRE_DEFAUT,
    client: {
      nomEntreprise: client.nomEntreprise || '-',
      adresse: [client.siegeAdresse, [client.siegeCodePostal, client.siegeVille].filter(Boolean).join(' '), client.siegePays].filter(Boolean).join(', '),
      contact: [client.siegeTel, client.siegeEmail].filter(Boolean).join(' · ') || null,
    },
    contrat: {
      ref: refContrat,
      nom: contrat.nom || null,
      type: contrat.type === 'PONCTUEL' ? 'Ponctuel' : 'Annuel',
      conventionDebut: contrat.dateDebutConvention ?? contrat.dateDebut ?? null,
      conventionFin: contrat.dateFinConvention ?? contrat.dateFin ?? null,
      prestations,
      bonsCommande,
    },
    periode,
    sites: sitesSelection.map((cs) => ({ nom: cs.site?.nom || '-', adresse: adresseSite(cs.site) })),
    avecControles: types.includes('CONTROLE'),
    libelles: { operation: libelleOp, operations: pluriel(libelleOp), controle: libelleCtrl, controles: pluriel(libelleCtrl) },
    colonnes: {
      // Groupé par mois avec des dates au mois : la colonne répéterait le titre du groupe
      date: !(options.presentation === 'CHRONO' && options.precision === 'MOIS'),
      site: options.presentation === 'CHRONO' && new Set(lignes.map((l) => l.siteId)).size > 1,
      prestations: options.afficherPrestations,
      bc: options.afficherBC,
      statut: options.afficherRealises,
      prix: options.afficherPrix,
    },
    groupes,
    totaux: {
      operations: lignes.filter((l) => l.type === 'OPERATION').length,
      controles: lignes.filter((l) => l.type === 'CONTROLE').length,
      montantHT: lignes.reduce((s, l) => s + (l.montantHT ?? 0), 0),
    },
    observations: options.observations ?? OBSERVATIONS_DEFAUT,
    bonPourAccord: options.bonPourAccord,
  };
}

/** Charge le contrat et ses interventions, puis construit la fiche. */
export async function chargerFichePrevisionnelle(contratId: string, options: FichePrevisionnelleOptions) {
  const contrat = await prisma.contrat.findUnique({
    where: { id: contratId },
    include: {
      client: true,
      contratSites: { include: { site: true } },
    },
  });
  if (!contrat) throw new AppError(404, 'Contrat non trouvé');

  const interventions = await prisma.intervention.findMany({
    where: { contratId, type: { in: ['OPERATION', 'CONTROLE'] } },
    orderBy: { datePrevue: 'asc' },
    include: {
      site: { select: { id: true, nom: true } },
      bonCommande: { select: { numero: true } },
      avenant: { select: { numero: true, nom: true } },
    },
  });

  return construireFichePrevisionnelle(contrat, interventions, options);
}
