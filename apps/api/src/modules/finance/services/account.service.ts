import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { Account, AccountType, AccountCategory, BalanceType, AuditAction } from '@prisma/client';
import { writeFinanceAuditLog, writeFinanceOutboxEvent } from '../utils/finance-audit-outbox.helper';

import { AuthorizationContext } from '../../../common/interfaces/authorization-context.interface';

export interface RequestingUser extends AuthorizationContext {
  id?: string;
  sub?: string;
  role?: string;
  roles?: string[];
  username?: string;
  employeeId?: string;
}

export interface AccountTreeNode extends Account {
  children?: AccountTreeNode[];
}

@Injectable()
export class AccountService {
  private readonly prisma = prisma;


  /**
   * Create a new Account with strict hierarchy, org isolation, and validation.
   */
  async createAccount(dto: CreateAccountDto, user: RequestingUser): Promise<Account> {
    const orgId = user.organizationId;

    // 1. Check duplicate account code within organization
    const existingCode = await this.prisma.account.findUnique({
      where: {
        organizationId_code: {
          organizationId: orgId,
          code: dto.code,
        },
      },
    });
    if (existingCode) {
      throw new ConflictException(`Account with code '${dto.code}' already exists in this organization`);
    }

    // 2. Validate normal balance matches account type
    this.validateNormalBalance(dto.type, dto.normalBalance);

    // 3. Validate parent if provided
    if (dto.parentId) {
      const parent = await this.prisma.account.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.organizationId !== orgId) {
        throw new NotFoundException('Parent account not found in this organization');
      }
      if (!parent.isActive) {
        throw new BadRequestException('Cannot create a child under an inactive parent account');
      }
    }

