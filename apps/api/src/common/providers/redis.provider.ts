import { Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../../config/config.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const client = new Redis(configService.redisUrl, {
      lazyConnect: false,
      retryStrategy: (times: number) => Math.min(times * 200, 3000),
      maxRetriesPerRequest: 3,
    });

    client.on('error', (err: Error) => {
      console.warn('[Redis] Connection error:', err.message);
    });

    return client;
  },
};
