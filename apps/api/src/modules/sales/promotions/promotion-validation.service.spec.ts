import { Test, TestingModule } from '@nestjs/testing';
import { PromotionValidationService } from './promotion-validation.service';
import { PromotionsRepository } from './promotions.repository';
import { PromotionUsageStatus } from '@cc-erp/database';
import { Decimal } from '@prisma/client/runtime/library';

describe('PromotionValidationService', () => {
  let service: PromotionValidationService;
  let repo: jest.Mocked<PromotionsRepository>;

  const mockContext = {
    promotionCode: 'SAVE10',
    customerId: 'cust-1',
    branchId: 'branch-1',
    subtotal: new Decimal(100),
    items: [
      { variantId: 'v1', productId: 'p1', categoryId: 'c1', quantity: 1 }
    ]
  };

  beforeEach(async () => {
    const repoMock = {
      findByCode: jest.fn(),
      countGlobalUsage: jest.fn().mockResolvedValue(0),
      countCustomerUsage: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionValidationService,
        { provide: PromotionsRepository, useValue: repoMock }
      ],
    }).compile();

    service = module.get<PromotionValidationService>(PromotionValidationService);
    repo = module.get(PromotionsRepository);
  });

  it('should reject if promotion not found', async () => {
    repo.findByCode.mockResolvedValue(null);
    const result = await service.validate(mockContext);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PROMOTION_NOT_FOUND');
  });

  it('should reject inactive promotion', async () => {
    repo.findByCode.mockResolvedValue({ isActive: false } as any);
    const result = await service.validate(mockContext);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PROMOTION_INACTIVE');
  });

  it('should validate percentage discount on entire cart', async () => {
    repo.findByCode.mockResolvedValue({
      id: 'promo-1',
      code: 'SAVE10',
      isActive: true,
      type: 'PERCENTAGE',
      value: new Decimal(10),
      startAt: null,
      endAt: null,
      applicableBranchId: null,
      applicableProductId: null,
      applicableCategoryId: null,
      minimumOrderValue: null,
      usageLimit: null,
      perCustomerLimit: null,
      maximumDiscount: null,
    } as any);

    const result = await service.validate(mockContext);
    expect(result.valid).toBe(true);
    expect(result.calculatedDiscountAmount).toBe(10); // 10% of 100
  });

  it('should enforce product and category AND condition', async () => {
    repo.findByCode.mockResolvedValue({
      id: 'promo-1',
      isActive: true,
      type: 'PERCENTAGE',
      value: new Decimal(10),
      applicableProductId: 'p2',
      applicableCategoryId: 'c2',
    } as any);

    // Items have p1 and c1, not p2 and c2
    const result = await service.validate(mockContext);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PROMOTION_NOT_APPLICABLE_TO_PRODUCT_AND_CATEGORY');
  });

  it('should enforce customer usage limit', async () => {
    repo.findByCode.mockResolvedValue({
      id: 'promo-1',
      isActive: true,
      type: 'FLAT',
      value: new Decimal(5),
      perCustomerLimit: 1,
    } as any);

    repo.countCustomerUsage.mockResolvedValue(1); // Already used 1 time

    const result = await service.validate(mockContext);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PROMOTION_CUSTOMER_LIMIT_REACHED');
  });
});
