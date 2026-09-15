import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from './outbox.service';
import { prisma } from '@cc-erp/database';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    event: {
      create: jest.fn(),
    },
    eventQueue: {
      create: jest.fn(),
    },
  },
}));

describe('OutboxService', () => {
  let service: OutboxService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboxService],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishEvent', () => {
    it('should create an Event row and a corresponding PENDING EventQueue row', async () => {
      (prisma.event.create as jest.Mock).mockResolvedValue({ id: 'evt-1', name: 'order.created' });
      (prisma.eventQueue.create as jest.Mock).mockResolvedValue({ id: 'q-1' });

      const result = await service.publishEvent('order.created', 'DOMAIN', { orderId: 'o-1' });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: { name: 'order.created', type: 'DOMAIN', payload: { orderId: 'o-1' } },
      });
      expect(prisma.eventQueue.create).toHaveBeenCalledWith({
        data: { eventId: 'evt-1', status: 'PENDING' },
      });
      expect(result).toEqual({ id: 'evt-1', name: 'order.created' });
    });

    it('should use the provided transaction client instead of the default prisma client', async () => {
      const tx = {
        event: { create: jest.fn().mockResolvedValue({ id: 'evt-2' }) },
        eventQueue: { create: jest.fn().mockResolvedValue({ id: 'q-2' }) },
      };

      await service.publishEvent('order.cancelled', 'INTEGRATION', { orderId: 'o-2' }, tx);

      expect(tx.event.create).toHaveBeenCalled();
      expect(tx.eventQueue.create).toHaveBeenCalledWith({ data: { eventId: 'evt-2', status: 'PENDING' } });
      expect(prisma.event.create).not.toHaveBeenCalled();
      expect(prisma.eventQueue.create).not.toHaveBeenCalled();
    });
  });
});
