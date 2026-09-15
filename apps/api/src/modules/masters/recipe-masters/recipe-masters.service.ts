import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateRecipeMasterDto } from './dto/create-recipe-masters.dto';
import { UpdateRecipeMasterDto } from './dto/update-recipe-masters.dto';
import { CreateRecipeVersionDto } from './dto/create-recipe-version.dto';
import { UpdateRecipeVersionDto } from './dto/update-recipe-version.dto';

@Injectable()
export class RecipeMasterService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.recipeMaster.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { versions: { where: { deletedAt: null } } }
          }
        }
      }),
      prisma.recipeMaster.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<any> {
    return prisma.recipeMaster.findUnique({
      where: { id },
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

  async create(data: CreateRecipeMasterDto, userId: string): Promise<any> {
    try { return await prisma.recipeMaster.create({ data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_RECIPEMASTER', message: 'RecipeMaster already exists.' });
      throw error;
    }
  }

  async update(id: string, data: UpdateRecipeMasterDto, userId: string): Promise<any> {
    try { return await prisma.recipeMaster.update({ where: { id }, data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_RECIPEMASTER', message: 'RecipeMaster already exists.' });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.recipeMaster.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: userId, isActive: false } });
  }

  // Nested CRUD for RecipeVersion
  async addVersion(recipeId: string, data: CreateRecipeVersionDto, userId: string): Promise<any> {
    return prisma.$transaction(async (tx) => {
      const recipe = await tx.recipeMaster.findFirst({ where: { id: recipeId, deletedAt: null, isActive: true } });
      if (!recipe) {
        throw new ConflictException({ success: false, errorCode: 'RECIPE_NOT_FOUND', message: 'Recipe not found or inactive.' });
      }

      if (recipe.yieldQuantity.toNumber() <= 0) {
         throw new ConflictException({ success: false, errorCode: 'INVALID_RECIPE_YIELD', message: 'Recipe yield must be positive.' });
      }

      const existingVersion = await tx.recipeVersion.findFirst({
        where: { recipeId, versionNumber: data.versionNumber, deletedAt: null }
      });
      if (existingVersion) {
        throw new ConflictException({ success: false, errorCode: 'DUPLICATE_RECIPE_VERSION', message: 'Version number already exists for this recipe.' });
      }

      return tx.recipeVersion.create({
        data: {
          ...data,
          recipeId,
        } as any
      });
    });
  }

  async updateVersion(recipeId: string, versionId: string, data: UpdateRecipeVersionDto, userId: string): Promise<any> {
    return prisma.$transaction(async (tx) => {
      const recipe = await tx.recipeMaster.findFirst({ where: { id: recipeId, deletedAt: null, isActive: true } });
      if (!recipe) {
        throw new ConflictException({ success: false, errorCode: 'RECIPE_NOT_FOUND', message: 'Recipe not found or inactive.' });
      }

      const version = await tx.recipeVersion.findFirst({ where: { id: versionId, recipeId, deletedAt: null } });
      if (!version) {
        throw new ConflictException({ success: false, errorCode: 'VERSION_NOT_FOUND', message: 'Version not found for this recipe.' });
      }

      if (data.versionNumber) {
        const existingVersion = await tx.recipeVersion.findFirst({
          where: { recipeId, versionNumber: data.versionNumber, id: { not: versionId }, deletedAt: null }
        });
        if (existingVersion) {
          throw new ConflictException({ success: false, errorCode: 'DUPLICATE_RECIPE_VERSION', message: 'Version number already exists for this recipe.' });
        }
      }

      return tx.recipeVersion.update({
        where: { id: versionId },
        data: data as any
      });
    });
  }

  async removeVersion(recipeId: string, versionId: string, userId: string): Promise<any> {
    const version = await prisma.recipeVersion.findFirst({ where: { id: versionId, recipeId, deletedAt: null } });
    if (!version) {
       throw new ConflictException({ success: false, errorCode: 'VERSION_NOT_FOUND', message: 'Version not found for this recipe.' });
    }
    return prisma.recipeVersion.update({
      where: { id: versionId },
      data: { deletedAt: new Date(), deletedBy: userId, isActive: false }
    });
  }
}
