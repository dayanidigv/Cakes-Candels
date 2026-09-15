import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { POSRegisterService } from './pos-register.service';

const mockPOSRegisterRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@cc-erp/database', () => ({
  POSRegisterRepository: jest.fn().mockImplementation(() => mockPOSRegisterRepository),
}));

describe('POSRegisterService', () => {
  let service: POSRegisterService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [POSRegisterService],
    }).compile();

    service = module.get<POSRegisterService>(POSRegisterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all registers', async () => {
      mockPOSRegisterRepository.findAll.mockResolvedValue([{ id: 'reg-1', branchId: 'branch-1' }]);

      const result = await service.findAll();

      expect(result).toEqual([{ id: 'reg-1', branchId: 'branch-1' }]);

      // NOTE: POSRegisterService/POSRegisterRepository is pure CRUD only — this file has no
      // register open/close or shift-tie-in logic (that lives elsewhere, e.g. PosShift under
      // the sales module). It also has no branchId/organizationId scoping at all: findAll()
      // returns every register across every branch and organization
      // (packages/database/src/repositories/pos-register.repository.ts has no where clause).
      // Same class of cross-tenant gap as BranchRepository — flagged for review, not fixed
      // here since it needs the caller's branch/organization context threaded through.
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when the register does not exist', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('should return the register when found', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue({ id: 'reg-1', name: 'Register 1' });

      const result = await service.findOne('reg-1');

      expect(result).toEqual({ id: 'reg-1', name: 'Register 1' });
    });
  });

  describe('create', () => {
    it('should create the register via the repository', async () => {
      const dto = { branchId: 'branch-1', name: 'Register 2', deviceIdentifier: 'DEV-002' };
      mockPOSRegisterRepository.create.mockResolvedValue({ id: 'reg-2', ...dto });

      const result = await service.create(dto as any);

      expect(mockPOSRegisterRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'reg-2', ...dto });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when the register does not exist', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' } as any)).rejects.toThrow(
        NotFoundException
      );
      expect(mockPOSRegisterRepository.update).not.toHaveBeenCalled();
    });

    it('should update the register when it exists', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue({ id: 'reg-1' });
      mockPOSRegisterRepository.update.mockResolvedValue({ id: 'reg-1', name: 'Renamed Register' });

      const result = await service.update('reg-1', { name: 'Renamed Register' } as any);

      expect(mockPOSRegisterRepository.update).toHaveBeenCalledWith('reg-1', {
        name: 'Renamed Register',
      });
      expect(result).toEqual({ id: 'reg-1', name: 'Renamed Register' });
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when the register does not exist', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(mockPOSRegisterRepository.delete).not.toHaveBeenCalled();
    });

    it('should delete the register when it exists', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue({ id: 'reg-1' });
      mockPOSRegisterRepository.delete.mockResolvedValue({ id: 'reg-1' });

      const result = await service.remove('reg-1');

      expect(mockPOSRegisterRepository.delete).toHaveBeenCalledWith('reg-1');
      expect(result).toEqual({ id: 'reg-1' });
    });
  });
});
