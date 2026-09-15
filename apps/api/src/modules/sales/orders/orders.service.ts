import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma, SalesOrderStatus } from '@cc-erp/database';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { PricingService } from './pricing.service';
import { Decimal } from '@prisma/client/runtime/library';
import { PromotionValidationService } from '../promotions/promotion-validation.service';
import { PromotionUsageService } from '../promotions/promotion-usage.service';
import { InventoryService } from '../../inventory/inventory.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly pricingService: PricingService,
    private readonly promotionValidationService: PromotionValidationService,
    private readonly promotionUsageService: PromotionUsageService,
    private readonly inventoryService: InventoryService
  ) {}

  // State Machine rules
  private readonly allowedTransitions = {
    [SalesOrderStatus.DRAFT]: [SalesOrderStatus.PENDING_PAYMENT, SalesOrderStatus.CANCELLED],
    [SalesOrderStatus.PENDING_PAYMENT]: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.PAYMENT_FAILED, SalesOrderStatus.CANCELLED],
    [SalesOrderStatus.CONFIRMED]: [SalesOrderStatus.PROCESSING, SalesOrderStatus.CANCELLED],
    [SalesOrderStatus.PROCESSING]: [SalesOrderStatus.READY, SalesOrderStatus.CANCELLED],
    [SalesOrderStatus.READY]: [SalesOrderStatus.DISPATCHED, SalesOrderStatus.DELIVERED, SalesOrderStatus.COMPLETED, SalesOrderStatus.CANCELLED],
    [SalesOrderStatus.DISPATCHED]: [SalesOrderStatus.DELIVERED, SalesOrderStatus.CANCELLED],
    [SalesOrderStatus.DELIVERED]: [SalesOrderStatus.COMPLETED, SalesOrderStatus.RETURNED],
    [SalesOrderStatus.COMPLETED]: [SalesOrderStatus.RETURNED, SalesOrderStatus.REFUNDED],
    [SalesOrderStatus.CANCELLED]: [],
    [SalesOrderStatus.PAYMENT_FAILED]: [SalesOrderStatus.PENDING_PAYMENT, SalesOrderStatus.CANCELLED],
    [SalesOrderStatus.RETURNED]: [SalesOrderStatus.REFUNDED],
    [SalesOrderStatus.REFUNDED]: [],
  };

  async createOrder(userId: string, organizationId: string, createOrderDto: CreateSalesOrderDto) {
    let validatedDiscountAmount = new Decimal(0);
    let validationResult;
    
    // Initial pricing to get subtotal
    let pricingResult = await this.pricingService.resolveOrderPricing(
      createOrderDto.branchId,
      createOrderDto.items
    );

    if (createOrderDto.couponCode) {
      validationResult = await this.promotionValidationService.validate({
        promotionCode: createOrderDto.couponCode,
        customerId: createOrderDto.customerId,
        branchId: createOrderDto.branchId,
        subtotal: pricingResult.subtotal,
        items: createOrderDto.items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          productId: pricingResult.resolvedItems.find(ri => ri.variantId === item.variantId)?.productId || '',
          categoryId: pricingResult.resolvedItems.find(ri => ri.variantId === item.variantId)?.categoryId || undefined
        }))
      });

      if (!validationResult.valid) {
        throw new BadRequestException(validationResult.message);
      }
      
      validatedDiscountAmount = new Decimal(validationResult.calculatedDiscountAmount || 0);
      
      // Re-resolve with discount
      pricingResult = await this.pricingService.resolveOrderPricing(
        createOrderDto.branchId,
        createOrderDto.items,
        validatedDiscountAmount
      );
    }

    // 2. Transaction Boundary
    return prisma.$transaction(async (tx) => {
      // Validate customer and branch existence
      const customer = await tx.customer.findUnique({ where: { id: createOrderDto.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
      
      const branch = await tx.branch.findUnique({ where: { id: createOrderDto.branchId } });
      if (!branch) throw new NotFoundException('Branch not found');
      if (branch.organizationId !== organizationId) {
        throw new BadRequestException('Branch does not belong to your organization');
      }

      // Generate Order Number securely using Pessimistic Locking
      const numberSeriesRows = await tx.$queryRaw<Array<any>>`
        SELECT id, "currentNumber", prefix, suffix, length 
        FROM "NumberSeries" 
        WHERE "documentType" = 'SO' 
          AND "branchId" = ${createOrderDto.branchId}::uuid 
          AND "isActive" = true 
        FOR UPDATE
      `;
      
      let orderNumber = `SO-${Date.now()}`;
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

      // Create Order and Items
      const order = await tx.salesOrder.create({
        data: {
          orderNumber,
          organizationId,
          customerId: createOrderDto.customerId,
          branchId: createOrderDto.branchId,
          status: SalesOrderStatus.PENDING_PAYMENT,
          subtotal: pricingResult.subtotal,
          taxAmount: pricingResult.taxTotal,
          discountAmount: pricingResult.discountTotal,
          grandTotal: pricingResult.grandTotal,
          createdBy: userId,
          items: {
            create: pricingResult.resolvedItems.map(item => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxAmount: item.taxAmount,
              discountAmount: item.discountAmount,
              lineTotal: item.lineTotal,
              pricingSnapshot: item.pricingSnapshot,
            }))
          },
          reservations: {
            create: [{
              branchId: createOrderDto.branchId,
              status: 'ACTIVE',
              items: {
                create: pricingResult.resolvedItems.map(item => ({
                  variantId: item.variantId,
                  quantity: item.quantity
                }))
              }
            }]
          }
        },
        include: {
          items: true,
          reservations: true
        }
      });

      // Atomically reserve promotion usage if applicable
      if (createOrderDto.couponCode && validationResult) {
        await this.promotionUsageService.reserveUsage(
          tx,
          validationResult.promotionId!,
          createOrderDto.customerId,
          order.id,
          validationResult.calculatedDiscountAmount || 0
        );
      }

      // Emit Outbox Event
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'sales.order.created',
            payload: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              customerId: order.customerId,
              branchId: order.branchId,
              grandTotal: Number(order.grandTotal),
            },
            status: 'PENDING',
          },
        });
      }

      return order;
    });
  }

  async transitionStatus(orderId: string, newStatus: SalesOrderStatus, idempotencyKey?: string, userId?: string) {
    if (idempotencyKey) {
      const existingRecord = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey },
      });
      if (existingRecord) {
        const existingOrder = await prisma.salesOrder.findUnique({
          where: { id: orderId },
          include: { items: true },
        });
        if (existingOrder) return existingOrder;
      }
    }

    return prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Order not found');

      const allowed = this.allowedTransitions[order.status];
      if (!allowed || !allowed.includes(newStatus)) {
        throw new BadRequestException(`Cannot transition order from ${order.status} to ${newStatus}`);
      }

      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: { idempotencyKey, requestPath: '/sales/orders/transition' },
        }).catch(() => {});
      }

      // CRITICAL: Atomic database-level state transition check
      // Prevents 100 concurrent confirmation/checkout requests from posting duplicate SALE ledger entries!
      const updateResult = await tx.salesOrder.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: newStatus,
          paymentStatus: newStatus === SalesOrderStatus.CONFIRMED || newStatus === SalesOrderStatus.COMPLETED ? 'CAPTURED' : undefined,
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(`Order ${orderId} has already been transitioned or state conflict occurred.`);
      }

      // Handle Cancelation rules (Release reservation)
      if (newStatus === SalesOrderStatus.CANCELLED) {
        await tx.inventoryReservation.updateMany({
          where: { salesOrderId: orderId, status: 'ACTIVE' },
          data: { status: 'RELEASED' }
        });
      }

      // Handle Confirmation / Completion: Post SALE transactions to Inventory Ledger
      if (newStatus === SalesOrderStatus.CONFIRMED || newStatus === SalesOrderStatus.COMPLETED) {
        for (const item of order.items) {
          await this.inventoryService.postTransaction({
            variantId: item.variantId,
            fromLocationId: order.branchId,
            quantity: Number(item.quantity),
            type: 'SALE' as any,
            referenceId: order.id,
            referenceType: 'SALES_ORDER',
            notes: `Sale for order ${order.orderNumber}`,
          }, userId || order.createdBy || 'system-user', tx);
        }

        // Mark reservations as CONSUMED
        await tx.inventoryReservation.updateMany({
          where: { salesOrderId: orderId, status: 'ACTIVE' },
          data: { status: 'CONSUMED' }
        });
      }

      // Emit Outbox Event
      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: newStatus === SalesOrderStatus.CONFIRMED ? 'sales.order.confirmed' : `sales.order.${newStatus.toLowerCase()}`,
            payload: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              branchId: order.branchId,
              status: newStatus,
            },
            status: 'PENDING',
          },
        });
      }

      return tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: true, reservations: true },
      });
    });
  }
}
