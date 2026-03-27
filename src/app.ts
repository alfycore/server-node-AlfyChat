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
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
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
  app.use('/uploads', express.static(uploadsDir));

  // ── Error handler (must be last) ──
  app.use(errorHandler);

  return app;
}
