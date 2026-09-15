import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { prisma, CustomCakeStatus } from '@cc-erp/database';
import { CustomCakesController } from './custom-cakes.controller';
import { CustomCakesService } from '../sales/custom-cakes/custom-cakes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    customer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
  CustomCakeStatus: {
    CANCELLED: 'CANCELLED',
  },
}));

const mockService = {
  createQuote: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  getPipelineSummary: jest.fn(),
  advanceToNextStage: jest.fn(),
  transitionStatus: jest.fn(),
};

function futureDate(hoursAhead: number): string {
  return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
}

function validCreateBody(overrides: Partial<any> = {}) {
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
    quoteAmount: 1000,
    advancePayment: 500,
    ...overrides,
  };
}

const req: any = { user: { sub: 'user-1', organizationId: 'org-1' } };

describe('CustomCakesController', () => {
  let controller: CustomCakesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomCakesController],
      providers: [{ provide: CustomCakesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CustomCakesController>(CustomCakesController);
  });

  describe('create', () => {
    beforeEach(() => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue({ id: 'cust-1', phone: '9999999999' });
      mockService.createQuote.mockImplementation((userId, orgId, dto) =>
        Promise.resolve({ id: 'order-1', status: 'QUOTED', ...dto })
      );
    });

    it('should create an order and delegate to the sales CustomCakesService', async () => {
      const result: any = await controller.create(req, validCreateBody());

      expect(result.status).toBe('QUOTED');
      expect(mockService.createQuote).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        expect.objectContaining({
          customerId: 'cust-1',
          branchId: 'branch-1',
          flavour: 'Chocolate',
          weight: 1.5,
          layers: 1,
          deliveryOrPickup: 'DELIVERY',
          quoteAmount: 1000,
          advancePercentage: 50,
        })
      );
    });

    it('should reuse an existing customer by phone instead of creating a new one', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-cust', phone: '9999999999' });

      await controller.create(req, validCreateBody());

      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(mockService.createQuote).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        expect.objectContaining({ customerId: 'existing-cust' })
      );
    });

    it('should fold the eggless flag into specialInstructions since there is no schema field for it', async () => {
      await controller.create(req, validCreateBody({ eggless: true, specialInstructions: 'No nuts' }));

      expect(mockService.createQuote).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        expect.objectContaining({ specialInstructions: expect.stringContaining('Eggless') })
      );
    });

    it('should reject a 1-layer cake below the 1.0kg minimum weight', async () => {
      await expect(controller.create(req, validCreateBody({ cakeType: '1', weightKg: 0.5 }))).rejects.toThrow(
        BadRequestException
      );
      expect(mockService.createQuote).not.toHaveBeenCalled();
    });

    it('should reject a 2-layer cake below the 1.5kg minimum weight', async () => {
      await expect(controller.create(req, validCreateBody({ cakeType: '2', weightKg: 1.2 }))).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject a 3-layer cake below the 3.0kg minimum weight', async () => {
      await expect(controller.create(req, validCreateBody({ cakeType: '3', weightKg: 2.0 }))).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject a cake weight over 25kg', async () => {
      await expect(controller.create(req, validCreateBody({ cakeType: '1', weightKg: 26 }))).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject a delivery date less than 24 hours away', async () => {
      await expect(
        controller.create(req, validCreateBody({ deliveryDatetime: futureDate(5) }))
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a missing or zero quote amount', async () => {
      await expect(controller.create(req, validCreateBody({ quoteAmount: 0 }))).rejects.toThrow(
        BadRequestException
      );
      expect(mockService.createQuote).not.toHaveBeenCalled();
    });

    it('should compute advancePercentage from the flat advance and quote amounts', async () => {
      await controller.create(req, validCreateBody({ quoteAmount: 2000, advancePayment: 600 }));

      expect(mockService.createQuote).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        expect.objectContaining({ advancePercentage: 30 })
      );
    });
  });

  describe('findAll', () => {
    it('should scope the query to the caller organization', async () => {
      mockService.findAll.mockResolvedValue([]);

      await controller.findAll(req, 'BAKING' as CustomCakeStatus, 'branch-1');

      expect(mockService.findAll).toHaveBeenCalledWith('org-1', 'BAKING', 'branch-1');
    });
  });

  describe('findOne', () => {
    it('should scope the lookup to the caller organization', async () => {
      mockService.findOne.mockResolvedValue({ id: 'order-1' });

      await controller.findOne('order-1', req);

      expect(mockService.findOne).toHaveBeenCalledWith('order-1', 'org-1');
    });
  });

  describe('advanceStatus', () => {
    it('should delegate to advanceToNextStage', async () => {
      mockService.advanceToNextStage.mockResolvedValue({ id: 'order-1', status: 'CONFIRMED' });

      const result: any = await controller.advanceStatus('order-1', req);

      expect(mockService.advanceToNextStage).toHaveBeenCalledWith('order-1', 'user-1');
      expect(result.status).toBe('CONFIRMED');
    });
  });

  describe('cancel', () => {
    it('should transition to CANCELLED with the given reason', async () => {
      mockService.transitionStatus.mockResolvedValue({ id: 'order-1', status: 'CANCELLED' });

      await controller.cancel('order-1', { reason: 'Customer request' }, req);

      expect(mockService.transitionStatus).toHaveBeenCalledWith(
        'order-1',
        CustomCakeStatus.CANCELLED,
        undefined,
        'user-1',
        'Customer request'
      );
    });
  });
});
