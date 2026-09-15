import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  private getEnvOrThrowIfProd(key: string, defaultValue: string): string {
    const value = process.env[key];
    const isProd = process.env.NODE_ENV === 'production';
    
    if (isProd && (!value || value === defaultValue)) {
      throw new Error(`CRITICAL: Environment variable ${key} must be explicitly set to a secure value in production.`);
    }
    
    return value || defaultValue;
  }

  get databaseUrl(): string {
    return process.env.DATABASE_URL || '';
  }

  get redisUrl(): string {
    return process.env.REDIS_URL || 'redis://localhost:6379';
  }

  get jwtSecret(): string {
    return this.getEnvOrThrowIfProd('JWT_SECRET', 'dev_access_secret_change_in_production');
  }

  get jwtRefreshSecret(): string {
    return this.getEnvOrThrowIfProd('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_in_production');
  }

  get paymentWebhookSecret(): string {
    const value = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!value) {
      throw new Error('CRITICAL: PAYMENT_WEBHOOK_SECRET environment variable is missing. Halting startup.');
    }
    return value;
  }

  get jwtAccessExpiresIn(): string {
    return process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  }

  get jwtRefreshExpiresIn(): string {
    return process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  }

  get port(): number {
    return Number(process.env.PORT) || 3000;
  }

  get maxFailedLoginAttempts(): number {
    return Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS) || 5;
  }

  get accountLockDurationMinutes(): number {
    return Number(process.env.ACCOUNT_LOCK_DURATION_MINUTES) || 30;
  }
}
