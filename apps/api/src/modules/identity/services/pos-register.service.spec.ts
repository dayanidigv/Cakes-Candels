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
  const orgId = 'org-1';

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

  // NOTE: POSRegisterService/POSRegisterRepository is pure CRUD only — this file has no
  // register open/close or shift-tie-in logic (that lives elsewhere, e.g. PosShift under
  // the sales module).

  describe('findAll', () => {
    it('should scope the repository call to the caller organization', async () => {
      mockPOSRegisterRepository.findAll.mockResolvedValue([{ id: 'reg-1', branchId: 'branch-1' }]);

      const result = await service.findAll(orgId);

      expect(mockPOSRegisterRepository.findAll).toHaveBeenCalledWith(orgId);
      expect(result).toEqual([{ id: 'reg-1', branchId: 'branch-1' }]);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when the register does not exist in the caller organization', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing', orgId)).rejects.toThrow(NotFoundException);
      expect(mockPOSRegisterRepository.findById).toHaveBeenCalledWith('missing', orgId);
    });

    it('should return the register when found in the caller organization', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue({ id: 'reg-1', name: 'Register 1' });

      const result = await service.findOne('reg-1', orgId);

      expect(mockPOSRegisterRepository.findById).toHaveBeenCalledWith('reg-1', orgId);
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
    it('should throw NotFoundException when the register does not exist in the caller organization', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', orgId, { name: 'X' } as any)).rejects.toThrow(
        NotFoundException
      );
      expect(mockPOSRegisterRepository.update).not.toHaveBeenCalled();
    });

    it('should update the register when it exists in the caller organization', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue({ id: 'reg-1' });
      mockPOSRegisterRepository.update.mockResolvedValue({ id: 'reg-1', name: 'Renamed Register' });

      const result = await service.update('reg-1', orgId, { name: 'Renamed Register' } as any);

      expect(mockPOSRegisterRepository.findById).toHaveBeenCalledWith('reg-1', orgId);
      expect(mockPOSRegisterRepository.update).toHaveBeenCalledWith('reg-1', {
        name: 'Renamed Register',
      });
      expect(result).toEqual({ id: 'reg-1', name: 'Renamed Register' });
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when the register does not exist in the caller organization', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue(null);

      await expect(service.remove('missing', orgId)).rejects.toThrow(NotFoundException);
      expect(mockPOSRegisterRepository.delete).not.toHaveBeenCalled();
    });

    it('should delete the register when it exists in the caller organization', async () => {
      mockPOSRegisterRepository.findById.mockResolvedValue({ id: 'reg-1' });
      mockPOSRegisterRepository.delete.mockResolvedValue({ id: 'reg-1' });

      const result = await service.remove('reg-1', orgId);

      expect(mockPOSRegisterRepository.findById).toHaveBeenCalledWith('reg-1', orgId);
      expect(mockPOSRegisterRepository.delete).toHaveBeenCalledWith('reg-1');
      expect(result).toEqual({ id: 'reg-1' });
    });
  });
});
