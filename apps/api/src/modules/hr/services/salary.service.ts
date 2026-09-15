import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { AuditAction } from '@prisma/client';
import {
  CreateSalaryComponentDto,
  UpdateSalaryComponentDto,
  CreateSalaryStructureDto,
  UpdateSalaryStructureDto,
} from '../dto/salary.dto';
import { writeHrAuditLog, writeHrOutboxEvent } from '../utils/hr-audit-outbox.helper';
import type { RequestingUser } from './employee.service';

@Injectable()
export class SalaryComponentService {
  private async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub }, select: { organizationId: true } });
    if (!dbUser?.organizationId) throw new ForbiddenException('No organization assigned');
    return dbUser.organizationId;
  }

  async findAll(user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    return prisma.salaryComponent.findMany({
      where: { organizationId },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  async findById(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    const component = await prisma.salaryComponent.findFirst({
      where: { id, organizationId },
    });
    if (!component) throw new NotFoundException('Salary component not found in organization');
    return component;
  }

  async create(dto: CreateSalaryComponentDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ administrators can define salary components');
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const comp = await tx.salaryComponent.create({
          data: {
            organizationId,
            code: dto.code.toUpperCase(),
            name: dto.name,
            type: dto.type,
            isTaxable: dto.isTaxable ?? true,
          },
        });

        await writeHrAuditLog(tx, {
          entity: 'salary_component',
          entityId: comp.id,
          action: AuditAction.CREATE,
          performedBy: user.sub,
          after: { code: comp.code, name: comp.name, type: comp.type },
        });

        return comp;
      });

      return created;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(`Salary component with code ${dto.code} already exists in organization`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateSalaryComponentDto, user: RequestingUser) {
    const component = await this.findById(id, user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Insufficient permissions to modify salary components');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const comp = await tx.salaryComponent.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          isTaxable: dto.isTaxable,
        },
      });

      await writeHrAuditLog(tx, {
        entity: 'salary_component',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        before: { name: component.name, type: component.type },
        after: dto,
      });

      return comp;
    });

    return updated;
  }
}

