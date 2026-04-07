import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error(`Erreur: ${err.message || err}`);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Erreur interne du serveur';

  res.status(status).json({ error: message });
}
