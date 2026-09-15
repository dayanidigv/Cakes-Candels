import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { prisma, SalesOrderStatus, PaymentStatus } from '@cc-erp/database';
import { PricingService } from '../orders/pricing.service';
import { InventoryService } from '../../inventory/inventory.service';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';

/**
 * POS Billing Service — the atomic checkout engine.
 *
 * ARCHITECTURE RULES enforced in this file:
 *  1. All pricing resolved server-side via PricingService — no client prices trusted.
 *  2. All inventory movements go through InventoryService.postTransaction — not raw updateMany.
 *  3. Stock is enforced before commit — insufficient stock throws BadRequestException.
 *  4. The entire checkout (order + payment + stock deduction + loyalty) is a single DB transaction.
 *  5. Idempotency is enforced at the Payment.idempotencyKey level.
 *  6. Void approval is fully atomic and reverses all ledger entries.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly pricingService: PricingService,
    private readonly inventoryService: InventoryService,
  ) {}

  async processCheckout(data: {
    idempotencyKey: string;
    branchId: string;
    customerId?: string;
    paymentMode: string;
    loyaltyPointsRedeemed?: number;
    items: Array<{ variantId: string; quantity: number }>;
    userId: string;
    organizationId: string;
  }) {
    // ─── 1. IDEMPOTENCY CHECK ────────────────────────────────────────────────
    // Check before entering the transaction to avoid unnecessary DB locks.
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });
    if (existingPayment) {
      const order = await prisma.salesOrder.findUnique({
        where: { id: existingPayment.salesOrderId },
        include: { items: true, payments: true },
      });
      return { success: true, message: 'Already processed (idempotent replay)', order };
    }

    // ─── 2. TENANT AUTHORIZATION ─────────────────────────────────────────────
    const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (branch.organizationId !== data.organizationId) {
      throw new BadRequestException('Branch does not belong to your organization');
    }

    // ─── 3. SERVER-SIDE PRICING RESOLUTION ──────────────────────────────────
    // All prices come from the database — the client cannot inject prices.
    const pricingResult = await this.pricingService.resolveOrderPricing(
      data.branchId,
      data.items,
    );

    // Note: Stock verification is deferred to the InventoryService inside the transaction
    // to prevent TOCTOU (Time-of-check to time-of-use) race conditions.

    // ─── 4. ATOMIC CHECKOUT TRANSACTION ─────────────────────────────────────
    const result = await prisma.$transaction(
      async (tx) => {
        // ── 4a. Atomic NumberSeries increment (PESSIMISTIC LOCKING) ────────
        // To guarantee TRUE GAPLESS numbering, we must use a row-level lock.
        // If this transaction rolls back, the lock is released and the sequence is NOT lost.
        const numberSeriesRows = await tx.$queryRaw<Array<any>>`
          SELECT id, "currentNumber", prefix, suffix, length 
          FROM "NumberSeries" 
          WHERE "documentType" = 'INV' 
            AND "branchId" = ${data.branchId}::uuid 
            AND "isActive" = true 
          FOR UPDATE
        `;

        let invoiceNumber = `INV-${Date.now()}`;
        if (numberSeriesRows.length > 0) {
          const ns = numberSeriesRows[0];
          const nextNum = ns.currentNumber + 1;
          
          await tx.$executeRaw`
            UPDATE "NumberSeries" 
            SET "currentNumber" = ${nextNum} 
            WHERE id = ${ns.id}::uuid
          `;
          
          invoiceNumber = `${ns.prefix || ''}${nextNum.toString().padStart(ns.length, '0')}${ns.suffix || ''}`;
        }

        // ── 4b. Resolve or create walk-in customer ─────────────────────────
        let customerId = data.customerId;
        if (!customerId || customerId === 'walk-in') {
          let defaultCust = await tx.customer.findFirst({
            where: { phone: '0000000000' },
          });
          if (!defaultCust) {
            defaultCust = await tx.customer.create({
              data: { phone: '0000000000', fullName: 'Walk-in Customer' },
            });
          }
          customerId = defaultCust.id;
        }

        // ── 4c. Create SalesOrder ──────────────────────────────────────────
        const order = await tx.salesOrder.create({
          data: {
            orderNumber: invoiceNumber,
            organizationId: data.organizationId,
            customerId,
            branchId: data.branchId,
            channel: 'POS',
            fulfillmentType: 'DINE_IN',
            status: SalesOrderStatus.COMPLETED,
            paymentStatus: PaymentStatus.CAPTURED,
            fulfilmentStatus: 'DELIVERED',
            subtotal: pricingResult.subtotal,
            taxAmount: pricingResult.taxTotal,
            discountAmount: pricingResult.discountTotal,
            grandTotal: pricingResult.grandTotal,
            createdBy: data.userId,
            items: {
              create: pricingResult.resolvedItems.map((item) => ({
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxAmount: item.taxAmount,
                discountAmount: item.discountAmount,
                lineTotal: item.lineTotal,
                pricingSnapshot: item.pricingSnapshot,
              })),
            },
          },
          include: { items: true },
        });

        // ── 4d. Create Payment Record ──────────────────────────────────────
        const payment = await tx.payment.create({
          data: {
            salesOrderId: order.id,
            amount: pricingResult.grandTotal,
            status: PaymentStatus.CAPTURED,
            paymentMethod: data.paymentMode,
            idempotencyKey: data.idempotencyKey,
          },
        });

        // ── 4e. Post Inventory Ledger entries via InventoryService ─────────
        // CRITICAL: All stock deductions must go through the InventoryService
        // postTransaction to ensure the immutable ledger is always in sync
        // with StockBalance. Raw updateMany is NOT used here.
        for (const item of pricingResult.resolvedItems) {
          await this.inventoryService.postTransaction(
            {
              variantId: item.variantId,
              fromLocationId: data.branchId,
              quantity: Number(item.quantity),
              type: 'SALE' as any,
              referenceId: order.id,
              referenceType: 'SALES_ORDER',
              notes: `POS sale — order ${invoiceNumber}`,
            },
            data.userId,
            tx,
          );
        }

        // ── 4f. Award Loyalty Points (named customer only) ─────────────────
        let loyaltyEarned = 0;
        if (data.customerId && data.customerId !== 'walk-in') {
          // 1 point per ₹20 spent
          loyaltyEarned = Math.floor(Number(pricingResult.grandTotal) / 20);
          if (loyaltyEarned > 0) {
            await tx.loyaltyTransaction.create({
              data: {
                customerId,
                orderId: order.id,
                type: 'EARN',
                points: loyaltyEarned,
                notes: `Earned ${loyaltyEarned} pts from POS order ${invoiceNumber}`,
              },
            });

            await tx.customer.update({
              where: { id: customerId },
              data: { loyaltyPoints: { increment: loyaltyEarned } },
            });
          }
        }

        // ── 4g. Outbox Event ───────────────────────────────────────────────
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'pos.checkout.completed',
            payload: {
              orderId: order.id,
              orderNumber: invoiceNumber,
              branchId: data.branchId,
              customerId,
              grandTotal: Number(pricingResult.grandTotal),
              paymentMode: data.paymentMode,
              itemCount: pricingResult.resolvedItems.length,
            },
            status: 'PENDING',
          },
        });

        return { order, payment, loyaltyEarned };
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return {
      success: true,
      message: 'Checkout completed successfully',
      data: result,
    };
  }

  /**
   * Request a void for a completed POS order.
   * Records void request in a structured JSON field. Manager must approve via approveVoid().
   */
  async requestVoid(orderId: string, reason: string, userId: string) {
    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === SalesOrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already voided/cancelled');
    }
    if (order.status !== SalesOrderStatus.COMPLETED) {
      throw new BadRequestException('Only COMPLETED orders can be void-requested');
    }

    // Store structured void request in notes until VoidRequest model is added (Phase 3)
    // Format: JSON-stringified object so it can be parsed by downstream tooling
    const voidMeta = JSON.stringify({
      event: 'VOID_REQUESTED',
      reason,
      requestedBy: userId,
      requestedAt: new Date().toISOString(),
    });

    return prisma.salesOrder.update({
      where: { id: orderId },
      data: { notes: voidMeta },
    });
  }

  /**
   * Approve a void: atomically cancels the order, refunds payment,
   * and reverses all inventory ledger entries via InventoryService.postTransaction.
   */
  async approveVoid(orderId: string, managerId: string) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status === SalesOrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already voided/cancelled');
    }

    return prisma.$transaction(
      async (tx) => {
        // 1. Atomic state transition: COMPLETED → CANCELLED
        const updateResult = await tx.salesOrder.updateMany({
          where: { id: orderId, status: SalesOrderStatus.COMPLETED },
          data: {
            status: SalesOrderStatus.CANCELLED,
            notes: JSON.stringify({
              event: 'VOID_APPROVED',
              approvedBy: managerId,
              approvedAt: new Date().toISOString(),
            }),
          },
        });

        if (updateResult.count === 0) {
          throw new BadRequestException(
            'Order cannot be voided — it may have already been cancelled or is not in COMPLETED state',
          );
        }

        // 2. Mark payments as REFUNDED
        await tx.payment.updateMany({
          where: { salesOrderId: orderId },
          data: { status: PaymentStatus.REFUNDED },
        });

        // 3. Reverse inventory: post SALE_RETURN entries for each item
        for (const item of order.items) {
          await this.inventoryService.postTransaction(
            {
              variantId: item.variantId,
              toLocationId: order.branchId,
              quantity: Number(item.quantity),
              type: 'SALE_RETURN' as any,
              referenceId: orderId,
              referenceType: 'SALES_ORDER_VOID',
              notes: `Void approved for order ${order.orderNumber}`,
            },
            managerId,
            tx,
          );
        }

        // 4. Reverse loyalty points if applicable
        const loyaltyTx = await tx.loyaltyTransaction.findFirst({
          where: { orderId, type: 'EARN' },
        });

        if (loyaltyTx && loyaltyTx.points > 0) {
          await tx.customer.update({
            where: { id: order.customerId },
            data: { loyaltyPoints: { decrement: loyaltyTx.points } },
          });

          await tx.loyaltyTransaction.create({
            data: {
              customerId: order.customerId,
              orderId: order.id,
              type: 'ADJUST',
              points: -loyaltyTx.points,
              notes: `Points reversed: void of order ${order.orderNumber}`,
            },
          });
        }

        // 5. Outbox event for void completion
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'pos.order.voided',
            payload: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              branchId: order.branchId,
              approvedBy: managerId,
            },
            status: 'PENDING',
          },
        });

        return { success: true, orderId, message: `Order ${order.orderNumber} has been voided` };
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }
}
