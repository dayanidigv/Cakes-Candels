import { InventoryService } from './inventory.service';
import { prisma } from '@cc-erp/database';

describe('Sprint 6: High-Concurrency Double-Receipt Transfer Certification', () => {
  let inventoryService: InventoryService;

  let factoryBranchId: string;
  let storeBranchId: string;
  let testVariantId: string;
  let testTransferId: string;
  let testTransferItemId: string;
  const testUserId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    inventoryService = new InventoryService();

    // 1. Fetch seed data or create temporary branch & product variant for testing
    const branches = await prisma.branch.findMany({ take: 2 });
    const org = await prisma.organization.findFirst();
    const cat = await prisma.category.findFirst();
    const tax = await prisma.taxRule.findFirst();
    const uom = await prisma.unitOfMeasure.findFirst();

    if (branches.length < 2 || !org || !cat || !tax || !uom) {
      throw new Error('Database must be seeded for transfer concurrency test.');
    }

    factoryBranchId = branches[0].id;
    storeBranchId = branches[1].id;

    const testProduct = await prisma.product.create({
      data: {
        organizationId: org.id,
        name: `Test Transfer Product ${Date.now()}`,
        categoryId: cat.id,
        taxRuleId: tax.id,
        uomId: uom.id,
      },
    });

    const testVariant = await prisma.productVariant.create({
      data: {
        organizationId: org.id,
        productId: testProduct.id,
        sku: `SKU-TRF-${Date.now()}`,
        name: 'Test Transfer Variant',
      },
    });

    testVariantId = testVariant.id;

    // Seed stock of 200 units at Factory via ledger OPENING
    await inventoryService.postTransaction({
      variantId: testVariantId,
      toLocationId: factoryBranchId,
      quantity: 200,
      type: 'OPENING' as any,
      notes: 'Initial factory stock for transfer test',
    }, testUserId);

    // 2. Create transfer request for 100 units from Factory to Branch
    const transfer = await inventoryService.createTransfer({
      fromLocationId: factoryBranchId,
      toLocationId: storeBranchId,
      items: [{ variantId: testVariantId, quantityRequested: 100 }],
      notes: '100-Concurrent-Receipt Test Transfer',
    }, testUserId);

    testTransferId = transfer.id;
    testTransferItemId = transfer.items[0].id;

    // 3. Dispatch transfer (REQUESTED -> IN_TRANSIT)
    await inventoryService.dispatchTransfer(testTransferId, testUserId);
  });

  it('100 concurrent receiveTransfer requests on the same IN_TRANSIT dispatch must yield exactly 1 SUCCESS, 99 REJECTED, 0 duplicate stock', async () => {
    const totalRequests = 100;
    const receiveRequests = Array.from({ length: totalRequests }).map((_, i) =>
      inventoryService.receiveTransfer(
        testTransferId,
        {
          items: [{ transferItemId: testTransferItemId, quantityReceived: 100 }],
          notes: `Concurrent receive attempt #${i + 1}`,
        },
        testUserId
      )
    );

    // Execute 100 simultaneous receiveTransfer requests
    const results = await Promise.allSettled(receiveRequests);

    const successful = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    console.log(`[Transfer Concurrency Result] Total: ${totalRequests} | Successful: ${successful.length} | Failed: ${failed.length}`);

    // Exactly 1 receipt request must succeed, 99 must be rejected
    expect(successful.length).toBe(1);
    expect(failed.length).toBe(99);

    // Verify transfer status is RECEIVED
    const finalTransfer = await prisma.stockTransfer.findUnique({
      where: { id: testTransferId },
      include: { items: true },
    });
    expect(finalTransfer?.status).toBe('RECEIVED');
    expect(Number(finalTransfer?.items[0].quantityReceived)).toBe(100);

    // Verify Branch stock balance is exactly 100 (NOT 10,000!)
    const branchBalance = await prisma.stockBalance.findUnique({
      where: { locationId_variantId: { locationId: storeBranchId, variantId: testVariantId } },
    });
    expect(Number(branchBalance?.quantity)).toBe(100);

    // Verify Factory stock balance remains 100 (200 opening - 100 dispatched)
    const factoryBalance = await prisma.stockBalance.findUnique({
      where: { locationId_variantId: { locationId: factoryBranchId, variantId: testVariantId } },
    });
    expect(Number(factoryBalance?.quantity)).toBe(100);

    // Verify exactly ONE TRANSFER_IN transaction was posted
    const transferInTx = await prisma.inventoryTransaction.findMany({
      where: {
        referenceId: testTransferId,
        type: 'TRANSFER_IN' as any,
      },
    });

    expect(transferInTx.length).toBe(1);
    expect(Number(transferInTx[0].quantity)).toBe(100);
  });
});
