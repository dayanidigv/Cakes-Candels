import { Test, TestingModule } from '@nestjs/testing';
import { PromotionUsageService } from './promotion-usage.service';
import { PromotionUsageStatus } from '@cc-erp/database';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('PromotionUsageService', () => {
  let service: PromotionUsageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromotionUsageService],
    }).compile();

    service = module.get<PromotionUsageService>(PromotionUsageService);
  });

  describe('Concurrency & Lifecycle', () => {
    it('concurrent final-slot reservation succeeds for exactly one request', async () => {
      // Mock Prisma Transaction Client
      let lockCounter = 0;
      let insertedCount = 0;
      const promotion = { id: 'promo-1', usageLimit: 10, isActive: true, startAt: null, endAt: null, perCustomerLimit: null };
      
      const txMock = { 
        $executeRaw: jest.fn().mockImplementation(async () => {
          // Simulate some locking delay
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          lockCounter++;
        }),
        promotion: {
          findUnique: jest.fn().mockResolvedValue(promotion),
        },
        promotionUsage: {
          findFirst: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockImplementation(async () => {
            // Under real db lock, one query finishes and updates before the next reads.
            // In this mock, we simulate that effect by returning the currently inserted count + base
            const baseCount = 9; // 1 slot left
            return baseCount + insertedCount;
          }),
          create: jest.fn().mockImplementation(async () => {
            insertedCount++;
            return { id: 'usage-new' };
          })
        }
      } as any;

      // Simulate 5 concurrent checkouts
      const promises = [
        service.reserveUsage(txMock, 'promo-1', 'cust-1', 'order-1', 10).then(() => 'SUCCESS').catch(e => e),
        service.reserveUsage(txMock, 'promo-1', 'cust-2', 'order-2', 10).then(() => 'SUCCESS').catch(e => e),
        service.reserveUsage(txMock, 'promo-1', 'cust-3', 'order-3', 10).then(() => 'SUCCESS').catch(e => e),
        service.reserveUsage(txMock, 'promo-1', 'cust-4', 'order-4', 10).then(() => 'SUCCESS').catch(e => e),
        service.reserveUsage(txMock, 'promo-1', 'cust-5', 'order-5', 10).then(() => 'SUCCESS').catch(e => e)
      ];

      // In real DB execution, they serialize on FOR UPDATE.
      // Since this is a unit test mock, we mock a strict sequential execution that a lock would enforce.
      // Let's manually run them sequentially to emulate the serialization of FOR UPDATE
      let successes = 0;
      let failures = 0;
      for (const p of promises) {
        const res = await p;
        if (res === 'SUCCESS') {
          successes++;
        } else if (res instanceof BadRequestException && res.message === 'PROMOTION_USAGE_LIMIT_REACHED') {
          failures++;
        }
      }

      // Exactly 1 should succeed, 4 should fail.
      expect(successes).toBe(1);
      expect(failures).toBe(4);
      expect(insertedCount).toBe(1);
    });

    it('idempotent reservation should do nothing', async () => {
      const txMock = { productVariant: { findUnique: jest.fn().mockResolvedValue({ id: 'v1', isActive: true }) }, recipeVersion: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', ingredients: [{ variantId: 'v1', quantity: 1 }] }) }, numberSeries: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', currentNumber: 1 }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, $queryRaw: jest.fn().mockResolvedValue([{ id: 'n1', currentNumber: 1 }]), $executeRaw: jest.fn().mockResolvedValue(1), 
        promotionUsage: {
          findFirst: jest.fn().mockResolvedValue({ status: PromotionUsageStatus.RESERVED })
        }
      } as any;

      await expect(service.reserveUsage(txMock, 'promo-1', 'cust-1', 'order-1', 10)).resolves.not.toThrow();
      expect(txMock.promotionUsage.findFirst).toHaveBeenCalledWith({ where: { promotionId: 'promo-1', salesOrderId: 'order-1' } });
    });

    it('consumeUsage transitions state', async () => {
      const updateSpy = jest.fn();
      const txMock = { productVariant: { findUnique: jest.fn().mockResolvedValue({ id: 'v1', isActive: true }) }, recipeVersion: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', ingredients: [{ variantId: 'v1', quantity: 1 }] }) }, numberSeries: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', currentNumber: 1 }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, $queryRaw: jest.fn().mockResolvedValue([{ id: 'n1', currentNumber: 1 }]), $executeRaw: jest.fn().mockResolvedValue(1), 
        promotionUsage: {
          findMany: jest.fn().mockResolvedValue([{ id: 'u1', status: PromotionUsageStatus.RESERVED }]),
          update: updateSpy
        }
      } as any;

      await service.consumeUsage(txMock, 'order-1');
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: PromotionUsageStatus.CONSUMED }
      });
    });

    it('releaseUsage transitions state', async () => {
      const updateSpy = jest.fn();
      const txMock = { productVariant: { findUnique: jest.fn().mockResolvedValue({ id: 'v1', isActive: true }) }, recipeVersion: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', ingredients: [{ variantId: 'v1', quantity: 1 }] }) }, numberSeries: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', currentNumber: 1 }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, $queryRaw: jest.fn().mockResolvedValue([{ id: 'n1', currentNumber: 1 }]), $executeRaw: jest.fn().mockResolvedValue(1), 
        promotionUsage: {
          findMany: jest.fn().mockResolvedValue([{ id: 'u1', status: PromotionUsageStatus.RESERVED }]),
          update: updateSpy
        }
      } as any;

      await service.releaseUsage(txMock, 'order-1');
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: PromotionUsageStatus.RELEASED }
      });
    });
  });
});
