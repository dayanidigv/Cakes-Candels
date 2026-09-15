import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';
import { PromotionValidationService } from '../promotions/promotion-validation.service';
import { PromotionUsageService } from '../promotions/promotion-usage.service';
import { prisma, SalesOrderStatus } from '@cc-erp/database';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
  SalesOrderStatus: {
    DRAFT: 'DRAFT',
    PENDING_PAYMENT: 'PENDING_PAYMENT',
    CONFIRMED: 'CONFIRMED',
    PROCESSING: 'PROCESSING',
    READY_TO_FULFIL: 'READY_TO_FULFIL',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  }
}));

import { InventoryService } from '../../inventory/inventory.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let pricingService: PricingService;
  let validationService: PromotionValidationService;
  let usageService: PromotionUsageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PricingService,
          useValue: {
            resolveOrderPricing: jest.fn()
          }
        },
        {
          provide: PromotionValidationService,
          useValue: {
            validate: jest.fn()
          }
        },
        {
          provide: PromotionUsageService,
          useValue: {
            reserveUsage: jest.fn()
          }
        },
        {
          provide: InventoryService,
          useValue: {
            postTransaction: jest.fn()
          }
        }
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    pricingService = module.get<PricingService>(PricingService);
    validationService = module.get<PromotionValidationService>(PromotionValidationService);
    usageService = module.get<PromotionUsageService>(PromotionUsageService);
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should use transaction boundary to rollback on failure', async () => {
      // Mock pricing success
      (pricingService.resolveOrderPricing as jest.Mock).mockResolvedValue({
        subtotal: new Decimal(100),
        taxTotal: new Decimal(10),
        discountTotal: new Decimal(0),
        grandTotal: new Decimal(110),
        resolvedItems: []
      });

      // Mock transaction simulation where an internal call fails
      const txError = new Error('Transaction failure');
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        // If this throws, Prisma rolls back automatically
        throw txError;
      });

      await expect(service.createOrder('u1', 'org-id', {
        customerId: 'c1',
        branchId: 'b1',
        items: [{ variantId: 'v1', quantity: 1 }]
      })).rejects.toThrow('Transaction failure');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should validate and reserve promotion if coupon provided', async () => {
      // Mock pricing success
      (pricingService.resolveOrderPricing as jest.Mock).mockResolvedValue({
        subtotal: new Decimal(100),
        taxTotal: new Decimal(10),
        discountTotal: new Decimal(15),
        grandTotal: new Decimal(95),
        resolvedItems: []
      });

      // validationService is now in outer scope
      (validationService.validate as jest.Mock).mockResolvedValue({
        valid: true,
        promotionId: 'p1',
        calculatedDiscountAmount: 15
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = { 
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'n1', currentNumber: 1 }]), 
          $executeRaw: jest.fn().mockResolvedValue(1), 
          customer: { findUnique: jest.fn().mockResolvedValue({ id: 'c1' }) },
          branch: { findUnique: jest.fn().mockResolvedValue({ id: 'b1', organizationId: 'org-id' }) },
          numberSeries: { findFirst: jest.fn().mockResolvedValue(null) },
          salesOrder: { create: jest.fn().mockResolvedValue({ id: 'o1' }) }
        };
        return callback(txMock);
      });

      await service.createOrder('u1', 'org-id', {
        customerId: 'c1',
        branchId: 'b1',
        items: [{ variantId: 'v1', quantity: 1 }],
        couponCode: 'SAVE15'
      });

      expect(validationService.validate).toHaveBeenCalled();
      expect(usageService.reserveUsage).toHaveBeenCalledWith(
        expect.anything(),
        'p1',
        'c1',
        'o1',
        15
      );
    });
  });

  describe('transitionStatus', () => {
    it('should prevent invalid transitions (DRAFT to SHIPPED)', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = { productVariant: { findUnique: jest.fn().mockResolvedValue({ id: 'v1', isActive: true }) }, recipeVersion: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', ingredients: [{ variantId: 'v1', quantity: 1 }] }) }, numberSeries: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', currentNumber: 1 }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, $queryRaw: jest.fn().mockResolvedValue([{ id: 'n1', currentNumber: 1 }]), $executeRaw: jest.fn().mockResolvedValue(1), 
          salesOrder: {
            findUnique: jest.fn().mockResolvedValue({ id: 'o1', status: 'DRAFT' })
          }
        };
        return callback(txMock);
      });

      await expect(service.transitionStatus('o1', 'SHIPPED' as any))
        .rejects.toThrow(BadRequestException);
    });

    it('should release reservations when cancelled', async () => {
      const updateManyMock = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = { productVariant: { findUnique: jest.fn().mockResolvedValue({ id: 'v1', isActive: true }) }, recipeVersion: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', ingredients: [{ variantId: 'v1', quantity: 1 }] }) }, numberSeries: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', currentNumber: 1 }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, $queryRaw: jest.fn().mockResolvedValue([{ id: 'n1', currentNumber: 1 }]), $executeRaw: jest.fn().mockResolvedValue(1), 
          salesOrder: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ id: 'o1', status: 'PENDING_PAYMENT' })
              .mockResolvedValueOnce({ id: 'o1', status: 'CANCELLED' }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          inventoryReservation: {
            updateMany: updateManyMock
          }
        };
        return callback(txMock);
      });

      const result = await service.transitionStatus('o1', SalesOrderStatus.CANCELLED);
      expect(result.status).toBe('CANCELLED');
      expect(updateManyMock).toHaveBeenCalledWith({
        where: { salesOrderId: 'o1', status: 'ACTIVE' },
        data: { status: 'RELEASED' }
      });
    });
  });
});
