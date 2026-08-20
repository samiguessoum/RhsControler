import { addDays, format } from 'date-fns';
import { prisma } from '../config/database.js';
const DEFAULT_BODY_TEMPLATE = 'En date du {{date_reference_fr}}, l’équipe technique de la société **{{prestataire_nom}}** a réalisé les opérations de {{operations_label}} au niveau de toutes les structures de **{{client_display_name}}**.';
const DEFAULT_BODY_TEMPLATE_CONTROLE = 'En date du {{date_reference_fr}}, l’équipe technique de la société **{{prestataire_nom}}** a réalisé une visite de contrôle au niveau de toutes les structures de **{{client_display_name}}**.';
function formatMoisLabel(value) {
    if (Number.isInteger(value))
        return String(value);
    return value.toFixed(1).replace('.', ',');
}
function safeFileName(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
function normalizeClientDisplayName(value) {
    return value.trim().replace(/^l['’]\s*/i, '');
}
function renderBodyTemplate(template, vars) {
    const rendered = template
        .replaceAll('{{date_reference_fr}}', vars.date_reference_fr)
        .replaceAll('{{prestataire_nom}}', vars.prestataire_nom)
        .replaceAll('{{operations_label}}', vars.operations_label)
        .replaceAll('{{client_display_name}}', vars.client_display_name);
    return ensureDefaultBoldMarkers(rendered, vars.prestataire_nom, vars.client_display_name);
}
function ensureDefaultBoldMarkers(body, prestataire, client) {
    let output = body;
    if (prestataire && !output.includes(`**${prestataire}**`)) {
        output = output.replace(prestataire, `**${prestataire}**`);
    }
    if (client && !output.includes(`**${client}**`)) {
        output = output.replace(client, `**${client}**`);
    }
    return output;
}
function convertBodyTextToTemplate(bodyText, vars) {
    const pairs = [
        [vars.date_reference_fr, '{{date_reference_fr}}'],
        [vars.prestataire_nom, '{{prestataire_nom}}'],
        [vars.operations_label, '{{operations_label}}'],
        [vars.client_display_name, '{{client_display_name}}'],
    ];
    pairs.sort((a, b) => b[0].length - a[0].length);
    let output = bodyText.trim();
    for (const [value, placeholder] of pairs) {
        if (!value)
            continue;
        output = output.split(value).join(placeholder);
    }
    return output;
}
export const attestationService = {
    async buildAttestationData(interventionId, options = {}) {
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
                        frequenceOperationsJours: true,
                        attestationMessageTemplate: true,
                        attestationControleMessageTemplate: true,
                        contratSites: {
                            select: {
                                siteId: true,
                                frequenceOperationsJours: true,
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
        // Date de référence = date de réalisation effective (pas la date planifiée)
        const dateReference = intervention.dateRealisee || intervention.datePrevue;
        const contratPrestations = intervention.contrat?.prestations || [];
        const operationsLabel = contratPrestations.length > 0
            ? contratPrestations.join(', ')
            : (intervention.prestation?.trim() || 'prestation technique');
        // Fréquence en jours : depuis le ContratSite du site concerné, sinon contrat
        let frequenceJours = null;
        if (intervention.siteId && intervention.contrat?.contratSites) {
            const cs = intervention.contrat.contratSites.find((s) => s.siteId === intervention.siteId);
            if (cs?.frequenceOperationsJours)
                frequenceJours = cs.frequenceOperationsJours;
        }
        if (frequenceJours == null && intervention.contrat?.frequenceOperationsJours) {
            frequenceJours = intervention.contrat.frequenceOperationsJours;
        }
        // Fallback : 30 jours
        const garantieJours = frequenceJours ?? 30;
        // Date de prochaine opération = date de réalisation effective + fréquence en jours
        const dateProchaineOperation = addDays(dateReference, garantieJours);
        // Compatibilité : conserver garantieMois (arrondi) pour les anciens champs
        const garantieMoisComputed = Math.max(1, Math.round((garantieJours / 30) * 10) / 10);
        const vars = {
            date_reference_fr: format(dateReference, 'dd/MM/yyyy'),
            prestataire_nom: prestataireNom,
            operations_label: operationsLabel,
            client_display_name: clientDisplayName,
        };
        const bodyTemplate = kind === 'controle'
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
                garantieJours,
                garantieJoursLabel: String(garantieJours),
                dateProchaineOperationFr: format(dateProchaineOperation, 'dd/MM/yyyy'),
                bodyTemplate,
                bodyText,
                title: kind === 'garantie'
                    ? 'ATTESTATION DE GARANTIE'
                    : kind === 'controle'
                        ? 'ATTESTATION DE VISITE DE CONTRÔLE'
                        : 'ATTESTATION DE PASSAGE',
                showSignatures: kind !== 'garantie',
                showGuaranteeSection: kind !== 'controle',
            },
        };
    },
    async getBodyConfig(interventionId, options = {}) {
        const data = await this.buildAttestationData(interventionId, options);
        return {
            bodyText: data.values.bodyText,
            hasCustomTemplate: data.values.bodyTemplate !== (options.kind === 'controle' ? DEFAULT_BODY_TEMPLATE_CONTROLE : DEFAULT_BODY_TEMPLATE),
        };
    },
    async saveBodyTemplate(interventionId, bodyText, options = {}) {
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
        const vars = {
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
//# sourceMappingURL=attestation.service.js.map