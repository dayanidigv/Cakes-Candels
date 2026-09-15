import { prisma, Prisma, SecurityLog } from '../client/index';

export class SecurityLogRepository {
  async create(data: Prisma.SecurityLogUncheckedCreateInput): Promise<SecurityLog> {
    return prisma.securityLog.create({ data });
  }

  async findRecent(opts?: { userId?: string; limit?: number }): Promise<SecurityLog[]> {
    return prisma.securityLog.findMany({
      where: opts?.userId ? { userId: opts.userId } : undefined,
      orderBy: { timestamp: 'desc' },
      take: opts?.limit ?? 50
    });
  }
}
