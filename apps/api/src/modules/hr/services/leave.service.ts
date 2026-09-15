import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { LeaveRequestStatus, AuditAction } from '@prisma/client';
import {
  CreateLeaveTypeDto,
  CreateLeavePolicyDto,
  AllocateLeaveDto,
  CreateLeaveRequestDto,
  ApproveLeaveRequestDto,
  RejectLeaveRequestDto,
  CancelLeaveRequestDto,
} from '../dto/leave.dto';
import { writeHrAuditLog, writeHrOutboxEvent } from '../utils/hr-audit-outbox.helper';
import type { RequestingUser } from './employee.service';

@Injectable()
export class LeaveTypeService {
  async findAll(organizationId: string) {
    return prisma.leaveType.findMany({
      where: { organizationId, isActive: true },
      include: { policies: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateLeaveTypeDto, organizationId: string) {
    try {
      return await prisma.leaveType.create({
        data: {
          organizationId,
          code: dto.code,
          name: dto.name,
          annualDays: dto.annualDays,
          isCarryForward: dto.isCarryForward ?? false,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(`Leave type with code ${dto.code} already exists`);
      }
      throw error;
    }
  }
}

@Injectable()
export class LeavePolicyService {
  async findByOrg(organizationId: string) {
    return prisma.leavePolicy.findMany({
      where: { organizationId },
      include: { leaveType: true },
    });
  }

  async create(dto: CreateLeavePolicyDto, organizationId: string) {
    const leaveType = await prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, organizationId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found in organization');

    return prisma.leavePolicy.create({
      data: {
        organizationId,
        leaveTypeId: dto.leaveTypeId,
        maxContinuousDays: dto.maxContinuousDays ?? 14,
        noticeDaysRequired: dto.noticeDaysRequired ?? 0,
        encashable: dto.encashable ?? false,
      },
    });
  }
}

@Injectable()
export class LeaveAllocationService {
  async allocate(dto: AllocateLeaveDto, organizationId: string) {
    const leaveType = await prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, organizationId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const employee = await prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    await prisma.$transaction(async (tx) => {
      await tx.leaveTransaction.create({
        data: {
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          type: 'ACCRUAL',
          days: dto.days,
          notes: `Annual allocation for year ${dto.year}`,
        },
      });

      await tx.employeeLeaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: dto.employeeId,
            leaveTypeId: dto.leaveTypeId,
            year: dto.year,
          },
        },
        update: {
          allocated: { increment: dto.days },
          balance: { increment: dto.days },
        },
        create: {
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: dto.year,
          allocated: dto.days,
          used: 0,
          balance: dto.days,
        },
      });
    });

    return { message: `Successfully allocated ${dto.days} days of ${leaveType.name} for year ${dto.year}` };
  }

  async getBalance(employeeId: string) {
    const transactions = await prisma.leaveTransaction.findMany({
      where: { employeeId },
      include: { leaveType: true },
    });

    const balanceMap: Record<string, { leaveTypeId: string; leaveTypeName: string; code: string; balance: number; accrued: number; used: number }> = {};

    for (const tx of transactions) {
      if (!balanceMap[tx.leaveTypeId]) {
        balanceMap[tx.leaveTypeId] = {
          leaveTypeId: tx.leaveTypeId,
          leaveTypeName: tx.leaveType.name,
          code: tx.leaveType.code,
          balance: 0,
          accrued: 0,
          used: 0,
        };
      }
      balanceMap[tx.leaveTypeId].balance += tx.days;
      if (tx.days > 0) {
        balanceMap[tx.leaveTypeId].accrued += tx.days;
      } else {
        balanceMap[tx.leaveTypeId].used += Math.abs(tx.days);
      }
    }

    return Object.values(balanceMap);
  }

  async recalculateProjection(employeeId: string, leaveTypeId: string, year: number) {
    const agg = await prisma.leaveTransaction.aggregate({
      where: { employeeId, leaveTypeId },
      _sum: { days: true },
    });
    const netBalance = agg._sum.days ?? 0;

    return prisma.employeeLeaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      update: { balance: netBalance },
      create: { employeeId, leaveTypeId, year, allocated: netBalance, used: 0, balance: netBalance },
    });
  }
}

