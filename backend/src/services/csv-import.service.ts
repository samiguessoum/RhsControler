import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { prisma } from '../config/database.js';
import { parseDate } from '../utils/date.utils.js';
import planningService from './planning.service.js';

const CONTRAT_STATUT_VALUES = ['ACTIF', 'SUSPENDU', 'TERMINE'];
const INTERVENTION_STATUT_VALUES = ['A_PLANIFIER', 'PLANIFIEE', 'REALISEE', 'REPORTEE', 'ANNULEE'];

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface ImportWarning {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  errors: ImportError[];
  warnings?: ImportWarning[];
  preview?: any[];
  bcsCreated?: number;
  bcsLinked?: number;
  planningGenere?: number;
}

/**
 * Parse une fréquence texte en jours/mois/règles complexes
 */
function parseFrequence(raw: string | null | undefined): {
  jours: number | null;
  mois: number | null;
  regles: string | null;
  planningAajuster: boolean;
} {
  if (!raw?.trim()) return { jours: null, mois: null, regles: null, planningAajuster: false };
  const normalized = raw.trim()
    .replace(/mpis/gi, 'mois')
    .replace(/préiode|preíode/gi, 'période');
  const isComplex = /[/]|et\s+p[ée]riode|chaude|saison/i.test(normalized);
  const moisMatch = /(\d+)\s*mois/i.exec(normalized);
  const jourMatch = /(\d+)\s*jours?/i.exec(normalized);
  return {
    mois: moisMatch ? parseInt(moisMatch[1]) : null,
    jours: (!moisMatch && jourMatch) ? parseInt(jourMatch[1]) : null,
    regles: isComplex ? raw.trim() : null,
    planningAajuster: isComplex,
  };
}

/**
 * Service d'import/export CSV
 */
