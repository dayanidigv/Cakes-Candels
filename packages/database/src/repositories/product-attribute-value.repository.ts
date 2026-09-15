import { prisma, ProductAttributeValue, Prisma } from '../client/index';

export class ProductAttributeValueRepository {
  async findAll(): Promise<ProductAttributeValue[]> {
    return prisma.productAttributeValue.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<ProductAttributeValue | null> {
    return prisma.productAttributeValue.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.ProductAttributeValueCreateInput | Prisma.ProductAttributeValueUncheckedCreateInput): Promise<ProductAttributeValue> {
    return prisma.productAttributeValue.create({ data });
  }

  async update(id: string, data: Prisma.ProductAttributeValueUpdateInput | Prisma.ProductAttributeValueUncheckedUpdateInput): Promise<ProductAttributeValue> {
    return prisma.productAttributeValue.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<ProductAttributeValue> {
    return prisma.productAttributeValue.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
