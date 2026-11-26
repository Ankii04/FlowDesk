import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { Errors } from './errorHandler';
import { Role } from '@prisma/client';
import { JwtPayload } from '../utils/jwt';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authenticate Middleware
 * Verifies the Bearer token in the Authorization header
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(Errors.unauthorized('Authentication token missing or invalid'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return next(Errors.unauthorized('Invalid or expired token'));
  }
};

/**
 * Authorize Middleware
 * Checks if the authenticated user has one of the required roles
 */
export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(Errors.unauthorized());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(Errors.forbidden('You do not have permission to perform this action'));
    }

    next();
  };
};
