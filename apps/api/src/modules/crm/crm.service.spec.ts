import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CrmService, LOYALTY_TYPE } from './crm.service';
import { prisma } from '@cc-erp/database';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    customer: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    salesOrder: {
      aggregate: jest.fn(),
    },
    loyaltyTransaction: {
      aggregate: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('CrmService', () => {
  let service: CrmService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CrmService],
    }).compile();

    service = module.get<CrmService>(CrmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCustomerByPhone', () => {
    it('should return a customer enriched with spend, loyalty and segment', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
        id: 'cust-1',
        phone: '9999999999',
        addresses: [],
        salesOrders: [],
      });
      (prisma.salesOrder.aggregate as jest.Mock).mockResolvedValue({ _sum: { grandTotal: 6000 } });
      (prisma.loyaltyTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 120 } });

      const result = await service.getCustomerByPhone('9999999999');

      expect(prisma.customer.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phone: '9999999999' } }),
      );
      expect(result.totalSpend).toBe(6000);
      expect(result.loyaltyPoints).toBe(120);
      expect(result.segment).toBe('SILVER'); // 6000 >= 5000
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getCustomerByPhone('0000000000')).rejects.toThrow(NotFoundException);
    });

    it('should classify a high spender as VIP', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: 'cust-2', phone: '111' });
      (prisma.salesOrder.aggregate as jest.Mock).mockResolvedValue({ _sum: { grandTotal: 31000 } });
      (prisma.loyaltyTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 0 } });

      const result = await service.getCustomerByPhone('111');
      expect(result.segment).toBe('VIP');
    });

    it('should classify a zero spender as BRONZE', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: 'cust-3', phone: '222' });
      (prisma.salesOrder.aggregate as jest.Mock).mockResolvedValue({ _sum: { grandTotal: null } });
      (prisma.loyaltyTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: null } });

      const result = await service.getCustomerByPhone('222');
      expect(result.totalSpend).toBe(0);
      expect(result.loyaltyPoints).toBe(0);
      expect(result.segment).toBe('BRONZE');
    });
  });

  describe('getAllCustomers', () => {
    it('should return only active customers when no search term is given', async () => {
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([{ id: 'c1' }]);
      (prisma.salesOrder.aggregate as jest.Mock).mockResolvedValue({ _sum: { grandTotal: 0 } });
      (prisma.loyaltyTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 0 } });

      await service.getAllCustomers();

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('should apply a case-insensitive OR search filter across phone/name/email', async () => {
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);

      await service.getAllCustomers('john');

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              { phone: { contains: 'john', mode: 'insensitive' } },
              { fullName: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should enrich every returned customer with spend/loyalty/segment', async () => {
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      (prisma.salesOrder.aggregate as jest.Mock).mockResolvedValue({ _sum: { grandTotal: 16000 } });
      (prisma.loyaltyTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 50 } });

      const result = await service.getAllCustomers();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ totalSpend: 16000, loyaltyPoints: 50, segment: 'GOLD' });
    });
  });

  describe('getLoyaltyBalance', () => {
    it('should sum points from the ledger', async () => {
      (prisma.loyaltyTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 75 } });

      const result = await service.getLoyaltyBalance('cust-1');

      expect(result).toBe(75);
      expect(prisma.loyaltyTransaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: 'cust-1' } }),
      );
    });

    it('should return 0 if the aggregate query rejects', async () => {
      (prisma.loyaltyTransaction.aggregate as jest.Mock).mockRejectedValue(new Error('db down'));

      const result = await service.getLoyaltyBalance('cust-1');
      expect(result).toBe(0);
    });
  });

  describe('awardLoyaltyPoints', () => {
    it('should award floor(orderTotal / 10) points using the canonical EARN type', async () => {
      (prisma.loyaltyTransaction.create as jest.Mock).mockResolvedValue({ id: 'ltx-1' });
      (prisma.customer.update as jest.Mock).mockResolvedValue({});

      const result = await service.awardLoyaltyPoints('cust-1', 'order-1', 199);

      expect(result.points).toBe(19);
      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
            orderId: 'order-1',
            type: LOYALTY_TYPE.EARN,
            points: 19,
          }),
        }),
      );
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { loyaltyPoints: { increment: 19 } },
      });
    });

    it('should return zero points without touching the database for a sub-₹10 order', async () => {
      const result = await service.awardLoyaltyPoints('cust-1', 'order-1', 5);

      expect(result).toEqual({ points: 0 });
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
    });

    it('should swallow errors and still return the computed points if the write fails', async () => {
      (prisma.loyaltyTransaction.create as jest.Mock).mockRejectedValue(new Error('unique constraint'));

      const result = await service.awardLoyaltyPoints('cust-1', 'order-1', 100);

      expect(result).toEqual({ points: 10 });
    });
  });

  describe('getTodaysBirthdayCustomers', () => {
    it('should return only customers whose birthday matches today (month/day)', async () => {
      const today = new Date();
      const todayBirthdayYear2000 = new Date(2000, today.getMonth(), today.getDate());
      const notTodayBirthday = new Date(2000, (today.getMonth() + 1) % 12, 15);

      (prisma.customer.findMany as jest.Mock).mockResolvedValue([
        { id: 'c1', fullName: 'A', phone: '1', email: null, birthday: todayBirthdayYear2000 },
        { id: 'c2', fullName: 'B', phone: '2', email: null, birthday: notTodayBirthday },
      ]);

      const result = await service.getTodaysBirthdayCustomers();

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, birthday: { not: null } } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });
  });

  describe('getTodaysAnniversaryCustomers', () => {
    it('should return only customers whose anniversary matches today (month/day)', async () => {
      const today = new Date();
      const todayAnniversary = new Date(2015, today.getMonth(), today.getDate());
      const notTodayAnniversary = new Date(2015, (today.getMonth() + 2) % 12, 20);

      (prisma.customer.findMany as jest.Mock).mockResolvedValue([
        { id: 'c1', fullName: 'A', phone: '1', email: null, anniversary: todayAnniversary },
        { id: 'c2', fullName: 'B', phone: '2', email: null, anniversary: notTodayAnniversary },
      ]);

      const result = await service.getTodaysAnniversaryCustomers();

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, anniversary: { not: null } } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });
  });

  // KNOWN STUB: campaign creation/listing does not touch the database at all — createCampaign
  // fabricates an in-memory object (TODO[Phase 4]: real NotificationQueue insert) and getCampaigns
  // returns hardcoded literal mock rows (TODO[Phase 4]: real CRM campaign model query). These tests
  // lock in the CURRENT stub behavior so regressions are caught; they do not assert this is correct
  // production behavior, and should be rewritten once Phase 4 lands a real implementation.
  describe('createCampaign (KNOWN STUB)', () => {
    it('should return a fabricated QUEUED campaign object without hitting the database', async () => {
      const dto = {
        name: 'Diwali Blast',
        channel: 'WHATSAPP',
        templateContent: 'Hello {{name}}',
      };

      const result = await service.createCampaign(dto);

      expect(result).toMatchObject({
        name: 'Diwali Blast',
        channel: 'WHATSAPP',
        templateContent: 'Hello {{name}}',
        status: 'QUEUED',
        scheduledAt: null,
        sentCount: 0,
      });
      expect(result.id).toMatch(/^CAMP-\d+$/);
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('getCampaigns (KNOWN STUB)', () => {
    it('should return the hardcoded mock campaign list', async () => {
      const result = await service.getCampaigns();

      expect(result).toEqual([
        { id: 'CAMP-001', name: 'June Birthday Blast', channel: 'WHATSAPP', status: 'SENT', sentCount: 45, createdAt: '2026-06-01T10:00:00Z' },
        { id: 'CAMP-002', name: 'Festive Offer - VIP', channel: 'WHATSAPP', status: 'SENT', sentCount: 12, createdAt: '2026-07-14T10:00:00Z' },
        { id: 'CAMP-003', name: 'New Product Launch', channel: 'SMS', status: 'QUEUED', sentCount: 0, createdAt: '2026-08-01T10:00:00Z' },
      ]);
    });
  });

  describe('getSegments', () => {
    it('should return the four static loyalty tiers in ascending spend order', () => {
      const result = service.getSegments();

      expect(result).toHaveLength(4);
      expect(result.map((s) => s.code)).toEqual(['BRONZE', 'SILVER', 'GOLD', 'VIP']);
      expect(result[0].minSpend).toBe(0);
      expect(result[3].minSpend).toBe(30000);
    });
  });
});
