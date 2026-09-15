import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateReasonMasterDto } from './dto/create-reason-masters.dto';
import { UpdateReasonMasterDto } from './dto/update-reason-masters.dto';

@Injectable()
export class ReasonMasterService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { type: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.reasonMaster.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.reasonMaster.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<any> {
    return prisma.reasonMaster.findUnique({ where: { id } });
  }

  async create(data: CreateReasonMasterDto, userId: string): Promise<any> {
    try { return await prisma.reasonMaster.create({ data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_REASONMASTER', message: 'ReasonMaster already exists.' });
      throw error;
    }
  }

  async update(id: string, data: UpdateReasonMasterDto, userId: string): Promise<any> {
    try { return await prisma.reasonMaster.update({ where: { id }, data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_REASONMASTER', message: 'ReasonMaster already exists.' });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.reasonMaster.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: userId, isActive: false } });
  }
}
