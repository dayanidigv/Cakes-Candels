import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreatePurchaseOrderDto } from './dto/procurement.dto';

@Injectable()
export class PurchaseOrdersService {
  
  async createPurchaseOrder(dto: CreatePurchaseOrderDto, userId: string) {
    if (dto.items.length === 0) throw new BadRequestException('PO must have at least one item');
    
    // Verify supplier and branch
    const supplier = await prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const branch = await prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    const totalAmount = dto.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    
    let poNumber = `PO-${Date.now()}`;
    const numberSeries = await prisma.numberSeries.findFirst({
      where: { documentType: 'PO', isActive: true, OR: [{ branchId: dto.branchId }, { branchId: null }] },
      orderBy: { branchId: 'asc' }
    });

    if (numberSeries) {
      const nextNum = numberSeries.currentNumber + 1;
      poNumber = `${numberSeries.prefix}${nextNum.toString().padStart(numberSeries.length, '0')}${numberSeries.suffix || ''}`;
      await prisma.numberSeries.update({ where: { id: numberSeries.id }, data: { currentNumber: nextNum } });
    }

    return prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: dto.supplierId,
        branchId: dto.branchId,
        totalAmount,
        notes: dto.notes,
        createdBy: userId,
        status: 'SUBMITTED', // Auto-submit for now
        items: {
          create: dto.items.map(item => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice
          }))
        }
      },
      include: { items: true }
    });
  }

  async getPurchaseOrders(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.branchId) where.branchId = query.branchId;

    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { name: true } },
          branch: { select: { name: true } }
        }
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPurchaseOrderById(id: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        branch: true,
        items: {
          include: { variant: true }
        },
        grns: true
      }
    });
    if (!po) throw new NotFoundException('PO not found');
    return po;
  }

  async approvePurchaseOrder(id: string, userId: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException('PO not found');
    if (po.status !== 'SUBMITTED') throw new BadRequestException('Only SUBMITTED POs can be approved');

    return prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date()
      }
    });
  }
}
