import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import * as crypto from 'crypto';

@Injectable()
export class LoyaltyService {
  /**
   * Awards loyalty points (1 point per ₹100 spent) upon confirmed order completion.
   */
  async awardPointsForOrder(tx: any, customerId: string, orderId: string, grandTotal: number) {
    const pointsToEarn = Math.floor(grandTotal / 100);
    if (pointsToEarn <= 0) return null;

    try {
      const loyaltyTx = await tx.loyaltyTransaction.create({
        data: {
          customerId,
          orderId,
          type: 'EARN',
          points: pointsToEarn,
          notes: `Earned ${pointsToEarn} points for order ${orderId}`,
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { increment: pointsToEarn } },
      });

      if (tx.outboxEvent) {
        await tx.outboxEvent.create({
          data: {
            eventId: crypto.randomUUID(),
            type: 'crm.loyalty.earned',
            payload: { customerId, orderId, pointsEarned: pointsToEarn },
            status: 'PENDING',
          },
        });
      }

      return { success: true, duplicate: false, loyaltyTx };
    } catch (err: any) {
      if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
        const existingTx = await tx.loyaltyTransaction.findFirst({
          where: { orderId, type: 'EARN' },
        });
        return { success: true, duplicate: true, loyaltyTx: existingTx };
      }
      throw err;
    }
  }

  /**
   * Redeems loyalty points for an order.
   * Enforces ledger-based balance projection and prevents negative balance or concurrency double-redemption.
   */
  async redeemPoints(tx: any, customerId: string, pointsToRedeem: number, orderId?: string, referenceId?: string) {
    if (pointsToRedeem <= 0) {
      throw new BadRequestException('Redemption points must be greater than zero');
    }

    // Atomic Balance Verification from DB
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyPoints: true },
    });

    if (!customer || customer.loyaltyPoints < pointsToRedeem) {
      throw new BadRequestException(`Insufficient loyalty balance. Available: ${customer?.loyaltyPoints || 0}, Required: ${pointsToRedeem}`);
    }

    // Lock update to ensure concurrency protection (100 concurrent requests -> 1 success)
    const updateResult = await tx.customer.updateMany({
      where: {
        id: customerId,
        loyaltyPoints: { gte: pointsToRedeem },
      },
      data: {
        loyaltyPoints: { decrement: pointsToRedeem },
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException('Concurrent loyalty redemption conflict or insufficient points');
    }

    // Ledger Transaction Entry (Negative points for REDEEM)
    const loyaltyTx = await tx.loyaltyTransaction.create({
      data: {
        customerId,
        orderId,
        referenceId,
        type: 'REDEEM',
        points: -pointsToRedeem,
        notes: `Redeemed ${pointsToRedeem} points`,
      },
    });

    if (tx.outboxEvent) {
      await tx.outboxEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          type: 'crm.loyalty.redeemed',
          payload: { customerId, orderId, pointsRedeemed: pointsToRedeem },
          status: 'PENDING',
        },
      });
    }

    return loyaltyTx;
  }

  /**
   * Expires unused loyalty points.
   */
  async expirePoints(tx: any, customerId: string, pointsToExpire: number, notes?: string) {
    if (pointsToExpire <= 0) return null;

    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyPoints: true },
    });

    const actualToExpire = Math.min(customer?.loyaltyPoints || 0, pointsToExpire);
    if (actualToExpire <= 0) return null;

    await tx.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { decrement: actualToExpire } },
    });

    return tx.loyaltyTransaction.create({
      data: {
        customerId,
        type: 'EXPIRE',
        points: -actualToExpire,
        notes: notes || `Expired ${actualToExpire} inactive loyalty points`,
      },
    });
  }

  /**
   * Reverses a previous loyalty transaction safely.
   */
  async reverseTransaction(tx: any, transactionId: string, userId: string, reason: string) {
    const original = await tx.loyaltyTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!original) throw new NotFoundException('Loyalty transaction not found');
    if (original.reversedAt) throw new BadRequestException('Transaction already reversed');

    // Reversal inverts points: if original was +10 (EARN), reversal is -10.
    const reversalPoints = -original.points;

    await tx.loyaltyTransaction.update({
      where: { id: transactionId },
      data: { reversedAt: new Date(), reversedBy: userId },
    });

    await tx.customer.update({
      where: { id: original.customerId },
      data: { loyaltyPoints: { increment: reversalPoints } },
    });

    return tx.loyaltyTransaction.create({
      data: {
        customerId: original.customerId,
        orderId: original.orderId,
        referenceId: original.id,
        type: 'REVERSAL',
        points: reversalPoints,
        notes: `Reversal of transaction ${transactionId}: ${reason}`,
      },
    });
  }

  /**
   * Calculates ledger-based point balance sum for auditing.
   */
  async getLedgerBalance(customerId: string): Promise<number> {
    const aggregate = await prisma.loyaltyTransaction.aggregate({
      where: { customerId },
      _sum: { points: true },
    });

    return aggregate._sum.points || 0;
  }
}
