import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateSupplierDto } from './dto/create-suppliers.dto';
import { UpdateSupplierDto } from './dto/update-suppliers.dto';

@Injectable()
export class SupplierService {
  
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
        { name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }, { contactPerson: { contains: search, mode: 'insensitive' } }, { gst: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supplier.count({ where })
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
    return prisma.supplier.findUnique({ where: { id } });
  }

  async create(data: CreateSupplierDto, userId: string): Promise<any> {
    try {
      return await prisma.supplier.create({
        data: data as any,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          success: false,
          errorCode: 'DUPLICATE_SUPPLIER',
          message: 'Supplier with this unique field already exists.'
        });
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateSupplierDto, userId: string): Promise<any> {
    try {
      return await prisma.supplier.update({
        where: { id },
        data: data as any,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          success: false,
          errorCode: 'DUPLICATE_SUPPLIER',
          message: 'Supplier with this unique field already exists.'
        });
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        isActive: false
      }
    });
  }

  async importBulk(items: CreateSupplierDto[], userId: string): Promise<any> {
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const [index, item] of items.entries()) {
      try {
        await prisma.supplier.create({
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
