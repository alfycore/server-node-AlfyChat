import { PrismaClient } from '@prisma/client';
import { AppConfig } from './index';
import path from 'path';
import fs from 'fs';

let prisma: PrismaClient | null = null;

export async function initializeDatabase(config: AppConfig): Promise<PrismaClient> {
  const dbConfig = config.db;

  // Set DATABASE_URL env for Prisma
  if (dbConfig.type === 'sqlite') {
    const dbPath = dbConfig.database.endsWith('.db')
      ? dbConfig.database
      : path.join(config.server.dataDir, 'server.db');
    // Ensure parent directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    process.env.DATABASE_URL = `file:${dbPath}`;
  } else if (dbConfig.type === 'postgres') {
    process.env.DATABASE_URL = `postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
  } else {
    process.env.DATABASE_URL = `mysql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
  }

  prisma = new PrismaClient({
    log: process.env.LOG_LEVEL === 'debug' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });

  await prisma.$connect();

  return prisma;
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not initialized — call initializeDatabase() first');
  }
  return prisma;
}
