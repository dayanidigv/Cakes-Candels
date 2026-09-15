import { Test, TestingModule } from '@nestjs/testing';
import { FiscalCalendarService, RequestingUser } from '../services/fiscal-calendar.service';
import { prisma } from '@cc-erp/database';
import { FiscalPeriodStatus } from '@prisma/client';
import { ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('Sprint 12 — Phase 12.2: Fiscal Calendar & Period Lock Suite', () => {
  let service: FiscalCalendarService;

  const userOrgA: RequestingUser = {
    id: '33333333-3333-3333-3333-333333333333',
      userId: '33333333-3333-3333-3333-333333333333',
      permissions: [],
      scope: 'GLOBAL',
    organizationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    role: 'SUPER_ADMIN',
    permissions: ['finance:period:create', 'finance:period:read', 'finance:period:close', 'finance:period:reopen', 'finance:period:lock'],
  };

  let fiscalYearId: string;
  let period1Id: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FiscalCalendarService],
    }).compile();

    service = module.get<FiscalCalendarService>(FiscalCalendarService);

    // Clean up
    await prisma.fiscalYear.deleteMany({
      where: { organizationId: userOrgA.organizationId },
    });

    await prisma.organization.upsert({
      where: { id: userOrgA.organizationId },
      userId: userOrgA.organizationId },
      permissions: [],
      scope: 'GLOBAL',
      create: { id: userOrgA.organizationId,
      userId: userOrgA.organizationId,
      permissions: [],
      scope: 'GLOBAL', code: 'TEST_ORG_C', name: 'Test Org C' },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.fiscalYear.deleteMany({
      where: { organizationId: userOrgA.organizationId },
    });
  });

  it('1. should create a valid Fiscal Year', async () => {
    const fy = await service.createFiscalYear(
      {
        name: 'FY 2026-2027',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
      userOrgA,
    );

    expect(fy).toBeDefined();
    expect(fy.name).toBe('FY 2026-2027');
    expect(fy.organizationId).toBe(userOrgA.organizationId);
    fiscalYearId = fy.id;
  });

  it('2. should reject overlapping Fiscal Year for same organization', async () => {
    await expect(
      service.createFiscalYear(
        {
          name: 'FY 2026-2027 OVERLAP',
          startDate: '2026-06-01',
          endDate: '2027-05-31',
        },
        userOrgA,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('3. should create a valid Fiscal Period within Fiscal Year', async () => {
    const period = await service.createFiscalPeriod(
      {
        fiscalYearId,
        periodNumber: 1,
        name: 'April 2026',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      },
      userOrgA,
    );

    expect(period).toBeDefined();
    expect(period.periodNumber).toBe(1);
    expect(period.status).toBe(FiscalPeriodStatus.OPEN);
    period1Id = period.id;
  });

  it('4. should reject period dates outside Fiscal Year bounds', async () => {
    await expect(
      service.createFiscalPeriod(
        {
          fiscalYearId,
          periodNumber: 2,
          name: 'Invalid March Period',
          startDate: '2026-03-01', // Before FY start (2026-04-01)
          endDate: '2026-03-31',
        },
        userOrgA,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. should reject duplicate period number in same Fiscal Year', async () => {
    await expect(
      service.createFiscalPeriod(
        {
          fiscalYearId,
          periodNumber: 1, // Already exists
          name: 'April Duplicate',
          startDate: '2026-05-01',
          endDate: '2026-05-31',
        },
        userOrgA,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('6. should reject overlapping period dates in same Fiscal Year', async () => {
    await expect(
      service.createFiscalPeriod(
        {
          fiscalYearId,
          periodNumber: 2,
          name: 'April Overlap',
          startDate: '2026-04-15', // Overlaps with Period 1 (April 01-30)
          endDate: '2026-05-15',
        },
        userOrgA,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('7. should resolve active fiscal period for a valid posting date', async () => {
    const postingDate = new Date('2026-04-15');
    const period = await service.resolveFiscalPeriodForDate(userOrgA.organizationId, postingDate);

    expect(period).toBeDefined();
    expect(period.id).toBe(period1Id);
    expect(period.periodNumber).toBe(1);
  });

  it('8. should transition period from OPEN -> CLOSED (CAS)', async () => {
    const closed = await service.closePeriod(period1Id, userOrgA);

    expect(closed.status).toBe(FiscalPeriodStatus.CLOSED);
    expect(closed.closedBy).toBe(userOrgA.id);
    expect(closed.closedAt).toBeDefined();
  });

  it('9. should reject closing an already CLOSED period', async () => {
    await expect(service.closePeriod(period1Id, userOrgA)).rejects.toThrow(BadRequestException);
  });

  it('10. should reject posting date resolution when period is CLOSED', async () => {
    const postingDate = new Date('2026-04-15');
    await expect(service.resolveFiscalPeriodForDate(userOrgA.organizationId, postingDate)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('11. should reopen closed period with valid reason (CAS: CLOSED -> OPEN)', async () => {
    const reopened = await service.reopenPeriod(
      period1Id,
      { reason: 'Auditor requested late accrual adjustments' },
      userOrgA,
    );

    expect(reopened.status).toBe(FiscalPeriodStatus.OPEN);
    expect(reopened.closedBy).toBeNull();
  });

  it('12. should lock a closed period permanently (CAS: CLOSED -> LOCKED)', async () => {
    // Re-close period first
    await service.closePeriod(period1Id, userOrgA);

    // Lock period
    const locked = await service.lockPeriod(period1Id, userOrgA);
    expect(locked.status).toBe(FiscalPeriodStatus.LOCKED);

    // Attempting to reopen a LOCKED period must fail with ForbiddenException
    await expect(
      service.reopenPeriod(period1Id, { reason: 'Attempting to break sealed audit' }, userOrgA),
    ).rejects.toThrow(ForbiddenException);
  });
});
