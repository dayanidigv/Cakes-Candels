import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { prisma, DispatchStatus } from '@cc-erp/database';
import { InventoryService } from '../inventory/inventory.service';
import { NumberSeriesService } from '../masters/number-series/number-series.service';
import * as crypto from 'crypto';
import { AuthorizationContext } from '../../common/interfaces/authorization-context.interface';

// Dispatch status flow — enforce forward-only state machine
const STATUS_FLOW: DispatchStatus[] = ['PACKED', 'DISPATCHED', 'ON_THE_WAY', 'REACHED_BRANCH', 'RECEIVED'];

/**
 * LogisticsService — manages factory-to-branch and inter-branch dispatch pipeline.
 *
 * ARCHITECTURE RULES:
 *  1. All inventory deductions/receipts go through InventoryService.postTransaction.
 *  2. StockBalance is NEVER manipulated directly via raw updateMany here.
 *  3. DispatchStatus is a forward-only state machine (no reversal except CANCELLED).
 *  4. All state transitions are atomic (prisma.$transaction).
 */
@Injectable()
export class LogisticsService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly numberSeriesService: NumberSeriesService,
  ) {}

  // ─── CREATE DISPATCH ─────────────────────────────────────────────────────────

  async createDispatch(
    data: {
      vehicleId?: string;
      driverUserId?: string;
      fromBranchId: string;
      toBranchId: string;
      expectedDeliveryAt?: string;
      items: Array<{
        variantId: string;
        quantityDispatched: number;
        batchId?: string;
      }>;
    },
    ctx: AuthorizationContext
  ) {
    if (data.items.length === 0) {
      throw new BadRequestException('A dispatch must have at least one item');
    }

    // Validate source branch
    const fromBranch = await prisma.branch.findUnique({ where: { id: data.fromBranchId } });
    if (!fromBranch) throw new NotFoundException('Source branch not found');

    const toBranch = await prisma.branch.findUnique({ where: { id: data.toBranchId } });
    if (!toBranch) throw new NotFoundException('Destination branch not found');

    if (data.fromBranchId === data.toBranchId) {
      throw new BadRequestException('Source and destination branches must be different');
    }

    if (fromBranch.organizationId !== ctx.organizationId || toBranch.organizationId !== ctx.organizationId) {
      throw new ForbiddenException('Source or destination branch does not belong to your organization');
    }

    if (ctx.scope === 'BRANCH' && ctx.branchId !== data.fromBranchId) {
      throw new ForbiddenException('Branch users can only create dispatches originating from their own branch');
    }

    // Validate vehicle if provided
    if (data.vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
      if (!vehicle.isActive) throw new BadRequestException('Vehicle is inactive or under maintenance');
    }

    // Idempotency check
    if (data.idempotencyKey) {
      const existing = await prisma.dispatch.findUnique({ where: { idempotencyKey: data.idempotencyKey }, include: { items: { include: { variant: { select: { name: true, sku: true } } } } } });
      if (existing) return existing;
    }

    // Generate gapless dispatch number safely before the main transaction
    const dispatchNumber = await this.numberSeriesService.generateNextNumber('DISPATCH', ctx.branchId);

    return prisma.$transaction(async (tx) => {
      const dispatch = await tx.dispatch.create({
        data: {
          dispatchNumber,
          idempotencyKey: data.idempotencyKey || null,
          organizationId: ctx.organizationId,
          vehicleId: data.vehicleId || null,
          driverUserId: data.driverUserId || null,
          fromBranchId: data.fromBranchId,
          toBranchId: data.toBranchId,
          status: 'PACKED',
          expectedDeliveryAt: data.expectedDeliveryAt ? new Date(data.expectedDeliveryAt) : null,
          createdById: ctx.userId,
          items: {
            create: data.items.map((item) => ({
              variantId: item.variantId,
              quantityDispatched: item.quantityDispatched,
              batchId: item.batchId || null,
            })),
          },
        },
        include: { items: true },
      });

      // Emit outbox event
      await tx.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          type: 'logistics.dispatch.created',
          payload: {
            dispatchId: dispatch.id,
            dispatchNumber,
            fromBranchId: data.fromBranchId,
            toBranchId: data.toBranchId,
            itemCount: data.items.length,
          },
          status: 'PENDING',
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'CREATE',
          entity: 'DISPATCH',
          entityId: dispatch.id,
          reason: 'Dispatch Created',
        },
      });

      return dispatch;
    });
  }

  // ─── EXPLICIT STATE TRANSITIONS ──────────────────────────────────────────────

  /**
   * Transition: PACKED -> DISPATCHED
   * Executes TRANSFER_OUT
   */
  async dispatchShipment(dispatchId: string, ctx: AuthorizationContext, notes?: string) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });
    if (!dispatch) throw new NotFoundException('Dispatch not found');
    if (dispatch.organizationId !== ctx.organizationId) throw new ForbiddenException('Access denied');
    if (ctx.scope === 'BRANCH' && ctx.branchId !== dispatch.fromBranchId) {
      throw new ForbiddenException('Only the source branch can dispatch this shipment');
    }
    if (dispatch.status !== 'PACKED') {
      throw new BadRequestException(`Cannot dispatch a shipment in ${dispatch.status} status`);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.dispatch.updateMany({
        where: { id: dispatchId, status: 'PACKED' },
        data: { status: 'DISPATCHED', dispatchedAt: new Date(), notes: notes || null },
      });
      if (updated.count === 0) throw new BadRequestException('Concurrent update error');

      // Execute TRANSFER_OUT
      for (const item of dispatch.items) {
        await this.inventoryService.postTransaction(
          {
            variantId: item.variantId,
            fromLocationId: dispatch.fromBranchId,
            quantity: Number(item.quantityDispatched),
            type: 'TRANSFER_OUT' as any,
            referenceId: dispatch.id,
            referenceType: 'DISPATCH',
            batchId: item.batchId || undefined,
            notes: `Dispatch ${dispatch.dispatchNumber} — outbound`,
          },
          ctx.userId,
          tx,
        );
      }

      await tx.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          type: 'logistics.dispatch.dispatched',
          payload: { dispatchId, dispatchNumber: dispatch.dispatchNumber },
          status: 'PENDING',
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'UPDATE',
          entity: 'DISPATCH',
          entityId: dispatchId,
          reason: 'Status changed to DISPATCHED',
        },
      });

      return tx.dispatch.findUnique({ where: { id: dispatchId }, include: { items: { include: { variant: { select: { name: true, sku: true } } } } } });
    });
  }

  /**
   * Transition: DISPATCHED -> ON_THE_WAY
   */
  async markInTransit(dispatchId: string, ctx: AuthorizationContext, notes?: string) {
    const dispatch = await prisma.dispatch.findUnique({ where: { id: dispatchId } });
    if (!dispatch) throw new NotFoundException('Dispatch not found');
    if (dispatch.organizationId !== ctx.organizationId) throw new ForbiddenException('Access denied');
    if (ctx.scope === 'BRANCH' && ctx.branchId !== dispatch.fromBranchId && ctx.branchId !== dispatch.toBranchId) {
      throw new ForbiddenException('Branch not involved in dispatch');
    }
    if (dispatch.status !== 'DISPATCHED') throw new BadRequestException(`Cannot mark in transit from ${dispatch.status}`);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.dispatch.updateMany({
        where: { id: dispatchId, status: 'DISPATCHED' },
        data: { status: 'ON_THE_WAY', notes: notes || null },
      });
      if (updated.count === 0) throw new BadRequestException('Concurrent update error');

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'UPDATE',
          entity: 'DISPATCH',
          entityId: dispatchId,
          reason: 'Status changed to ON_THE_WAY',
        },
      });

      return tx.dispatch.findUnique({ where: { id: dispatchId } });
    });
  }

  /**
   * Transition: ON_THE_WAY -> REACHED_BRANCH
   */
  async markArrived(dispatchId: string, ctx: AuthorizationContext, notes?: string) {
    const dispatch = await prisma.dispatch.findUnique({ where: { id: dispatchId } });
    if (!dispatch) throw new NotFoundException('Dispatch not found');
    if (dispatch.organizationId !== ctx.organizationId) throw new ForbiddenException('Access denied');
    if (ctx.scope === 'BRANCH' && ctx.branchId !== dispatch.toBranchId) {
      throw new ForbiddenException('Only the destination branch can mark arrived');
    }
    if (dispatch.status !== 'ON_THE_WAY' && dispatch.status !== 'DISPATCHED') {
      throw new BadRequestException(`Cannot mark arrived from ${dispatch.status}`);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.dispatch.updateMany({
        where: { id: dispatchId, status: dispatch.status },
        data: { status: 'REACHED_BRANCH', notes: notes || null },
      });
      if (updated.count === 0) throw new BadRequestException('Concurrent update error');

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'UPDATE',
          entity: 'DISPATCH',
          entityId: dispatchId,
          reason: 'Status changed to REACHED_BRANCH',
        },
      });

      return tx.dispatch.findUnique({ where: { id: dispatchId } });
    });
  }

  /**
   * Transition: REACHED_BRANCH -> RECEIVED
   * Executes TRANSFER_IN
   */
  async receiveDispatch(
    dispatchId: string,
    ctx: AuthorizationContext,
    receivedItems: Array<{ itemId: string; quantityReceived: number; damageNotes?: string }>,
  ) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });
    if (!dispatch) throw new NotFoundException('Dispatch not found');
    if (dispatch.organizationId !== ctx.organizationId) throw new ForbiddenException('Access denied');
    if (ctx.scope === 'BRANCH' && ctx.branchId !== dispatch.toBranchId) {
      throw new ForbiddenException('Only the destination branch can receive this dispatch');
    }
    if (dispatch.status !== 'REACHED_BRANCH') {
      throw new BadRequestException(`Dispatch must be REACHED_BRANCH to be received. Current: ${dispatch.status}`);
    }

    return prisma.$transaction(async (tx) => {
      // 1. Mark Items
      for (const ri of receivedItems) {
        const dispatchItem = dispatch.items.find((i) => i.id === ri.itemId);
        if (!dispatchItem) throw new NotFoundException(`Item ${ri.itemId} not found`);
        if (ri.quantityReceived < 0) throw new BadRequestException('Quantity cannot be negative');
        if (ri.quantityReceived > Number(dispatchItem.quantityDispatched)) {
          throw new BadRequestException('Cannot receive more than dispatched');
        }

        await tx.dispatchItem.update({
          where: { id: ri.itemId },
          data: { quantityReceived: ri.quantityReceived, damageNotes: ri.damageNotes || null },
        });
      }

      // 2. Mark Dispatch RECEIVED
      const updated = await tx.dispatch.updateMany({
        where: { id: dispatchId, status: 'REACHED_BRANCH' },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
      if (updated.count === 0) throw new BadRequestException('Concurrent update error');

      // 3. Execute TRANSFER_IN
      for (const item of dispatch.items) {
        const ri = receivedItems.find((r) => r.itemId === item.id);
        const qtyToReceive = ri ? ri.quantityReceived : Number(item.quantityDispatched);

        if (qtyToReceive > 0) {
          await this.inventoryService.postTransaction(
            {
              variantId: item.variantId,
              toLocationId: dispatch.toBranchId,
              quantity: qtyToReceive,
              type: 'TRANSFER_IN' as any,
              referenceId: dispatch.id,
              referenceType: 'DISPATCH',
              batchId: item.batchId || undefined,
              notes: `Dispatch ${dispatch.dispatchNumber} — inbound`,
            },
            ctx.userId,
            tx,
          );
        }
      }

      await tx.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          type: 'logistics.dispatch.received',
          payload: { dispatchId, dispatchNumber: dispatch.dispatchNumber },
          status: 'PENDING',
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'UPDATE',
          entity: 'DISPATCH',
          entityId: dispatchId,
          reason: 'Status changed to RECEIVED (Items transferred in)',
        },
      });

      return tx.dispatch.findUnique({ where: { id: dispatchId }, include: { items: { include: { variant: { select: { name: true, sku: true } } } } } });
    });
  }

  // ─── CANCEL DISPATCH ─────────────────────────────────────────────────────────

  async cancelDispatch(dispatchId: string, reason: string, ctx: AuthorizationContext) {
    const dispatch = await prisma.dispatch.findUnique({ where: { id: dispatchId } });
    if (!dispatch) throw new NotFoundException('Dispatch not found');
    if (dispatch.organizationId !== ctx.organizationId) {
      throw new ForbiddenException('You do not have access to this dispatch');
    }
    if (ctx.scope === 'BRANCH' && ctx.branchId !== dispatch.fromBranchId) {
      throw new ForbiddenException('Only the source branch or an admin can cancel a dispatch');
    }

    if (['REACHED_BRANCH', 'RECEIVED'].includes(dispatch.status)) {
      throw new BadRequestException(`Cannot cancel a dispatch that is already ${dispatch.status}`);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.dispatch.update({
        where: { id: dispatchId },
        data: {
          status: 'CANCELLED',
          notes: `CANCELLED: ${reason}`,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'UPDATE',
          entity: 'DISPATCH',
          entityId: dispatchId,
          reason: `Dispatch Cancelled: ${reason}`,
        },
      });

      return updated;
    });
  }

  // ─── QUERIES ─────────────────────────────────────────────────────────────────

  async getAllDispatches(ctx: AuthorizationContext, status?: string, fromBranchId?: string, toBranchId?: string) {
    let queryFromBranchId = fromBranchId;
    let queryToBranchId = toBranchId;

    if (ctx.scope === 'BRANCH') {
      if (fromBranchId && fromBranchId !== ctx.branchId && toBranchId && toBranchId !== ctx.branchId) {
        return []; // Branch querying explicitly for other branches
      }
      if (!fromBranchId && !toBranchId) {
        // Must show only dispatches involving this branch
      }
    }

    return prisma.dispatch.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(status ? { status: status as DispatchStatus } : {}),
        ...(ctx.scope === 'BRANCH' ? {
          OR: [{ fromBranchId: ctx.branchId }, { toBranchId: ctx.branchId }]
        } : {
          ...(queryFromBranchId ? { fromBranchId: queryFromBranchId } : {}),
          ...(queryToBranchId ? { toBranchId: queryToBranchId } : {}),
        }),
      },
      include: {
        items: {
          include: {
            variant: { include: { product: { select: { name: true } } } },
          },
        },
        vehicle: true,
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDispatchById(id: string, ctx: AuthorizationContext) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        vehicle: true,
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
      },
    });

    if (!dispatch || dispatch.organizationId !== ctx.organizationId) {
      throw new NotFoundException('Dispatch not found');
    }
    
    if (ctx.scope === 'BRANCH' && ctx.branchId !== dispatch.fromBranchId && ctx.branchId !== dispatch.toBranchId) {
      throw new ForbiddenException('You do not have access to this dispatch');
    }

    return dispatch;
  }
}
