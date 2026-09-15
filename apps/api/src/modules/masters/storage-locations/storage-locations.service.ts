import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateStorageLocationDto } from './dto/create-storage-locations.dto';
import { UpdateStorageLocationDto } from './dto/update-storage-locations.dto';

@Injectable()
export class StorageLocationService {
  
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
        { name: { contains: search, mode: 'insensitive' } }, { locationCode: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.storageLocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.storageLocation.count({ where })
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
    return prisma.storageLocation.findUnique({ where: { id } });
  }

  async create(data: CreateStorageLocationDto, userId: string): Promise<any> {
    try {
      return await prisma.storageLocation.create({
        data: data as any,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          success: false,
          errorCode: 'DUPLICATE_STORAGELOCATION',
          message: 'StorageLocation with this unique field already exists.'
        });
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateStorageLocationDto, userId: string): Promise<any> {
    try {
      return await prisma.storageLocation.update({
        where: { id },
        data: data as any,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          success: false,
          errorCode: 'DUPLICATE_STORAGELOCATION',
          message: 'StorageLocation with this unique field already exists.'
        });
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.storageLocation.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        isActive: false
      }
    });
  }

  async importBulk(items: CreateStorageLocationDto[], userId: string): Promise<any> {
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const [index, item] of items.entries()) {
      try {
        await prisma.storageLocation.create({
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
