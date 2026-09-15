import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { prisma } from '@cc-erp/database';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    notificationQueue: {
      create: jest.fn(),
    },
  },
}));

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendNotification', () => {
    it('should queue a PENDING notification with zero attempts', async () => {
      (prisma.notificationQueue.create as jest.Mock).mockResolvedValue({ id: 'ntf-1', status: 'PENDING' });

      const dto = { recipient: '9999999999', type: 'WHATSAPP' as const, content: 'Hello!' };
      const result = await service.sendNotification(dto);

      expect(prisma.notificationQueue.create).toHaveBeenCalledWith({
        data: {
          recipient: '9999999999',
          type: 'WHATSAPP',
          content: 'Hello!',
          status: 'PENDING',
          attempts: 0,
        },
      });
      expect(result).toEqual({ id: 'ntf-1', status: 'PENDING' });
    });

    it('should propagate database errors', async () => {
      (prisma.notificationQueue.create as jest.Mock).mockRejectedValue(new Error('db down'));

      await expect(
        service.sendNotification({ recipient: 'a@b.com', type: 'EMAIL', content: 'Hi' }),
      ).rejects.toThrow('db down');
    });
  });
});
