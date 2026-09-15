import { prisma, RecipeMaster, Prisma } from '../client/index';

export class RecipeMasterRepository {
  async findAll(): Promise<RecipeMaster[]> {
    return prisma.recipeMaster.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<RecipeMaster | null> {
    return prisma.recipeMaster.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async findWithVersions(id: string): Promise<RecipeMaster | null> {
    return prisma.recipeMaster.findFirst({
      where: { id, deletedAt: null },
      include: {
        versions: {
          where: { deletedAt: null },
          include: {
            ingredients: { where: { deletedAt: null } }
          }
        }
      }
    });
  }

  async create(data: Prisma.RecipeMasterCreateInput | Prisma.RecipeMasterUncheckedCreateInput): Promise<RecipeMaster> {
    return prisma.recipeMaster.create({ data });
  }

  async update(id: string, data: Prisma.RecipeMasterUpdateInput | Prisma.RecipeMasterUncheckedUpdateInput): Promise<RecipeMaster> {
    return prisma.recipeMaster.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<RecipeMaster> {
    return prisma.recipeMaster.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
