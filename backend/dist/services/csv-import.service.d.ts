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
export declare const csvService: {
    /**
     * Parse un fichier CSV
     */
    parseCSV(content: string): any[];
    /**
     * Preview import clients
     */
    previewClients(content: string): Promise<ImportResult>;
    /**
     * Import clients
     */
    importClients(content: string): Promise<ImportResult>;
    /**
     * Preview import contrats
     */
    previewContrats(content: string): Promise<ImportResult>;
    /**
     * Import contrats
     */
    importContrats(content: string, userId: string): Promise<ImportResult>;
    /**
     * Preview import interventions
     */
    previewInterventions(content: string): Promise<ImportResult>;
    /**
     * Import interventions
     */
    importInterventions(content: string, userId: string): Promise<ImportResult>;
    /**
     * Export clients en CSV
     */
    exportClients(): Promise<string>;
    /**
     * Export contrats en CSV
     */
    exportContrats(): Promise<string>;
    /**
     * Export interventions en CSV
     */
    exportInterventions(filters?: {
        dateDebut?: Date;
        dateFin?: Date;
    }): Promise<string>;
};
export default csvService;
//# sourceMappingURL=csv-import.service.d.ts.map