@Injectable()
export class SalaryStructureService {
  private async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub }, select: { organizationId: true } });
    if (!dbUser?.organizationId) throw new ForbiddenException('No organization assigned');
    return dbUser.organizationId;
  }

  // ─── SALARY STRUCTURE ASSIGNMENT ──────────────────────────────────────────

  async createSalaryStructure(dto: CreateSalaryStructureDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Insufficient permissions to assign salary structures');
    }

    const dateStr = dto.effectiveDate.split('T')[0];
    const effectiveDate = new Date(`${dateStr}T00:00:00.000Z`);

    if (dto.idempotencyKey) {
      const existingKey = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingKey?.status === 'COMPLETED') {
        return prisma.salaryStructure.findFirst({
          where: { employeeId: dto.employeeId, effectiveDate },
          orderBy: { createdAt: 'desc' },
        });
      }
      try {
        await prisma.idempotencyRecord.create({
          data: {
            idempotencyKey: dto.idempotencyKey,
            requestPath: '/hr/salary/structures',
            status: 'PROCESSING',
          },
        });
      } catch {
        // Continue if record already exists
      }
    }

    const employee = await prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found in organization');

    if (user.scope === 'BRANCH' && user.branchId && employee.assignedBranchId !== user.branchId) {
      throw new ForbiddenException('Cannot manage salary for an employee belonging to a different branch');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create effective-dated salary structure record
      const structure = await tx.salaryStructure.create({
        data: {
          employeeId: dto.employeeId,
          effectiveDate,
          baseSalary: dto.baseSalary,
          hra: dto.hra ?? 0,
          conveyance: dto.conveyance ?? 0,
          specialAllowance: dto.specialAllowance ?? 0,
          pfContribution: dto.pfContribution ?? 0,
          esiContribution: dto.esiContribution ?? 0,
          isActive: true,
        },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
      });

      // 2. Audit logging
      await writeHrAuditLog(tx, {
        entity: 'salary_structure',
        entityId: structure.id,
        action: AuditAction.CREATE,
        performedBy: user.sub,
        branchId: employee.assignedBranchId,
        after: {
          employeeId: dto.employeeId,
          effectiveDate: dateStr,
          baseSalary: dto.baseSalary,
          hra: dto.hra,
          specialAllowance: dto.specialAllowance,
        },
      });

      // 3. Outbox event
      await writeHrOutboxEvent(tx, {
        type: 'hr.salary.assigned',
        payload: {
          salaryStructureId: structure.id,
          employeeId: dto.employeeId,
          effectiveDate: dateStr,
          baseSalary: dto.baseSalary,
        },
      });

      if (dto.idempotencyKey) {
        await tx.idempotencyRecord.update({
          where: { idempotencyKey: dto.idempotencyKey },
          data: { status: 'COMPLETED', responseBody: { salaryStructureId: structure.id } },
        }).catch(() => null);
      }

      return structure;
    });

    return result;
  }

  // ─── HISTORICAL SALARY RESOLUTION ──────────────────────────────────────────

  /**
   * Authoritative Salary Resolution for Payroll Period.
   * Deterministically finds the active SalaryStructure effective on or prior to targetDate.
   * Ensures historical calculations remain 100% reproducible and immutable even after raises.
   */
  async resolveEmployeeSalary(employeeId: string, targetDate: Date | string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found in organization');

    if (user.scope === 'BRANCH' && user.branchId && employee.assignedBranchId !== user.branchId) {
      throw new ForbiddenException('Cannot access salary data for another branch');
    }

    const dateStr = typeof targetDate === 'string' ? targetDate.split('T')[0] : targetDate.toISOString().split('T')[0];
    const date = new Date(`${dateStr}T23:59:59.999Z`);

    const structure = await prisma.salaryStructure.findFirst({
      where: {
        employeeId,
        effectiveDate: { lte: date },
        isActive: true,
      },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, departmentId: true, designationId: true },
        },
      },
    });

    if (!structure) {
      throw new NotFoundException(
        `No active salary structure found for employee ${employee.employeeCode} applicable on date ${dateStr}`,
      );
    }

    return {
      structureId: structure.id,
      employeeId: structure.employeeId,
      employeeCode: structure.employee.employeeCode,
      effectiveDate: structure.effectiveDate,
      baseSalary: Number(structure.baseSalary),
      hra: Number(structure.hra),
      conveyance: Number(structure.conveyance),
      specialAllowance: Number(structure.specialAllowance),
      pfContribution: Number(structure.pfContribution),
      esiContribution: Number(structure.esiContribution),
      totalGrossFixed:
        Number(structure.baseSalary) +
        Number(structure.hra) +
        Number(structure.conveyance) +
        Number(structure.specialAllowance),
      isActive: structure.isActive,
    };
  }

  async getSalaryStructureHistory(employeeId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found in organization');

    if (user.scope === 'BRANCH' && user.branchId && employee.assignedBranchId !== user.branchId) {
      throw new ForbiddenException('Cannot view salary history for an employee of another branch');
    }

    return prisma.salaryStructure.findMany({
      where: { employeeId },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateSalaryStructure(id: string, dto: UpdateSalaryStructureDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR administrators can update existing salary structures');
    }

    const structure = await prisma.salaryStructure.findFirst({
      where: { id },
      include: { employee: true },
    });

    if (!structure || structure.employee.organizationId !== organizationId) {
      throw new NotFoundException('Salary structure not found in organization');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.salaryStructure.update({
        where: { id },
        data: {
          baseSalary: dto.baseSalary,
          hra: dto.hra,
          conveyance: dto.conveyance,
          specialAllowance: dto.specialAllowance,
          pfContribution: dto.pfContribution,
          esiContribution: dto.esiContribution,
          isActive: dto.isActive,
        },
      });

      await writeHrAuditLog(tx, {
        entity: 'salary_structure',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        branchId: structure.employee.assignedBranchId,
        before: {
          baseSalary: structure.baseSalary,
          hra: structure.hra,
          isActive: structure.isActive,
        },
        after: dto,
      });

      return result;
    });

    return updated;
  }
}
