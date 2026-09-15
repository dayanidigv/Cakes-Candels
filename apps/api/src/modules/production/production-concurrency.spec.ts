import { ProductionService } from './production.service';
import { InventoryService } from '../inventory/inventory.service';
import { prisma } from '@cc-erp/database';

describe('Sprint 5: High-Concurrency Production Completion Certification', () => {
  let productionService: ProductionService;
  let inventoryService: InventoryService;

  let testBranchId: string;
  let rawMaterialVariantId: string;
  let finishedGoodVariantId: string;
  let testRecipeVersionId: string;
  let testProductionOrderId: string;
  const testUserId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    inventoryService = new InventoryService();
    productionService = new ProductionService(inventoryService);

    // 1. Fetch or create test location, raw material variant, finished good variant, and recipe version
    const branch = await prisma.branch.findFirst();
    const variants = await prisma.productVariant.findMany({ take: 2 });
    let recipeVersion = await prisma.recipeVersion.findFirst({
      include: { ingredients: true },
    });

    if (!branch || variants.length < 2) {
      throw new Error('Database must be seeded with Branch and at least 2 ProductVariants for production concurrency test.');
    }

    testBranchId = branch.id;
    finishedGoodVariantId = variants[0].id;
    rawMaterialVariantId = variants[1].id;

    if (!recipeVersion || recipeVersion.ingredients.length === 0) {
      const org = await prisma.organization.findFirst();
      const uom = await prisma.unitOfMeasure.findFirst();
      const recipeMaster = await prisma.recipeMaster.create({
        data: {
          organizationId: org!.id,
          name: 'Test Concurrency Cake Recipe',
          yieldQuantity: 1,
          uomId: uom!.id,
        },
      });
      recipeVersion = await prisma.recipeVersion.create({
        data: {
          recipeId: recipeMaster.id,
          versionNumber: 'v1.0',
          ingredients: {
            create: [{ variantId: rawMaterialVariantId, quantity: 2, uomId: uom!.id }],
          },
        },
        include: { ingredients: true },
      });
    } else if (recipeVersion.ingredients[0].variantId) {
      rawMaterialVariantId = recipeVersion.ingredients[0].variantId;
    }

    testRecipeVersionId = recipeVersion.id;

    // Seed stock of 500 units for raw material via ledger OPENING
    await inventoryService.postTransaction({
      variantId: rawMaterialVariantId,
      toLocationId: testBranchId,
      quantity: 500,
      type: 'OPENING' as any,
      notes: 'Initial raw material stock for production test',
    }, testUserId);

    // 2. Create production order for 10 finished goods
    const order = await productionService.createProductionOrder({
      locationId: testBranchId,
      variantId: finishedGoodVariantId,
      recipeVersionId: testRecipeVersionId,
      targetQuantity: 10,
      notes: '100-Concurrent-Completion Test Order',
    }, testUserId);

    testProductionOrderId = order.id;

    // 3. Start production (PLANNED -> IN_PROGRESS), consuming raw materials
    await productionService.startProduction(testProductionOrderId, {}, testUserId);
  });

  it('100 concurrent completion requests on the same ProductionOrder must yield exactly 1 SUCCESS, 99 REJECTED, 0 duplicate outputs', async () => {
    const totalRequests = 100;
    const completionRequests = Array.from({ length: totalRequests }).map((_, i) =>
      productionService.completeProduction(
        testProductionOrderId,
        {
          actualYield: 10,
          batchNumber: `BATCH-CONCURRENCY-CAKE-${i + 1}`,
          notes: `Concurrent completion attempt #${i + 1}`,
        },
        testUserId
      )
    );

    // Execute 100 simultaneous completion requests
    const results = await Promise.allSettled(completionRequests);

    const successful = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    console.log(`[Production Concurrency Result] Total: ${totalRequests} | Successful: ${successful.length} | Failed: ${failed.length}`);

    // Exactly 1 request must succeed, 99 must be rejected
    expect(successful.length).toBe(1);
    expect(failed.length).toBe(99);

    // Verify order status is COMPLETED with actualYield = 10
    const finalOrder = await prisma.productionOrder.findUnique({
      where: { id: testProductionOrderId },
    });
    expect(finalOrder?.status).toBe('COMPLETED');
    expect(Number(finalOrder?.actualYield)).toBe(10);

    // Verify exactly ONE PRODUCTION_OUTPUT transaction was posted for this production order
    const outputTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        referenceId: testProductionOrderId,
        type: 'PRODUCTION_OUTPUT' as any,
      },
    });

    expect(outputTransactions.length).toBe(1);
    expect(Number(outputTransactions[0].quantity)).toBe(10);
  });
});
