import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from './event-bus.service';
import { OutboxService } from '../outbox/outbox.service';

describe('EventBusService', () => {
  let service: EventBusService;
  let outboxService: OutboxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        {
          provide: OutboxService,
          useValue: {
            publishEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
          },
        },
      ],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
    outboxService = module.get<OutboxService>(OutboxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should persist the event via the outbox before emitting it on the stream', async () => {
      await service.publish('order.created', 'DOMAIN', { orderId: 'o-1' });

      expect(outboxService.publishEvent).toHaveBeenCalledWith(
        'order.created',
        'DOMAIN',
        { orderId: 'o-1' },
        undefined,
      );
    });

    it('should forward an optional transaction handle to the outbox service', async () => {
      const tx = {};
      await service.publish('order.cancelled', 'INTEGRATION', { orderId: 'o-2' }, tx);

      expect(outboxService.publishEvent).toHaveBeenCalledWith(
        'order.cancelled',
        'INTEGRATION',
        { orderId: 'o-2' },
        tx,
      );
    });

    it('should emit the published event on stream$ for subscribers', async () => {
      const received: any[] = [];
      const sub = service.stream$.subscribe((evt) => received.push(evt));

      await service.publish('customer.updated', 'DOMAIN', { customerId: 'c-1' });

      expect(received).toEqual([{ name: 'customer.updated', payload: { customerId: 'c-1' } }]);
      sub.unsubscribe();
    });

    it('should not emit on the stream if the outbox write fails', async () => {
      (outboxService.publishEvent as jest.Mock).mockRejectedValue(new Error('db down'));
      const received: any[] = [];
      const sub = service.stream$.subscribe((evt) => received.push(evt));

      await expect(service.publish('order.created', 'DOMAIN', {})).rejects.toThrow('db down');

      expect(received).toHaveLength(0);
      sub.unsubscribe();
    });
  });
});
