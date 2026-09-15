import { prisma, ReasonMaster, Prisma } from '../client/index';

export class ReasonMasterRepository {
  async findAll(): Promise<ReasonMaster[]> {
    return prisma.reasonMaster.findMany({
      where: { deletedAt: null },
      orderBy: { type: 'asc' }
    });
  }

  async findById(id: string): Promise<ReasonMaster | null> {
    return prisma.reasonMaster.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.ReasonMasterCreateInput): Promise<ReasonMaster> {
    return prisma.reasonMaster.create({ data });
  }

  async update(id: string, data: Prisma.ReasonMasterUpdateInput): Promise<ReasonMaster> {
    return prisma.reasonMaster.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<ReasonMaster> {
    return prisma.reasonMaster.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
