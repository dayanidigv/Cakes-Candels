import { prisma, TaxRule, Prisma } from '../client/index';

export class TaxRuleRepository {
  async findAll(): Promise<TaxRule[]> {
    return prisma.taxRule.findMany({
      where: { deletedAt: null },
      orderBy: { rate: 'asc' }
    });
  }

  async findById(id: string): Promise<TaxRule | null> {
    return prisma.taxRule.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.TaxRuleCreateInput): Promise<TaxRule> {
    return prisma.taxRule.create({ data });
  }

  async update(id: string, data: Prisma.TaxRuleUpdateInput): Promise<TaxRule> {
    return prisma.taxRule.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<TaxRule> {
    return prisma.taxRule.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
