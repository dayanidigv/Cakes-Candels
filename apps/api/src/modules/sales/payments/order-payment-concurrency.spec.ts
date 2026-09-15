import { Test, TestingModule } from '@nestjs/testing';
import { prisma, SalesOrderStatus } from '@cc-erp/database';
import { ConfigService } from '../../../config/config.service';
import { OrdersService } from '../orders/orders.service';
import { PricingService } from '../orders/pricing.service';
import { PosShiftService } from '../pos/pos-shift.service';
import { PosOfflineService } from '../pos/pos-offline.service';
import { PaymentsService } from './payments.service';
import { LoyaltyService } from '../crm/loyalty.service';
import { InventoryService } from '../../inventory/inventory.service';
import { PromotionValidationService } from '../promotions/promotion-validation.service';
import { PromotionUsageService } from '../promotions/promotion-usage.service';
import * as crypto from 'crypto';

describe('Sprint 8 — Unified Order & Payment Concurrency Certification', () => {
  jest.setTimeout(20000);
  let ordersService: OrdersService;
  let paymentsService: PaymentsService;

  let testBranchId: string;
  let testCustomerId: string;
  let testVariantId: string;
  let testOrgId: string;

  beforeAll(async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = 'test-secret-key';
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        PricingService,
        PosShiftService,
        PosOfflineService,
        PaymentsService,
        LoyaltyService,
        InventoryService,
        {
          provide: PromotionValidationService,
          useValue: { validate: jest.fn().mockResolvedValue({ valid: true, calculatedDiscountAmount: 0 }) },
        },
        {
          provide: PromotionUsageService,
          useValue: { reserveUsage: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: ConfigService,
          useValue: { paymentWebhookSecret: 'test-secret-key' },
        }
      ],
    }).compile();

    ordersService = moduleFixture.get<OrdersService>(OrdersService);
    paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);

    // Setup master records
    const org = await prisma.organization.findFirst() || await prisma.organization.create({
      data: { code: `ORG-S8-${Date.now()}`, name: `Sprint 8 Org ${Date.now()}` },
    });
    testOrgId = org.id;

    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id } }) || await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: `Sprint 8 Branch ${Date.now()}`,
        type: 'RETAIL_BRANCH',
        address: '456 Commercial Way',
      },
    });
    testBranchId = branch.id;

    const customer = await prisma.customer.findFirst() || await prisma.customer.create({
      data: { phone: `888${Date.now().toString().slice(-7)}`, fullName: 'Payment Customer' },
    });
    testCustomerId = customer.id;

    const category = await prisma.category.findFirst() || await prisma.category.create({
      data: { organizationId: org.id, name: `Sprint 8 Category ${Date.now()}` },
    });

    const uom = await prisma.unitOfMeasure.findFirst({ where: { organizationId: org.id } }) || await prisma.unitOfMeasure.create({
      data: { organizationId: org.id, name: 'Piece', symbol: `pc-s8-${Date.now()}` },
    });

    const taxRule = await prisma.taxRule.findFirst({ where: { organizationId: org.id } }) || await prisma.taxRule.create({
      data: { organizationId: org.id, name: `Tax 5% s8 ${Date.now()}`, rate: 5 },
    });

    const product = await prisma.product.findFirst({ where: { organizationId: org.id } }) || await prisma.product.create({
      data: {
        organizationId: org.id,
        name: 'Payment Pastry',
        categoryId: category.id,
        taxRuleId: taxRule.id,
        uomId: uom.id,
      },
    });

    const variant = await prisma.productVariant.findFirst({ where: { productId: product.id } }) || await prisma.productVariant.create({
      data: {
        organizationId: org.id,
        productId: product.id,
        sku: `SKU-PASTRY-${Date.now()}`,
        name: 'Chocolate Eclair',
      },
    });
    testVariantId = variant.id;

    await prisma.productPricing.upsert({
      where: { variantId: testVariantId },
      update: { sellingPrice: 200, costPrice: 100, mrp: 250 },
      create: { variantId: testVariantId, sellingPrice: 200, costPrice: 100, mrp: 250 },
    });

    await prisma.stockBalance.upsert({
      where: { locationId_variantId: { locationId: testBranchId, variantId: testVariantId } },
      update: { quantity: 1000 },
      create: { locationId: testBranchId, variantId: testVariantId, quantity: 1000 },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Gate 1: 100 duplicate payment webhooks -> 1 captured, 99 idempotent duplicate responses, 1 SALE entry, 1 loyalty award', async () => {
    const userId = crypto.randomUUID();
    const order = await ordersService.createOrder(userId, testOrgId, {
      customerId: testCustomerId,
      branchId: testBranchId,
      items: [{ variantId: testVariantId, quantity: 2 }],
    });

    const eventId = `evt-pay-${Date.now()}`;
    const gatewayRef = `pay_ref_${Date.now()}`;
    const rawPayload = JSON.stringify({
      gatewayRef,
      salesOrderId: order.id,
      amount: 400,
      paymentMethod: 'UPI',
    });

    const webhookSecret = 'test-secret-key';
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawPayload)
      .digest('hex');

    const dto = {
      eventId,
      signature,
      payload: JSON.parse(rawPayload),
    };

    const concurrentWebhooks = Array(100).fill(0).map(() =>
      paymentsService.processWebhook(dto, rawPayload)
    );

    const results = await Promise.all(concurrentWebhooks);
    expect(results.length).toBe(100);

    const nonSuccessful = results.filter((r: any) => !r || r.success !== true);
    if (nonSuccessful.length > 0) {
      console.log('FIRST NON-SUCCESSFUL RESULT:', nonSuccessful[0]);
    }
    expect(nonSuccessful.length).toBe(0);

    const successfulCalls = results.filter((r) => r && r.success === true);

    expect(successfulCalls.length).toBe(100);

    const firstTimeCaptures = results.filter((r: any) => r.success && !r.duplicate);
    const duplicateReplays = results.filter((r: any) => r.success && r.duplicate);

    expect(firstTimeCaptures.length).toBe(1);
    expect(duplicateReplays.length).toBe(99);

    // Verify DB integrity: 1 payment record, 1 order status CONFIRMED, 1 SALE ledger entry, 1 loyalty transaction
    const payments = await prisma.payment.findMany({ where: { gatewayRef } });
    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe('CAPTURED');

    const updatedOrder = await prisma.salesOrder.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('CONFIRMED');

    const saleTxs = await prisma.inventoryTransaction.findMany({
      where: { referenceId: order.id, type: 'SALE' },
    });
    expect(saleTxs.length).toBe(1);

    const loyaltyTxs = await prisma.loyaltyTransaction.findMany({
      where: { orderId: order.id, type: 'EARN' },
    });
    expect(loyaltyTxs.length).toBe(1);
    expect(loyaltyTxs[0].points).toBe(4); // 400 / 100 = 4 points
  });

  it('Gate 2: 100 simultaneous cancellation requests -> 1 succeeded, 99 rejected, reservation released once', async () => {
    const userId = crypto.randomUUID();
    const order = await ordersService.createOrder(userId, testOrgId, {
      customerId: testCustomerId,
      branchId: testBranchId,
      items: [{ variantId: testVariantId, quantity: 1 }],
    });

    const concurrentCancels = Array.from({ length: 100 }).map((_, index) =>
      ordersService
        .transitionStatus(order.id, SalesOrderStatus.CANCELLED, `cancel-key-${order.id}-${index}`, userId)
        .then((res: any) => ({ success: true, res }))
        .catch((err: any) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(concurrentCancels);
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);

    const reservations = await prisma.inventoryReservation.findMany({
      where: { salesOrderId: order.id },
    });
    expect(reservations[0].status).toBe('RELEASED');
  });
});
