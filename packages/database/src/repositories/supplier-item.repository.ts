import { prisma, SupplierItem, Prisma } from '../client/index';

export class SupplierItemRepository {
  async findAll(): Promise<SupplierItem[]> {
    return prisma.supplierItem.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<SupplierItem | null> {
    return prisma.supplierItem.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async findWithSupplier(id: string): Promise<SupplierItem | null> {
    return prisma.supplierItem.findFirst({
      where: { id, deletedAt: null },
      include: {
        supplier: {
          select: { id: true, name: true, code: true }
        }
      }
    });
  }

  async create(data: Prisma.SupplierItemCreateInput | Prisma.SupplierItemUncheckedCreateInput): Promise<SupplierItem> {
    return prisma.supplierItem.create({ data });
  }

  async update(id: string, data: Prisma.SupplierItemUpdateInput | Prisma.SupplierItemUncheckedUpdateInput): Promise<SupplierItem> {
    return prisma.supplierItem.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<SupplierItem> {
    return prisma.supplierItem.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
