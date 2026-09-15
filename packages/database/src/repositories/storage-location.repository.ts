import { prisma, StorageLocation, Prisma } from '../client/index';

export class StorageLocationRepository {
  async findAll(): Promise<StorageLocation[]> {
    return prisma.storageLocation.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { branch: true }
    });
  }

  async findByBranch(branchId: string): Promise<StorageLocation[]> {
    return prisma.storageLocation.findMany({
      where: { branchId, deletedAt: null },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string): Promise<StorageLocation | null> {
    return prisma.storageLocation.findFirst({
      where: { id, deletedAt: null },
      include: { branch: true }
    });
  }

  async create(data: Prisma.StorageLocationCreateInput): Promise<StorageLocation> {
    return prisma.storageLocation.create({ data });
  }

  async update(id: string, data: Prisma.StorageLocationUpdateInput): Promise<StorageLocation> {
    return prisma.storageLocation.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<StorageLocation> {
    return prisma.storageLocation.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
