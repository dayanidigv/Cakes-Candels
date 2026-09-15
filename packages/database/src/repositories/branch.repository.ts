import { prisma, Branch, Prisma } from '../client/index';

export type BranchWithOrg = Prisma.BranchGetPayload<{
  include: { organization: true }
}>;

export class BranchRepository {
  async findAll(organizationId: string): Promise<BranchWithOrg[]> {
    return prisma.branch.findMany({
      where: { organizationId, deletedAt: null },
      include: { organization: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string, organizationId: string): Promise<BranchWithOrg | null> {
    return prisma.branch.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { organization: true }
    });
  }

  async create(data: Prisma.BranchUncheckedCreateInput): Promise<Branch> {
    return prisma.branch.create({ data });
  }

  async update(id: string, data: Prisma.BranchUncheckedUpdateInput): Promise<Branch> {
    return prisma.branch.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<Branch> {
    return prisma.branch.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    });
  }
}
