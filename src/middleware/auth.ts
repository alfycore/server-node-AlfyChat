import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppConfig } from '../config';

export interface AuthRequest extends Request {
  user?: { userId: string; username: string };
}

export function createAuthMiddleware(config: AppConfig) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    // Try JWT Bearer token first
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; username: string };
        req.user = decoded;
        return next();
      } catch {
        // Fall through to other methods
      }
    }

    // Fallback: x-user-id header (for gateway-proxied requests)
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
      req.user = { userId, username: (req.headers['x-username'] as string) || userId };
      return next();
    }

    // No auth — continue anyway (routes can check req.user themselves)
    next();
  };
}
