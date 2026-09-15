import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma, CustomCakeStatus } from '@cc-erp/database';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';

export interface CreateCustomCakeQuoteDto {
  customerId: string;
  branchId: string;
  flavour: string;
  weight: number;
  shape?: string;
  layers?: number;
  filling?: string;
  icing?: string;
  decorationNotes?: string;
  messageOnCake?: string;
  designImages?: string[];
  scheduledAt: Date;
  quoteAmount: number;
  advancePercentage?: number; // e.g. 50% advance
  specialInstructions?: string;
}

export interface QcGateDto {
  customCakeOrderId: string;
  readyPhotoUrl: string;
  qcNotes?: string;
  approvedBy: string;
}

@Injectable()
export class CustomCakesService {
  private readonly allowedTransitions: Record<CustomCakeStatus, CustomCakeStatus[]> = {
    DRAFT: [CustomCakeStatus.QUOTED, CustomCakeStatus.CANCELLED],
    QUOTED: [CustomCakeStatus.ADVANCE_PENDING, CustomCakeStatus.CONFIRMED, CustomCakeStatus.REJECTED, CustomCakeStatus.CANCELLED],
    ADVANCE_PENDING: [CustomCakeStatus.CONFIRMED, CustomCakeStatus.CANCELLED],
    CONFIRMED: [CustomCakeStatus.SCHEDULED, CustomCakeStatus.CANCELLED],
    SCHEDULED: [CustomCakeStatus.IN_PRODUCTION, CustomCakeStatus.CANCELLED],
    IN_PRODUCTION: [CustomCakeStatus.BAKING, CustomCakeStatus.CANCELLED],
    BAKING: [CustomCakeStatus.ICING, CustomCakeStatus.CANCELLED],
    ICING: [CustomCakeStatus.DECORATION, CustomCakeStatus.CANCELLED],
    DECORATION: [CustomCakeStatus.QC, CustomCakeStatus.CANCELLED],
    QC: [CustomCakeStatus.READY, CustomCakeStatus.QC_FAILED, CustomCakeStatus.CANCELLED],
    READY: [CustomCakeStatus.DISPATCHED, CustomCakeStatus.CANCELLED],
    DISPATCHED: [CustomCakeStatus.DELIVERED, CustomCakeStatus.CANCELLED],
    DELIVERED: [CustomCakeStatus.COMPLETED],
    COMPLETED: [],
    CANCELLED: [],
    REJECTED: [],
    QC_FAILED: [CustomCakeStatus.DECORATION, CustomCakeStatus.CANCELLED],
  };

  async createQuote(userId: string, organizationId: string, dto: CreateCustomCakeQuoteDto) {
    const advancePercent = dto.advancePercentage || 50;
    const advanceAmt = (dto.quoteAmount * advancePercent) / 100;
    const balanceAmt = dto.quoteAmount - advanceAmt;

    return prisma.$transaction(async (tx) => {
      // 1. Create parent SalesOrder for commercial transaction
      const orderNumber = `SO-CC-${Date.now()}`;
      const salesOrder = await tx.salesOrder.create({
        data: {
          orderNumber,
          organizationId,
          customerId: dto.customerId,
          branchId: dto.branchId,
          subtotal: new Decimal(dto.quoteAmount),
          grandTotal: new Decimal(dto.quoteAmount),
          createdBy: userId,
          status: 'DRAFT',
        },
      });

      // 2. Create CustomCakeOrder domain entity
      const customCakeOrder = await tx.customCakeOrder.create({
        data: {
          salesOrderId: salesOrder.id,
          flavour: dto.flavour,
          weight: new Decimal(dto.weight),
          shape: dto.shape || 'ROUND',
          layers: dto.layers || 1,
          filling: dto.filling,
          icing: dto.icing,
          decorationNotes: dto.decorationNotes,
          messageOnCake: dto.messageOnCake,
          designImages: dto.designImages || [],
          scheduledAt: new Date(dto.scheduledAt),
          quoteAmount: new Decimal(dto.quoteAmount),
          advanceAmount: new Decimal(advanceAmt),
          balanceAmount: new Decimal(balanceAmt),
          status: CustomCakeStatus.QUOTED,
          specialInstructions: dto.specialInstructions,
        },
      });

      // 3. Emit Outbox Event
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'custom_cake.quoted',
            payload: {
              customCakeOrderId: customCakeOrder.id,
              salesOrderId: salesOrder.id,
              quoteAmount: dto.quoteAmount,
              advanceAmount: advanceAmt,
            },
            status: 'PENDING',
          },
        });
      }

      return customCakeOrder;
    });
  }

  async transitionStatus(customCakeOrderId: string, newStatus: CustomCakeStatus, idempotencyKey?: string, userId?: string) {
    if (idempotencyKey) {
      const existingRecord = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey } });
      if (existingRecord) {
        return prisma.customCakeOrder.findUnique({ where: { id: customCakeOrderId } });
      }
    }

    return prisma.$transaction(async (tx) => {
      const current = await tx.customCakeOrder.findUnique({ where: { id: customCakeOrderId } });
      if (!current) throw new NotFoundException('Custom cake order not found');

      const allowed = this.allowedTransitions[current.status];
      if (!allowed || !allowed.includes(newStatus)) {
        throw new BadRequestException(`Cannot transition custom cake order from ${current.status} to ${newStatus}`);
      }

      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: { idempotencyKey, requestPath: '/sales/custom-cakes/status' },
        }).catch(() => {});
      }

      const updateResult = await tx.customCakeOrder.updateMany({
        where: { id: customCakeOrderId, status: current.status },
        data: { status: newStatus },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException('Custom cake status conflict or already updated');
      }

      const updated = await tx.customCakeOrder.findUnique({ where: { id: customCakeOrderId } });

      // Outbox Event
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: `custom_cake.${newStatus.toLowerCase()}`,
            payload: {
              customCakeOrderId,
              previousStatus: current.status,
              newStatus,
            },
            status: 'PENDING',
          },
        });
      }

      return updated;
    });
  }

  async passQcGate(dto: QcGateDto) {
    return prisma.$transaction(async (tx) => {
      const updateResult = await tx.customCakeOrder.updateMany({
        where: {
          id: dto.customCakeOrderId,
          status: CustomCakeStatus.QC,
        },
        data: {
          status: CustomCakeStatus.READY,
          readyPhotoUrl: dto.readyPhotoUrl,
          qcNotes: dto.qcNotes,
          qcApprovedBy: dto.approvedBy,
          qcApprovedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(`Custom cake order ${dto.customCakeOrderId} is not in QC status or state conflict occurred`);
      }

      const updated = await tx.customCakeOrder.findUnique({ where: { id: dto.customCakeOrderId } });

      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'custom_cake.qc_passed',
            payload: {
              customCakeOrderId: dto.customCakeOrderId,
              readyPhotoUrl: dto.readyPhotoUrl,
              approvedBy: dto.approvedBy,
            },
            status: 'PENDING',
          },
        });
      }

      return updated!;
    });
  }
}
