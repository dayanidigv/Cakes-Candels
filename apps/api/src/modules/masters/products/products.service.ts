import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateProductDto, ProductType } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {

  async create(orgId: string, createProductDto: CreateProductDto) {
    if (createProductDto.type === ProductType.STANDARD && !createProductDto.sku) {
      throw new BadRequestException('SKU is required for STANDARD products');
    }
    
    if (createProductDto.variants.length === 0) {
      throw new BadRequestException('Product must have at least one variant');
    }

    // Check SKU Uniqueness
    const skus = createProductDto.variants.map(v => v.sku);
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException('Duplicate SKUs in variants list');
    }

    const existingSkus = await prisma.productVariant.findMany({
      where: { sku: { in: skus } }
    });

    if (existingSkus.length > 0) {
      throw new BadRequestException(`SKUs already exist: ${existingSkus.map(s => s.sku).join(', ')}`);
    }
    
    // Check Pricing Invariants
    for (const v of createProductDto.variants) {
      if (v.sellingPrice < v.costPrice) {
        throw new BadRequestException(`Selling price cannot be less than cost price for SKU ${v.sku}`);
      }
      if (v.sellingPrice > v.mrp) {
        throw new BadRequestException(`Selling price cannot be greater than MRP for SKU ${v.sku}`);
      }
    }

    // Wrap in Transaction
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          organizationId: orgId,
          type: createProductDto.type,
          sku: createProductDto.type === ProductType.STANDARD ? createProductDto.sku : null,
          name: createProductDto.name,
          description: createProductDto.description,
          categoryId: createProductDto.categoryId,
          brandId: createProductDto.brandId,
          taxRuleId: createProductDto.taxRuleId,
          uomId: createProductDto.uomId,
          isPerishable: createProductDto.isPerishable ?? true,
          shelfLifeDays: createProductDto.shelfLifeDays,
        }
      });

      for (const variantDto of createProductDto.variants) {
        const variant = await tx.productVariant.create({
          data: {
            organizationId: product.organizationId,
            productId: product.id,
            sku: variantDto.sku,
            barcode: variantDto.barcode,
            name: variantDto.name,
            reorderLevel: variantDto.reorderLevel,
          }
        });

        await tx.productPricing.create({
          data: {
            variantId: variant.id,
            costPrice: variantDto.costPrice,
            mrp: variantDto.mrp,
            sellingPrice: variantDto.sellingPrice,
          }
        });
      }

      return this.findOne(product.id);
    });
  }

  async findAll() {
    return prisma.product.findMany({
      include: {
        category: true,
        brand: true,
        baseUom: true,
        variants: {
          include: {
            pricing: true
          }
        }
      }
    });
  }

  async findOne(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        taxRule: true,
        baseUom: true,
        variants: {
          include: {
            pricing: true,
            attributeValues: {
              include: {
                attributeValue: {
                  include: { attribute: true }
                }
              }
            }
          }
        }
      }
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto, userId: string) {
    // Basic update for base product details only, variant/pricing updates should be handled separately
    await this.findOne(id);

    return prisma.product.update({
      where: { id },
      data: {
        name: updateProductDto.name,
        description: updateProductDto.description,
        isActive: updateProductDto.isActive,
      }
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    return prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        deletedBy: userId,
      }
    });
  }
}
