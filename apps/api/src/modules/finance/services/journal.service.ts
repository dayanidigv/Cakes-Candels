import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { FiscalCalendarService } from './fiscal-calendar.service';
import { QueryJournalDto } from '../dto/query-journal.dto';
import { QueryLedgerDto } from '../dto/query-ledger.dto';
import { ReverseJournalDto } from '../dto/reverse-journal.dto';
import { RequestingUser } from './posting-engine.service';
import { JournalEntry, JournalEntryLine, JournalEntryStatus, AuditAction, BalanceType, Prisma } from '@prisma/client';
import { writeFinanceAuditLog, writeFinanceOutboxEvent } from '../utils/finance-audit-outbox.helper';

@Injectable()
export class JournalService {
  private readonly prisma = prisma;

  constructor(private readonly fiscalCalendarService: FiscalCalendarService) {}

  /**
   * Get single journal entry by ID with lines, account details, and branch details.
   */
  async getJournalById(id: string, user: RequestingUser) {
    const journal = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: true,
            branch: true,
          },
          orderBy: [{ debitAmount: 'desc' }, { creditAmount: 'desc' }],
        },
        reversalOf: true,
        reversedBy: true,
      },
    });

    if (!journal || journal.organizationId !== user.organizationId) {
      throw new NotFoundException(`Journal entry with ID '${id}' not found`);
    }

    return journal;
  }

  /**
   * List paginated journal entries with multi-dimensional filtering.
   */
  async listJournals(user: RequestingUser, query: QueryJournalDto) {
    const where: Prisma.JournalEntryWhereInput = {
      organizationId: user.organizationId,
    };

    if (query.status) where.status = query.status;
    if (query.sourceModule) where.sourceModule = query.sourceModule;
    if (query.sourceEntityType) where.sourceEntityType = query.sourceEntityType;
    if (query.sourceEntityId) where.sourceEntityId = query.sourceEntityId;
    if (query.entryNumber) where.entryNumber = { contains: query.entryNumber, mode: 'insensitive' };
    if (query.referenceNumber) where.referenceNumber = { contains: query.referenceNumber, mode: 'insensitive' };

    if (query.postingDateFrom || query.postingDateTo) {
      where.postingDate = {};
      if (query.postingDateFrom) where.postingDate.gte = new Date(query.postingDateFrom);
      if (query.postingDateTo) where.postingDate.lte = new Date(query.postingDateTo);
    }

    if (query.accountId || query.branchId) {
      where.lines = {
        some: {
          accountId: query.accountId,
          branchId: query.branchId,
        },
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: { account: true, branch: true },
          },
        },
        orderBy: [{ postingDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Reverse an existing posted journal entry according to FINANCE_STATE_MACHINES.md.
   */
  async reverseJournal(
    id: string,
    dto: ReverseJournalDto,
    user: RequestingUser,
  ): Promise<JournalEntry & { lines: JournalEntryLine[] }> {
    const orgId = user.organizationId;
    const actorId = user.id || user.sub || 'system';

    const original = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!original || original.organizationId !== orgId) {
      throw new NotFoundException(`Journal entry with ID '${id}' not found`);
    }

    if (original.status !== JournalEntryStatus.POSTED) {
      throw new BadRequestException(
        `Cannot reverse journal entry in '${original.status}' status (must be POSTED)`,
      );
    }

    if (original.reversalEntryId) {
      throw new BadRequestException(`Journal entry '${original.entryNumber}' has already been reversed`);
    }

    // Determine reversal posting date (defaults to today or dto.postingDate)
    const reversalPostingDate = dto.postingDate ? new Date(dto.postingDate) : new Date();

    // Verify fiscal period is OPEN for reversal date
    await this.fiscalCalendarService.resolveFiscalPeriodForDate(orgId, reversalPostingDate);

    return await this.prisma.$transaction(async (tx) => {
      // Generate reversal entry number
      const yyyymm = reversalPostingDate.toISOString().slice(0, 7).replace('-', '');
      const count = await tx.journalEntry.count({ where: { organizationId: orgId } });
      const sequence = (count + 1).toString().padStart(5, '0');
      const entryNumber = `JE-${yyyymm}-${sequence}-REV-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Invert all lines: Debit -> Credit, Credit -> Debit
      const invertedLines = original.lines.map((l) => ({
        accountId: l.accountId,
        branchId: l.branchId,
        debitAmount: l.creditAmount, // Swapped
        creditAmount: l.debitAmount, // Swapped
        description: `Reversal: ${l.description ?? ''}`.trim(),
        metadata: l.metadata as any,
      }));

      const reversalJournal = await tx.journalEntry.create({
        data: {
          organizationId: orgId,
          entryNumber,
          postingDate: reversalPostingDate,
          documentDate: new Date(),
          sourceModule: original.sourceModule,
          sourceEntityType: original.sourceEntityType,
          sourceEntityId: original.sourceEntityId,
          sourceReference: `REVERSAL_OF_${original.id}`,
          referenceNumber: original.entryNumber,
          status: JournalEntryStatus.POSTED,
          description: `Reversal of ${original.entryNumber}: ${dto.reason}`,
          totalDebit: original.totalCredit, // Total debit of reversal equals original credit
          totalCredit: original.totalDebit, // Total credit of reversal equals original debit
          reversalEntryId: original.id,
          createdById: actorId,
          postedById: actorId,
          postedAt: new Date(),
          lines: {
            create: invertedLines,
          },
        },
        include: { lines: true },
      });

      // Update original journal status to REVERSED
      await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: JournalEntryStatus.REVERSED,
          reversalEntryId: reversalJournal.id,
        },
      });

      // Write AuditLog
      await writeFinanceAuditLog(tx, {
        entity: 'journal_entry',
        entityId: original.id,
        action: AuditAction.UPDATE,
        performedBy: actorId,
        before: { status: JournalEntryStatus.POSTED },
        after: {
          status: JournalEntryStatus.REVERSED,
          reversalEntryId: reversalJournal.id,
          reason: dto.reason,
        },
      });

      // Write Transactional Outbox Event
      await writeFinanceOutboxEvent(tx, {
        type: 'finance.journal.reversed',
        payload: {
          originalJournalEntryId: original.id,
          originalEntryNumber: original.entryNumber,
          reversalJournalEntryId: reversalJournal.id,
          reversalEntryNumber: reversalJournal.entryNumber,
          organizationId: orgId,
          reason: dto.reason,
          reversedBy: actorId,
        },
      });

      return reversalJournal;
    });
  }

  /**
   * Get Account General Ledger drill-down with date-ordered lines and computed running balance.
   */
  async getAccountLedger(accountId: string, user: RequestingUser, query: QueryLedgerDto) {
    const orgId = user.organizationId;

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account || account.organizationId !== orgId) {
      throw new NotFoundException(`Account with ID '${accountId}' not found`);
    }

    const where: Prisma.JournalEntryLineWhereInput = {
      accountId,
      journalEntry: {
        organizationId: orgId,
        status: { in: [JournalEntryStatus.POSTED, JournalEntryStatus.REVERSED] },
      },
    };

    if (query.branchId) where.branchId = query.branchId;
    if (query.startDate || query.endDate) {
      where.journalEntry!.postingDate = {};
      if (query.startDate) where.journalEntry!.postingDate.gte = new Date(query.startDate);
      if (query.endDate) where.journalEntry!.postingDate.lte = new Date(query.endDate);
    }

    const lines = await this.prisma.journalEntryLine.findMany({
      where,
      include: {
        journalEntry: true,
        branch: true,
      },
      orderBy: [{ journalEntry: { postingDate: 'asc' } }, { createdAt: 'asc' }],
    });

    // Compute running balance based on account normal balance
    let runningBalance = new Prisma.Decimal(0);
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    const ledgerEntries = lines.map((line) => {
      const debit = new Prisma.Decimal(line.debitAmount);
      const credit = new Prisma.Decimal(line.creditAmount);

      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      if (account.normalBalance === BalanceType.DEBIT) {
        // Assets & Expenses: +Debit, -Credit
        runningBalance = runningBalance.plus(debit).minus(credit);
      } else {
        // Liabilities, Equity, Revenue: +Credit, -Debit
        runningBalance = runningBalance.plus(credit).minus(debit);
      }

      return {
        id: line.id,
        postingDate: line.journalEntry.postingDate,
        entryNumber: line.journalEntry.entryNumber,
        sourceModule: line.journalEntry.sourceModule,
        sourceEntityType: line.journalEntry.sourceEntityType,
        sourceEntityId: line.journalEntry.sourceEntityId,
        referenceNumber: line.journalEntry.referenceNumber,
        description: line.description || line.journalEntry.description,
        branchName: line.branch?.name ?? null,
        debitAmount: debit.toNumber(),
        creditAmount: credit.toNumber(),
        runningBalance: runningBalance.toNumber(),
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        category: account.category,
        normalBalance: account.normalBalance,
      },
      summary: {
        totalDebit: totalDebit.toNumber(),
        totalCredit: totalCredit.toNumber(),
        closingBalance: runningBalance.toNumber(),
        entryCount: ledgerEntries.length,
      },
      entries: ledgerEntries,
    };
  }
}
