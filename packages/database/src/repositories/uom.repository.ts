import { prisma, UnitOfMeasure, Prisma } from '../client/index';

export class UomRepository {
  async findAll(): Promise<UnitOfMeasure[]> {
    return prisma.unitOfMeasure.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string): Promise<UnitOfMeasure | null> {
    return prisma.unitOfMeasure.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.UnitOfMeasureCreateInput): Promise<UnitOfMeasure> {
    return prisma.unitOfMeasure.create({ data });
  }

  async update(id: string, data: Prisma.UnitOfMeasureUpdateInput): Promise<UnitOfMeasure> {
    return prisma.unitOfMeasure.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<UnitOfMeasure> {
    return prisma.unitOfMeasure.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
