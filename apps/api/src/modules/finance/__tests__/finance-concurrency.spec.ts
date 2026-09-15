import { Test, TestingModule } from '@nestjs/testing';
import { AccountService, RequestingUser } from '../services/account.service';
import { FiscalCalendarService } from '../services/fiscal-calendar.service';
import { prisma } from '@cc-erp/database';
import { AccountType, AccountCategory, BalanceType, FiscalPeriodStatus } from '@prisma/client';

describe('Sprint 12 — Phase 12.2: 100-Thread Concurrency & Idempotency Suite', () => {
  let accountService: AccountService;
  let fiscalService: FiscalCalendarService;

  const userOrg: RequestingUser = {
    id: '44444444-4444-4444-4444-444444444444',
      userId: '44444444-4444-4444-4444-444444444444',
      permissions: [],
      scope: 'GLOBAL',
    organizationId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    role: 'SUPER_ADMIN',
    permissions: ['finance:coa:create', 'finance:coa:read', 'finance:period:create', 'finance:period:close'],
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountService, FiscalCalendarService],
    }).compile();

    accountService = module.get<AccountService>(AccountService);
    fiscalService = module.get<FiscalCalendarService>(FiscalCalendarService);

    // Clean up
    await prisma.account.deleteMany({ where: { organizationId: userOrg.organizationId } });
    await prisma.fiscalYear.deleteMany({ where: { organizationId: userOrg.organizationId } });

    await prisma.organization.upsert({
      where: { id: userOrg.organizationId },
      userId: userOrg.organizationId },
      permissions: [],
      scope: 'GLOBAL',
      create: { id: userOrg.organizationId,
      userId: userOrg.organizationId,
      permissions: [],
      scope: 'GLOBAL', code: 'CONCURRENCY_ORG', name: 'Concurrency Test Org' },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { organizationId: userOrg.organizationId } });
    await prisma.fiscalYear.deleteMany({ where: { organizationId: userOrg.organizationId } });
  });

  it('1. 100 concurrent account creation attempts with identical code -> exactly 1 succeeds', async () => {
    const targetCode = '11999';
    const promises = Array.from({ length: 100 }, (_, i) =>
      accountService
        .createAccount(
          {
            code: targetCode,
            name: `Concurrent Account ${i}`,
            type: AccountType.ASSET,
            category: AccountCategory.CASH_AND_EQUIVALENTS,
            normalBalance: BalanceType.DEBIT,
          },
          userOrg,
        )
        .then(() => ({ status: 'fulfilled' }))
        .catch((err) => ({ status: 'rejected', error: err })),
    );

    const results = await Promise.all(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(99);

    const count = await prisma.account.count({
      where: { organizationId: userOrg.organizationId, code: targetCode },
    });
    expect(count).toBe(1);
  });

  it('2. 100 concurrent period closing attempts -> exactly 1 succeeds (CAS protection)', async () => {
    // Create FY & Period
    const fy = await fiscalService.createFiscalYear(
      {
        name: 'FY 2026-CONCURRENCY',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
      userOrg,
    );

    const period = await fiscalService.createFiscalPeriod(
      {
        fiscalYearId: fy.id,
        periodNumber: 1,
        name: 'April 2026',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      },
      userOrg,
    );

    // 100 concurrent closing attempts
    const promises = Array.from({ length: 100 }, () =>
      fiscalService
        .closePeriod(period.id, userOrg)
        .then(() => ({ status: 'fulfilled' }))
        .catch((err) => ({ status: 'rejected', error: err })),
    );

    const results = await Promise.all(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(99);

    const updated = await prisma.fiscalPeriod.findUnique({ where: { id: period.id } });
    expect(updated!.status).toBe(FiscalPeriodStatus.CLOSED);
  });

  it('3. 100 concurrent standard bakery COA seeds -> completely idempotent',
      userId: period.id } });
    expect(updated!.status).toBe(FiscalPeriodStatus.CLOSED);
  });

  it('3. 100 concurrent standard bakery COA seeds -> completely idempotent',
      permissions: [],
      scope: 'GLOBAL', async () => {
    const promises = Array.from({ length: 100 }, () =>
      accountService.seedSystemAccounts(userOrg.organizationId, userOrg.id),
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(100);

    const accounts = await prisma.account.findMany({
      where: { organizationId: userOrg.organizationId, isSystem: true },
    });

    // Check that there are no duplicate codes
    const codes = accounts.map((a) => a.code);
    const uniqueCodes = new Set(codes);
    expect(codes.length).toBe(uniqueCodes.size);
  }, 30000);
});
