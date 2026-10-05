import { addMonths, differenceInCalendarDays, format } from 'date-fns';
import { sourceFrequenceOperations } from '../utils/frequence.utils.js';
import { frequenceALaDate, prochaineDateTheorique } from '../utils/date.utils.js';
import { prisma } from '../config/database.js';

type BuildAttestationOptions = {
  garantieMois?: number;
  ville?: string;
  prestataireNom?: string;
  kind?: 'passage' | 'garantie' | 'controle';
};

type AttestationData = {
  fileName: string;
  contratId: string | null;
  values: {
    ville: string;
    dateReferenceFr: string;
    operationsLabel: string;
    clientNom: string;
    clientDisplayName: string;
    prestataireNom: string;
    garantieMois: number;
    garantieMoisLabel: string;
    garantieDureeLabel: string;
    garantieJours: number;
    garantieJoursLabel: string;
    dateProchaineOperationFr: string;
    bodyTemplate: string;
    bodyText: string;
    title: string;
    showSignatures: boolean;
    showGuaranteeSection: boolean;
    siteNom?: string | null;
    siteAdresse?: string | null;
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
        site: {
          select: {
            nom: true,
            adresse: true,
            codePostal: true,
            ville: true,
          },
        },
        avenant: { select: { frequenceOperationsJours: true, frequenceOperationsMois: true, periodesFrequence: true } },
        contrat: {
          select: {
            id: true,
            prestations: true,
            nombreOperations: true,
            frequenceOperationsJours: true,
            frequenceOperationsMois: true,
            attestationMessageTemplate: true,
            attestationControleMessageTemplate: true,
            contratSites: {
              select: {
                siteId: true,
                frequenceOperationsJours: true,
                frequenceOperationsMois: true,
                periodesFrequence: true,
                nombreOperations: true,
              },
            },
          },
        },
      },
    });

    if (!intervention) {
      throw new Error('Intervention non trouvée');
    }

    // Générable avant réalisation (comme la facture) : seule une intervention annulée est exclue
    if (intervention.statut === 'ANNULEE') {
      throw new Error("Impossible de générer une attestation pour une intervention annulée");
    }

    if (kind === 'controle' && intervention.type !== 'CONTROLE') {
      throw new Error("L'attestation de visite de contrôle est disponible uniquement pour les interventions de type CONTROLE");
    }
    if ((kind === 'passage' || kind === 'garantie') && intervention.type !== 'OPERATION') {
      throw new Error("Cette attestation est disponible uniquement pour les interventions de type OPERATION");
    }

    const ville = options.ville?.trim() || 'Alger';
    const prestataireNom = options.prestataireNom?.trim() || 'RAYAN HYGIENE SERVICES';
    const clientNom = intervention.client?.nomEntreprise?.trim() || 'CLIENT';
    const clientFormeJuridique = intervention.client?.formeJuridique?.trim() || '';
    const clientDisplayName = normalizeClientDisplayName([clientFormeJuridique, clientNom].filter(Boolean).join(' '));

    // Date de référence = date de réalisation effective, sinon date planifiée (pas encore réalisée)
    const dateReference = intervention.dateRealisee || intervention.datePrevue;

    const contratPrestations = intervention.contrat?.prestations || [];
    const operationsLabel = contratPrestations.length > 0
      ? contratPrestations.join(', ')
      : (intervention.prestation?.trim() || 'prestation technique');

    // Fréquence applicable au passage : avenant → site → contrat, période saisonnière comprise
    // (mois prioritaire sur jours). Prochaine opération = même règle que le planning : fréquence
    // de la date du passage, avancée si une période plus rapprochée commence avant (fallback 30 j)
    const src = sourceFrequenceOperations(intervention as any);
    const freq = frequenceALaDate(dateReference, src.jours, src.mois, src.periodes);
    const dateProchaineOperation = prochaineDateTheorique(dateReference, src.jours, src.mois, src.periodes);
    const garantieJours = differenceInCalendarDays(dateProchaineOperation, dateReference);

    // Durée de garantie — en mois si l'échéance tombe sur un nombre entier de mois, sinon modulo 30
    const garantieMoisComputed = Math.max(1, Math.round((garantieJours / 30) * 10) / 10);
    const moisEntiers = Math.floor(garantieJours / 30);
    const joursRestants = garantieJours % 30;
    let garantieDureeLabel: string;
    if (freq.mois && dateProchaineOperation.getTime() === addMonths(dateReference, freq.mois).getTime()) {
      garantieDureeLabel = `${freq.mois} mois`;
    } else if (moisEntiers === 0) {
      garantieDureeLabel = `${joursRestants} jour${joursRestants > 1 ? 's' : ''}`;
    } else if (joursRestants === 0) {
      garantieDureeLabel = `${moisEntiers} mois`;
    } else {
      garantieDureeLabel = `${moisEntiers} mois et ${joursRestants} jour${joursRestants > 1 ? 's' : ''}`;
    }

    // Site concerné par l'intervention
    const siteNom = intervention.site?.nom ?? null;
    const siteAdresse = [intervention.site?.adresse, intervention.site?.codePostal, intervention.site?.ville]
      .filter(Boolean).join(', ') || null;

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
      fileName: [
        kind === 'garantie' ? 'Attestation_Garantie' : kind === 'controle' ? 'Attestation_Controle' : 'Attestation_Passage',
        safeFileName(clientNom),
        intervention.site ? safeFileName(intervention.site.nom) : null,
        format(dateReference, 'dd-MM-yyyy'),
      ].filter(Boolean).join('_') + '.pdf',
      contratId: intervention.contrat?.id ?? null,
      values: {
        ville,
        dateReferenceFr: vars.date_reference_fr,
        operationsLabel,
        clientNom,
        clientDisplayName,
        prestataireNom,
        garantieMois: garantieMoisComputed,
        garantieMoisLabel: formatMoisLabel(garantieMoisComputed),
        garantieDureeLabel,
        garantieJours,
        garantieJoursLabel: String(garantieJours),
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
        siteNom,
        siteAdresse,
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

    if (!data.contratId) {
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
      where: { id: data.contratId },
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
