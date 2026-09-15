import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { Prisma } from '@prisma/client';

// Loyalty transaction types — canonical constants used across all call sites
export const LOYALTY_TYPE = {
  EARN: 'EARN',
  REDEEM: 'REDEEM',
  EXPIRE: 'EXPIRE',
  REVERSAL: 'REVERSAL',
  ADJUST: 'ADJUST',
} as const;

export type LoyaltyType = (typeof LOYALTY_TYPE)[keyof typeof LOYALTY_TYPE];

@Injectable()
export class CrmService {

  // ─── CUSTOMER PROFILE ─────────────────────────────────────────────────────

  async getCustomerByPhone(phone: string) {
    const customer = await prisma.customer.findUnique({
      where: { phone },
      include: {
        addresses: true,
        salesOrders: {
          where: { status: { in: ['CONFIRMED', 'DELIVERED', 'COMPLETED'] } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: true },
        },
      },
    });
    if (!customer) throw new NotFoundException(`Customer with phone ${phone} not found`);

    const totalSpend = await this.calculateTotalSpend(customer.id);
    const loyaltyPoints = await this.getLoyaltyBalance(customer.id);
    const segment = this.computeSegment(totalSpend);

    return { ...customer, totalSpend, loyaltyPoints, segment };
  }

  async getAllCustomers(search?: string) {
    const customers = await prisma.customer.findMany({
      where: search
        ? {
            isActive: true,
            OR: [
              { phone: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      customers.map(async (c) => {
        const totalSpend = await this.calculateTotalSpend(c.id);
        const loyaltyPoints = await this.getLoyaltyBalance(c.id);
        return { ...c, totalSpend, loyaltyPoints, segment: this.computeSegment(totalSpend) };
      }),
    );
  }

  /**
   * Calculates total spend from confirmed/delivered/completed orders using
   * the correct SalesOrder field: grandTotal.
   */
  private async calculateTotalSpend(customerId: string): Promise<number> {
    const result = await prisma.salesOrder.aggregate({
      where: {
        customerId,
        status: { in: ['CONFIRMED', 'DELIVERED', 'COMPLETED'] },
      },
      _sum: { grandTotal: true },
    });
    return Number(result._sum.grandTotal ?? 0);
  }

  /**
   * Returns ledger-based loyalty balance using the canonical EARN/REDEEM types.
   * Sums all positive-point and negative-point entries from the ledger.
   */
  async getLoyaltyBalance(customerId: string): Promise<number> {
    const result = await prisma.loyaltyTransaction.aggregate({
      where: { customerId },
      _sum: { points: true },
    }).catch(() => ({ _sum: { points: 0 } }));

    return Number(result._sum.points ?? 0);
  }

  private computeSegment(totalSpend: number): string {
    if (totalSpend >= 30000) return 'VIP';
    if (totalSpend >= 15000) return 'GOLD';
    if (totalSpend >= 5000) return 'SILVER';
    return 'BRONZE';
  }

  async awardLoyaltyPoints(customerId: string, orderId: string, orderTotal: number) {
    const points = Math.floor(orderTotal / 10); // ₹10 = 1 point
    if (points <= 0) return { points: 0 };

    try {
      const loyaltyTx = await prisma.loyaltyTransaction.create({
        data: {
          customerId,
          orderId,
          type: LOYALTY_TYPE.EARN,    // canonical constant — was 'EARNED' (wrong)
          points,
          notes: `Earned ${points} points for order ${orderId}`,
        },
      });

      await prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { increment: points } },
      });

      return { points, loyaltyTx };
    } catch {
      return { points };
    }
  }

  // ─── BIRTHDAY / ANNIVERSARY ALERTS ────────────────────────────────────────

  async getTodaysBirthdayCustomers() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const customers = await prisma.customer.findMany({
      where: { isActive: true, birthday: { not: null } },
      select: { id: true, fullName: true, phone: true, email: true, birthday: true },
    });

    return customers.filter((c) => {
      if (!c.birthday) return false;
      const bd = new Date(c.birthday);
      return bd.getMonth() + 1 === month && bd.getDate() === day;
    });
  }

  async getTodaysAnniversaryCustomers() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const customers = await prisma.customer.findMany({
      where: { isActive: true, anniversary: { not: null } },
      select: { id: true, fullName: true, phone: true, email: true, anniversary: true },
    });

    return customers.filter((c) => {
      if (!c.anniversary) return false;
      const an = new Date(c.anniversary);
      return an.getMonth() + 1 === month && an.getDate() === day;
    });
  }

  // ─── CAMPAIGNS ──────────────────────────────────────────────────────────────

  async createCampaign(data: {
    name: string;
    channel: string;
    templateContent: string;
    segmentFilter?: string;
  }) {
    // TODO[Phase 4]: Replace with real NotificationQueue insert when outbox dispatcher is implemented
    const campaign = {
      id: `CAMP-${Date.now()}`,
      ...data,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      scheduledAt: null,
      sentCount: 0,
    };
    return campaign;
  }

  async getCampaigns() {
    // TODO[Phase 4]: Replace with real CRM campaign model query
    return [
      { id: 'CAMP-001', name: 'June Birthday Blast', channel: 'WHATSAPP', status: 'SENT', sentCount: 45, createdAt: '2026-06-01T10:00:00Z' },
      { id: 'CAMP-002', name: 'Festive Offer - VIP', channel: 'WHATSAPP', status: 'SENT', sentCount: 12, createdAt: '2026-07-14T10:00:00Z' },
      { id: 'CAMP-003', name: 'New Product Launch', channel: 'SMS', status: 'QUEUED', sentCount: 0, createdAt: '2026-08-01T10:00:00Z' },
    ];
  }

  // ─── SEGMENT CONFIGURATION ─────────────────────────────────────────────────

  getSegments() {
    return [
      { code: 'BRONZE', displayName: 'Bronze', minSpend: 0, pointsMultiplier: 1.0, benefits: 'Default tier. Standard promotions.' },
      { code: 'SILVER', displayName: 'Silver', minSpend: 5000, pointsMultiplier: 1.2, benefits: 'Free delivery on orders > ₹1,000.' },
      { code: 'GOLD', displayName: 'Gold', minSpend: 15000, pointsMultiplier: 1.5, benefits: 'Free delivery. Priority custom cake slots.' },
      { code: 'VIP', displayName: 'VIP', minSpend: 30000, pointsMultiplier: 2.0, benefits: 'Free delivery on any order. Direct chef consult.' },
    ];
  }
}
