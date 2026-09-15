import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';
import { PromotionValidationService } from '../promotions/promotion-validation.service';
import { PromotionUsageService } from '../promotions/promotion-usage.service';
import { InventoryService } from '../../inventory/inventory.service';
import { prisma, SalesOrderStatus } from '@cc-erp/database';

describe('Sprint 7: High-Concurrency Order Confirmation & Checkout Certification', () => {
  let ordersService: OrdersService;
  let inventoryService: InventoryService;

  let branchId: string;
  let customerId: string;
  let testVariantId: string;
  let testOrgId: string;
  let testOrderId: string;
  const testUserId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        PricingService,
        InventoryService,
        {
          provide: PromotionValidationService,
          useValue: { validate: jest.fn().mockResolvedValue({ valid: false }) },
        },
        {
          provide: PromotionUsageService,
          useValue: { reserveUsage: jest.fn() },
        },
      ],
    }).compile();

    ordersService = module.get<OrdersService>(OrdersService);
    inventoryService = module.get<InventoryService>(InventoryService);

    // Fetch seed data
    const branch = await prisma.branch.findFirst();
    let customer = await prisma.customer.findFirst();
    const org = await prisma.organization.findFirst();
    if (org) testOrgId = org.id;
    const cat = await prisma.category.findFirst();
    const tax = await prisma.taxRule.findFirst();
    const uom = await prisma.unitOfMeasure.findFirst();

    if (!branch || !org || !cat || !tax || !uom) {
      throw new Error('Database must be seeded for orders concurrency test.');
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          fullName: 'Test Sales Concurrency Customer',
          phone: `999${Date.now().toString().slice(-7)}`,
          email: `test-sales-${Date.now()}@example.com`,
        },
      });
    }

    branchId = branch.id;
    customerId = customer.id;

    // Create test product and variant
    const testProduct = await prisma.product.create({
      data: {
        organizationId: org.id,
        name: `Test Sales Product ${Date.now()}`,
        categoryId: cat.id,
        taxRuleId: tax.id,
        uomId: uom.id,
      },
    });

    const testVariant = await prisma.productVariant.create({
      data: {
        organizationId: org.id,
        productId: testProduct.id,
        sku: `SKU-SALE-${Date.now()}`,
        name: 'Test Sales Variant',
      },
    });

    testVariantId = testVariant.id;

    await prisma.productPricing.create({
      data: {
        variantId: testVariantId,
        costPrice: 50,
        mrp: 100,
        sellingPrice: 100,
      },
    });

    // Seed stock of 500 units at Branch via ledger OPENING
    await inventoryService.postTransaction({
      variantId: testVariantId,
      toLocationId: branchId,
      quantity: 500,
      type: 'OPENING' as any,
      notes: 'Initial branch stock for sales test',
    }, testUserId);

    // Create a SalesOrder in PENDING_PAYMENT status for 10 units
    const order = await ordersService.createOrder(testUserId, testOrgId, {
      customerId,
      branchId,
      items: [{ variantId: testVariantId, quantity: 10 }],
    });

    testOrderId = order.id;
  });

  it('100 concurrent transitionStatus(CONFIRMED) requests on the same order must yield exactly 1 SUCCESS, 99 REJECTED, 0 duplicate SALE transactions', async () => {
    const totalRequests = 100;
    const confirmRequests = Array.from({ length: totalRequests }).map((_, i) =>
      ordersService.transitionStatus(
        testOrderId,
        SalesOrderStatus.CONFIRMED,
        undefined, // no idempotency key so each call relies on atomic updateMany lock
        testUserId
      )
    );

    // Execute 100 simultaneous order confirmation requests
    const results = await Promise.allSettled(confirmRequests);

    const successful = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    console.log(`[Sales Concurrency Result] Total: ${totalRequests} | Successful: ${successful.length} | Failed: ${failed.length}`);

    // Exactly 1 confirmation request must succeed, 99 must be rejected
    expect(successful.length).toBe(1);
    expect(failed.length).toBe(99);

    // Verify order status is CONFIRMED
    const finalOrder = await prisma.salesOrder.findUnique({
      where: { id: testOrderId },
    });
    expect(finalOrder?.status).toBe(SalesOrderStatus.CONFIRMED);

    // Verify Branch stock balance decremented by exactly 10 (500 - 10 = 490)
    const branchBalance = await prisma.stockBalance.findUnique({
      where: { locationId_variantId: { locationId: branchId, variantId: testVariantId } },
    });
    expect(Number(branchBalance?.quantity)).toBe(490);

    // Verify exactly ONE SALE transaction was posted for this order
    const saleTx = await prisma.inventoryTransaction.findMany({
      where: {
        referenceId: testOrderId,
        type: 'SALE' as any,
      },
    });

    expect(saleTx.length).toBe(1);
    expect(Number(saleTx[0].quantity)).toBe(10);
  });
});
