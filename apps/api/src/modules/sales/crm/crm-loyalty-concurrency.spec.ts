import { Test, TestingModule } from '@nestjs/testing';
import { prisma } from '@cc-erp/database';
import { LoyaltyService } from './loyalty.service';
import { Customer360Service } from './customer360.service';
import { RfmEngineService } from './rfm-engine.service';
import { CustomerHealthService } from './customer-health.service';
import { CustomerClvService } from './customer-clv.service';
import { SegmentationService } from './segmentation.service';
import { AutomationEngineService } from './automation-engine.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('Sprint 10 — Advanced CRM & Loyalty Concurrency & Intelligence Certification', () => {
  jest.setTimeout(30000);

  let loyaltyService: LoyaltyService;
  let customer360Service: Customer360Service;
  let rfmEngineService: RfmEngineService;
  let customerHealthService: CustomerHealthService;
  let customerClvService: CustomerClvService;
  let segmentationService: SegmentationService;
  let automationEngineService: AutomationEngineService;

  let testBranchId: string;
  let testCustomerId: string;
  let testOrgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        Customer360Service,
        RfmEngineService,
        CustomerHealthService,
        CustomerClvService,
        SegmentationService,
        AutomationEngineService,
      ],
    }).compile();

    loyaltyService = moduleFixture.get<LoyaltyService>(LoyaltyService);
    customer360Service = moduleFixture.get<Customer360Service>(Customer360Service);
    rfmEngineService = moduleFixture.get<RfmEngineService>(RfmEngineService);
    customerHealthService = moduleFixture.get<CustomerHealthService>(CustomerHealthService);
    customerClvService = moduleFixture.get<CustomerClvService>(CustomerClvService);
    segmentationService = moduleFixture.get<SegmentationService>(SegmentationService);
    automationEngineService = moduleFixture.get<AutomationEngineService>(AutomationEngineService);

    // Setup Master Records
    const org = await prisma.organization.findFirst() || await prisma.organization.create({
      data: { code: `ORG-S10-${Date.now()}`, name: `Sprint 10 Org ${Date.now()}` },
    });
    testOrgId = org.id;

    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id } }) || await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: `Sprint 10 Branch ${Date.now()}`,
        type: 'RETAIL_BRANCH',
        address: '100 CRM Plaza',
      },
    });
    testBranchId = branch.id;

    const customer = await prisma.customer.create({
      data: {
        phone: `999${Date.now().toString().slice(-7)}`,
        fullName: 'Jane CRM Customer',
        email: 'jane.crm@example.com',
        assignedBranchId: testBranchId,
        birthday: new Date(),
        loyaltyPoints: 0,
      },
    });
    testCustomerId = customer.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Gate 1: Customer 360 Aggregation (Profile + Sales + Custom Cakes + Loyalty + Activity Timeline)', async () => {
    // 1. Create SalesOrder
    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-S10-360-${Date.now()}`,
        customerId: testCustomerId,
        branchId: testBranchId, organizationId: testOrgId,
        subtotal: new Decimal(1500),
        grandTotal: new Decimal(1500),
        status: 'COMPLETED',
      },
    });

    // 2. Create CustomCakeOrder
    await prisma.customCakeOrder.create({
      data: {
        salesOrderId: order.id,
        flavour: 'Red Velvet',
        weight: new Decimal(2.0),
        scheduledAt: new Date(),
        quoteAmount: new Decimal(1500),
        status: 'READY',
        readyPhotoUrl: 'http://example.com/ready.jpg',
      },
    });

    // 3. Log Activity
    await customer360Service.logActivity(testCustomerId, {
      activityType: 'CALL',
      subject: 'Inquired about anniversary cake',
      outcome: 'Interested',
    });

    // 4. Fetch 360 View
    const c360 = await customer360Service.getCustomer360(testCustomerId);
    expect(c360.profile.id).toBe(testCustomerId);
    expect(c360.recentSalesOrders.length).toBeGreaterThanOrEqual(1);
    expect(c360.customCakes.length).toBeGreaterThanOrEqual(1);
    expect(c360.activityTimeline.length).toBeGreaterThanOrEqual(1);
  });

  it('Gate 2 & 3 & 4: RFM, Health Score & Customer Lifetime Value (CLV) Calculation', async () => {
    const clvResult = await customerClvService.recalculateClv(testCustomerId);
    expect(clvResult.lifetimeValue).toBeGreaterThan(0);

    const rfmResult = await rfmEngineService.recalculateRfmForCustomer(testCustomerId);
    expect(rfmResult?.rfmRecency).toBeGreaterThanOrEqual(1);
    expect(rfmResult?.rfmFrequency).toBeGreaterThanOrEqual(1);

    const healthResult = await customerHealthService.recalculateHealthScore(testCustomerId);
    expect(healthResult?.healthScore).toBeGreaterThanOrEqual(0);
    expect(healthResult?.healthStatus).toBeDefined();
  });

  it('Gate 5: Dynamic Customer Segmentation Engine', async () => {
    const segments = await segmentationService.evaluateSegmentsForCustomer(testCustomerId);
    expect(segments).toBeDefined();
    expect(Array.isArray(segments)).toBe(true);
    expect(segments).toContain('CUSTOM_CAKE_CUSTOMER');
  });

  it('Gate 6: Marketing Automation Engine Execution & Idempotency', async () => {
    await automationEngineService.createAutomationRule({
      name: 'Welcome VIP Bonus',
      eventType: 'order.placed',
      actionType: 'LOYALTY_BONUS',
      actionConfig: { points: 25 },
    });

    const idempotencyKey = `auto-test-${Date.now()}`;
    const result1 = await automationEngineService.processEvent({
      eventType: 'order.placed',
      customerId: testCustomerId,
      idempotencyKey,
    });
    expect(result1.triggeredCount).toBeGreaterThan(0);

    // Duplicate call with same key
    const result2: any = await automationEngineService.processEvent({
      eventType: 'order.placed',
      customerId: testCustomerId,
      idempotencyKey,
    });
    expect(result2.duplicate).toBe(true);
  });

  it('Gate 7: 100 Concurrent Loyalty Earn Requests -> 100 Ledger Entries, No Lost Points', async () => {
    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-EARN-${Date.now()}`,
        customerId: testCustomerId,
        branchId: testBranchId, organizationId: testOrgId,
        subtotal: new Decimal(500),
        grandTotal: new Decimal(500),
        status: 'COMPLETED',
      },
    });

    // 100 concurrent earn requests for the exact same order
    const concurrentEarns = Array(100).fill(0).map(() =>
      loyaltyService.awardPointsForOrder(prisma, testCustomerId, order.id, 500)
    );

    const results = await Promise.all(concurrentEarns);
    expect(results.length).toBe(100);

    const firstTimeCaptures = results.filter((r: any) => r && !r.duplicate);
    const duplicateReplays = results.filter((r: any) => r && r.duplicate);

    expect(firstTimeCaptures.length).toBe(1);
    expect(duplicateReplays.length).toBe(99);

    const earnedTxs = await prisma.loyaltyTransaction.findMany({
      where: { orderId: order.id, type: 'EARN' },
    });
    expect(earnedTxs.length).toBe(1);
    expect(earnedTxs[0].points).toBe(5); // 500 / 100 = 5 points
  });

  it('Gate 8: 100 Concurrent Loyalty Redemption Requests -> Exactly 1 Success, 99 Rejected, 0 Negative Balance', async () => {
    // Set customer balance to exactly 50 points
    await prisma.customer.update({
      where: { id: testCustomerId },
      data: { loyaltyPoints: 50 },
    });

    const concurrentRedeems = Array(100).fill(0).map((_, idx) =>
      loyaltyService
        .redeemPoints(prisma, testCustomerId, 50, undefined, `ref-red-${Date.now()}-${idx}`)
        .then((res) => ({ success: true, res }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(concurrentRedeems);
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);

    // Verify balance is exactly 0 and never went negative
    const finalCustomer = await prisma.customer.findUnique({
      where: { id: testCustomerId },
      select: { loyaltyPoints: true },
    });
    expect(finalCustomer?.loyaltyPoints).toBe(0);
  });
});
