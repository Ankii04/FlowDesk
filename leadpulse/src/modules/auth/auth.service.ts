import bcrypt from 'bcryptjs';
import { authRepository } from './auth.repository';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { Errors } from '../../middleware/errorHandler';
import { authLogger } from '../../utils/logger';
import { LoginDto, RefreshTokenDto } from './auth.dto';

export class AuthService {
  /**
   * Login user and generate tokens
   */
  async login(data: LoginDto, metadata: { userAgent?: string; ipAddress?: string }) {
    const user = await authRepository.findByEmail(data.email);

    if (!user || !user.isActive) {
      authLogger.warn(`Failed login attempt for email: ${data.email}`);
      throw Errors.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      authLogger.warn(`Invalid password for user: ${data.email}`);
      throw Errors.unauthorized('Invalid email or password');
    }

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = signRefreshToken(user.id);
    
    // Set refresh token expiry (7 days from config or default)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await authRepository.createRefreshToken({
      token: refreshToken,
      userId: user.id,
      expiresAt,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
    });

    authLogger.info(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token using a valid refresh token
   */
  async refresh(data: RefreshTokenDto) {
    const storedToken = await authRepository.findValidRefreshToken(data.refreshToken);

    if (!storedToken) {
      throw Errors.unauthorized('Invalid or expired refresh token');
    }

    try {
      const { userId } = verifyRefreshToken(data.refreshToken);
      const user = await authRepository.findById(userId);

      if (!user || !user.isActive) {
        throw Errors.unauthorized('User not found or inactive');
      }

      // Rotate refresh token (optional but recommended for security)
      // Here we just issue a new access token
      const accessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return { accessToken };
    } catch (error) {
      throw Errors.unauthorized('Invalid refresh token');
    }
  }

  /**
   * Logout user by revoking the refresh token
   */
  async logout(token: string) {
    await authRepository.revokeRefreshToken(token);
    authLogger.info('User logged out and token revoked');
  }
}

export const authService = new AuthService();
