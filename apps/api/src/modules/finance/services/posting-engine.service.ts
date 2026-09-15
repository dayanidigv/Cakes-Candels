import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { FiscalCalendarService } from './fiscal-calendar.service';
import { PostJournalCommandDto } from '../dto/post-journal.dto';
import { JournalEntry, JournalEntryLine, JournalEntryStatus, AuditAction, Prisma } from '@prisma/client';
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

export interface PostJournalResult {
  journal: JournalEntry & { lines: JournalEntryLine[] };
  isReplay: boolean;
}

@Injectable()
export class FinancePostingEngine {
  private readonly prisma = prisma;

  constructor(private readonly fiscalCalendarService: FiscalCalendarService) {}

  /**
   * Centralized, atomic double-entry posting engine.
   * Enforces all 10-point invariants, fiscal period locks, idempotency, and audit outbox.
   */
  async post(command: PostJournalCommandDto, user: RequestingUser): Promise<PostJournalResult> {
    const orgId = user.organizationId;
    const actorId = user.id || user.sub || 'system';
    const postingDate = new Date(command.postingDate);
    const documentDate = command.documentDate ? new Date(command.documentDate) : new Date();
    const sourceRef = command.sourceReference ?? 'DEFAULT';

    // ─── 1. IDEMPOTENCY & REPLAY CHECK ───────────────────────────────────────
    const existing = await this.prisma.journalEntry.findUnique({
      where: {
        org_source_event_unique: {
          organizationId: orgId,
          sourceModule: command.sourceModule,
          sourceEntityType: command.sourceEntityType,
          sourceEntityId: command.sourceEntityId,
          sourceReference: sourceRef,
        },
      },
      include: { lines: true },
    });

    if (existing) {
      return { journal: existing, isReplay: true };
    }

    // ─── 2. RESOLVE & VALIDATE FISCAL PERIOD ────────────────────────────────
    await this.fiscalCalendarService.resolveFiscalPeriodForDate(orgId, postingDate);

    // ─── 3. VALIDATE JOURNAL LINES & AMOUNTS ──────────────────────────────────
    if (!command.lines || command.lines.length < 2) {
      throw new BadRequestException('A double-entry journal must contain at least 2 lines');
    }

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    const accountIds = new Set<string>();
    const branchIds = new Set<string>();

    const sanitizedLines: {
      accountId: string;
      branchId?: string;
      debitAmount: Prisma.Decimal;
      creditAmount: Prisma.Decimal;
      description?: string;
      metadata?: any;
    }[] = [];

    for (let idx = 0; idx < command.lines.length; idx++) {
      const line = command.lines[idx];
      const debit = new Prisma.Decimal(line.debitAmount ?? 0);
      const credit = new Prisma.Decimal(line.creditAmount ?? 0);

      // Validate amounts
      if (debit.lessThan(0) || credit.lessThan(0)) {
        throw new BadRequestException(`Line ${idx + 1}: Debit and Credit amounts must be non-negative`);
      }

      if (debit.greaterThan(0) && credit.greaterThan(0)) {
        throw new BadRequestException(`Line ${idx + 1}: A line cannot have both Debit and Credit amounts`);
      }

      if (debit.isZero() && credit.isZero()) {
        throw new BadRequestException(`Line ${idx + 1}: A line must have either a positive Debit or Credit amount`);
      }

      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      accountIds.add(line.accountId);
      if (line.branchId) branchIds.add(line.branchId);

      sanitizedLines.push({
        accountId: line.accountId,
        branchId: line.branchId,
        debitAmount: debit,
        creditAmount: credit,
        description: line.description,
        metadata: line.metadata,
      });
    }

    // ─── 4. DOUBLE-ENTRY MATHEMATICAL INVARIANT ──────────────────────────────
    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Double-entry imbalance: Total Debit (${totalDebit.toFixed(2)}) must exactly equal Total Credit (${totalCredit.toFixed(2)})`,
      );
    }

    if (totalDebit.isZero()) {
      throw new BadRequestException('Journal total cannot be zero');
    }

    // ─── 5. VALIDATE ACCOUNTS (ORG, ACTIVE, POSTABLE LEAF) ───────────────────
    const accounts = await this.prisma.account.findMany({
      where: {
        id: { in: Array.from(accountIds) },
        organizationId: orgId,
      },
    });

    if (accounts.length !== accountIds.size) {
      throw new NotFoundException('One or more accounts do not exist in this organization');
    }

    for (const acc of accounts) {
      if (!acc.isActive) {
        throw new BadRequestException(`Account '${acc.code} - ${acc.name}' is INACTIVE and cannot receive postings`);
      }
      if (!acc.isPostable) {
        throw new BadRequestException(
          `Account '${acc.code} - ${acc.name}' is a parent/summary account and cannot receive postings directly`,
        );
      }
    }

    // ─── 6. VALIDATE BRANCH ATTRIBUTION & USER SCOPE ────────────────────────
    if (branchIds.size > 0) {
      const branches = await this.prisma.branch.findMany({
        where: {
          id: { in: Array.from(branchIds) },
          organizationId: orgId,
        },
      });

      if (branches.length !== branchIds.size) {
        throw new NotFoundException('One or more branches do not belong to this organization');
      }

      // Branch scope authorization
      if (user.scope === 'BRANCH' && user.branchId) {
        for (const bId of branchIds) {
          if (bId !== user.branchId) {
            throw new ForbiddenException(`User with BRANCH scope cannot post transactions for branch ID '${bId}'`);
          }
        }
      }
    }

    // ─── 7. ATOMIC TRANSACTION EXECUTION ─────────────────────────────────────
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Generate unique entry number: e.g. JE-202604-00001
          const yyyymm = postingDate.toISOString().slice(0, 7).replace('-', '');
          const count = await tx.journalEntry.count({
            where: { organizationId: orgId },
          });
        const sequence = (count + 1).toString().padStart(5, '0');
        const entryNumber = `JE-${yyyymm}-${sequence}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const journal = await tx.journalEntry.create({
          data: {
            organizationId: orgId,
            entryNumber,
            postingDate,
            documentDate,
            sourceModule: command.sourceModule,
            sourceEntityType: command.sourceEntityType,
            sourceEntityId: command.sourceEntityId,
            sourceReference: sourceRef,
            referenceNumber: command.referenceNumber,
            status: JournalEntryStatus.POSTED,
            description: command.description,
            totalDebit,
            totalCredit,
            createdById: actorId,
            postedById: actorId,
            postedAt: new Date(),
            lines: {
              create: sanitizedLines.map((l) => ({
                accountId: l.accountId,
                branchId: l.branchId,
                debitAmount: l.debitAmount,
                creditAmount: l.creditAmount,
                description: l.description,
                metadata: l.metadata,
              })),
            },
          },
          include: { lines: true },
        });

        // Record AuditLog
        await writeFinanceAuditLog(tx, {
          entity: 'journal_entry',
          entityId: journal.id,
          action: AuditAction.CREATE,
          performedBy: actorId,
          after: {
            entryNumber: journal.entryNumber,
            postingDate: journal.postingDate,
            totalDebit: journal.totalDebit,
            totalCredit: journal.totalCredit,
            sourceModule: journal.sourceModule,
            sourceEntityId: journal.sourceEntityId,
          },
        });

        // Write Transactional Outbox
        await writeFinanceOutboxEvent(tx, {
          type: 'finance.journal.posted',
          payload: {
            journalEntryId: journal.id,
            entryNumber: journal.entryNumber,
            postingDate: journal.postingDate,
            organizationId: journal.organizationId,
            sourceModule: journal.sourceModule,
            sourceEntityType: journal.sourceEntityType,
            sourceEntityId: journal.sourceEntityId,
            totalDebit: journal.totalDebit,
            totalCredit: journal.totalCredit,
            lineCount: journal.lines.length,
          },
        });

        return { journal, isReplay: false };
      },
      { maxWait: 20000, timeout: 30000 },
    );
    } catch (err: any) {
      // Catch unique constraint collision on concurrent duplicate posting
      if (err?.code === 'P2002' || err?.message?.includes('org_source_event_unique') || err?.message?.includes('Unique constraint failed')) {
        let found = await this.prisma.journalEntry.findUnique({
          where: {
            org_source_event_unique: {
              organizationId: orgId,
              sourceModule: command.sourceModule,
              sourceEntityType: command.sourceEntityType,
              sourceEntityId: command.sourceEntityId,
              sourceReference: sourceRef,
            },
          },
          include: { lines: true },
        });

        if (!found) {
          // Wait briefly for winning transaction to finish committing
          await new Promise((resolve) => setTimeout(resolve, 50));
          found = await this.prisma.journalEntry.findUnique({
            where: {
              org_source_event_unique: {
                organizationId: orgId,
                sourceModule: command.sourceModule,
                sourceEntityType: command.sourceEntityType,
                sourceEntityId: command.sourceEntityId,
                sourceReference: sourceRef,
              },
            },
            include: { lines: true },
          });
        }

        if (found) {
          return { journal: found, isReplay: true };
        }
      }
      throw err;
    }
  }
}
