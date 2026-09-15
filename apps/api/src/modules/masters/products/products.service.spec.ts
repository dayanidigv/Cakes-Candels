import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { BadRequestException } from '@nestjs/common';
import { ProductType } from './dto/create-product.dto';
import { prisma } from '@cc-erp/database';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    productVariant: {
      findMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      const tx = {
        product: { create: jest.fn().mockResolvedValue({ id: 'prod-1' }) },
        productVariant: { create: jest.fn().mockResolvedValue({ id: 'var-1' }) },
        productPricing: { create: jest.fn().mockResolvedValue({ id: 'price-1' }) },
      };
      return callback(tx);
    }),
  }
}));

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    
    // Mock findOne to avoid calling DB
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'prod-1' } as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException if STANDARD product has no SKU', async () => {
      const dto: any = {
        type: ProductType.STANDARD,
        name: 'Test Product',
        variants: [{ sku: 'TEST-1' }]
      };
      
      await expect(service.create('DEFAULT', dto)).rejects.toThrow(BadRequestException);
      await expect(service.create('DEFAULT', dto)).rejects.toThrow('SKU is required for STANDARD products');
    });

    it('should throw BadRequestException if there are no variants', async () => {
      const dto: any = {
        type: ProductType.VARIANT_PARENT,
        name: 'Test Product',
        variants: []
      };

      await expect(service.create('DEFAULT', dto)).rejects.toThrow(BadRequestException);
      await expect(service.create('DEFAULT', dto)).rejects.toThrow('Product must have at least one variant');
    });

    it('should throw BadRequestException if variant SKUs are duplicated in request', async () => {
      const dto: any = {
        type: ProductType.VARIANT_PARENT,
        name: 'Test Product',
        variants: [
          { sku: 'DUP-1', name: 'Variant 1' },
          { sku: 'DUP-1', name: 'Variant 2' }
        ]
      };

      await expect(service.create('DEFAULT', dto)).rejects.toThrow(BadRequestException);
      await expect(service.create('DEFAULT', dto)).rejects.toThrow('Duplicate SKUs in variants list');
    });

    it('should throw BadRequestException if SKU already exists in DB', async () => {
      (prisma.productVariant.findMany as jest.Mock).mockResolvedValue([{ sku: 'EXIST-1' }]);
      
      const dto: any = {
        type: ProductType.VARIANT_PARENT,
        name: 'Test Product',
        variants: [
          { sku: 'EXIST-1', name: 'Variant 1' }
        ]
      };

      await expect(service.create('DEFAULT', dto)).rejects.toThrow(BadRequestException);
      await expect(service.create('DEFAULT', dto)).rejects.toThrow('SKUs already exist: EXIST-1');
    });

    it('should throw BadRequestException for invalid pricing invariants', async () => {
      (prisma.productVariant.findMany as jest.Mock).mockResolvedValue([]);
      
      const dto: any = {
        type: ProductType.VARIANT_PARENT,
        name: 'Test Product',
        variants: [
          { sku: 'VAR-1', name: 'Variant 1', costPrice: 20, mrp: 50, sellingPrice: 15 } // Selling price < cost price
        ]
      };

      await expect(service.create('DEFAULT', dto)).rejects.toThrow(BadRequestException);
      await expect(service.create('DEFAULT', dto)).rejects.toThrow('Selling price cannot be less than cost price for SKU VAR-1');
    });

    it('should create product successfully', async () => {
      (prisma.productVariant.findMany as jest.Mock).mockResolvedValue([]);
      
      const dto: any = {
        type: ProductType.VARIANT_PARENT,
        name: 'Test Product',
        categoryId: 'cat-1',
        taxRuleId: 'tax-1',
        uomId: 'uom-1',
        variants: [
          { sku: 'VAR-1', name: 'Variant 1', costPrice: 10, mrp: 20, sellingPrice: 15 }
        ]
      };

      const result = await service.create('DEFAULT', dto);
      expect(result).toBeDefined();
      expect(result.id).toBe('prod-1');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
