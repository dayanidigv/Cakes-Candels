import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PricingService {
  /**
   * Resolves server-side pricing for a set of line items.
   * All prices, taxes, and totals are determined exclusively by the database —
   * no client-supplied prices are trusted.
   */
  async resolveOrderPricing(
    branchId: string,
    items: { variantId: string; quantity: number }[],
    validatedDiscountAmount?: Decimal,
  ) {
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    let discountTotal = new Decimal(0);

    const resolvedItems = [];

    for (const item of items) {
      if (item.quantity <= 0) {
        throw new BadRequestException(`Quantity for variant ${item.variantId} must be positive.`);
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: {
          product: { include: { taxRule: true } },
          pricing: true,
        },
      });

      if (!variant) {
        throw new NotFoundException(`Variant ${item.variantId} not found.`);
      }

      if (!variant.pricing) {
        throw new BadRequestException(`Pricing not configured for variant ${item.variantId}. Please contact an administrator.`);
      }

      if (!variant.isActive) {
        throw new BadRequestException(`Variant ${item.variantId} is inactive and cannot be sold.`);
      }

      const unitPrice = variant.pricing.sellingPrice;
      const quantity = new Decimal(item.quantity);
      const lineSubtotal = unitPrice.mul(quantity);

      let lineTax = new Decimal(0);
      let taxRate = new Decimal(0);
      if (variant.product.taxRule) {
        taxRate = variant.product.taxRule.rate;
        lineTax = lineSubtotal.mul(taxRate).div(100);
      }

      const lineTotal = lineSubtotal.add(lineTax);

      subtotal = subtotal.add(lineSubtotal);
      taxTotal = taxTotal.add(lineTax);

      resolvedItems.push({
        variantId: item.variantId,
        productId: variant.product.id,
        categoryId: variant.product.categoryId,
        quantity: quantity,
        unitPrice: unitPrice,
        taxAmount: lineTax,
        discountAmount: new Decimal(0),
        lineTotal: lineTotal,
        pricingSnapshot: {
          basePrice: unitPrice.toNumber(),
          taxRate: taxRate.toNumber(),
          taxApplied: lineTax.toNumber(),
          variantSku: variant.sku,
          variantName: variant.name,
        },
      });
    }

    if (validatedDiscountAmount && validatedDiscountAmount.gt(0)) {
      discountTotal = validatedDiscountAmount;
    }

    const grandTotal = subtotal.add(taxTotal).sub(discountTotal);

    return {
      subtotal,
      taxTotal,
      discountTotal,
      grandTotal,
      resolvedItems,
    };
  }
}
