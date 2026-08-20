interface DocumentLigne {
    libelle: string;
    description?: string | null;
    quantite: number;
    unite?: string | null;
    prixUnitaireHT: number;
    tauxTVA: number;
    remisePct?: number | null;
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
}
interface DocumentBase {
    ref: string;
    client: {
        nomEntreprise: string;
        code?: string | null;
        siegeNom?: string | null;
        siegeAdresse?: string | null;
        siegeVille?: string | null;
        siegePays?: string | null;
        siegeRC?: string | null;
        siegeNIF?: string | null;
        siegeAI?: string | null;
        siegeNIS?: string | null;
        siegeNIN?: string | null;
    };
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    remiseGlobalPct?: number | null;
    remiseGlobalMontant?: number | null;
    devise?: string | null;
    notes?: string | null;
    conditions?: string | null;
    lignes: DocumentLigne[];
}
interface DevisDocument extends DocumentBase {
    dateDevis: Date;
    dateValidite?: Date | null;
    statut: string;
    typeDocument?: string | null;
    site?: {
        nom: string;
        ville?: string | null;
        adresse?: string | null;
    } | null;
}
interface CommandeDocument extends DocumentBase {
    dateCommande: Date;
    dateLivraisonSouhaitee?: Date | null;
    refBonCommandeClient?: string | null;
    statut: string;
    typeDocument?: string | null;
    site?: {
        nom: string;
        ville?: string | null;
        adresse?: string | null;
    } | null;
}
interface FactureDocument extends DocumentBase {
    dateFacture: Date;
    dateEcheance?: Date | null;
    statut: string;
    totalPaye: number;
    type?: string | null;
    typeDocument?: string | null;
    refBonCommandeClient?: string | null;
    mentionSpeciale?: string | null;
    dateOperation?: Date | null;
    site?: {
        nom: string;
        ville?: string | null;
        adresse?: string | null;
    } | null;
}
interface FournisseurInfo {
    nomEntreprise: string;
    code?: string | null;
    siegeAdresse?: string | null;
    siegeVille?: string | null;
    siegePays?: string | null;
    siegeRC?: string | null;
    siegeNIF?: string | null;
    siegeAI?: string | null;
    siegeNIS?: string | null;
    siegeNIN?: string | null;
    siegeTel?: string | null;
    siegeEmail?: string | null;
}
interface FactureFournisseurDocument {
    ref: string;
    fournisseur: FournisseurInfo;
    refFournisseur?: string | null;
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    remiseGlobalPct?: number | null;
    remiseGlobalMontant?: number | null;
    devise?: string | null;
    notes?: string | null;
    conditions?: string | null;
    lignes: DocumentLigne[];
    dateFacture: Date;
    dateEcheance?: Date | null;
    dateReception?: Date | null;
    statut: string;
    totalPaye: number;
}
interface CommandeFournisseurDocument extends DocumentBase {
    fournisseur: FournisseurInfo;
    dateCommande: Date;
    dateLivraisonSouhaitee?: Date | null;
    statut: string;
}
interface AttestationPassageDocument {
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
    bodyText: string;
    title: string;
    showSignatures: boolean;
    showGuaranteeSection: boolean;
}
export declare function getCompanySettings(): Promise<{
    name: string;
    address: string;
    city: string;
    pays: string;
    phone: string;
    email: string;
    website: string;
    nif: string;
    nis: string;
    rc: string;
    ai: string;
    nin: string;
    rib: string;
    compte: string;
    banque: string;
    capitalSocial: string;
    logoPath: string;
}>;
export declare function refreshCompanyInfo(): Promise<{
    name: string;
    address: string;
    city: string;
    pays: string;
    phone: string;
    email: string;
    website: string;
    nif: string;
    nis: string;
    rc: string;
    ai: string;
    nin: string;
    rib: string;
    compte: string;
    banque: string;
    capitalSocial: string;
    logoPath: string;
}>;
export declare function generateDevisPDF(devis: DevisDocument): Promise<Buffer>;
export declare function generateCommandePDF(commande: CommandeDocument): Promise<Buffer>;
export declare function generateFacturePDF(facture: FactureDocument): Promise<Buffer>;
export declare function generateCommandeFournisseurPDF(commande: CommandeFournisseurDocument): Promise<Buffer>;
export declare function generateFactureFournisseurPDF(facture: FactureFournisseurDocument): Promise<Buffer>;
export declare function generateAttestationPassagePDF(attestation: AttestationPassageDocument): Promise<Buffer>;
interface BonLivraisonClientDoc {
    nomEntreprise: string;
    code?: string | null;
    siegeAdresse?: string | null;
    siegeVille?: string | null;
    siegePays?: string | null;
    siegeRC?: string | null;
    siegeNIF?: string | null;
    siegeAI?: string | null;
    siegeNIS?: string | null;
    siegeNIN?: string | null;
}
interface BonLivraisonLigneDoc {
    libelle: string;
    description?: string | null;
    quantiteCommandee?: number;
    quantiteLivree: number;
    unite?: string | null;
    prixUnitaireHT: number;
    tauxTVA: number;
}
interface BonLivraisonDoc {
    ref: string;
    client: BonLivraisonClientDoc;
    commande?: {
        ref: string;
        refBonCommandeClient?: string | null;
        typeDocument?: string | null;
    } | null;
    site?: {
        nom: string;
        ville?: string | null;
        adresse?: string | null;
    } | null;
    dateBonLivraison: Date;
    dateLivraisonEffective?: Date | null;
    statut: string;
    notes?: string | null;
    lignes: BonLivraisonLigneDoc[];
    adresseLivraison?: {
        adresse?: string;
        ville?: string;
        codePostal?: string;
    } | null;
}
export declare function generateBonLivraisonPDF(bl: BonLivraisonDoc): Promise<Buffer>;
export {};
//# sourceMappingURL=pdf.service.d.ts.map