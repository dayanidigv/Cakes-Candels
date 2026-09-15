import { Injectable } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CustomerClvService {
  /**
   * Calculates actual Customer Lifetime Value from commercial SalesOrders.
   */
  async recalculateClv(customerId: string) {
    const aggregate = await prisma.salesOrder.aggregate({
      where: {
        customerId,
        status: { in: ['CONFIRMED', 'PROCESSING', 'READY', 'DISPATCHED', 'DELIVERED', 'COMPLETED'] },
      },
      _sum: {
        grandTotal: true,
      },
      _count: {
        id: true,
      },
    });

    const totalSpend = aggregate._sum.grandTotal ? Number(aggregate._sum.grandTotal) : 0;
    const totalOrders = aggregate._count.id || 0;
    const averageOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        lifetimeValue: new Decimal(totalSpend),
      },
    });

    return {
      customerId,
      lifetimeValue: totalSpend,
      totalOrders,
      averageOrderValue,
      customer: updatedCustomer,
    };
  }
}
