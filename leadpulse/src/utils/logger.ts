import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from '../config/env';

// ─────────────────────────────────────────────
// Custom log format
// Outputs: [2024-01-01 12:00:00] INFO  [context] message {meta}
// ─────────────────────────────────────────────
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}${stackStr}`;
  }),
);

// ─────────────────────────────────────────────
// JSON format for log files (machine-readable)
// ─────────────────────────────────────────────
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// ─────────────────────────────────────────────
// Transports
// ─────────────────────────────────────────────
const transports: winston.transport[] = [
  // Console — colored in dev, plain in prod
  new winston.transports.Console({
    format: config.server.isDev
      ? winston.format.combine(winston.format.colorize({ all: true }), logFormat)
      : logFormat,
  }),
];

// File transports — always active
const logDir = path.resolve(config.logging.dir);

// All logs (debug+)
transports.push(
  new DailyRotateFile({
    dirname: logDir,
    filename: 'app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    maxSize: '20m',
    format: jsonFormat,
    level: 'debug',
  }),
);

// Error-only logs
transports.push(
  new DailyRotateFile({
    dirname: logDir,
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '20m',
    format: jsonFormat,
    level: 'error',
  }),
);

// Worker-specific logs
transports.push(
  new DailyRotateFile({
    dirname: path.join(logDir, 'workers'),
    filename: 'worker-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    maxSize: '10m',
    format: jsonFormat,
    level: 'debug',
  }),
);

// ─────────────────────────────────────────────
// Logger instance
// ─────────────────────────────────────────────
export const logger = winston.createLogger({
  level: config.logging.level,
  transports,
  exitOnError: false,
});

// ─────────────────────────────────────────────
// Child loggers for specific contexts
// Usage: const workerLogger = createChildLogger('worker')
// Adds a "service" field to all log entries
// ─────────────────────────────────────────────
export function createChildLogger(service: string) {
  return logger.child({ service });
}

// Convenience loggers
export const workerLogger = createChildLogger('worker');
export const queueLogger = createChildLogger('queue');
export const socketLogger = createChildLogger('socket');
export const authLogger = createChildLogger('auth');
