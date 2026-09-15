import { prisma, ApprovalStep, Prisma } from '../client/index';

export class ApprovalStepRepository {
  async findAll(): Promise<ApprovalStep[]> {
    return prisma.approvalStep.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<ApprovalStep | null> {
    return prisma.approvalStep.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.ApprovalStepCreateInput | Prisma.ApprovalStepUncheckedCreateInput): Promise<ApprovalStep> {
    return prisma.approvalStep.create({ data });
  }

  async update(id: string, data: Prisma.ApprovalStepUpdateInput | Prisma.ApprovalStepUncheckedUpdateInput): Promise<ApprovalStep> {
    return prisma.approvalStep.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<ApprovalStep> {
    return prisma.approvalStep.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
