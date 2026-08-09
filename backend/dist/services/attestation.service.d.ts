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
        garantieJours: number;
        garantieJoursLabel: string;
        dateProchaineOperationFr: string;
        bodyTemplate: string;
        bodyText: string;
        title: string;
        showSignatures: boolean;
        showGuaranteeSection: boolean;
    };
};
export declare const attestationService: {
    buildAttestationData(interventionId: string, options?: BuildAttestationOptions): Promise<AttestationData>;
    getBodyConfig(interventionId: string, options?: BuildAttestationOptions): Promise<{
        bodyText: string;
        hasCustomTemplate: boolean;
    }>;
    saveBodyTemplate(interventionId: string, bodyText: string, options?: BuildAttestationOptions): Promise<{
        templateSaved: string;
    }>;
};
export default attestationService;
//# sourceMappingURL=attestation.service.d.ts.map