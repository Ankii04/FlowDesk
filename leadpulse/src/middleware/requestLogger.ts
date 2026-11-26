import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────
// Request Logger Middleware
// Attaches a unique requestId to every request
// Logs: method, path, status, latency, ip
// ─────────────────────────────────────────────
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Attach requestId so it can be used in controllers/services
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Log when the response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel](`${req.method} ${req.originalUrl}`, {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}
