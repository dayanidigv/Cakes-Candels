import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { prisma } from '@cc-erp/database';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    productVariant: {
      findUnique: jest.fn(),
    }
  },
}));

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PricingService],
    }).compile();

    service = module.get<PricingService>(PricingService);
    jest.clearAllMocks();
  });

  it('should reject quantity <= 0', async () => {
    await expect(service.resolveOrderPricing('b1', [{ variantId: 'v1', quantity: 0 }]))
      .rejects.toThrow(BadRequestException);
    await expect(service.resolveOrderPricing('b1', [{ variantId: 'v1', quantity: -5 }]))
      .rejects.toThrow(BadRequestException);
  });

  it('should reject invalid variant', async () => {
    (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.resolveOrderPricing('b1', [{ variantId: 'v1', quantity: 1 }]))
      .rejects.toThrow(NotFoundException);
  });

  it('should calculate server tax and price correctly', async () => {
    (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({
      id: 'v1',
      isActive: true,
      pricing: { sellingPrice: new Decimal(100) },
      product: { taxRule: { rate: new Decimal(18) } }
    });

    const result = await service.resolveOrderPricing('b1', [{ variantId: 'v1', quantity: 2 }]);
    
    expect(result.subtotal.toNumber()).toBe(200); // 100 * 2
    expect(result.taxTotal.toNumber()).toBe(36);  // 18% of 200
    expect(result.grandTotal.toNumber()).toBe(236);
  });

  it('should calculate server discount correctly', async () => {
    (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({
      id: 'v1',
      isActive: true,
      pricing: { sellingPrice: new Decimal(100) },
      product: { taxRule: { rate: new Decimal(0) } }
    });
    
    const result = await service.resolveOrderPricing('b1', [{ variantId: 'v1', quantity: 2 }], new Decimal(15));
    
    expect(result.subtotal.toNumber()).toBe(200); // 100 * 2
    expect(result.discountTotal.toNumber()).toBe(15);  // manually passed 15
    expect(result.grandTotal.toNumber()).toBe(185); // 200 - 15 + 0
  });
});
