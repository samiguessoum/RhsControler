import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { prisma } from '../config/database.js';
import { parseDate } from '../utils/date.utils.js';

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  errors: ImportError[];
  preview?: any[];
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
        siteNom: row.site_nom,
        siteAdresse: row.site_adresse,
        secteur: row.secteur,
        contactNom: row.contact_nom,
        contactFonction: row.contact_fonction,
        tel: row.tel,
        email: row.email,
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
          await prisma.site.create({
            data: {
              clientId: existing.id,
              nom: row.siteNom || 'Site',
              adresse: row.siteAdresse,
              contactNom: row.contactNom,
              contactFonction: row.contactFonction,
              tel: row.tel,
              email: row.email || null,
              notes: row.notes,
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
          await prisma.site.create({
            data: {
              clientId: createdClient.id,
              nom: row.siteNom || 'Site',
              adresse: row.siteAdresse,
              contactNom: row.contactNom,
              contactFonction: row.contactFonction,
              tel: row.tel,
              email: row.email || null,
              notes: row.notes,
            },
          });
        }
        created++;
      }
    }

    return { success: true, created, updated, errors: [] };
  },

  /**
   * Preview import contrats
   */
  async previewContrats(content: string): Promise<ImportResult> {
    const errors: ImportError[] = [];
    const rows = this.parseCSV(content);

    const preview = await Promise.all(rows.map(async (row, index) => {
      const rowNum = index + 2;

      if (!row.client_nom?.trim()) {
        errors.push({ row: rowNum, field: 'client_nom', message: 'Nom du client requis' });
      }

      // Vérifier que le client existe
      const client = await prisma.client.findFirst({
        where: { nomEntreprise: row.client_nom },
      });

      if (!client && row.client_nom) {
        errors.push({ row: rowNum, field: 'client_nom', message: 'Client non trouvé', value: row.client_nom });
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

      return {
        _row: rowNum,
        _valid: errors.filter(e => e.row === rowNum).length === 0,
        _clientId: client?.id,
        clientNom: row.client_nom,
        type: row.type?.toUpperCase(),
        dateDebut: row.date_debut,
        dateFin: row.date_fin,
        reconductionAuto: row.reconduction_auto?.toLowerCase() === 'true',
        prestations: row.prestations?.split(',').map((p: string) => p.trim()).filter(Boolean),
        frequenceOperations: row.frequence_operations?.toUpperCase(),
        frequenceOperationsJours: row.jours_personnalises ? parseInt(row.jours_personnalises) : null,
        frequenceControle: row.frequence_controle?.toUpperCase(),
        premiereDateOperation: row.premiere_date_operation,
        premiereDateControle: row.premiere_date_controle,
        statut: row.statut?.toUpperCase() || 'ACTIF',
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
   * Import contrats
   */
  async importContrats(content: string, userId: string): Promise<ImportResult> {
    const preview = await this.previewContrats(content);

    if (!preview.success) {
      return preview;
    }

    let created = 0;

    for (const row of preview.preview!) {
      if (!row._clientId) continue;

      await prisma.contrat.create({
        data: {
          clientId: row._clientId,
          type: row.type,
          dateDebut: parseDate(row.dateDebut)!,
          dateFin: row.dateFin ? parseDate(row.dateFin) : null,
          reconductionAuto: row.reconductionAuto,
          prestations: row.prestations,
          frequenceOperations: row.frequenceOperations || null,
          frequenceOperationsJours: row.frequenceOperationsJours,
          frequenceControle: row.frequenceControle || null,
          premiereDateOperation: row.premiereDateOperation ? parseDate(row.premiereDateOperation) : null,
          premiereDateControle: row.premiereDateControle ? parseDate(row.premiereDateControle) : null,
          statut: row.statut,
        },
      });
      created++;
    }

    return { success: true, created, updated: 0, errors: [] };
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

      if (!row.type || !['OPERATION', 'CONTROLE'].includes(row.type.toUpperCase())) {
        errors.push({ row: rowNum, field: 'type', message: 'Type invalide (OPERATION ou CONTROLE)', value: row.type });
      }

      if (!row.date_prevue || !parseDate(row.date_prevue)) {
        errors.push({ row: rowNum, field: 'date_prevue', message: 'Date prévue invalide', value: row.date_prevue });
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
        statut: row.statut?.toUpperCase() || 'A_PLANIFIER',
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
      include: { sites: true, siegeContacts: true },
    });

    const rows = clients.flatMap((c) => {
      if (!c.sites || c.sites.length === 0) {
        const siegeContact = c.siegeContacts?.[0];
        return [{
          nom_entreprise: c.nomEntreprise,
          siege_nom: c.siegeNom || '',
          siege_adresse: c.siegeAdresse || '',
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
          site_nom: '',
          site_adresse: '',
          secteur: c.secteur || '',
          contact_nom: '',
          contact_fonction: '',
          tel: '',
          email: '',
          notes: '',
          actif: c.actif ? 'true' : 'false',
        }];
      }
      const siegeContact = c.siegeContacts?.[0];
      return c.sites.map((s) => ({
        nom_entreprise: c.nomEntreprise,
        siege_nom: c.siegeNom || '',
        siege_adresse: c.siegeAdresse || '',
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
        site_nom: s.nom || '',
        site_adresse: s.adresse || '',
        secteur: c.secteur || '',
        contact_nom: s.contactNom || '',
        contact_fonction: s.contactFonction || '',
        tel: s.tel || '',
        email: s.email || '',
        notes: s.notes || '',
        actif: c.actif ? 'true' : 'false',
      }));
    });

    return stringify(rows, { header: true });
  },

  /**
   * Export contrats en CSV
   */
  async exportContrats(): Promise<string> {
    const contrats = await prisma.contrat.findMany({
      include: { client: { select: { nomEntreprise: true } } },
      orderBy: { dateDebut: 'desc' },
    });

    return stringify(contrats.map(c => ({
      client_nom: c.client.nomEntreprise,
      type: c.type,
      date_debut: c.dateDebut.toISOString().split('T')[0],
      date_fin: c.dateFin?.toISOString().split('T')[0] || '',
      reconduction_auto: c.reconductionAuto ? 'true' : 'false',
      prestations: c.prestations.join(','),
      frequence_operations: c.frequenceOperations || '',
      jours_personnalises: c.frequenceOperationsJours || '',
      frequence_controle: c.frequenceControle || '',
      premiere_date_operation: c.premiereDateOperation?.toISOString().split('T')[0] || '',
      premiere_date_controle: c.premiereDateControle?.toISOString().split('T')[0] || '',
      statut: c.statut,
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
};

export default csvService;
