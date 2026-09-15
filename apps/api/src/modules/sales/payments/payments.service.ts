import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { prisma, PaymentStatus } from '@cc-erp/database';
import { Decimal } from '@prisma/client/runtime/library';
import { OrdersService } from '../orders/orders.service';
import { LoyaltyService } from '../crm/loyalty.service';
import { ConfigService } from '../../../config/config.service';
import * as crypto from 'crypto';

export interface CreatePaymentIntentDto {
  salesOrderId: string;
  gateway?: 'RAZORPAY' | 'STRIPE' | 'MOCK';
}

export interface ProcessWebhookDto {
  eventId: string;
  signature: string;
  payload: {
    gatewayRef: string;
    salesOrderId: string;
    amount: number;
    paymentMethod: string;
  };
}

@Injectable()
export class PaymentsService {
  private readonly webhookSecret: string;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly loyaltyService: LoyaltyService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.paymentWebhookSecret;
  }

  async createPaymentIntent(dto: CreatePaymentIntentDto) {
    const order = await prisma.salesOrder.findUnique({ where: { id: dto.salesOrderId } });
    if (!order) throw new NotFoundException('Sales order not found');

    const intent = await prisma.paymentIntent.create({
      data: {
        salesOrderId: dto.salesOrderId,
        amount: order.grandTotal,
        currency: order.currency,
        gateway: dto.gateway || 'MOCK',
        clientSecret: `secret_${crypto.randomUUID()}`,
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 mins expiry
      },
    });

    return intent;
  }

  verifySignature(rawPayload: string, signature: string): boolean {
    if (!signature) return false;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawPayload)
      .digest('hex');
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  }

  async processWebhook(dto: ProcessWebhookDto, rawPayloadString: string) {
    try {
      // 1. HMAC-SHA256 Signature Verification
      const isValidSignature = this.verifySignature(rawPayloadString, dto.signature);
      if (!isValidSignature) {
        throw new UnauthorizedException('Invalid payment webhook signature');
      }

      // 2. Idempotency Check via PaymentWebhookEvent
      const existingEvent = await prisma.paymentWebhookEvent.findUnique({
        where: { eventId: dto.eventId },
      }).catch(() => null);
      if (existingEvent) {
        const existingPayment = await prisma.payment.findFirst({
          where: { gatewayRef: dto.payload.gatewayRef },
        });
        return { success: true, duplicate: true, payment: existingPayment };
      }

      // 3. Atomic Webhook Registration
      const eventRecord = await prisma.paymentWebhookEvent.create({
        data: { eventId: dto.eventId },
      }).catch(() => null);

      if (!eventRecord) {
        let existingPayment = null;
        for (let i = 0; i < 40; i++) {
          existingPayment = await prisma.payment.findFirst({
            where: { gatewayRef: dto.payload.gatewayRef },
          });
          if (existingPayment) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        return { success: true, duplicate: true, payment: existingPayment };
      }

      // 4. Confirm order status via SalesEngine
      let confirmedOrder;
      try {
        confirmedOrder = await this.ordersService.transitionStatus(
          dto.payload.salesOrderId,
          'CONFIRMED' as any,
          `webhook-${dto.eventId}`,
          crypto.randomUUID()
        );
      } catch (err: any) {
        for (let i = 0; i < 40; i++) {
          confirmedOrder = await prisma.salesOrder.findUnique({ where: { id: dto.payload.salesOrderId } });
          if (confirmedOrder?.status === 'CONFIRMED' || confirmedOrder?.status === 'COMPLETED') break;
          await new Promise((r) => setTimeout(r, 50));
        }
        if (confirmedOrder?.status !== 'CONFIRMED' && confirmedOrder?.status !== 'COMPLETED') {
          throw err;
        }
      }

      if (!confirmedOrder) throw new NotFoundException('Sales order not found for payment');

      // 5. Create Payment record (findFirst or create for unique constraint safety)
      let payment = await prisma.payment.findFirst({
        where: { gatewayRef: dto.payload.gatewayRef },
      });

      if (!payment) {
        payment = await prisma.payment.create({
          data: {
            salesOrderId: confirmedOrder.id,
            amount: new Decimal(dto.payload.amount),
            status: PaymentStatus.CAPTURED,
            paymentMethod: dto.payload.paymentMethod || 'UPI',
            gatewayRef: dto.payload.gatewayRef,
            idempotencyKey: dto.eventId,
            rawGatewayPayload: dto.payload as any,
          },
        }).catch((err) => {
          console.error('CRITICAL PAYMENT CREATE ERR LOG:', err);
          return null;
        });
      }

      // 6. Award Loyalty Points if customer attached
      if (confirmedOrder.customerId) {
        await this.loyaltyService.awardPointsForOrder(
          prisma,
          confirmedOrder.customerId,
          confirmedOrder.id,
          Number(dto.payload.amount)
        );
      }

      // 7. Emit Payment Captured Outbox Event
      if (prisma.outboxEvent) {
        await prisma.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'sales.payment.captured',
            payload: {
              paymentId: payment.id,
              salesOrderId: confirmedOrder.id,
              amount: Number(payment.amount),
              gatewayRef: dto.payload.gatewayRef,
            },
            status: 'PENDING',
          },
        });
      }

      return { success: true, duplicate: false, payment };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }
}
