import { Test, TestingModule } from '@nestjs/testing';
import { prisma, SalesOrderStatus } from '@cc-erp/database';
import { OrdersService } from './orders/orders.service';
import { PricingService } from './orders/pricing.service';
import { PosShiftService } from './pos/pos-shift.service';
import { PosOfflineService } from './pos/pos-offline.service';
import { InventoryService } from '../inventory/inventory.service';
import { PromotionValidationService } from './promotions/promotion-validation.service';
import { PromotionUsageService } from './promotions/promotion-usage.service';


describe('Sprint 7 — Sales, POS & Commercial Concurrency Certification', () => {
  let ordersService: OrdersService;
  let posShiftService: PosShiftService;
  let posOfflineService: PosOfflineService;
  let inventoryService: InventoryService;

  let testBranchId: string;
  let testCustomerId: string;
  let testVariantId: string;
  let testShiftId: string;
  let testOrgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        PricingService,
        PosShiftService,
        PosOfflineService,
        InventoryService,
        {
          provide: PromotionValidationService,
          useValue: { validate: jest.fn().mockResolvedValue({ valid: true, calculatedDiscountAmount: 0 }) },
        },
        {
          provide: PromotionUsageService,
          useValue: { reserveUsage: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    ordersService = moduleFixture.get<OrdersService>(OrdersService);
    posShiftService = moduleFixture.get<PosShiftService>(PosShiftService);
    posOfflineService = moduleFixture.get<PosOfflineService>(PosOfflineService);
    inventoryService = moduleFixture.get<InventoryService>(InventoryService);

    // Setup master test records
    const org = await prisma.organization.findFirst() || await prisma.organization.create({
      data: { code: `ORG-${Date.now()}`, name: `Sales Cert Org ${Date.now()}` },
    });
    testOrgId = org.id;

    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id } }) || await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: `Sales Cert Branch ${Date.now()}`,
        type: 'RETAIL_BRANCH',
        address: '123 Test St',
      },
    });
    testBranchId = branch.id;

    const customer = await prisma.customer.findFirst() || await prisma.customer.create({
      data: { phone: `999${Date.now().toString().slice(-7)}`, fullName: 'Concurrency Customer' },
    });
    testCustomerId = customer.id;

    const category = await prisma.category.findFirst() || await prisma.category.create({
      data: { organizationId: org.id, name: `Sales Category ${Date.now()}` },
    });

    const uom = await prisma.unitOfMeasure.findFirst({ where: { organizationId: org.id } }) || await prisma.unitOfMeasure.create({
      data: { organizationId: org.id, name: 'Piece', symbol: `pc-${Date.now()}` },
    });

    const taxRule = await prisma.taxRule.findFirst({ where: { organizationId: org.id } }) || await prisma.taxRule.create({
      data: { organizationId: org.id, name: `Tax 5% ${Date.now()}`, rate: 5 },
    });

    const product = await prisma.product.findFirst({ where: { organizationId: org.id } }) || await prisma.product.create({
      data: {
        organizationId: org.id,
        name: 'Concurrency Cupcake',
        categoryId: category.id,
        taxRuleId: taxRule.id,
        uomId: uom.id,
      },
    });

    const variant = await prisma.productVariant.findFirst({ where: { productId: product.id } }) || await prisma.productVariant.create({
      data: {
        organizationId: org.id,
        productId: product.id,
        sku: `SKU-CC-${Date.now()}`,
        name: 'Standard Cupcake',
      },
    });
    testVariantId = variant.id;

    // Seed pricing
    await prisma.productPricing.upsert({
      where: { variantId: testVariantId },
      update: { sellingPrice: 100, costPrice: 50, mrp: 120 },
      create: { variantId: testVariantId, sellingPrice: 100, costPrice: 50, mrp: 120 },
    });

    // Open active shift
    const shift = await posShiftService.openShift({
      branchId: testBranchId,
      cashierId: crypto.randomUUID(),
      openingCash: 500,
    });
    testShiftId = shift.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Gate 1: 100 concurrent order confirmations -> Exactly 1 succeeds, 99 rejected, 1 SALE entry', async () => {
    const testUserId = crypto.randomUUID();
    // Create single order
    const order = await ordersService.createOrder(testUserId, testOrgId, {
      customerId: testCustomerId,
      branchId: testBranchId,
      items: [{ variantId: testVariantId, quantity: 1 }],
    });

    const concurrentAttempts = Array.from({ length: 100 }).map((_, index) =>
      ordersService
        .transitionStatus(order.id, SalesOrderStatus.CONFIRMED, `dup-key-${order.id}-${index}`, testUserId)
        .then((res) => ({ success: true, res }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(concurrentAttempts);
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);

    // Verify database state: exactly 1 SALE ledger transaction
    const saleTransactions = await prisma.inventoryTransaction.findMany({
      where: { referenceId: order.id, type: 'SALE' },
    });
    expect(saleTransactions.length).toBe(1);
  });

  it('Gate 2: 100 duplicate offline POS sync submissions -> Exactly 1 order created, 99 return duplicate status', async () => {
    const offlineTransactionId = `offline-tx-${Date.now()}`;
    const idempotencyKey = `idemp-${offlineTransactionId}`;
    const deviceId = `device-pos-01`;
    const terminalId = `term-01`;

    const orderDto = {
      customerId: testCustomerId,
      branchId: testBranchId,
      items: [{ variantId: testVariantId, quantity: 1 }],
      posShiftId: testShiftId,
    };

    const concurrentSyncs = Array.from({ length: 100 }).map(() =>
      posOfflineService
        .syncOfflineTransaction({
          offlineTransactionId,
          idempotencyKey,
          deviceId,
          terminalId,
          branchId: testBranchId,
          cashierId: crypto.randomUUID(),
          orderDto,
        })
        .then((res: any) => ({ success: true, res }))
        .catch((err: any) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(concurrentSyncs);
    const successfulResponses = results.filter((r) => r.success);

    expect(successfulResponses.length).toBe(100);

    const firstTimeCreations = results.filter((r: any) => r.success && !r.res?.duplicate);
    const duplicateReplays = results.filter((r: any) => r.success && r.res?.duplicate);

    expect(firstTimeCreations.length).toBe(1);
    expect(duplicateReplays.length).toBe(99);

    // Verify offline sync record count in database
    const syncRecords = await prisma.posOfflineSyncRecord.findMany({
      where: { offlineTransactionId },
    });
    expect(syncRecords.length).toBe(1);
    expect(syncRecords[0].syncStatus).toBe('SUCCESS');
  });
});
