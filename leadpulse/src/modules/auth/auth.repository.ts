import { prisma } from '../../config/database';
import { User, RefreshToken, Role } from '@prisma/client';

export class AuthRepository {
  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  /**
   * Create a new refresh token
   */
  async createRefreshToken(data: {
    token: string;
    userId: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data });
  }

  /**
   * Find a valid (not revoked and not expired) refresh token
   */
  async findValidRefreshToken(token: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({
      where: {
        token,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token },
      data: { isRevoked: true },
    });
  }

  /**
   * Revoke all refresh tokens for a user (e.g., on password change or security breach)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }
}

export const authRepository = new AuthRepository();
