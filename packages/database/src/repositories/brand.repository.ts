import { prisma, Brand, Prisma } from '../client/index';

export class BrandRepository {
  async findAll(): Promise<Brand[]> {
    return prisma.brand.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string): Promise<Brand | null> {
    return prisma.brand.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.BrandCreateInput): Promise<Brand> {
    return prisma.brand.create({ data });
  }

  async update(id: string, data: Prisma.BrandUpdateInput): Promise<Brand> {
    return prisma.brand.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<Brand> {
    return prisma.brand.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
