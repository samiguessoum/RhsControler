import { addMonths, format } from 'date-fns';
import { prisma } from '../config/database.js';

type BuildAttestationOptions = {
  garantieMois?: number;
  ville?: string;
  prestataireNom?: string;
  kind?: 'passage' | 'garantie' | 'controle';
};

type AttestationData = {
  fileName: string;
  values: {
    ville: string;
    dateReferenceFr: string;
    operationsLabel: string;
    clientNom: string;
    clientDisplayName: string;
    prestataireNom: string;
    garantieMois: number;
    garantieMoisLabel: string;
    dateProchaineOperationFr: string;
    bodyTemplate: string;
    bodyText: string;
    title: string;
    showSignatures: boolean;
    showGuaranteeSection: boolean;
  };
};

type AttestationVariables = {
  date_reference_fr: string;
  prestataire_nom: string;
  operations_label: string;
  client_display_name: string;
};

const DEFAULT_BODY_TEMPLATE =
  'En date du {{date_reference_fr}}, l’équipe technique de la société **{{prestataire_nom}}** a réalisé les opérations de {{operations_label}} au niveau de toutes les structures de **{{client_display_name}}**.';
const DEFAULT_BODY_TEMPLATE_CONTROLE =
  'En date du {{date_reference_fr}}, l’équipe technique de la société **{{prestataire_nom}}** a réalisé une visite de contrôle au niveau de toutes les structures de **{{client_display_name}}**.';

function formatMoisLabel(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace('.', ',');
}

function safeFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeClientDisplayName(value: string): string {
  return value.trim().replace(/^l['’]\s*/i, '');
}

function renderBodyTemplate(template: string, vars: AttestationVariables): string {
  const rendered = template
    .replaceAll('{{date_reference_fr}}', vars.date_reference_fr)
    .replaceAll('{{prestataire_nom}}', vars.prestataire_nom)
    .replaceAll('{{operations_label}}', vars.operations_label)
    .replaceAll('{{client_display_name}}', vars.client_display_name);
  return ensureDefaultBoldMarkers(rendered, vars.prestataire_nom, vars.client_display_name);
}

function ensureDefaultBoldMarkers(body: string, prestataire: string, client: string): string {
  let output = body;
  if (prestataire && !output.includes(`**${prestataire}**`)) {
    output = output.replace(prestataire, `**${prestataire}**`);
  }
  if (client && !output.includes(`**${client}**`)) {
    output = output.replace(client, `**${client}**`);
  }
  return output;
}

function convertBodyTextToTemplate(bodyText: string, vars: AttestationVariables): string {
  const pairs: [string, string][] = [
    [vars.date_reference_fr, '{{date_reference_fr}}'],
    [vars.prestataire_nom, '{{prestataire_nom}}'],
    [vars.operations_label, '{{operations_label}}'],
    [vars.client_display_name, '{{client_display_name}}'],
  ];
  pairs.sort((a, b) => b[0].length - a[0].length);

  let output = bodyText.trim();
  for (const [value, placeholder] of pairs) {
    if (!value) continue;
    output = output.split(value).join(placeholder);
  }

  return output;
}

export const attestationService = {
  async buildAttestationData(interventionId: string, options: BuildAttestationOptions = {}): Promise<AttestationData> {
    const kind = options.kind || 'passage';
    const intervention = await prisma.intervention.findUnique({
      where: { id: interventionId },
      include: {
        client: {
          select: {
            nomEntreprise: true,
            formeJuridique: true,
          },
        },
        contrat: {
          select: {
            id: true,
            prestations: true,
            nombreOperations: true,
            frequenceOperations: true,
            attestationMessageTemplate: true,
            attestationControleMessageTemplate: true,
          },
        },
      },
    });

    if (!intervention) {
      throw new Error('Intervention non trouvée');
    }

    if (kind === 'controle' && intervention.type !== 'CONTROLE') {
      throw new Error("L'attestation de visite de contrôle est disponible uniquement pour les interventions de type CONTROLE");
    }
    if ((kind === 'passage' || kind === 'garantie') && intervention.type !== 'OPERATION') {
      throw new Error("Cette attestation est disponible uniquement pour les interventions de type OPERATION");
    }

    const garantieMois = typeof options.garantieMois === 'number' && Number.isFinite(options.garantieMois) && options.garantieMois > 0
      ? Math.floor(options.garantieMois)
      : 2;
    const ville = options.ville?.trim() || 'Alger';
    const prestataireNom = options.prestataireNom?.trim() || 'RAYAN HYGIENE SERVICES';
    const clientNom = intervention.client?.nomEntreprise?.trim() || 'CLIENT';
    const clientFormeJuridique = intervention.client?.formeJuridique?.trim() || '';
    const clientDisplayName = normalizeClientDisplayName([clientFormeJuridique, clientNom].filter(Boolean).join(' '));
    const dateReference = intervention.datePrevue;
    const contratPrestations = intervention.contrat?.prestations || [];
    const operationsLabel = contratPrestations.length > 0
      ? contratPrestations.join(', ')
      : (intervention.prestation?.trim() || 'prestation technique');

    const prochaineIntervention = await prisma.intervention.findFirst({
      where: {
        id: { not: intervention.id },
        clientId: intervention.clientId,
        type: 'OPERATION',
        statut: { not: 'ANNULEE' },
        datePrevue: { gt: dateReference },
        ...(intervention.contratId ? { contratId: intervention.contratId } : {}),
        ...(intervention.siteId ? { siteId: intervention.siteId } : {}),
      },
      orderBy: [{ datePrevue: 'asc' }],
      select: { datePrevue: true },
    });

    const dateProchaineOperation = prochaineIntervention?.datePrevue || addMonths(dateReference, garantieMois);

    let garantieMoisComputed: number | null = null;
    if (prochaineIntervention?.datePrevue) {
      const diffMs = prochaineIntervention.datePrevue.getTime() - dateReference.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 0) {
        garantieMoisComputed = Math.max(1, Math.round((diffDays / 30) * 10) / 10);
      }
    }

    if (garantieMoisComputed == null && intervention.contrat?.nombreOperations && intervention.contrat.nombreOperations > 0) {
      garantieMoisComputed = Math.max(1, Math.round((12 / intervention.contrat.nombreOperations) * 10) / 10);
    }

    if (garantieMoisComputed == null && intervention.contrat?.frequenceOperations) {
      const freqToMonths: Record<string, number> = {
        HEBDOMADAIRE: 0.25,
        MENSUELLE: 1,
        TRIMESTRIELLE: 3,
        SEMESTRIELLE: 6,
        ANNUELLE: 12,
      };
      const byFreq = freqToMonths[intervention.contrat.frequenceOperations];
      if (byFreq) {
        garantieMoisComputed = byFreq;
      }
    }

    if (garantieMoisComputed == null) {
      garantieMoisComputed = garantieMois;
    }

    const vars: AttestationVariables = {
      date_reference_fr: format(dateReference, 'dd/MM/yyyy'),
      prestataire_nom: prestataireNom,
      operations_label: operationsLabel,
      client_display_name: clientDisplayName,
    };
    const bodyTemplate =
      kind === 'controle'
        ? (intervention.contrat?.attestationControleMessageTemplate || DEFAULT_BODY_TEMPLATE_CONTROLE)
        : (intervention.contrat?.attestationMessageTemplate || DEFAULT_BODY_TEMPLATE);
    const bodyText = renderBodyTemplate(bodyTemplate, vars);

    return {
      fileName: `attestation-${kind}-${safeFileName(clientNom)}-${format(dateReference, 'yyyy-MM-dd')}.pdf`,
      values: {
        ville,
        dateReferenceFr: vars.date_reference_fr,
        operationsLabel,
        clientNom,
        clientDisplayName,
        prestataireNom,
        garantieMois: garantieMoisComputed,
        garantieMoisLabel: formatMoisLabel(garantieMoisComputed),
        dateProchaineOperationFr: format(dateProchaineOperation, 'dd/MM/yyyy'),
        bodyTemplate,
        bodyText,
        title:
          kind === 'garantie'
            ? 'ATTESTATION DE GARANTIE'
            : kind === 'controle'
              ? 'ATTESTATION DE VISITE DE CONTRÔLE'
              : 'ATTESTATION DE PASSAGE',
        showSignatures: kind !== 'garantie',
        showGuaranteeSection: kind !== 'controle',
      },
    };
  },

  async getBodyConfig(interventionId: string, options: BuildAttestationOptions = {}) {
    const data = await this.buildAttestationData(interventionId, options);
    return {
      bodyText: data.values.bodyText,
      hasCustomTemplate: data.values.bodyTemplate !== (options.kind === 'controle' ? DEFAULT_BODY_TEMPLATE_CONTROLE : DEFAULT_BODY_TEMPLATE),
    };
  },

  async saveBodyTemplate(interventionId: string, bodyText: string, options: BuildAttestationOptions = {}) {
    const kind = options.kind || 'passage';
    const trimmedBody = bodyText?.trim();
    if (!trimmedBody) {
      throw new Error('Le corps du message est requis');
    }

    const data = await this.buildAttestationData(interventionId, options);
    const intervention = await prisma.intervention.findUnique({
      where: { id: interventionId },
      select: { contratId: true },
    });

    if (!intervention) {
      throw new Error('Intervention non trouvée');
    }
    if (!intervention.contratId) {
      throw new Error("Cette intervention n'est pas liée à un contrat");
    }

    const vars: AttestationVariables = {
      date_reference_fr: data.values.dateReferenceFr,
      prestataire_nom: data.values.prestataireNom,
      operations_label: data.values.operationsLabel,
      client_display_name: data.values.clientDisplayName,
    };
    const template = convertBodyTextToTemplate(trimmedBody, vars);

    await prisma.contrat.update({
      where: { id: intervention.contratId },
      data: kind === 'controle'
        ? { attestationControleMessageTemplate: template }
        : {
            // Passage + Garantie partagent le même corps personnalisé.
            attestationMessageTemplate: template,
          },
    });

    return { templateSaved: template };
  },
};

export default attestationService;
