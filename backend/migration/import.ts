/**
 * Script de migration RHS Controller
 * Usage:
 *   npm run migrate:import -- --dry-run   ← valide sans rien insérer
 *   npm run migrate:import -- --execute  ← insère en base (transaction unique)
 */

import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient, Prisma } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--execute');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// ── Couleurs console ───────────────────────────────────────────────────────
const c = {
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
};

// ── Types CSV ──────────────────────────────────────────────────────────────
interface ClientRow {
  ref: string; nomEntreprise: string; formeJuridique?: string;
  siegeRC?: string; siegeNIF?: string; siegeAI?: string; siegeNIS?: string;
  siegeAdresse?: string; siegeCodePostal?: string; siegeVille?: string;
  siegePays?: string; siegeTel?: string; siegeFax?: string;
  siegeEmail?: string; siegeWebsite?: string; secteur?: string; notes?: string;
}
interface SiteRow {
  ref: string; client_ref: string; nom: string;
  adresse?: string; codePostal?: string; ville?: string;
  tel?: string; email?: string; notes?: string;
}
interface ContactRow {
  client_ref: string; site_ref?: string; civilite?: string;
  nom: string; prenom?: string; fonction?: string;
  tel?: string; telMobile?: string; email?: string;
  estPrincipal?: string; notes?: string;
}
interface ContratRow {
  client_ref: string; site_ref?: string; type: string;
  dateDebut: string; dateFin?: string; reconductionAuto?: string;
  statut?: string; numeroBonCommande?: string; prestations?: string;
  montantHT?: string; frequenceOperationsJours?: string;
  premiereDateOperation?: string;
  frequenceControleJours?: string; premiereDateControle?: string; notes?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function readCsv<T>(filename: string): T[] {
  const file = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(file)) throw new Error(`Fichier manquant : ${file}`);
  const content = fs.readFileSync(file, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    comment: '#',
  }) as T[];
}

function str(v?: string): string | undefined {
  return v && v.trim() !== '' ? v.trim() : undefined;
}
function bool(v?: string, def = false): boolean {
  if (!v) return def;
  return ['true', '1', 'oui', 'yes'].includes(v.toLowerCase().trim());
}
function num(v?: string): number | undefined {
  if (!v || v.trim() === '') return undefined;
  const n = parseFloat(v.trim());
  return isNaN(n) ? undefined : n;
}
function date(v?: string): Date | undefined {
  if (!v || v.trim() === '') return undefined;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? undefined : d;
}

const FORMES_JURIDIQUES = ['SARL', 'EURL', 'SPA', 'SNC', 'AUTO_ENTREPRENEUR', 'ASSOCIATION', 'PARTICULIER', 'AUTRE'];
const CIVILITES = ['M', 'MME', 'MLLE'];
const CONTRAT_TYPES = ['ANNUEL', 'PONCTUEL'];
const CONTRAT_STATUTS = ['ACTIF', 'SUSPENDU', 'TERMINE'];

function validateEnum(value: string | undefined, allowed: string[], field: string, rowRef: string): string | undefined {
  if (!value) return undefined;
  const up = value.toUpperCase().trim();
  if (!allowed.includes(up)) {
    errors.push(`[${rowRef}] ${field}: "${value}" invalide. Valeurs acceptées: ${allowed.join(', ')}`);
    return undefined;
  }
  return up;
}

// ── Erreurs et stats ───────────────────────────────────────────────────────
const errors: string[] = [];
const warnings: string[] = [];
const stats = { clients: 0, sites: 0, contacts: 0, contrats: 0, contratSites: 0 };

