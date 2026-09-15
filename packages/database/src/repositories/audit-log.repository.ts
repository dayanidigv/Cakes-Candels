import { prisma, AuditLog, Prisma } from '../client/index';

export class AuditLogRepository {
  async findAll(take = 50): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take
    });
  }

  async create(data: Prisma.AuditLogCreateInput): Promise<AuditLog> {
    return prisma.auditLog.create({ data });
  }
}