@Injectable()
export class LeaveService {
  private async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub }, select: { organizationId: true } });
    if (!dbUser?.organizationId) throw new ForbiddenException('No organization assigned');
    return dbUser.organizationId;
  }

  // ─── LEAVE REQUEST WORKFLOW ─────────────────────────────────────────────────

  async createRequest(dto: CreateLeaveRequestDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    const employee = await prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const leaveType = await prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, organizationId, isActive: true },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end < start) {
      throw new BadRequestException('End date cannot be prior to start date');
    }

    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

    return prisma.leaveRequest.create({
      data: {
        organizationId,
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        reason: dto.reason,
        status: LeaveRequestStatus.DRAFT,
      },
      include: { leaveType: true, employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
    });
  }

  async submitRequest(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    const req = await prisma.leaveRequest.findFirst({
      where: { id, organizationId },
      include: { leaveType: true },
    });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== LeaveRequestStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit leave request in status: ${req.status}`);
    }

    const agg = await prisma.leaveTransaction.aggregate({
      where: { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId },
      _sum: { days: true },
    });
    const currentBalance = agg._sum.days ?? 0;
    if (currentBalance < req.totalDays) {
      throw new BadRequestException(
        `Insufficient leave balance. Available: ${currentBalance}, Requested: ${req.totalDays}`,
      );
    }

    return prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveRequestStatus.SUBMITTED },
    });
  }

  async approveRequest(id: string, dto: ApproveLeaveRequestDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Insufficient privileges to approve leave requests');
    }

    if (dto?.idempotencyKey) {
      const existingKey = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingKey?.status === 'COMPLETED') {
        return prisma.leaveRequest.findUnique({ where: { id } });
      }
      await prisma.idempotencyRecord.upsert({
        where: { idempotencyKey: dto.idempotencyKey },
        update: {},
        create: {
          idempotencyKey: dto.idempotencyKey,
          requestPath: `/hr/leave-requests/${id}/approve`,
          status: 'PROCESSING',
        },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const leaveReq = await tx.leaveRequest.findFirst({
        where: { id, organizationId },
        include: {
          leaveType: {
            include: { policies: { where: { organizationId } } },
          },
        },
      });

      if (!leaveReq) throw new NotFoundException('Leave request not found');
      if (leaveReq.status !== LeaveRequestStatus.SUBMITTED) {
        throw new ConflictException(`Cannot approve leave request in state: ${leaveReq.status}`);
      }

      // 1. Serialize concurrent approvals for this employee + leaveType by locking balance row
      await tx.$executeRawUnsafe(
        `SELECT * FROM "public"."employee_leave_balance" WHERE "employeeId" = $1::uuid AND "leaveTypeId" = $2::uuid FOR UPDATE`,
        leaveReq.employeeId,
        leaveReq.leaveTypeId,
      ).catch(() => null);

      // 2. Atomic CAS on LeaveRequest row to ensure exactly 1 approval proceeds for this request
      const updateResult = await tx.leaveRequest.updateMany({
        where: { id, status: LeaveRequestStatus.SUBMITTED },
        data: {
          status: LeaveRequestStatus.APPROVED,
          approvedBy: user.sub,
          approvedAt: new Date(),
        },
      });
      if (updateResult.count === 0) {
        throw new ConflictException(`Leave request has already been approved or processed concurrently`);
      }

      // 3. Validate employee active status
      const employee = await tx.employee.findFirst({
        where: { id: leaveReq.employeeId, organizationId, status: 'ACTIVE' },
      });
      if (!employee) throw new BadRequestException('Employee is not active');

      // 4. Policy validation
      const policy = leaveReq.leaveType.policies?.[0];
      if (policy && leaveReq.totalDays > policy.maxContinuousDays) {
        throw new BadRequestException(
          `Leave request exceeds maximum continuous allowable days (${policy.maxContinuousDays})`,
        );
      }

      // 5. Overlap detection
      const overlap = await tx.leaveRequest.findFirst({
        where: {
          employeeId: leaveReq.employeeId,
          id: { not: id },
          status: LeaveRequestStatus.APPROVED,
          startDate: { lte: leaveReq.endDate },
          endDate: { gte: leaveReq.startDate },
        },
      });
      if (overlap) {
        throw new ConflictException('Employee already has an approved leave request for overlapping dates');
      }

      // 6. Authoritative ledger balance check from live SUM(LeaveTransaction.days)
      const balanceAgg = await tx.leaveTransaction.aggregate({
        where: { employeeId: leaveReq.employeeId, leaveTypeId: leaveReq.leaveTypeId },
        _sum: { days: true },
      });
      const availableBalance = balanceAgg._sum.days ?? 0;

      if (availableBalance < leaveReq.totalDays) {
        throw new BadRequestException(
          `Insufficient leave balance. Available: ${availableBalance}, Required: ${leaveReq.totalDays}`,
        );
      }

      // 7. Insert immutable ledger deduction
      await tx.leaveTransaction.create({
        data: {
          employeeId: leaveReq.employeeId,
          leaveTypeId: leaveReq.leaveTypeId,
          type: 'DEDUCTION',
          days: -leaveReq.totalDays,
          notes: `Approved leave request ${id}`,
        },
      });

      // 8. Update cached read-model projection
      const year = leaveReq.startDate.getFullYear();
      await tx.employeeLeaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: leaveReq.employeeId,
            leaveTypeId: leaveReq.leaveTypeId,
            year,
          },
        },
        update: {
          used: { increment: leaveReq.totalDays },
          balance: { decrement: leaveReq.totalDays },
        },
        create: {
          employeeId: leaveReq.employeeId,
          leaveTypeId: leaveReq.leaveTypeId,
          year,
          allocated: availableBalance,
          used: leaveReq.totalDays,
          balance: availableBalance - leaveReq.totalDays,
        },
      });

      // 9. Outbox event
      await writeHrOutboxEvent(tx, {
        type: 'hr.leave.approved',
        payload: {
          leaveRequestId: id,
          employeeId: leaveReq.employeeId,
          days: leaveReq.totalDays,
        },
      });

      // 10. Audit log
      await writeHrAuditLog(tx, {
        entity: 'leave_request',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        branchId: employee.assignedBranchId,
        after: {
          employeeId: leaveReq.employeeId,
          days: leaveReq.totalDays,
          leaveType: leaveReq.leaveType.name,
          status: 'APPROVED',
        },
      });

      if (dto?.idempotencyKey) {
        await tx.idempotencyRecord.update({
          where: { idempotencyKey: dto.idempotencyKey },
          data: { status: 'COMPLETED', responseBody: { leaveRequestId: id } },
        }).catch(() => null);
      }

      return tx.leaveRequest.findUnique({ where: { id } });
    });

    return result;
  }

  async rejectRequest(id: string, dto: RejectLeaveRequestDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    if (user.scope === 'ASSIGNED') throw new ForbiddenException('Insufficient privileges');

    const req = await prisma.leaveRequest.findFirst({ where: { id, organizationId } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== LeaveRequestStatus.SUBMITTED && req.status !== LeaveRequestStatus.DRAFT) {
      throw new BadRequestException(`Cannot reject leave request in status: ${req.status}`);
    }

    return prisma.$transaction(async (tx) => {
      const updateResult = await tx.leaveRequest.updateMany({
        where: { id, status: { in: [LeaveRequestStatus.SUBMITTED, LeaveRequestStatus.DRAFT] } },
        data: {
          status: LeaveRequestStatus.REJECTED,
          approvedBy: user.sub,
          approvedAt: new Date(),
        },
      });
      if (updateResult.count === 0) {
        throw new ConflictException('Leave request has already been processed concurrently');
      }

      const rejected = await tx.leaveRequest.findUnique({ where: { id } });

      await writeHrAuditLog(tx, {
        entity: 'leave_request',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        after: { status: 'REJECTED', reason: dto.reason },
      });

      return rejected;
    });
  }

  async cancelRequest(id: string, dto: CancelLeaveRequestDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    return prisma.$transaction(async (tx) => {
      const req = await tx.leaveRequest.findFirst({ where: { id, organizationId } });
      if (!req) throw new NotFoundException('Leave request not found');

      if (req.status === LeaveRequestStatus.DRAFT || req.status === LeaveRequestStatus.SUBMITTED) {
        return tx.leaveRequest.update({
          where: { id },
          data: { status: LeaveRequestStatus.CANCELLED },
        });
      }

      if (req.status === LeaveRequestStatus.APPROVED) {
        const updateResult = await tx.leaveRequest.updateMany({
          where: { id, status: LeaveRequestStatus.APPROVED },
          data: { status: LeaveRequestStatus.CANCELLED },
        });
        if (updateResult.count === 0) {
          throw new ConflictException('Leave request is no longer in APPROVED status');
        }

        await tx.leaveTransaction.create({
          data: {
            employeeId: req.employeeId,
            leaveTypeId: req.leaveTypeId,
            type: 'ADJUSTMENT',
            days: req.totalDays,
            notes: `Cancellation reversal for leave request ${id}`,
          },
        });

        const year = req.startDate.getFullYear();
        await tx.employeeLeaveBalance.updateMany({
          where: {
            employeeId: req.employeeId,
            leaveTypeId: req.leaveTypeId,
            year,
          },
          data: {
            used: { decrement: req.totalDays },
            balance: { increment: req.totalDays },
          },
        });

        const cancelled = await tx.leaveRequest.findUnique({ where: { id } });

        await writeHrAuditLog(tx, {
          entity: 'leave_request',
          entityId: id,
          action: AuditAction.UPDATE,
          performedBy: user.sub,
          after: { status: 'CANCELLED', reversedDays: req.totalDays },
        });

        return cancelled;
      }

      throw new BadRequestException(`Cannot cancel leave request in status: ${req.status}`);
    });
  }

  async findAll(
    user: RequestingUser,
    params: { status?: LeaveRequestStatus; employeeId?: string },
  ) {
    const organizationId = await this.resolveOrgId(user);
    const where: any = {
      organizationId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
    };

    if (user.scope === 'BRANCH' && user.branchId) {
      const branchEmployees = await prisma.employee.findMany({
        where: { organizationId, assignedBranchId: user.branchId },
        select: { id: true },
      });
      where.employeeId = { in: branchEmployees.map((e) => e.id) };
    }

    return prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: true,
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
