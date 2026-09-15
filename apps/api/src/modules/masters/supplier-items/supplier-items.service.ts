import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateSupplierItemDto } from './dto/create-supplier-items.dto';
import { UpdateSupplierItemDto } from './dto/update-supplier-items.dto';

@Injectable()
export class SupplierItemService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { itemCode: { contains: search, mode: 'insensitive' } }, { itemName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.supplierItem.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.supplierItem.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<any> {
    return prisma.supplierItem.findUnique({ where: { id } });
  }

  async create(data: CreateSupplierItemDto, userId: string): Promise<any> {
    const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, deletedAt: null } });
    if (!supplier) {
      throw new ConflictException({ success: false, errorCode: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found.' });
    }
    if (data.purchasePrice < 0) {
      throw new ConflictException({ success: false, errorCode: 'INVALID_PURCHASE_PRICE', message: 'Purchase price cannot be negative.' });
    }
    if (data.leadTimeDays < 0) {
      throw new ConflictException({ success: false, errorCode: 'INVALID_LEAD_TIME', message: 'Lead time cannot be negative.' });
    }
    if (data.moq < 0) {
      throw new ConflictException({ success: false, errorCode: 'INVALID_MOQ', message: 'MOQ cannot be negative.' });
    }

    try { return await prisma.supplierItem.create({ data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_SUPPLIER_ITEM', message: 'SupplierItem with this code already exists for this supplier.' });
      throw error;
    }
  }

  async update(id: string, data: UpdateSupplierItemDto, userId: string): Promise<any> {
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, deletedAt: null } });
      if (!supplier) throw new ConflictException({ success: false, errorCode: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found.' });
    }
    if (data.purchasePrice !== undefined && data.purchasePrice < 0) {
      throw new ConflictException({ success: false, errorCode: 'INVALID_PURCHASE_PRICE', message: 'Purchase price cannot be negative.' });
    }
    if (data.leadTimeDays !== undefined && data.leadTimeDays < 0) {
      throw new ConflictException({ success: false, errorCode: 'INVALID_LEAD_TIME', message: 'Lead time cannot be negative.' });
    }
    if (data.moq !== undefined && data.moq < 0) {
      throw new ConflictException({ success: false, errorCode: 'INVALID_MOQ', message: 'MOQ cannot be negative.' });
    }

    try { return await prisma.supplierItem.update({ where: { id }, data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_SUPPLIER_ITEM', message: 'SupplierItem with this code already exists for this supplier.' });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.supplierItem.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: userId, isActive: false } });
  }
}
