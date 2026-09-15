import { prisma } from '@cc-erp/database';
import {
  ExpenseStatus,
  ExpensePaymentType,
  AccountType,
  AccountCategory,
  BalanceType,
  LocationType,
} from '@prisma/client';
import { ExpenseService } from '../services/expense.service';
import { ExpensePostingService } from '../services/expense-posting.service';
import { FinancePostingEngine } from '../services/posting-engine.service';
import { FiscalCalendarService } from '../services/fiscal-calendar.service';
import { JournalService } from '../services/journal.service';
import { RequestingUser } from '../services/posting-engine.service';
import { CreateExpenseDto } from '../dto/create-expense.dto';

describe('Sprint 12.4.3 — Expense RBAC & Multi-Tenant Isolation Test Suite', () => {
  let expenseService: ExpenseService;
  let postingService: ExpensePostingService;
  let orgIdA: string;
  let orgIdB: string;
  let branchIdA: string;
  let branchIdB: string;
  let expenseAccountA: any;
  let paymentAccountA: any;

  let userOrgA: RequestingUser;
  let userOrgB: RequestingUser;
  let userBranchScopeA: RequestingUser;

  beforeAll(async () => {
    expenseService = new ExpenseService();
    const fiscalCalendarService = new FiscalCalendarService();
    const postingEngine = new FinancePostingEngine(fiscalCalendarService);
    const journalService = new JournalService(fiscalCalendarService);
    postingService = new ExpensePostingService(postingEngine, journalService);

    const orgs = await prisma.organization.findMany();
    if (orgs.length < 1) throw new Error('No organization found');
    orgIdA = orgs[0].id;

    // Create second organization for multi-tenant isolation testing
    let orgB = await prisma.organization.findFirst({ where: { code: 'ORG-TEST-B' } });
    if (!orgB) {
      orgB = await prisma.organization.create({
        data: {
          code: 'ORG-TEST-B',
          name: 'Secondary Test Organization B',
        },
      });
    }
    orgIdB = orgB.id;

    const branchA = await prisma.branch.findFirst({ where: { organizationId: orgIdA } });
    if (!branchA) throw new Error('No branch A found');
    branchIdA = branchA.id;

    let branchB = await prisma.branch.findFirst({ where: { organizationId: orgIdA, id: { not: branchIdA } } });
    if (!branchB) {
      branchB = await prisma.branch.create({
        data: {
          organizationId: orgIdA,
      userId: { not: branchIdA } } });
    if (!branchB) {
      branchB = await prisma.branch.create({
        data: {
          organizationId: orgIdA,
      permissions: [],
      scope: 'GLOBAL',
          name: 'Secondary Branch B',
          type: LocationType.RETAIL_BRANCH,
          address: 'Branch B Address',
        },
      });
    }
    branchIdB = branchB.id;

    userOrgA = {
      id: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      scope: 'GLOBAL',
      organizationId: orgIdA,
      scope: 'GLOBAL',
    };

    userOrgB = {
      id: '00000000-0000-0000-0000-000000000088',
      userId: '00000000-0000-0000-0000-000000000088',
      permissions: [],
      scope: 'GLOBAL',
      organizationId: orgIdB,
      scope: 'GLOBAL',
    };

    userBranchScopeA = {
      id: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000002',
      permissions: [],
      scope: 'GLOBAL',
      organizationId: orgIdA,
      branchId: branchIdA,
      scope: 'BRANCH',
    };

    expenseAccountA = await prisma.account.create({
      data: {
        organizationId: orgIdA,
        code: `57100-RBAC-${Date.now().toString().slice(-4)}`,
        name: 'Branch A Cleaning Expense',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE_RENT,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });

    paymentAccountA = await prisma.account.create({
      data: {
        organizationId: orgIdA,
        code: `11230-RBAC-${Date.now().toString().slice(-4)}`,
        name: 'HDFC Bank Account A',
        type: AccountType.ASSET,
        category: AccountCategory.BANK,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.expense.deleteMany({ where: { organizationId: orgIdA } });
    if (expenseAccountA) {
      await prisma.account.delete({ where: { id: expenseAccountA.id } }).catch(() => null);
    }
    if (paymentAccountA) {
      await prisma.account.delete({ where: { id: paymentAccountA.id } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  it('1. should prevent User in Org B from accessing or mutating Expense in Org A',
      userId: expenseAccountA.id } }).catch(() => null);
    }
    if (paymentAccountA) {
      await prisma.account.delete({ where: { id: paymentAccountA.id } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  it('1. should prevent User in Org B from accessing or mutating Expense in Org A',
      permissions: [],
      scope: 'GLOBAL', async () => {
    const dto: CreateExpenseDto = {
      branchId: branchIdA,
      expenseAccountId: expenseAccountA.id,
      paymentAccountId: paymentAccountA.id,
      paymentType: ExpensePaymentType.BANK_TRANSFER,
      expenseDate: '2026-04-30',
      baseAmount: 3000,
      description: 'Org A security test expense',
    };

    const { expense } = await expenseService.createExpense(dto, userOrgA);

    // 1. Get by ID cross-tenant
    await expect(expenseService.getExpenseById(expense.id, userOrgB)).rejects.toThrow();

    // 2. Submit cross-tenant
    await expect(expenseService.submitExpense(expense.id, userOrgB)).rejects.toThrow();

    // 3. Approve cross-tenant
    await expect(expenseService.approveExpense(expense.id, userOrgB)).rejects.toThrow();

    // 4. Post cross-tenant
    await expect(postingService.postExpenseToGL(expense.id, userOrgB)).rejects.toThrow();

    // 5. Cancel cross-tenant
    await expect(expenseService.cancelUnpostedExpense(expense.id, 'Illegal cross-tenant cancel', userOrgB)).rejects.toThrow();
  });

  it('2. should enforce Branch Scope boundaries for BRANCH scoped user', async () => {
    const dto: CreateExpenseDto = {
      branchId: branchIdB, // Foreign branch for userBranchScopeA
      expenseAccountId: expenseAccountA.id,
      paymentAccountId: paymentAccountA.id,
      paymentType: ExpensePaymentType.CASH,
      expenseDate: '2026-04-30',
      baseAmount: 1500,
      description: 'Branch B expense created by Global User',
    };

    // Global user creates for Branch B
    const { expense } = await expenseService.createExpense(dto, userOrgA);

    // Branch A user tries to view Branch B expense
    await expect(expenseService.getExpenseById(expense.id, userBranchScopeA)).rejects.toThrow();

    // Branch A user tries to submit Branch B expense
    await expect(expenseService.submitExpense(expense.id, userBranchScopeA)).rejects.toThrow();
  });
});
