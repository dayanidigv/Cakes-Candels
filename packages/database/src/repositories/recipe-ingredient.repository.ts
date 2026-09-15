import { prisma, RecipeIngredient, Prisma } from '../client/index';

export class RecipeIngredientRepository {
  async findAll(): Promise<RecipeIngredient[]> {
    return prisma.recipeIngredient.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<RecipeIngredient | null> {
    return prisma.recipeIngredient.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.RecipeIngredientCreateInput | Prisma.RecipeIngredientUncheckedCreateInput): Promise<RecipeIngredient> {
    return prisma.recipeIngredient.create({ data });
  }

  async update(id: string, data: Prisma.RecipeIngredientUpdateInput | Prisma.RecipeIngredientUncheckedUpdateInput): Promise<RecipeIngredient> {
    return prisma.recipeIngredient.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<RecipeIngredient> {
    return prisma.recipeIngredient.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
