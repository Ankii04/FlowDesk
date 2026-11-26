import Redis from 'ioredis';
import { config } from './env';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────
// Redis Connection Options
// Used by both the app cache layer AND BullMQ queues
// ─────────────────────────────────────────────
const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
  maxRetriesPerRequest: null, // Required by BullMQ
  retryStrategy: (times: number) => {
    if (times > 5) {
      logger.error('[Redis] Max reconnection attempts reached. Giving up.');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 1000, 5000);
    logger.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
};

// ─────────────────────────────────────────────
// Main Redis client — for caching, pub/sub
// ─────────────────────────────────────────────
export const redisClient = new Redis(redisOptions);

redisClient.on('connect', () => {
  logger.info('[Redis] Connected to Redis server');
});

redisClient.on('error', (err) => {
  logger.error('[Redis] Connection error', { error: err.message });
});

redisClient.on('close', () => {
  logger.warn('[Redis] Connection closed');
});

// ─────────────────────────────────────────────
// BullMQ connection — separate client
// BullMQ requires maxRetriesPerRequest: null
// ─────────────────────────────────────────────
export const bullmqRedisConnection = new Redis(redisOptions);

bullmqRedisConnection.on('connect', () => {
  logger.info('[Redis] BullMQ connection established');
});

bullmqRedisConnection.on('error', (err) => {
  logger.error('[Redis] BullMQ connection error', { error: err.message });
});

/**
 * Gracefully close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  await redisClient.quit();
  await bullmqRedisConnection.quit();
  logger.info('[Redis] All Redis connections closed');
}
