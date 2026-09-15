import { Test, TestingModule } from '@nestjs/testing';
import { prisma, CustomCakeStatus } from '@cc-erp/database';
import { CustomCakesService } from './custom-cakes.service';
import * as crypto from 'crypto';

describe('Sprint 9 — Custom Cake Lifecycle & Factory Integration Certification', () => {
  jest.setTimeout(20000);
  let customCakesService: CustomCakesService;

  let testBranchId: string;
  let testCustomerId: string;
  let testOrgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [CustomCakesService],
    }).compile();

    customCakesService = moduleFixture.get<CustomCakesService>(CustomCakesService);

    const org = await prisma.organization.findFirst() || await prisma.organization.create({
      data: { code: `ORG-S9-${Date.now()}`, name: `Sprint 9 Org ${Date.now()}` },
    });
    testOrgId = org.id;

    const branch = await prisma.branch.findFirst({ where: { organizationId: org.id } }) || await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: `Sprint 9 Bakery Branch ${Date.now()}`,
        type: 'RETAIL_BRANCH',
        address: '789 Custom Cake Boulevard',
      },
    });
    testBranchId = branch.id;

    const customer = await prisma.customer.findFirst() || await prisma.customer.create({
      data: { phone: `999${Date.now().toString().slice(-7)}`, fullName: 'Custom Cake Client' },
    });
    testCustomerId = customer.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Gate 1: Full Custom Cake Production Lifecycle State Machine Execution', async () => {
    const userId = crypto.randomUUID();
    const customCake = await customCakesService.createQuote(userId, testOrgId, {
      customerId: testCustomerId,
      branchId: testBranchId,
      flavour: 'Red Velvet Vanilla Fusion',
      weight: 3.5,
      shape: 'HEART',
      layers: 3,
      filling: 'Cream Cheese Frosting',
      icing: 'Fondant',
      decorationNotes: 'Gold edible foil with sugar roses',
      messageOnCake: 'Happy 50th Anniversary Mom & Dad!',
      scheduledAt: new Date(Date.now() + 86400000 * 2),
      quoteAmount: 5000,
      advancePercentage: 50,
    });

    expect(customCake.status).toBe(CustomCakeStatus.QUOTED);
    expect(Number(customCake.advanceAmount)).toBe(2500);
    expect(Number(customCake.balanceAmount)).toBe(2500);

    // Transition through all production stages
    const stages: CustomCakeStatus[] = [
      CustomCakeStatus.ADVANCE_PENDING,
      CustomCakeStatus.CONFIRMED,
      CustomCakeStatus.SCHEDULED,
      CustomCakeStatus.IN_PRODUCTION,
      CustomCakeStatus.BAKING,
      CustomCakeStatus.ICING,
      CustomCakeStatus.DECORATION,
      CustomCakeStatus.QC,
    ];

    let current = customCake;
    for (const stage of stages) {
      current = (await customCakesService.transitionStatus(current.id, stage, undefined, userId))!;
      expect(current.status).toBe(stage);
    }

    // Pass QC Gate with Ready Photo
    const readyPhotoUrl = 'https://cdn.cakesandcandles.com/custom-cakes/photo-123.jpg';
    const qcApprovedBy = crypto.randomUUID();
    const qcResult = await customCakesService.passQcGate({
      customCakeOrderId: current.id,
      readyPhotoUrl,
      qcNotes: 'All decoration and inscription verified against design reference.',
      approvedBy: qcApprovedBy,
    });

    expect(qcResult.status).toBe(CustomCakeStatus.READY);
    expect(qcResult.readyPhotoUrl).toBe(readyPhotoUrl);
    expect(qcResult.qcApprovedBy).toBe(qcApprovedBy);

    // Complete fulfillment
    const dispatched = (await customCakesService.transitionStatus(current.id, CustomCakeStatus.DISPATCHED, undefined, userId))!;
    expect(dispatched.status).toBe(CustomCakeStatus.DISPATCHED);

    const delivered = (await customCakesService.transitionStatus(current.id, CustomCakeStatus.DELIVERED, undefined, userId))!;
    expect(delivered.status).toBe(CustomCakeStatus.DELIVERED);

    const completed = (await customCakesService.transitionStatus(current.id, CustomCakeStatus.COMPLETED, undefined, userId))!;
    expect(completed.status).toBe(CustomCakeStatus.COMPLETED);
  });

  it('Gate 2: 100 concurrent state transition requests -> 1 succeeded, 99 rejected', async () => {
    const userId = crypto.randomUUID();
    const customCake = await customCakesService.createQuote(userId, testOrgId, {
      customerId: testCustomerId,
      branchId: testBranchId,
      flavour: 'Truffle Chocolate',
      weight: 2,
      scheduledAt: new Date(Date.now() + 86400000),
      quoteAmount: 3000,
    });

    // Move to CONFIRMED
    await customCakesService.transitionStatus(customCake.id, CustomCakeStatus.ADVANCE_PENDING, undefined, userId);
    await customCakesService.transitionStatus(customCake.id, CustomCakeStatus.CONFIRMED, undefined, userId);

    // Fire 100 concurrent requests to transition to SCHEDULED
    const concurrentRequests = Array(100).fill(0).map((_, index) =>
      customCakesService
        .transitionStatus(customCake.id, CustomCakeStatus.SCHEDULED, `idemp-sched-${customCake.id}-${index}`, userId)
        .then((res) => ({ success: true, res }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(concurrentRequests);
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);

    const finalOrder = await prisma.customCakeOrder.findUnique({ where: { id: customCake.id } });
    expect(finalOrder?.status).toBe(CustomCakeStatus.SCHEDULED);
  });

  it('Gate 3: 100 concurrent QC photo approval gate submissions -> 1 approved, 99 rejected/failed state transition', async () => {
    const userId = crypto.randomUUID();
    const customCake = await customCakesService.createQuote(userId, testOrgId, {
      customerId: testCustomerId,
      branchId: testBranchId,
      flavour: 'Mango Passionfruit',
      weight: 1.5,
      scheduledAt: new Date(Date.now() + 86400000),
      quoteAmount: 2200,
    });

    // Advance to QC
    const stages = [
      CustomCakeStatus.ADVANCE_PENDING,
      CustomCakeStatus.CONFIRMED,
      CustomCakeStatus.SCHEDULED,
      CustomCakeStatus.IN_PRODUCTION,
      CustomCakeStatus.BAKING,
      CustomCakeStatus.ICING,
      CustomCakeStatus.DECORATION,
      CustomCakeStatus.QC,
    ];

    let current = customCake;
    for (const stage of stages) {
      current = (await customCakesService.transitionStatus(current.id, stage, undefined, userId))!;
    }

    // Fire 100 concurrent QC approvals
    const concurrentQc = Array(100).fill(0).map(() =>
      customCakesService
        .passQcGate({
          customCakeOrderId: current.id,
          readyPhotoUrl: 'https://cdn.cakesandcandles.com/custom-cakes/mango-qc.jpg',
          qcNotes: 'QC passed',
          approvedBy: userId,
        })
        .then((res) => ({ success: true, res }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(concurrentQc);
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);

    const finalCake = await prisma.customCakeOrder.findUnique({ where: { id: current.id } });
    expect(finalCake?.status).toBe(CustomCakeStatus.READY);
  });
});
