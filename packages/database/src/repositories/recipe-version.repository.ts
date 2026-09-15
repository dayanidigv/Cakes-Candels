import { prisma, RecipeVersion, Prisma } from '../client/index';

export class RecipeVersionRepository {
  async findAll(): Promise<RecipeVersion[]> {
    return prisma.recipeVersion.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<RecipeVersion | null> {
    return prisma.recipeVersion.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.RecipeVersionCreateInput | Prisma.RecipeVersionUncheckedCreateInput): Promise<RecipeVersion> {
    return prisma.recipeVersion.create({ data });
  }

  async update(id: string, data: Prisma.RecipeVersionUpdateInput | Prisma.RecipeVersionUncheckedUpdateInput): Promise<RecipeVersion> {
    return prisma.recipeVersion.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<RecipeVersion> {
    return prisma.recipeVersion.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
