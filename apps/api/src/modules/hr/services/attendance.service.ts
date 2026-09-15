import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { AttendanceStatus, AuditAction } from '@prisma/client';
import {
  CheckInDto,
  CheckOutDto,
  ScheduleAttendanceDto,
  AttendanceCorrectionRequestDto,
  ApproveCorrectionDto,
  RejectCorrectionDto,
} from '../dto/attendance.dto';
import { writeHrAuditLog, writeHrOutboxEvent } from '../utils/hr-audit-outbox.helper';
import type { RequestingUser } from './employee.service';

@Injectable()
export class AttendanceService {
  private async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub }, select: { organizationId: true } });
    if (!dbUser?.organizationId) throw new ForbiddenException('No organization assigned');
    return dbUser.organizationId;
  }

  private async assertActiveEmployee(employeeId: string, organizationId: string) {
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, status: 'ACTIVE', deletedAt: null },
    });
    if (!emp) throw new BadRequestException('Employee is not active or does not exist');
    return emp;
  }

  // ─── SCHEDULE ATTENDANCE ───────────────────────────────────────────────────

  async scheduleAttendance(dto: ScheduleAttendanceDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    await this.assertActiveEmployee(dto.employeeId, organizationId);

    const workDate = new Date(dto.workDate);
    workDate.setHours(0, 0, 0, 0);

    try {
      return await prisma.attendanceLog.create({
        data: {
          organizationId,
          branchId: dto.branchId,
          employeeId: dto.employeeId,
          workDate,
          status: AttendanceStatus.SCHEDULED,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Attendance record for this employee and date already exists');
      }
      throw error;
    }
  }

  // ─── CHECK-IN ───────────────────────────────────────────────────────────────

  async checkIn(dto: CheckInDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (dto.idempotencyKey) {
      const existingKey = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingKey?.status === 'COMPLETED') {
        const log = await prisma.attendanceLog.findFirst({
          where: { employeeId: dto.employeeId, workDate: this._today() },
        });
        return log;
      }
      await prisma.idempotencyRecord.upsert({
        where: { idempotencyKey: dto.idempotencyKey },
        update: {},
        create: {
          idempotencyKey: dto.idempotencyKey,
          requestPath: '/hr/attendance/check-in',
          status: 'PROCESSING',
        },
      });
    }

    await this.assertActiveEmployee(dto.employeeId, organizationId);

    if (user.scope === 'BRANCH' && user.branchId && dto.branchId !== user.branchId) {
      throw new ForbiddenException('Cannot log attendance for a different branch');
    }

    const workDate = this._today();
    const nowTs = new Date();

    try {
      const log = await prisma.$transaction(async (tx) => {
        const existingScheduled = await tx.attendanceLog.findFirst({
          where: { employeeId: dto.employeeId, workDate },
        });

        let attendanceRecord;
        if (existingScheduled) {
          if (existingScheduled.status !== AttendanceStatus.SCHEDULED) {
            throw new ConflictException(`Employee already has attendance record in status: ${existingScheduled.status}`);
          }
          attendanceRecord = await tx.attendanceLog.update({
            where: { id: existingScheduled.id },
            data: {
              checkInTime: nowTs,
              status: AttendanceStatus.CHECKED_IN,
              source: dto.source ?? 'POS',
            },
          });
        } else {
          attendanceRecord = await tx.attendanceLog.create({
            data: {
              organizationId,
              branchId: dto.branchId,
              employeeId: dto.employeeId,
              workDate,
              checkInTime: nowTs,
              status: AttendanceStatus.CHECKED_IN,
              source: dto.source ?? 'POS',
            },
          });
        }

        await writeHrAuditLog(tx, {
          entity: 'attendance_log',
          entityId: attendanceRecord.id,
          action: AuditAction.CREATE,
          performedBy: user.sub,
          branchId: dto.branchId,
          after: { employeeId: dto.employeeId, checkInTime: nowTs },
        });

        if (dto.idempotencyKey) {
          await tx.idempotencyRecord.update({
            where: { idempotencyKey: dto.idempotencyKey },
            data: { status: 'COMPLETED', responseBody: { attendanceLogId: attendanceRecord.id } },
          }).catch(() => null);
        }

        return attendanceRecord;
      });

      return log;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Employee has already checked in today');
      }
      throw error;
    }
  }

  // ─── CHECK-OUT ──────────────────────────────────────────────────────────────

  async checkOut(attendanceId: string, dto: CheckOutDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (dto?.idempotencyKey) {
      const existingKey = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingKey?.status === 'COMPLETED') {
        return prisma.attendanceLog.findUnique({ where: { id: attendanceId } });
      }
      await prisma.idempotencyRecord.upsert({
        where: { idempotencyKey: dto.idempotencyKey },
        update: {},
        create: {
          idempotencyKey: dto.idempotencyKey,
          requestPath: `/hr/attendance/${attendanceId}/check-out`,
          status: 'PROCESSING',
        },
      });
    }

    const log = await prisma.attendanceLog.findFirst({
      where: { id: attendanceId, organizationId },
      include: {
        employee: {
          include: {
            shifts: {
              include: { shiftMaster: true },
              where: { effectiveTo: null },
              orderBy: { effectiveFrom: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!log) throw new NotFoundException('Attendance record not found');
    if (log.status !== AttendanceStatus.CHECKED_IN) {
      throw new BadRequestException(`Cannot check out: current status is ${log.status}`);
    }

    const nowTs = new Date();
    const { hoursWorked, overtimeHours } = this._computeHours(log, nowTs);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedCount = await tx.attendanceLog.updateMany({
        where: { id: attendanceId, status: AttendanceStatus.CHECKED_IN },
        data: {
          checkOutTime: nowTs,
          hoursWorked,
          overtimeHours,
          status: AttendanceStatus.CHECKED_OUT,
        },
      });
      if (updatedCount.count === 0) {
        throw new ConflictException('Attendance record is no longer in CHECKED_IN state');
      }

      const result = await tx.attendanceLog.findUnique({ where: { id: attendanceId } });

      await writeHrAuditLog(tx, {
        entity: 'attendance_log',
        entityId: attendanceId,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        branchId: log.branchId,
        after: { checkOutTime: nowTs, hoursWorked, overtimeHours },
      });

      if (dto?.idempotencyKey) {
        await tx.idempotencyRecord.update({
          where: { idempotencyKey: dto.idempotencyKey },
          data: { status: 'COMPLETED', responseBody: { attendanceLogId: attendanceId } },
        }).catch(() => null);
      }

      return result;
    });

    return updated;
  }

  // ─── FINALIZE ───────────────────────────────────────────────────────────────

  async finalizeAttendance(attendanceId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    const log = await prisma.attendanceLog.findFirst({ where: { id: attendanceId, organizationId } });
    if (!log) throw new NotFoundException('Attendance record not found');
    if (log.status !== AttendanceStatus.CHECKED_OUT && log.status !== AttendanceStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot finalize attendance in state: ${log.status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.attendanceLog.update({
        where: { id: attendanceId },
        data: { status: AttendanceStatus.FINALIZED },
      });

      await writeHrOutboxEvent(tx, {
        type: 'hr.attendance.recorded',
        payload: {
          attendanceLogId: attendanceId,
          employeeId: log.employeeId,
          workDate: log.workDate,
          hoursWorked: log.hoursWorked,
          overtimeHours: log.overtimeHours,
        },
      });

      await writeHrAuditLog(tx, {
        entity: 'attendance_log',
        entityId: attendanceId,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        branchId: log.branchId,
        after: { status: AttendanceStatus.FINALIZED },
      });

      return result;
    });

    return updated;
  }

  // ─── QUERY ──────────────────────────────────────────────────────────────────

  async findAll(user: RequestingUser, params: { date?: string; branchId?: string; employeeId?: string }) {
    const organizationId = await this.resolveOrgId(user);
    const targetDate = params.date ? new Date(params.date) : this._today();
    targetDate.setHours(0, 0, 0, 0);

    const where: any = {
      organizationId,
      workDate: targetDate,
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
    };

    if (user.scope === 'BRANCH' && user.branchId) {
      where.branchId = user.branchId;
    } else if (params.branchId) {
      where.branchId = params.branchId;
    }

    return prisma.attendanceLog.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
      orderBy: { checkInTime: 'desc' },
    });
  }

  // ─── CORRECTION WORKFLOW ─────────────────────────────────────────────────────

  async requestCorrection(dto: AttendanceCorrectionRequestDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    const employee = await prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const workDate = new Date(dto.workDate);
    workDate.setHours(0, 0, 0, 0);

    return prisma.attendanceCorrectionRequest.create({
      data: {
        organizationId,
        employeeId: dto.employeeId,
        workDate,
        requestedIn: dto.requestedIn ? new Date(dto.requestedIn) : null,
        requestedOut: dto.requestedOut ? new Date(dto.requestedOut) : null,
        reason: dto.reason,
        status: 'PENDING',
      },
    });
  }

  async approveCorrection(correctionId: string, dto: ApproveCorrectionDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Insufficient privileges to approve attendance corrections');
    }

    if (dto?.idempotencyKey) {
      const existingKey = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingKey?.status === 'COMPLETED') {
        return prisma.attendanceCorrectionRequest.findUnique({ where: { id: correctionId } });
      }
      await prisma.idempotencyRecord.upsert({
        where: { idempotencyKey: dto.idempotencyKey },
        update: {},
        create: {
          idempotencyKey: dto.idempotencyKey,
          requestPath: `/hr/attendance/corrections/${correctionId}/approve`,
          status: 'PROCESSING',
        },
      });
    }

    const correction = await prisma.attendanceCorrectionRequest.findFirst({
      where: { id: correctionId, organizationId, status: 'PENDING' },
    });
    if (!correction) throw new NotFoundException('Correction request not found or already processed');

    const result = await prisma.$transaction(async (tx) => {
      // Atomic CAS: exactly 1 update will succeed in concurrent execution
      const updateResult = await tx.attendanceCorrectionRequest.updateMany({
        where: { id: correctionId, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          approvedBy: user.sub,
          approvedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Correction request has already been processed concurrently');
      }

      const updatedCorrection = await tx.attendanceCorrectionRequest.findUnique({
        where: { id: correctionId },
      });

      const log = await tx.attendanceLog.findFirst({
        where: { employeeId: correction.employeeId, workDate: correction.workDate },
      });

      let hoursWorked = 0;
      if (correction.requestedIn && correction.requestedOut) {
        const diffMs = new Date(correction.requestedOut).getTime() - new Date(correction.requestedIn).getTime();
        hoursWorked = Math.round((Math.max(0, diffMs) / 3600000) * 100) / 100;
      }

      if (log) {
        await tx.attendanceLog.update({
          where: { id: log.id },
          data: {
            checkInTime: correction.requestedIn ?? log.checkInTime,
            checkOutTime: correction.requestedOut ?? log.checkOutTime,
            hoursWorked: hoursWorked > 0 ? hoursWorked : log.hoursWorked,
            status: AttendanceStatus.CHECKED_OUT,
          },
        });
      }

      await writeHrOutboxEvent(tx, {
        type: 'hr.attendance.corrected',
        payload: { correctionRequestId: correctionId, employeeId: correction.employeeId },
      });

      await writeHrAuditLog(tx, {
        entity: 'attendance_correction_request',
        entityId: correctionId,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        after: {
          employeeId: correction.employeeId,
          workDate: correction.workDate,
          reason: correction.reason,
          status: 'APPROVED',
        },
      });

      if (dto?.idempotencyKey) {
        await tx.idempotencyRecord.update({
          where: { idempotencyKey: dto.idempotencyKey },
          data: { status: 'COMPLETED', responseBody: { correctionId } },
        }).catch(() => null);
      }

      return updatedCorrection;
    });

    return result;
  }

  async rejectCorrection(correctionId: string, dto: RejectCorrectionDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    if (user.scope === 'ASSIGNED') throw new ForbiddenException('Insufficient privileges');

    const correction = await prisma.attendanceCorrectionRequest.findFirst({
      where: { id: correctionId, organizationId, status: 'PENDING' },
    });
    if (!correction) throw new NotFoundException('Correction request not found or already processed');

    return prisma.$transaction(async (tx) => {
      const updateResult = await tx.attendanceCorrectionRequest.updateMany({
        where: { id: correctionId, status: 'PENDING' },
        data: { status: 'REJECTED', approvedBy: user.sub, approvedAt: new Date() },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Correction request has already been processed');
      }

      const updated = await tx.attendanceCorrectionRequest.findUnique({ where: { id: correctionId } });

      await writeHrAuditLog(tx, {
        entity: 'attendance_correction_request',
        entityId: correctionId,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        after: { status: 'REJECTED', reason: dto.reason },
      });

      return updated;
    });
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────────

  private _today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private _computeHours(log: any, checkOutTime: Date): { hoursWorked: number; overtimeHours: number } {
    if (!log.checkInTime) return { hoursWorked: 0, overtimeHours: 0 };

    const actualMs = checkOutTime.getTime() - new Date(log.checkInTime).getTime();
    const actualHours = Math.max(0, actualMs / 3600000);

    const shift = log.employee?.shifts?.[0]?.shiftMaster;
    let standardHours = 8;
    if (shift) {
      const [sh, sm] = shift.startTime.split(':').map(Number);
      const [eh, em] = shift.endTime.split(':').map(Number);
      const shiftDurationMins = (eh * 60 + em) - (sh * 60 + sm);
      const breakMins = shift.breakDurationMinutes ?? 60;
      standardHours = Math.max(1, (shiftDurationMins - breakMins) / 60);
    }

    const overtimeHours = Math.max(0, actualHours - standardHours);
    return {
      hoursWorked: Math.round(actualHours * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
    };
  }
}
