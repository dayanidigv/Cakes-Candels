import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreatePaymentMethodDto } from './dto/create-payment-methods.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-methods.dto';

@Injectable()
export class PaymentMethodService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.paymentMethod.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.paymentMethod.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<any> {
    return prisma.paymentMethod.findUnique({ where: { id } });
  }

  async create(data: CreatePaymentMethodDto, userId: string): Promise<any> {
    try { return await prisma.paymentMethod.create({ data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_PAYMENTMETHOD', message: 'PaymentMethod already exists.' });
      throw error;
    }
  }

  async update(id: string, data: UpdatePaymentMethodDto, userId: string): Promise<any> {
    try { return await prisma.paymentMethod.update({ where: { id }, data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_PAYMENTMETHOD', message: 'PaymentMethod already exists.' });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.paymentMethod.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: userId, isActive: false } });
  }
}
