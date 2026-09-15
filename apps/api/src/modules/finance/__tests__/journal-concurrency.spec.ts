import { Test, TestingModule } from '@nestjs/testing';
import { FinancePostingEngine, RequestingUser } from '../services/posting-engine.service';
import { JournalService } from '../services/journal.service';
import { AccountService } from '../services/account.service';
import { FiscalCalendarService } from '../services/fiscal-calendar.service';
import { prisma } from '@cc-erp/database';
import { AccountType, AccountCategory, BalanceType, JournalEntryStatus } from '@prisma/client';

describe('Sprint 12 — Phase 12.3: 100-Thread Journal Concurrency & Idempotency Suite', () => {
  let postingEngine: FinancePostingEngine;
  let journalService: JournalService;
  let accountService: AccountService;
  let fiscalService: FiscalCalendarService;

  const userOrg: RequestingUser = {
    id: '88888888-8888-8888-8888-888888888888',
      userId: '88888888-8888-8888-8888-888888888888',
      permissions: [],
      scope: 'GLOBAL',
    organizationId: '88888888-bbbb-cccc-dddd-888888888888',
    role: 'SUPER_ADMIN',
    permissions: ['finance:journal:post', 'finance:journal:read', 'finance:period:create', 'finance:period:close'],
  };

  let cashAccount: any;
  let salesAccount: any;
  let fiscalYear: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinancePostingEngine, JournalService, AccountService, FiscalCalendarService],
    }).compile();

    postingEngine = module.get<FinancePostingEngine>(FinancePostingEngine);
    journalService = module.get<JournalService>(JournalService);
    accountService = module.get<AccountService>(AccountService);
    fiscalService = module.get<FiscalCalendarService>(FiscalCalendarService);

    // Clean up
    await prisma.journalEntry.updateMany({ where: { organizationId: userOrg.organizationId }, data: { reversalEntryId: null } });
    await prisma.journalEntryLine.deleteMany({ where: { journalEntry: { organizationId: userOrg.organizationId } } });
    await prisma.journalEntry.deleteMany({ where: { organizationId: userOrg.organizationId } });
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
      scope: 'GLOBAL', code: 'JOURNAL_CONCURRENCY_ORG', name: 'Journal Concurrency Test Org' },
      update: {},
    });

    fiscalYear = await fiscalService.createFiscalYear(
      {
        name: 'FY 2026-JOURNAL-CONC',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
      userOrg,
    );

    await fiscalService.createFiscalPeriod(
      {
        fiscalYearId: fiscalYear.id,
        periodNumber: 1,
        name: 'April 2026',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      },
      userOrg,
    );

    cashAccount = await accountService.createAccount(
      {
        code: '11100',
        name: 'POS Cash Drawer',
        type: AccountType.ASSET,
        category: AccountCategory.CASH_AND_EQUIVALENTS,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
      userOrg,
    );

    salesAccount = await accountService.createAccount(
      {
        code: '41000',
        name: 'Counter Sales Revenue',
        type: AccountType.REVENUE,
        category: AccountCategory.SALES_REVENUE_RETAIL,
        normalBalance: BalanceType.CREDIT,
        isPostable: true,
      },
      userOrg,
    );
  });

  afterAll(async () => {
    await prisma.journalEntry.updateMany({ where: { organizationId: userOrg.organizationId }, data: { reversalEntryId: null } });
    await prisma.journalEntryLine.deleteMany({ where: { journalEntry: { organizationId: userOrg.organizationId } } });
    await prisma.journalEntry.deleteMany({ where: { organizationId: userOrg.organizationId } });
    await prisma.account.deleteMany({ where: { organizationId: userOrg.organizationId } });
    await prisma.fiscalYear.deleteMany({ where: { organizationId: userOrg.organizationId } });
  });

  it('1. 100 concurrent identical posting attempts -> exactly 1 journal created, 99 replays', async () => {
    const identicalSourceId = 'aaaaaaaa-1111-2222-3333-444444444444';

    const promises = Array.from({ length: 100 }, () =>
      postingEngine
        .post(
          {
            postingDate: '2026-04-15',
            sourceModule: 'SALES',
            sourceEntityType: 'SALES_ORDER',
            sourceEntityId: identicalSourceId,
            description: 'Identical concurrent sales order posting',
            lines: [
              { accountId: cashAccount.id, debitAmount: 250, creditAmount: 0 },
              { accountId: salesAccount.id, debitAmount: 0, creditAmount: 250 },
            ],
          },
          userOrg,
        )
        .then((res) => ({ status: 'fulfilled', isReplay: res.isReplay }))
        .catch((err) => ({ status: 'rejected', error: err })),
    );

    const results = await Promise.all(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const firstPosts = fulfilled.filter((r: any) => !r.isReplay);
    const replays = fulfilled.filter((r: any) => r.isReplay);

    expect(fulfilled.length).toBe(100);
    expect(firstPosts.length).toBe(1);
    expect(replays.length).toBe(99);

    // Verify database has exactly 1 journal entry for this source
    const count = await prisma.journalEntry.count({
      where: {
        organizationId: userOrg.organizationId,
        sourceModule: 'SALES',
        sourceEntityId: identicalSourceId,
      },
    });
    expect(count).toBe(1);
  }, 30000);

  it('2. 100 concurrent distinct sources posting to same accounts -> all 100 post cleanly', async () => {
    const promises = Array.from({ length: 100 }, (_, i) => {
      const sourceEntityId = `bbbbbbbb-1111-2222-3333-${i.toString().padStart(12, '0')}`;
      return postingEngine.post(
        {
          postingDate: '2026-04-18',
          sourceModule: 'SALES',
          sourceEntityType: 'SALES_ORDER',
          sourceEntityId,
          description: `Independent sale #${i + 1}`,
          lines: [
            { accountId: cashAccount.id, debitAmount: 100, creditAmount: 0 },
            { accountId: salesAccount.id, debitAmount: 0, creditAmount: 100 },
          ],
        },
        userOrg,
      );
    });

    const results = await Promise.all(promises);
    expect(results.length).toBe(100);
    expect(results.every((r) => r.journal.status === JournalEntryStatus.POSTED)).toBe(true);

    // Verify ledger has 101 total transactions (1 from test 1 + 100 from test 2)
    const ledger = await journalService.getAccountLedger(cashAccount.id, userOrg, {});
    expect(ledger.entries.length).toBe(101);

    // Total Cash balance: 250 (test 1) + 100 * 100 (test 2) = 10,250.00
    expect(ledger.summary.closingBalance).toBe(10250);
  }, 30000);
});
