import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateDesignationDto } from './dto/create-designations.dto';
import { UpdateDesignationDto } from './dto/update-designations.dto';

@Injectable()
export class DesignationService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } }, { department: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.designation.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.designation.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<any> {
    return prisma.designation.findUnique({ where: { id } });
  }

  async create(data: CreateDesignationDto, userId: string): Promise<any> {
    try { return await prisma.designation.create({ data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_DESIGNATION', message: 'Designation already exists.' });
      throw error;
    }
  }

  async update(id: string, data: UpdateDesignationDto, userId: string): Promise<any> {
    try { return await prisma.designation.update({ where: { id }, data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_DESIGNATION', message: 'Designation already exists.' });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.designation.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: userId, isActive: false } });
  }
}
