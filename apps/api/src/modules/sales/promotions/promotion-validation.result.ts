export interface PromotionValidationResult {
  valid: boolean;
  reasonCode?: string;
  message?: string;
  promotionId?: string;
  code?: string;
  discountType?: string;
  discountValue?: number; // Raw DB decimal converted to number for easy DTO return
  maximumDiscount?: number;
  calculatedDiscountAmount?: number; // Exact amount determined by the engine
}
