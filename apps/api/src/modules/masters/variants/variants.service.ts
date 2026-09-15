import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';

@Injectable()
export class VariantsService {

  async findAll(search?: string) {
    return prisma.productVariant.findMany({
      where: search ? {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ]
      } : undefined,
      include: {
        product: {
          include: {
            category: true,
            brand: true,
            baseUom: true
          }
        },
        pricing: true,
        attributeValues: {
          include: {
            attributeValue: {
              include: { attribute: true }
            }
          }
        }
      }
    });
  }

  async findOne(id: string) {
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
            baseUom: true,
            taxRule: true
          }
        },
        pricing: true,
        stockBalances: {
          include: { location: true }
        },
        attributeValues: {
          include: {
            attributeValue: {
              include: { attribute: true }
            }
          }
        }
      }
    });

    if (!variant) {
      throw new NotFoundException(`Variant with ID ${id} not found`);
    }

    return variant;
  }
}
