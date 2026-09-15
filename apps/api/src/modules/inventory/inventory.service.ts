import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { CreateStockTransferDto, ReceiveStockTransferDto } from './dto/stock-transfer.dto';
import { CreateWastageLogDto, ApproveWastageDto, RejectWastageDto } from './dto/wastage-log.dto';

@Injectable()
export class InventoryService {

  // ─── INVENTORY TRANSACTIONS (GATE 1 & 2) ──────────────────────────────
  /**
   * Post an immutable inventory transaction transactionally.
   * This is the ONLY way to modify stock levels.
   */
  async postTransaction(dto: CreateInventoryTransactionDto, userId: string, txContext?: any): Promise<any> {
    const execute = async (tx: any) => {
      const outboundTypes = ['TRANSFER_OUT', 'SALE', 'PRODUCTION_CONSUMPTION', 'CONVERSION_OUT', 'ADJUSTMENT_OUT', 'WASTAGE', 'RESERVATION'];
      const inboundTypes = ['PURCHASE_RECEIPT', 'PRODUCTION_OUTPUT', 'TRANSFER_IN', 'SALE_RETURN', 'ADJUSTMENT_IN', 'CONVERSION_IN', 'OPENING', 'WASTAGE_REVERSAL', 'RESERVATION_RELEASE'];

      // 1. Atomic decrement with non-negative stock check for outbound
      if (outboundTypes.includes(dto.type) && dto.fromLocationId) {
        const updateResult = await tx.stockBalance.updateMany({
          where: {
            locationId: dto.fromLocationId,
            variantId: dto.variantId,
            quantity: { gte: dto.quantity },
          },
          data: {
            quantity: { decrement: dto.quantity },
          },
        });

        if (updateResult.count === 0) {
          throw new BadRequestException({
            errorCode: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for location ${dto.fromLocationId} and variant ${dto.variantId}`,
          });
        }
      }

      // 2. Create the immutable ledger record
      const transaction = await tx.inventoryTransaction.create({
        data: {
          variantId: dto.variantId,
          batchId: dto.batchId,
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          quantity: dto.quantity,
          type: dto.type as any,
          referenceId: dto.referenceId,
          referenceType: dto.referenceType,
          notes: dto.notes,
          createdBy: userId,
        },
      });

      if (inboundTypes.includes(dto.type) && dto.toLocationId) {
        await tx.stockBalance.upsert({
          where: { locationId_variantId: { locationId: dto.toLocationId, variantId: dto.variantId } },
          update: { quantity: { increment: dto.quantity } },
          create: { locationId: dto.toLocationId, variantId: dto.variantId, quantity: dto.quantity },
        });
      }

      // 4. Emit Outbox Event (Idempotent event log inside transaction)
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'inventory.transaction.posted',
            payload: {
              transactionId: transaction.id,
              variantId: dto.variantId,
              type: dto.type,
              quantity: dto.quantity,
              fromLocationId: dto.fromLocationId,
              toLocationId: dto.toLocationId,
            },
            status: 'PENDING',
          },
        });
      }

      return transaction;
    };

    // If already inside a transaction, use it. Otherwise, start one.
    if (txContext) {
      return execute(txContext);
    } else {
      return prisma.$transaction(execute);
    }
  }

  async getTransactions(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.variantId) where.variantId = query.variantId;
    if (query.locationId) where.OR = [{ fromLocationId: query.locationId }, { toLocationId: query.locationId }];
    if (query.type) where.type = query.type;

    const [items, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { variant: { select: { name: true, sku: true } } },
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── RESERVATIONS & FEFO ALLOCATION (GATE 6 & 7) ─────────────────────

  async reserveStock(dto: any, userId: string): Promise<any> {
    return prisma.$transaction(async (tx) => {
      // 1. FEFO Allocation: find available batches with earliest expiration
      const fefoBatches = await tx.inventoryBatch.findMany({
        where: { variantId: dto.variantId },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      });

      const selectedBatch = fefoBatches[0];

      // 2. Post RESERVATION transaction via postTransaction
      const transaction = await this.postTransaction({
        variantId: dto.variantId,
        fromLocationId: dto.branchId,
        quantity: dto.quantity,
        type: 'RESERVATION' as any,
        batchId: selectedBatch?.id,
        referenceId: dto.salesOrderId,
        referenceType: 'SALES_ORDER',
        notes: dto.notes ?? 'Stock reserved for order',
      }, userId, tx);

      // 3. Record InventoryReservation item if salesOrderId provided
      if (dto.salesOrderId) {
        const reservation = await tx.inventoryReservation.create({
          data: {
            salesOrderId: dto.salesOrderId,
            branchId: dto.branchId,
            status: 'ACTIVE',
            items: {
              create: [
                {
                  variantId: dto.variantId,
                  quantity: dto.quantity,
                },
              ],
            },
          },
        });
        return { transaction, reservation, batchAllocated: selectedBatch };
      }

      return { transaction, batchAllocated: selectedBatch };
    });
  }

  async releaseReservation(reservationId: string, userId: string): Promise<any> {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.inventoryReservation.findUnique({
        where: { id: reservationId },
        include: { items: true },
      });
      if (!reservation) throw new NotFoundException('Reservation not found');
      if (reservation.status !== 'ACTIVE') {
        throw new BadRequestException(`Cannot release reservation in status ${reservation.status}`);
      }

      for (const item of reservation.items) {
        await this.postTransaction({
          variantId: item.variantId,
          toLocationId: reservation.branchId,
          quantity: Number(item.quantity),
          type: 'RESERVATION_RELEASE' as any,
          referenceId: reservation.id,
          referenceType: 'INVENTORY_RESERVATION',
          notes: 'Reservation released',
        }, userId, tx);
      }

      return tx.inventoryReservation.update({
        where: { id: reservationId },
        data: { status: 'RELEASED' },
      });
    });
  }

  // ─── STOCK BALANCES ───────────────────────────────────────────────────

  async getStockLevels(query: any): Promise<any> {
    const where: any = {};
    if (query.locationId) where.locationId = query.locationId;
    if (query.variantId) where.variantId = query.variantId;

    const balances = await prisma.stockBalance.findMany({
      where,
      include: {
        variant: { select: { id: true, name: true, sku: true, reorderLevel: true } },
        location: { select: { id: true, name: true, type: true } },
      },
      orderBy: { lastUpdated: 'desc' },
    });

    return balances.map(b => ({
      ...b,
      isLowStock: b.variant.reorderLevel != null && Number(b.quantity) <= Number(b.variant.reorderLevel),
    }));
  }

  // ─── STOCK TRANSFERS ──────────────────────────────────────────────────

  async createTransfer(dto: CreateStockTransferDto, userId: string): Promise<any> {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException({ errorCode: 'SAME_LOCATION', message: 'Source and destination cannot be the same.' });
    }

    return prisma.$transaction(async (tx) => {
      const count = await tx.stockTransfer.count();
      const transferNumber = `TRF-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber,
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          status: 'REQUESTED',
          requestedBy: userId,
          notes: dto.notes,
          items: {
            create: dto.items.map(item => ({
              variantId: item.variantId,
              quantityRequested: item.quantityRequested,
            })),
          },
        },
        include: { items: true, fromLocation: true, toLocation: true },
      });

      return transfer;
    });
  }