export const csvService = {
  /**
   * Parse un fichier CSV
   */
  parseCSV(content: string): any[] {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  },

  /**
   * Preview import employés
   */
  async previewEmployes(content: string): Promise<ImportResult> {
    const errors: ImportError[] = [];
    const rows = this.parseCSV(content);

    const preview = rows.map((row, index) => {
      const rowNum = index + 2;

      if (!row.prenom?.trim()) {
        errors.push({ row: rowNum, field: 'prenom', message: 'Prénom requis' });
      }

      if (!row.nom?.trim()) {
        errors.push({ row: rowNum, field: 'nom', message: 'Nom requis' });
      }

      const rawPostes = (row.postes || '')
        .split(/[,;|]/)
        .map((p: string) => p.trim())
        .filter(Boolean);

      if (rawPostes.length === 0) {
        errors.push({ row: rowNum, field: 'postes', message: 'Au moins un poste requis' });
      }

      return {
        _row: rowNum,
        _valid: errors.filter(e => e.row === rowNum).length === 0,
        prenom: row.prenom,
        nom: row.nom,
        postes: rawPostes,
      };
    });

    return {
      success: errors.length === 0,
      created: 0,
      updated: 0,
      errors,
      preview,
    };
  },

  /**
   * Import employés
   */
  async importEmployes(content: string): Promise<ImportResult> {
    const preview = await this.previewEmployes(content);

    if (!preview.success) {
      return preview;
    }

    let created = 0;
    let updated = 0;

    for (const row of preview.preview!) {
      const postes = [];
      for (const nom of row.postes as string[]) {
        const trimmed = nom.trim();
        if (!trimmed) continue;
        const existingPoste = await prisma.poste.findUnique({ where: { nom: trimmed } });
        if (existingPoste) {
          postes.push(existingPoste);
        } else {
          const createdPoste = await prisma.poste.create({ data: { nom: trimmed } });
          postes.push(createdPoste);
        }
      }

      const existing = await prisma.employe.findFirst({
        where: {
          prenom: row.prenom,
          nom: row.nom,
        },
      });

      if (existing) {
        await prisma.employe.update({
          where: { id: existing.id },
          data: { postes: { set: [], connect: postes.map((p) => ({ id: p.id })) } },
        });
        updated++;
      } else {
        await prisma.employe.create({
          data: {
            prenom: row.prenom,
            nom: row.nom,
            postes: { connect: postes.map((p) => ({ id: p.id })) },
          },
        });
        created++;
      }
    }

    return { success: true, created, updated, errors: [] };
  },

  /**
   * Preview import clients
   */
  async previewClients(content: string): Promise<ImportResult> {
    const errors: ImportError[] = [];
    const rows = this.parseCSV(content);

    const preview = rows.map((row, index) => {
      const rowNum = index + 2; // +2 car ligne 1 = headers

      if (!row.nom_entreprise?.trim()) {
        errors.push({ row: rowNum, field: 'nom_entreprise', message: 'Nom d\'entreprise requis' });
      }

      if (!row.siege_nom?.trim()) {
        errors.push({ row: rowNum, field: 'siege_nom', message: 'Nom du siège requis' });
      }

      if (!row.site_nom?.trim()) {
        errors.push({ row: rowNum, field: 'site_nom', message: 'Nom du site requis' });
      }

      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push({ row: rowNum, field: 'email', message: 'Email invalide', value: row.email });
      }

      if (row.siege_contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.siege_contact_email)) {
        errors.push({ row: rowNum, field: 'siege_contact_email', message: 'Email invalide', value: row.siege_contact_email });
      }

      return {
        _row: rowNum,
        _valid: errors.filter(e => e.row === rowNum).length === 0,
        nomEntreprise: row.nom_entreprise,
        siegeNom: row.siege_nom,
        siegeAdresse: row.siege_adresse,
        siegeCodePostal: row.siege_code_postal,
        siegeVille: row.siege_ville,
        siegePays: row.siege_pays,
        siegeTel: row.siege_tel,
        siegeEmail: row.siege_email,
        siegeNotes: row.siege_notes,
        siegeRC: row.siege_rc,
        siegeNIF: row.siege_nif,
        siegeAI: row.siege_ai,
        siegeNIS: row.siege_nis,
        siegeTIN: row.siege_tin,
        siegeContactNom: row.siege_contact_nom,
        siegeContactFonction: row.siege_contact_fonction,
        siegeContactTel: row.siege_contact_tel,
        siegeContactEmail: row.siege_contact_email,
        siteCode: row.site_code,
        siteNom: row.site_nom,
        siteAdresse: row.site_adresse,
        siteComplement: row.site_complement,
        siteCodePostal: row.site_code_postal,
        siteVille: row.site_ville,
        sitePays: row.site_pays,
        secteur: row.secteur,
        contactNom: row.contact_nom,
        contactFonction: row.contact_fonction,
        tel: row.tel,
        fax: row.fax,
        email: row.email,
        horairesOuverture: row.horaires_ouverture,
        accessibilite: row.accessibilite,
        notes: row.notes,
      };
    });

    return {
      success: errors.length === 0,
      created: 0,
      updated: 0,
      errors,
      preview,
    };
  },

  /**
   * Import clients
   */
  async importClients(content: string): Promise<ImportResult> {
    const preview = await this.previewClients(content);

    if (!preview.success) {
      return preview;
    }

    let created = 0;
    let updated = 0;

    for (const row of preview.preview!) {
      // Chercher par nom d'entreprise exact
      const existing = await prisma.client.findFirst({
        where: { nomEntreprise: row.nomEntreprise },
      });

      if (existing) {
        await prisma.client.update({
          where: { id: existing.id },
          data: {
            secteur: row.secteur || existing.secteur,
            siegeNom: row.siegeNom || existing.siegeNom,
            siegeAdresse: row.siegeAdresse || existing.siegeAdresse,
            siegeCodePostal: row.siegeCodePostal || existing.siegeCodePostal,
            siegeVille: row.siegeVille || existing.siegeVille,
            siegePays: row.siegePays || existing.siegePays,
            siegeTel: row.siegeTel || existing.siegeTel,
            siegeEmail: row.siegeEmail || existing.siegeEmail,
            siegeNotes: row.siegeNotes || existing.siegeNotes,
            siegeRC: row.siegeRC || existing.siegeRC,
            siegeNIF: row.siegeNIF || existing.siegeNIF,
            siegeAI: row.siegeAI || existing.siegeAI,
            siegeNIS: row.siegeNIS || existing.siegeNIS,
            siegeTIN: row.siegeTIN || existing.siegeTIN,
          },
        });
        const hasSiegeContact =
          row.siegeContactNom || row.siegeContactFonction || row.siegeContactTel || row.siegeContactEmail;
        if (hasSiegeContact) {
          await prisma.siegeContact.create({
            data: {
              clientId: existing.id,
              nom: row.siegeContactNom || 'Contact',
              fonction: row.siegeContactFonction || 'Contact',
              tel: row.siegeContactTel || '',
              email: row.siegeContactEmail || '',
            },
          });
        }
        const hasSiteData = row.siteNom || row.siteAdresse || row.contactNom || row.contactFonction || row.tel || row.email || row.notes;
        if (hasSiteData) {
          const hasSiteContact = row.contactNom || row.contactFonction || row.tel || row.email;
          await prisma.site.create({
            data: {
              clientId: existing.id,
              code: row.siteCode || null,
              nom: row.siteNom || 'Site',
              adresse: row.siteAdresse,
              complement: row.siteComplement || null,
              codePostal: row.siteCodePostal || null,
              ville: row.siteVille || null,
              pays: row.sitePays || null,
              tel: row.tel,
              fax: row.fax || null,
              email: row.email || null,
              horairesOuverture: row.horairesOuverture || null,
              accessibilite: row.accessibilite || null,
              notes: row.notes,
              ...(hasSiteContact
                ? {
                    contacts: {
                      create: [{
                        nom: row.contactNom || 'Contact',
                        fonction: row.contactFonction || undefined,
                        tel: row.tel || undefined,
                        email: row.email || undefined,
                      }],
                    },
                  }
                : {}),
            },
          });
        }
        updated++;
      } else {
        const createdClient = await prisma.client.create({
          data: {
            nomEntreprise: row.nomEntreprise,
            secteur: row.secteur,
            siegeNom: row.siegeNom || row.nomEntreprise,
            siegeAdresse: row.siegeAdresse,
            siegeCodePostal: row.siegeCodePostal,
            siegeVille: row.siegeVille,
            siegePays: row.siegePays,
            siegeTel: row.siegeTel,
            siegeEmail: row.siegeEmail || null,
            siegeNotes: row.siegeNotes,
            siegeRC: row.siegeRC,
            siegeNIF: row.siegeNIF,
            siegeAI: row.siegeAI,
            siegeNIS: row.siegeNIS,
            siegeTIN: row.siegeTIN,
          },
        });
        const hasSiegeContact =
          row.siegeContactNom || row.siegeContactFonction || row.siegeContactTel || row.siegeContactEmail;
        if (hasSiegeContact) {
          await prisma.siegeContact.create({
            data: {
              clientId: createdClient.id,
              nom: row.siegeContactNom || 'Contact',
              fonction: row.siegeContactFonction || 'Contact',
              tel: row.siegeContactTel || '',
              email: row.siegeContactEmail || '',
            },
          });
        }
        const hasSiteData = row.siteNom || row.siteAdresse || row.contactNom || row.contactFonction || row.tel || row.email || row.notes;
        if (hasSiteData) {
          const hasSiteContact = row.contactNom || row.contactFonction || row.tel || row.email;
          await prisma.site.create({
            data: {
              clientId: createdClient.id,
              code: row.siteCode || null,
              nom: row.siteNom || 'Site',
              adresse: row.siteAdresse,
              complement: row.siteComplement || null,
              codePostal: row.siteCodePostal || null,
              ville: row.siteVille || null,
              pays: row.sitePays || null,
              tel: row.tel,
              fax: row.fax || null,
              email: row.email || null,
              horairesOuverture: row.horairesOuverture || null,
              accessibilite: row.accessibilite || null,
              notes: row.notes,
              ...(hasSiteContact
                ? {
                    contacts: {
                      create: [{
                        nom: row.contactNom || 'Contact',
                        fonction: row.contactFonction || undefined,
                        tel: row.tel || undefined,
                        email: row.email || undefined,
                      }],
                    },
                  }
                : {}),
            },
          });
        }
        created++;
      }
    }

    return { success: true, created, updated, errors: [] };
  },

  /**
   * Preview import contrats (v2 — avec site, BC, fréquences calendaires, déduplication refExterne)
   */
  async previewContrats(content: string): Promise<ImportResult> {
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];
    const rows = this.parseCSV(content);

    const preview = await Promise.all(rows.map(async (row, index) => {
      const rowNum = index + 2;

      if (!row.client_nom?.trim()) {
        errors.push({ row: rowNum, field: 'client_nom', message: 'Nom du client requis' });
      }

      // Vérifier que le client existe
      const client = row.client_nom?.trim()
        ? await prisma.client.findFirst({ where: { nomEntreprise: row.client_nom.trim() } })
        : null;

      if (!client && row.client_nom?.trim()) {
        errors.push({ row: rowNum, field: 'client_nom', message: 'Client non trouvé', value: row.client_nom });
      }

      // Lookup site si fourni
      let site = null;
      if (row.site_nom?.trim() && client) {
        site = await prisma.site.findFirst({
          where: { clientId: client.id, nom: { equals: row.site_nom.trim(), mode: 'insensitive' } },
        });
        if (!site) {
          errors.push({ row: rowNum, field: 'site_nom', message: `Site "${row.site_nom}" non trouvé pour ce client`, value: row.site_nom });
        }
      }

      if (!row.type || !['ANNUEL', 'PONCTUEL'].includes(row.type.toUpperCase())) {
        errors.push({ row: rowNum, field: 'type', message: 'Type invalide (ANNUEL ou PONCTUEL)', value: row.type });
      }

      if (!row.date_debut || !parseDate(row.date_debut)) {
        errors.push({ row: rowNum, field: 'date_debut', message: 'Date de début invalide', value: row.date_debut });
      }

      if (!row.prestations?.trim()) {
        errors.push({ row: rowNum, field: 'prestations', message: 'Au moins une prestation requise' });
      }

      // Fréquence opérations — jours OU mois
      let frequenceOperationsJours: number | null = null;
      let frequenceOperationsMois: number | null = null;
      let frequenceRegles: string | null = null;
      let planningAajuster = false;

      if (row.frequence_regles?.trim()) {
        const parsed = parseFrequence(row.frequence_regles);
        frequenceOperationsJours = parsed.jours;
        frequenceOperationsMois = parsed.mois;
        frequenceRegles = parsed.regles;
        planningAajuster = parsed.planningAajuster;
        if (planningAajuster) {
          warnings.push({ row: rowNum, field: 'frequence_regles', message: 'Fréquence complexe détectée — planningAajuster=true, ajustement manuel requis' });
        }
      } else if (row.frequence_operations_mois?.trim()) {
        frequenceOperationsMois = parseInt(row.frequence_operations_mois);
        if (isNaN(frequenceOperationsMois) || frequenceOperationsMois <= 0) {
          errors.push({ row: rowNum, field: 'frequence_operations_mois', message: 'Doit être un nombre de mois positif', value: row.frequence_operations_mois });
          frequenceOperationsMois = null;
        }
      } else if (row.frequence_operations_jours?.trim()) {
        frequenceOperationsJours = parseInt(row.frequence_operations_jours);
        if (isNaN(frequenceOperationsJours) || frequenceOperationsJours <= 0) {
          errors.push({ row: rowNum, field: 'frequence_operations_jours', message: 'Doit être un nombre de jours positif', value: row.frequence_operations_jours });
          frequenceOperationsJours = null;
        }
      }

      // Fréquence contrôle — règle brute OU mois OU jours
      let frequenceControleJours: number | null = null;
      let frequenceControleMois: number | null = null;
      let frequenceReglesControle: string | null = null;

      if (row.frequence_regles_controle?.trim()) {
        const parsedCtrl = parseFrequence(row.frequence_regles_controle);
        frequenceControleJours = parsedCtrl.jours;
        frequenceControleMois = parsedCtrl.mois;
        frequenceReglesControle = parsedCtrl.regles;
        if (parsedCtrl.planningAajuster) {
          warnings.push({ row: rowNum, field: 'frequence_regles_controle', message: 'Fréquence contrôle complexe — ajustement manuel requis' });
        }
      } else if (row.frequence_controle_mois?.trim()) {
        frequenceControleMois = parseInt(row.frequence_controle_mois);
        if (isNaN(frequenceControleMois) || frequenceControleMois <= 0) {
          errors.push({ row: rowNum, field: 'frequence_controle_mois', message: 'Doit être un nombre de mois positif', value: row.frequence_controle_mois });
          frequenceControleMois = null;
        }
      } else if (row.frequence_controle_jours?.trim()) {
        frequenceControleJours = parseInt(row.frequence_controle_jours);
        if (isNaN(frequenceControleJours) || frequenceControleJours <= 0) {
          errors.push({ row: rowNum, field: 'frequence_controle_jours', message: 'Doit être un nombre de jours positif', value: row.frequence_controle_jours });
          frequenceControleJours = null;
        }
      }

      const statut = row.statut?.trim() ? row.statut.toUpperCase() : 'ACTIF';
      if (!CONTRAT_STATUT_VALUES.includes(statut)) {
        errors.push({ row: rowNum, field: 'statut', message: `Statut invalide (${CONTRAT_STATUT_VALUES.join(', ')})`, value: row.statut });
      }

      if (row.date_fin && !parseDate(row.date_fin)) {
        errors.push({ row: rowNum, field: 'date_fin', message: 'Date de fin invalide', value: row.date_fin });
      }

      if (row.premiere_date_operation && !parseDate(row.premiere_date_operation)) {
        errors.push({ row: rowNum, field: 'premiere_date_operation', message: 'Date invalide', value: row.premiere_date_operation });
      }

      if (row.premiere_date_controle && !parseDate(row.premiere_date_controle)) {
        errors.push({ row: rowNum, field: 'premiere_date_controle', message: 'Date invalide', value: row.premiere_date_controle });
      }

      if (row.date_reprise_planification && !parseDate(row.date_reprise_planification)) {
        errors.push({ row: rowNum, field: 'date_reprise_planification', message: 'Date invalide', value: row.date_reprise_planification });
      }

      // Déduplication par refExterne
      let existingContrat = null;
      let action: 'CREATE' | 'UPDATE' = 'CREATE';
      if (row.ref_externe?.trim()) {
        existingContrat = await prisma.contrat.findUnique({ where: { refExterne: row.ref_externe.trim() } });
        if (existingContrat) action = 'UPDATE';
      }

      // Reconduction auto — warning si vide et dureeType = INDETERMINEE
      const dureeType = row.duree_type?.trim() || null;
      let reconductionAuto: boolean;
      if (row.reconduction_auto?.trim()) {
        reconductionAuto = row.reconduction_auto.toLowerCase() === 'true';
      } else {
        reconductionAuto = dureeType === 'INDETERMINEE';
        if (dureeType === 'INDETERMINEE' && !row.reconduction_auto?.trim()) {
          warnings.push({ row: rowNum, field: 'reconduction_auto', message: 'reconduction_auto déduit à true car duree_type=INDETERMINEE' });
        }
      }

      // BC status preview
      let bcAction: 'CREATE' | 'LINK' | null = null;
      if (row.numero_bon_commande?.trim() && client) {
        const existingBc = await prisma.bonCommande.findFirst({
          where: { numero: row.numero_bon_commande.trim(), clientId: client.id },
        });
        bcAction = existingBc ? 'LINK' : 'CREATE';
      }

      const montantHT = row.montant_ht?.trim() ? parseFloat(row.montant_ht) : null;
      const nombrePassagesAnnuels = row.nombre_passages_annuels?.trim() ? parseInt(row.nombre_passages_annuels) : null;

      return {
        _row: rowNum,
        _valid: errors.filter(e => e.row === rowNum).length === 0,
        _warnings: warnings.filter(w => w.row === rowNum),
        _clientId: client?.id,
        _siteId: site?.id,
        _action: action,
        _bcAction: bcAction,
        _existingContratId: existingContrat?.id,
        clientNom: row.client_nom,
        siteNom: row.site_nom?.trim() || null,
        type: row.type?.toUpperCase(),
        dateDebut: row.date_debut,
        dateFin: row.date_fin,
        reconductionAuto,
        prestations: row.prestations?.split(',').map((p: string) => p.trim()).filter(Boolean),
        frequenceOperationsJours,
        frequenceOperationsMois,
        frequenceControleJours,
        frequenceControleMois,
        frequenceRegles,
        frequenceReglesControle,
        planningAajuster,
        premiereDateOperation: row.premiere_date_operation,
        premiereDateControle: row.premiere_date_controle,
        statut,
        refExterne: row.ref_externe?.trim() || null,
        dateSignature: row.date_signature?.trim() || null,
        montantHT,
        dureeType,
        numeroBonCommande: row.numero_bon_commande?.trim() || null,
        notes: row.notes?.trim() || null,
        dateReprisePlanification: row.date_reprise_planification?.trim() || null,
        nombrePassagesAnnuels,
      };
    }));

    return {
      success: errors.length === 0,
      created: 0,
      updated: 0,
      errors,
      warnings,
      preview,
    };
  },

  /**
   * Import contrats v2 (avec BC, site, refExterne, fréquences calendaires)
   */
  async importContrats(content: string, userId: string, genererPlanning: boolean = false): Promise<ImportResult> {
    const preview = await this.previewContrats(content);

    if (!preview.success) {
      return preview;
    }

    let created = 0;
    let updated = 0;
    let bcsCreated = 0;
    let bcsLinked = 0;
    let planningGenere = 0;

    // Wrap in transaction for atomicity
    await prisma.$transaction(async (tx) => {
      for (const row of preview.preview!) {
        if (!row._clientId) continue;

        const contratData: any = {
          clientId: row._clientId,
          type: row.type,
          dateDebut: parseDate(row.dateDebut)!,
          dateFin: row.dateFin ? parseDate(row.dateFin) : null,
          reconductionAuto: row.reconductionAuto,
          prestations: row.prestations,
          frequenceOperationsJours: row.frequenceOperationsJours,
          frequenceControleJours: row.frequenceControleJours,
          frequenceOperationsMois: row.frequenceOperationsMois,
          frequenceControleMois: row.frequenceControleMois,
          frequenceRegles: row.frequenceRegles,
          frequenceReglesControle: row.frequenceReglesControle,
          planningAajuster: row.planningAajuster,
          premiereDateOperation: row.premiereDateOperation ? parseDate(row.premiereDateOperation) : null,
          premiereDateControle: row.premiereDateControle ? parseDate(row.premiereDateControle) : null,
          statut: row.statut,
          refExterne: row.refExterne,
          dateSignature: row.dateSignature ? parseDate(row.dateSignature) : null,
          montantHT: row.montantHT,
          dureeType: row.dureeType,
          notes: row.notes,
          datePriseEnComptePlanification: row.dateReprisePlanification ? parseDate(row.dateReprisePlanification) : null,
          nombrePassagesAnnuels: row.nombrePassagesAnnuels,
          numeroBonCommande: row.numeroBonCommande,
        };

        let contrat: any;

        if (row._action === 'UPDATE' && row._existingContratId) {
          // Upsert via refExterne
          contrat = await tx.contrat.update({
            where: { id: row._existingContratId },
            data: contratData,
          });
          updated++;
        } else {
          contrat = await tx.contrat.create({ data: contratData });
          created++;
        }

        // Upsert ContratSite si site fourni
        if (row._siteId) {
          await tx.contratSite.upsert({
            where: { contratId_siteId: { contratId: contrat.id, siteId: row._siteId } },
            create: {
              contratId: contrat.id,
              siteId: row._siteId,
              prestations: row.prestations || [],
              prixPrestations: {},
              frequenceOperationsJours: row.frequenceOperationsJours,
              frequenceControleJours: row.frequenceControleJours,
              frequenceOperationsMois: row.frequenceOperationsMois,
              frequenceControleMois: row.frequenceControleMois,
              frequenceRegles: row.frequenceRegles,
              frequenceReglesControle: row.frequenceReglesControle,
              premiereDateOperation: row.premiereDateOperation ? parseDate(row.premiereDateOperation) : null,
              premiereDateControle: row.premiereDateControle ? parseDate(row.premiereDateControle) : null,
              montantHT: row.montantHT,
              nombrePassagesAnnuels: row.nombrePassagesAnnuels,
            },
            update: {
              frequenceOperationsJours: row.frequenceOperationsJours !== undefined ? row.frequenceOperationsJours : undefined,
              frequenceControleJours: row.frequenceControleJours !== undefined ? row.frequenceControleJours : undefined,
              frequenceOperationsMois: row.frequenceOperationsMois !== undefined ? row.frequenceOperationsMois : undefined,
              frequenceControleMois: row.frequenceControleMois !== undefined ? row.frequenceControleMois : undefined,
              frequenceRegles: row.frequenceRegles !== undefined ? row.frequenceRegles : undefined,
              frequenceReglesControle: row.frequenceReglesControle !== undefined ? row.frequenceReglesControle : undefined,
              montantHT: row.montantHT !== undefined ? row.montantHT : undefined,
              nombrePassagesAnnuels: row.nombrePassagesAnnuels !== undefined ? row.nombrePassagesAnnuels : undefined,
            },
          });
        }

        // Find-or-create BonCommande + BonCommandeSite si numéro fourni
        if (row.numeroBonCommande && row._clientId) {
          const existingBc = await tx.bonCommande.findFirst({
            where: { numero: row.numeroBonCommande, clientId: row._clientId },
          });

          let bc: any;
          if (existingBc) {
            bc = existingBc;
            bcsLinked++;
          } else {
            bc = await tx.bonCommande.create({
              data: {
                numero: row.numeroBonCommande,
                clientId: row._clientId,
                contratId: contrat.id,
                notes: null,
              },
            });
            bcsCreated++;
          }

          // Lier le site au BC si fourni
          if (row._siteId) {
            await tx.bonCommandeSite.upsert({
              where: { bcId_siteId: { bcId: bc.id, siteId: row._siteId } },
              create: { bcId: bc.id, siteId: row._siteId },
              update: {},
            });
          }
        }
      }
    });

    // Génération du planning hors transaction (lourd)
    if (genererPlanning) {
      for (const row of preview.preview!) {
        if (!row._valid || !row._existingContratId && row._action !== 'CREATE') continue;
        if (!row.dateReprisePlanification) continue; // sécurité : ne génère que si date_reprise fournie
        // Find contrat by refExterne or last created
        let contrat: any = null;
        if (row.refExterne) {
          contrat = await prisma.contrat.findUnique({ where: { refExterne: row.refExterne } });
        }
        if (contrat) {
          try {
            await planningService.genererPlanningContrat(contrat.id, userId);
            planningGenere++;
          } catch (_e) {
            // Non-blocking
          }
        }
      }
    }

    return {
      success: true,
      created,
      updated,
      errors: [],
      warnings: preview.warnings,
      bcsCreated,
      bcsLinked,
      planningGenere,
    };
  },

  /**
   * Preview import interventions
   */
  async previewInterventions(content: string): Promise<ImportResult> {
    const errors: ImportError[] = [];
    const rows = this.parseCSV(content);

    const preview = await Promise.all(rows.map(async (row, index) => {
      const rowNum = index + 2;

      if (!row.client_nom?.trim()) {
        errors.push({ row: rowNum, field: 'client_nom', message: 'Nom du client requis' });
      }

      const client = await prisma.client.findFirst({
        where: { nomEntreprise: row.client_nom },
      });

      if (!client && row.client_nom) {
        errors.push({ row: rowNum, field: 'client_nom', message: 'Client non trouvé', value: row.client_nom });
      }

      if (!row.type || !['OPERATION', 'CONTROLE', 'RECLAMATION', 'PREMIERE_VISITE', 'DEPLACEMENT_COMMERCIAL'].includes(row.type.toUpperCase())) {
        errors.push({ row: rowNum, field: 'type', message: 'Type invalide', value: row.type });
      }

      if (!row.date_prevue || !parseDate(row.date_prevue)) {
        errors.push({ row: rowNum, field: 'date_prevue', message: 'Date prévue invalide', value: row.date_prevue });
      }

      const statut = row.statut?.trim() ? row.statut.toUpperCase() : 'A_PLANIFIER';
      if (!INTERVENTION_STATUT_VALUES.includes(statut)) {
        errors.push({ row: rowNum, field: 'statut', message: `Statut invalide (${INTERVENTION_STATUT_VALUES.join(', ')})`, value: row.statut });
      }

      return {
        _row: rowNum,
        _valid: errors.filter(e => e.row === rowNum).length === 0,
        _clientId: client?.id,
        clientNom: row.client_nom,
        type: row.type?.toUpperCase(),
        prestation: row.prestation,
        datePrevue: row.date_prevue,
        heurePrevue: row.heure_prevue,
        duree: row.duree_minutes ? parseInt(row.duree_minutes) : null,
        statut,
        notes: row.notes,
      };
    }));

    return {
      success: errors.length === 0,
      created: 0,
      updated: 0,
      errors,
      preview,
    };
  },

  /**
   * Import interventions
   */
  async importInterventions(content: string, userId: string): Promise<ImportResult> {
    const preview = await this.previewInterventions(content);

    if (!preview.success) {
      return preview;
    }

    let created = 0;

    for (const row of preview.preview!) {
      if (!row._clientId) continue;

      await prisma.intervention.create({
        data: {
          clientId: row._clientId,
          type: row.type,
          prestation: row.prestation,
          datePrevue: parseDate(row.datePrevue)!,
          heurePrevue: row.heurePrevue || null,
          duree: row.duree,
          statut: row.statut,
          notesTerrain: row.notes,
          createdById: userId,
        },
      });
      created++;
    }

    return { success: true, created, updated: 0, errors: [] };
  },

  /**
   * Export employés en CSV
   */
  async exportEmployes(): Promise<string> {
    const employes = await prisma.employe.findMany({
      include: { postes: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });

    return stringify(employes.map((e) => ({
      prenom: e.prenom,
      nom: e.nom,
      postes: e.postes.map((p) => p.nom).join(','),
    })), { header: true });
  },

  /**
   * Export clients en CSV
   */
  async exportClients(): Promise<string> {
    const clients = await prisma.client.findMany({
      orderBy: { nomEntreprise: 'asc' },
      include: { sites: { include: { contacts: true } }, siegeContacts: true },
    });

    const rows = clients.flatMap((c) => {
      if (!c.sites || c.sites.length === 0) {
        const siegeContact = c.siegeContacts?.[0];
        return [{
          nom_entreprise: c.nomEntreprise,
          siege_nom: c.siegeNom || '',
          siege_adresse: c.siegeAdresse || '',
          siege_code_postal: c.siegeCodePostal || '',
          siege_ville: c.siegeVille || '',
          siege_pays: c.siegePays || '',
          siege_contact_nom: siegeContact?.nom || '',
          siege_contact_fonction: siegeContact?.fonction || '',
          siege_contact_tel: siegeContact?.tel || '',
          siege_contact_email: siegeContact?.email || '',
          siege_tel: c.siegeTel || '',
          siege_email: c.siegeEmail || '',
          siege_notes: c.siegeNotes || '',
          siege_rc: c.siegeRC || '',
          siege_nif: c.siegeNIF || '',
          siege_ai: c.siegeAI || '',
          siege_nis: c.siegeNIS || '',
          siege_tin: c.siegeTIN || '',
          site_code: '',
          site_nom: '',
          site_adresse: '',
          site_complement: '',
          site_code_postal: '',
          site_ville: '',
          site_pays: '',
          secteur: c.secteur || '',
          contact_nom: '',
          contact_fonction: '',
          tel: '',
          fax: '',
          email: '',
          horaires_ouverture: '',
          accessibilite: '',
          notes: '',
          actif: c.actif ? 'true' : 'false',
        }];
      }
      const siegeContact = c.siegeContacts?.[0];
      return c.sites.map((s) => {
        const siteContact = s.contacts?.find((contact) => contact.estPrincipal) || s.contacts?.[0];
        return ({
          nom_entreprise: c.nomEntreprise,
          siege_nom: c.siegeNom || '',
          siege_adresse: c.siegeAdresse || '',
          siege_code_postal: c.siegeCodePostal || '',
          siege_ville: c.siegeVille || '',
          siege_pays: c.siegePays || '',
          siege_contact_nom: siegeContact?.nom || '',
          siege_contact_fonction: siegeContact?.fonction || '',
          siege_contact_tel: siegeContact?.tel || '',
          siege_contact_email: siegeContact?.email || '',
          siege_tel: c.siegeTel || '',
          siege_email: c.siegeEmail || '',
          siege_notes: c.siegeNotes || '',
          siege_rc: c.siegeRC || '',
          siege_nif: c.siegeNIF || '',
          siege_ai: c.siegeAI || '',
          siege_nis: c.siegeNIS || '',
          siege_tin: c.siegeTIN || '',
          site_code: s.code || '',
          site_nom: s.nom || '',
          site_adresse: s.adresse || '',
          site_complement: s.complement || '',
          site_code_postal: s.codePostal || '',
          site_ville: s.ville || '',
          site_pays: s.pays || '',
          secteur: c.secteur || '',
          contact_nom: siteContact?.nom || '',
          contact_fonction: siteContact?.fonction || '',
          tel: s.tel || '',
          fax: s.fax || '',
          email: s.email || '',
          horaires_ouverture: s.horairesOuverture || '',
          accessibilite: s.accessibilite || '',
          notes: s.notes || '',
          actif: c.actif ? 'true' : 'false',
        });
      });
    });

    return stringify(rows, { header: true });
  },

  /**
   * Export contrats en CSV (v2 avec nouveaux champs)
   */
  async exportContrats(): Promise<string> {
    const contrats = await prisma.contrat.findMany({
      include: {
        client: { select: { nomEntreprise: true } },
        contratSites: { include: { site: { select: { nom: true } } }, take: 1 },
      },
      orderBy: { dateDebut: 'desc' },
    });

    return stringify(contrats.map(c => ({
      client_nom: c.client.nomEntreprise,
      site_nom: c.contratSites?.[0]?.site?.nom || '',
      type: c.type,
      date_debut: c.dateDebut.toISOString().split('T')[0],
      date_fin: c.dateFin?.toISOString().split('T')[0] || '',
      reconduction_auto: c.reconductionAuto ? 'true' : 'false',
      prestations: c.prestations.join(','),
      frequence_operations_jours: c.frequenceOperationsJours || '',
      frequence_operations_mois: (c as any).frequenceOperationsMois || '',
      frequence_controle_jours: c.frequenceControleJours || '',
      frequence_controle_mois: (c as any).frequenceControleMois || '',
      frequence_regles: (c as any).frequenceRegles || '',
      frequence_regles_controle: (c as any).frequenceReglesControle || '',
      premiere_date_operation: c.premiereDateOperation?.toISOString().split('T')[0] || '',
      premiere_date_controle: c.premiereDateControle?.toISOString().split('T')[0] || '',
      statut: c.statut,
      ref_externe: (c as any).refExterne || '',
      date_signature: (c as any).dateSignature?.toISOString().split('T')[0] || '',
      montant_ht: (c as any).montantHT || '',
      duree_type: (c as any).dureeType || '',
      numero_bon_commande: c.numeroBonCommande || '',
      notes: c.notes || '',
      date_reprise_planification: (c as any).datePriseEnComptePlanification?.toISOString().split('T')[0] || '',
      nombre_passages_annuels: (c as any).nombrePassagesAnnuels || '',
    })), { header: true });
  },

  /**
   * Export interventions en CSV
   */
  async exportInterventions(filters?: { dateDebut?: Date; dateFin?: Date }): Promise<string> {
    const where: any = {};

    if (filters?.dateDebut || filters?.dateFin) {
      where.datePrevue = {};
      if (filters.dateDebut) where.datePrevue.gte = filters.dateDebut;
      if (filters.dateFin) where.datePrevue.lte = filters.dateFin;
    }

    const interventions = await prisma.intervention.findMany({
      where,
      include: {
        client: { select: { nomEntreprise: true } },
        contrat: { select: { id: true } },
      },
      orderBy: { datePrevue: 'asc' },
    });

    return stringify(interventions.map(i => ({
      client_nom: i.client.nomEntreprise,
      contrat_ref: i.contrat?.id || '',
      type: i.type,
      prestation: i.prestation || '',
      date_prevue: i.datePrevue.toISOString().split('T')[0],
      heure_prevue: i.heurePrevue || '',
      duree_minutes: i.duree || '',
      statut: i.statut,
      responsable: i.responsable || '',
      notes: i.notesTerrain || '',
    })), { header: true });
  },

  /**
   * Génère le template CSV contrats avec colonnes commentées et ligne exemple
   */
  generateContratsCsvTemplate(): string {
    const headers = [
      'client_nom',
      'site_nom',
      'type',
      'date_debut',
      'date_fin',
      'reconduction_auto',
      'prestations',
      'frequence_operations_jours',
      'frequence_operations_mois',
      'frequence_controle_jours',
      'frequence_controle_mois',
      'frequence_regles',
      'frequence_regles_controle',
      'premiere_date_operation',
      'premiere_date_controle',
      'statut',
      'ref_externe',
      'date_signature',
      'montant_ht',
      'duree_type',
      'numero_bon_commande',
      'notes',
      'date_reprise_planification',
      'nombre_passages_annuels',
    ];

    const exampleRow = {
      client_nom: 'SARL Dupont',
      site_nom: 'Entrepôt Nord',
      type: 'ANNUEL',
      date_debut: '2026-01-01',
      date_fin: '2026-12-31',
      reconduction_auto: 'false',
      prestations: 'Dératisation,Désinsectisation',
      frequence_operations_jours: '',
      frequence_operations_mois: '2',
      frequence_controle_jours: '',
      frequence_controle_mois: '6',
      frequence_regles: '',
      frequence_regles_controle: '',
      premiere_date_operation: '2026-01-15',
      premiere_date_controle: '2026-06-15',
      statut: 'ACTIF',
      ref_externe: 'CTR-2026-001',
      date_signature: '2025-12-20',
      montant_ht: '15000',
      duree_type: 'DETERMINEE',
      numero_bon_commande: 'BC-2026-123',
      notes: 'Contrat annuel standard',
      date_reprise_planification: '',
      nombre_passages_annuels: '6',
    };

    return stringify([exampleRow], { header: true, columns: headers });
  },
};

export default csvService;
