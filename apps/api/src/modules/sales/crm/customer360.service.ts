import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';

export interface ScopeOptions {
  userBranchId?: string;
  scope?: 'GLOBAL' | 'FACTORY' | 'BRANCH';
}

@Injectable()
export class Customer360Service {
  async getCustomer360(customerId: string, scopeOptions?: ScopeOptions) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        addresses: true,
        segmentMappings: {
          include: { segment: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Enforce Tenant / Branch Isolation
    if (
      scopeOptions?.scope === 'BRANCH' &&
      scopeOptions?.userBranchId &&
      customer.assignedBranchId &&
      customer.assignedBranchId !== scopeOptions.userBranchId
    ) {
      throw new ForbiddenException('Access denied: Customer belongs to another branch');
    }

    // Parallel fetch of Customer 360 components
    const [salesOrders, customCakes, loyaltyTransactions, activities, loyaltyLedgerBalance] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          grandTotal: true,
          createdAt: true,
        },
      }),
      prisma.customCakeOrder.findMany({
        where: { salesOrder: { customerId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          flavour: true,
          weight: true,
          status: true,
          quoteAmount: true,
          scheduledAt: true,
          readyPhotoUrl: true,
        },
      }),
      prisma.loyaltyTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.crmActivity.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.loyaltyTransaction.aggregate({
        where: { customerId },
        _sum: { points: true },
      }),
    ]);

    const totalOrdersCount = salesOrders.length;
    const ledgerBalance = loyaltyLedgerBalance._sum.points || 0;

    return {
      profile: {
        id: customer.id,
        phone: customer.phone,
        fullName: customer.fullName,
        email: customer.email,
        birthday: customer.birthday,
        anniversary: customer.anniversary,
        customerType: customer.customerType,
        loyaltyPoints: customer.loyaltyPoints,
        ledgerPointsBalance: ledgerBalance,
        assignedBranchId: customer.assignedBranchId,
        createdAt: customer.createdAt,
      },
      addresses: customer.addresses,
      intelligence: {
        healthStatus: customer.healthStatus,
        healthScore: customer.healthScore,
        rfm: {
          recency: customer.rfmRecency,
          frequency: customer.rfmFrequency,
          monetary: customer.rfmMonetary,
          segment: customer.rfmSegment,
        },
        lifetimeValue: customer.lifetimeValue,
        lastOrderAt: customer.lastOrderAt,
        totalOrdersCount,
      },
      segments: customer.segmentMappings.map((sm) => ({
        id: sm.segment.id,
        code: sm.segment.code,
        name: sm.segment.name,
        assignedAt: sm.assignedAt,
      })),
      recentSalesOrders: salesOrders,
      customCakes: customCakes,
      loyaltyLedger: loyaltyTransactions,
      activityTimeline: activities,
    };
  }

  async logActivity(customerId: string, dto: { activityType: string; subject: string; description?: string; outcome?: string; performedBy?: string }) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const activity = await prisma.crmActivity.create({
      data: {
        customerId,
        activityType: dto.activityType,
        subject: dto.subject,
        description: dto.description,
        outcome: dto.outcome,
        performedBy: dto.performedBy,
      },
    });

    await prisma.customer.update({
      where: { id: customerId },
      data: { lastActivityAt: new Date() },
    });

    return activity;
  }

  async searchCustomers(options: { search?: string; healthStatus?: string; rfmSegment?: string; scopeOptions?: ScopeOptions; page?: number; limit?: number }) {
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options.scopeOptions?.scope === 'BRANCH' && options.scopeOptions?.userBranchId) {
      where.assignedBranchId = options.scopeOptions.userBranchId;
    }

    if (options.search) {
      where.OR = [
        { fullName: { contains: options.search, mode: 'insensitive' } },
        { phone: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options.healthStatus) {
      where.healthStatus = options.healthStatus;
    }

    if (options.rfmSegment) {
      where.rfmSegment = options.rfmSegment;
    }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          segmentMappings: {
            include: { segment: true },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items: items.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        email: c.email,
        customerType: c.customerType,
        loyaltyPoints: c.loyaltyPoints,
        healthStatus: c.healthStatus,
        healthScore: c.healthScore,
        rfmSegment: c.rfmSegment,
        lifetimeValue: Number(c.lifetimeValue || 0),
        lastOrderAt: c.lastOrderAt,
        createdAt: c.createdAt,
        segments: c.segmentMappings.map((sm) => sm.segment.code),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDashboardStats(scopeOptions?: ScopeOptions) {
    const where: any = {};
    if (scopeOptions?.scope === 'BRANCH' && scopeOptions?.userBranchId) {
      where.assignedBranchId = scopeOptions.userBranchId;
    }

    const [totalCustomers, healthyCount, atRiskCount, dormantCount, championsCount, aggregateClv, aggregateLoyalty, recentActivities] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.count({ where: { ...where, healthStatus: 'HEALTHY' } }),
      prisma.customer.count({ where: { ...where, healthStatus: 'AT_RISK' } }),
      prisma.customer.count({ where: { ...where, healthStatus: 'DORMANT' } }),
      prisma.customer.count({ where: { ...where, rfmSegment: 'CHAMPIONS' } }),
      prisma.customer.aggregate({
        where,
        _sum: { lifetimeValue: true },
      }),
      prisma.customer.aggregate({
        where,
        _sum: { loyaltyPoints: true },
      }),
      prisma.crmActivity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { customer: true },
      }),
    ]);

    return {
      totalCustomers,
      healthyCount,
      atRiskCount,
      dormantCount,
      championsCount,
      totalClv: Number(aggregateClv._sum.lifetimeValue || 0),
      totalLoyaltyPoints: aggregateLoyalty._sum.loyaltyPoints || 0,
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        customerName: a.customer.fullName,
        activityType: a.activityType,
        subject: a.subject,
        createdAt: a.createdAt,
      })),
    };
  }
}
