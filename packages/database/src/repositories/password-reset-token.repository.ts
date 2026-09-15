import { prisma } from '../client/index';
import { randomBytes } from 'crypto';

const RESET_TOKEN_EXPIRY_HOURS = 2;

export class PasswordResetTokenRepository {
  /** Generate a secure random token and persist it */
  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId, token, expiresAt },
    });

    return token;
  }

  async findByToken(token: string): Promise<(import('../client/index').PasswordResetToken & { user: import('../client/index').User }) | null> {
    return prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    }) as any;
  }

  async markUsed(token: string): Promise<import('../client/index').PasswordResetToken> {
    return prisma.passwordResetToken.update({
      where: { token },
      data: { isUsed: true },
    });
  }

  /** Invalidate all pending reset tokens for a user (e.g., after successful reset) */
  async revokeAll(userId: string): Promise<{ count: number }> {
    return prisma.passwordResetToken.updateMany({
      where: { userId, isUsed: false },
      data: { isUsed: true },
    });
  }

  /** Cleanup expired/used tokens */
  async deleteExpired(): Promise<{ count: number }> {
    return prisma.passwordResetToken.deleteMany({
      where: {
        OR: [{ isUsed: true }, { expiresAt: { lt: new Date() } }],
      },
    });
  }
}
