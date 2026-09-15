import { prisma, ProductAttribute, Prisma } from '../client/index';

export class ProductAttributeRepository {
  async findAll(): Promise<ProductAttribute[]> {
    return prisma.productAttribute.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<ProductAttribute | null> {
    return prisma.productAttribute.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async findWithValues(id: string): Promise<ProductAttribute | null> {
    return prisma.productAttribute.findFirst({
      where: { id, deletedAt: null },
      include: {
        values: {
          where: { deletedAt: null }
        }
      }
    });
  }

  async create(data: Prisma.ProductAttributeCreateInput | Prisma.ProductAttributeUncheckedCreateInput): Promise<ProductAttribute> {
    return prisma.productAttribute.create({ data });
  }

  async update(id: string, data: Prisma.ProductAttributeUpdateInput | Prisma.ProductAttributeUncheckedUpdateInput): Promise<ProductAttribute> {
    return prisma.productAttribute.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<ProductAttribute> {
    return prisma.productAttribute.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
