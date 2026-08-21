export declare const fieldReportService: {
    generateSiteHistoryReport(siteId: string, dateFrom: Date, dateTo: Date, generatedById: string): Promise<{
        id: string;
        createdAt: Date;
        siteId: string | null;
        dateDebut: Date | null;
        dateFin: Date | null;
        statut: import(".prisma/client").$Enums.FieldReportStatut;
        version: number;
        titre: string | null;
        conclusion: string | null;
        recommandations: string | null;
        pdfPath: string | null;
        xlsxPath: string | null;
        generatedAt: Date;
        fieldInterventionId: string | null;
        generatedById: string;
    }>;
};
export default fieldReportService;
//# sourceMappingURL=field-report.service.d.ts.map