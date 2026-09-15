import { Injectable } from '@nestjs/common';
import { prisma, Promotion, PromotionUsage, PromotionUsageStatus, Prisma } from '@cc-erp/database';

export interface PromotionPaginationOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

@Injectable()
export class PromotionsRepository {
  
  // ---------------------------------------------------------
  // Promotion CRUD
  // ---------------------------------------------------------

  async create(data: Prisma.PromotionCreateInput | Prisma.PromotionUncheckedCreateInput): Promise<Promotion> {
    return prisma.promotion.create({ data });
  }

  async findById(id: string): Promise<Promotion | null> {
    return prisma.promotion.findFirst({
      where: { id },
      include: {
        applicableBranch: true,
        applicableProduct: true,
        applicableCategory: true,
      }
    });
  }

  async findByCode(code: string): Promise<Promotion | null> {
    return prisma.promotion.findUnique({
      where: { code },
      include: {
        applicableBranch: true,
        applicableProduct: true,
        applicableCategory: true,
      }
    });
  }

  async findActiveByCode(code: string): Promise<Promotion | null> {
    return prisma.promotion.findFirst({
      where: { code, isActive: true },
      include: {
        applicableBranch: true,
        applicableProduct: true,
        applicableCategory: true,
      }
    });
  }

  async findMany(options: PromotionPaginationOptions = {}) {
    const { page = 1, pageSize = 10, search, isActive } = options;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PromotionWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          applicableBranch: true,
          applicableProduct: true,
          applicableCategory: true,
        }
      }),
      prisma.promotion.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async update(id: string, data: Prisma.PromotionUpdateInput | Prisma.PromotionUncheckedUpdateInput): Promise<Promotion> {
    return prisma.promotion.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<Promotion> {
    return prisma.promotion.update({
      where: { id },
      data: {
        isActive: false,
        // Promotion doesn't have deletedAt according to schema, so we just use isActive: false.
      }
    });
  }

  // ---------------------------------------------------------
  // PromotionUsage
  // ---------------------------------------------------------

  async createUsage(data: Prisma.PromotionUsageCreateInput | Prisma.PromotionUsageUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<PromotionUsage> {
    const client = tx || prisma;
    return client.promotionUsage.create({ data });
  }

  async findUsageById(id: string): Promise<PromotionUsage | null> {
    return prisma.promotionUsage.findUnique({
      where: { id }
    });
  }

  async findUsageByOrder(salesOrderId: string): Promise<PromotionUsage[]> {
    return prisma.promotionUsage.findMany({
      where: { salesOrderId }
    });
  }

  async findUsageByPromotionAndCustomer(promotionId: string, customerId: string): Promise<PromotionUsage[]> {
    return prisma.promotionUsage.findMany({
      where: { promotionId, customerId }
    });
  }

  async countCustomerUsage(promotionId: string, customerId: string, statuses?: PromotionUsageStatus[], tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx || prisma;
    return client.promotionUsage.count({
      where: { 
        promotionId, 
        customerId,
        ...(statuses && { status: { in: statuses } })
      }
    });
  }

  async countGlobalUsage(promotionId: string, statuses?: PromotionUsageStatus[], tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx || prisma;
    return client.promotionUsage.count({
      where: { 
        promotionId,
        ...(statuses && { status: { in: statuses } })
      }
    });
  }

  async updateUsageStatus(id: string, status: PromotionUsageStatus, tx?: Prisma.TransactionClient): Promise<PromotionUsage> {
    const client = tx || prisma;
    return client.promotionUsage.update({
      where: { id },
      data: { status }
    });
  }
}
