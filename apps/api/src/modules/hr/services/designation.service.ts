import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { AuditAction } from '@prisma/client';
import { CreateDesignationDto, UpdateDesignationDto } from '../dto/designation.dto';
import { writeHrAuditLog } from '../utils/hr-audit-outbox.helper';
import type { RequestingUser } from './employee.service';

@Injectable()
export class DesignationService {
  private async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub }, select: { organizationId: true } });
    if (!dbUser?.organizationId) throw new ForbiddenException('No organization assigned');
    return dbUser.organizationId;
  }

  async findAll(user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    return prisma.designation.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        _count: { select: { employees: { where: { deletedAt: null } } } },
      },
      orderBy: [{ level: 'desc' }, { name: 'asc' }],
    });
  }

  async findById(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    const desig = await prisma.designation.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        employees: {
          where: { deletedAt: null },
          select: { id: true, firstName: true, lastName: true, employeeCode: true, status: true },
        },
      },
    });
    if (!desig) throw new NotFoundException('Designation not found in organization');
    return desig;
  }

  async create(dto: CreateDesignationDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const desig = await tx.designation.create({
          data: {
            organizationId,
            code: dto.code,
            name: dto.name,
            title: dto.title,
            level: dto.level ?? 1,
          },
        });

        await writeHrAuditLog(tx, {
          entity: 'designation',
          entityId: desig.id,
          action: AuditAction.CREATE,
          performedBy: user.sub,
          after: { code: desig.code, title: desig.title, level: desig.level },
        });

        return desig;
      });

      return created;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(`Designation code ${dto.code} or title ${dto.title} already exists`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateDesignationDto, user: RequestingUser) {
    const desig = await this.findById(id, user);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedDesig = await tx.designation.update({
        where: { id },
        data: {
          name: dto.name,
          title: dto.title,
          level: dto.level,
          isActive: dto.isActive,
        },
      });

      await writeHrAuditLog(tx, {
        entity: 'designation',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        before: { name: desig.name, title: desig.title, level: desig.level },
        after: dto,
      });

      return updatedDesig;
    });

    return updated;
  }

  async deactivate(id: string, user: RequestingUser) {
    return this.update(id, { isActive: false }, user);
  }
}
