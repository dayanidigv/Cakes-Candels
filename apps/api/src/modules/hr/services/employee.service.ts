import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { EmploymentStatus, EmploymentType, AuditAction } from '@prisma/client';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../dto/employee.dto';
import { writeHrAuditLog, writeHrOutboxEvent } from '../utils/hr-audit-outbox.helper';

import { AuthorizationContext } from '../../../common/interfaces/authorization-context.interface';

export interface RequestingUser extends AuthorizationContext {
  id?: string;
  sub?: string;
  role?: string;
  roles?: string[];
  username?: string;
  employeeId?: string;
}

const ALLOWED_TRANSITIONS: Record<EmploymentStatus, EmploymentStatus[]> = {
  [EmploymentStatus.DRAFT]: [EmploymentStatus.ACTIVE],
  [EmploymentStatus.ACTIVE]: [
    EmploymentStatus.ON_LEAVE,
    EmploymentStatus.SUSPENDED,
    EmploymentStatus.RESIGNED,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.ON_LEAVE]: [
    EmploymentStatus.ACTIVE,
    EmploymentStatus.RESIGNED,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.SUSPENDED]: [
    EmploymentStatus.ACTIVE,
    EmploymentStatus.RESIGNED,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.RESIGNED]: [EmploymentStatus.TERMINATED],
  [EmploymentStatus.TERMINATED]: [],
};

