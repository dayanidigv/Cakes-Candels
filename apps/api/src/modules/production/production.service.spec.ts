import { Test, TestingModule } from '@nestjs/testing';
import { ProductionService } from './production.service';
import { InventoryService } from '../inventory/inventory.service';
import { BadRequestException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    productionOrder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
    },
    recipeVersion: {
      findUnique: jest.fn(),
    },
    recipeMaster: {
      findUnique: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
    },
    numberSeries: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    materialConsumption: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => {
      const tx = {
        productionOrder: prisma.productionOrder,
        recipeMaster: prisma.recipeMaster,
        materialConsumption: prisma.materialConsumption,
        productVariant: prisma.productVariant,
        recipeVersion: prisma.recipeVersion,
        branch: prisma.branch,
        numberSeries: prisma.numberSeries,
        $queryRaw: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn().mockResolvedValue(1),
        outboxEvent: prisma.outboxEvent,
      };
      return callback(tx);
    }),
  }
}));

describe('ProductionService', () => {
  let service: ProductionService;
  let inventoryService: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        {
          provide: InventoryService,
          useValue: {
            postTransaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductionService>(ProductionService);
    inventoryService = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProductionOrder', () => {
    it('should create an order successfully', async () => {
      (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({ id: 'var-1' });
      (prisma.recipeVersion.findUnique as jest.Mock).mockResolvedValue({ id: 'rv-1', ingredients: [{}] });
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({ id: 'loc-1' });
      (prisma.numberSeries.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.productionOrder.create as jest.Mock).mockResolvedValue({ id: 'order-1', orderNumber: 'PRD-123' });

      const dto = {
        locationId: 'loc-1',
        variantId: 'var-1',
        recipeVersionId: 'rv-1',
        targetQuantity: 10,
      };

      const result = await service.createProductionOrder(dto, 'user-1');
      expect(result).toBeDefined();
      expect(prisma.productionOrder.create).toHaveBeenCalled();
    });
  });

  describe('startProduction', () => {
    it('should consume materials and update status to IN_PROGRESS', async () => {
      const order = {
        id: 'order-1',
        status: 'PLANNED',
        targetQuantity: 10,
        locationId: 'loc-1',
        recipeVersion: {
          recipeId: 'rm-1',
          ingredients: [{ variantId: 'raw-1', quantity: 2 }]
        }
      };

      (prisma.productionOrder.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.productionOrder.findUnique as jest.Mock).mockResolvedValue(order);
      (prisma.recipeMaster.findUnique as jest.Mock).mockResolvedValue({ id: 'rm-1', yieldQuantity: 1 });

      await service.startProduction('order-1', {}, 'user-1');

      expect(inventoryService.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          variantId: 'raw-1',
          quantity: 20, // 2 * (10 / 1)
          type: 'PRODUCTION_CONSUMPTION'
        }),
        'user-1',
        expect.any(Object)
      );
      expect(prisma.materialConsumption.createMany).toHaveBeenCalled();
    });

    it('should throw error if order is not PLANNED', async () => {
      (prisma.productionOrder.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.productionOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS' });

      await expect(service.startProduction('order-1', {}, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should rollback if postTransaction throws (negative stock)', async () => {
      const order = {
        id: 'order-1',
        status: 'PLANNED',
        targetQuantity: 10,
        locationId: 'loc-1',
        recipeVersion: {
          recipeId: 'rm-1',
          ingredients: [{ variantId: 'raw-1', quantity: 2 }]
        }
      };

      (prisma.productionOrder.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.productionOrder.findUnique as jest.Mock).mockResolvedValue(order);
      (prisma.recipeMaster.findUnique as jest.Mock).mockResolvedValue({ id: 'rm-1', yieldQuantity: 1 });
      
      // Simulate inventory service throwing (e.g., negative stock)
      (inventoryService.postTransaction as jest.Mock).mockRejectedValue(new BadRequestException('Insufficient stock'));

      await expect(service.startProduction('order-1', {}, 'user-1')).rejects.toThrow('Insufficient stock');
    });
  });

  describe('completeProduction', () => {
    it('should yield finished goods and update status to COMPLETED', async () => {
      const order = {
        id: 'order-1',
        status: 'IN_PROGRESS',
        locationId: 'loc-1',
        variantId: 'fg-1',
        orderNumber: 'PRD-100',
      };

      (prisma.productionOrder.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.productionOrder.findUnique as jest.Mock).mockResolvedValue(order);

      await service.completeProduction('order-1', { actualYield: 9.5 }, 'user-1');

      expect(inventoryService.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          variantId: 'fg-1',
          quantity: 9.5,
          type: 'PRODUCTION_OUTPUT'
        }),
        'user-1',
        expect.any(Object)
      );
    });
  });
});
