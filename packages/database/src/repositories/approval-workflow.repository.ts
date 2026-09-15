import { prisma, ApprovalWorkflow, Prisma } from '../client/index';

export class ApprovalWorkflowRepository {
  async findAll(): Promise<ApprovalWorkflow[]> {
    return prisma.approvalWorkflow.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<ApprovalWorkflow | null> {
    return prisma.approvalWorkflow.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async findWithSteps(id: string): Promise<ApprovalWorkflow | null> {
    return prisma.approvalWorkflow.findFirst({
      where: { id, deletedAt: null },
      include: {
        steps: {
          where: { deletedAt: null },
          orderBy: { stepOrder: 'asc' },
          include: { requiredRole: true }
        }
      }
    });
  }

  async create(data: Prisma.ApprovalWorkflowCreateInput | Prisma.ApprovalWorkflowUncheckedCreateInput): Promise<ApprovalWorkflow> {
    return prisma.approvalWorkflow.create({ data });
  }

  async update(id: string, data: Prisma.ApprovalWorkflowUpdateInput | Prisma.ApprovalWorkflowUncheckedUpdateInput): Promise<ApprovalWorkflow> {
    return prisma.approvalWorkflow.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<ApprovalWorkflow> {
    return prisma.approvalWorkflow.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
