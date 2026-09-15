import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { AuditAction } from '@prisma/client';
import { CreatePayrollPeriodDto } from '../dto/payroll.dto';
import { writeHrAuditLog } from '../utils/hr-audit-outbox.helper';
import type { RequestingUser } from './employee.service';

@Injectable()
export class PayrollPeriodService {
  private async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub }, select: { organizationId: true } });
    if (!dbUser?.organizationId) throw new ForbiddenException('No organization assigned');
    return dbUser.organizationId;
  }

  async createPeriod(dto: CreatePayrollPeriodDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR administrators can define payroll periods');
    }

    if (dto.month < 1 || dto.month > 12) {
      throw new BadRequestException('Month must be between 1 and 12');
    }

    // Determine deterministic calendar boundary in UTC
    const year = dto.year;
    const month = dto.month;
    const monthStr = month.toString().padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastDayStr = lastDay.toString().padStart(2, '0');

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : new Date(`${year}-${monthStr}-01T00:00:00.000Z`);

    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : new Date(`${year}-${monthStr}-${lastDayStr}T00:00:00.000Z`);

    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be prior to start date');
    }

    try {
      const period = await prisma.$transaction(async (tx) => {
        const created = await tx.payrollPeriod.create({
          data: {
            organizationId,
            year,
            month,
            startDate,
            endDate,
            status: 'OPEN',
          },
        });

        await writeHrAuditLog(tx, {
          entity: 'payroll_period',
          entityId: created.id,
          action: AuditAction.CREATE,
          performedBy: user.sub,
          after: { year, month, startDate, endDate, status: 'OPEN' },
        });

        return created;
      });

      return period;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          `Payroll period for ${year}-${monthStr} already exists in organization`,
        );
      }
      throw error;
    }
  }

  async getPeriod(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    const period = await prisma.payrollPeriod.findFirst({
      where: { id, organizationId },
      include: {
        payrollRuns: {
          select: {
            id: true,
            runNumber: true,
            status: true,
            totalEmployees: true,
            totalGrossPay: true,
            totalNetPay: true,
            createdAt: true,
          },
        },
      },
    });
    if (!period) throw new NotFoundException('Payroll period not found');
    return period;
  }

  async listPeriods(user: RequestingUser, year?: number) {
    const organizationId = await this.resolveOrgId(user);
    return prisma.payrollPeriod.findMany({
      where: {
        organizationId,
        ...(year ? { year } : {}),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        _count: { select: { payrollRuns: true } },
      },
    });
  }

  async closePeriod(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR administrators can close payroll periods');
    }

    const period = await prisma.payrollPeriod.findFirst({
      where: { id, organizationId },
    });
    if (!period) throw new NotFoundException('Payroll period not found');

    const updated = await prisma.$transaction(async (tx) => {
      const closed = await tx.payrollPeriod.update({
        where: { id },
        data: { status: 'CLOSED' },
      });

      await writeHrAuditLog(tx, {
        entity: 'payroll_period',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        before: { status: period.status },
        after: { status: 'CLOSED' },
      });

      return closed;
    });

    return updated;
  }
}
