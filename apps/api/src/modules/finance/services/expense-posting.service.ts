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
  AccountType,
  AccountCategory,
  AuditAction,
  Prisma,
} from '@prisma/client';
import { FinancePostingEngine, RequestingUser } from './posting-engine.service';
import { JournalService } from './journal.service';
import { PostJournalCommandDto, JournalLineDto } from '../dto/post-journal.dto';
import { writeFinanceAuditLog, writeFinanceOutboxEvent } from '../utils/finance-audit-outbox.helper';

@Injectable()
export class ExpensePostingService {
  private readonly prisma = prisma;

  constructor(
    private readonly postingEngine: FinancePostingEngine,
    private readonly journalService: JournalService,
  ) {}

  /**
   * Helper to resolve Input GST Receivable account in organization if tax is applicable.
   */
  private async resolveInputTaxAccount(orgId: string): Promise<string | null> {
    const taxAcc = await this.prisma.account.findFirst({
      where: {
        organizationId: orgId,
        isActive: true,
        isPostable: true,
        OR: [
          { code: { startsWith: '115' } },
          { name: { contains: 'GST', mode: 'insensitive' } },
          { name: { contains: 'Tax', mode: 'insensitive' } },
        ],
      },
    });
    return taxAcc ? taxAcc.id : null;
  }

