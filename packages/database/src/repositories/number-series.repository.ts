import { prisma, NumberSeries, Prisma } from '../client/index';

export class NumberSeriesRepository {
  async findAll(): Promise<NumberSeries[]> {
    return prisma.numberSeries.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<NumberSeries | null> {
    return prisma.numberSeries.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.NumberSeriesCreateInput | Prisma.NumberSeriesUncheckedCreateInput): Promise<NumberSeries> {
    return prisma.numberSeries.create({ data });
  }

  async update(id: string, data: Prisma.NumberSeriesUpdateInput | Prisma.NumberSeriesUncheckedUpdateInput): Promise<NumberSeries> {
    return prisma.numberSeries.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<NumberSeries> {
    return prisma.numberSeries.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