    // 4. Create account inside transaction with Audit & Outbox
    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            organizationId: orgId,
            code: dto.code,
            name: dto.name,
            description: dto.description,
            type: dto.type,
            category: dto.category,
            normalBalance: dto.normalBalance,
            parentId: dto.parentId,
            isPostable: dto.isPostable ?? true,
            isSystem: dto.isSystem ?? false,
            isActive: true,
          },
        });

        // If parent was marked postable, mark it as non-postable summary account
        if (dto.parentId) {
          await tx.account.update({
            where: { id: dto.parentId },
            data: { isPostable: false },
          });
        }

        await writeFinanceAuditLog(tx, {
          entity: 'account',
          entityId: account.id,
          action: AuditAction.CREATE,
          performedBy: user.id || user.sub || 'system',
          after: account,
        });

        await writeFinanceOutboxEvent(tx, {
          type: 'finance.account.created',
          payload: {
            accountId: account.id,
            organizationId: account.organizationId,
            code: account.code,
            name: account.name,
            type: account.type,
            category: account.category,
          },
        });

        return account;
      });
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
        throw new ConflictException(`Account with code '${dto.code}' already exists in this organization`);
      }
      throw err;
    }
  }

  /**
   * Get account by ID with organization isolation.
   */
  async getAccountById(id: string, user: RequestingUser): Promise<Account> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!account || account.organizationId !== user.organizationId) {
      throw new NotFoundException(`Account with ID '${id}' not found`);
    }

    return account;
  }

  /**
   * List accounts with optional filters.
   */
  async listAccounts(
    user: RequestingUser,
    filters?: {
      type?: AccountType;
      category?: AccountCategory;
      isActive?: boolean;
      search?: string;
    },
  ): Promise<Account[]> {
    const where: any = {
      organizationId: user.organizationId,
    };

    if (filters?.type) where.type = filters.type;
    if (filters?.category) where.category = filters.category;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.account.findMany({
      where,
      orderBy: [{ code: 'asc' }],
    });
  }

  /**
   * Get full hierarchical account tree for the organization.
   */
  async getAccountTree(user: RequestingUser): Promise<AccountTreeNode[]> {
    const allAccounts = await this.prisma.account.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ code: 'asc' }],
    });

    const accountMap = new Map<string, AccountTreeNode>();
    const rootNodes: AccountTreeNode[] = [];

    for (const acc of allAccounts) {
      accountMap.set(acc.id, { ...acc, children: [] });
    }

    for (const acc of allAccounts) {
      const node = accountMap.get(acc.id)!;
      if (acc.parentId && accountMap.has(acc.parentId)) {
        accountMap.get(acc.parentId)!.children!.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  /**
   * Update account metadata.
   */
  async updateAccount(id: string, dto: UpdateAccountDto, user: RequestingUser): Promise<Account> {
    const account = await this.getAccountById(id, user);

    if (account.isSystem && dto.isActive === false) {
      throw new ForbiddenException('Cannot deactivate a system-protected account');
    }

    // Validate circular hierarchy if changing parent
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('An account cannot be its own parent');
      }
      if (dto.parentId !== null) {
        await this.validateNoCircularHierarchy(id, dto.parentId, user.organizationId);
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          category: dto.category,
          parentId: dto.parentId,
          isPostable: dto.isPostable,
          isActive: dto.isActive,
        },
      });

      await writeFinanceAuditLog(tx, {
        entity: 'account',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        performedBy: user.id,
        before: account,
        after: updated,
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.account.updated',
        payload: {
          accountId: updated.id,
          organizationId: updated.organizationId,
          code: updated.code,
          name: updated.name,
        },
      });

      return updated;
    });
  }

  /**
   * Activate an account.
   */
  async activateAccount(id: string, user: RequestingUser): Promise<Account> {
    const account = await this.getAccountById(id, user);
    if (account.isActive) return account;

    // Ensure parent is active if it has one
    if (account.parentId) {
      const parent = await this.prisma.account.findUnique({ where: { id: account.parentId } });
      if (parent && !parent.isActive) {
        throw new BadRequestException('Cannot activate account while its parent account is inactive');
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id },
        data: { isActive: true },
      });

      await writeFinanceAuditLog(tx, {
        entity: 'account',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.id,
        before: { isActive: false },
        after: { isActive: true },
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.account.activated',
        payload: { accountId: id, organizationId: user.organizationId },
      });

      return updated;
    });
  }

  /**
   * Deactivate an account.
   */
  async deactivateAccount(id: string, user: RequestingUser): Promise<Account> {
    const account = await this.getAccountById(id, user);
    if (!account.isActive) return account;

    if (account.isSystem) {
      throw new ForbiddenException('Cannot deactivate a system-protected account');
    }

    // Ensure no active children
    const activeChildren = await this.prisma.account.count({
      where: {
        parentId: id,
        isActive: true,
      },
    });
    if (activeChildren > 0) {
      throw new BadRequestException('Cannot deactivate account with active child accounts');
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id },
        data: { isActive: false },
      });

      await writeFinanceAuditLog(tx, {
        entity: 'account',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.id,
        before: { isActive: true },
        after: { isActive: false },
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.account.deactivated',
        payload: { accountId: id, organizationId: user.organizationId },
      });

      return updated;
    });
  }

  /**
   * Idempotently seed standard bakery Chart of Accounts defined in FINANCE_DOMAIN_MODEL.md
   */
  async seedSystemAccounts(organizationId: string, performedBy: string = 'system'): Promise<Account[]> {
    const standardAccounts = [
      // 10000 - ASSETS
      { code: '10000', name: 'ASSETS', type: AccountType.ASSET, category: AccountCategory.CASH_AND_EQUIVALENTS, normalBalance: BalanceType.DEBIT, isPostable: false, isSystem: true, parentCode: null },
      { code: '11100', name: 'Main Petty Cash / POS Till', type: AccountType.ASSET, category: AccountCategory.CASH_AND_EQUIVALENTS, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '10000' },
      { code: '11200', name: 'Bank Operating Account (HDFC/ICICI)', type: AccountType.ASSET, category: AccountCategory.BANK, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '10000' },
      { code: '11300', name: 'Payment Gateway Clearing (Razorpay)', type: AccountType.ASSET, category: AccountCategory.CASH_AND_EQUIVALENTS, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '10000' },
      { code: '12000', name: 'Accounts Receivable', type: AccountType.ASSET, category: AccountCategory.ACCOUNTS_RECEIVABLE, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '10000' },
      { code: '13100', name: 'Raw Materials Inventory', type: AccountType.ASSET, category: AccountCategory.INVENTORY_RAW_MATERIALS, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '10000' },
      { code: '13200', name: 'Work In Progress (WIP)', type: AccountType.ASSET, category: AccountCategory.INVENTORY_WIP, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '10000' },
      { code: '13300', name: 'Finished Goods Inventory', type: AccountType.ASSET, category: AccountCategory.INVENTORY_FINISHED_GOODS, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '10000' },
      { code: '14100', name: 'Input CGST Tax Credit', type: AccountType.ASSET, category: AccountCategory.OTHER_CURRENT_ASSETS, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '10000' },
      { code: '14200', name: 'Input SGST Tax Credit', type: AccountType.ASSET, category: AccountCategory.OTHER_CURRENT_ASSETS, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '10000' },
      { code: '14300', name: 'Input IGST Tax Credit', type: AccountType.ASSET, category: AccountCategory.OTHER_CURRENT_ASSETS, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '10000' },

      // 20000 - LIABILITIES
      { code: '20000', name: 'LIABILITIES', type: AccountType.LIABILITY, category: AccountCategory.ACCOUNTS_PAYABLE, normalBalance: BalanceType.CREDIT, isPostable: false, isSystem: true, parentCode: null },
      { code: '21000', name: 'Accounts Payable (Suppliers)', type: AccountType.LIABILITY, category: AccountCategory.ACCOUNTS_PAYABLE, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '20000' },
      { code: '21100', name: 'Statutory Payables (PF / ESI / PT)', type: AccountType.LIABILITY, category: AccountCategory.STATUTORY_PAYABLE, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '20000' },
      { code: '21200', name: 'Employee Payroll Payable', type: AccountType.LIABILITY, category: AccountCategory.PAYROLL_PAYABLE, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '20000' },
      { code: '21300', name: 'GRN Clearing / Unbilled Payables', type: AccountType.LIABILITY, category: AccountCategory.GRN_CLEARING, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '20000' },
      { code: '22100', name: 'Output CGST Payable', type: AccountType.LIABILITY, category: AccountCategory.TAX_PAYABLE, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '20000' },
      { code: '22200', name: 'Output SGST Payable', type: AccountType.LIABILITY, category: AccountCategory.TAX_PAYABLE, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '20000' },
      { code: '22300', name: 'Output IGST Payable', type: AccountType.LIABILITY, category: AccountCategory.TAX_PAYABLE, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '20000' },

      // 30000 - EQUITY
      { code: '30000', name: 'EQUITY', type: AccountType.EQUITY, category: AccountCategory.OWNERS_EQUITY, normalBalance: BalanceType.CREDIT, isPostable: false, isSystem: true, parentCode: null },
      { code: '31000', name: "Owner's Capital / Share Capital", type: AccountType.EQUITY, category: AccountCategory.OWNERS_EQUITY, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '30000' },
      { code: '32000', name: 'Retained Earnings', type: AccountType.EQUITY, category: AccountCategory.RETAINED_EARNINGS, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '30000' },

      // 40000 - REVENUE
      { code: '40000', name: 'REVENUE', type: AccountType.REVENUE, category: AccountCategory.SALES_REVENUE_RETAIL, normalBalance: BalanceType.CREDIT, isPostable: false, isSystem: true, parentCode: null },
      { code: '41000', name: 'Sales Revenue — Retail Storefront', type: AccountType.REVENUE, category: AccountCategory.SALES_REVENUE_RETAIL, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '40000' },
      { code: '42000', name: 'Sales Revenue — Custom Cakes', type: AccountType.REVENUE, category: AccountCategory.SALES_REVENUE_CUSTOM, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '40000' },
      { code: '49000', name: 'Sales Returns & Allowances', type: AccountType.REVENUE, category: AccountCategory.SALES_RETURNS_ALLOWANCES, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '40000' },
      { code: '49500', name: 'POS Cash Overage Income', type: AccountType.REVENUE, category: AccountCategory.OTHER_INCOME, normalBalance: BalanceType.CREDIT, isPostable: true, isSystem: true, parentCode: '40000' },

      // 50000 - EXPENSES
      { code: '50000', name: 'EXPENSES', type: AccountType.EXPENSE, category: AccountCategory.COST_OF_GOODS_SOLD, normalBalance: BalanceType.DEBIT, isPostable: false, isSystem: true, parentCode: null },
      { code: '50100', name: 'Cost of Goods Sold (COGS)', type: AccountType.EXPENSE, category: AccountCategory.COST_OF_GOODS_SOLD, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
      { code: '51000', name: 'Salaries & Wages Expense', type: AccountType.EXPENSE, category: AccountCategory.SALARY_AND_WAGES, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
      { code: '52100', name: 'Rent Expense', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE_RENT, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
      { code: '52200', name: 'Electricity & Utilities Expense', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE_UTILITIES, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
      { code: '52300', name: 'Diesel & Generator Fuel Expense', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE_UTILITIES, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
      { code: '52400', name: 'Water Supply Expense', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE_UTILITIES, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
      { code: '52500', name: 'Internet & Telecom Expense', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE_UTILITIES, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
      { code: '52600', name: 'Repair & Maintenance Expense', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE_MAINTENANCE, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
      { code: '53000', name: 'Inventory Wastage & Spoilage Expense', type: AccountType.EXPENSE, category: AccountCategory.INVENTORY_WASTAGE, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
      { code: '59000', name: 'POS Cash Shortage Expense', type: AccountType.EXPENSE, category: AccountCategory.MISCELLANEOUS_EXPENSE, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
      { code: '59100', name: 'Payment Gateway Processing Fees', type: AccountType.EXPENSE, category: AccountCategory.FINANCE_CHARGES, normalBalance: BalanceType.DEBIT, isPostable: true, isSystem: true, parentCode: '50000' },
    ];

    const results: Account[] = [];

    const safeUpsert = async (def: any, parentId?: string): Promise<Account> => {
      try {
        return await this.prisma.account.upsert({
          where: { organizationId_code: { organizationId, code: def.code } },
          create: {
            organizationId,
            code: def.code,
            name: def.name,
            type: def.type,
            category: def.category,
            normalBalance: def.normalBalance,
            parentId: parentId ?? null,
            isPostable: def.isPostable,
            isSystem: def.isSystem,
            isActive: true,
          },
          update: {},
        });
      } catch (err: any) {
        if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
          const found = await this.prisma.account.findUnique({
            where: { organizationId_code: { organizationId, code: def.code } },
          });
          if (found) return found;
        }
        throw err;
      }
    };

    // Phase 1: Upsert top-level parent accounts
    for (const def of standardAccounts.filter((a) => a.parentCode === null)) {
      const account = await safeUpsert(def);
      results.push(account);
    }

    // Phase 2: Upsert child accounts linked to parents
    for (const def of standardAccounts.filter((a) => a.parentCode !== null)) {
      let parent = await this.prisma.account.findUnique({
        where: { organizationId_code: { organizationId, code: def.parentCode! } },
      });
      if (!parent) {
        const parentDef = standardAccounts.find((a) => a.code === def.parentCode);
        if (parentDef) {
          parent = await safeUpsert(parentDef);
        }
      }
      if (parent) {
        const account = await safeUpsert(def, parent.id);
        results.push(account);
      }
    }

    return results;
  }

  /**
   * Helper to ensure no circular parent references.
   */
  private async validateNoCircularHierarchy(currentId: string, targetParentId: string, orgId: string): Promise<void> {
    let checkParentId: string | null = targetParentId;
    const visited = new Set<string>([currentId]);

    while (checkParentId) {
      if (visited.has(checkParentId)) {
        throw new BadRequestException('Circular hierarchy detected. An account cannot be a descendant of itself.');
      }
      visited.add(checkParentId);

      const parent: Account | null = await this.prisma.account.findUnique({
        where: { id: checkParentId },
      });

      if (!parent || parent.organizationId !== orgId) {
        throw new NotFoundException('Parent account not found in this organization');
      }

      checkParentId = parent.parentId;
    }
  }

  /**
   * Helper to validate normal balance matching account type.
   */
  private validateNormalBalance(type: AccountType, normalBalance: BalanceType): void {
    if ((type === AccountType.ASSET || type === AccountType.EXPENSE) && normalBalance !== BalanceType.DEBIT) {
      throw new BadRequestException(`Normal balance for ${type} accounts must be DEBIT`);
    }
    if (
      (type === AccountType.LIABILITY || type === AccountType.EQUITY || type === AccountType.REVENUE) &&
      normalBalance !== BalanceType.CREDIT
    ) {
      // Exception: Sales Returns is a contra-revenue account and can be DEBIT
      // But standard check applies
    }
  }
}
