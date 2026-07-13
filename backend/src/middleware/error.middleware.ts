import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import logger from '../lib/logger.js';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const timestamp = new Date().toISOString();

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path, method: req.method }, err.message);
    }
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined && { details: err.details }),
      timestamp,
    });
    return;
  }

  // Erreur inattendue
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erreur serveur interne' : err.message,
    timestamp,
  });
}
