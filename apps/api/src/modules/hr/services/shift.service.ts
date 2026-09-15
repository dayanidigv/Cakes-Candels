import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { AuditAction } from '@prisma/client';
import { CreateShiftDto, UpdateShiftDto, AssignShiftDto } from '../dto/shift.dto';
import { writeHrAuditLog } from '../utils/hr-audit-outbox.helper';
import type { RequestingUser } from './employee.service';

@Injectable()
export class ShiftService {
  private async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub }, select: { organizationId: true } });
    if (!dbUser?.organizationId) throw new ForbiddenException('No organization assigned');
    return dbUser.organizationId;
  }

  // ─── SHIFT MASTER ──────────────────────────────────────────────────────────

  async findAllShifts(user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    return prisma.shiftMaster.findMany({
      where: { organizationId, isActive: true },
      include: {
        _count: { select: { employeeShifts: { where: { effectiveTo: null } } } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async getShiftById(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    const shift = await prisma.shiftMaster.findFirst({
      where: { id, organizationId },
    });
    if (!shift) throw new NotFoundException('Shift definition not found');
    return shift;
  }

  async createShift(dto: CreateShiftDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const shift = await tx.shiftMaster.create({
          data: {
            organizationId,
            code: dto.code,
            name: dto.name,
            startTime: dto.startTime,
            endTime: dto.endTime,
            gracePeriodMinutes: dto.gracePeriodMinutes ?? 15,
            breakDurationMinutes: dto.breakDurationMinutes ?? 60,
          },
        });

        await writeHrAuditLog(tx, {
          entity: 'shift_master',
          entityId: shift.id,
          action: AuditAction.CREATE,
          performedBy: user.sub,
          after: { code: shift.code, startTime: shift.startTime, endTime: shift.endTime },
        });

        return shift;
      });

      return created;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(`Shift with code ${dto.code} already exists`);
      }
      throw error;
    }
  }

  async updateShift(id: string, dto: UpdateShiftDto, user: RequestingUser) {
    const shift = await this.getShiftById(id, user);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedShift = await tx.shiftMaster.update({
        where: { id },
        data: {
          name: dto.name,
          startTime: dto.startTime,
          endTime: dto.endTime,
          gracePeriodMinutes: dto.gracePeriodMinutes,
          breakDurationMinutes: dto.breakDurationMinutes,
          isActive: dto.isActive,
        },
      });

      await writeHrAuditLog(tx, {
        entity: 'shift_master',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        before: { name: shift.name, startTime: shift.startTime, endTime: shift.endTime },
        after: dto,
      });

      return updatedShift;
    });

    return updated;
  }

  async deactivateShift(id: string, user: RequestingUser) {
    return this.updateShift(id, { isActive: false }, user);
  }

  // ─── EMPLOYEE SHIFT ASSIGNMENT ──────────────────────────────────────────────

  async assignShiftToEmployee(employeeId: string, dto: AssignShiftDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const shift = await this.getShiftById(dto.shiftMasterId, user);
    if (!shift.isActive) throw new BadRequestException('Cannot assign an inactive shift definition');

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('effectiveTo date cannot be earlier than effectiveFrom date');
    }

    const assignment = await prisma.$transaction(async (tx) => {
      await tx.employeeShift.updateMany({
        where: {
          employeeId,
          effectiveTo: null,
          effectiveFrom: { lte: effectiveFrom },
        },
        data: {
          effectiveTo: new Date(effectiveFrom.getTime() - 86400000),
        },
      });

      const newAssignment = await tx.employeeShift.create({
        data: {
          employeeId,
          shiftMasterId: dto.shiftMasterId,
          effectiveFrom,
          effectiveTo,
        },
        include: { shiftMaster: true },
      });

      await writeHrAuditLog(tx, {
        entity: 'employee_shift',
        entityId: newAssignment.id,
        action: AuditAction.CREATE,
        performedBy: user.sub,
        branchId: employee.assignedBranchId,
        after: {
          employeeId,
          shiftCode: shift.code,
          effectiveFrom: dto.effectiveFrom,
          effectiveTo: dto.effectiveTo,
        },
      });

      return newAssignment;
    });

    return assignment;
  }

  async getEmployeeCurrentShift(employeeId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const now = new Date();

    const assignment = await prisma.employeeShift.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      include: { shiftMaster: true },
      orderBy: { effectiveFrom: 'desc' },
    });

    return assignment ?? null;
  }
}
