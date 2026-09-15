import { prisma, Prisma, LoginHistory } from '../client/index';

export class LoginHistoryRepository {
  async create(data: Prisma.LoginHistoryUncheckedCreateInput): Promise<LoginHistory> {
    return prisma.loginHistory.create({ data });
  }

  async findByUserId(
    userId: string,
    opts?: { skip?: number; take?: number }
  ): Promise<LoginHistory[]> {
    return prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      skip: opts?.skip ?? 0,
      take: opts?.take ?? 20
    });
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.loginHistory.count({ where: { userId } });
  }
}
