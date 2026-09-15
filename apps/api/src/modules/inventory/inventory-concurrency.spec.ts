import { InventoryService } from './inventory.service';
import { prisma } from '@cc-erp/database';

describe('Sprint 3: High-Concurrency Stock Reservation Certification', () => {
  let inventoryService: InventoryService;
  let testBranchId: string;
  let testVariantId: string;
  const testUserId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    inventoryService = new InventoryService();

    const branch = await prisma.branch.findFirst();
    const org = await prisma.organization.findFirst();
    const cat = await prisma.category.findFirst();
    const tax = await prisma.taxRule.findFirst();
    const uom = await prisma.unitOfMeasure.findFirst();

    if (!branch || !org || !cat || !tax || !uom) {
      throw new Error('Database must be seeded for inventory concurrency test.');
    }

    const testProduct = await prisma.product.create({
      data: {
        organizationId: org.id,
        name: `Test Inv Concurrency Product ${Date.now()}`,
        categoryId: cat.id,
        taxRuleId: tax.id,
        uomId: uom.id,
      },
    });

    const testVariant = await prisma.productVariant.create({
      data: {
        organizationId: org.id,
        productId: testProduct.id,
        sku: `SKU-INV-${Date.now()}`,
        name: 'Test Inv Concurrency Variant',
      },
    });

    testBranchId = branch.id;
    testVariantId = testVariant.id;

    // Reset stock balance to 0 first to ensure clean baseline
    await prisma.stockBalance.upsert({
      where: { locationId_variantId: { locationId: testBranchId, variantId: testVariantId } },
      update: { quantity: 0 },
      create: { locationId: testBranchId, variantId: testVariantId, quantity: 0 },
    });



    // Seed stock of exactly 10 units via ledger OPENING transaction
    await inventoryService.postTransaction({
      variantId: testVariantId,
      toLocationId: testBranchId,
      quantity: 10,
      type: 'OPENING' as any,
      notes: 'Initial concurrency test baseline stock = 10',
    }, testUserId);

    // Verify initial stock balance is 10
    const initialBalance = await prisma.stockBalance.findUnique({
      where: { locationId_variantId: { locationId: testBranchId, variantId: testVariantId } },
    });
    expect(Number(initialBalance?.quantity)).toBe(10);
  });

  it('100 simultaneous reservation requests for qty = 1 on initial stock = 10 must yield exactly 10 SUCCESS, 90 FAIL, 0 Negative stock', async () => {
    const totalRequests = 100;
    const reservationRequests = Array.from({ length: totalRequests }).map((_, i) =>
      inventoryService.reserveStock(
        {
          branchId: testBranchId,
          variantId: testVariantId,
          quantity: 1,
          notes: `Concurrent reservation test request #${i + 1}`,
        },
        testUserId
      )
    );

    // Execute 100 simultaneous requests
    const results = await Promise.allSettled(reservationRequests);

    const successful = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    console.log(`[Concurrency Certification Result] Total: ${totalRequests} | Successful: ${successful.length} | Failed: ${failed.length}`);

    // Verify Invariants
    expect(successful.length).toBe(10);
    expect(failed.length).toBe(90);

    // Verify Final Stock Balance is exactly 0 and NEVER negative
    const finalBalance = await prisma.stockBalance.findUnique({
      where: { locationId_variantId: { locationId: testBranchId, variantId: testVariantId } },
    });

    const finalQuantity = Number(finalBalance?.quantity ?? 0);
    expect(finalQuantity).toBe(0);
    expect(finalQuantity).toBeGreaterThanOrEqual(0);
  });
});
