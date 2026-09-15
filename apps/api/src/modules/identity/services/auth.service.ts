import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AccountLockedException } from '../../../common/exceptions/account-locked.exception';
import { JwtService } from '@nestjs/jwt';
import {
  UserRepository,
  SessionRepository,
  RefreshTokenRepository,
  LoginHistoryRepository,
  SecurityLogRepository,
  PasswordResetTokenRepository,
} from '@cc-erp/database';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { LogoutDto } from '../dto/logout.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ConfigService } from '../../../config/config.service';

@Injectable()
export class AuthService {
  private readonly userRepository = new UserRepository();
  private readonly sessionRepository = new SessionRepository();
  private readonly refreshTokenRepository = new RefreshTokenRepository();
  private readonly loginHistoryRepository = new LoginHistoryRepository();
  private readonly securityLogRepository = new SecurityLogRepository();
  private readonly passwordResetTokenRepository = new PasswordResetTokenRepository();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────────────
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.userRepository.findByUsername(loginDto.username);

    if (!user) {
      // Log failed attempt without userId
      await this.logSecurityEvent(null, 'INVALID_USERNAME', `Attempt for unknown username: ${loginDto.username}`, ipAddress, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const unlockTime = user.lockedUntil.toISOString();
      await this.loginHistoryRepository.create({
        userId: user.id,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        status: 'FAILED_LOCKED',
      });
      throw new AccountLockedException(`Account is locked until ${unlockTime}. Please try again later.`);
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed attempts
      await this.userRepository.incrementFailedAttempts(user.id);
      const updatedUser = await this.userRepository.findByUsername(user.username);
      const attempts = updatedUser?.failedLoginAttempts ?? 0;

      await this.loginHistoryRepository.create({
        userId: user.id,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        status: 'FAILED',
      });

      const maxAttempts = this.configService.maxFailedLoginAttempts;

      if (attempts >= maxAttempts) {
        const lockMinutes = this.configService.accountLockDurationMinutes;
        const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
        await this.userRepository.lockAccount(user.id, lockedUntil);
        await this.logSecurityEvent(
          user.id,
          'ACCOUNT_LOCKED',
          `Account locked after ${attempts} failed login attempts`,
          ipAddress,
          userAgent
        );
        throw new AccountLockedException(
          `Account locked for ${lockMinutes} minutes due to too many failed login attempts`
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive. Contact administrator.');
    }

    // Reset failed attempts on successful login
    await this.userRepository.resetFailedAttempts(user.id);

    const roles = user.userRoles.map((ur) => ur.role.name);
    const primaryRole = roles[0] ?? 'GUEST';

    // Derive scope from role: GLOBAL roles have no branch restriction
    const globalRoles = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'ACCOUNTANT'];
    const factoryRoles = ['FACTORY_MANAGER', 'PRODUCTION_MANAGER', 'CHEF', 'KDS_OPERATOR'];
    const scope = (user as any).scope ?? (
      globalRoles.includes(primaryRole) ? 'GLOBAL' :
      factoryRoles.includes(primaryRole) ? 'FACTORY' : 'BRANCH'
    );

    const organizationId = (user as any).organizationId ?? (user as any).branch?.organizationId;

    // Build JWT payload — drives ALL authorization decisions
    const payload = {
      sub: user.id,
      username: user.username,
      roles,
      role: primaryRole,
      branchId: user.branchId,
      organizationId,
      scope,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.jwtSecret,
      expiresIn: this.configService.jwtAccessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti: crypto.randomUUID() },
      {
        secret: this.configService.jwtRefreshSecret,
        expiresIn: this.configService.jwtRefreshExpiresIn,
      }
    );

    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sessionExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.refreshTokenRepository.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshExpiresAt,
    });

    await this.sessionRepository.create({
      userId: user.id,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt: sessionExpiresAt,
    });

    await this.loginHistoryRepository.create({
      userId: user.id,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      status: 'SUCCESS',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        branchId: user.branchId,
        roles,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // REFRESH TOKEN (with rotation — revoke-on-use)
  // ─────────────────────────────────────────────────────────────────────
  async refresh(dto: RefreshTokenDto) {
    const stored = await this.refreshTokenRepository.findByToken(dto.refreshToken);
    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.jwtRefreshSecret,
      });
    } catch {
      // Token failed cryptographic verification — revoke it as a security measure
      await this.refreshTokenRepository.revokeToken(dto.refreshToken);
      throw new UnauthorizedException('Refresh token verification failed');
    }

    const userById = await this.userRepository.findById(payload.sub);
    if (!userById || !userById.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // ── ROTATION: revoke old token immediately ──────────────────────────
    await this.refreshTokenRepository.revokeToken(dto.refreshToken);

    const roles = userById.userRoles.map((ur) => ur.role.name);
    const primaryRole = roles[0] ?? 'GUEST';
    const globalRoles = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'ACCOUNTANT'];
    const factoryRoles = ['FACTORY_MANAGER', 'PRODUCTION_MANAGER', 'CHEF', 'KDS_OPERATOR'];
    const scope = (userById as any).scope ?? (
      globalRoles.includes(primaryRole) ? 'GLOBAL' :
      factoryRoles.includes(primaryRole) ? 'FACTORY' : 'BRANCH'
    );

    const organizationId = (userById as any).organizationId ?? userById.branch?.organizationId;

    const newPayload = {
      sub: userById.id,
      username: userById.username,
      roles,
      role: primaryRole,
      branchId: userById.branchId,
      organizationId,
      scope,
    };

    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: this.configService.jwtSecret,
      expiresIn: this.configService.jwtAccessExpiresIn,
    });

    // Issue a fresh refresh token
    const newRefreshToken = this.jwtService.sign(
      { sub: userById.id, jti: crypto.randomUUID() },
      {
        secret: this.configService.jwtRefreshSecret,
        expiresIn: this.configService.jwtRefreshExpiresIn,
      }
    );

    await this.refreshTokenRepository.create({
      userId: userById.id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    };
  }


  // ─────────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────────
  async logout(userId: string, dto: LogoutDto) {
    await this.refreshTokenRepository.revokeToken(dto.refreshToken);
    await this.sessionRepository.deleteAllByUserId(userId);
    return { loggedOut: true };
  }

  // ─────────────────────────────────────────────────────────────────────
  // ME — Current user with roles + permissions
  // ─────────────────────────────────────────────────────────────────────
  async me(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.name)
    );

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      isActive: user.isActive,
      branch: user.branch
        ? { id: user.branch.id, name: user.branch.name }
        : null,
      roles,
      permissions: [...new Set(permissions)], // deduplicate
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // LOGIN HISTORY
  // ─────────────────────────────────────────────────────────────────────
  async getLoginHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.loginHistoryRepository.findByUserId(userId, { skip, take: limit }),
      this.loginHistoryRepository.countByUserId(userId),
    ]);
    return { items, total, page, limit };
  }

  // ─────────────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────
  async getSessions(userId: string) {
    const sessions = await this.sessionRepository.findByUserId(userId);
    return sessions.map((s: any) => ({
      id: s.id,
      ipAddress: s.ipAddress ?? null,
      userAgent: s.userAgent ?? null,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    // Only allow users to revoke their own sessions
    const sessions = await this.sessionRepository.findByUserId(userId);
    const owned = sessions.find((s: any) => s.id === sessionId);
    if (!owned) {
      throw new NotFoundException('Session not found or does not belong to this user');
    }
    await this.sessionRepository.deleteById(sessionId);
    return { revoked: true, sessionId };
  }

  async revokeOtherSessions(userId: string, currentRefreshToken: string) {
    // Revoke all refresh tokens for user except the current one
    const allTokens = await this.refreshTokenRepository.findAllActiveByUserId(userId);
    for (const t of allTokens) {
      if (t.token !== currentRefreshToken) {
        await this.refreshTokenRepository.revokeToken(t.token);
      }
    }
    // Delete all sessions (they are ephemeral)
    await this.sessionRepository.deleteAllByUserId(userId);
    return { revokedCount: allTokens.length - 1 };
  }

  // ─────────────────────────────────────────────────────────────────────
  // PASSWORD RESET FLOW
  // ─────────────────────────────────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepository.findByUsername(dto.username);
    // Never reveal whether user exists — always return the same response
    if (!user || !user.isActive) {
      return { message: 'If that username exists, a reset token has been generated.' };
    }

    const token = await this.passwordResetTokenRepository.create(user.id);

    // In development: return the token directly
    // In production: dispatch to NotificationService (email/WhatsApp)
    if (process.env.NODE_ENV === 'development') {
      return {
        message: 'Password reset token generated. Use this token to reset your password.',
        resetToken: token, // NEVER expose in production
        expiresIn: '2 hours',
      };
    }

    return { message: 'If that username exists, a reset token has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const stored = await this.passwordResetTokenRepository.findByToken(dto.token);
    if (!stored || stored.isUsed || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Reset token is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepository.update(stored.userId, { passwordHash });

    // Mark token used and invalidate all other tokens for this user
    await this.passwordResetTokenRepository.revokeAll(stored.userId);

    // Revoke all active sessions and refresh tokens (force re-login)
    await this.refreshTokenRepository.revokeAllByUserId(stored.userId);
    await this.sessionRepository.deleteAllByUserId(stored.userId);

    await this.logSecurityEvent(stored.userId, 'PASSWORD_RESET', 'Password was reset via token');

    return { message: 'Password successfully reset. Please log in with your new password.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepository.update(userId, { passwordHash });

    // Security: revoke all other sessions and tokens after password change
    await this.refreshTokenRepository.revokeAllByUserId(userId);
    await this.sessionRepository.deleteAllByUserId(userId);

    await this.logSecurityEvent(userId, 'PASSWORD_CHANGED', 'User changed their password');

    return { message: 'Password changed successfully. Please log in again.' };
  }

  // ─────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────────────
  private async logSecurityEvent(
    userId: string | null,
    action: string,
    details: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      await this.securityLogRepository.create({
        userId: userId || undefined,
        action,
        details,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      });
    } catch (e) {
      console.error('[AuthService] Failed to log security event', e);
    }
  }
}
