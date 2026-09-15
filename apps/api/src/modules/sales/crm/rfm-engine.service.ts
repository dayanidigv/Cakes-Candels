import { Injectable } from '@nestjs/common';
import { prisma } from '@cc-erp/database';

@Injectable()
export class RfmEngineService {
  /**
   * Recalculates RFM scores (1–5) and RFM segment for a given customer.
   */
  async recalculateRfmForCustomer(customerId: string) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return null;

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const orders = await prisma.salesOrder.findMany({
      where: {
        customerId,
        status: { in: ['CONFIRMED', 'PROCESSING', 'READY', 'DISPATCHED', 'DELIVERED', 'COMPLETED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (orders.length === 0) {
      return prisma.customer.update({
        where: { id: customerId },
        data: {
          rfmRecency: 1,
          rfmFrequency: 1,
          rfmMonetary: 1,
          rfmSegment: 'LOST',
        },
      });
    }

    const lastOrder = orders[0];
    const daysSinceLastOrder = Math.floor((Date.now() - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    // Recency Score (1-5): smaller days = higher score
    const rScore =
      daysSinceLastOrder <= 7 ? 5 :
      daysSinceLastOrder <= 30 ? 4 :
      daysSinceLastOrder <= 90 ? 3 :
      daysSinceLastOrder <= 180 ? 2 : 1;

    // Frequency Score (1-5): order count in past year
    const recentOrders = orders.filter((o) => new Date(o.createdAt) >= oneYearAgo);
    const orderCount = recentOrders.length;

    const fScore =
      orderCount >= 10 ? 5 :
      orderCount >= 5 ? 4 :
      orderCount >= 3 ? 3 :
      orderCount >= 2 ? 2 : 1;

    // Monetary Score (1-5): total spend in past year
    const totalSpend = recentOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);

    const mScore =
      totalSpend >= 25000 ? 5 :
      totalSpend >= 10000 ? 4 :
      totalSpend >= 5000 ? 3 :
      totalSpend >= 2000 ? 2 : 1;

    // Derive RFM Segment
    const rfmSegment = this.deriveRfmSegment(rScore, fScore, mScore);

    return prisma.customer.update({
      where: { id: customerId },
      data: {
        rfmRecency: rScore,
        rfmFrequency: fScore,
        rfmMonetary: mScore,
        rfmSegment,
        lastOrderAt: lastOrder.createdAt,
      },
    });
  }

  private deriveRfmSegment(r: number, f: number, m: number): string {
    if (r >= 4 && f >= 4 && m >= 4) return 'CHAMPIONS';
    if (r >= 3 && f >= 3) return 'LOYAL_CUSTOMERS';
    if (r >= 4 && f <= 2) return 'RECENT_CUSTOMERS';
    if (r >= 3 && f <= 2) return 'POTENTIAL_LOYALISTS';
    if (r <= 2 && f >= 3 && m >= 3) return 'AT_RISK';
    if (r <= 1 && f >= 4) return 'CANNOT_LOSE_THEM';
    if (r <= 2 && f <= 2) return 'HIBERNATING';
    return 'LOST';
  }
}
