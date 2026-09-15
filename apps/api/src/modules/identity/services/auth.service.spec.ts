import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigService } from '../../../config/config.service';
import { AccountLockedException } from '../../../common/exceptions/account-locked.exception';
import * as bcrypt from 'bcrypt';

const mockUserRepository = {
  findByUsername: jest.fn(),
  findById: jest.fn(),
  incrementFailedAttempts: jest.fn(),
  resetFailedAttempts: jest.fn(),
  lockAccount: jest.fn(),
  update: jest.fn(),
};

const mockSessionRepository = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  deleteById: jest.fn(),
  deleteAllByUserId: jest.fn(),
};

const mockRefreshTokenRepository = {
  create: jest.fn(),
  findByToken: jest.fn(),
  revokeToken: jest.fn(),
  revokeAllByUserId: jest.fn(),
  findAllActiveByUserId: jest.fn(),
};

const mockLoginHistoryRepository = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  countByUserId: jest.fn(),
};

const mockSecurityLogRepository = {
  create: jest.fn(),
};

const mockPasswordResetTokenRepository = {
  create: jest.fn(),
  findByToken: jest.fn(),
  revokeAll: jest.fn(),
};

jest.mock('@cc-erp/database', () => ({
  UserRepository: jest.fn().mockImplementation(() => mockUserRepository),
  SessionRepository: jest.fn().mockImplementation(() => mockSessionRepository),
  RefreshTokenRepository: jest.fn().mockImplementation(() => mockRefreshTokenRepository),
  LoginHistoryRepository: jest.fn().mockImplementation(() => mockLoginHistoryRepository),
  SecurityLogRepository: jest.fn().mockImplementation(() => mockSecurityLogRepository),
  PasswordResetTokenRepository: jest.fn().mockImplementation(() => mockPasswordResetTokenRepository),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  const originalNodeEnv = process.env.NODE_ENV;

  const baseUser = {
    id: 'user-1',
    username: 'jdoe',
    passwordHash: 'hashed-password',
    fullName: 'John Doe',
    email: 'jdoe@example.com',
    branchId: 'branch-1',
    isActive: true,
    lockedUntil: null,
    failedLoginAttempts: 0,
    userRoles: [{ role: { name: 'OWNER' } }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockConfigService = {
      jwtSecret: 'access-secret',
      jwtRefreshSecret: 'refresh-secret',
      jwtAccessExpiresIn: '15m',
      jwtRefreshExpiresIn: '7d',
      maxFailedLoginAttempts: 5,
      accountLockDurationMinutes: 30,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn() },
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService) as any;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should reject an unknown username', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockSecurityLogRepository.create.mockResolvedValue({});

      await expect(
        service.login({ username: 'ghost', password: 'whatever1!' })
      ).rejects.toThrow(UnauthorizedException);

      expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVALID_USERNAME' })
      );
    });

    it('should reject login when the account is locked', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({
        ...baseUser,
        lockedUntil: new Date(Date.now() + 60 * 60 * 1000),
      });
      mockLoginHistoryRepository.create.mockResolvedValue({});

      await expect(
        service.login({ username: 'jdoe', password: 'wrong' })
      ).rejects.toThrow(AccountLockedException);

      expect(mockLoginHistoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED_LOCKED' })
      );
    });

    it('should reject an invalid password and increment failed attempts', async () => {
      mockUserRepository.findByUsername
        .mockResolvedValueOnce({ ...baseUser })
        .mockResolvedValueOnce({ ...baseUser, failedLoginAttempts: 2 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockUserRepository.incrementFailedAttempts.mockResolvedValue({});
      mockLoginHistoryRepository.create.mockResolvedValue({});

      await expect(
        service.login({ username: 'jdoe', password: 'wrong-pass' })
      ).rejects.toThrow(UnauthorizedException);

      expect(mockUserRepository.incrementFailedAttempts).toHaveBeenCalledWith('user-1');
      expect(mockUserRepository.lockAccount).not.toHaveBeenCalled();
    });

    it('should lock the account once max failed attempts is reached', async () => {
      mockUserRepository.findByUsername
        .mockResolvedValueOnce({ ...baseUser })
        .mockResolvedValueOnce({ ...baseUser, failedLoginAttempts: 5 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockUserRepository.incrementFailedAttempts.mockResolvedValue({});
      mockUserRepository.lockAccount.mockResolvedValue({});
      mockLoginHistoryRepository.create.mockResolvedValue({});
      mockSecurityLogRepository.create.mockResolvedValue({});

      await expect(
        service.login({ username: 'jdoe', password: 'wrong-pass' })
      ).rejects.toThrow(AccountLockedException);

      expect(mockUserRepository.lockAccount).toHaveBeenCalledWith('user-1', expect.any(Date));
      expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ACCOUNT_LOCKED' })
      );
    });

    it('should reject login for an inactive account with a valid password', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({ ...baseUser, isActive: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ username: 'jdoe', password: 'correct-pass' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should issue access + refresh tokens and reset failed attempts on success', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({ ...baseUser });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.resetFailedAttempts.mockResolvedValue({});
      jwtService.sign
        .mockReturnValueOnce('access-token-1')
        .mockReturnValueOnce('refresh-token-1');
      mockRefreshTokenRepository.create.mockResolvedValue({});
      mockSessionRepository.create.mockResolvedValue({});
      mockLoginHistoryRepository.create.mockResolvedValue({});

      const result = await service.login(
        { username: 'jdoe', password: 'correct-pass' },
        '127.0.0.1',
        'jest-agent'
      );

      expect(mockUserRepository.resetFailedAttempts).toHaveBeenCalledWith('user-1');
      expect(result.accessToken).toBe('access-token-1');
      expect(result.refreshToken).toBe('refresh-token-1');
      expect(result.user).toEqual(
        expect.objectContaining({ id: 'user-1', username: 'jdoe', roles: ['OWNER'] })
      );
      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', token: 'refresh-token-1' })
      );
      expect(mockLoginHistoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUCCESS' })
      );
    });
  });

  describe('refresh', () => {
    it('should reject when the stored refresh token does not exist', async () => {
      mockRefreshTokenRepository.findByToken.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'missing' })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should reject an already-revoked refresh token', async () => {
      mockRefreshTokenRepository.findByToken.mockResolvedValue({
        token: 'used-token',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 1000000),
      });

      await expect(service.refresh({ refreshToken: 'used-token' })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should reject an expired refresh token', async () => {
      mockRefreshTokenRepository.findByToken.mockResolvedValue({
        token: 'expired-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh({ refreshToken: 'expired-token' })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should revoke the token as a security measure when JWT verification fails', async () => {
      mockRefreshTokenRepository.findByToken.mockResolvedValue({
        token: 'bad-sig-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
      });
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      mockRefreshTokenRepository.revokeToken.mockResolvedValue(undefined);

      await expect(service.refresh({ refreshToken: 'bad-sig-token' })).rejects.toThrow(
        UnauthorizedException
      );
      expect(mockRefreshTokenRepository.revokeToken).toHaveBeenCalledWith('bad-sig-token');
    });

    it('should rotate the refresh token: revoke the old one and issue a new one (single-use)', async () => {
      mockRefreshTokenRepository.findByToken.mockResolvedValue({
        token: 'old-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
      });
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      mockUserRepository.findById.mockResolvedValue({ ...baseUser, branch: { organizationId: 'org-1' } });
      mockRefreshTokenRepository.revokeToken.mockResolvedValue(undefined);
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockRefreshTokenRepository.create.mockResolvedValue({});

      const result = await service.refresh({ refreshToken: 'old-token' });

      expect(mockRefreshTokenRepository.revokeToken).toHaveBeenCalledWith('old-token');
      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', token: 'new-refresh-token' })
      );
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should reject when the user tied to the token no longer exists or is inactive', async () => {
      mockRefreshTokenRepository.findByToken.mockResolvedValue({
        token: 'old-token',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
      });
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'old-token' })).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token and clear all sessions', async () => {
      mockRefreshTokenRepository.revokeToken.mockResolvedValue(undefined);
      mockSessionRepository.deleteAllByUserId.mockResolvedValue(undefined);

      const result = await service.logout('user-1', { refreshToken: 'token-1' });

      expect(mockRefreshTokenRepository.revokeToken).toHaveBeenCalledWith('token-1');
      expect(mockSessionRepository.deleteAllByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ loggedOut: true });
    });
  });

  describe('forgotPassword', () => {
    it('should not reveal whether the username exists', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);

      const result = await service.forgotPassword({ username: 'ghost' });

      expect(result).toEqual({
        message: 'If that username exists, a reset token has been generated.',
      });
      expect(mockPasswordResetTokenRepository.create).not.toHaveBeenCalled();
    });

    it('should generate and return a reset token in development for a valid user', async () => {
      process.env.NODE_ENV = 'development';
      mockUserRepository.findByUsername.mockResolvedValue({ ...baseUser });
      mockPasswordResetTokenRepository.create.mockResolvedValue('generated-token');

      const result = await service.forgotPassword({ username: 'jdoe' });

      expect(mockPasswordResetTokenRepository.create).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(
        expect.objectContaining({ resetToken: 'generated-token' })
      );
    });
  });

  describe('resetPassword', () => {
    it('should reject an invalid, used, or expired token', async () => {
      mockPasswordResetTokenRepository.findByToken.mockResolvedValue({
        userId: 'user-1',
        isUsed: true,
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        service.resetPassword({ token: 'bad', newPassword: 'NewPass1!' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an expired but unused token', async () => {
      mockPasswordResetTokenRepository.findByToken.mockResolvedValue({
        userId: 'user-1',
        isUsed: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword({ token: 'expired', newPassword: 'NewPass1!' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reset the password, invalidate all reset tokens, and force re-login on success', async () => {
      mockPasswordResetTokenRepository.findByToken.mockResolvedValue({
        userId: 'user-1',
        isUsed: false,
        expiresAt: new Date(Date.now() + 100000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockUserRepository.update.mockResolvedValue({});
      mockPasswordResetTokenRepository.revokeAll.mockResolvedValue({ count: 1 });
      mockRefreshTokenRepository.revokeAllByUserId.mockResolvedValue(undefined);
      mockSessionRepository.deleteAllByUserId.mockResolvedValue(undefined);
      mockSecurityLogRepository.create.mockResolvedValue({});

      const result = await service.resetPassword({ token: 'valid', newPassword: 'NewPass1!' });

      expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', {
        passwordHash: 'new-hashed-password',
      });
      expect(mockPasswordResetTokenRepository.revokeAll).toHaveBeenCalledWith('user-1');
      expect(mockRefreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('user-1');
      expect(mockSessionRepository.deleteAllByUserId).toHaveBeenCalledWith('user-1');
      expect(result.message).toMatch(/successfully reset/i);
    });
  });
});
