import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import {
  ExpenseStatus,
  ExpensePaymentType,
  TaxType,
  AccountType,
  AuditAction,
  Prisma,
} from '@prisma/client';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { QueryExpenseDto } from '../dto/query-expense.dto';
import { RejectExpenseDto } from '../dto/reject-expense.dto';
import { CreateExpenseCategoryMappingDto } from '../dto/create-expense-category.dto';
import { RequestingUser } from './posting-engine.service';
import { writeFinanceAuditLog, writeFinanceOutboxEvent } from '../utils/finance-audit-outbox.helper';

@Injectable()
export class ExpenseService {
  private readonly prisma = prisma;

  /**
   * Derive server-side tax rate from TaxType enum.
   */
  private getTaxRate(taxType: TaxType): number {
    switch (taxType) {
      case TaxType.GST_5:
        return 0.05;
      case TaxType.GST_12:
        return 0.12;
      case TaxType.GST_18:
        return 0.18;
      case TaxType.GST_28:
        return 0.28;
      case TaxType.NONE:
      default:
        return 0;
    }
  }

  /**
   * Create operational Expense record in DRAFT status.
   */
  async createExpense(dto: CreateExpenseDto, user: RequestingUser) {
    const orgId = user.organizationId;
    const actorId = user.id || user.sub || 'system';

    // ─── 1. Branch Scope Security ──────────────────────────────────────────────
    if (user.scope === 'BRANCH' && user.branchId && user.branchId !== dto.branchId) {
      throw new ForbiddenException(`User with BRANCH scope cannot create expenses for branch ID '${dto.branchId}'`);
    }

    // ─── 2. Idempotency Check ──────────────────────────────────────────────────
    if (dto.idempotencyKey) {
      const existing = await this.prisma.expense.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { branch: true, expenseAccount: true, paymentAccount: true, supplier: true },
      });
      if (existing) {
        if (existing.organizationId !== orgId) {
          throw new ConflictException(`Idempotency key '${dto.idempotencyKey}' belongs to another organization`);
        }
        return { expense: existing, isReplay: true };
      }
    }

    // ─── 3. Account Validation ─────────────────────────────────────────────────
    const expenseAcc = await this.prisma.account.findUnique({ where: { id: dto.expenseAccountId } });
    if (!expenseAcc || expenseAcc.organizationId !== orgId) {
      throw new NotFoundException(`Expense account '${dto.expenseAccountId}' not found in organization`);
    }
    if (!expenseAcc.isActive || !expenseAcc.isPostable || expenseAcc.type !== AccountType.EXPENSE) {
      throw new BadRequestException(
        `Account '${expenseAcc.code} - ${expenseAcc.name}' is not an active postable EXPENSE account`,
      );
    }

    const paymentAcc = await this.prisma.account.findUnique({ where: { id: dto.paymentAccountId } });
    if (!paymentAcc || paymentAcc.organizationId !== orgId) {
      throw new NotFoundException(`Payment account '${dto.paymentAccountId}' not found in organization`);
    }
    if (
      !paymentAcc.isActive ||
      !paymentAcc.isPostable ||
      (paymentAcc.type !== AccountType.ASSET && paymentAcc.type !== AccountType.LIABILITY)
    ) {
      throw new BadRequestException(
        `Account '${paymentAcc.code} - ${paymentAcc.name}' is not an active postable ASSET or LIABILITY account`,
      );
    }

    // ─── 4. Vendor Validation & Duplicate Invoice Check ────────────────────────
    if (dto.vendorId) {
      const vendor = await this.prisma.supplier.findUnique({ where: { id: dto.vendorId } });
      if (!vendor || vendor.organizationId !== orgId) {
        throw new NotFoundException(`Vendor / Supplier '${dto.vendorId}' not found in organization`);
      }
      if (dto.invoiceNumber) {
        const dupeBill = await this.prisma.expense.findUnique({
          where: {
            organizationId_vendorId_invoiceNumber: {
              organizationId: orgId,
              vendorId: dto.vendorId,
              invoiceNumber: dto.invoiceNumber,
            },
          },
        });
        if (dupeBill) {
          throw new ConflictException(
            `Invoice '${dto.invoiceNumber}' for vendor '${vendor.name}' has already been filed in this organization`,
          );
        }
      }
    }

    // ─── 5. Server-Authoritative Tax & Amount Calculation ───────────────────────
    const baseAmountDec = new Prisma.Decimal(dto.baseAmount.toFixed(2));
    const taxRate = this.getTaxRate(dto.taxType || TaxType.NONE);
    const taxAmountDec = new Prisma.Decimal((dto.baseAmount * taxRate).toFixed(2));
    const totalAmountDec = baseAmountDec.add(taxAmountDec);

    const expenseDate = new Date(dto.expenseDate);
    const yyyymm = expenseDate.toISOString().slice(0, 7).replace('-', '');

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Sequence numbering
        const count = await tx.expense.count({ where: { organizationId: orgId } });
        const sequence = (count + 1).toString().padStart(5, '0');
        const expenseNumber = `EXP-${yyyymm}-${sequence}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const expense = await tx.expense.create({
          data: {
            organizationId: orgId,
            expenseNumber,
            branchId: dto.branchId,
            expenseAccountId: dto.expenseAccountId,
            paymentAccountId: dto.paymentAccountId,
            vendorId: dto.vendorId || null,
            status: ExpenseStatus.DRAFT,
            paymentType: dto.paymentType,
            expenseDate,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            invoiceNumber: dto.invoiceNumber || null,
            baseAmount: baseAmountDec,
            taxType: dto.taxType || TaxType.NONE,
            taxAmount: taxAmountDec,
            totalAmount: totalAmountDec,
            currency: 'INR',
            description: dto.description,
            attachmentUrl: dto.attachmentUrl || null,
            idempotencyKey: dto.idempotencyKey || null,
          },
          include: {
            organization: true,
            branch: true,
            expenseAccount: true,
            paymentAccount: true,
            supplier: true,
          },
        });

        await writeFinanceAuditLog(tx, {
          module: 'FINANCE',
          entity: 'Expense',
          entityId: expense.id,
          action: AuditAction.CREATE,
          performedBy: actorId,
          branchId: dto.branchId,
          after: {
            expenseNumber,
            status: expense.status,
            totalAmount: expense.totalAmount.toString(),
          },
        });

        await writeFinanceOutboxEvent(tx, {
          type: 'finance.expense.created',
          payload: {
            expenseId: expense.id,
            expenseNumber: expense.expenseNumber,
            organizationId: orgId,
            branchId: dto.branchId,
            baseAmount: expense.baseAmount,
            taxAmount: expense.taxAmount,
            totalAmount: expense.totalAmount,
            createdById: actorId,
          },
        });

        return { expense, isReplay: false };
      });
    } catch (err: any) {
      if (dto.idempotencyKey && (err.code === 'P2002' || err.message?.includes('idempotencyKey'))) {
        const existing = await this.prisma.expense.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: { branch: true, expenseAccount: true, paymentAccount: true, supplier: true },
        });
        if (existing) {
          return { expense: existing, isReplay: true };
        }
      }
      throw err;
    }
  }

  /**
   * Submit expense for approval (DRAFT -> SUBMITTED).
   */
  async submitExpense(id: string, user: RequestingUser) {
    const orgId = user.organizationId;
    const actorId = user.id || user.sub || 'system';

    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense || expense.organizationId !== orgId) {
      throw new NotFoundException(`Expense '${id}' not found`);
    }

    if (user.scope === 'BRANCH' && user.branchId && user.branchId !== expense.branchId) {
      throw new ForbiddenException(`User cannot submit expenses for foreign branch '${expense.branchId}'`);
    }

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit expense in '${expense.status}' status (must be DRAFT)`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.SUBMITTED,
          submittedById: actorId,
          submittedAt: new Date(),
        },
        include: { branch: true, expenseAccount: true, paymentAccount: true, supplier: true },
      });

      await writeFinanceAuditLog(tx, {
        module: 'FINANCE',
        entity: 'Expense',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        performedBy: actorId,
        branchId: updated.branchId,
        before: { status: expense.status },
        after: { status: updated.status, submittedAt: updated.submittedAt },
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.expense.submitted',
        payload: {
          expenseId: updated.id,
          expenseNumber: updated.expenseNumber,
          organizationId: orgId,
          branchId: updated.branchId,
          totalAmount: updated.totalAmount,
          submittedById: actorId,
          submittedAt: updated.submittedAt,
        },
      });

      return updated;
    });
  }

  /**
   * Approve submitted expense (SUBMITTED -> APPROVED).
   */
  async approveExpense(id: string, user: RequestingUser) {
    const orgId = user.organizationId;
    const actorId = user.id || user.sub || 'system';

    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense || expense.organizationId !== orgId) {
      throw new NotFoundException(`Expense '${id}' not found`);
    }

    if (user.scope === 'BRANCH' && user.branchId && user.branchId !== expense.branchId) {
      throw new ForbiddenException(`User cannot approve expenses for foreign branch '${expense.branchId}'`);
    }

    if (expense.status !== ExpenseStatus.SUBMITTED) {
      throw new BadRequestException(`Cannot approve expense in '${expense.status}' status (must be SUBMITTED)`);
    }

    // Atomic Compare-And-Swap update to prevent double-approval race conditions
    const count = await this.prisma.expense.updateMany({
      where: { id, status: ExpenseStatus.SUBMITTED },
      data: {
        status: ExpenseStatus.APPROVED,
        approvedById: actorId,
        approvedAt: new Date(),
      },
    });

    if (count.count === 0) {
      throw new ConflictException(`Expense '${id}' was already approved or modified concurrently`);
    }

    const updated = await this.prisma.expense.findUnique({
      where: { id },
      include: { branch: true, expenseAccount: true, paymentAccount: true, supplier: true },
    });

    await writeFinanceAuditLog(this.prisma, {
      module: 'FINANCE',
      entity: 'Expense',
      entityId: id,
      action: AuditAction.UPDATE,
      performedBy: actorId,
      branchId: expense.branchId,
      before: { status: ExpenseStatus.SUBMITTED },
      after: { status: ExpenseStatus.APPROVED, approvedById: actorId },
    });

    await writeFinanceOutboxEvent(this.prisma, {
      type: 'finance.expense.approved',
      payload: {
        expenseId: id,
        expenseNumber: expense.expenseNumber,
        organizationId: orgId,
        totalAmount: expense.totalAmount,
        approvedById: actorId,
        approvedAt: updated?.approvedAt,
      },
    });

    return updated!;
  }

  /**
   * Reject submitted expense (SUBMITTED -> REJECTED).
   */
  async rejectExpense(id: string, dto: RejectExpenseDto, user: RequestingUser) {
    const orgId = user.organizationId;
    const actorId = user.id || user.sub || 'system';

    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense || expense.organizationId !== orgId) {
      throw new NotFoundException(`Expense '${id}' not found`);
    }

    if (expense.status !== ExpenseStatus.SUBMITTED) {
      throw new BadRequestException(`Cannot reject expense in '${expense.status}' status (must be SUBMITTED)`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.REJECTED,
          rejectionReason: dto.reason,
        },
        include: { branch: true, expenseAccount: true, paymentAccount: true, supplier: true },
      });

      await writeFinanceAuditLog(tx, {
        module: 'FINANCE',
        entity: 'Expense',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: actorId,
        branchId: expense.branchId,
        before: { status: expense.status },
        after: { status: updated.status, rejectionReason: dto.reason },
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.expense.rejected',
        payload: {
          expenseId: id,
          expenseNumber: expense.expenseNumber,
          organizationId: orgId,
          rejectedById: actorId,
          rejectionReason: dto.reason,
        },
      });

      return updated;
    });
  }

  /**
   * Cancel unposted expense (DRAFT / SUBMITTED / APPROVED -> CANCELLED).
   */
  async cancelUnpostedExpense(id: string, reason: string | undefined, user: RequestingUser) {
    const orgId = user.organizationId;
    const actorId = user.id || user.sub || 'system';

    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense || expense.organizationId !== orgId) {
      throw new NotFoundException(`Expense '${id}' not found`);
    }

    if (expense.status === ExpenseStatus.POSTED) {
      throw new BadRequestException(`Posted expenses must be reversed via GL cancellation workflow`);
    }

    if (expense.status === ExpenseStatus.CANCELLED) {
      throw new BadRequestException(`Expense '${expense.expenseNumber}' is already cancelled`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.CANCELLED,
          cancelledById: actorId,
          cancelledAt: new Date(),
          cancelReason: reason || 'Cancelled by user',
        },
        include: { branch: true, expenseAccount: true, paymentAccount: true, supplier: true },
      });

      await writeFinanceAuditLog(tx, {
        module: 'FINANCE',
        entity: 'Expense',
        entityId: id,
        action: AuditAction.DELETE,
        performedBy: actorId,
        branchId: expense.branchId,
        before: { status: expense.status },
        after: { status: updated.status, cancelReason: updated.cancelReason },
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.expense.cancelled',
        payload: {
          expenseId: id,
          expenseNumber: expense.expenseNumber,
          organizationId: orgId,
          cancelledById: actorId,
          cancelReason: updated.cancelReason,
        },
      });

      return updated;
    });
  }

  /**
   * Get single expense by ID with full relations.
   */
  async getExpenseById(id: string, user: RequestingUser) {
    const orgId = user.organizationId;
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        organization: true,
        branch: true,
        expenseAccount: true,
        paymentAccount: true,
        supplier: true,
        journalEntry: {
          include: {
            lines: {
              include: { account: true, branch: true },
            },
          },
        },
      },
    });

    if (!expense || expense.organizationId !== orgId) {
      throw new NotFoundException(`Expense '${id}' not found`);
    }

    if (user.scope === 'BRANCH' && user.branchId && user.branchId !== expense.branchId) {
      throw new ForbiddenException(`User cannot view expenses for foreign branch '${expense.branchId}'`);
    }

    return expense;
  }

  /**
   * Query expenses with pagination and filtering.
   */
  async getExpenses(query: QueryExpenseDto, user: RequestingUser) {
    const orgId = user.organizationId;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      organizationId: orgId,
    };

    if (user.scope === 'BRANCH' && user.branchId) {
      where.branchId = user.branchId;
    } else if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.expenseDate = {};
      if (query.startDate) where.expenseDate.gte = new Date(query.startDate);
      if (query.endDate) where.expenseDate.lte = new Date(query.endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expenseDate: 'desc' },
        include: {
          branch: true,
          expenseAccount: true,
          paymentAccount: true,
          supplier: true,
          journalEntry: true,
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get summary of expenses by status & totals.
   */
  async getExpenseSummary(branchId?: string, user?: RequestingUser) {
    const orgId = user?.organizationId;
    const where: Prisma.ExpenseWhereInput = {};
    if (orgId) where.organizationId = orgId;
    if (user?.scope === 'BRANCH' && user.branchId) {
      where.branchId = user.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      select: { status: true, totalAmount: true },
    });

    const statusCounts: Record<string, number> = {};
    let grandTotal = new Prisma.Decimal(0);

    for (const e of expenses) {
      statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
      if (e.status === ExpenseStatus.POSTED) {
        grandTotal = grandTotal.add(e.totalAmount);
      }
    }

    return {
      totalCount: expenses.length,
      statusCounts,
      postedGrandTotal: grandTotal.toNumber(),
    };
  }

  /**
   * Create Category Mapping for Expense setup.
   */
  async createCategoryMapping(dto: CreateExpenseCategoryMappingDto, user: RequestingUser) {
    const orgId = user.organizationId;
    const existing = await this.prisma.expenseCategoryMapping.findUnique({
      where: {
        organizationId_code: {
          organizationId: orgId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Expense category code '${dto.code}' already exists`);
    }

    return await this.prisma.expenseCategoryMapping.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        code: dto.code,
        defaultExpenseAccountId: dto.defaultExpenseAccountId || null,
        defaultTaxType: dto.defaultTaxType || TaxType.NONE,
        requiresApproval: dto.requiresApproval !== undefined ? dto.requiresApproval : true,
        approvalThreshold: dto.approvalThreshold !== undefined ? new Prisma.Decimal(dto.approvalThreshold) : new Prisma.Decimal(1000),
        isActive: true,
      },
      include: { defaultExpenseAccount: true },
    });
  }

  /**
   * Get Category Mappings for tenant.
   */
  async getCategoryMappings(user: RequestingUser) {
    return await this.prisma.expenseCategoryMapping.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      include: { defaultExpenseAccount: true },
      orderBy: { name: 'asc' },
    });
  }
}
