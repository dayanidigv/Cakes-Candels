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

describe('Sprint 12 — Phase 12.4.2: Expense Database Schema & Invariants Specification', () => {
  let orgId: string;
  let branchId: string;
  let expenseAccount: any;
  let paymentAccount: any;
  let supplier: any;

  beforeAll(async () => {
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branch = await prisma.branch.findFirst({ where: { organizationId: orgId } });
    if (!branch) throw new Error('No branch found');
    branchId = branch.id;

    // Clean up test data
    await prisma.expense.deleteMany({ where: { organizationId: orgId } });
    await prisma.expenseCategoryMapping.deleteMany({ where: { organizationId: orgId } });

    // Setup accounts
    expenseAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `52200-TEST-${Date.now().toString().slice(-4)}`,
        name: 'Store Electricity Expense (Test)',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE_UTILITIES,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });

    paymentAccount = await prisma.account.create({
      data: {
        organizationId: orgId,
        code: `11200-TEST-${Date.now().toString().slice(-4)}`,
        name: 'HDFC Bank Account (Test)',
        type: AccountType.ASSET,
        category: AccountCategory.BANK,
        normalBalance: BalanceType.DEBIT,
        isPostable: true,
      },
    });

    // Find or create supplier
    supplier = await prisma.supplier.findFirst({ where: { organizationId: orgId } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          organizationId: orgId,
          code: `SUP-EXP-${Date.now().toString().slice(-4)}`,
          name: 'State Power Board Supplier',
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.expense.deleteMany({ where: { organizationId: orgId } });
    await prisma.expenseCategoryMapping.deleteMany({ where: { organizationId: orgId } });
    if (expenseAccount) {
      await prisma.account.delete({ where: { id: expenseAccount.id } }).catch(() => null);
    }
    if (paymentAccount) {
      await prisma.account.delete({ where: { id: paymentAccount.id } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  it('1. should create an Expense with valid foreign keys,
      userId: expenseAccount.id } }).catch(() => null);
    }
    if (paymentAccount) {
      await prisma.account.delete({ where: { id: paymentAccount.id } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  it('1. should create an Expense with valid foreign keys,
      permissions: [],
      scope: 'GLOBAL', Decimal precision, and enum values', async () => {
    const expenseNumber = `EXP-TEST-001-${Date.now()}`;
    const expense = await prisma.expense.create({
      data: {
        organizationId: orgId,
        expenseNumber,
        branchId,
        expenseAccountId: expenseAccount.id,
        paymentAccountId: paymentAccount.id,
        vendorId: supplier.id,
        status: ExpenseStatus.DRAFT,
        paymentType: ExpensePaymentType.BANK_TRANSFER,
        expenseDate: new Date('2026-04-15'),
        dueDate: new Date('2026-04-30'),
        invoiceNumber: 'INV-EB-99881',
        baseAmount: new Prisma.Decimal('5000.00'),
        taxType: TaxType.GST_18,
        taxAmount: new Prisma.Decimal('900.00'),
        totalAmount: new Prisma.Decimal('5900.00'),
        description: 'Monthly electricity charges for retail branch',
        attachmentUrl: 'https://storage.cakescandles.com/receipts/inv-99881.pdf',
        idempotencyKey: `idem-exp-001-${Date.now()}`,
      },
      include: {
        organization: true,
        branch: true,
        expenseAccount: true,
        paymentAccount: true,
        supplier: true,
      },
    });

    expect(expense.id).toBeDefined();
    expect(expense.expenseNumber).toBe(expenseNumber);
    expect(expense.status).toBe(ExpenseStatus.DRAFT);
    expect(expense.paymentType).toBe(ExpensePaymentType.BANK_TRANSFER);
    expect(expense.taxType).toBe(TaxType.GST_18);
    expect(expense.baseAmount.toString()).toBe('5000');
    expect(expense.taxAmount.toString()).toBe('900');
    expect(expense.totalAmount.toString()).toBe('5900');
    expect(expense.organization.id).toBe(orgId);
    expect(expense.branch.id).toBe(branchId);
    expect(expense.expenseAccount.id).toBe(expenseAccount.id);
    expect(expense.paymentAccount.id).toBe(paymentAccount.id);
    expect(expense.supplier?.id).toBe(supplier.id);
  });

  it('2. should enforce unique [organizationId, expenseNumber] constraint', async () => {
    const expenseNumber = `EXP-DUPE-${Date.now()}`;
    await prisma.expense.create({
      data: {
        organizationId: orgId,
        expenseNumber,
        branchId,
        expenseAccountId: expenseAccount.id,
        paymentAccountId: paymentAccount.id,
        status: ExpenseStatus.DRAFT,
        paymentType: ExpensePaymentType.CASH,
        expenseDate: new Date('2026-04-16'),
        baseAmount: new Prisma.Decimal('200.00'),
        taxAmount: new Prisma.Decimal('0.00'),
        totalAmount: new Prisma.Decimal('200.00'),
        description: 'Petty cash purchase 1',
      },
    });

    await expect(
      prisma.expense.create({
        data: {
          organizationId: orgId,
          expenseNumber,
          branchId,
          expenseAccountId: expenseAccount.id,
          paymentAccountId: paymentAccount.id,
          status: ExpenseStatus.DRAFT,
          paymentType: ExpensePaymentType.CASH,
          expenseDate: new Date('2026-04-16'),
          baseAmount: new Prisma.Decimal('300.00'),
          taxAmount: new Prisma.Decimal('0.00'),
          totalAmount: new Prisma.Decimal('300.00'),
          description: 'Duplicate expense number attempt',
        },
      }),
    ).rejects.toThrow();
  });

  it('3. should enforce unique duplicate vendor invoice constraint [organizationId, vendorId, invoiceNumber]', async () => {
    const invoiceNumber = `BILL-${Date.now()}`;
    await prisma.expense.create({
      data: {
        organizationId: orgId,
        expenseNumber: `EXP-BILL-1-${Date.now()}`,
        branchId,
        expenseAccountId: expenseAccount.id,
        paymentAccountId: paymentAccount.id,
        vendorId: supplier.id,
        invoiceNumber,
        status: ExpenseStatus.SUBMITTED,
        paymentType: ExpensePaymentType.PAYABLE_VENDOR,
        expenseDate: new Date('2026-04-17'),
        baseAmount: new Prisma.Decimal('1000.00'),
        taxAmount: new Prisma.Decimal('0.00'),
        totalAmount: new Prisma.Decimal('1000.00'),
        description: 'Vendor maintenance invoice',
      },
    });

    await expect(
      prisma.expense.create({
        data: {
          organizationId: orgId,
          expenseNumber: `EXP-BILL-2-${Date.now()}`,
          branchId,
          expenseAccountId: expenseAccount.id,
          paymentAccountId: paymentAccount.id,
          vendorId: supplier.id,
          invoiceNumber, // Same vendor + invoice number in same org
          status: ExpenseStatus.DRAFT,
          paymentType: ExpensePaymentType.PAYABLE_VENDOR,
          expenseDate: new Date('2026-04-17'),
          baseAmount: new Prisma.Decimal('1000.00'),
          taxAmount: new Prisma.Decimal('0.00'),
          totalAmount: new Prisma.Decimal('1000.00'),
          description: 'Accidental duplicate submission',
        },
      }),
    ).rejects.toThrow();
  });

  it('4. should link Expense 1-to-1 with a JournalEntry upon GL posting state', async () => {
    const yyyymm = '202604';
    const journal = await prisma.journalEntry.create({
      data: {
        organizationId: orgId,
        entryNumber: `JE-${yyyymm}-EXP-${Date.now().toString().slice(-4)}`,
        postingDate: new Date('2026-04-18'),
        sourceModule: 'FINANCE',
        sourceEntityType: 'EXPENSE',
        sourceEntityId: '00000000-0000-0000-0000-000000000099',
        status: JournalEntryStatus.POSTED,
        description: 'Journal for posted expense',
        totalDebit: new Prisma.Decimal('1500.00'),
        totalCredit: new Prisma.Decimal('1500.00'),
        createdById: '00000000-0000-0000-0000-000000000001',
      },
    });

    const expense = await prisma.expense.create({
      data: {
        organizationId: orgId,
        expenseNumber: `EXP-JE-LINK-${Date.now()}`,
        branchId,
        expenseAccountId: expenseAccount.id,
        paymentAccountId: paymentAccount.id,
        status: ExpenseStatus.POSTED,
        paymentType: ExpensePaymentType.BANK_TRANSFER,
        expenseDate: new Date('2026-04-18'),
        baseAmount: new Prisma.Decimal('1500.00'),
        taxAmount: new Prisma.Decimal('0.00'),
        totalAmount: new Prisma.Decimal('1500.00'),
        description: 'Posted factory maintenance',
        journalEntryId: journal.id,
      },
      include: {
        journalEntry: true,
      },
    });

    expect(expense.journalEntryId).toBe(journal.id);
    expect(expense.journalEntry?.entryNumber).toBe(journal.entryNumber);

    // Clean up
    await prisma.expense.delete({ where: { id: expense.id } });
    await prisma.journalEntry.delete({ where: { id: journal.id } });
  });

  it('5. should create and query ExpenseCategoryMapping with default COA account and tax rate',
      userId: expense.id } });
    await prisma.journalEntry.delete({ where: { id: journal.id } });
  });

  it('5. should create and query ExpenseCategoryMapping with default COA account and tax rate',
      permissions: [],
      scope: 'GLOBAL', async () => {
    const categoryCode = `CAT-${Date.now().toString().slice(-4)}`;
    const category = await prisma.expenseCategoryMapping.create({
      data: {
        organizationId: orgId,
        name: 'Store Electricity & Utilities',
        code: categoryCode,
        defaultExpenseAccountId: expenseAccount.id,
        defaultTaxType: TaxType.GST_18,
        requiresApproval: true,
        approvalThreshold: new Prisma.Decimal('2000.00'),
        isActive: true,
      },
      include: {
        defaultExpenseAccount: true,
      },
    });

    expect(category.id).toBeDefined();
    expect(category.code).toBe(categoryCode);
    expect(category.defaultExpenseAccount?.id).toBe(expenseAccount.id);
    expect(category.defaultTaxType).toBe(TaxType.GST_18);
    expect(category.approvalThreshold.toString()).toBe('2000');

    // Reject duplicate code in same org
    await expect(
      prisma.expenseCategoryMapping.create({
        data: {
          organizationId: orgId,
          name: 'Duplicate Category',
          code: categoryCode,
        },
      }),
    ).rejects.toThrow();

    await prisma.expenseCategoryMapping.delete({ where: { id: category.id } });
  });
});
