import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma as rawPrisma } from '@cc-erp/database';
const prisma = rawPrisma as any;

export type CakeStatus = 'BOOKED' | 'APPROVED' | 'BAKING' | 'DECORATING' | 'QC' | 'READY' | 'DELIVERED' | 'CANCELLED';

const STATUS_FLOW: CakeStatus[] = ['BOOKED', 'APPROVED', 'BAKING', 'DECORATING', 'QC', 'READY', 'DELIVERED'];

// Business Rules from FRS:
// 1 Layer -> min 1.0 kg
// 2 Layer -> min 1.5 kg
// 3 Layer -> min 3.0 kg
// Delivery must be > 24hrs in future
const LAYER_MIN_WEIGHT: Record<string, number> = {
  '1': 1.0,
  '2': 1.5,
  '3': 3.0,
};

@Injectable()
export class CustomCakesService {

  async create(data: {
    customerName: string;
    mobileNumber: string;
    branchId: string;
    flavor: string;
    shape?: string;
    cakeType: string; // '1', '2', '3' layers
    weightKg: number;
    eggless: boolean;
    creamType?: string;
    specialInstructions?: string;
    designImageUrl?: string;
    deliveryDatetime: string;
    deliveryType: 'PICKUP' | 'DELIVERY';
    advancePayment: number;
    createdBy: string;
  }) {
    // ─── Business Rule Validations ─────────────────────────────────────────────
    const minWeight = LAYER_MIN_WEIGHT[data.cakeType] ?? 1.0;
    if (data.weightKg < minWeight) {
      throw new BadRequestException(
        `Minimum weight for ${data.cakeType}-layer cake is ${minWeight} kg. Provided: ${data.weightKg} kg`
      );
    }

    const deliveryDate = new Date(data.deliveryDatetime);
    const now = new Date();
    const hoursAhead = (deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursAhead < 24) {
      throw new BadRequestException('Delivery date must be at least 24 hours in the future');
    }

    if (data.weightKg > 25) {
      throw new BadRequestException('Maximum cake weight is 25 kg');
    }

    // Find/create customer
    let customer = await prisma.customer.findUnique({ where: { phone: data.mobileNumber } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { phone: data.mobileNumber, fullName: data.customerName },
      });
    }

    // Generate order number
    const orderCount = await prisma.customCakeOrder.count();
    const orderNumber = `CCO-${String(orderCount + 1).padStart(5, '0')}`;

    return prisma.customCakeOrder.create({
      data: {
        orderNumber,
        customerId: customer.id,
        branchId: data.branchId,
        flavor: data.flavor,
        shape: data.shape,
        cakeType: data.cakeType,
        weightKg: data.weightKg,
        eggless: data.eggless,
        creamType: data.creamType,
        specialInstructions: data.specialInstructions,
        designImageUrl: data.designImageUrl,
        deliveryDatetime: deliveryDate,
        deliveryType: data.deliveryType,
        advancePayment: data.advancePayment,
        status: 'BOOKED',
        createdById: data.createdBy,
      },
      include: { customer: true, branch: true },
    });
  }

  async findAll(status?: string, branchId?: string) {
    return prisma.customCakeOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(branchId ? { branchId } : {}),
        status: { not: 'CANCELLED' },
      },
      include: {
        customer: true,
        branch: { select: { id: true, name: true } },
        assignedChef: { select: { id: true, name: true } },
      },
      orderBy: { deliveryDatetime: 'asc' },
    });
  }

  async findOne(id: string) {
    const order = await prisma.customCakeOrder.findUnique({
      where: { id },
      include: { customer: true, branch: true, assignedChef: { select: { id: true, name: true } } },
    });
    if (!order) throw new NotFoundException('Custom cake order not found');
    return order;
  }

  async advanceStatus(id: string, chefNotes?: string) {
    const order = await this.findOne(id);
    const currentIndex = STATUS_FLOW.indexOf(order.status as CakeStatus);
    if (currentIndex === -1 || currentIndex >= STATUS_FLOW.length - 1) {
      throw new BadRequestException('Order is already in final state');
    }
    const nextStatus = STATUS_FLOW[currentIndex + 1];

    return prisma.customCakeOrder.update({
      where: { id },
      data: {
        status: nextStatus,
        chefNotes: chefNotes ?? order.chefNotes,
        ...(nextStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
      include: { customer: true, branch: true },
    });
  }

  async assignChef(id: string, chefId: string) {
    await this.findOne(id);
    return prisma.customCakeOrder.update({
      where: { id },
      data: { assignedChefId: chefId },
    });
  }

  async cancel(id: string, reason: string) {
    const order = await this.findOne(id);
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Cannot cancel a delivered or already-cancelled order');
    }
    return prisma.customCakeOrder.update({
      where: { id },
      data: { status: 'CANCELLED', cancellationReason: reason },
    });
  }

  async getPipelineSummary() {
    const counts = await prisma.customCakeOrder.groupBy({
      by: ['status'],
      _count: true,
      where: { status: { not: 'CANCELLED' } },
    });
    return counts.reduce((acc, c) => ({ ...acc, [c.status]: c._count }), {} as Record<string, number>);
  }
}
