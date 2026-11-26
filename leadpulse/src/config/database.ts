import { PrismaClient } from '@prisma/client';
import { config } from './env';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────
// Singleton Prisma Client
// In development, we attach it to `global` to prevent
// multiple instances during hot reloads (ts-node-dev restarts)
// ─────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    log: config.server.isDev
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
  });
};

export const prisma = global.__prisma ?? createPrismaClient();

if (config.server.isDev) {
  global.__prisma = prisma;

  // Log slow queries in development
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    if (e.duration > 200) {
      logger.warn(`[Prisma] Slow query (${e.duration}ms): ${e.query}`);
    }
  });

  prisma.$on('error' as never, (e: { message: string }) => {
    logger.error(`[Prisma] Error: ${e.message}`);
  });
}

/**
 * Connect to the database — called at server startup
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('[Database] PostgreSQL connected via Prisma');
  } catch (error) {
    logger.error('[Database] Failed to connect to PostgreSQL', { error });
    process.exit(1);
  }
}

/**
 * Disconnect from the database — called at server shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('[Database] PostgreSQL disconnected');
}
