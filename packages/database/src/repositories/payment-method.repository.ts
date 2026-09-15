import { prisma, PaymentMethod, Prisma } from '../client/index';

export class PaymentMethodRepository {
  async findAll(): Promise<PaymentMethod[]> {
    return prisma.paymentMethod.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string): Promise<PaymentMethod | null> {
    return prisma.paymentMethod.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.PaymentMethodCreateInput): Promise<PaymentMethod> {
    return prisma.paymentMethod.create({ data });
  }

  async update(id: string, data: Prisma.PaymentMethodUpdateInput): Promise<PaymentMethod> {
    return prisma.paymentMethod.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<PaymentMethod> {
    return prisma.paymentMethod.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
