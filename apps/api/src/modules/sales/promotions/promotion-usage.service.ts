import { Injectable, BadRequestException } from '@nestjs/common';
import { PromotionUsageStatus } from '@cc-erp/database';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PromotionUsageService {
  
  /**
   * Authoritatively reserves a promotion inside a transaction.
   * This is a concurrency-safe method that uses row-level locking.
   */
  async reserveUsage(
    tx: Prisma.TransactionClient, 
    promotionId: string, 
    customerId: string | undefined, 
    salesOrderId: string,
    discountAmount: number
  ): Promise<void> {
    // 0. Idempotency Check
    const existingUsage = await tx.promotionUsage.findFirst({
      where: { promotionId, salesOrderId }
    });

    if (existingUsage) {
      if (existingUsage.status === PromotionUsageStatus.RESERVED) {
        return; // Idempotent: already reserved
      }
      throw new BadRequestException(`Promotion usage for this order is already in state: ${existingUsage.status}`);
    }

    // 1. Acquire Lock for the specific promotion
    await tx.$executeRaw`SELECT id FROM promotion WHERE id = ${promotionId}::uuid FOR UPDATE`;
    
    // 2. Load Promotion rules
    const promotion = await tx.promotion.findUnique({ where: { id: promotionId } });
    
    if (!promotion) {
      throw new BadRequestException('PROMOTION_NOT_FOUND');
    }
    
    if (!promotion.isActive) {
      throw new BadRequestException('PROMOTION_INACTIVE');
    }

    const now = new Date();
    if (promotion.startAt && now < promotion.startAt) {
      throw new BadRequestException('PROMOTION_NOT_STARTED');
    }
    if (promotion.endAt && now > promotion.endAt) {
      throw new BadRequestException('PROMOTION_EXPIRED');
    }

    // 3. Re-check Global Limits under lock
    if (promotion.usageLimit !== null) {
      const globalUsage = await tx.promotionUsage.count({
        where: { promotionId, status: { in: [PromotionUsageStatus.RESERVED, PromotionUsageStatus.CONSUMED] } }
      });
      if (globalUsage >= promotion.usageLimit) {
        throw new BadRequestException('PROMOTION_USAGE_LIMIT_REACHED');
      }
    }
    
    // 4. Re-check Customer Limits under lock
    if (promotion.perCustomerLimit !== null) {
      if (!customerId) {
        throw new BadRequestException('CUSTOMER_REQUIRED');
      }
      const customerUsage = await tx.promotionUsage.count({
        where: { promotionId, customerId, status: { in: [PromotionUsageStatus.RESERVED, PromotionUsageStatus.CONSUMED] } }
      });
      if (customerUsage >= promotion.perCustomerLimit) {
        throw new BadRequestException('PROMOTION_CUSTOMER_LIMIT_REACHED');
      }
    }
    
    // 5. Create Usage (Status = RESERVED)
    await tx.promotionUsage.create({
      data: {
        promotionId,
        customerId: customerId || null,
        salesOrderId,
        status: PromotionUsageStatus.RESERVED,
        discountAmount: new Decimal(discountAmount)
      }
    });
  }

  /**
   * Transitions a RESERVED usage to CONSUMED.
   * Triggered when payment succeeds.
   */
  async consumeUsage(tx: Prisma.TransactionClient, salesOrderId: string): Promise<void> {
    const usages = await tx.promotionUsage.findMany({ where: { salesOrderId } });
    for (const usage of usages) {
      if (usage.status === PromotionUsageStatus.RESERVED) {
        await tx.promotionUsage.update({
          where: { id: usage.id },
          data: { status: PromotionUsageStatus.CONSUMED }
        });
      }
    }
  }

  /**
   * Transitions a RESERVED usage to RELEASED.
   * Triggered when an order is cancelled or refunded before consumption.
   */
  async releaseUsage(tx: Prisma.TransactionClient, salesOrderId: string): Promise<void> {
    const usages = await tx.promotionUsage.findMany({ where: { salesOrderId } });
    for (const usage of usages) {
      if (usage.status === PromotionUsageStatus.RESERVED || usage.status === PromotionUsageStatus.CONSUMED) {
        await tx.promotionUsage.update({
          where: { id: usage.id },
          data: { status: PromotionUsageStatus.RELEASED }
        });
      }
    }
  }

  /**
   * Transitions a RESERVED usage to CANCELLED.
   * Triggered when a reservation naturally expires (e.g. checkout timeout).
   */
  async cancelUsage(tx: Prisma.TransactionClient, salesOrderId: string): Promise<void> {
    const usages = await tx.promotionUsage.findMany({ where: { salesOrderId } });
    for (const usage of usages) {
      if (usage.status === PromotionUsageStatus.RESERVED) {
        await tx.promotionUsage.update({
          where: { id: usage.id },
          data: { status: PromotionUsageStatus.CANCELLED }
        });
      }
    }
  }
}
