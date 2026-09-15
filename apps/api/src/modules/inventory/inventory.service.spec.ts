import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { BadRequestException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    stockBalance: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
    },
    stockTransfer: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    stockTransferItem: {
      update: jest.fn(),
    },
    wastageLog: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(async (callback) => {
      const tx = {
        stockBalance: prisma.stockBalance,
        inventoryTransaction: prisma.inventoryTransaction,
        stockTransfer: prisma.stockTransfer,
        stockTransferItem: prisma.stockTransferItem,
        wastageLog: prisma.wastageLog,
      };
      return callback(tx);
    }),
  }
}));

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [InventoryService],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('postTransaction', () => {
    it('should successfully post an inbound transaction (PURCHASE_RECEIPT)', async () => {
      const dto: any = {
        variantId: 'var-1',
        toLocationId: 'loc-1',
        quantity: 10,
        type: 'PURCHASE_RECEIPT'
      };

      (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx-1' });

      const result = await service.postTransaction(dto, 'user-1');
      
      expect(result).toBeDefined();
      expect(prisma.inventoryTransaction.create).toHaveBeenCalled();
      expect(prisma.stockBalance.upsert).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should successfully post an outbound transaction if stock is sufficient', async () => {
      const dto: any = {
        variantId: 'var-1',
        fromLocationId: 'loc-1',
        quantity: 5,
        type: 'SALE'
      };

      (prisma.stockBalance.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx-1' });

      await service.postTransaction(dto, 'user-1');
      
      expect(prisma.inventoryTransaction.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if stock is insufficient before transaction', async () => {
      const dto: any = {
        variantId: 'var-1',
        fromLocationId: 'loc-1',
        quantity: 15,
        type: 'SALE'
      };

      (prisma.stockBalance.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(service.postTransaction(dto, 'user-1')).rejects.toThrow(BadRequestException);
      await expect(service.postTransaction(dto, 'user-1')).rejects.toThrow('Insufficient stock');
    });
  });

  describe('Stock Transfers', () => {
    it('should create a transfer successfully', async () => {
      const dto: any = {
        fromLocationId: 'loc-1',
        toLocationId: 'loc-2',
        items: [{ variantId: 'var-1', quantityRequested: 10 }]
      };

      (prisma.stockTransfer.create as jest.Mock).mockResolvedValue({ id: 'trf-1' });

      await service.createTransfer(dto, 'user-1');
      expect(prisma.stockTransfer.create).toHaveBeenCalled();
    });

    it('should rollback and throw if source and destination are identical', async () => {
      const dto: any = {
        fromLocationId: 'loc-1',
        toLocationId: 'loc-1',
        items: [{ variantId: 'var-1', quantityRequested: 10 }]
      };

      await expect(service.createTransfer(dto, 'user-1')).rejects.toThrow('Source and destination cannot be the same.');
    });
  });
});