// ── Validation ─────────────────────────────────────────────────────────────
function validateAll(
  clients: ClientRow[],
  sites: SiteRow[],
  contacts: ContactRow[],
  contrats: ContratRow[],
) {
  const clientRefs = new Set(clients.map(c => c.ref));
  const siteRefs = new Set(sites.map(s => s.ref));

  // Vérifier refs uniques clients
  const seenClientRefs = new Set<string>();
  for (const row of clients) {
    if (!row.ref) { errors.push(`[clients.csv] Ligne sans ref`); continue; }
    if (!row.nomEntreprise) errors.push(`[clients.csv/${row.ref}] nomEntreprise requis`);
    if (seenClientRefs.has(row.ref)) errors.push(`[clients.csv] ref en double: "${row.ref}"`);
    seenClientRefs.add(row.ref);
    if (row.formeJuridique) validateEnum(row.formeJuridique, FORMES_JURIDIQUES, 'formeJuridique', `clients/${row.ref}`);
  }

  // Vérifier sites
  const seenSiteRefs = new Set<string>();
  for (const row of sites) {
    if (!row.ref) { errors.push(`[sites.csv] Ligne sans ref`); continue; }
    if (!row.client_ref) errors.push(`[sites.csv/${row.ref}] client_ref requis`);
    else if (!clientRefs.has(row.client_ref)) errors.push(`[sites.csv/${row.ref}] client_ref "${row.client_ref}" introuvable dans clients.csv`);
    if (!row.nom) errors.push(`[sites.csv/${row.ref}] nom requis`);
    if (seenSiteRefs.has(row.ref)) errors.push(`[sites.csv] ref en double: "${row.ref}"`);
    seenSiteRefs.add(row.ref);
  }

  // Vérifier contacts
  for (const row of contacts) {
    const id = `${row.client_ref}/${row.nom}`;
    if (!row.client_ref) { errors.push(`[contacts.csv] Ligne sans client_ref (nom: ${row.nom})`); continue; }
    if (!clientRefs.has(row.client_ref)) errors.push(`[contacts.csv/${id}] client_ref "${row.client_ref}" introuvable`);
    if (!row.nom) errors.push(`[contacts.csv/${row.client_ref}] nom requis`);
    if (row.site_ref && !siteRefs.has(row.site_ref)) errors.push(`[contacts.csv/${id}] site_ref "${row.site_ref}" introuvable dans sites.csv`);
    if (row.civilite) validateEnum(row.civilite, CIVILITES, 'civilite', `contacts/${id}`);
  }

  // Vérifier contrats
  for (const row of contrats) {
    const id = `${row.client_ref}/${row.site_ref || 'siege'}`;
    if (!row.client_ref) { errors.push(`[contrats.csv] Ligne sans client_ref`); continue; }
    if (!clientRefs.has(row.client_ref)) errors.push(`[contrats.csv/${id}] client_ref "${row.client_ref}" introuvable`);
    if (row.site_ref && !siteRefs.has(row.site_ref)) errors.push(`[contrats.csv/${id}] site_ref "${row.site_ref}" introuvable dans sites.csv`);
    if (!row.type) errors.push(`[contrats.csv/${id}] type requis (ANNUEL ou PONCTUEL)`);
    else validateEnum(row.type, CONTRAT_TYPES, 'type', `contrats/${id}`);
    if (!row.dateDebut) errors.push(`[contrats.csv/${id}] dateDebut requise`);
    else if (!date(row.dateDebut)) errors.push(`[contrats.csv/${id}] dateDebut format invalide (attendu: YYYY-MM-DD)`);
    if (row.dateFin && !date(row.dateFin)) errors.push(`[contrats.csv/${id}] dateFin format invalide`);
    if (row.statut) validateEnum(row.statut, CONTRAT_STATUTS, 'statut', `contrats/${id}`);
  }
}

