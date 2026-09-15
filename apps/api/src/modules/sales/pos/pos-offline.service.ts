import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { OrdersService } from '../orders/orders.service';
import { CreateSalesOrderDto } from '../orders/dto/create-sales-order.dto';

export interface PosOfflineSyncItemDto {
  offlineTransactionId: string;
  idempotencyKey: string;
  deviceId: string;
  terminalId: string;
  branchId: string;
  cashierId: string;
  orderDto: CreateSalesOrderDto;
}

@Injectable()
export class PosOfflineService {
  constructor(private readonly ordersService: OrdersService) {}

  async syncOfflineTransaction(item: PosOfflineSyncItemDto) {
    // 1. Check idempotency / replay by offlineTransactionId or idempotencyKey
    const existingSync = await prisma.posOfflineSyncRecord.findFirst({
      where: {
        OR: [
          { offlineTransactionId: item.offlineTransactionId },
          { idempotencyKey: item.idempotencyKey },
        ],
      },
    });

    if (existingSync) {
      if (existingSync.syncStatus === 'SUCCESS' && existingSync.salesOrderId) {
        const order = await prisma.salesOrder.findUnique({
          where: { id: existingSync.salesOrderId },
          include: { items: true },
        });
        return { syncStatus: 'SUCCESS', order, duplicate: true };
      }
      return { syncStatus: existingSync.syncStatus, duplicate: true };
    }

    // 2. Atomic creation of sync record in PENDING state
    const syncRecord = await prisma.$transaction(async (tx) => {
      return tx.posOfflineSyncRecord.create({
        data: {
          offlineTransactionId: item.offlineTransactionId,
          idempotencyKey: item.idempotencyKey,
          deviceId: item.deviceId,
          terminalId: item.terminalId,
          branchId: item.branchId,
          payload: item.orderDto as any,
          syncStatus: 'PENDING',
        },
      });
    }).catch(() => {
      // Duplicate submission concurrently rejected by unique constraint
      return null;
    });

    if (!syncRecord) {
      const duplicateRecord = await prisma.posOfflineSyncRecord.findFirst({
        where: { offlineTransactionId: item.offlineTransactionId },
      });
      return { syncStatus: duplicateRecord?.syncStatus || 'SUCCESS', duplicate: true };
    }

    // 3. Process through SalesEngine
    try {
      const branch = await prisma.branch.findUnique({ where: { id: item.branchId } });
      if (!branch) throw new Error('Branch not found');
      const organizationId = branch.organizationId;

      const order = await this.ordersService.createOrder(item.cashierId, organizationId, {
        ...item.orderDto,
        channel: 'POS',
        idempotencyKey: item.idempotencyKey,
      });

      // Confirm order atomically if payment was captured offline
      const confirmedOrder = await this.ordersService.transitionStatus(
        order.id,
        'CONFIRMED' as any,
        `confirm-${item.idempotencyKey}`,
        item.cashierId
      );

      await prisma.posOfflineSyncRecord.update({
        where: { id: syncRecord.id },
        data: {
          syncStatus: 'SUCCESS',
          salesOrderId: confirmedOrder.id,
        },
      });

      return { syncStatus: 'SUCCESS', order: confirmedOrder, duplicate: false };
    } catch (err: any) {
      await prisma.posOfflineSyncRecord.update({
        where: { id: syncRecord.id },
        data: {
          syncStatus: 'FAILED',
          errorMessage: err.message || 'Offline sync execution failed',
        },
      });

      throw new BadRequestException(`Offline transaction sync failed: ${err.message}`);
    }
  }
}
