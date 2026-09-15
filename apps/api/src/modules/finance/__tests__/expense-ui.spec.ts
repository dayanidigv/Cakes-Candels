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

describe('Sprint 12.4.4 — Expense UI Workflow & End-to-End API Contracts', () => {
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
      id: 'e9f16a4a-79a3-47aa-b027-eadd39b2e215',
      userId: 'e9f16a4a-79a3-47aa-b027-eadd39b2e215',
      permissions: [],
      organizationId: orgId,
      branchId,
      scope: 'GLOBAL',
    };

    // Accounts setup
    expenseAccount = await prisma.account.findFirst({
      where: { organizationId: orgId, type: AccountType.EXPENSE, isPostable: true },
    });
    if (!expenseAccount) {
      expenseAccount = await prisma.account.create({
        data: {
          organizationId: orgId,
          code: `5-UI-${Date.now().toString().slice(-4)}`,
          name: 'UI Test Expense Account',
          type: AccountType.EXPENSE,
          category: AccountCategory.OPERATING_EXPENSE_RENT,
          normalBalance: BalanceType.DEBIT,
          isPostable: true,
        },
      });
    }

    paymentAccount = await prisma.account.findFirst({
      where: { organizationId: orgId, type: AccountType.ASSET, isPostable: true },
    });
    if (!paymentAccount) {
      paymentAccount = await prisma.account.create({
        data: {
          organizationId: orgId,
          code: `1-UI-${Date.now().toString().slice(-4)}`,
          name: 'UI Test Cash Account',
          type: AccountType.ASSET,
          category: AccountCategory.BANK,
          normalBalance: BalanceType.DEBIT,
          isPostable: true,
        },
      });
    }
  });

  it('1. should query expenses with server-side pagination & status filters for UI table', async () => {
    const result = await expenseService.getExpenses({ page: 1, limit: 10 }, testUser);
    expect(result).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.meta).toBeDefined();
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(10);
  });

  it('2. should execute full lifecycle: DRAFT -> SUBMITTED -> APPROVED -> POSTED -> REVERSED', async () => {
    const dto: CreateExpenseDto = {
      expenseDate: '2026-04-10',
      branchId,
      description: `UI Workflow Lifecycle Expense ${Date.now()}`,
      baseAmount: 1000,
      taxType: TaxType.GST_18,
      paymentType: ExpensePaymentType.BANK_TRANSFER,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
    };

    // Create Draft
    const { expense: draft } = await expenseService.createExpense(dto, testUser);
    expect(draft.status).toBe(ExpenseStatus.DRAFT);
    expect(Number(draft.baseAmount)).toBe(1000);
    expect(Number(draft.taxAmount)).toBe(180);
    expect(Number(draft.totalAmount)).toBe(1180);

    // Submit
    const submitted = await expenseService.submitExpense(draft.id, testUser);
    expect(submitted.status).toBe(ExpenseStatus.SUBMITTED);

    // Approve
    const approved = await expenseService.approveExpense(submitted.id, testUser);
    expect(approved.status).toBe(ExpenseStatus.APPROVED);

    // Post to GL
    const postRes = await postingService.postExpenseToGL(approved.id, testUser);
    expect(postRes.expense.status).toBe(ExpenseStatus.POSTED);
    expect(postRes.journal).toBeDefined();
    expect(postRes.journal.status).toBe(JournalEntryStatus.POSTED);

    // Reverse GL
    const revRes = await postingService.reverseExpenseGL(approved.id, 'UI cancellation test', testUser);
    expect(revRes.expense.status).toBe(ExpenseStatus.CANCELLED);
    expect(revRes.reversalJournal).toBeDefined();
    expect(revRes.reversalJournal.status).toBe(JournalEntryStatus.POSTED);
  });
});
