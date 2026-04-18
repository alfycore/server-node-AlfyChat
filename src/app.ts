import express from 'express';
import cors from 'cors';
import { helmetMiddleware } from './middleware/helmet';
import { apiLimiter } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';
import { createAuthMiddleware } from './middleware/auth';
import { mountRoutes } from './routes';
import { AppConfig } from './config';

export function createApp(config: AppConfig, uploadsDir: string) {
  const app = express();

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:4000')
    .split(',').map((o) => o.trim());

  // ── Security & parsing ──
  app.use(helmetMiddleware);
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      // localhost n'est toléré qu'en dev (sinon: un site malveillant ouvert sur
      // http://localhost:XXXX chez l'utilisateur pourrait parler au node).
      if (!isProduction && /^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origine non autorisée — ${origin}`));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(apiLimiter);

  // ── Public routes (no auth) ──
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      serverId: config.gateway.serverId,
      port: config.server.port,
      gatewayUrl: config.gateway.url,
      dbType: config.db.type,
    });
  });

  // ── Auth middleware applied to all subsequent routes ──
  app.use(createAuthMiddleware(config));

  // ── REST routes ──
  mountRoutes(app);

  // ── Static uploads ──
  // Force tout fichier servi à être téléchargé (jamais rendu), empêche le sniffing MIME,
  // et bloque toute exécution de script via une CSP stricte côté ressource statique.
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      next();
    },
    express.static(uploadsDir),
  );

  // ── Error handler (must be last) ──
  app.use(errorHandler);

  return app;
}
