import { prisma } from '@cc-erp/database';
import {
  ExpenseStatus,
  ExpensePaymentType,
  TaxType,
  AccountType,
  AccountCategory,
  BalanceType,
  Prisma,
} from '@prisma/client';
import { ExpenseService } from '../services/expense.service';
import { RequestingUser } from '../services/posting-engine.service';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { RejectExpenseDto } from '../dto/reject-expense.dto';

describe('Sprint 12.4.3 — Expense Operational Lifecycle & Validation Test Suite', () => {
  let expenseService: ExpenseService;
  let orgId: string;
  let branchId: string;
  let expenseAccount: any;
  let paymentAccount: any;
  let supplier: any;

  let testUser: RequestingUser;
  let foreignBranchUser: RequestingUser;

  beforeAll(async () => {
    expenseService = new ExpenseService();

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    if (branches.length < 1) throw new Error('No branch found');
    branchId = branches[0].id;

    testUser = {
      id: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      organizationId: orgId,
      branchId,
      scope: 'GLOBAL',
    };

    foreignBranchUser = {
      id: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000002',
      permissions: [],
      organizationId: orgId,
      branchId: '00000000-0000-0000-0000-000000000099',
      scope: 'BRANCH',
    };

    // Setup accounts
    expenseAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `53100-LIFE-${Date.now().toString().slice(-4)}`,
        name: 'Office Supplies Expense',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE_RENT,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });

    paymentAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `11100-LIFE-${Date.now().toString().slice(-4)}`,
        name: 'Petty Cash Account',
        type: AccountType.ASSET,
        category: AccountCategory.BANK,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });

    supplier = await prisma.supplier.findFirst({ where: { organizationId: orgId } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          organizationId: orgId,
          code: `SUP-LIFE-${Date.now().toString().slice(-4)}`,
          name: 'Stationery World',
        },
      });
    }
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

  it('1. should create a DRAFT expense with server-calculated GST 18% tax and total', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      vendorId: supplier.id,
      paymentType: ExpensePaymentType.PETTY_CASH,
      expenseDate: '2026-04-20',
      invoiceNumber: `INV-OFFICE-${Date.now()}`,
      baseAmount: 1000,
      taxType: TaxType.GST_18,
      description: 'Printer paper & ink cartridges',
    };

    const result = await expenseService.createExpense(dto, testUser);
    expect(result.isReplay).toBe(false);
    expect(result.expense.id).toBeDefined();
    expect(result.expense.status).toBe(ExpenseStatus.DRAFT);
    expect(result.expense.baseAmount.toString()).toBe('1000');
    expect(result.expense.taxAmount.toString()).toBe('180');
    expect(result.expense.totalAmount.toString()).toBe('1180');
  });

  it('2. should reject expense creation when client has BRANCH scope for a foreign branch', async () => {
    const dto: CreateExpenseDto = {
      branchId, // Foreign branch for foreignBranchUser
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.CASH,
      expenseDate: '2026-04-20',
      baseAmount: 500,
      description: 'Foreign branch expense attempt',
    };

    await expect(expenseService.createExpense(dto, foreignBranchUser)).rejects.toThrow();
  });

  it('3. should support idempotent creation replay when idempotencyKey is provided', async () => {
    const key = `idem-key-life-${Date.now()}`;
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.BANK_TRANSFER,
      expenseDate: '2026-04-21',
      baseAmount: 2500,
      description: 'Internet bill payment',
      idempotencyKey: key,
    };

    const res1 = await expenseService.createExpense(dto, testUser);
    expect(res1.isReplay).toBe(false);

    const res2 = await expenseService.createExpense(dto, testUser);
    expect(res2.isReplay).toBe(true);
    expect(res2.expense.id).toBe(res1.expense.id);
  });

  it('4. should progress state lifecycle: DRAFT -> SUBMITTED -> APPROVED', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.CASH,
      expenseDate: '2026-04-22',
      baseAmount: 300,
      description: 'Team snacks',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    expect(expense.status).toBe(ExpenseStatus.DRAFT);

    // 1. Submit
    const submitted = await expenseService.submitExpense(expense.id, testUser);
    expect(submitted.status).toBe(ExpenseStatus.SUBMITTED);
    expect(submitted.submittedById).toBe(testUser.id);

    // 2. Approve
    const approved = await expenseService.approveExpense(expense.id, testUser);
    expect(approved.status).toBe(ExpenseStatus.APPROVED);
    expect(approved.approvedById).toBe(testUser.id);
  });

  it('5. should handle SUBMITTED -> REJECTED path with justification reason', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.CASH,
      expenseDate: '2026-04-22',
      baseAmount: 15000,
      description: 'Unauthorized luxury item',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    await expenseService.submitExpense(expense.id, testUser);

    const rejectDto: RejectExpenseDto = { reason: 'Exceeds petty cash limit without pre-approval' };
    const rejected = await expenseService.rejectExpense(expense.id, rejectDto, testUser);

    expect(rejected.status).toBe(ExpenseStatus.REJECTED);
    expect(rejected.rejectionReason).toBe(rejectDto.reason);
  });

  it('6. should reject invalid state transitions (e.g. DRAFT directly to APPROVED)', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.CASH,
      expenseDate: '2026-04-22',
      baseAmount: 400,
      description: 'Invalid transition test',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    await expect(expenseService.approveExpense(expense.id, testUser)).rejects.toThrow();
  });

  it('7. should allow cancellation of unposted DRAFT / SUBMITTED / APPROVED expenses', async () => {
    const dto: CreateExpenseDto = {
      branchId,
      expenseAccountId: expenseAccount.id,
      paymentAccountId: paymentAccount.id,
      paymentType: ExpensePaymentType.CASH,
      expenseDate: '2026-04-23',
      baseAmount: 1200,
      description: 'Cancelled order',
    };

    const { expense } = await expenseService.createExpense(dto, testUser);
    const cancelled = await expenseService.cancelUnpostedExpense(expense.id, 'Duplicate entry', testUser);

    expect(cancelled.status).toBe(ExpenseStatus.CANCELLED);
    expect(cancelled.cancelReason).toBe('Duplicate entry');
  });
});
