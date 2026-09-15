import { prisma } from '@cc-erp/database';
import {
  ExpenseStatus,
  ExpensePaymentType,
  AccountType,
  AccountCategory,
  BalanceType,
} from '@prisma/client';
import { ExpenseService } from '../services/expense.service';
import { ExpensePostingService } from '../services/expense-posting.service';
import { FinancePostingEngine } from '../services/posting-engine.service';
import { FiscalCalendarService } from '../services/fiscal-calendar.service';
import { JournalService } from '../services/journal.service';
import { RequestingUser } from '../services/posting-engine.service';
import { CreateExpenseDto } from '../dto/create-expense.dto';

describe('Sprint 12.4.3 — Expense Concurrency & Atomic Race Invariants Test Suite (100 Threads)', () => {
  let expenseService: ExpenseService;
  let postingService: ExpensePostingService;
  let orgId: string;
  let branchId: string;
  let expenseAccount: any;
  let paymentAccount: any;

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
      organizationId: orgId,
      branchId,
      scope: 'GLOBAL',
    };

    let year = await prisma.fiscalYear.findFirst({
      where: { organizationId: orgId, startDate: { lte: new Date('2026-04-15') }, endDate: { gte: new Date('2026-04-15') } },
    });
    if (!year) {
      year = await fiscalCalendarService.createFiscalYear(
        { name: `FY 2026-CONC-${Date.now().toString().slice(-4)}`, startDate: '2026-01-01', endDate: '2026-12-31' },
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

    expenseAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `56100-CONC-${Date.now().toString().slice(-4)}`,
        name: 'Advertising & Marketing Expense',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE_RENT,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });

    paymentAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `11220-CONC-${Date.now().toString().slice(-4)}`,
        name: 'Axis Bank Account',
        type: AccountType.ASSET,
        category: AccountCategory.BANK,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.expense.deleteMany({ where: { organizationId: orgId } });
    if (expenseAccount) {
      await prisma.account.delete({ where: { id: expenseAccount.id } }).catch(() => null);
    }
    if (paymentAccount) {
      await prisma.account.delete({ where: { id: paymentAccount.id } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  it('1. 100-thread concurrent creation with same idempotency key creates 1 Expense and 99 replays', async () => {
    const key = `idem-conc-create-${Date.now()}`;
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.BANK_TRANSFER,
      expenseDate: '2026-04-29',
      baseAmount: 8000,
      description: 'Facebook ad campaign',
      idempotencyKey: key,
    };

    const threads = Array.from({ length: 100 }).map(() =>
      expenseService.createExpense(dto, testUser).catch((err) => ({ error: err })),
    );

    const results = await Promise.all(threads);

    const successful = results.filter((r: any) => !r.error);
    expect(successful.length).toBe(100);

    const replays = successful.filter((r: any) => r.isReplay);
    expect(replays.length).toBe(99);

    const initial = successful.find((r: any) => !r.isReplay);
    expect(initial).toBeDefined();

    // Verify exactly 1 expense record in DB
    const count = await prisma.expense.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  }, 30000);

  it('2. 100-thread concurrent approval requests for the same expense results in 1 success and 99 rejected/handled', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.BANK_TRANSFER,
      expenseDate: '2026-04-29',
      baseAmount: 5000,
      description: 'Google search ads',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    await expenseService.submitExpense(expense.id, testUser);

    const threads = Array.from({ length: 100 }).map(() =>
      expenseService.approveExpense(expense.id, testUser).catch((err) => ({ error: err })),
    );

    const results = await Promise.all(threads);

    const successful = results.filter((r: any) => !r.error && r.status === ExpenseStatus.APPROVED);
    expect(successful.length).toBe(1);

    const rejected = results.filter((r: any) => r.error);
    expect(rejected.length).toBe(99);

    const updated = await prisma.expense.findUnique({ where: { id: expense.id } });
    expect(updated?.status).toBe(ExpenseStatus.APPROVED);
  }, 30000);

  it('3. 100-thread concurrent GL posting requests for the same expense results in exactly 1 GL journal', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.BANK_TRANSFER,
      expenseDate: '2026-04-29',
      baseAmount: 12000,
      description: 'Print billboard advertisement',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    await expenseService.submitExpense(expense.id, testUser);
    await expenseService.approveExpense(expense.id, testUser);

    const threads = Array.from({ length: 100 }).map(() =>
      postingService.postExpenseToGL(expense.id, testUser).catch((err) => ({ error: err })),
    );

    const results = await Promise.all(threads);

    const successful = results.filter((r: any) => !r.error);
    expect(successful.length).toBe(100);

    const replays = successful.filter((r: any) => r.isReplay);
    expect(replays.length).toBe(99);

    // Verify exactly 1 JournalEntry in GL for this expense
    const journals = await prisma.journalEntry.findMany({
      where: {
        organizationId: orgId,
        sourceModule: 'FINANCE',
        sourceEntityType: 'EXPENSE',
        sourceEntityId: expense.id,
      },
    });
    expect(journals.length).toBe(1);
  }, 30000);
});
