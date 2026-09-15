import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateProductAttributeDto } from './dto/create-product-attributes.dto';
import { UpdateProductAttributeDto } from './dto/update-product-attributes.dto';
import { CreateProductAttributeValueDto } from './dto/create-product-attribute-value.dto';
import { UpdateProductAttributeValueDto } from './dto/update-product-attribute-value.dto';

@Injectable()
export class ProductAttributeService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } }, { type: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.productAttribute.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.productAttribute.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<any> {
    return prisma.productAttribute.findUnique({ 
      where: { id },
      include: { values: { where: { deletedAt: null } } }
    });
  }

  async create(data: CreateProductAttributeDto, userId: string): Promise<any> {
    try { return await prisma.productAttribute.create({ data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_PRODUCTATTRIBUTE', message: 'ProductAttribute already exists.' });
      throw error;
    }
  }

  async update(id: string, data: UpdateProductAttributeDto, userId: string): Promise<any> {
    try { return await prisma.productAttribute.update({ where: { id }, data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_PRODUCTATTRIBUTE', message: 'ProductAttribute already exists.' });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.productAttribute.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: userId, isActive: false } });
  }

  // Nested CRUD for ProductAttributeValue
  async addValue(attributeId: string, data: CreateProductAttributeValueDto, userId: string): Promise<any> {
    const attribute = await prisma.productAttribute.findFirst({ where: { id: attributeId, deletedAt: null, isActive: true } });
    if (!attribute) {
      throw new ConflictException({ success: false, errorCode: 'ATTRIBUTE_NOT_FOUND', message: 'Attribute not found or inactive.' });
    }

    try {
      return await prisma.productAttributeValue.create({
        data: {
          ...data,
          attributeId,
        } as any
      });
    } catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_ATTRIBUTE_VALUE', message: 'Value already exists for this attribute.' });
      throw error;
    }
  }

  async updateValue(attributeId: string, valueId: string, data: UpdateProductAttributeValueDto, userId: string): Promise<any> {
    const attribute = await prisma.productAttribute.findFirst({ where: { id: attributeId, deletedAt: null, isActive: true } });
    if (!attribute) {
      throw new ConflictException({ success: false, errorCode: 'ATTRIBUTE_NOT_FOUND', message: 'Attribute not found or inactive.' });
    }

    try {
      return await prisma.productAttributeValue.update({
        where: { id: valueId },
        data: data as any
      });
    } catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_ATTRIBUTE_VALUE', message: 'Value already exists for this attribute.' });
      throw error;
    }
  }

  async removeValue(attributeId: string, valueId: string, userId: string): Promise<any> {
    return prisma.productAttributeValue.update({
      where: { id: valueId },
      data: { deletedAt: new Date(), deletedBy: userId, isActive: false }
    });
  }
}
