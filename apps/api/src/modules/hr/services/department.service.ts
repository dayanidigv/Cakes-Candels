import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { AuditAction } from '@prisma/client';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../dto/department.dto';
import { writeHrAuditLog } from '../utils/hr-audit-outbox.helper';
import type { RequestingUser } from './employee.service';

@Injectable()
export class DepartmentService {
  private async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub }, select: { organizationId: true } });
    if (!dbUser?.organizationId) throw new ForbiddenException('No organization assigned');
    return dbUser.organizationId;
  }

  async findAll(user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    return prisma.department.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        _count: { select: { employees: { where: { deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    const dept = await prisma.department.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        employees: {
          where: { deletedAt: null },
          select: { id: true, firstName: true, lastName: true, employeeCode: true, status: true },
        },
      },
    });
    if (!dept) throw new NotFoundException('Department not found in organization');
    return dept;
  }

  async create(dto: CreateDepartmentDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const dept = await tx.department.create({
          data: {
            organizationId,
            code: dto.code,
            name: dto.name,
            description: dto.description,
            managerId: dto.managerId,
          },
        });

        await writeHrAuditLog(tx, {
          entity: 'department',
          entityId: dept.id,
          action: AuditAction.CREATE,
          performedBy: user.sub,
          after: { code: dept.code, name: dept.name },
        });

        return dept;
      });

      return created;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(`Department code ${dto.code} already exists in this organization`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateDepartmentDto, user: RequestingUser) {
    const dept = await this.findById(id, user);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedDept = await tx.department.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          managerId: dto.managerId,
          isActive: dto.isActive,
        },
      });

      await writeHrAuditLog(tx, {
        entity: 'department',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        before: { name: dept.name, description: dept.description },
        after: dto,
      });

      return updatedDept;
    });

    return updated;
  }

  async deactivate(id: string, user: RequestingUser) {
    return this.update(id, { isActive: false }, user);
  }
}
