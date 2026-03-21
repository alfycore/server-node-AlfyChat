import { AppConfig } from './index';
import { logger } from '../utils/logger';

let redisClient: any = null;

export async function initializeRedis(config: AppConfig): Promise<any> {
  if (!config.redis.enabled) {
    logger.info('Redis désactivé — mode single-node');
    return null;
  }

  try {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      retryStrategy: (times: number) => Math.min(times * 500, 5000),
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err: Error) => {
      logger.warn(`Redis erreur: ${err.message}`);
    });

    redisClient.on('connect', () => {
      logger.info('Redis connecté');
    });

    // Test connection
    await redisClient.ping();
    return redisClient;
  } catch (err: any) {
    logger.warn(`Redis indisponible: ${err.message} — fonctionnement sans cache`);
    redisClient = null;
    return null;
  }
}

export function getRedis(): any {
  return redisClient;
}
