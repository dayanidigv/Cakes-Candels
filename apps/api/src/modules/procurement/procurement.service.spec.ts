import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
import { GrnService } from './grn.service';
import { InventoryService } from '../inventory/inventory.service';
import { prisma } from '@cc-erp/database';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    purchaseOrder: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    purchaseOrderItem: { update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue([{ quantity: 10, receivedQty: 10 }]) },
    goodsReceiptNote: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    supplier: { findUnique: jest.fn() },
    branch: { findUnique: jest.fn() },
    numberSeries: { findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(prisma)),
  }
}));

describe('Procurement Services', () => {
  let poService: PurchaseOrdersService;
  let grnService: GrnService;
  let invService: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        GrnService,
        {
          provide: InventoryService,
          useValue: { postTransaction: jest.fn() }
        }
      ],
    }).compile();

    poService = module.get<PurchaseOrdersService>(PurchaseOrdersService);
    grnService = module.get<GrnService>(GrnService);
    invService = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(poService).toBeDefined();
    expect(grnService).toBeDefined();
  });

  describe('createPurchaseOrder', () => {
    it('should create a PO successfully', async () => {
      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue({ id: 'supp-1' });
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({ id: 'branch-1' });
      (prisma.purchaseOrder.create as jest.Mock).mockResolvedValue({ id: 'po-1', status: 'SUBMITTED' });

      const dto = {
        supplierId: 'supp-1',
        branchId: 'branch-1',
        items: [{ variantId: 'var-1', quantity: 10, unitPrice: 100 }]
      };

      const result = await poService.createPurchaseOrder(dto, 'user-1');
      expect(prisma.purchaseOrder.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('approvePurchaseOrder', () => {
    it('should approve a SUBMITTED PO', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'po-1', status: 'SUBMITTED' });
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({ id: 'po-1', status: 'APPROVED' });

      const result = await poService.approvePurchaseOrder('po-1', 'user-1');
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('createGrn (Receive Goods)', () => {
    it('should receive goods, update PO status to CLOSED, and call inventoryService', async () => {
      const poItem = { id: 'poi-1', variantId: 'var-1', quantity: 10, receivedQty: 0, unitPrice: 100 };
      const po = { id: 'po-1', branchId: 'branch-1', status: 'APPROVED', items: [poItem] };
      const grnItem = { variantId: 'var-1', quantity: 10, unitPrice: 100 };
      const grn = { id: 'grn-1', items: [grnItem] };

      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(po);
      (prisma.goodsReceiptNote.create as jest.Mock).mockResolvedValue(grn);

      const dto = {
        poId: 'po-1',
        supplierInvoice: 'INV-123',
        items: [{ variantId: 'var-1', quantity: 10 }]
      };

      await grnService.createGrn(dto, 'user-1');

      expect(prisma.purchaseOrderItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'poi-1', receivedQty: { lte: 0 } },
        data: { receivedQty: { increment: 10 } }
      }));
      expect(invService.postTransaction).toHaveBeenCalledWith(expect.objectContaining({
        quantity: 10,
        type: 'PURCHASE_RECEIPT'
      }), 'user-1', prisma);
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'po-1' },
        data: { status: 'CLOSED' }
      }));
    });
  });
});
