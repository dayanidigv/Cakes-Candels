import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma, PosShiftStatus } from '@cc-erp/database';
import { Decimal } from '@prisma/client/runtime/library';

export interface OpenShiftDto {
  branchId: string;
  cashierId: string;
  openingCash: number;
}

export interface CashMovementDto {
  shiftId: string;
  type: 'CASH_IN' | 'CASH_OUT';
  amount: number;
  reason: string;
  userId: string;
}

export interface CloseShiftDto {
  shiftId: string;
  actualCash: number;
  approvedBy?: string;
  notes?: string;
}

@Injectable()
export class PosShiftService {
  async openShift(dto: OpenShiftDto) {
    const existingOpenShift = await prisma.posShift.findFirst({
      where: {
        branchId: dto.branchId,
        cashierId: dto.cashierId,
        status: { in: [PosShiftStatus.OPEN, PosShiftStatus.ACTIVE] },
      },
    });

    if (existingOpenShift) {
      throw new BadRequestException('Cashier already has an active open shift at this branch');
    }

    return prisma.posShift.create({
      data: {
        branchId: dto.branchId,
        cashierId: dto.cashierId,
        status: PosShiftStatus.ACTIVE,
        openingCash: new Decimal(dto.openingCash),
      },
      include: { branch: true },
    });
  }

  async addCashMovement(dto: CashMovementDto) {
    const shift = await prisma.posShift.findUnique({ where: { id: dto.shiftId } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status === PosShiftStatus.CLOSED) {
      throw new BadRequestException('Cannot record cash movement on a CLOSED shift');
    }

    return prisma.posShiftCashMovement.create({
      data: {
        shiftId: dto.shiftId,
        type: dto.type,
        amount: new Decimal(dto.amount),
        reason: dto.reason,
        createdBy: dto.userId,
      },
    });
  }

  async closeShift(dto: CloseShiftDto) {
    const shift = await prisma.posShift.findUnique({
      where: { id: dto.shiftId },
      include: { cashMovements: true, orders: { include: { payments: true } } },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status === PosShiftStatus.CLOSED) {
      throw new BadRequestException('Shift is already CLOSED');
    }

    // Calculate expected cash = openingCash + cash Sales + CashIn - CashOut
    let totalCashSales = new Decimal(0);
    for (const order of shift.orders) {
      for (const payment of order.payments) {
        if (payment.paymentMethod === 'CASH' && payment.status === 'CAPTURED') {
          totalCashSales = totalCashSales.add(payment.amount);
        }
      }
    }

    let cashIn = new Decimal(0);
    let cashOut = new Decimal(0);
    for (const movement of shift.cashMovements) {
      if (movement.type === 'CASH_IN') cashIn = cashIn.add(movement.amount);
      if (movement.type === 'CASH_OUT') cashOut = cashOut.add(movement.amount);
    }

    const expectedCash = new Decimal(shift.openingCash)
      .add(totalCashSales)
      .add(cashIn)
      .sub(cashOut);

    const actualCash = new Decimal(dto.actualCash);
    const variance = actualCash.sub(expectedCash);

    return prisma.posShift.update({
      where: { id: dto.shiftId },
      data: {
        status: PosShiftStatus.CLOSED,
        expectedCash,
        actualCash,
        variance,
        closedAt: new Date(),
        approvedBy: dto.approvedBy,
        notes: dto.notes,
      },
    });
  }

  async getActiveShift(branchId: string, cashierId: string) {
    return prisma.posShift.findFirst({
      where: {
        branchId,
        cashierId,
        status: { in: [PosShiftStatus.OPEN, PosShiftStatus.ACTIVE] },
      },
      include: { cashMovements: true },
    });
  }
}