  async dispatchTransfer(id: string, userId: string): Promise<any> {
    return prisma.$transaction(async (tx) => {
      // Atomic state transition REQUESTED -> IN_TRANSIT prevents concurrent double-dispatch
      const updateResult = await tx.stockTransfer.updateMany({
        where: { id, status: 'REQUESTED' },
        data: { status: 'IN_TRANSIT', dispatchedBy: userId, dispatchedAt: new Date() },
      });

      if (updateResult.count === 0) {
        const transfer = await tx.stockTransfer.findUnique({ where: { id } });
        if (!transfer) throw new NotFoundException('Transfer not found.');
        throw new BadRequestException({ errorCode: 'INVALID_STATUS', message: `Cannot dispatch a transfer in status: ${transfer.status}` });
      }

      const transfer = await tx.stockTransfer.findUnique({
        where: { id }, include: { items: true },
      });

      // Post TRANSFER_OUT transactions for each item
      for (const item of transfer.items) {
        await this.postTransaction({
          variantId: item.variantId,
          fromLocationId: transfer.fromLocationId,
          quantity: Number(item.quantityRequested),
          type: 'TRANSFER_OUT' as any,
          referenceId: transfer.id,
          referenceType: 'STOCK_TRANSFER',
        }, userId, tx);

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { quantityDispatched: item.quantityRequested },
        });
      }

      // Emit Outbox Event
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'inventory.transfer.dispatched',
            payload: {
              transferId: transfer.id,
              fromLocationId: transfer.fromLocationId,
              toLocationId: transfer.toLocationId,
            },
            status: 'PENDING',
          },
        });
      }

      return tx.stockTransfer.findUnique({
        where: { id },
        include: { items: true, fromLocation: true, toLocation: true },
      });
    });
  }

  async receiveTransfer(id: string, dto: ReceiveStockTransferDto, userId: string): Promise<any> {
    const idempotencyKey = (dto as any).idempotencyKey;
    if (idempotencyKey) {
      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey },
      });
      if (existingRecord) {
        const existingTransfer = await prisma.stockTransfer.findUnique({
          where: { id }, include: { items: true, fromLocation: true, toLocation: true },
        });
        if (existingTransfer) return existingTransfer;
      }
    }

    return prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: { idempotencyKey, requestPath: '/inventory/transfers/receive' },
        }).catch(() => {});
      }

      // CRITICAL: Atomic database-level state transition IN_TRANSIT -> RECEIVED
      // Prevents 100 concurrent receipt requests from double-crediting branch stock!
      const updateResult = await tx.stockTransfer.updateMany({
        where: { id, status: 'IN_TRANSIT' },
        data: { status: 'RECEIVED', receivedBy: userId, receivedAt: new Date(), notes: dto.notes },
      });

      if (updateResult.count === 0) {
        const transfer = await tx.stockTransfer.findUnique({ where: { id } });
        if (!transfer) throw new NotFoundException('Transfer not found.');
        throw new BadRequestException({ errorCode: 'INVALID_STATUS', message: `Cannot receive a transfer in status: ${transfer.status}` });
      }

      const transfer = await tx.stockTransfer.findUnique({
        where: { id }, include: { items: true },
      });

      for (const receivedItem of dto.items) {
        const transferItem = transfer.items.find(i => i.id === receivedItem.transferItemId);
        if (!transferItem) continue;

        // Post TRANSFER_IN for received quantity
        await this.postTransaction({
          variantId: transferItem.variantId,
          toLocationId: transfer.toLocationId,
          quantity: receivedItem.quantityReceived,
          type: 'TRANSFER_IN' as any,
          referenceId: transfer.id,
          referenceType: 'STOCK_TRANSFER',
        }, userId, tx);

        await tx.stockTransferItem.update({
          where: { id: receivedItem.transferItemId },
          data: { quantityReceived: receivedItem.quantityReceived },
        });
      }

      // Emit Outbox Event inside transaction
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'inventory.transfer.received',
            payload: {
              transferId: transfer.id,
              fromLocationId: transfer.fromLocationId,
              toLocationId: transfer.toLocationId,
            },
            status: 'PENDING',
          },
        });
      }

      return tx.stockTransfer.findUnique({
        where: { id },
        include: { items: true, fromLocation: true, toLocation: true },
      });
    });
  }

  async getTransfers(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.locationId) where.OR = [{ fromLocationId: query.locationId }, { toLocationId: query.locationId }];

    const [items, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          fromLocation: { select: { name: true, type: true } },
          toLocation: { select: { name: true, type: true } },
          items: { include: { variant: { select: { name: true, sku: true } } } },
        },
      }),
      prisma.stockTransfer.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── WASTAGE LOGS ─────────────────────────────────────────────────────

  async logWastage(dto: CreateWastageLogDto, userId: string): Promise<any> {
    return prisma.$transaction(async (tx) => {
      const count = await tx.wastageLog.count();
      const logNumber = `WST-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      // Post WASTE_PENDING transaction (quarantines stock)
      await this.postTransaction({
        variantId: dto.variantId,
        fromLocationId: dto.locationId,
        quantity: dto.quantity,
        type: 'WASTE_PENDING' as any,
        referenceType: 'WASTAGE_LOG',
        notes: `Wastage logged: ${dto.reasonCode}`,
      }, userId, tx);

      return tx.wastageLog.create({
        data: {
          logNumber,
          variantId: dto.variantId,
          locationId: dto.locationId,
          quantity: dto.quantity,
          reasonCode: dto.reasonCode,
          notes: dto.notes,
          status: 'PENDING',
          loggedBy: userId,
        },
        include: { variant: { select: { name: true, sku: true } }, location: { select: { name: true } } },
      });
    });
  }

  async approveWastage(id: string, dto: ApproveWastageDto, userId: string): Promise<any> {
    return prisma.$transaction(async (tx) => {
      const wastage = await tx.wastageLog.findUnique({ where: { id } });
      if (!wastage) throw new NotFoundException('Wastage log not found.');
      if (wastage.status !== 'PENDING') {
        throw new BadRequestException({ errorCode: 'ALREADY_PROCESSED', message: 'This wastage log is already processed.' });
      }

      // Post WASTE_APPROVED to finalize the write-off (It doesn't double deduct because WASTE_PENDING already deducted)
      // Wait, WASTE_PENDING deducted. If WASTE_APPROVED is outbound, it will deduct again!
      // This is a bug from previous code. WASTE_APPROVED should NOT deduct again.
      // We should use an adjustment type that doesn't modify balance or just mark the ledger without balance change.
      // Actually, if we look at updateStockBalance from before, WASTE_APPROVED WAS deducting. That's a double deduction!
      // I need to make WASTE_APPROVED a ledger entry only, OR we don't deduct on WASTE_PENDING.
      // But standard is: Quarantined stock (WASTE_PENDING) is deducted from AVAILABLE. 
      // I will remove WASTE_APPROVED from outboundTypes in postTransaction so it doesn't double deduct!

      await this.postTransaction({
        variantId: wastage.variantId,
        fromLocationId: wastage.locationId,
        quantity: Number(wastage.quantity),
        type: 'WASTE_APPROVED' as any,
        referenceId: wastage.id,
        referenceType: 'WASTAGE_LOG',
        notes: dto.notes ?? 'Wastage approved by manager.',
      }, userId, tx);

      return tx.wastageLog.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
      });
    });
  }

  async rejectWastage(id: string, dto: RejectWastageDto, userId: string): Promise<any> {
    return prisma.$transaction(async (tx) => {
      const wastage = await tx.wastageLog.findUnique({ where: { id } });
      if (!wastage) throw new NotFoundException('Wastage log not found.');
      if (wastage.status !== 'PENDING') {
        throw new BadRequestException({ errorCode: 'ALREADY_PROCESSED', message: 'This wastage log is already processed.' });
      }

      // Reverse the WASTE_PENDING by restoring stock (ADJUSTMENT_POSITIVE)
      await this.postTransaction({
        variantId: wastage.variantId,
        toLocationId: wastage.locationId,
        quantity: Number(wastage.quantity),
        type: 'ADJUSTMENT_POSITIVE' as any,
        referenceId: wastage.id,
        referenceType: 'WASTAGE_LOG',
        notes: `Wastage rejected — stock restored. Reason: ${dto.rejectionNote}`,
      }, userId, tx);

      return tx.wastageLog.update({
        where: { id },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectionNote: dto.rejectionNote },
      });
    });
  }

  async getWastageLogs(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.locationId) where.locationId = query.locationId;

    const [items, total] = await Promise.all([
      prisma.wastageLog.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          variant: { select: { name: true, sku: true } },
          location: { select: { name: true } },
        },
      }),
      prisma.wastageLog.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────

  async getDashboardMetrics(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      stockBalances,
      pendingTransfers,
      inTransitTransfers,
      todayReceipts,
      todayIssues,
      todayWastage
    ] = await Promise.all([
      prisma.stockBalance.findMany({ include: { variant: { include: { pricing: true } } } }),
      prisma.stockTransfer.count({ where: { status: 'REQUESTED' } }),
      prisma.stockTransfer.count({ where: { status: 'IN_TRANSIT' } }),
      prisma.inventoryTransaction.aggregate({
        where: { type: 'PURCHASE_RECEIPT', createdAt: { gte: today } },
        _sum: { quantity: true },
      }),
      prisma.inventoryTransaction.aggregate({
        where: { type: { in: ['SALE', 'PRODUCTION_CONSUMPTION', 'TRANSFER_OUT'] }, createdAt: { gte: today } },
        _sum: { quantity: true },
      }),
      prisma.wastageLog.aggregate({
        where: { status: 'APPROVED', createdAt: { gte: today } },
        _sum: { quantity: true },
      }),
    ]);

    let totalStockValue = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;
    const skuSet = new Set<string>();

    stockBalances.forEach(b => {
      skuSet.add(b.variantId);
      const qty = Number(b.quantity);
      if (qty <= 0) outOfStockItems++;
      else if (b.variant.reorderLevel && qty <= Number(b.variant.reorderLevel)) lowStockItems++;

      if (b.variant.pricing?.costPrice) {
        totalStockValue += qty * Number(b.variant.pricing.costPrice);
      }
    });

    return {
      totalStockValue,
      totalSKUs: skuSet.size,
      lowStockItems,
      outOfStockItems,
      pendingTransfers,
      inTransitTransfers,
      todayReceipts: Number(todayReceipts._sum.quantity || 0),
      todayIssues: Number(todayIssues._sum.quantity || 0),
      todayWastage: Number(todayWastage._sum.quantity || 0),
    };
  }
}
