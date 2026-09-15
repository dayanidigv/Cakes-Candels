import { prisma, TaxComponent, Prisma } from '../client/index';

export class TaxComponentRepository {
  async findAll(): Promise<TaxComponent[]> {
    return prisma.taxComponent.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<TaxComponent | null> {
    return prisma.taxComponent.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.TaxComponentCreateInput | Prisma.TaxComponentUncheckedCreateInput): Promise<TaxComponent> {
    return prisma.taxComponent.create({ data });
  }

  async update(id: string, data: Prisma.TaxComponentUpdateInput | Prisma.TaxComponentUncheckedUpdateInput): Promise<TaxComponent> {
    return prisma.taxComponent.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<TaxComponent> {
    return prisma.taxComponent.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
