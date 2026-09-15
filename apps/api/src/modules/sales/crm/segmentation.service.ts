import { Injectable } from '@nestjs/common';
import { prisma } from '@cc-erp/database';

@Injectable()
export class SegmentationService {
  private readonly defaultSegments = [
    { code: 'VIP', name: 'VIP Customer', description: 'Lifetime Value > ₹50,000 or Champions RFM' },
    { code: 'HIGH_VALUE', name: 'High Value Customer', description: 'Lifetime Value > ₹20,000' },
    { code: 'NEW', name: 'New Customer', description: 'Total orders <= 1' },
    { code: 'REPEAT', name: 'Repeat Customer', description: 'Total orders > 1' },
    { code: 'BIRTHDAY_OPPORTUNITY', name: 'Birthday Opportunity', description: 'Birthday in next 14 days' },
    { code: 'INACTIVE', name: 'Inactive Customer', description: 'No orders in last 90 days' },
    { code: 'AT_RISK', name: 'At-Risk Customer', description: 'Health score < 50 or At Risk RFM' },
    { code: 'CUSTOM_CAKE_CUSTOMER', name: 'Custom Cake Customer', description: 'Has custom cake order history' },
    { code: 'CORPORATE', name: 'Corporate Customer', description: 'Corporate account tag' },
  ];

  async initDefaultSegments() {
    for (const seg of this.defaultSegments) {
      await prisma.crmSegment.upsert({
        where: { code: seg.code },
        update: { name: seg.name, description: seg.description },
        create: { code: seg.code, name: seg.name, description: seg.description },
      });
    }
  }

  /**
   * Evaluates customer metrics and updates segment mappings dynamically.
   */
  async evaluateSegmentsForCustomer(customerId: string) {
    await this.initDefaultSegments();

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        salesOrders: true,
        segmentMappings: true,
      },
    });

    if (!customer) return null;

    const customCakes = await prisma.customCakeOrder.findMany({
      where: { salesOrder: { customerId } },
    });

    const ltv = Number(customer.lifetimeValue);
    const orderCount = customer.salesOrders.length;
    const targetCodes: string[] = [];

    // VIP Rule
    if (ltv >= 50000 || customer.rfmSegment === 'CHAMPIONS') {
      targetCodes.push('VIP');
    }

    // High Value Rule
    if (ltv >= 20000) {
      targetCodes.push('HIGH_VALUE');
    }

    // New vs Repeat
    if (orderCount <= 1) {
      targetCodes.push('NEW');
    } else {
      targetCodes.push('REPEAT');
    }

    // Custom Cake Customer Rule
    if (customCakes.length > 0) {
      targetCodes.push('CUSTOM_CAKE_CUSTOMER');
    }

    // Corporate Rule
    if (customer.customerType === 'CORPORATE') {
      targetCodes.push('CORPORATE');
    }

    // At Risk Rule
    if (customer.healthStatus === 'AT_RISK' || customer.rfmSegment === 'AT_RISK') {
      targetCodes.push('AT_RISK');
    }

    // Inactive Rule
    if (customer.healthStatus === 'DORMANT' || customer.healthStatus === 'CHURNED') {
      targetCodes.push('INACTIVE');
    }

    // Birthday Opportunity Rule
    if (customer.birthday) {
      const now = new Date();
      const bdayThisYear = new Date(now.getFullYear(), customer.birthday.getMonth(), customer.birthday.getDate());
      const diffDays = (bdayThisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 14) {
        targetCodes.push('BIRTHDAY_OPPORTUNITY');
      }
    }

    // Sync Segment Mappings
    const segments = await prisma.crmSegment.findMany({
      where: { code: { in: targetCodes } },
    });

    // Remove old mappings not in target
    const targetSegmentIds = segments.map((s) => s.id);
    await prisma.customerSegmentMapping.deleteMany({
      where: {
        customerId,
        segmentId: { notIn: targetSegmentIds },
      },
    });

    // Upsert target mappings
    for (const segment of segments) {
      await prisma.customerSegmentMapping.upsert({
        where: {
          customerId_segmentId: {
            customerId,
            segmentId: segment.id,
          },
        },
        update: {},
        create: {
          customerId,
          segmentId: segment.id,
        },
      });
    }

    return targetCodes;
  }
}
