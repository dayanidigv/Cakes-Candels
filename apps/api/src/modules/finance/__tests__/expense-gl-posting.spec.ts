import { prisma } from '@cc-erp/database';
import {
  ExpenseStatus,
  ExpensePaymentType,
  TaxType,
  AccountType,
  AccountCategory,
  BalanceType,
  JournalEntryStatus,
  Prisma,
} from '@prisma/client';
import { ExpenseService } from '../services/expense.service';
import { ExpensePostingService } from '../services/expense-posting.service';
import { FinancePostingEngine } from '../services/posting-engine.service';
import { FiscalCalendarService } from '../services/fiscal-calendar.service';
import { JournalService } from '../services/journal.service';
import { RequestingUser } from '../services/posting-engine.service';
import { CreateExpenseDto } from '../dto/create-expense.dto';

describe('Sprint 12.4.3 — Expense GL Posting & Accounting Reconciliation Test Suite', () => {
  let expenseService: ExpenseService;
  let postingService: ExpensePostingService;
  let orgId: string;
  let branchId: string;
  let expenseAccount: any;
  let paymentAccount: any;
  let inputTaxAccount: any;

  let testUser: RequestingUser;

  beforeAll(async () => {
    expenseService = new ExpenseService();
    const fiscalCalendarService = new FiscalCalendarService();
    const postingEngine = new FinancePostingEngine(fiscalCalendarService);
    const journalService = new JournalService(fiscalCalendarService);
    postingService = new ExpensePostingService(postingEngine, journalService);

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branch = await prisma.branch.findFirst({ where: { organizationId: orgId } });
    if (!branch) throw new Error('No branch found');
    branchId = branch.id;

    testUser = {
      id: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      scope: 'GLOBAL',
      organizationId: orgId,
      branchId,
      scope: 'GLOBAL',
    };

    // Ensure open fiscal year & period for 2026-04
    let year = await prisma.fiscalYear.findFirst({
      where: { organizationId: orgId, startDate: { lte: new Date('2026-04-15') }, endDate: { gte: new Date('2026-04-15') } },
    });
    if (!year) {
      year = await fiscalCalendarService.createFiscalYear(
        { name: `FY 2026-POST-${Date.now().toString().slice(-4)}`, startDate: '2026-01-01', endDate: '2026-12-31' },
        testUser,
      ).catch(async () => (await prisma.fiscalYear.findFirst({ where: { organizationId: orgId } }))!);
    }
    const period = await prisma.fiscalPeriod.findFirst({
      where: { fiscalYearId: year.id, startDate: { lte: new Date('2026-04-15') }, endDate: { gte: new Date('2026-04-15') } },
    });
    if (!period) {
      await fiscalCalendarService.createFiscalPeriod(
        { fiscalYearId: year.id, periodNumber: 4, name: 'April 2026', startDate: '2026-04-01', endDate: '2026-04-30' },
        testUser,
      ).catch(() => null);
    }

    // Setup accounts
    expenseAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `54100-POST-${Date.now().toString().slice(-4)}`,
        name: 'Factory Maintenance Expense',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE_RENT,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });

    paymentAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `11210-POST-${Date.now().toString().slice(-4)}`,
        name: 'SBI Operating Bank Account',
        type: AccountType.ASSET,
        category: AccountCategory.BANK,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });

    inputTaxAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `11510-GST-${Date.now().toString().slice(-4)}`,
        name: 'Input GST Receivable (Test)',
        type: AccountType.ASSET,
        category: AccountCategory.OTHER_CURRENT_ASSETS,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.expense.deleteMany({ where: { organizationId: orgId } });
    if (expenseAccount) {
      await prisma.account.delete({ where: { id: expenseAccount.id } }).catch(() => null);
    }
    if (paymentAccount) {
      await prisma.account.delete({ where: { id: paymentAccount.id } }).catch(() => null);
    }
    if (inputTaxAccount) {
      await prisma.account.delete({ where: { id: inputTaxAccount.id } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  it('1. should post APPROVED expense to GL with balanced double-entry (Expense DR,
      userId: expenseAccount.id } }).catch(() => null);
    }
    if (paymentAccount) {
      await prisma.account.delete({ where: { id: paymentAccount.id } }).catch(() => null);
    }
    if (inputTaxAccount) {
      await prisma.account.delete({ where: { id: inputTaxAccount.id } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  it('1. should post APPROVED expense to GL with balanced double-entry (Expense DR,
      permissions: [],
      scope: 'GLOBAL', Tax DR, Bank CR)', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.BANK_TRANSFER,
      expenseDate: '2026-04-25',
      baseAmount: 10000,
      taxType: TaxType.GST_18,
      description: 'Annual machine calibration charges',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    await expenseService.submitExpense(expense.id, testUser);
    await expenseService.approveExpense(expense.id, testUser);

    // Post to GL
    const postRes = await postingService.postExpenseToGL(expense.id, testUser);

    expect(postRes.isReplay).toBe(false);
    expect(postRes.expense.status).toBe(ExpenseStatus.POSTED);
    expect(postRes.expense.journalEntryId).toBe(postRes.journal.id);
    expect(postRes.journal.status).toBe(JournalEntryStatus.POSTED);

    // Verify double-entry balance: totalDebit == totalCredit
    expect(postRes.journal.totalDebit.toString()).toBe('11800');
    expect(postRes.journal.totalCredit.toString()).toBe('11800');

    // Verify lines count (Base Expense DR, Tax DR, Bank CR)
    expect(postRes.journal.lines.length).toBe(3);

    const expenseLine = postRes.journal.lines.find((l) => l.accountId === expenseAccount.id);
    expect(expenseLine?.debitAmount.toString()).toBe('10000');

    const taxLine = postRes.journal.lines.find((l) => l.debitAmount.toString() === '1800');
    expect(taxLine).toBeDefined();
    expect(taxLine?.debitAmount.toString()).toBe('1800');

    const paymentLine = postRes.journal.lines.find((l) => l.accountId === paymentAccount.id);
    expect(paymentLine?.creditAmount.toString()).toBe('11800');
  });

  it('2. should support idempotent replay when re-posting an already POSTED expense', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.BANK_TRANSFER,
      expenseDate: '2026-04-26',
      baseAmount: 2000,
      description: 'Idempotent post test',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    await expenseService.submitExpense(expense.id, testUser);
    await expenseService.approveExpense(expense.id, testUser);

    const res1 = await postingService.postExpenseToGL(expense.id, testUser);
    expect(res1.isReplay).toBe(false);

    const res2 = await postingService.postExpenseToGL(expense.id, testUser);
    expect(res2.isReplay).toBe(true);
    expect(res2.journal.id).toBe(res1.journal.id);
  });

  it('3. should reject GL posting attempt for unapproved DRAFT expenses', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.CASH,
      expenseDate: '2026-04-26',
      baseAmount: 1500,
      description: 'Unapproved draft posting attempt',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    await expect(postingService.postExpenseToGL(expense.id, testUser)).rejects.toThrow();
  });

  it('4. should reject GL posting when expense account is non-postable (parent account)', async () => {
    const parentAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `59000-PARENT-${Date.now().toString().slice(-4)}`,
        name: 'Parent Expense Header',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE_RENT,
        normalBalance: BalanceType.DEBIT,
        isPostable: false, // Parent / non-postable
      },
    });

    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: parentAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.CASH,
      expenseDate: '2026-04-27',
      baseAmount: 1000,
      description: 'Parent account test',
    };

    // Creation fails account validation
    await expect(expenseService.createExpense(dto, testUser)).rejects.toThrow();

    await prisma.account.delete({ where: { id: parentAccount.id } });
  });
});
