import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BranchService } from './branch.service';

const mockBranchRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@cc-erp/database', () => ({
  BranchRepository: jest.fn().mockImplementation(() => mockBranchRepository),
}));

describe('BranchService', () => {
  let service: BranchService;
  const orgId = 'org-1';

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BranchService],
    }).compile();

    service = module.get<BranchService>(BranchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should scope the repository call to the caller organization', async () => {
      mockBranchRepository.findAll.mockResolvedValue([{ id: 'branch-1', organizationId: orgId }]);

      const result = await service.findAll(orgId);

      expect(mockBranchRepository.findAll).toHaveBeenCalledWith(orgId);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when the branch does not exist in the caller organization', async () => {
      mockBranchRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing', orgId)).rejects.toThrow(NotFoundException);
      expect(mockBranchRepository.findById).toHaveBeenCalledWith('missing', orgId);
    });

    it('should return the branch when found in the caller organization', async () => {
      mockBranchRepository.findById.mockResolvedValue({ id: 'branch-1', name: 'Main Branch' });

      const result = await service.findOne('branch-1', orgId);

      expect(mockBranchRepository.findById).toHaveBeenCalledWith('branch-1', orgId);
      expect(result).toEqual({ id: 'branch-1', name: 'Main Branch' });
    });
  });

  describe('create', () => {
    it('should create the branch via the repository', async () => {
      const dto = { organizationId: orgId, name: 'New Branch', type: 'RETAIL', address: 'Somewhere' };
      mockBranchRepository.create.mockResolvedValue({ id: 'branch-3', ...dto });

      const result = await service.create(dto as any);

      expect(mockBranchRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'branch-3', ...dto });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when the branch does not exist in the caller organization', async () => {
      mockBranchRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', orgId, { name: 'X' } as any)).rejects.toThrow(
        NotFoundException
      );
      expect(mockBranchRepository.update).not.toHaveBeenCalled();
    });

    it('should update the branch when it exists in the caller organization', async () => {
      mockBranchRepository.findById.mockResolvedValue({ id: 'branch-1' });
      mockBranchRepository.update.mockResolvedValue({ id: 'branch-1', name: 'Renamed Branch' });

      const result = await service.update('branch-1', orgId, { name: 'Renamed Branch' } as any);

      expect(mockBranchRepository.findById).toHaveBeenCalledWith('branch-1', orgId);
      expect(mockBranchRepository.update).toHaveBeenCalledWith('branch-1', { name: 'Renamed Branch' });
      expect(result).toEqual({ id: 'branch-1', name: 'Renamed Branch' });
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when the branch does not exist in the caller organization', async () => {
      mockBranchRepository.findById.mockResolvedValue(null);

      await expect(service.remove('missing', orgId)).rejects.toThrow(NotFoundException);
      expect(mockBranchRepository.delete).not.toHaveBeenCalled();
    });

    it('should soft-delete the branch when it exists in the caller organization', async () => {
      mockBranchRepository.findById.mockResolvedValue({ id: 'branch-1' });
      mockBranchRepository.delete.mockResolvedValue({ id: 'branch-1', isActive: false });

      const result = await service.remove('branch-1', orgId);

      expect(mockBranchRepository.findById).toHaveBeenCalledWith('branch-1', orgId);
      expect(mockBranchRepository.delete).toHaveBeenCalledWith('branch-1');
      expect(result).toEqual({ id: 'branch-1', isActive: false });
    });
  });
});