  /**
   * Post approved operational Expense to General Ledger atomically via FinancePostingEngine.
   */
  async postExpenseToGL(expenseId: string, user: RequestingUser) {
    const orgId = user.organizationId;
    const actorId = user.id || user.sub || 'system';

    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        branch: true,
        expenseAccount: true,
        paymentAccount: true,
        supplier: true,
        journalEntry: true,
      },
    });

    if (!expense || expense.organizationId !== orgId) {
      throw new NotFoundException(`Expense '${expenseId}' not found`);
    }

    if (user.scope === 'BRANCH' && user.branchId && user.branchId !== expense.branchId) {
      throw new ForbiddenException(`User cannot post expenses for foreign branch '${expense.branchId}'`);
    }

    // ─── Replay Check ────────────────────────────────────────────────────────
    if (expense.status === ExpenseStatus.POSTED && expense.journalEntryId) {
      const existingJournal = await this.journalService.getJournalById(expense.journalEntryId, user);
      return { expense, journal: existingJournal, isReplay: true };
    }

    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot post expense in '${expense.status}' status (must be APPROVED)`,
      );
    }

    // ─── COA Active Leaf Account Checks ──────────────────────────────────────
    if (!expense.expenseAccount.isActive || !expense.expenseAccount.isPostable) {
      throw new BadRequestException(
        `Expense account '${expense.expenseAccount.code} - ${expense.expenseAccount.name}' is inactive or non-postable`,
      );
    }

    if (!expense.paymentAccount.isActive || !expense.paymentAccount.isPostable) {
      throw new BadRequestException(
        `Payment account '${expense.paymentAccount.code} - ${expense.paymentAccount.name}' is inactive or non-postable`,
      );
    }

    // ─── Build Server-Derived Double-Entry Posting Command ───────────────────
    const baseAmt = expense.baseAmount.toNumber();
    const taxAmt = expense.taxAmount.toNumber();
    const totalAmt = expense.totalAmount.toNumber();

    const lines: JournalLineDto[] = [];
    let inputTaxAccountId: string | null = null;

    if (taxAmt > 0) {
      inputTaxAccountId = await this.resolveInputTaxAccount(orgId);
    }

    if (taxAmt > 0 && inputTaxAccountId) {
      // 3-Line Posting: Debit Expense, Debit Input GST, Credit Payment
      lines.push({
        accountId: expense.expenseAccountId,
        branchId: expense.branchId,
        debitAmount: baseAmt,
        creditAmount: 0,
        description: `Base Expense: ${expense.description}`,
      });
      lines.push({
        accountId: inputTaxAccountId,
        branchId: expense.branchId,
        debitAmount: taxAmt,
        creditAmount: 0,
        description: `Input GST on Expense ${expense.expenseNumber}`,
      });
    } else {
      // 2-Line Posting: Debit Expense (including tax), Credit Payment
      lines.push({
        accountId: expense.expenseAccountId,
        branchId: expense.branchId,
        debitAmount: totalAmt,
        creditAmount: 0,
        description: `Expense: ${expense.description}`,
      });
    }

    lines.push({
      accountId: expense.paymentAccountId,
      branchId: expense.branchId,
      debitAmount: 0,
      creditAmount: totalAmt,
      description: `Payment for Expense ${expense.expenseNumber}`,
    });

    const postingDateStr = expense.expenseDate.toISOString().slice(0, 10);
    const command: PostJournalCommandDto = {
      postingDate: postingDateStr,
      documentDate: postingDateStr,
      sourceModule: 'FINANCE',
      sourceEntityType: 'EXPENSE',
      sourceEntityId: expense.id,
      sourceReference: expense.expenseNumber,
      description: `Expense Posting: ${expense.description} (${expense.expenseNumber})`,
      lines,
    };

    // ─── Invoke Centralized FinancePostingEngine ──────────────────────────────
    const postResult = await this.postingEngine.post(command, user);

    if (postResult.isReplay) {
      const currentExpense = await this.prisma.expense.findUnique({
        where: { id: expenseId },
        include: {
          branch: true,
          expenseAccount: true,
          paymentAccount: true,
          supplier: true,
          journalEntry: true,
        },
      });
      return { expense: currentExpense ?? expense, journal: postResult.journal, isReplay: true };
    }

    // ─── Atomic State Update & Outbox Event ───────────────────────────────────
    const updatedExpense = await this.prisma.$transaction(async (tx) => {
      const exp = await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: ExpenseStatus.POSTED,
          journalEntryId: postResult.journal.id,
          postedById: actorId,
          postedAt: new Date(),
        },
        include: {
          branch: true,
          expenseAccount: true,
          paymentAccount: true,
          supplier: true,
          journalEntry: true,
        },
      });

      await writeFinanceAuditLog(tx, {
        module: 'FINANCE',
        entity: 'Expense',
        entityId: expenseId,
        action: AuditAction.UPDATE,
        performedBy: actorId,
        branchId: expense.branchId,
        before: { status: ExpenseStatus.APPROVED },
        after: { status: ExpenseStatus.POSTED, journalEntryId: postResult.journal.id },
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.expense.posted',
        payload: {
          expenseId: expenseId,
          expenseNumber: expense.expenseNumber,
          organizationId: orgId,
          journalEntryId: postResult.journal.id,
          entryNumber: postResult.journal.entryNumber,
          totalAmount: expense.totalAmount,
          postedById: actorId,
          postedAt: exp.postedAt,
        },
      });

      return exp;
    });

    return {
      expense: updatedExpense,
      journal: postResult.journal,
      isReplay: postResult.isReplay,
    };
  }

  /**
   * Reverse a POSTED Expense by invoking non-destructive GL reversal in JournalService.
   */
  async reverseExpenseGL(expenseId: string, reason: string | undefined, user: RequestingUser) {
    const orgId = user.organizationId;
    const actorId = user.id || user.sub || 'system';

    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { journalEntry: true },
    });

    if (!expense || expense.organizationId !== orgId) {
      throw new NotFoundException(`Expense '${expenseId}' not found`);
    }

    if (expense.status !== ExpenseStatus.POSTED || !expense.journalEntryId) {
      throw new BadRequestException(
        `Cannot reverse expense in '${expense.status}' status (must be POSTED with GL journal)`,
      );
    }

    // ─── Invoke Non-Destructive GL Reversal ────────────────────────────────────
    const reversalReason = reason || 'Expense Reversal & Cancellation';
    const reversalPostingDate = expense.expenseDate.toISOString().slice(0, 10);
    const reversalJournal = await this.journalService.reverseJournal(
      expense.journalEntryId,
      { reason: reversalReason, postingDate: reversalPostingDate },
      user,
    );

    // ─── Atomic Expense Cancellation State Update ──────────────────────────────
    const updatedExpense = await this.prisma.$transaction(async (tx) => {
      const exp = await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: ExpenseStatus.CANCELLED,
          cancelledById: actorId,
          cancelledAt: new Date(),
          cancelReason: reversalReason,
        },
        include: {
          branch: true,
          expenseAccount: true,
          paymentAccount: true,
          supplier: true,
          journalEntry: true,
        },
      });

      await writeFinanceAuditLog(tx, {
        module: 'FINANCE',
        entity: 'Expense',
        entityId: expenseId,
        action: AuditAction.DELETE,
        performedBy: actorId,
        branchId: expense.branchId,
        before: { status: ExpenseStatus.POSTED, journalEntryId: expense.journalEntryId },
        after: {
          status: ExpenseStatus.CANCELLED,
          reversalJournalId: reversalJournal.id,
          cancelReason: reversalReason,
        },
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.expense.cancelled',
        payload: {
          expenseId: expenseId,
          expenseNumber: expense.expenseNumber,
          organizationId: orgId,
          journalEntryId: expense.journalEntryId,
          reversalJournalId: reversalJournal.id,
          cancelledById: actorId,
          cancelReason: reversalReason,
        },
      });

      return exp;
    });

    return {
      expense: updatedExpense,
      reversalJournal,
    };
  }
}
