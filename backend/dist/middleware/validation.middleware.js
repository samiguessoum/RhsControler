import { ZodError } from 'zod';
export function validate(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const errors = error.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                res.status(400).json({
                    error: 'Données invalides',
                    details: errors,
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            next(error);
        }
    };
}
export function validateQuery(schema) {
    return (req, res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const errors = error.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                res.status(400).json({
                    error: 'Paramètres invalides',
                    details: errors,
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            next(error);
        }
    };
}
export function validateParams(schema) {
    return (req, res, next) => {
        try {
            req.params = schema.parse(req.params);
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const errors = error.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                res.status(400).json({
                    error: 'Paramètres URL invalides',
                    details: errors,
                    timestamp: new Date().toISOString(),
                });
                return;
            }
            next(error);
        }
    };
}
//# sourceMappingURL=validation.middleware.js.map