import { Test, TestingModule } from '@nestjs/testing';
import { LogisticsService } from './logistics.service';
import { InventoryService } from '../inventory/inventory.service';
import { NumberSeriesService } from '../masters/number-series/number-series.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { AuthorizationContext } from '../../common/interfaces/authorization-context.interface';

jest.mock('@cc-erp/database', () => ({
  prisma: {
    branch: {
      findUnique: jest.fn(),
    },
    vehicle: {
      findUnique: jest.fn(),
    },
    dispatch: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    dispatchItem: {
      update: jest.fn(),
    },
    outboxEvent: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => {
      const tx = {
        dispatch: prisma.dispatch,
        dispatchItem: prisma.dispatchItem,
        outboxEvent: prisma.outboxEvent,
        auditLog: prisma.auditLog,
      };
      return callback(tx);
    }),
  },
  DispatchStatus: {},
}));

const ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const FROM_BRANCH = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TO_BRANCH = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function baseCtx(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return {
    organizationId: ORG_ID,
    userId: USER_ID,
    scope: 'GLOBAL',
    branchId: FROM_BRANCH,
    permissions: [],
    ...overrides,
  };
}

describe('LogisticsService', () => {
  let service: LogisticsService;
  let inventoryService: InventoryService;
  let numberSeriesService: NumberSeriesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogisticsService,
        {
          provide: InventoryService,
          useValue: {
            postTransaction: jest.fn(),
          },
        },
        {
          provide: NumberSeriesService,
          useValue: {
            generateNextNumber: jest.fn().mockResolvedValue('DISP-00001'),
          },
        },
      ],
    }).compile();

    service = module.get<LogisticsService>(LogisticsService);
    inventoryService = module.get<InventoryService>(InventoryService);
    numberSeriesService = module.get<NumberSeriesService>(NumberSeriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDispatch', () => {
    const validData = {
      fromBranchId: FROM_BRANCH,
      toBranchId: TO_BRANCH,
      items: [{ variantId: 'var-1', quantityDispatched: 10 }],
    };

    beforeEach(() => {
      (prisma.branch.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
        if (where.id === FROM_BRANCH) return Promise.resolve({ id: FROM_BRANCH, organizationId: ORG_ID });
        if (where.id === TO_BRANCH) return Promise.resolve({ id: TO_BRANCH, organizationId: ORG_ID });
        return Promise.resolve(null);
      });
      (prisma.dispatch.create as jest.Mock).mockResolvedValue({
        id: 'dispatch-1',
        dispatchNumber: 'DISP-00001',
        status: 'PACKED',
        items: [{ id: 'item-1', variantId: 'var-1', quantityDispatched: 10 }],
      });
      (prisma.outboxEvent.create as jest.Mock).mockResolvedValue({});
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
    });

    it('should create a dispatch successfully (happy path) and write outbox event + audit log', async () => {
      const result = await service.createDispatch(validData, baseCtx());

      expect(result).toBeDefined();
      expect(prisma.dispatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dispatchNumber: 'DISP-00001',
            organizationId: ORG_ID,
            fromBranchId: FROM_BRANCH,
            toBranchId: TO_BRANCH,
            status: 'PACKED',
          }),
        }),
      );
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'logistics.dispatch.created', status: 'PENDING' }),
        }),
      );
      // Regression test: audit log must be written via helper with schema-correct fields only
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            module: 'LOGISTICS',
            entity: 'DISPATCH',
            entityId: 'dispatch-1',
            action: 'CREATE',
            performedBy: expect.any(String),
            branchId: FROM_BRANCH,
          }),
        }),
      );
      const auditCallData = (prisma.auditLog.create as jest.Mock).mock.calls[0][0].data;
      expect(auditCallData).not.toHaveProperty('organizationId');
      expect(auditCallData).not.toHaveProperty('userId');
      expect(auditCallData).not.toHaveProperty('reason');
    });

    it('should not throw even though audit log write occurs inside the transaction', async () => {
      await expect(service.createDispatch(validData, baseCtx())).resolves.toBeDefined();
    });

    it('should reject an empty items array', async () => {
      await expect(
        service.createDispatch({ ...validData, items: [] }, baseCtx()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when source and destination branches are the same', async () => {
      await expect(
        service.createDispatch({ ...validData, toBranchId: FROM_BRANCH }, baseCtx()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject cross-org branches with ForbiddenException', async () => {
      (prisma.branch.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
        if (where.id === FROM_BRANCH) return Promise.resolve({ id: FROM_BRANCH, organizationId: ORG_ID });
        if (where.id === TO_BRANCH) return Promise.resolve({ id: TO_BRANCH, organizationId: 'other-org' });
        return Promise.resolve(null);
      });

      await expect(service.createDispatch(validData, baseCtx())).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when source branch does not exist', async () => {
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createDispatch(validData, baseCtx())).rejects.toThrow(NotFoundException);
    });

    it('should reject BRANCH-scope user dispatching from a branch that is not theirs', async () => {
      const ctx = baseCtx({ scope: 'BRANCH', branchId: 'some-other-branch' });

      await expect(service.createDispatch(validData, ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should allow BRANCH-scope user dispatching from their own branch', async () => {
      const ctx = baseCtx({ scope: 'BRANCH', branchId: FROM_BRANCH });

      await expect(service.createDispatch(validData, ctx)).resolves.toBeDefined();
    });

    it('should reject an inactive vehicle', async () => {
      (prisma.vehicle.findUnique as jest.Mock).mockResolvedValue({ id: 'veh-1', isActive: false });

      await expect(
        service.createDispatch({ ...validData, vehicleId: 'veh-1' }, baseCtx()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when vehicle does not exist', async () => {
      (prisma.vehicle.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createDispatch({ ...validData, vehicleId: 'veh-missing' }, baseCtx()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should proceed when vehicle is active', async () => {
      (prisma.vehicle.findUnique as jest.Mock).mockResolvedValue({ id: 'veh-1', isActive: true });

      await expect(
        service.createDispatch({ ...validData, vehicleId: 'veh-1' }, baseCtx()),
      ).resolves.toBeDefined();
    });

    it('should return the existing dispatch when idempotencyKey matches (idempotent replay)', async () => {
      const existingDispatch = { id: 'dispatch-existing', idempotencyKey: 'idem-1', status: 'PACKED' };
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue(existingDispatch);

      const result = await service.createDispatch(
        { ...validData, idempotencyKey: 'idem-1' },
        baseCtx(),
      );

      expect(result).toBe(existingDispatch);
      expect(prisma.dispatch.create).not.toHaveBeenCalled();
    });

    it('should proceed to create when idempotencyKey does not match an existing dispatch', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createDispatch({ ...validData, idempotencyKey: 'idem-new' }, baseCtx()),
      ).resolves.toBeDefined();
      expect(prisma.dispatch.create).toHaveBeenCalled();
    });
  });

  describe('dispatchShipment (PACKED -> DISPATCHED)', () => {
    const dispatchRecord = {
      id: 'dispatch-1',
      organizationId: ORG_ID,
      fromBranchId: FROM_BRANCH,
      toBranchId: TO_BRANCH,
      status: 'PACKED',
      dispatchNumber: 'DISP-00001',
      items: [{ id: 'item-1', variantId: 'var-1', quantityDispatched: 10, batchId: null }],
    };

    beforeEach(() => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue(dispatchRecord);
      (prisma.dispatch.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.outboxEvent.create as jest.Mock).mockResolvedValue({});
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
    });

    it('should transition PACKED -> DISPATCHED and call inventoryService.postTransaction with TRANSFER_OUT', async () => {
      await service.dispatchShipment('dispatch-1', baseCtx());

      expect(prisma.dispatch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dispatch-1', status: 'PACKED' },
          data: expect.objectContaining({ status: 'DISPATCHED' }),
        }),
      );
      expect(inventoryService.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          variantId: 'var-1',
          fromLocationId: FROM_BRANCH,
          quantity: 10,
          type: 'TRANSFER_OUT',
          referenceId: 'dispatch-1',
        }),
        baseCtx().userId,
        expect.any(Object),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ module: 'LOGISTICS', action: 'UPDATE', entityId: 'dispatch-1' }),
        }),
      );
    });

    it('should not throw during a valid transition (regression: audit helper does not crash)', async () => {
      await expect(service.dispatchShipment('dispatch-1', baseCtx())).resolves.not.toThrow();
    });

    it('should reject when dispatch is not in PACKED status', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue({ ...dispatchRecord, status: 'DISPATCHED' });

      await expect(service.dispatchShipment('dispatch-1', baseCtx())).rejects.toThrow(BadRequestException);
    });

    it('should reject on concurrent update (updateMany count 0)', async () => {
      (prisma.dispatch.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(service.dispatchShipment('dispatch-1', baseCtx())).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when dispatch does not exist', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.dispatchShipment('missing', baseCtx())).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for cross-org access', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue({ ...dispatchRecord, organizationId: 'other-org' });

      await expect(service.dispatchShipment('dispatch-1', baseCtx())).rejects.toThrow(ForbiddenException);
    });

    it('should reject BRANCH-scope user not at source branch', async () => {
      const ctx = baseCtx({ scope: 'BRANCH', branchId: 'not-source' });

      await expect(service.dispatchShipment('dispatch-1', ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markInTransit (DISPATCHED -> ON_THE_WAY)', () => {
    const dispatchRecord = {
      id: 'dispatch-1',
      organizationId: ORG_ID,
      fromBranchId: FROM_BRANCH,
      toBranchId: TO_BRANCH,
      status: 'DISPATCHED',
    };

    beforeEach(() => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue(dispatchRecord);
      (prisma.dispatch.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
    });

    it('should transition DISPATCHED -> ON_THE_WAY', async () => {
      await service.markInTransit('dispatch-1', baseCtx());

      expect(prisma.dispatch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dispatch-1', status: 'DISPATCHED' },
          data: expect.objectContaining({ status: 'ON_THE_WAY' }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should reject when dispatch is not DISPATCHED', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue({ ...dispatchRecord, status: 'PACKED' });

      await expect(service.markInTransit('dispatch-1', baseCtx())).rejects.toThrow(BadRequestException);
    });

    it('should reject on concurrent update', async () => {
      (prisma.dispatch.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(service.markInTransit('dispatch-1', baseCtx())).rejects.toThrow(BadRequestException);
    });

    it('should reject BRANCH-scope user not involved in the dispatch', async () => {
      const ctx = baseCtx({ scope: 'BRANCH', branchId: 'unrelated-branch' });

      await expect(service.markInTransit('dispatch-1', ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should allow BRANCH-scope user at destination branch', async () => {
      const ctx = baseCtx({ scope: 'BRANCH', branchId: TO_BRANCH });

      await expect(service.markInTransit('dispatch-1', ctx)).resolves.toBeDefined();
    });
  });

  describe('markArrived (ON_THE_WAY -> REACHED_BRANCH)', () => {
    const dispatchRecord = {
      id: 'dispatch-1',
      organizationId: ORG_ID,
      fromBranchId: FROM_BRANCH,
      toBranchId: TO_BRANCH,
      status: 'ON_THE_WAY',
    };

    beforeEach(() => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue(dispatchRecord);
      (prisma.dispatch.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
    });

    it('should transition ON_THE_WAY -> REACHED_BRANCH', async () => {
      const ctx = baseCtx({ scope: 'BRANCH', branchId: TO_BRANCH });
      await service.markArrived('dispatch-1', ctx);

      expect(prisma.dispatch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REACHED_BRANCH' }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should also allow transitioning directly from DISPATCHED -> REACHED_BRANCH', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue({ ...dispatchRecord, status: 'DISPATCHED' });

      await expect(service.markArrived('dispatch-1', baseCtx())).resolves.toBeDefined();
    });

    it('should reject when dispatch is in an invalid state (e.g. PACKED)', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue({ ...dispatchRecord, status: 'PACKED' });

      await expect(service.markArrived('dispatch-1', baseCtx())).rejects.toThrow(BadRequestException);
    });

    it('should reject BRANCH-scope user who is not the destination branch', async () => {
      const ctx = baseCtx({ scope: 'BRANCH', branchId: FROM_BRANCH });

      await expect(service.markArrived('dispatch-1', ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should reject on concurrent update', async () => {
      (prisma.dispatch.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(service.markArrived('dispatch-1', baseCtx())).rejects.toThrow(BadRequestException);
    });
  });

  describe('receiveDispatch (REACHED_BRANCH -> RECEIVED)', () => {
    const dispatchRecord = {
      id: 'dispatch-1',
      organizationId: ORG_ID,
      fromBranchId: FROM_BRANCH,
      toBranchId: TO_BRANCH,
      status: 'REACHED_BRANCH',
      dispatchNumber: 'DISP-00001',
      items: [{ id: 'item-1', variantId: 'var-1', quantityDispatched: 10, batchId: null }],
    };

    beforeEach(() => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue(dispatchRecord);
      (prisma.dispatch.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.dispatchItem.update as jest.Mock).mockResolvedValue({});
      (prisma.outboxEvent.create as jest.Mock).mockResolvedValue({});
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
    });

    it('should receive full quantity and call inventoryService.postTransaction with TRANSFER_IN', async () => {
      await service.receiveDispatch('dispatch-1', baseCtx(), [{ itemId: 'item-1', quantityReceived: 10 }]);

      expect(prisma.dispatchItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({ quantityReceived: 10 }),
        }),
      );
      expect(inventoryService.postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          variantId: 'var-1',
          toLocationId: TO_BRANCH,
          quantity: 10,
          type: 'TRANSFER_IN',
          referenceId: 'dispatch-1',
        }),
        baseCtx().userId,
        expect.any(Object),
      );
      expect(prisma.dispatch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dispatch-1', status: 'REACHED_BRANCH' },
          data: expect.objectContaining({ status: 'RECEIVED' }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'UPDATE', entity: 'DISPATCH' }),
        }),
      );
    });

    it('should not throw on happy path (regression: audit helper integration)', async () => {
      await expect(
        service.receiveDispatch('dispatch-1', baseCtx(), [{ itemId: 'item-1', quantityReceived: 10 }]),
      ).resolves.not.toThrow();
    });

    it('should reject receiving more than the dispatched quantity', async () => {
      await expect(
        service.receiveDispatch('dispatch-1', baseCtx(), [{ itemId: 'item-1', quantityReceived: 15 }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a negative received quantity', async () => {
      await expect(
        service.receiveDispatch('dispatch-1', baseCtx(), [{ itemId: 'item-1', quantityReceived: -1 }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if dispatch is not REACHED_BRANCH', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue({ ...dispatchRecord, status: 'ON_THE_WAY' });

      await expect(
        service.receiveDispatch('dispatch-1', baseCtx(), [{ itemId: 'item-1', quantityReceived: 10 }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for an unknown item id', async () => {
      await expect(
        service.receiveDispatch('dispatch-1', baseCtx(), [{ itemId: 'unknown-item', quantityReceived: 5 }]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject BRANCH-scope user who is not the destination branch', async () => {
      const ctx = baseCtx({ scope: 'BRANCH', branchId: FROM_BRANCH });

      await expect(
        service.receiveDispatch('dispatch-1', ctx, [{ itemId: 'item-1', quantityReceived: 10 }]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject on concurrent update', async () => {
      (prisma.dispatch.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(
        service.receiveDispatch('dispatch-1', baseCtx(), [{ itemId: 'item-1', quantityReceived: 10 }]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelDispatch', () => {
    const dispatchRecord = {
      id: 'dispatch-1',
      organizationId: ORG_ID,
      fromBranchId: FROM_BRANCH,
      toBranchId: TO_BRANCH,
      status: 'PACKED',
    };

    beforeEach(() => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue(dispatchRecord);
      (prisma.dispatch.update as jest.Mock).mockResolvedValue({ ...dispatchRecord, status: 'CANCELLED' });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
    });

    it('should cancel a dispatch successfully', async () => {
      const result: any = await service.cancelDispatch('dispatch-1', 'Customer changed mind', baseCtx());

      expect(result.status).toBe('CANCELLED');
      expect(prisma.dispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dispatch-1' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'UPDATE', entity: 'DISPATCH' }),
        }),
      );
    });

    it('should reject cancelling a RECEIVED dispatch', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue({ ...dispatchRecord, status: 'RECEIVED' });

      await expect(service.cancelDispatch('dispatch-1', 'too late', baseCtx())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject cancelling a REACHED_BRANCH dispatch', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue({ ...dispatchRecord, status: 'REACHED_BRANCH' });

      await expect(service.cancelDispatch('dispatch-1', 'too late', baseCtx())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when dispatch does not exist', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.cancelDispatch('missing', 'reason', baseCtx())).rejects.toThrow(NotFoundException);
    });

    it('should reject cross-org access', async () => {
      (prisma.dispatch.findUnique as jest.Mock).mockResolvedValue({ ...dispatchRecord, organizationId: 'other-org' });

      await expect(service.cancelDispatch('dispatch-1', 'reason', baseCtx())).rejects.toThrow(ForbiddenException);
    });

    it('should reject BRANCH-scope user who is not the source branch', async () => {
      const ctx = baseCtx({ scope: 'BRANCH', branchId: TO_BRANCH });

      await expect(service.cancelDispatch('dispatch-1', 'reason', ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
