import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateNumberSeriesDto } from './dto/create-number-series.dto';
import { UpdateNumberSeriesDto } from './dto/update-number-series.dto';

@Injectable()
export class NumberSeriesService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { documentType: { contains: search, mode: 'insensitive' } }, { prefix: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.numberSeries.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.numberSeries.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<any> {
    return prisma.numberSeries.findUnique({ where: { id } });
  }

  async create(data: CreateNumberSeriesDto, userId: string): Promise<any> {
    try { return await prisma.numberSeries.create({ data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_NUMBERSERIES', message: 'NumberSeries already exists.' });
      throw error;
    }
  }

  async update(id: string, data: UpdateNumberSeriesDto, userId: string): Promise<any> {
    try { return await prisma.numberSeries.update({ where: { id }, data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_NUMBERSERIES', message: 'NumberSeries already exists.' });
      throw error;
    }
  }

  async generateNextNumber(documentType: string, branchId?: string): Promise<string> {
    // We must lock the row to prevent concurrent duplicate generation.
    // We use Prisma's interactive transaction for this.
    return prisma.$transaction(async (tx) => {
      // Find the specific series for branch, or fallback to global (branchId: null)
      let series = await tx.numberSeries.findFirst({
        where: {
          documentType,
          branchId: branchId || null,
          isActive: true,
          deletedAt: null
        }
      });

      // If branch specific not found, try global fallback
      if (!series && branchId) {
        series = await tx.numberSeries.findFirst({
          where: {
            documentType,
            branchId: null,
            isActive: true,
            deletedAt: null
          }
        });
      }

      if (!series) {
        throw new ConflictException({
          success: false,
          errorCode: 'NUMBER_SERIES_NOT_FOUND',
          message: `Active Number Series for ${documentType} not found.`
        });
      }

      // Atomically increment currentNumber
      const updatedSeries = await tx.numberSeries.update({
        where: { id: series.id },
        data: { currentNumber: { increment: 1 } }
      });

      // Format the number
      const paddedNumber = String(updatedSeries.currentNumber).padStart(updatedSeries.length, '0');
      const prefix = updatedSeries.prefix || '';
      const suffix = updatedSeries.suffix ? `-${updatedSeries.suffix}` : '';

      return `${prefix}${paddedNumber}${suffix}`;
    });
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.numberSeries.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: userId, isActive: false } });
  }
}
