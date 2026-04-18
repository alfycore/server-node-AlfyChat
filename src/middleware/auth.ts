import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppConfig } from '../config';

export interface AuthRequest extends Request {
  user?: { userId: string; username: string };
}

// timing-safe comparison pour éviter un side-channel temporel sur INTERNAL_SECRET.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function createAuthMiddleware(config: AppConfig) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Try JWT Bearer token first
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; username: string };
        req.user = decoded;
        return next();
      } catch {
        // Invalid JWT — reject immediately, do not fall through
        res.status(401).json({ error: 'Token invalide' });
        return;
      }
    }

    // Fallback: x-user-id header pour les requêtes proxifiées par le gateway.
    // OBLIGATOIRE : présenter `x-internal-secret` correspondant à config.internalSecret.
    // Sans ce secret, un attaquant avec accès réseau au port du node pourrait
    // se faire passer pour n'importe quel utilisateur.
    const userId = req.headers['x-user-id'] as string | undefined;
    const providedSecret = req.headers['x-internal-secret'] as string | undefined;
    if (userId) {
      if (!config.internalSecret || !providedSecret || !safeEqual(providedSecret, config.internalSecret)) {
        res.status(401).json({ error: 'Authentification interne invalide' });
        return;
      }
      req.user = { userId, username: (req.headers['x-username'] as string) || userId };
      return next();
    }

    // No credentials supplied — reject
    res.status(401).json({ error: 'Authentification requise' });
  };
}
