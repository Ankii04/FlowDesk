import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Validates that a required env variable exists.
 * Crashes at startup if missing — fail fast principle.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

// ─────────────────────────────────────────────
// Exported config object — single source of truth
// ─────────────────────────────────────────────
export const config = {
  server: {
    env: getEnv('NODE_ENV', 'development'),
    port: getEnvNumber('PORT', 3000),
    apiPrefix: getEnv('API_PREFIX', '/api/v1'),
    isDev: getEnv('NODE_ENV', 'development') === 'development',
    isProd: getEnv('NODE_ENV', 'development') === 'production',
  },

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379),
    password: getEnv('REDIS_PASSWORD', ''),
    db: getEnvNumber('REDIS_DB', 0),
  },

  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    accessExpiresIn: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  logging: {
    level: getEnv('LOG_LEVEL', 'debug'),
    dir: getEnv('LOG_DIR', './logs'),
  },

  sla: {
    firstResponseMinutes: getEnvNumber('SLA_FIRST_RESPONSE_MINUTES', 30),
    followUpHours: getEnvNumber('SLA_FOLLOW_UP_HOURS', 24),
    inactivityHours: getEnvNumber('SLA_INACTIVITY_HOURS', 48),
  },

  bullmq: {
    workerConcurrency: getEnvNumber('WORKER_CONCURRENCY', 5),
    jobAttempts: getEnvNumber('JOB_ATTEMPTS', 3),
    jobBackoffDelay: getEnvNumber('JOB_BACKOFF_DELAY', 5000),
  },
} as const;

export type Config = typeof config;
