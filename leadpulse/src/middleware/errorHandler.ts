import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config/env';

// ─────────────────────────────────────────────
// AppError — Custom Error class
// Use this throughout the app to throw structured errors
// ─────────────────────────────────────────────
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─────────────────────────────────────────────
// Common error factories
// ─────────────────────────────────────────────
export const Errors = {
  notFound: (resource: string) =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),

  unauthorized: (message = 'Authentication required') =>
    new AppError(message, 401, 'UNAUTHORIZED'),

  forbidden: (message = 'Access denied') =>
    new AppError(message, 403, 'FORBIDDEN'),

  badRequest: (message: string) =>
    new AppError(message, 400, 'BAD_REQUEST'),

  conflict: (message: string) =>
    new AppError(message, 409, 'CONFLICT'),

  internal: (message = 'Internal server error') =>
    new AppError(message, 500, 'INTERNAL_ERROR', false),
};

// ─────────────────────────────────────────────
// Standard API response shape
// ─────────────────────────────────────────────
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    stack?: string;
  };
}

// ─────────────────────────────────────────────
// Global Error Handler Middleware
// Must be registered LAST in Express middleware chain
// ─────────────────────────────────────────────
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string;

  // Determine if this is a known operational error
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError && err.code ? err.code : 'INTERNAL_ERROR';
  const message = isAppError ? err.message : 'An unexpected error occurred';

  // Log the error
  if (statusCode >= 500) {
    logger.error(`[ErrorHandler] ${err.message}`, {
      requestId,
      url: req.originalUrl,
      method: req.method,
      statusCode,
      stack: err.stack,
    });
  } else {
    logger.warn(`[ErrorHandler] ${err.message}`, {
      requestId,
      url: req.originalUrl,
      method: req.method,
      statusCode,
      code,
    });
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      requestId,
    },
  };

  // Include stack trace in development
  if (config.server.isDev && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

// ─────────────────────────────────────────────
// 404 Handler — for unmatched routes
// ─────────────────────────────────────────────
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND'));
}
