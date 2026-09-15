import { prisma, Supplier, Prisma } from '../client/index';

export class SupplierRepository {
  async findAll(): Promise<Supplier[]> {
    return prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string): Promise<Supplier | null> {
    return prisma.supplier.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.SupplierCreateInput): Promise<Supplier> {
    return prisma.supplier.create({ data });
  }

  async update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return prisma.supplier.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<Supplier> {
    return prisma.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
