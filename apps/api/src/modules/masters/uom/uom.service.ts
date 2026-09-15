import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateUomDto } from './dto/create-uom.dto';
import { UpdateUomDto } from './dto/update-uom.dto';

@Injectable()
export class UomService {
  
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
        { name: { contains: search, mode: 'insensitive' } }, { symbol: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.unitOfMeasure.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.unitOfMeasure.count({ where })
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
    return prisma.unitOfMeasure.findUnique({ where: { id } });
  }

  async create(data: CreateUomDto, userId: string): Promise<any> {
    try {
      return await prisma.unitOfMeasure.create({
        data: data as any,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          success: false,
          errorCode: 'DUPLICATE_UOM',
          message: 'Uom with this unique field already exists.'
        });
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateUomDto, userId: string): Promise<any> {
    try {
      return await prisma.unitOfMeasure.update({
        where: { id },
        data: data as any,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          success: false,
          errorCode: 'DUPLICATE_UOM',
          message: 'Uom with this unique field already exists.'
        });
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.unitOfMeasure.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        isActive: false
      }
    });
  }

  /**
   * Convert a quantity from one UOM to another.
   * All conversions traverse the UOM hierarchy (from → base → to).
   * This is the single authoritative converter — never do UOM math in frontend.
   *
   * @example convert(new Decimal(1), kgId, gramId) → Decimal(1000)
   */
  async convert(quantity: Decimal, fromUomId: string, toUomId: string): Promise<Decimal> {
    if (fromUomId === toUomId) return quantity;

    const [fromUom, toUom] = await Promise.all([
      prisma.unitOfMeasure.findUnique({ where: { id: fromUomId }, include: { baseUnit: true } }),
      prisma.unitOfMeasure.findUnique({ where: { id: toUomId }, include: { baseUnit: true } }),
    ]);

    if (!fromUom) throw new NotFoundException(`Source UOM not found: ${fromUomId}`);
    if (!toUom) throw new NotFoundException(`Target UOM not found: ${toUomId}`);

    // Case 1: fromUom → base, and toUom IS that base
    if (fromUom.baseUnitId === toUomId && fromUom.conversionFactor) {
      return quantity.mul(fromUom.conversionFactor);
    }

    // Case 2: they share the same base (e.g. g → base = kg ← from ml/base = L: incompatible)
    if (fromUom.baseUnitId && fromUom.baseUnitId === toUom.baseUnitId) {
      if (!fromUom.conversionFactor || !toUom.conversionFactor) {
        throw new BadRequestException('Conversion factors are not configured for these UOMs');
      }
      // fromQty * fromFactor / toFactor = resultInToUnit
      return quantity.mul(fromUom.conversionFactor).div(toUom.conversionFactor);
    }

    // Case 3: toUom → base, and fromUom IS that base
    if (toUom.baseUnitId === fromUomId && toUom.conversionFactor) {
      return quantity.div(toUom.conversionFactor);
    }

    throw new BadRequestException(
      `Cannot convert between UOMs: ${fromUom.name} → ${toUom.name}. They are not in the same conversion family.`
    );
  }

  async importBulk(items: CreateUomDto[], userId: string): Promise<any> {
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const [index, item] of items.entries()) {
      try {
        await prisma.unitOfMeasure.create({
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
