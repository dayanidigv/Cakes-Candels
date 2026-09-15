import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflows.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflows.dto';
import { CreateApprovalStepDto } from './dto/create-approval-step.dto';
import { UpdateApprovalStepDto } from './dto/update-approval-step.dto';

@Injectable()
export class ApprovalWorkflowService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { moduleName: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.approvalWorkflow.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.approvalWorkflow.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<any> {
    return prisma.approvalWorkflow.findUnique({
      where: { id },
      include: { steps: { where: { deletedAt: null }, orderBy: { stepOrder: 'asc' } } }
    });
  }

  async create(data: CreateApprovalWorkflowDto, userId: string): Promise<any> {
    try { return await prisma.approvalWorkflow.create({ data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_APPROVALWORKFLOW', message: 'ApprovalWorkflow already exists.' });
      throw error;
    }
  }

  async update(id: string, data: UpdateApprovalWorkflowDto, userId: string): Promise<any> {
    try { return await prisma.approvalWorkflow.update({ where: { id }, data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_APPROVALWORKFLOW', message: 'ApprovalWorkflow already exists.' });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.approvalWorkflow.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: userId, isActive: false } });
  }

  // Nested CRUD for ApprovalStep
  async addStep(workflowId: string, data: CreateApprovalStepDto, userId: string): Promise<any> {
    return prisma.$transaction(async (tx) => {
      const workflow = await tx.approvalWorkflow.findFirst({
        where: { id: workflowId, deletedAt: null }
      });
      if (!workflow) {
        throw new ConflictException({ success: false, errorCode: 'APPROVAL_WORKFLOW_NOT_FOUND', message: 'Workflow not found or deleted.' });
      }
      if (workflow.isActive) {
        throw new ConflictException({ success: false, errorCode: 'APPROVAL_WORKFLOW_ACTIVE', message: 'Cannot modify an active workflow.' });
      }

      const role = await tx.role.findFirst({ where: { id: data.requiredRoleId, isActive: true } });
      if (!role) {
        throw new ConflictException({ success: false, errorCode: 'APPROVAL_ROLE_NOT_FOUND', message: 'Required role not found.' });
      }

      const existingStep = await tx.approvalStep.findFirst({
        where: { workflowId, stepOrder: data.stepOrder, deletedAt: null }
      });
      if (existingStep) {
        throw new ConflictException({ success: false, errorCode: 'DUPLICATE_APPROVAL_STEP_ORDER', message: 'Step order already exists in this workflow.' });
      }

      return tx.approvalStep.create({
        data: {
          ...data,
          workflowId,
        } as any
      });
    });
  }

  async updateStep(workflowId: string, stepId: string, data: UpdateApprovalStepDto, userId: string): Promise<any> {
    return prisma.$transaction(async (tx) => {
      const workflow = await tx.approvalWorkflow.findFirst({
        where: { id: workflowId, deletedAt: null }
      });
      if (!workflow) {
        throw new ConflictException({ success: false, errorCode: 'APPROVAL_WORKFLOW_NOT_FOUND', message: 'Workflow not found or deleted.' });
      }
      if (workflow.isActive) {
        throw new ConflictException({ success: false, errorCode: 'APPROVAL_WORKFLOW_ACTIVE', message: 'Cannot modify an active workflow.' });
      }

      if (data.requiredRoleId) {
        const role = await tx.role.findFirst({ where: { id: data.requiredRoleId, isActive: true } });
        if (!role) {
          throw new ConflictException({ success: false, errorCode: 'APPROVAL_ROLE_NOT_FOUND', message: 'Required role not found.' });
        }
      }

      if (data.stepOrder) {
        const existingStep = await tx.approvalStep.findFirst({
          where: { workflowId, stepOrder: data.stepOrder, id: { not: stepId }, deletedAt: null }
        });
        if (existingStep) {
          throw new ConflictException({ success: false, errorCode: 'DUPLICATE_APPROVAL_STEP_ORDER', message: 'Step order already exists in this workflow.' });
        }
      }

      return tx.approvalStep.update({
        where: { id: stepId },
        data: data as any
      });
    });
  }

  async removeStep(workflowId: string, stepId: string, userId: string): Promise<any> {
    const workflow = await prisma.approvalWorkflow.findFirst({ where: { id: workflowId, deletedAt: null } });
    if (!workflow || workflow.isActive) {
      throw new ConflictException({ success: false, errorCode: 'APPROVAL_WORKFLOW_ACTIVE', message: 'Cannot modify an active workflow.' });
    }
    return prisma.approvalStep.update({
      where: { id: stepId },
      data: { deletedAt: new Date(), deletedBy: userId, isActive: false }
    });
  }
}
