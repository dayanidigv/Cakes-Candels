import { prisma, Prisma, Session } from '../client/index';

export class SessionRepository {
  async create(data: Prisma.SessionUncheckedCreateInput): Promise<Session> {
    return prisma.session.create({ data });
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteById(id: string): Promise<void> {
    await prisma.session.delete({ where: { id } }).catch(() => null);
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { userId } });
  }

  async deleteExpired(): Promise<void> {
    await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}
