import { Injectable, BadRequestException } from '@nestjs/common';
import { PromotionsRepository } from './promotions.repository';
import { PromotionValidationResult } from './promotion-validation.result';
import { PromotionUsageStatus } from '@cc-erp/database';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface PromotionValidationContext {
  promotionCode: string;
  customerId?: string;
  branchId: string;
  subtotal: Decimal;
  items: { 
    variantId: string; 
    quantity: number; 
    productId: string; 
    categoryId?: string; 
  }[];
}

@Injectable()
export class PromotionValidationService {
  constructor(private readonly promotionsRepo: PromotionsRepository) {}

  async validate(context: PromotionValidationContext): Promise<PromotionValidationResult> {
    const promotion = await this.promotionsRepo.findByCode(context.promotionCode);

    // 1. Existence
    if (!promotion) {
      return { valid: false, reasonCode: 'PROMOTION_NOT_FOUND', message: 'Promotion does not exist.' };
    }

    // 2. Active
    if (!promotion.isActive) {
      return { valid: false, reasonCode: 'PROMOTION_INACTIVE', message: 'Promotion is currently inactive.' };
    }

    // 3. Date rules (UTC)
    const now = new Date();
    if (promotion.startAt && now < promotion.startAt) {
      return { valid: false, reasonCode: 'PROMOTION_NOT_STARTED', message: 'Promotion has not started yet.' };
    }
    if (promotion.endAt && now > promotion.endAt) {
      return { valid: false, reasonCode: 'PROMOTION_EXPIRED', message: 'Promotion has expired.' };
    }

    // 4. Branch Eligibility
    if (promotion.applicableBranchId && promotion.applicableBranchId !== context.branchId) {
      return { valid: false, reasonCode: 'PROMOTION_NOT_APPLICABLE_TO_BRANCH', message: 'Promotion not valid at this branch.' };
    }

    // 5. Product & Category Eligibility (AND condition)
    let isProductEligible = true;
    let isCategoryEligible = true;

    if (promotion.applicableProductId || promotion.applicableCategoryId) {
      const eligibleItems = context.items.filter(item => {
        let matchesProduct = true;
        let matchesCategory = true;
        
        if (promotion.applicableProductId) {
          matchesProduct = item.productId === promotion.applicableProductId;
        }
        if (promotion.applicableCategoryId) {
          matchesCategory = item.categoryId === promotion.applicableCategoryId;
        }

        // AND Condition as explicitly required by business rules
        return matchesProduct && matchesCategory;
      });

      if (eligibleItems.length === 0) {
        if (promotion.applicableProductId && promotion.applicableCategoryId) {
          return { valid: false, reasonCode: 'PROMOTION_NOT_APPLICABLE_TO_PRODUCT_AND_CATEGORY', message: 'Cart must contain items matching BOTH required product and category.' };
        } else if (promotion.applicableProductId) {
          return { valid: false, reasonCode: 'PROMOTION_NOT_APPLICABLE_TO_PRODUCT', message: 'Promotion requires a specific product.' };
        } else {
          return { valid: false, reasonCode: 'PROMOTION_NOT_APPLICABLE_TO_CATEGORY', message: 'Promotion requires a specific category.' };
        }
      }
    }

    // 6. Minimum Order Value
    if (promotion.minimumOrderValue && context.subtotal.lt(promotion.minimumOrderValue)) {
      return { valid: false, reasonCode: 'MINIMUM_ORDER_VALUE_NOT_MET', message: 'Subtotal does not meet minimum order requirement.' };
    }

    // 7. Global Usage Limit
    if (promotion.usageLimit !== null) {
      const globalUsage = await this.promotionsRepo.countGlobalUsage(promotion.id, [PromotionUsageStatus.RESERVED, PromotionUsageStatus.CONSUMED]);
      if (globalUsage >= promotion.usageLimit) {
        return { valid: false, reasonCode: 'PROMOTION_USAGE_LIMIT_REACHED', message: 'Global usage limit reached.' };
      }
    }

    // 8. Per-Customer Limit
    if (promotion.perCustomerLimit !== null) {
      if (!context.customerId) {
        return { valid: false, reasonCode: 'CUSTOMER_REQUIRED', message: 'Customer ID is required for this promotion.' };
      }
      const customerUsage = await this.promotionsRepo.countCustomerUsage(promotion.id, context.customerId, [PromotionUsageStatus.RESERVED, PromotionUsageStatus.CONSUMED]);
      if (customerUsage >= promotion.perCustomerLimit) {
        return { valid: false, reasonCode: 'PROMOTION_CUSTOMER_LIMIT_REACHED', message: 'Customer usage limit reached.' };
      }
    }

    // 9. Discount Configuration
    let calculatedDiscountAmount = new Decimal(0);
    const value = promotion.value;

    if (value.lt(0)) {
      return { valid: false, reasonCode: 'INVALID_PROMOTION_CONFIGURATION', message: 'Discount value cannot be negative.' };
    }

    if (promotion.type === 'PERCENTAGE') {
      if (value.gt(100)) {
        return { valid: false, reasonCode: 'INVALID_PROMOTION_CONFIGURATION', message: 'Percentage discount cannot exceed 100.' };
      }
      // Discount applies to ENTIRE CART as explicitly required by business rules
      calculatedDiscountAmount = context.subtotal.mul(value).div(100);
    } else if (promotion.type === 'FLAT') {
      calculatedDiscountAmount = value;
    } else {
      return { valid: false, reasonCode: 'INVALID_PROMOTION_CONFIGURATION', message: 'Unknown discount type.' };
    }

    // Apply cap
    if (promotion.maximumDiscount && calculatedDiscountAmount.gt(promotion.maximumDiscount)) {
      calculatedDiscountAmount = promotion.maximumDiscount;
    }
    
    // Final check against subtotal
    if (calculatedDiscountAmount.gt(context.subtotal)) {
      calculatedDiscountAmount = context.subtotal;
    }

    return {
      valid: true,
      promotionId: promotion.id,
      code: promotion.code,
      discountType: promotion.type,
      discountValue: value.toNumber(),
      maximumDiscount: promotion.maximumDiscount ? promotion.maximumDiscount.toNumber() : undefined,
      calculatedDiscountAmount: calculatedDiscountAmount.toNumber()
    };
  }


}
