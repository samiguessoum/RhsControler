export declare class AppError extends Error {
    readonly statusCode: number;
    readonly details?: unknown | undefined;
    constructor(statusCode: number, message: string, details?: unknown | undefined);
}
//# sourceMappingURL=errors.d.ts.map