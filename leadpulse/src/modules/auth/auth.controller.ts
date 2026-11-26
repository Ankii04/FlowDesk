import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess } from '../../utils/apiResponse';

export class AuthController {
  /**
   * Login handler
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      return sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh token handler
   */
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refresh(req.body);
      return sendSuccess(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout handler
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      return sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile (Me)
   */
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      // User is already attached to req by authenticate middleware
      return sendSuccess(res, req.user, 'Current user profile retrieved');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
