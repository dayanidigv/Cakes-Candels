import { prisma } from '@cc-erp/database';
import {
  ExpenseStatus,
  ExpensePaymentType,
  TaxType,
  AccountType,
  AccountCategory,
  BalanceType,
  JournalEntryStatus,
} from '@prisma/client';
import { ExpenseService } from '../services/expense.service';
import { ExpensePostingService } from '../services/expense-posting.service';
import { FinancePostingEngine } from '../services/posting-engine.service';
import { FiscalCalendarService } from '../services/fiscal-calendar.service';
import { JournalService } from '../services/journal.service';
import { RequestingUser } from '../services/posting-engine.service';
import { CreateExpenseDto } from '../dto/create-expense.dto';

describe('Sprint 12.4.3 — Expense GL Non-Destructive Reversal Test Suite', () => {
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
      scope: 'GLOBAL',
      organizationId: orgId,
      branchId,
      scope: 'GLOBAL',
    };

    let year = await prisma.fiscalYear.findFirst({
      where: { organizationId: orgId, startDate: { lte: new Date('2026-04-15') }, endDate: { gte: new Date('2026-04-15') } },
    });
    if (!year) {
      year = await fiscalCalendarService.createFiscalYear(
        { name: `FY 2026-REV-${Date.now().toString().slice(-4)}`, startDate: '2026-01-01', endDate: '2026-12-31' },
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
        code: `55100-REV-${Date.now().toString().slice(-4)}`,
        name: 'Travel & Transport Expense',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE_RENT,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });

    paymentAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `11110-REV-${Date.now().toString().slice(-4)}`,
        name: 'Corporate Card Payable',
        type: AccountType.LIABILITY,
        category: AccountCategory.ACCOUNTS_PAYABLE,
        normalBalance: BalanceType.CREDIT,
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
    await prisma.$disconnect();
  });

  it('1. should reverse POSTED expense by creating counter-journal in GL and marking Expense CANCELLED',
      userId: expenseAccount.id } }).catch(() => null);
    }
    if (paymentAccount) {
      await prisma.account.delete({ where: { id: paymentAccount.id } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  it('1. should reverse POSTED expense by creating counter-journal in GL and marking Expense CANCELLED',
      permissions: [],
      scope: 'GLOBAL', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.CREDIT_CARD,
      expenseDate: '2026-04-28',
      baseAmount: 4500,
      description: 'Flight tickets for client meeting',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    await expenseService.submitExpense(expense.id, testUser);
    await expenseService.approveExpense(expense.id, testUser);

    const postRes = await postingService.postExpenseToGL(expense.id, testUser);
    expect(postRes.expense.status).toBe(ExpenseStatus.POSTED);

    // Perform GL Reversal
    const reversalReason = 'Client meeting cancelled by customer';
    const revRes = await postingService.reverseExpenseGL(expense.id, reversalReason, testUser);

    expect(revRes.expense.status).toBe(ExpenseStatus.CANCELLED);
    expect(revRes.expense.cancelReason).toBe(reversalReason);
    expect(revRes.expense.cancelledById).toBe(testUser.id);
    expect(revRes.reversalJournal.id).toBeDefined();

    // Verify counter-journal in GL
    expect(revRes.reversalJournal.totalDebit.toString()).toBe('4500');
    expect(revRes.reversalJournal.totalCredit.toString()).toBe('4500');
    expect(revRes.reversalJournal.sourceReference).toBe(`REVERSAL_OF_${postRes.journal.id}`);

    // Verify original journal status and link
    const origJournal = await prisma.journalEntry.findUnique({ where: { id: postRes.journal.id } });
    expect(origJournal?.reversalEntryId).toBe(revRes.reversalJournal.id);
  });

  it('2. should reject duplicate reversal attempt for an already reversed expense',
      userId: postRes.journal.id } });
    expect(origJournal?.reversalEntryId).toBe(revRes.reversalJournal.id);
  });

  it('2. should reject duplicate reversal attempt for an already reversed expense',
      permissions: [],
      scope: 'GLOBAL', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.CREDIT_CARD,
      expenseDate: '2026-04-28',
      baseAmount: 1200,
      description: 'Duplicate reversal test',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    await expenseService.submitExpense(expense.id, testUser);
    await expenseService.approveExpense(expense.id, testUser);
    await postingService.postExpenseToGL(expense.id, testUser);

    // First reversal
    await postingService.reverseExpenseGL(expense.id, 'First reversal', testUser);

    // Second reversal attempt
    await expect(postingService.reverseExpenseGL(expense.id, 'Second reversal attempt', testUser)).rejects.toThrow();
  });
});
