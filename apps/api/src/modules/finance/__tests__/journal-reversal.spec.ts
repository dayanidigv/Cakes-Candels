import { Test, TestingModule } from '@nestjs/testing';
import { FinancePostingEngine, RequestingUser } from '../services/posting-engine.service';
import { JournalService } from '../services/journal.service';
import { AccountService } from '../services/account.service';
import { FiscalCalendarService } from '../services/fiscal-calendar.service';
import { prisma } from '@cc-erp/database';
import { AccountType, AccountCategory, BalanceType, JournalEntryStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Sprint 12 — Phase 12.3: Journal Reversal & Account Ledger Suite', () => {
  let postingEngine: FinancePostingEngine;
  let journalService: JournalService;
  let accountService: AccountService;
  let fiscalService: FiscalCalendarService;

  const userOrg: RequestingUser = {
    id: '77777777-7777-7777-7777-777777777777',
      userId: '77777777-7777-7777-7777-777777777777',
      permissions: [],
      scope: 'GLOBAL',
    organizationId: '77777777-aaaa-bbbb-cccc-777777777777',
    role: 'SUPER_ADMIN',
    permissions: ['finance:journal:post', 'finance:journal:read', 'finance:journal:reverse', 'finance:coa:read'],
  };

  let cashAccount: any;
  let expenseAccount: any;
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
      scope: 'GLOBAL', code: 'REV_ORG', name: 'Reversal Test Org' },
      update: {},
    });

    fiscalYear = await fiscalService.createFiscalYear(
      {
        name: 'FY 2026-REV',
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
        name: 'Operating Cash Till',
        type: AccountType.ASSET,
        category: AccountCategory.CASH_AND_EQUIVALENTS,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
      userOrg,
    );

    expenseAccount = await accountService.createAccount(
      {
        code: '52100',
        name: 'Store Rent Expense',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE_RENT,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
      userOrg,
    );
  });

  afterAll(async () => {
    await prisma.journalEntryLine.deleteMany({ where: { journalEntry: { organizationId: userOrg.organizationId } } });
    await prisma.journalEntry.deleteMany({ where: { organizationId: userOrg.organizationId } });
    await prisma.account.deleteMany({ where: { organizationId: userOrg.organizationId } });
    await prisma.fiscalYear.deleteMany({ where: { organizationId: userOrg.organizationId } });
  });

  it('1. should reverse an existing posted journal entry and preserve immutable audit lineage', async () => {
    // Post original expense journal
    const postResult = await postingEngine.post(
      {
        postingDate: '2026-04-05',
        sourceModule: 'EXPENSE',
        sourceEntityType: 'EXPENSE_RECORD',
        sourceEntityId: '99999999-1111-2222-3333-444444444444',
        description: 'April store rent payment',
        lines: [
          { accountId: expenseAccount.id, debitAmount: 25000, creditAmount: 0, description: 'Dr Rent' },
          { accountId: cashAccount.id, debitAmount: 0, creditAmount: 25000, description: 'Cr Cash' },
        ],
      },
      userOrg,
    );

    const originalJournal = postResult.journal;
    expect(originalJournal.status).toBe(JournalEntryStatus.POSTED);

    // Reverse journal
    const reversalJournal = await journalService.reverseJournal(
      originalJournal.id,
      {
        reason: 'Erroneous duplicate entry entered by cashier',
        postingDate: '2026-04-06',
      },
      userOrg,
    );

    expect(reversalJournal).toBeDefined();
    expect(reversalJournal.status).toBe(JournalEntryStatus.POSTED);
    expect(reversalJournal.entryNumber).toMatch(/-REV-/);
    expect(Number(reversalJournal.totalDebit)).toBe(25000);
    expect(Number(reversalJournal.totalCredit)).toBe(25000);

    // Verify lines were inverted: Rent is now Credit, Cash is now Debit
    const rentLine = reversalJournal.lines.find((l: any) => l.accountId === expenseAccount.id);
    const cashLine = reversalJournal.lines.find((l: any) => l.accountId === cashAccount.id);

    expect(Number(rentLine.creditAmount)).toBe(25000);
    expect(Number(rentLine.debitAmount)).toBe(0);
    expect(Number(cashLine.debitAmount)).toBe(25000);
    expect(Number(cashLine.creditAmount)).toBe(0);

    // Verify original journal status transitioned to REVERSED
    const updatedOriginal = await prisma.journalEntry.findUnique({ where: { id: originalJournal.id } });
    expect(updatedOriginal!.status).toBe(JournalEntryStatus.REVERSED);
    expect(updatedOriginal!.reversalEntryId).toBe(reversalJournal.id);
  });

  it('2. should reject reversing an already reversed journal entry',
      userId: originalJournal.id } });
    expect(updatedOriginal!.status).toBe(JournalEntryStatus.REVERSED);
    expect(updatedOriginal!.reversalEntryId).toBe(reversalJournal.id);
  });

  it('2. should reject reversing an already reversed journal entry',
      permissions: [],
      scope: 'GLOBAL', async () => {
    const original = await prisma.journalEntry.findFirst({
      where: { organizationId: userOrg.organizationId, status: JournalEntryStatus.REVERSED },
    });

    await expect(
      journalService.reverseJournal(original!.id, { reason: 'Attempting second reversal' }, userOrg),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should accurately calculate General Ledger running balance on account drill-down', async () => {
    // Post additional journal: Cash sale
    await postingEngine.post(
      {
        postingDate: '2026-04-12',
        sourceModule: 'SALES',
        sourceEntityType: 'SALES_ORDER',
        sourceEntityId: '88888888-1111-2222-3333-444444444444',
        description: 'Storefront daily collection',
        lines: [
          { accountId: cashAccount.id, debitAmount: 50000, creditAmount: 0 },
          { accountId: expenseAccount.id, debitAmount: 0, creditAmount: 50000 },
        ],
      },
      userOrg,
    );

    const ledger = await journalService.getAccountLedger(cashAccount.id, userOrg, {});

    expect(ledger).toBeDefined();
    expect(ledger.account.code).toBe('11100');
    expect(ledger.entries.length).toBe(3); // Original (Cr 25000), Reversal (Dr 25000), Sale (Dr 50000)

    // Net closing balance on Cash (Asset DEBIT normal balance):
    // -25000 (Cr) + 25000 (Dr) + 50000 (Dr) = +50000
    expect(ledger.summary.closingBalance).toBe(50000);
    expect(ledger.summary.totalDebit).toBe(75000);
    expect(ledger.summary.totalCredit).toBe(25000);
  });
});
