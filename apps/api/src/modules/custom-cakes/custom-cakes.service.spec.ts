import { Test, TestingModule } from '@nestjs/testing';
import { CustomCakesService } from './custom-cakes.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    customer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    customCakeOrder: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

function futureDate(hoursAhead: number): string {
  return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
}

function validCreateData(overrides: Partial<any> = {}) {
  return {
    customerName: 'Jane Doe',
    mobileNumber: '9999999999',
    branchId: 'branch-1',
    flavor: 'Chocolate',
    shape: 'Round',
    cakeType: '1',
    weightKg: 1.5,
    eggless: false,
    creamType: 'Whipped',
    specialInstructions: 'No nuts',
    designImageUrl: 'https://example.com/design.png',
    deliveryDatetime: futureDate(48),
    deliveryType: 'DELIVERY' as const,
    advancePayment: 500,
    createdBy: 'user-1',
    ...overrides,
  };
}

describe('CustomCakesService', () => {
  let service: CustomCakesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomCakesService],
    }).compile();

    service = module.get<CustomCakesService>(CustomCakesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    beforeEach(() => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue({ id: 'cust-1', phone: '9999999999' });
      (prisma.customCakeOrder.count as jest.Mock).mockResolvedValue(0);
      (prisma.customCakeOrder.create as jest.Mock).mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'order-1', ...data }),
      );
    });

    it('should create an order successfully with designImageUrl and advancePayment (happy path)', async () => {
      const result: any = await service.create(validCreateData());

      expect(result).toBeDefined();
      expect(prisma.customCakeOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: 'CCO-00001',
            customerId: 'cust-1',
            designImageUrl: 'https://example.com/design.png',
            advancePayment: 500,
            status: 'BOOKED',
          }),
        }),
      );
    });

    it('should reuse an existing customer by phone instead of creating a new one', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-cust', phone: '9999999999' });

      await service.create(validCreateData());

      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(prisma.customCakeOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ customerId: 'existing-cust' }) }),
      );
    });

    it('should generate a sequential order number based on existing count', async () => {
      (prisma.customCakeOrder.count as jest.Mock).mockResolvedValue(41);

      await service.create(validCreateData());

      expect(prisma.customCakeOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ orderNumber: 'CCO-00042' }) }),
      );
    });

    it('should reject a 1-layer cake below the 1.0kg minimum weight', async () => {
      await expect(
        service.create(validCreateData({ cakeType: '1', weightKg: 0.5 })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.customCakeOrder.create).not.toHaveBeenCalled();
    });

    it('should reject a 2-layer cake below the 1.5kg minimum weight', async () => {
      await expect(
        service.create(validCreateData({ cakeType: '2', weightKg: 1.2 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a 3-layer cake below the 3.0kg minimum weight', async () => {
      await expect(
        service.create(validCreateData({ cakeType: '3', weightKg: 2.0 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept a cake exactly at the minimum weight boundary', async () => {
      await expect(service.create(validCreateData({ cakeType: '2', weightKg: 1.5 }))).resolves.toBeDefined();
    });

    it('should reject a delivery date less than 24 hours away', async () => {
      await expect(
        service.create(validCreateData({ deliveryDatetime: futureDate(5) })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a delivery date in the past', async () => {
      await expect(
        service.create(validCreateData({ deliveryDatetime: futureDate(-2) })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a cake weight over 25kg', async () => {
      await expect(
        service.create(validCreateData({ cakeType: '1', weightKg: 26 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept a cake weight exactly at the 25kg maximum', async () => {
      await expect(service.create(validCreateData({ cakeType: '1', weightKg: 25 }))).resolves.toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should exclude cancelled orders and apply status/branch filters', async () => {
      (prisma.customCakeOrder.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll('BAKING', 'branch-1');

      expect(prisma.customCakeOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: 'CANCELLED' }, branchId: 'branch-1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return the order when found', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'BOOKED' });

      const result = await service.findOne('order-1');
      expect(result).toEqual({ id: 'order-1', status: 'BOOKED' });
    });

    it('should throw NotFoundException when order does not exist', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('advanceStatus', () => {
    it('should advance BOOKED -> APPROVED', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'BOOKED' });
      (prisma.customCakeOrder.update as jest.Mock).mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'order-1', ...data }),
      );

      const result: any = await service.advanceStatus('order-1');

      expect(result.status).toBe('APPROVED');
      expect(prisma.customCakeOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'order-1' }, data: expect.objectContaining({ status: 'APPROVED' }) }),
      );
    });

    it('should set deliveredAt when advancing into DELIVERED', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'READY' });
      (prisma.customCakeOrder.update as jest.Mock).mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'order-1', ...data }),
      );

      const result: any = await service.advanceStatus('order-1');

      expect(result.status).toBe('DELIVERED');
      expect(prisma.customCakeOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deliveredAt: expect.any(Date) }) }),
      );
    });

    it('should preserve existing chefNotes when none provided', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        status: 'BOOKED',
        chefNotes: 'existing notes',
      });
      (prisma.customCakeOrder.update as jest.Mock).mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'order-1', ...data }),
      );

      await service.advanceStatus('order-1');

      expect(prisma.customCakeOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ chefNotes: 'existing notes' }) }),
      );
    });

    it('should overwrite chefNotes when explicitly provided', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        status: 'BOOKED',
        chefNotes: 'old',
      });
      (prisma.customCakeOrder.update as jest.Mock).mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'order-1', ...data }),
      );

      await service.advanceStatus('order-1', 'new notes');

      expect(prisma.customCakeOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ chefNotes: 'new notes' }) }),
      );
    });

    it('should reject advancing an order already in the final state (DELIVERED)', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'DELIVERED' });

      await expect(service.advanceStatus('order-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject advancing a CANCELLED order (not part of forward flow)', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'CANCELLED' });

      await expect(service.advanceStatus('order-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.advanceStatus('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignChef', () => {
    it('should assign a chef to an existing order', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'BOOKED' });
      (prisma.customCakeOrder.update as jest.Mock).mockResolvedValue({ id: 'order-1', assignedChefId: 'chef-1' });

      const result: any = await service.assignChef('order-1', 'chef-1');

      expect(result.assignedChefId).toBe('chef-1');
      expect(prisma.customCakeOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { assignedChefId: 'chef-1' },
      });
    });

    it('should throw NotFoundException when the order does not exist', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.assignChef('missing', 'chef-1')).rejects.toThrow(NotFoundException);
      expect(prisma.customCakeOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel an active order and record the reason', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'BOOKED' });
      (prisma.customCakeOrder.update as jest.Mock).mockResolvedValue({
        id: 'order-1',
        status: 'CANCELLED',
        cancellationReason: 'Customer request',
      });

      const result: any = await service.cancel('order-1', 'Customer request');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.customCakeOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'CANCELLED', cancellationReason: 'Customer request' },
      });
    });

    it('should reject cancelling a DELIVERED order', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'DELIVERED' });

      await expect(service.cancel('order-1', 'too late')).rejects.toThrow(BadRequestException);
      expect(prisma.customCakeOrder.update).not.toHaveBeenCalled();
    });

    it('should reject cancelling an already CANCELLED order', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'CANCELLED' });

      await expect(service.cancel('order-1', 'duplicate cancel')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      (prisma.customCakeOrder.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.cancel('missing', 'reason')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPipelineSummary', () => {
    it('should aggregate counts per status excluding CANCELLED', async () => {
      (prisma.customCakeOrder.groupBy as jest.Mock).mockResolvedValue([
        { status: 'BOOKED', _count: 3 },
        { status: 'BAKING', _count: 2 },
      ]);

      const result = await service.getPipelineSummary();

      expect(prisma.customCakeOrder.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: { not: 'CANCELLED' } } }),
      );
      expect(result).toEqual({ BOOKED: 3, BAKING: 2 });
    });

    it('should return an empty object when there are no orders', async () => {
      (prisma.customCakeOrder.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getPipelineSummary();

      expect(result).toEqual({});
    });
  });
});