// ── Import ────────────────────────────────────────────────────────────────
async function runImport(
  clients: ClientRow[],
  sites: SiteRow[],
  contacts: ContactRow[],
  contrats: ContratRow[],
) {
  // Maps ref → DB id
  const clientIds = new Map<string, string>();
  const siteIds   = new Map<string, string>();

  await prisma.$transaction(async (tx) => {

    // ── 1. Clients ──────────────────────────────────────────────────────
    console.log(c.bold('\n▸ Clients'));
    for (const row of clients) {
      if (!row.nomEntreprise) continue;
      const data: Prisma.ClientCreateInput = {
        nomEntreprise: row.nomEntreprise.trim(),
        typeTiers: 'CLIENT',
        formeJuridique: validateEnum(str(row.formeJuridique), FORMES_JURIDIQUES, '', '') as any || undefined,
        siegeRC:         str(row.siegeRC),
        siegeNIF:        str(row.siegeNIF),
        siegeAI:         str(row.siegeAI),
        siegeNIS:        str(row.siegeNIS),
        siegeNom:        row.nomEntreprise.trim(),
        siegeAdresse:    str(row.siegeAdresse),
        siegeCodePostal: str(row.siegeCodePostal),
        siegeVille:      str(row.siegeVille),
        siegePays:       str(row.siegePays) || 'Algérie',
        siegeTel:        str(row.siegeTel),
        siegeFax:        str(row.siegeFax),
        siegeEmail:      str(row.siegeEmail),
        siegeWebsite:    str(row.siegeWebsite),
        secteur:         str(row.secteur),
        notePrivee:      str(row.notes),
      };

      if (DRY_RUN) {
        console.log(c.dim(`  [dry] Client: ${data.nomEntreprise}`));
        clientIds.set(row.ref, `dry-client-${row.ref}`);
      } else {
        const existing = await tx.client.findFirst({ where: { nomEntreprise: data.nomEntreprise } });
        if (existing) {
          warnings.push(`Client "${data.nomEntreprise}" existe déjà (ref: ${row.ref}) → ignoré`);
          clientIds.set(row.ref, existing.id);
          console.log(c.yellow(`  ⚠ Client existant: ${data.nomEntreprise}`));
        } else {
          const created = await tx.client.create({ data });
          clientIds.set(row.ref, created.id);
          console.log(c.green(`  ✓ ${data.nomEntreprise}`));
          stats.clients++;
        }
      }
    }

    // ── 2. Sites ────────────────────────────────────────────────────────
    console.log(c.bold('\n▸ Sites'));
    for (const row of sites) {
      const clientId = clientIds.get(row.client_ref);
      if (!clientId) continue;
      const data: Prisma.SiteCreateInput = {
        client:   { connect: { id: clientId } },
        nom:      row.nom.trim(),
        adresse:  str(row.adresse),
        codePostal: str(row.codePostal),
        ville:    str(row.ville),
        tel:      str(row.tel),
        email:    str(row.email),
        notes:    str(row.notes),
      };

      if (DRY_RUN) {
        console.log(c.dim(`  [dry] Site: ${data.nom} (client: ${row.client_ref})`));
        siteIds.set(row.ref, `dry-site-${row.ref}`);
      } else {
        const existing = await tx.site.findFirst({ where: { clientId, nom: row.nom.trim() } });
        if (existing) {
          warnings.push(`Site "${row.nom}" existe déjà pour ce client → ignoré`);
          siteIds.set(row.ref, existing.id);
          console.log(c.yellow(`  ⚠ Site existant: ${row.nom}`));
        } else {
          const created = await tx.site.create({ data });
          siteIds.set(row.ref, created.id);
          console.log(c.green(`  ✓ ${row.nom} (${row.client_ref})`));
          stats.sites++;
        }
      }
    }

    // ── 3. Contacts ─────────────────────────────────────────────────────
    console.log(c.bold('\n▸ Contacts'));
    for (const row of contacts) {
      if (!row.nom?.trim()) continue;
      const clientId = clientIds.get(row.client_ref);
      if (!clientId) continue;
      const siteId = row.site_ref ? siteIds.get(row.site_ref) : undefined;

      if (siteId) {
        // SiteContact
        const data: Prisma.SiteContactCreateInput = {
          site:        { connect: { id: siteId } },
          civilite:    validateEnum(str(row.civilite), CIVILITES, '', '') as any || undefined,
          nom:         row.nom.trim(),
          prenom:      str(row.prenom),
          fonction:    str(row.fonction),
          tel:         str(row.tel),
          telMobile:   str(row.telMobile),
          email:       str(row.email),
          estPrincipal: bool(row.estPrincipal),
          notes:       str(row.notes),
        };
        if (DRY_RUN) {
          console.log(c.dim(`  [dry] SiteContact: ${data.nom} → site ${row.site_ref}`));
        } else {
          await tx.siteContact.create({ data });
          console.log(c.green(`  ✓ SiteContact: ${data.nom} → ${row.site_ref}`));
          stats.contacts++;
        }
      } else {
        // SiegeContact
        const data: Prisma.SiegeContactCreateInput = {
          client:      { connect: { id: clientId } },
          civilite:    validateEnum(str(row.civilite), CIVILITES, '', '') as any || undefined,
          nom:         row.nom.trim(),
          prenom:      str(row.prenom),
          fonction:    str(row.fonction) || 'Non renseigné',
          tel:         str(row.tel),
          telMobile:   str(row.telMobile),
          email:       str(row.email),
          estPrincipal: bool(row.estPrincipal),
          notes:       str(row.notes),
        };
        if (DRY_RUN) {
          console.log(c.dim(`  [dry] SiegeContact: ${data.nom} → client ${row.client_ref}`));
        } else {
          await tx.siegeContact.create({ data });
          console.log(c.green(`  ✓ SiegeContact: ${data.nom} → ${row.client_ref}`));
          stats.contacts++;
        }
      }
    }

    // ── 4. Contrats + ContratSites ─────────────────────────────────────
    console.log(c.bold('\n▸ Contrats'));

    // Grouper par (client_ref + numeroBonCommande + dateDebut) pour éviter les doublons
    const contratMap = new Map<string, { row: ContratRow; contratDbId?: string }>();

    for (const row of contrats) {
      const clientId = clientIds.get(row.client_ref);
      if (!clientId || !row.type || !row.dateDebut) continue;

      const groupKey = `${row.client_ref}__${row.numeroBonCommande || ''}__${row.dateDebut}`;

      // Créer le Contrat une seule fois par groupe
      if (!contratMap.has(groupKey)) {
        const prestationsList = row.prestations
          ? row.prestations.split(',').map(p => p.trim()).filter(Boolean)
          : [];

        const contratData: Prisma.ContratCreateInput = {
          client:       { connect: { id: clientId } },
          type:         (row.type.toUpperCase() as 'ANNUEL' | 'PONCTUEL'),
          statut:       (str(row.statut)?.toUpperCase() as 'ACTIF' | 'SUSPENDU' | 'TERMINE') || 'ACTIF',
          dateDebut:    date(row.dateDebut)!,
          dateFin:      date(row.dateFin),
          reconductionAuto: bool(row.reconductionAuto),
          numeroBonCommande: str(row.numeroBonCommande),
          prestations:  prestationsList,
          frequenceOperationsJours: num(row.frequenceOperationsJours) ? Math.round(num(row.frequenceOperationsJours)!) : undefined,
          premiereDateOperation: date(row.premiereDateOperation),
          frequenceControleJours: num(row.frequenceControleJours) ? Math.round(num(row.frequenceControleJours)!) : undefined,
          premiereDateControle: date(row.premiereDateControle),
          notes: str(row.notes),
        };

        if (DRY_RUN) {
          console.log(c.dim(`  [dry] Contrat: ${row.client_ref} / ${row.type} / début ${row.dateDebut}`));
          contratMap.set(groupKey, { row, contratDbId: `dry-contrat-${groupKey}` });
        } else {
          const existing = await tx.contrat.findFirst({
            where: { clientId, dateDebut: date(row.dateDebut), type: row.type as any }
          });
          if (existing) {
            warnings.push(`Contrat ${row.client_ref}/${row.dateDebut} existe déjà → réutilisé`);
            contratMap.set(groupKey, { row, contratDbId: existing.id });
          } else {
            const created = await tx.contrat.create({ data: contratData });
            contratMap.set(groupKey, { row, contratDbId: created.id });
            console.log(c.green(`  ✓ Contrat: ${row.client_ref} (${row.type})`));
            stats.contrats++;
          }
        }
      }

      // ContratSite (si site_ref fourni)
      const contratDbId = contratMap.get(groupKey)?.contratDbId;
      if (contratDbId && row.site_ref) {
        const siteId = siteIds.get(row.site_ref);
        if (!siteId) { warnings.push(`ContratSite: site_ref "${row.site_ref}" non résolu`); continue; }

        const prestationsList = row.prestations
          ? row.prestations.split(',').map(p => p.trim()).filter(Boolean)
          : [];

        const prixMap: Record<string, number> = {};
        if (row.montantHT && prestationsList.length === 1) {
          prixMap[prestationsList[0]] = parseFloat(row.montantHT);
        }

        const csData: Prisma.ContratSiteCreateInput = {
          contrat:  { connect: { id: contratDbId } },
          site:     { connect: { id: siteId } },
          prestations: prestationsList,
          prixPrestations: prixMap,
          frequenceOperationsJours: num(row.frequenceOperationsJours) ? Math.round(num(row.frequenceOperationsJours)!) : undefined,
          premiereDateOperation: date(row.premiereDateOperation),
          frequenceControleJours: num(row.frequenceControleJours) ? Math.round(num(row.frequenceControleJours)!) : undefined,
          premiereDateControle: date(row.premiereDateControle),
          notes: str(row.notes),
        };

        if (DRY_RUN) {
          console.log(c.dim(`  [dry] ContratSite: ${row.client_ref} → ${row.site_ref}`));
        } else {
          const exists = await tx.contratSite.findFirst({ where: { contratId: contratDbId, siteId } });
          if (!exists) {
            await tx.contratSite.create({ data: csData });
            console.log(c.green(`    ✓ ContratSite: ${row.site_ref}`));
            stats.contratSites++;
          }
        }
      }
    }
  }, { timeout: 60000 });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(c.bold('\n═══════════════════════════════════════════'));
  console.log(c.bold('  Migration RHS Controller'));
  console.log(c.bold(`  Mode : ${DRY_RUN ? c.yellow('DRY RUN (rien ne sera inséré)') : c.red('EXÉCUTION RÉELLE')}`));
  console.log(c.bold('═══════════════════════════════════════════\n'));

  // Lecture des CSV
  let clients: ClientRow[], sites: SiteRow[], contacts: ContactRow[], contrats: ContratRow[];
  try {
    clients  = readCsv<ClientRow>('clients.csv');
    sites    = readCsv<SiteRow>('sites.csv');
    contacts = readCsv<ContactRow>('contacts.csv');
    contrats = readCsv<ContratRow>('contrats.csv');
  } catch (e: any) {
    console.error(c.red(`\n✗ Erreur lecture CSV : ${e.message}`));
    process.exit(1);
  }

  console.log(`Clients  : ${clients.length} lignes`);
  console.log(`Sites    : ${sites.length} lignes`);
  console.log(`Contacts : ${contacts.length} lignes`);
  console.log(`Contrats : ${contrats.length} lignes`);

  // Validation
  console.log(c.bold('\n▸ Validation...'));
  validateAll(clients, sites, contacts, contrats);

  if (errors.length > 0) {
    console.log(c.red(`\n✗ ${errors.length} erreur(s) bloquante(s) :`));
    errors.forEach(e => console.log(c.red(`  • ${e}`)));
    console.log(c.red('\nCorrige ces erreurs avant de relancer.'));
    process.exit(1);
  }
  console.log(c.green('  ✓ Validation OK'));

  // Import
  try {
    await runImport(clients, sites, contacts, contrats);
  } catch (e: any) {
    console.error(c.red(`\n✗ Erreur pendant l'import : ${e.message}`));
    if (!DRY_RUN) console.error(c.yellow('  → Transaction annulée, aucune donnée insérée.'));
    process.exit(1);
  }

  // Rapport final
  console.log(c.bold('\n═══════════════════════════════════════════'));
  if (DRY_RUN) {
    console.log(c.yellow('  DRY RUN terminé — rien n\'a été inséré.'));
    console.log(c.dim('  Relance avec --execute pour importer pour de vrai.'));
  } else {
    console.log(c.green('  Import terminé avec succès !'));
    console.log(`  Clients     : ${stats.clients}`);
    console.log(`  Sites       : ${stats.sites}`);
    console.log(`  Contacts    : ${stats.contacts}`);
    console.log(`  Contrats    : ${stats.contrats}`);
    console.log(`  ContratSites: ${stats.contratSites}`);
  }
  if (warnings.length > 0) {
    console.log(c.yellow(`\n  ${warnings.length} avertissement(s) :`));
    warnings.forEach(w => console.log(c.yellow(`  ⚠ ${w}`)));
  }
  console.log(c.bold('═══════════════════════════════════════════\n'));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
