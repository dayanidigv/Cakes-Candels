import { GrnService } from './grn.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { prisma } from '@cc-erp/database';

describe('Sprint 4: High-Concurrency Double-Receiving Certification', () => {
  let grnService: GrnService;
  let poService: PurchaseOrdersService;
  let inventoryService: InventoryService;

  let testSupplierId: string;
  let testBranchId: string;
  let testVariantId: string;
  let testPoId: string;
  const testUserId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    inventoryService = new InventoryService();
    grnService = new GrnService(inventoryService);
    poService = new PurchaseOrdersService();

    // 1. Fetch seed data
    const supplier = await prisma.supplier.findFirst();
    const branch = await prisma.branch.findFirst();
    const org = await prisma.organization.findFirst();
    const cat = await prisma.category.findFirst();
    const tax = await prisma.taxRule.findFirst();
    const uom = await prisma.unitOfMeasure.findFirst();

    if (!supplier || !branch || !org || !cat || !tax || !uom) {
      throw new Error('Database must be seeded for procurement concurrency test.');
    }

    const testProduct = await prisma.product.create({
      data: {
        organizationId: org.id,
        name: `Test Proc Concurrency Product ${Date.now()}`,
        categoryId: cat.id,
        taxRuleId: tax.id,
        uomId: uom.id,
      },
    });

    const testVariant = await prisma.productVariant.create({
      data: {
        organizationId: org.id,
        productId: testProduct.id,
        sku: `SKU-PROC-${Date.now()}`,
        name: 'Test Proc Concurrency Variant',
      },
    });

    testSupplierId = supplier.id;
    testBranchId = branch.id;
    testVariantId = testVariant.id;

    // 2. Create a test PO with ordered quantity = 100
    const po = await poService.createPurchaseOrder({
      supplierId: testSupplierId,
      branchId: testBranchId,
      items: [{ variantId: testVariantId, quantity: 100, unitPrice: 50 }],
      notes: 'Concurrency test PO qty = 100',
    }, testUserId);

    testPoId = po.id;

    // Approve the PO to allow receiving
    await poService.approvePurchaseOrder(testPoId, testUserId);
  });

  it('2 concurrent GRN requests attempting to receive 100 each on a PO of 100 must yield 1 SUCCESS, 1 FAIL/REJECT, Total Received <= 100', async () => {
    const grnRequest1 = grnService.createGrn(
      {
        poId: testPoId,
        supplierInvoice: `INV-CONCURRENCY-1`,
        items: [{ variantId: testVariantId, quantity: 100, batchNumber: 'LOT-CONCURRENCY-1' }],
      },
      testUserId
    );

    const grnRequest2 = grnService.createGrn(
      {
        poId: testPoId,
        supplierInvoice: `INV-CONCURRENCY-2`,
        items: [{ variantId: testVariantId, quantity: 100, batchNumber: 'LOT-CONCURRENCY-2' }],
      },
      testUserId
    );

    // Execute 2 concurrent GRN creation requests
    const results = await Promise.allSettled([grnRequest1, grnRequest2]);

    const successful = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    console.log(`[Procurement Concurrency Result] Successful: ${successful.length} | Failed: ${failed.length}`);

    // Exactly 1 GRN must succeed for 100 units, the other must be rejected
    expect(successful.length).toBe(1);
    expect(failed.length).toBe(1);

    // Verify PO total received quantity is exactly 100 and NOT 200
    const finalPo = await prisma.purchaseOrder.findUnique({
      where: { id: testPoId },
      include: { items: true },
    });

    const receivedQty = Number(finalPo?.items[0].receivedQty);
    expect(receivedQty).toBe(100);
    expect(finalPo?.status).toBe('CLOSED');
  });
});
