import { Injectable } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { ConfigService } from '../../../config/config.service';
import Redis from 'ioredis';

export interface HealthStatus {
  api: string;
  database: string;
  redis: string;
  version: string;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  async check(): Promise<HealthStatus> {
    let databaseStatus = 'DOWN';
    let redisStatus = 'DOWN';

    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'UP';
    } catch {
      // Database connection failed
    }

    try {
      const redis = new Redis(this.configService.redisUrl, {
        lazyConnect: true,
        connectTimeout: 1000,
      });
      await redis.connect();
      const ping = await redis.ping();
      if (ping === 'PONG') redisStatus = 'UP';
      await redis.quit();
    } catch {
      // Redis connection failed
    }

    return {
      api: 'UP',
      database: databaseStatus,
      redis: redisStatus,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
