import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { prisma } from '@cc-erp/database';
import { ConflictException, NotFoundException } from '@nestjs/common';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    customer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    customerAddress: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomersService],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException if phone exists', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: '1' });

      await expect(service.create({ phone: '123' })).rejects.toThrow(ConflictException);
    });

    it('should create customer if phone and email are unique', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue({ id: '1', phone: '123' });

      const result = await service.create({ phone: '123' });
      expect(result.id).toEqual('1');
    });
  });

  describe('addAddress', () => {
    it('should make address default if it is the first address', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: '1' });
      (prisma.customerAddress.count as jest.Mock).mockResolvedValue(0);
      (prisma.customerAddress.create as jest.Mock).mockImplementation((data) => Promise.resolve({ id: 'a1', ...data.data }));

      const result = await service.addAddress('1', { address: '123 St', label: 'Home', isDefault: false });
      expect(result.isDefault).toBe(true);
      expect(prisma.customerAddress.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isDefault: true })
      });
    });

    it('should set other addresses to not default if new address is default', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: '1' });
      (prisma.customerAddress.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.customerAddress.create as jest.Mock).mockImplementation((data) => Promise.resolve({ id: 'a1', ...data.data }));

      await service.addAddress('1', { address: '123 St', label: 'Home', isDefault: true });
      expect(prisma.customerAddress.updateMany).toHaveBeenCalledWith({
        where: { customerId: '1' },
        data: { isDefault: false }
      });
    });
  });
});
