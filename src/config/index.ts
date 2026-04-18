import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

export interface AppConfig {
  server: {
    port: number;
    dataDir: string;
  };
  db: {
    type: 'mysql' | 'postgres' | 'sqlite';
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  redis: {
    enabled: boolean;
    host: string;
    port: number;
    password: string;
  };
  gateway: {
    url: string;
    serverId: string;
    nodeToken: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  internalSecret: string;
}

export function loadConfig(cliOptions?: Record<string, string>): AppConfig {
  const dataDir = path.resolve(
    cliOptions?.dataDir || process.env.DATA_DIR || './alfychat-data',
  );

  return {
    server: {
      port: parseInt(cliOptions?.port || process.env.PORT || '4100'),
      dataDir,
    },
    db: {
      type: (process.env.DB_TYPE as AppConfig['db']['type']) || 'sqlite',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || path.join(dataDir, 'server.db'),
      username: process.env.DB_USER || '',
      password: process.env.DB_PASS || '',
    },
    redis: {
      enabled: process.env.REDIS_ENABLED === 'true',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASS || '',
    },
    gateway: {
      url: cliOptions?.gateway || process.env.GATEWAY_URL || 'https://gateway.alfychat.app',
      serverId: cliOptions?.serverId || process.env.SERVER_ID || '',
      nodeToken: cliOptions?.token || process.env.NODE_TOKEN || '',
    },
    jwt: {
      secret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    // Secret partagé avec le gateway. Obligatoire pour que le fallback x-user-id
    // soit accepté — sinon un attaquant ayant accès au port du node pourrait
    // usurper n'importe quel utilisateur via un simple header.
    internalSecret: process.env.INTERNAL_SECRET || '',
  };
}
