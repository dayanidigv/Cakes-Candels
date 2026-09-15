import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateCategoryDto } from './dto/create-categories.dto';
import { UpdateCategoryDto } from './dto/update-categories.dto';

@Injectable()
export class CategoryService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.category.count({ where })
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<any> {
    return prisma.category.findUnique({ where: { id } });
  }

  async create(data: CreateCategoryDto, userId: string): Promise<any> {
    try {
      return await prisma.category.create({
        data: data as any,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          success: false,
          errorCode: 'DUPLICATE_CATEGORY',
          message: 'Category with this unique field already exists.'
        });
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateCategoryDto, userId: string): Promise<any> {
    try {
      return await prisma.category.update({
        where: { id },
        data: data as any,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          success: false,
          errorCode: 'DUPLICATE_CATEGORY',
          message: 'Category with this unique field already exists.'
        });
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        isActive: false
      }
    });
  }

  async importBulk(items: CreateCategoryDto[], userId: string): Promise<any> {
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const [index, item] of items.entries()) {
      try {
        await prisma.category.create({
          data: item as any,
        });
        successCount++;
      } catch (error: any) {
        failedCount++;
        errors.push({ row: index + 1, message: error.message });
      }
    }
    return { successCount, failedCount, errors };
  }
}
