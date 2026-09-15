import { Test, TestingModule } from '@nestjs/testing';
import { FinancePostingEngine, RequestingUser } from '../services/posting-engine.service';
import { AccountService } from '../services/account.service';
import { FiscalCalendarService } from '../services/fiscal-calendar.service';
import { prisma } from '@cc-erp/database';
import { AccountType, AccountCategory, BalanceType, JournalEntryStatus, FiscalPeriodStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Sprint 12 — Phase 12.3: Journal Posting & Invariant Validation Suite', () => {
  let postingEngine: FinancePostingEngine;
  let accountService: AccountService;
  let fiscalService: FiscalCalendarService;

  const userOrgA: RequestingUser = {
    id: '55555555-5555-5555-5555-555555555555',
      userId: '55555555-5555-5555-5555-555555555555',
      permissions: [],
      scope: 'GLOBAL',
    organizationId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    role: 'SUPER_ADMIN',
    permissions: ['finance:journal:post', 'finance:journal:read'],
  };

  const userOrgB: RequestingUser = {
    id: '66666666-6666-6666-6666-666666666666',
      userId: '66666666-6666-6666-6666-666666666666',
      permissions: [],
      scope: 'GLOBAL',
    organizationId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    role: 'SUPER_ADMIN',
    permissions: ['finance:journal:post', 'finance:journal:read'],
  };

  let cashAccount: any;
  let salesAccount: any;
  let parentAccount: any;
  let inactiveAccount: any;
  let accountOrgB: any;
  let fiscalYear: any;
  let openPeriod: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinancePostingEngine, AccountService, FiscalCalendarService],
    }).compile();

    postingEngine = module.get<FinancePostingEngine>(FinancePostingEngine);
    accountService = module.get<AccountService>(AccountService);
    fiscalService = module.get<FiscalCalendarService>(FiscalCalendarService);

    // Clean up
    await prisma.journalEntryLine.deleteMany({ where: { journalEntry: { organizationId: userOrgA.organizationId } } });
    await prisma.journalEntry.deleteMany({ where: { organizationId: userOrgA.organizationId } });
    await prisma.account.deleteMany({ where: { organizationId: { in: [userOrgA.organizationId, userOrgB.organizationId] } } });
    await prisma.fiscalYear.deleteMany({ where: { organizationId: { in: [userOrgA.organizationId, userOrgB.organizationId] } } });

    // Create Organizations
    await prisma.organization.upsert({
      where: { id: userOrgA.organizationId },
      userId: userOrgA.organizationId },
      permissions: [],
      scope: 'GLOBAL',
      create: { id: userOrgA.organizationId,
      userId: userOrgA.organizationId,
      permissions: [],
      scope: 'GLOBAL', code: 'POST_ORG_A', name: 'Posting Test Org A' },
      update: {},
    });
    await prisma.organization.upsert({
      where: { id: userOrgB.organizationId },
      userId: userOrgB.organizationId },
      permissions: [],
      scope: 'GLOBAL',
      create: { id: userOrgB.organizationId,
      userId: userOrgB.organizationId,
      permissions: [],
      scope: 'GLOBAL', code: 'POST_ORG_B', name: 'Posting Test Org B' },
      update: {},
    });

    // Create Fiscal Year & Open Period
    fiscalYear = await fiscalService.createFiscalYear(
      {
        name: 'FY 2026-POSTING',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
      userOrgA,
    );

    openPeriod = await fiscalService.createFiscalPeriod(
      {
        fiscalYearId: fiscalYear.id,
        periodNumber: 1,
        name: 'April 2026',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      },
      userOrgA,
    );

    // Create Accounts
    parentAccount = await accountService.createAccount(
      {
        code: '10000',
        name: 'CURRENT ASSETS',
        type: AccountType.ASSET,
        category: AccountCategory.CASH_AND_EQUIVALENTS,
        normalBalance: BalanceType.DEBIT,
        isPostable: false,
      },
      userOrgA,
    );

    cashAccount = await accountService.createAccount(
      {
        code: '11100',
        name: 'Main Cash Till',
        type: AccountType.ASSET,
        category: AccountCategory.CASH_AND_EQUIVALENTS,
        normalBalance: BalanceType.DEBIT,
        parentId: parentAccount.id,
        isPostable: true,
      },
      userOrgA,
    );

    salesAccount = await accountService.createAccount(
      {
        code: '41000',
        name: 'Retail Sales Revenue',
        type: AccountType.REVENUE,
        category: AccountCategory.SALES_REVENUE_RETAIL,
        normalBalance: BalanceType.CREDIT,
        isPostable: true,
      },
      userOrgA,
    );

    inactiveAccount = await accountService.createAccount(
      {
        code: '11900',
        name: 'Old Deprecated Account',
        type: AccountType.ASSET,
        category: AccountCategory.CASH_AND_EQUIVALENTS,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
      userOrgA,
    );
    await prisma.account.update({ where: { id: inactiveAccount.id },
      userId: inactiveAccount.id },
      permissions: [],
      scope: 'GLOBAL', data: { isActive: false } });

    // Org B Account
    accountOrgB = await accountService.createAccount(
      {
        code: '11100',
        name: 'Cash Org B',
        type: AccountType.ASSET,
        category: AccountCategory.CASH_AND_EQUIVALENTS,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
      userOrgB,
    );
  });

  afterAll(async () => {
    await prisma.journalEntryLine.deleteMany({ where: { journalEntry: { organizationId: userOrgA.organizationId } } });
    await prisma.journalEntry.deleteMany({ where: { organizationId: userOrgA.organizationId } });
    await prisma.account.deleteMany({ where: { organizationId: { in: [userOrgA.organizationId, userOrgB.organizationId] } } });
    await prisma.fiscalYear.deleteMany({ where: { organizationId: { in: [userOrgA.organizationId, userOrgB.organizationId] } } });
  });

  it('1. should successfully post a valid balanced double-entry journal', async () => {
    const command = {
      postingDate: '2026-04-10',
      sourceModule: 'SALES',
      sourceEntityType: 'SALES_ORDER',
      sourceEntityId: '11111111-2222-3333-4444-555555555555',
      description: 'Cash sales for order #SO-1001',
      lines: [
        { accountId: cashAccount.id, debitAmount: 1500, creditAmount: 0, description: 'Cash collected' },
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 1500, description: 'Sales revenue recognized' },
      ],
    };

    const result = await postingEngine.post(command, userOrgA);

    expect(result).toBeDefined();
    expect(result.isReplay).toBe(false);
    expect(result.journal.status).toBe(JournalEntryStatus.POSTED);
    expect(Number(result.journal.totalDebit)).toBe(1500);
    expect(Number(result.journal.totalCredit)).toBe(1500);
    expect(result.journal.lines.length).toBe(2);
    expect(result.journal.entryNumber).toMatch(/^JE-202604-/);
  });

  it('2. should reject unbalanced journal entries (Debit != Credit)', async () => {
    const command = {
      postingDate: '2026-04-10',
      sourceModule: 'SALES',
      sourceEntityType: 'SALES_ORDER',
      sourceEntityId: '11111111-2222-3333-4444-666666666666',
      description: 'Unbalanced sale',
      lines: [
        { accountId: cashAccount.id, debitAmount: 1000, creditAmount: 0 },
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 999.99 },
      ],
    };

    await expect(postingEngine.post(command, userOrgA)).rejects.toThrow(BadRequestException);
  });

  it('3. should reject journal lines with both debit and credit populated', async () => {
    const command = {
      postingDate: '2026-04-10',
      sourceModule: 'SALES',
      sourceEntityType: 'SALES_ORDER',
      sourceEntityId: '11111111-2222-3333-4444-777777777777',
      description: 'Dual side line',
      lines: [
        { accountId: cashAccount.id, debitAmount: 500, creditAmount: 500 },
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 1000 },
      ],
    };

    await expect(postingEngine.post(command, userOrgA)).rejects.toThrow(BadRequestException);
  });

  it('4. should reject zero-value journal lines', async () => {
    const command = {
      postingDate: '2026-04-10',
      sourceModule: 'SALES',
      sourceEntityType: 'SALES_ORDER',
      sourceEntityId: '11111111-2222-3333-4444-888888888888',
      description: 'Zero value line',
      lines: [
        { accountId: cashAccount.id, debitAmount: 0, creditAmount: 0 },
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 0 },
      ],
    };

    await expect(postingEngine.post(command, userOrgA)).rejects.toThrow(BadRequestException);
  });

  it('5. should reject posting to non-postable summary parent account', async () => {
    const command = {
      postingDate: '2026-04-10',
      sourceModule: 'SALES',
      sourceEntityType: 'SALES_ORDER',
      sourceEntityId: '11111111-2222-3333-4444-999999999999',
      description: 'Posting to header account',
      lines: [
        { accountId: parentAccount.id, debitAmount: 500, creditAmount: 0 },
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 500 },
      ],
    };

    await expect(postingEngine.post(command, userOrgA)).rejects.toThrow(BadRequestException);
  });

  it('6. should reject posting to INACTIVE account', async () => {
    const command = {
      postingDate: '2026-04-10',
      sourceModule: 'SALES',
      sourceEntityType: 'SALES_ORDER',
      sourceEntityId: '22222222-3333-4444-5555-666666666666',
      description: 'Posting to inactive account',
      lines: [
        { accountId: inactiveAccount.id, debitAmount: 500, creditAmount: 0 },
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 500 },
      ],
    };

    await expect(postingEngine.post(command, userOrgA)).rejects.toThrow(BadRequestException);
  });

  it('7. should reject cross-organization account in journal lines', async () => {
    const command = {
      postingDate: '2026-04-10',
      sourceModule: 'SALES',
      sourceEntityType: 'SALES_ORDER',
      sourceEntityId: '33333333-4444-5555-6666-777777777777',
      description: 'Cross tenant account posting',
      lines: [
        { accountId: accountOrgB.id, debitAmount: 500, creditAmount: 0 }, // Org B account
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 500 },
      ],
    };

    await expect(postingEngine.post(command, userOrgA)).rejects.toThrow(NotFoundException);
  });

  it('8. should reject posting into a CLOSED fiscal period', async () => {
    // Create May period and close it
    const mayPeriod = await fiscalService.createFiscalPeriod(
      {
        fiscalYearId: fiscalYear.id,
        periodNumber: 2,
        name: 'May 2026',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      },
      userOrgA,
    );
    await fiscalService.closePeriod(mayPeriod.id, userOrgA);

    const command = {
      postingDate: '2026-05-15', // Falls into closed May period
      sourceModule: 'SALES',
      sourceEntityType: 'SALES_ORDER',
      sourceEntityId: '44444444-5555-6666-7777-888888888888',
      description: 'Post into closed period',
      lines: [
        { accountId: cashAccount.id, debitAmount: 500, creditAmount: 0 },
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 500 },
      ],
    };

    await expect(postingEngine.post(command, userOrgA)).rejects.toThrow(BadRequestException);
  });

  it('9. should return idempotent replay when same source is posted again', async () => {
    const command = {
      postingDate: '2026-04-10',
      sourceModule: 'SALES',
      sourceEntityType: 'SALES_ORDER',
      sourceEntityId: '11111111-2222-3333-4444-555555555555', // Already posted in test 1
      description: 'Duplicate post attempt',
      lines: [
        { accountId: cashAccount.id, debitAmount: 1500, creditAmount: 0 },
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 1500 },
      ],
    };

    const replayResult = await postingEngine.post(command, userOrgA);

    expect(replayResult.isReplay).toBe(true);
    expect(replayResult.journal).toBeDefined();

    // Verify exactly 1 journal entry exists for this source in DB
    const count = await prisma.journalEntry.count({
      where: {
        organizationId: userOrgA.organizationId,
        sourceModule: 'SALES',
        sourceEntityId: '11111111-2222-3333-4444-555555555555',
      },
    });
    expect(count).toBe(1);
  });
});
