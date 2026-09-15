import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { prisma } from '@cc-erp/database';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    recipeMaster: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    supplier: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    vehicle: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    productAttribute: {
      count: jest.fn(),
    },
    approvalWorkflow: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    numberSeries: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
  },
}));

describe('DashboardService', () => {
  let service: DashboardService;

  const mockRandom = (value: number) => jest.spyOn(Math, 'random').mockReturnValue(value);

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService],
    }).compile();

    service = module.get<DashboardService>(DashboardService);

    (prisma.recipeMaster.count as jest.Mock).mockResolvedValue(5);
    (prisma.supplier.count as jest.Mock).mockResolvedValue(3);
    (prisma.vehicle.count as jest.Mock).mockResolvedValue(2);
    (prisma.productAttribute.count as jest.Mock).mockResolvedValue(7);
    (prisma.approvalWorkflow.count as jest.Mock).mockResolvedValue(1);
    (prisma.numberSeries.count as jest.Mock).mockResolvedValue(4);

    (prisma.recipeMaster.findMany as jest.Mock).mockResolvedValue([
      { id: 'r1', name: 'Chocolate Cake' },
    ]);
    (prisma.supplier.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', name: 'Acme Supplies' },
    ]);
    (prisma.vehicle.findMany as jest.Mock).mockResolvedValue([
      { id: 'v1', registrationNumber: 'KA-01-1234', driverName: 'Ravi' },
      { id: 'v2', registrationNumber: 'KA-01-5678', driverName: null },
    ]);
    (prisma.approvalWorkflow.findMany as jest.Mock).mockResolvedValue([
      { id: 'w1', moduleName: 'Wastage' },
    ]);
    (prisma.numberSeries.findMany as jest.Mock).mockResolvedValue([
      { id: 'n1', documentType: 'SO', prefix: 'SO-', currentNumber: 42 },
    ]);
    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
      { id: 'a1', action: 'CREATE', entity: 'Product', timestamp: new Date('2026-01-01T00:00:00Z') },
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('should aggregate metric counts from the active-only queries', async () => {
      const result = await service.getOverview();

      expect(prisma.recipeMaster.count).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(prisma.supplier.count).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(prisma.vehicle.count).toHaveBeenCalledWith({ where: { status: 'ACTIVE' } });
      expect(prisma.productAttribute.count).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(prisma.approvalWorkflow.count).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(prisma.numberSeries.count).toHaveBeenCalledWith({ where: { isActive: true } });

      expect(result.metrics).toEqual({
        recipes: 5,
        suppliers: 3,
        vehicles: 2,
        attributes: 7,
        workflows: 1,
        numberSeries: 4,
      });
    });

    it('should map recent recipes into an activity-feed shape', async () => {
      const result = await service.getOverview();

      expect(result.recentRecipes).toEqual([
        { name: 'System Admin', action: 'Edited Chocolate Cake', img: 'https://i.pravatar.cc/150?u=1' },
      ]);
    });

    it('should map active vehicles, defaulting an unassigned driver', async () => {
      const result = await service.getOverview();

      expect(result.activeVehicles).toEqual([
        { loc: 'KA-01-1234', driver: 'Ravi' },
        { loc: 'KA-01-5678', driver: 'Unassigned' },
      ]);
    });

    it('should map the audit log into an activity feed with formatted dates', async () => {
      const result = await service.getOverview();

      expect(result.activityLog).toEqual([
        { user: 'Admin User', action: 'CREATE', target: 'Product', time: '2026-01-01', img: 'https://i.pravatar.cc/150?u=log0' },
      ]);
    });

    it('should map number series into a range display string', async () => {
      const result = await service.getOverview();

      expect(result.numberSeries).toEqual([
        { name: 'SO', range: 'SO- - 42', stat: 'Active', time: 'Today' },
      ]);
    });

    // KNOWN STUB: topSuppliers.count is generated with Math.random() rather than a real purchase-order
    // aggregation ("Mocked order count until PO system fully integrated" in dashboard.service.ts). This
    // test locks in current (stub) behavior — that the count is a random integer in [1, 20] — it does not
    // assert this is meaningful business data.
    describe('topSuppliers (KNOWN STUB)', () => {
      it('should return the supplier name with a random mock order count between 1 and 20', async () => {
        mockRandom(0); // Math.floor(0 * 20) + 1 = 1 (lower bound)

        const result = await service.getOverview();

        expect(result.topSuppliers).toEqual([{ name: 'Acme Supplies', count: 1 }]);
      });

      it('should produce the upper bound count when Math.random returns just under 1', async () => {
        mockRandom(0.999999);

        const result = await service.getOverview();

        expect(result.topSuppliers[0].count).toBe(20);
      });
    });

    // KNOWN STUB: sparklineData, attributeData and pieData are static hardcoded arrays, unrelated to any
    // query result ("Static Mock Chart Data (Requires complex TSDB aggregation in production)" comment in
    // dashboard.service.ts). This test documents that the current output is always this fixed literal
    // data — it is not validating that the data reflects real activity.
    describe('static mock chart data (KNOWN STUB)', () => {
      it('should always return the same hardcoded sparkline, attribute and pie chart data', async () => {
        const result = await service.getOverview();

        expect(result.sparklineData).toEqual([
          { v: 10 }, { v: 15 }, { v: 8 }, { v: 25 }, { v: 18 }, { v: 30 }, { v: 28 }, { v: 40 }, { v: 35 },
        ]);
        expect(result.attributeData).toHaveLength(7);
        expect(result.attributeData[0]).toEqual({ name: 'Mon', a: 40, b: 24, c: 24 });
        expect(result.pieData).toEqual([
          { name: 'Draft', value: 40, color: '#3b82f6' },
          { name: 'In Review', value: 30, color: '#14b8a6' },
          { name: 'Approved', value: 20, color: '#f59e0b' },
          { name: 'Rejected', value: 10, color: '#ef4444' },
        ]);
      });
    });
  });
});
