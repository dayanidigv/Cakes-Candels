import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { ConfigService } from '../../../config/config.service';
import { prisma } from '@cc-erp/database';
import Redis from 'ioredis';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

const mockRedisInstance = {
  connect: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisInstance);
});

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedisInstance.connect.mockResolvedValue(undefined);
    mockRedisInstance.ping.mockResolvedValue('PONG');
    mockRedisInstance.quit.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: { redisUrl: 'redis://localhost:6379' },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should report UP for api/database/redis when both dependencies respond', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.check();

      expect(result.api).toBe('UP');
      expect(result.database).toBe('UP');
      expect(result.redis).toBe('UP');
      expect(result.version).toBe('1.0.0');
      expect(typeof result.timestamp).toBe('string');
      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('should report database DOWN when the query throws', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('connection refused'));

      const result = await service.check();

      expect(result.database).toBe('DOWN');
      expect(result.api).toBe('UP');
    });

    it('should report redis DOWN when connect throws', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      mockRedisInstance.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.check();

      expect(result.redis).toBe('DOWN');
    });

    it('should report redis DOWN when the ping response is not PONG', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      mockRedisInstance.ping.mockResolvedValue('WRONG');

      const result = await service.check();

      expect(result.redis).toBe('DOWN');
    });

    it('should construct the Redis client using the configured redisUrl', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      await service.check();

      expect(Redis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({ lazyConnect: true }),
      );
    });
  });
});
