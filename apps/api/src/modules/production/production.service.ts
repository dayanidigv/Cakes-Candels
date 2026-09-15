import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { InventoryService } from '../inventory/inventory.service';
import { CreateProductionOrderDto, StartProductionDto, CompleteProductionDto } from './dto/production-order.dto';

@Injectable()
export class ProductionService {
  constructor(private readonly inventoryService: InventoryService) {}

  async createProductionOrder(dto: CreateProductionOrderDto, userId: string) {
    return prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: dto.variantId } });
      if (!variant) throw new NotFoundException('Finished Good Variant not found');

      const recipe = await tx.recipeVersion.findUnique({ 
        where: { id: dto.recipeVersionId },
        include: { ingredients: true }
      });
      if (!recipe) throw new NotFoundException('Recipe Version not found');
      if (recipe.ingredients.length === 0) throw new BadRequestException('Recipe has no ingredients');

      const location = await tx.branch.findUnique({ where: { id: dto.locationId } });
      if (!location) throw new NotFoundException('Location not found');

      // Generate Order Number securely using Pessimistic Locking
      const numberSeriesRows = await tx.$queryRaw<Array<any>>`
        SELECT id, "currentNumber", prefix, suffix, length 
        FROM "NumberSeries" 
        WHERE "documentType" = 'PRD' 
          AND "isActive" = true 
          AND ("branchId" = ${location.id}::uuid OR "branchId" IS NULL)
        ORDER BY "branchId" ASC 
        LIMIT 1
        FOR UPDATE
      `;

      let orderNumber = `PRD-${Date.now()}`;
      if (numberSeriesRows.length > 0) {
        const ns = numberSeriesRows[0];
        const nextNum = ns.currentNumber + 1;
        
        await tx.$executeRaw`
          UPDATE "NumberSeries" 
          SET "currentNumber" = ${nextNum} 
          WHERE id = ${ns.id}::uuid
        `;
        
        orderNumber = `${ns.prefix || ''}${nextNum.toString().padStart(ns.length, '0')}${ns.suffix || ''}`;
      }

      return tx.productionOrder.create({
        data: {
          orderNumber,
          locationId: dto.locationId,
          variantId: dto.variantId,
          recipeVersionId: dto.recipeVersionId,
          targetQuantity: dto.targetQuantity,
          notes: dto.notes,
          createdBy: userId,
        }
      });
    });
  }

  async startProduction(id: string, dto: StartProductionDto, userId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Atomic state transition PLANNED -> IN_PROGRESS prevents duplicate start
      const updateResult = await tx.productionOrder.updateMany({
        where: { id, status: 'PLANNED' },
        data: {
          status: 'IN_PROGRESS',
          startDate: new Date(),
        },
      });

      if (updateResult.count === 0) {
        const order = await tx.productionOrder.findUnique({ where: { id } });
        if (!order) throw new NotFoundException('Production Order not found');
        throw new BadRequestException('Only PLANNED production orders can be started');
      }

      const order = await tx.productionOrder.findUnique({ 
        where: { id },
        include: { recipeVersion: { include: { ingredients: true } }, location: true, variant: true }
      });

      // 2. Calculate required materials
      const recipeMaster = await tx.recipeMaster.findUnique({ where: { id: order.recipeVersion.recipeId } });
      const yieldQty = recipeMaster ? Number(recipeMaster.yieldQuantity) : 1;
      const multiplier = Number(order.targetQuantity) / yieldQty;

      // 3. Consume materials via Inventory Ledger
      const consumptions = [];
      for (const ingredient of order.recipeVersion.ingredients) {
        if (!ingredient.variantId) continue;
        
        const requiredQty = Number(ingredient.quantity) * multiplier;

        await this.inventoryService.postTransaction({
          variantId: ingredient.variantId,
          fromLocationId: order.locationId,
          quantity: requiredQty,
          type: 'PRODUCTION_CONSUMPTION' as any,
          referenceId: order.id,
          referenceType: 'PRODUCTION_ORDER',
          notes: `Consumed for order ${order.orderNumber}`
        }, userId, tx);

        consumptions.push({
          productionOrderId: order.id,
          variantId: ingredient.variantId,
          quantity: requiredQty
        });
      }

      if (consumptions.length > 0) {
        await tx.materialConsumption.createMany({ data: consumptions });
      }

      // Emit Outbox Event
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'production.order.started',
            payload: {
              productionOrderId: order.id,
              orderNumber: order.orderNumber,
              locationId: order.locationId,
            },
            status: 'PENDING',
          },
        });
      }

      return tx.productionOrder.findUnique({ where: { id } });
    });
  }

  async completeProduction(id: string, dto: CompleteProductionDto, userId: string) {
    // 1. Idempotency Check
    if (dto.idempotencyKey) {
      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingRecord) {
        const existingOrder = await prisma.productionOrder.findUnique({ where: { id } });
        if (existingOrder) return existingOrder;
      }
    }

    return prisma.$transaction(async (tx) => {
      // Record idempotency key if provided
      if (dto.idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            idempotencyKey: dto.idempotencyKey,
            requestPath: '/production/complete',
          },
        }).catch(() => {});
      }

      // 2. CRITICAL: Atomic database-level state transition check (IN_PROGRESS -> COMPLETED)
      // This prevents 100 concurrent completion requests from producing duplicate finished goods!
      const updateResult = await tx.productionOrder.updateMany({
        where: { id, status: 'IN_PROGRESS' },
        data: {
          status: 'COMPLETED',
          actualYield: dto.actualYield,
          completedDate: new Date(),
          notes: dto.notes ? `COMPLETE: ${dto.notes}` : undefined,
        },
      });

      if (updateResult.count === 0) {
        const order = await tx.productionOrder.findUnique({ where: { id } });
        if (!order) throw new NotFoundException('Production Order not found');
        throw new BadRequestException('Only IN_PROGRESS production orders can be completed or order has already been completed.');
      }

      const order = await tx.productionOrder.findUnique({ where: { id } });

      // 3. Create or link InventoryBatch for finished goods if batch info provided
      let batchId: string | undefined;
      if (dto.batchNumber) {
        const batch = await tx.inventoryBatch.upsert({
          where: { variantId_batchNumber: { variantId: order.variantId, batchNumber: dto.batchNumber } },
          update: {
            manufacturedAt: dto.manufacturedAt ? new Date(dto.manufacturedAt) : undefined,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
          },
          create: {
            variantId: order.variantId,
            batchNumber: dto.batchNumber,
            manufacturedAt: dto.manufacturedAt ? new Date(dto.manufacturedAt) : null,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          },
        });
        batchId = batch.id;
      }

      // 4. Yield Finished Goods via Inventory Ledger
      await this.inventoryService.postTransaction({
        variantId: order.variantId,
        toLocationId: order.locationId,
        quantity: dto.actualYield,
        type: 'PRODUCTION_OUTPUT' as any,
        batchId,
        referenceId: order.id,
        referenceType: 'PRODUCTION_ORDER',
        notes: `Output for order ${order.orderNumber}`
      }, userId, tx);

      // Emit Outbox Event inside the transaction
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'production.order.completed',
            payload: {
              productionOrderId: order.id,
              orderNumber: order.orderNumber,
              variantId: order.variantId,
              locationId: order.locationId,
              actualYield: dto.actualYield,
              batchId,
            },
            status: 'PENDING',
          },
        });
      }

      return order;
    });
  }

  async getProductionOrders(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.locationId) where.locationId = query.locationId;
    if (query.variantId) where.variantId = query.variantId;

    const [items, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          variant: { select: { name: true, sku: true } },
          location: { select: { name: true } },
          recipeVersion: { select: { versionNumber: true } }
        }
      }),
      prisma.productionOrder.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
