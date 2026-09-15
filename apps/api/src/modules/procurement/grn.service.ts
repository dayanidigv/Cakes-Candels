import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { InventoryService } from '../inventory/inventory.service';
import { CreateGrnDto } from './dto/procurement.dto';

@Injectable()
export class GrnService {
  constructor(private readonly inventoryService: InventoryService) {}

  async createGrn(dto: CreateGrnDto, userId: string) {
    if (dto.items.length === 0) throw new BadRequestException('GRN must have at least one item');
    
    // 1. Idempotency Check
    if (dto.idempotencyKey) {
      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingRecord) {
        const existingGrn = await prisma.goodsReceiptNote.findFirst({
          where: { poId: dto.poId, supplierInvoice: dto.supplierInvoice },
          include: { items: true },
        });
        if (existingGrn) return existingGrn;
      }
    }

    return prisma.$transaction(async (tx) => {
      // Record idempotency key if provided
      if (dto.idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            idempotencyKey: dto.idempotencyKey,
            requestPath: '/procurement/grns',
          },
        }).catch(() => {}); // Ignore duplicate key if already stored
      }

      const po = await tx.purchaseOrder.findUnique({ 
        where: { id: dto.poId },
        include: { items: true }
      });
      if (!po) throw new NotFoundException('PO not found');
      if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
        throw new BadRequestException('PO must be APPROVED or PARTIALLY_RECEIVED to receive goods');
      }

      let grnNumber = `GRN-${Date.now()}`;
      const numberSeries = await tx.numberSeries.findFirst({
        where: { documentType: 'GRN', isActive: true, OR: [{ branchId: po.branchId }, { branchId: null }] },
        orderBy: { branchId: 'asc' }
      });

      if (numberSeries) {
        const nextNum = numberSeries.currentNumber + 1;
        grnNumber = `${numberSeries.prefix}${nextNum.toString().padStart(numberSeries.length, '0')}${numberSeries.suffix || ''}`;
        await tx.numberSeries.update({ where: { id: numberSeries.id }, data: { currentNumber: nextNum } });
      }

      const grn = await tx.goodsReceiptNote.create({
        data: {
          grnNumber,
          poId: po.id,
          supplierId: po.supplierId,
          branchId: po.branchId,
          supplierInvoice: dto.supplierInvoice,
          notes: dto.notes,
          receivedBy: userId,
          items: {
            create: dto.items.map(item => {
              const poItem = po.items.find(pi => pi.variantId === item.variantId);
              if (!poItem) throw new BadRequestException(`Variant ${item.variantId} not in PO`);
              return {
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice: poItem.unitPrice
              };
            })
          }
        },
        include: { items: true }
      });

      for (const poItem of po.items) {
        const dtoItem = dto.items.find(gi => gi.variantId === poItem.variantId);
        let qtyToAdd = 0;
        if (dtoItem) qtyToAdd = Number(dtoItem.quantity);
        
        if (qtyToAdd > 0) {
          // Atomic updateMany with conditional check prevents concurrent over-receiving
          const updateResult = await tx.purchaseOrderItem.updateMany({
            where: {
              id: poItem.id,
              receivedQty: { lte: Number(poItem.quantity) - qtyToAdd },
            },
            data: {
              receivedQty: { increment: qtyToAdd },
            },
          });

          if (updateResult.count === 0) {
            throw new BadRequestException(
              `Cannot receive more than ordered for variant ${poItem.variantId}. PO line capacity exceeded or modified concurrently.`
            );
          }

          // Create or link InventoryBatch if batch info provided
          let batchId: string | undefined;
          if (dtoItem?.batchNumber) {
            const batch = await tx.inventoryBatch.upsert({
              where: { variantId_batchNumber: { variantId: dtoItem.variantId, batchNumber: dtoItem.batchNumber } },
              update: {
                manufacturedAt: dtoItem.manufacturedAt ? new Date(dtoItem.manufacturedAt) : undefined,
                expiresAt: dtoItem.expiresAt ? new Date(dtoItem.expiresAt) : undefined,
              },
              create: {
                variantId: dtoItem.variantId,
                batchNumber: dtoItem.batchNumber,
                manufacturedAt: dtoItem.manufacturedAt ? new Date(dtoItem.manufacturedAt) : null,
                expiresAt: dtoItem.expiresAt ? new Date(dtoItem.expiresAt) : null,
              },
            });
            batchId = batch.id;
          }

          // CRITICAL: Call Inventory Ledger Engine to strictly handle stock increment!
          // GRN NEVER updates StockBalance directly.
          await this.inventoryService.postTransaction({
            variantId: poItem.variantId,
            toLocationId: po.branchId, // Receiving into this branch
            quantity: qtyToAdd,
            type: 'PURCHASE_RECEIPT' as any,
            batchId,
            referenceId: grn.id,
            referenceType: 'GOODS_RECEIPT_NOTE',
            notes: `Received against PO ${po.poNumber}`
          }, userId, tx);
        }
      }

      // Check if all items in PO are fully received
      const updatedPoItems = await tx.purchaseOrderItem.findMany({
        where: { poId: po.id },
      });
      const allReceived = updatedPoItems.every(pi => Number(pi.receivedQty) >= Number(pi.quantity));

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: allReceived ? 'CLOSED' : 'PARTIALLY_RECEIVED' }
      });

      // Emit Outbox Event inside the transaction
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'procurement.grn.created',
            payload: {
              grnId: grn.id,
              poId: po.id,
              supplierId: po.supplierId,
              branchId: po.branchId,
            },
            status: 'PENDING',
          },
        });
      }

      return grn;
    });
  }

  async getGrns(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.poId) where.poId = query.poId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.branchId) where.branchId = query.branchId;

    const [items, total] = await Promise.all([
      prisma.goodsReceiptNote.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          po: { select: { poNumber: true } },
          supplier: { select: { name: true } },
          branch: { select: { name: true } }
        }
      }),
      prisma.goodsReceiptNote.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
