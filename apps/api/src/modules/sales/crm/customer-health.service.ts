import { Injectable } from '@nestjs/common';
import { prisma } from '@cc-erp/database';

@Injectable()
export class CustomerHealthService {
  /**
   * Recalculates health score (0–100) and health status for a customer.
   */
  async recalculateHealthScore(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        salesOrders: {
          where: { status: { in: ['CONFIRMED', 'PROCESSING', 'READY', 'DISPATCHED', 'DELIVERED', 'COMPLETED'] } },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          where: { activityType: 'COMPLAINT' },
        },
        returnRequests: true,
      },
    });

    if (!customer) return null;

    let score = 100;

    // 1. Recency penalty
    if (customer.salesOrders.length > 0) {
      const daysSinceLastOrder = Math.floor((Date.now() - new Date(customer.salesOrders[0].createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastOrder > 180) {
        score -= 50;
      } else if (daysSinceLastOrder > 90) {
        score -= 30;
      } else if (daysSinceLastOrder > 45) {
        score -= 15;
      }
    } else {
      score -= 40; // No order history
    }

    // 2. Complaint penalty (-15 points per complaint)
    const complaintCount = customer.activities.length;
    score -= complaintCount * 15;

    // 3. Return penalty (-10 points per return request)
    const returnCount = customer.returnRequests.length;
    score -= returnCount * 10;

    // 4. Repeat purchase boost (+15 points if 3+ orders)
    if (customer.salesOrders.length >= 3) {
      score += 15;
    }

    // Bound score between 0 and 100
    const finalScore = Math.max(0, Math.min(100, score));

    // Map health status
    const healthStatus =
      finalScore >= 80 ? 'HEALTHY' :
      finalScore >= 50 ? 'AT_RISK' :
      finalScore >= 20 ? 'DORMANT' : 'CHURNED';

    return prisma.customer.update({
      where: { id: customerId },
      data: {
        healthScore: finalScore,
        healthStatus,
      },
    });
  }
}
