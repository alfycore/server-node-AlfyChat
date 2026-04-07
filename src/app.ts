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

  // ── Security & parsing ──
  app.use(helmetMiddleware);
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(apiLimiter);
  app.use(createAuthMiddleware(config));

  // ── REST routes ──
  mountRoutes(app);

  // ── Static uploads ──
  app.use('/uploads', express.static(uploadsDir));

  // ── Health check ──
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      serverId: config.gateway.serverId,
      port: config.server.port,
      gatewayUrl: config.gateway.url,
      dbType: config.db.type,
    });
  });

  // ── Error handler (must be last) ──
  app.use(errorHandler);

  return app;
}
