import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateFiscalYearDto } from '../dto/create-fiscal-year.dto';
import { CreateFiscalPeriodDto } from '../dto/create-fiscal-period.dto';
import { ReopenPeriodDto } from '../dto/reopen-period.dto';
import { FiscalYear, FiscalPeriod, FiscalPeriodStatus, AuditAction } from '@prisma/client';
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

@Injectable()
export class FiscalCalendarService {
  private readonly prisma = prisma;


  /**
   * Create a Fiscal Year with date range and overlap validation.
   */
  async createFiscalYear(dto: CreateFiscalYearDto, user: RequestingUser): Promise<FiscalYear> {
    const orgId = user.organizationId;
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (start >= end) {
      throw new BadRequestException('Fiscal Year start date must be strictly before end date');
    }

    // 1. Check duplicate fiscal year name within organization
    const existingName = await this.prisma.fiscalYear.findUnique({
      where: {
        organizationId_name: {
          organizationId: orgId,
          name: dto.name,
        },
      },
    });
    if (existingName) {
      throw new ConflictException(`Fiscal Year with name '${dto.name}' already exists in this organization`);
    }

    // 2. Check overlapping date ranges for the same organization
    const overlapping = await this.prisma.fiscalYear.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    });
    if (overlapping) {
      throw new ConflictException(
        `Fiscal Year date range [${dto.startDate} to ${dto.endDate}] overlaps with existing Fiscal Year '${overlapping.name}'`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const fy = await tx.fiscalYear.create({
        data: {
          organizationId: orgId,
          name: dto.name,
          startDate: start,
          endDate: end,
          isClosed: false,
        },
      });

      await writeFinanceAuditLog(tx, {
        entity: 'fiscal_year',
        entityId: fy.id,
        action: AuditAction.CREATE,
        performedBy: user.id,
        after: fy,
      });

      return fy;
    });
  }

  /**
   * List Fiscal Years for organization.
   */
  async getFiscalYears(user: RequestingUser): Promise<FiscalYear[]> {
    return this.prisma.fiscalYear.findMany({
      where: { organizationId: user.organizationId },
      include: { periods: { orderBy: { periodNumber: 'asc' } } },
      orderBy: [{ startDate: 'desc' }],
    });
  }

  /**
   * Create a Fiscal Period inside a Fiscal Year.
   */
  async createFiscalPeriod(dto: CreateFiscalPeriodDto, user: RequestingUser): Promise<FiscalPeriod> {
    const orgId = user.organizationId;
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (start >= end) {
      throw new BadRequestException('Period start date must be strictly before end date');
    }

    // 1. Validate Fiscal Year belongs to organization
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: dto.fiscalYearId },
    });
    if (!fiscalYear || fiscalYear.organizationId !== orgId) {
      throw new NotFoundException('Fiscal Year not found in this organization');
    }
    if (fiscalYear.isClosed) {
      throw new BadRequestException('Cannot add periods to a closed Fiscal Year');
    }

    // 2. Validate period dates are strictly within Fiscal Year
    if (start < fiscalYear.startDate || end > fiscalYear.endDate) {
      throw new BadRequestException(
        `Period dates [${dto.startDate} to ${dto.endDate}] must be entirely within Fiscal Year bounds [${fiscalYear.startDate.toISOString().split('T')[0]} to ${fiscalYear.endDate.toISOString().split('T')[0]}]`,
      );
    }

    // 3. Check duplicate period number in this FY
    const existingNumber = await this.prisma.fiscalPeriod.findUnique({
      where: {
        fiscalYearId_periodNumber: {
          fiscalYearId: dto.fiscalYearId,
          periodNumber: dto.periodNumber,
        },
      },
    });
    if (existingNumber) {
      throw new ConflictException(`Period number ${dto.periodNumber} already exists in this Fiscal Year`);
    }

    // 4. Check overlapping periods within the same FY
    const overlapping = await this.prisma.fiscalPeriod.findFirst({
      where: {
        fiscalYearId: dto.fiscalYearId,
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    });
    if (overlapping) {
      throw new ConflictException(
        `Period date range overlaps with existing Period ${overlapping.periodNumber} ('${overlapping.name}')`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.create({
        data: {
          fiscalYearId: dto.fiscalYearId,
          periodNumber: dto.periodNumber,
          name: dto.name,
          startDate: start,
          endDate: end,
          status: FiscalPeriodStatus.OPEN,
        },
      });

      await writeFinanceAuditLog(tx, {
        entity: 'fiscal_period',
        entityId: period.id,
        action: AuditAction.CREATE,
        performedBy: user.id,
        after: period,
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.period.opened',
        payload: {
          periodId: period.id,
          fiscalYearId: period.fiscalYearId,
          periodNumber: period.periodNumber,
          name: period.name,
        },
      });

      return period;
    });
  }

  /**
   * List Fiscal Periods for a given Fiscal Year.
   */
  async getFiscalPeriods(fiscalYearId: string, user: RequestingUser): Promise<FiscalPeriod[]> {
    const fy = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId },
    });
    if (!fy || fy.organizationId !== user.organizationId) {
      throw new NotFoundException('Fiscal Year not found in this organization');
    }

    return this.prisma.fiscalPeriod.findMany({
      where: { fiscalYearId },
      orderBy: [{ periodNumber: 'asc' }],
    });
  }

  /**
   * Close a Fiscal Period (CAS: OPEN -> CLOSED).
   */
  async closePeriod(id: string, user: RequestingUser): Promise<FiscalPeriod> {
    const period = await this.prisma.fiscalPeriod.findUnique({
      where: { id },
      include: { fiscalYear: true },
    });

    if (!period || period.fiscalYear.organizationId !== user.organizationId) {
      throw new NotFoundException('Fiscal Period not found in this organization');
    }

    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new BadRequestException(`Cannot close period in '${period.status}' status (must be OPEN)`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // CAS update
      const updated = await tx.fiscalPeriod.update({
        where: { id, status: FiscalPeriodStatus.OPEN },
        data: {
          status: FiscalPeriodStatus.CLOSED,
          closedAt: new Date(),
          closedBy: user.id,
        },
      });

      await writeFinanceAuditLog(tx, {
        entity: 'fiscal_period',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        performedBy: user.id,
        before: { status: FiscalPeriodStatus.OPEN },
        after: { status: FiscalPeriodStatus.CLOSED, closedBy: user.id },
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.period.closed',
        payload: {
          periodId: updated.id,
          fiscalYearId: updated.fiscalYearId,
          periodNumber: updated.periodNumber,
          closedBy: user.id,
        },
      });

      return updated;
    });
  }

  /**
   * Reopen a closed Fiscal Period (CAS: CLOSED -> OPEN).
   * Requires elevated permission.
   */
  async reopenPeriod(id: string, dto: ReopenPeriodDto, user: RequestingUser): Promise<FiscalPeriod> {
    const period = await this.prisma.fiscalPeriod.findUnique({
      where: { id },
      include: { fiscalYear: true },
    });

    if (!period || period.fiscalYear.organizationId !== user.organizationId) {
      throw new NotFoundException('Fiscal Period not found in this organization');
    }

    if (period.status === FiscalPeriodStatus.LOCKED) {
      throw new ForbiddenException('Cannot reopen a LOCKED fiscal period');
    }

    if (period.status !== FiscalPeriodStatus.CLOSED) {
      throw new BadRequestException(`Cannot reopen period in '${period.status}' status (must be CLOSED)`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.fiscalPeriod.update({
        where: { id, status: FiscalPeriodStatus.CLOSED },
        data: {
          status: FiscalPeriodStatus.OPEN,
          closedAt: null,
          closedBy: null,
        },
      });

      await writeFinanceAuditLog(tx, {
        entity: 'fiscal_period',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        performedBy: user.id,
        before: { status: FiscalPeriodStatus.CLOSED },
        after: { status: FiscalPeriodStatus.OPEN, reason: dto.reason },
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.period.reopened',
        payload: {
          periodId: updated.id,
          fiscalYearId: updated.fiscalYearId,
          periodNumber: updated.periodNumber,
          reopenedBy: user.id,
          reason: dto.reason,
        },
      });

      return updated;
    });
  }

  /**
   * Lock a closed Fiscal Period permanently (CAS: CLOSED -> LOCKED).
   */
  async lockPeriod(id: string, user: RequestingUser): Promise<FiscalPeriod> {
    const period = await this.prisma.fiscalPeriod.findUnique({
      where: { id },
      include: { fiscalYear: true },
    });

    if (!period || period.fiscalYear.organizationId !== user.organizationId) {
      throw new NotFoundException('Fiscal Period not found in this organization');
    }

    if (period.status !== FiscalPeriodStatus.CLOSED) {
      throw new BadRequestException(`Cannot lock period in '${period.status}' status (must be CLOSED first)`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.fiscalPeriod.update({
        where: { id, status: FiscalPeriodStatus.CLOSED },
        data: {
          status: FiscalPeriodStatus.LOCKED,
        },
      });

      await writeFinanceAuditLog(tx, {
        entity: 'fiscal_period',
        entityId: updated.id,
        action: AuditAction.UPDATE,
        performedBy: user.id,
        before: { status: FiscalPeriodStatus.CLOSED },
        after: { status: FiscalPeriodStatus.LOCKED },
      });

      await writeFinanceOutboxEvent(tx, {
        type: 'finance.period.locked',
        payload: {
          periodId: updated.id,
          fiscalYearId: updated.fiscalYearId,
          periodNumber: updated.periodNumber,
          lockedBy: user.id,
        },
      });

      return updated;
    });
  }

  /**
   * Helper to resolve active, open Fiscal Period for a given posting date.
   */
  async resolveFiscalPeriodForDate(organizationId: string, postingDate: Date): Promise<FiscalPeriod> {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: {
        fiscalYear: { organizationId },
        startDate: { lte: postingDate },
        endDate: { gte: postingDate },
      },
    });

    if (!period) {
      throw new BadRequestException(
        `No Fiscal Period defined for posting date '${postingDate.toISOString().split('T')[0]}'`,
      );
    }

    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new BadRequestException(
        `Fiscal Period ${period.periodNumber} ('${period.name}') is ${period.status}. Postings rejected.`,
      );
    }

    return period;
  }
}