@Injectable()
export class EmployeeService {
  async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const dbUser = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { organizationId: true },
    });
    if (!dbUser?.organizationId) throw new ForbiddenException('User has no organization assigned');
    return dbUser.organizationId;
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async createEmployee(dto: CreateEmployeeDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' && user.branchId && dto.assignedBranchId !== user.branchId) {
      throw new ForbiddenException('You can only create employees in your assigned branch');
    }

    const branch = await prisma.branch.findFirst({
      where: { id: dto.assignedBranchId, organizationId },
    });
    if (!branch) throw new NotFoundException('Assigned branch not found in organization');

    if (dto.userId) {
      const existingUser = await prisma.user.findFirst({
        where: { id: dto.userId, organizationId },
      });
      if (!existingUser) throw new NotFoundException('Associated user not found in organization');
    }

    if (dto.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId, deletedAt: null },
      });
      if (!dept) throw new NotFoundException('Department not found in organization');
    }

    if (dto.designationId) {
      const desig = await prisma.designation.findFirst({
        where: { id: dto.designationId, organizationId, deletedAt: null },
      });
      if (!desig) throw new NotFoundException('Designation not found in organization');
    }

    try {
      const employee = await prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({
          data: {
            organizationId,
            employeeCode: dto.employeeCode,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            email: dto.email,
            dateOfJoining: new Date(dto.dateOfJoining),
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
            assignedBranchId: dto.assignedBranchId,
            departmentId: dto.departmentId,
            designationId: dto.designationId,
            userId: dto.userId,
            employmentType: dto.employmentType ?? EmploymentType.FULL_TIME,
            status: EmploymentStatus.DRAFT,
            bankAccountNo: dto.bankAccountNo,
            bankIfscCode: dto.bankIfscCode,
            panNumber: dto.panNumber,
            pfAccountNo: dto.pfAccountNo,
            esiNumber: dto.esiNumber,
          },
          include: {
            department: true,
            designation: true,
            branch: { select: { id: true, name: true, type: true } },
            user: { select: { id: true, username: true, fullName: true } },
          },
        });

        await writeHrAuditLog(tx, {
          entity: 'employee',
          entityId: created.id,
          action: AuditAction.CREATE,
          performedBy: user.sub,
          branchId: created.assignedBranchId,
          after: { employeeCode: created.employeeCode, assignedBranchId: created.assignedBranchId },
        });

        await writeHrOutboxEvent(tx, {
          type: 'hr.employee.created',
          payload: { employeeId: created.id, employeeCode: created.employeeCode, organizationId },
        });

        return created;
      });

      return employee;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const target = error.meta?.target;
        if (Array.isArray(target) && target.includes('employeeCode')) {
          throw new ConflictException(`Employee code ${dto.employeeCode} already exists in this organization`);
        }
        if (Array.isArray(target) && target.includes('userId')) {
          throw new ConflictException(`User ID is already linked to another employee`);
        }
        throw new ConflictException('Unique constraint violation during employee creation');
      }
      throw error;
    }
  }

  async findAll(
    user: RequestingUser,
    params: {
      search?: string;
      status?: EmploymentStatus;
      branchId?: string;
      departmentId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const organizationId = await this.resolveOrgId(user);
    const { search, status, departmentId, page = 1, limit = 20 } = params;

    let branchFilter: string | undefined = params.branchId;
    if (user.scope === 'BRANCH' && user.branchId) {
      branchFilter = user.branchId;
    } else if (user.scope === 'FACTORY' && user.branchId && !params.branchId) {
      branchFilter = user.branchId;
    }

    const where: any = {
      organizationId,
      deletedAt: null,
      ...(branchFilter ? { assignedBranchId: branchFilter } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { employeeCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          department: true,
          designation: true,
          branch: { select: { id: true, name: true, type: true } },
          user: { select: { id: true, username: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    const employee = await prisma.employee.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        department: true,
        designation: true,
        branch: { select: { id: true, name: true, type: true } },
        user: { select: { id: true, username: true, fullName: true } },
        salaryStructures: { where: { isActive: true }, orderBy: { effectiveDate: 'desc' }, take: 1 },
        leaveBalances: { include: { leaveType: true } },
      },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    if (user.scope === 'BRANCH' && user.branchId && employee.assignedBranchId !== user.branchId) {
      throw new ForbiddenException('Access denied: employee belongs to a different branch');
    }

    return employee;
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto, user: RequestingUser) {
    const employee = await this.findById(id, user);

    if (dto.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId: employee.organizationId, deletedAt: null },
      });
      if (!dept) throw new NotFoundException('Department not found');
    }

    if (dto.designationId) {
      const desig = await prisma.designation.findFirst({
        where: { id: dto.designationId, organizationId: employee.organizationId, deletedAt: null },
      });
      if (!desig) throw new NotFoundException('Designation not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          bankAccountNo: dto.bankAccountNo,
          bankIfscCode: dto.bankIfscCode,
          panNumber: dto.panNumber,
          pfAccountNo: dto.pfAccountNo,
          esiNumber: dto.esiNumber,
        },
        include: { department: true, designation: true, branch: true },
      });

      await writeHrAuditLog(tx, {
        entity: 'employee',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        branchId: employee.assignedBranchId,
        before: { firstName: employee.firstName, lastName: employee.lastName, phone: employee.phone },
        after: dto,
      });

      return emp;
    });

    return updated;
  }

  // ─── ASSIGNMENTS ────────────────────────────────────────────────────────────

  async assignBranch(id: string, branchId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    if (user.scope === 'BRANCH') {
      throw new ForbiddenException('Branch managers cannot reassign employees to other branches');
    }

    const branch = await prisma.branch.findFirst({ where: { id: branchId, organizationId } });
    if (!branch) throw new NotFoundException('Target branch not found in organization');

    const employee = await this.findById(id, user);

    const updated = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id },
        data: { assignedBranchId: branchId },
      });

      await writeHrAuditLog(tx, {
        entity: 'employee',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        branchId: branchId,
        before: { assignedBranchId: employee.assignedBranchId },
        after: { assignedBranchId: branchId },
      });

      return emp;
    });

    return updated;
  }

  async assignDepartment(id: string, departmentId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    const dept = await prisma.department.findFirst({ where: { id: departmentId, organizationId, deletedAt: null } });
    if (!dept) throw new NotFoundException('Department not found in organization');

    const employee = await this.findById(id, user);

    return prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id },
        data: { departmentId },
      });

      await writeHrAuditLog(tx, {
        entity: 'employee',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        branchId: employee.assignedBranchId,
        before: { departmentId: employee.departmentId },
        after: { departmentId },
      });

      return emp;
    });
  }

  async assignDesignation(id: string, designationId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    const desig = await prisma.designation.findFirst({ where: { id: designationId, organizationId, deletedAt: null } });
    if (!desig) throw new NotFoundException('Designation not found in organization');

    const employee = await this.findById(id, user);

    return prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id },
        data: { designationId },
      });

      await writeHrAuditLog(tx, {
        entity: 'employee',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        branchId: employee.assignedBranchId,
        before: { designationId: employee.designationId },
        after: { designationId },
      });

      return emp;
    });
  }

  // ─── LIFECYCLE STATE MACHINE ────────────────────────────────────────────────

  async transitionStatus(
    id: string,
    newStatus: EmploymentStatus,
    user: RequestingUser,
    reason?: string,
    idempotencyKey?: string,
  ) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Insufficient privileges to perform employee lifecycle transitions');
    }

    if (idempotencyKey) {
      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey },
      });
      if (existingRecord?.status === 'COMPLETED') {
        return prisma.employee.findUnique({ where: { id } });
      }
      await prisma.idempotencyRecord.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          idempotencyKey,
          requestPath: `/hr/employees/${id}/status`,
          status: 'PROCESSING',
        },
      });
    }

    const employee = await this.findById(id, user);
    const currentStatus = employee.status;

    if (currentStatus === newStatus) {
      return employee;
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const targetEmp = await tx.employee.findFirst({
        where: { id, organizationId, status: currentStatus },
      });
      if (!targetEmp) {
        throw new ConflictException(`Concurrent status transition detected or invalid current state`);
      }

      const emp = await tx.employee.update({
        where: { id },
        data: { status: newStatus },
        include: { department: true, designation: true, branch: true },
      });

      if ((newStatus === EmploymentStatus.SUSPENDED || newStatus === EmploymentStatus.TERMINATED) && emp.userId) {
        await tx.user.update({
          where: { id: emp.userId },
          data: { status: 'INACTIVE' },
        }).catch(() => null);
      } else if (newStatus === EmploymentStatus.ACTIVE && emp.userId) {
        await tx.user.update({
          where: { id: emp.userId },
          data: { status: 'ACTIVE' },
        }).catch(() => null);
      }

      await writeHrAuditLog(tx, {
        entity: 'employee',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        branchId: emp.assignedBranchId,
        before: { status: currentStatus },
        after: { status: newStatus, reason },
      });

      if (idempotencyKey) {
        await tx.idempotencyRecord.update({
          where: { idempotencyKey },
          data: { status: 'COMPLETED', responseBody: { employeeId: id, status: newStatus } },
        }).catch(() => null);
      }

      return emp;
    });

    return updated;
  }

  // Explicit lifecycle convenience methods
  async activateEmployee(id: string, user: RequestingUser, idempotencyKey?: string) {
    return this.transitionStatus(id, EmploymentStatus.ACTIVE, user, 'Onboarding completed', idempotencyKey);
  }

  async putOnLeave(id: string, user: RequestingUser, reason?: string) {
    return this.transitionStatus(id, EmploymentStatus.ON_LEAVE, user, reason ?? 'Approved leave period');
  }

  async returnFromLeave(id: string, user: RequestingUser) {
    return this.transitionStatus(id, EmploymentStatus.ACTIVE, user, 'Returned from leave');
  }

  async suspendEmployee(id: string, user: RequestingUser, reason?: string) {
    return this.transitionStatus(id, EmploymentStatus.SUSPENDED, user, reason ?? 'Disciplinary suspension');
  }

  async reinstateEmployee(id: string, user: RequestingUser, reason?: string) {
    return this.transitionStatus(id, EmploymentStatus.ACTIVE, user, reason ?? 'Reinstated following review');
  }

  async resignEmployee(id: string, user: RequestingUser, reason?: string) {
    return this.transitionStatus(id, EmploymentStatus.RESIGNED, user, reason ?? 'Voluntary resignation');
  }

  async terminateEmployee(id: string, user: RequestingUser, reason?: string) {
    return this.transitionStatus(id, EmploymentStatus.TERMINATED, user, reason ?? 'Employment terminated');
  }
}
