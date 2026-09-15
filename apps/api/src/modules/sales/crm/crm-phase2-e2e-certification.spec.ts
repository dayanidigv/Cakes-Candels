import { Test, TestingModule } from '@nestjs/testing';
import { prisma } from '@cc-erp/database';
import { LoyaltyService } from './loyalty.service';
import { Customer360Service } from './customer360.service';
import { RfmEngineService } from './rfm-engine.service';
import { CustomerHealthService } from './customer-health.service';
import { CustomerClvService } from './customer-clv.service';
import { SegmentationService } from './segmentation.service';
import { AutomationEngineService } from './automation-engine.service';
import { CrmController } from './crm.controller';
import { Decimal } from '@prisma/client/runtime/library';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../../common/guards/branch-scope.guard';

describe('Sprint 10 Phase 2 — CRM & Loyalty End-to-End Business Flow Certification', () => {
  jest.setTimeout(35000);

  let loyaltyService: LoyaltyService;
  let customer360Service: Customer360Service;
  let rfmEngineService: RfmEngineService;
  let customerHealthService: CustomerHealthService;
  let customerClvService: CustomerClvService;
  let segmentationService: SegmentationService;
  let automationEngineService: AutomationEngineService;
  let crmController: CrmController;

  let orgAId: string;
  let orgBId: string;
  let branchA1Id: string;
  let branchA2Id: string;
  let branchB1Id: string;

  let customerAId: string;
  let customerBId: string;
  let customerOrgBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CrmController],
      providers: [
        LoyaltyService,
        Customer360Service,
        RfmEngineService,
        CustomerHealthService,
        CustomerClvService,
        SegmentationService,
        AutomationEngineService,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(BranchScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    loyaltyService = moduleFixture.get<LoyaltyService>(LoyaltyService);
    customer360Service = moduleFixture.get<Customer360Service>(Customer360Service);
    rfmEngineService = moduleFixture.get<RfmEngineService>(RfmEngineService);
    customerHealthService = moduleFixture.get<CustomerHealthService>(CustomerHealthService);
    customerClvService = moduleFixture.get<CustomerClvService>(CustomerClvService);
    segmentationService = moduleFixture.get<SegmentationService>(SegmentationService);
    automationEngineService = moduleFixture.get<AutomationEngineService>(AutomationEngineService);
    crmController = moduleFixture.get<CrmController>(CrmController);

    // 1. Setup Isolated Multi-Tenant Organizations & Branches
    const orgA = await prisma.organization.create({
      data: { code: `ORG-A-${Date.now()}`, name: `Organization A ${Date.now()}` },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: { code: `ORG-B-${Date.now()}`, name: `Organization B ${Date.now()}` },
    });
    orgBId = orgB.id;

    const ts = Date.now();
    const branchA1 = await prisma.branch.create({
      data: { organizationId: orgAId, name: `Branch A1 ${ts}`, type: 'RETAIL_BRANCH', address: '101 St' },
    });
    branchA1Id = branchA1.id;

    const branchA2 = await prisma.branch.create({
      data: { organizationId: orgAId, name: `Branch A2 ${ts}`, type: 'RETAIL_BRANCH', address: '102 St' },
    });
    branchA2Id = branchA2.id;

    const branchB1 = await prisma.branch.create({
      data: { organizationId: orgBId, name: `Branch B1 ${ts}`, type: 'RETAIL_BRANCH', address: '201 St' },
    });
    branchB1Id = branchB1.id;

    // 2. Setup Controlled Customer Profiles
    // Customer A: High Value / VIP candidate
    const customerA = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        assignedBranchId: branchA1Id,
        phone: `911${Date.now().toString().slice(-7)}`,
        fullName: 'VIP Customer A',
        email: 'customer.a@orga.com',
        loyaltyPoints: 0,
      },
    });
    customerAId = customerA.id;

    // Customer B: Dormant / Low Value candidate
    const customerB = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        assignedBranchId: branchA1Id,
        phone: `922${Date.now().toString().slice(-7)}`,
        fullName: 'Dormant Customer B',
        email: 'customer.b@orga.com',
        loyaltyPoints: 0,
      },
    });
    customerBId = customerB.id;

    // Customer Org B: Org B tenant isolation candidate
    const customerOrgB = await prisma.customer.create({
      data: {
        organizationId: orgBId,
        assignedBranchId: branchB1Id,
        phone: `933${Date.now().toString().slice(-7)}`,
        fullName: 'Tenant B Customer',
        email: 'customer@orgb.com',
        loyaltyPoints: 0,
      },
    });
    customerOrgBId = customerOrgB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ==========================================
  // GATE 1: Customer 360 End-to-End Aggregation
  // ==========================================
  it('Gate 1: Customer 360 Aggregation End-to-End Flow', async () => {
    // 1. Create SalesOrder
    const salesOrder = await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-C360-${Date.now()}`,
        customerId: customerAId,
        branchId: branchA1Id, organizationId: orgAId,
        subtotal: new Decimal(2000),
        grandTotal: new Decimal(2000),
        status: 'COMPLETED',
      },
    });

    // 2. Create CustomCakeOrder
    await prisma.customCakeOrder.create({
      data: {
        salesOrderId: salesOrder.id,
        flavour: 'Chocolate Truffle',
        weight: new Decimal(3.0),
        scheduledAt: new Date(),
        quoteAmount: new Decimal(2000),
        status: 'READY',
        readyPhotoUrl: 'http://example.com/ready-cake.jpg',
      },
    });

    // 3. Award Loyalty Points
    await loyaltyService.awardPointsForOrder(prisma, customerAId, salesOrder.id, 2000);

    // 4. Log CRM Activity
    await customer360Service.logActivity(customerAId, {
      activityType: 'NOTE',
      subject: 'Prefers dark chocolate icing',
      description: 'Customer requested 70% dark chocolate',
    });

    // 5. Query Customer 360 via Controller
    const reqMock: any = { user: { branchId: branchA1Id, scope: 'BRANCH' } };
    const c360 = await crmController.getCustomer360(customerAId, reqMock);

    expect(c360.profile.id).toBe(customerAId);
    expect(c360.profile.fullName).toBe('VIP Customer A');
    expect(c360.recentSalesOrders.length).toBeGreaterThanOrEqual(1);
    expect(c360.customCakes.length).toBeGreaterThanOrEqual(1);
    expect(c360.loyaltyLedger.length).toBeGreaterThanOrEqual(1);
    expect(c360.activityTimeline.length).toBeGreaterThanOrEqual(1);
    expect(c360.intelligence).toBeDefined();
  });

  // ==========================================
  // GATE 2: Mathematical RFM Scoring Engine
  // ==========================================
  it('Gate 2: Mathematical RFM Scoring (VIP / High Value vs. Dormant / Lost)', async () => {
    // 1. Customer A: Add 5 high-value completed sales orders in past week
    for (let i = 0; i < 5; i++) {
      await prisma.salesOrder.create({
        data: {
          orderNumber: `SO-RFM-A-${i}-${Date.now()}`,
          customerId: customerAId,
          branchId: branchA1Id, organizationId: orgAId,
          subtotal: new Decimal(6000),
          grandTotal: new Decimal(6000),
          status: 'COMPLETED',
        },
      });
    }

    const rfmA = await rfmEngineService.recalculateRfmForCustomer(customerAId);
    expect(rfmA?.rfmRecency).toBe(5); // Recency <= 7 days -> 5
    expect(rfmA?.rfmFrequency).toBeGreaterThanOrEqual(4); // 5+ orders -> 4 or 5
    expect(rfmA?.rfmMonetary).toBe(5); // Spend > 25000 -> 5
    expect(rfmA?.rfmSegment).toBe('CHAMPIONS');

    // 2. Customer B: Old purchase 280 days ago, low spend
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 280);

    await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-RFM-B-${Date.now()}`,
        customerId: customerBId,
        branchId: branchA1Id, organizationId: orgAId,
        subtotal: new Decimal(1000),
        grandTotal: new Decimal(1000),
        status: 'COMPLETED',
        createdAt: oldDate,
      },
    });

    const rfmB = await rfmEngineService.recalculateRfmForCustomer(customerBId);
    expect(rfmB?.rfmRecency).toBe(1); // Days > 180 -> 1
    expect(rfmB?.rfmFrequency).toBe(1); // 1 order -> 1
    expect(rfmB?.rfmSegment).toBe('HIBERNATING');
  });

  // ==========================================
  // GATE 3: Customer Health Score & Isolation
  // ==========================================
  it('Gate 3: Customer Health Score Penalties & Status Mapping', async () => {
    // Customer A has recent orders -> expect HEALTHY
    const healthA = await customerHealthService.recalculateHealthScore(customerAId);
    expect(healthA?.healthScore).toBeGreaterThanOrEqual(80);
    expect(healthA?.healthStatus).toBe('HEALTHY');

    // Customer B has 2 complaints -> expect health score penalty
    await prisma.crmActivity.create({
      data: {
        customerId: customerBId,
        activityType: 'COMPLAINT',
        subject: 'Late delivery',
      },
    });
    await prisma.crmActivity.create({
      data: {
        customerId: customerBId,
        activityType: 'COMPLAINT',
        subject: 'Wrong icing colour',
      },
    });

    const healthB = await customerHealthService.recalculateHealthScore(customerBId);
    expect(healthB?.healthScore).toBeLessThan(80);
    expect(['AT_RISK', 'DORMANT', 'CHURNED']).toContain(healthB?.healthStatus);
  });

  // ==========================================
  // GATE 4: Commercial Customer Lifetime Value (CLV)
  // ==========================================
  it('Gate 4: Commercial CLV Calculation (Excludes Draft & Cancelled Orders)', async () => {
    // Add completed order: 1000, 2500, 4000 = 7500
    const custClvTest = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        assignedBranchId: branchA1Id,
        phone: `944${Date.now().toString().slice(-7)}`,
        fullName: 'CLV Test Customer',
        email: 'clv@test.com',
      },
    });

    await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-CLV-1-${Date.now()}`,
        customerId: custClvTest.id,
        branchId: branchA1Id, organizationId: orgAId,
        subtotal: new Decimal(1000),
        grandTotal: new Decimal(1000),
        status: 'COMPLETED',
      },
    });
    await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-CLV-2-${Date.now()}`,
        customerId: custClvTest.id,
        branchId: branchA1Id, organizationId: orgAId,
        subtotal: new Decimal(2500),
        grandTotal: new Decimal(2500),
        status: 'COMPLETED',
      },
    });
    await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-CLV-3-${Date.now()}`,
        customerId: custClvTest.id,
        branchId: branchA1Id, organizationId: orgAId,
        subtotal: new Decimal(4000),
        grandTotal: new Decimal(4000),
        status: 'COMPLETED',
      },
    });
    // Cancelled order (should NOT be added to CLV)
    await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-CLV-CANCEL-${Date.now()}`,
        customerId: custClvTest.id,
        branchId: branchA1Id, organizationId: orgAId,
        subtotal: new Decimal(5000),
        grandTotal: new Decimal(5000),
        status: 'CANCELLED',
      },
    });

    const clvResult = await customerClvService.recalculateClv(custClvTest.id);
    expect(clvResult.lifetimeValue).toBe(7500);
    expect(clvResult.totalOrders).toBe(3);
    expect(clvResult.averageOrderValue).toBe(2500);
  });

  // ==========================================
  // GATE 5: Dynamic Segmentation Addition & Removal
  // ==========================================
  it('Gate 5: Customer Segment Addition & Dynamic Removal Sync', async () => {
    // Customer A has LTV > 20,000 -> expect VIP & HIGH_VALUE
    await customerClvService.recalculateClv(customerAId);
    await rfmEngineService.recalculateRfmForCustomer(customerAId);

    const segments1 = await segmentationService.evaluateSegmentsForCustomer(customerAId);
    expect(segments1).toContain('VIP');
    expect(segments1).toContain('HIGH_VALUE');

    // Verify DB mappings
    const mappingsBefore = await prisma.customerSegmentMapping.findMany({
      where: { customerId: customerAId },
      include: { segment: true },
    });
    const codesBefore = mappingsBefore.map((m) => m.segment.code);
    expect(codesBefore).toContain('VIP');

    // Simulate downgrade: reset LTV to 0 and RFM to LOST
    await prisma.customer.update({
      where: { id: customerAId },
      data: { lifetimeValue: new Decimal(0), rfmSegment: 'LOST' },
    });

    const segments2 = await segmentationService.evaluateSegmentsForCustomer(customerAId);
    expect(segments2).not.toContain('VIP');
    expect(segments2).not.toContain('HIGH_VALUE');

    // Verify DB mapping removed VIP tag
    const mappingsAfter = await prisma.customerSegmentMapping.findMany({
      where: { customerId: customerAId },
      include: { segment: true },
    });
    const codesAfter = mappingsAfter.map((m) => m.segment.code);
    expect(codesAfter).not.toContain('VIP');
  });

  // ==========================================
  // GATE 6: Complete Loyalty Earning, Redemption & Reversal Lifecycle
  // ==========================================
  it('Gate 6: Complete Loyalty Lifecycle (Earn -> Redeem -> Reversal)', async () => {
    const custLoyalty = await prisma.customer.create({
      data: {
        organizationId: orgAId,
        assignedBranchId: branchA1Id,
        phone: `955${Date.now().toString().slice(-7)}`,
        fullName: 'Loyalty Lifecycle Customer',
        email: 'loyalty@lifecycle.com',
        loyaltyPoints: 0,
      },
    });

    // 1. Earn Points
    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-LOY-${Date.now()}`,
        customerId: custLoyalty.id,
        branchId: branchA1Id, organizationId: orgAId,
        subtotal: new Decimal(10000),
        grandTotal: new Decimal(10000),
        status: 'COMPLETED',
      },
    });

    const earnResult: any = await loyaltyService.awardPointsForOrder(prisma, custLoyalty.id, order.id, 10000);
    expect(earnResult.success).toBe(true);
    expect(earnResult.duplicate).toBe(false);

    let customerNow = await prisma.customer.findUnique({ where: { id: custLoyalty.id } });
    expect(customerNow?.loyaltyPoints).toBe(100); // 10,000 / 100 = 100 points

    // 2. Redeem 40 Points
    const redeemTx = await loyaltyService.redeemPoints(prisma, custLoyalty.id, 40, order.id, 'REF-RED-1');
    expect(redeemTx.points).toBe(-40);

    customerNow = await prisma.customer.findUnique({ where: { id: custLoyalty.id } });
    expect(customerNow?.loyaltyPoints).toBe(60);

    // 3. Reverse Earning Transaction (Original Earn of 100 points reversed)
    const originalEarnTx = earnResult.loyaltyTx;
    const adminUserId = crypto.randomUUID();
    const reversalTx = await loyaltyService.reverseTransaction(prisma, originalEarnTx.id, adminUserId, 'Order Returned');
    expect(reversalTx.points).toBe(-100);

    customerNow = await prisma.customer.findUnique({ where: { id: custLoyalty.id } });
    expect(customerNow?.loyaltyPoints).toBe(-40); // 60 - 100 = -40 ledger adjustment

    // 4. Verify Ledger Sum
    const ledgerSum = await loyaltyService.getLedgerBalance(custLoyalty.id);
    expect(ledgerSum).toBe(-40);
  });

  // ==========================================
  // GATE 7: Idempotent Event-Driven Marketing Automation
  // ==========================================
  it('Gate 7: Marketing Automation Engine Event Processing & 100-Way Idempotency', async () => {
    await automationEngineService.createAutomationRule({
      name: 'Welcome Gift',
      eventType: 'customer.created',
      actionType: 'LOYALTY_BONUS',
      actionConfig: { points: 50 },
    });

    const idempotencyKey = `auto-e2e-${Date.now()}`;
    const concurrentEvents = Array(100).fill(0).map(() =>
      automationEngineService.processEvent({
        eventType: 'customer.created',
        customerId: customerAId,
        idempotencyKey,
      })
    );

    const results = await Promise.all(concurrentEvents);
    expect(results.length).toBe(100);

    const firstRuns = results.filter((r: any) => r && !r.duplicate);
    const duplicates = results.filter((r: any) => r && r.duplicate);

    expect(firstRuns.length).toBe(1);
    expect(duplicates.length).toBe(99);
  });

  // ==========================================
  // GATE 8: Tenant & Branch Isolation Protection
  // ==========================================
  it('Gate 8: Multi-Tenant & Branch Scope Access Isolation', async () => {
    // 1. Access Customer Org B using Org A Branch Scope -> expect ForbiddenException
    const branchScopeOptions = { userBranchId: branchA1Id, scope: 'BRANCH' as const };

    await expect(
      customer360Service.getCustomer360(customerOrgBId, branchScopeOptions)
    ).rejects.toThrow(ForbiddenException);

    // 2. Access Non-existent Customer -> expect NotFoundException
    await expect(
      customer360Service.getCustomer360('00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow(NotFoundException);
  });
});
