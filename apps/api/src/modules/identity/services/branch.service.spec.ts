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
    it('should return all branches', async () => {
      mockBranchRepository.findAll.mockResolvedValue([
        { id: 'branch-1', organizationId: 'org-1' },
        { id: 'branch-2', organizationId: 'org-2' },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);

      // NOTE (tenant-scoping gap): BranchService.findAll() takes no organizationId argument,
      // and BranchRepository.findAll() (packages/database/src/repositories/branch.repository.ts)
      // queries `where: { deletedAt: null }` only — there is no organizationId filter, even
      // though Branch.organizationId exists in the schema. As written, findAll() returns
      // branches belonging to every organization. This is the same class of cross-tenant
      // leak fixed previously in logistics.service.ts. Not fixed here (requires threading
      // organizationId from the controller/auth context through the service and repository);
      // flagged for review.
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when the branch does not exist', async () => {
      mockBranchRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('should return the branch when found', async () => {
      mockBranchRepository.findById.mockResolvedValue({ id: 'branch-1', name: 'Main Branch' });

      const result = await service.findOne('branch-1');

      expect(result).toEqual({ id: 'branch-1', name: 'Main Branch' });
    });
  });

  describe('create', () => {
    it('should create the branch via the repository', async () => {
      const dto = { organizationId: 'org-1', name: 'New Branch', type: 'RETAIL', address: 'Somewhere' };
      mockBranchRepository.create.mockResolvedValue({ id: 'branch-3', ...dto });

      const result = await service.create(dto as any);

      expect(mockBranchRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'branch-3', ...dto });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when the branch does not exist', async () => {
      mockBranchRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' } as any)).rejects.toThrow(
        NotFoundException
      );
      expect(mockBranchRepository.update).not.toHaveBeenCalled();
    });

    it('should update the branch when it exists', async () => {
      mockBranchRepository.findById.mockResolvedValue({ id: 'branch-1' });
      mockBranchRepository.update.mockResolvedValue({ id: 'branch-1', name: 'Renamed Branch' });

      const result = await service.update('branch-1', { name: 'Renamed Branch' } as any);

      expect(mockBranchRepository.update).toHaveBeenCalledWith('branch-1', { name: 'Renamed Branch' });
      expect(result).toEqual({ id: 'branch-1', name: 'Renamed Branch' });
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when the branch does not exist', async () => {
      mockBranchRepository.findById.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(mockBranchRepository.delete).not.toHaveBeenCalled();
    });

    it('should soft-delete the branch when it exists', async () => {
      mockBranchRepository.findById.mockResolvedValue({ id: 'branch-1' });
      mockBranchRepository.delete.mockResolvedValue({ id: 'branch-1', isActive: false });

      const result = await service.remove('branch-1');

      expect(mockBranchRepository.delete).toHaveBeenCalledWith('branch-1');
      expect(result).toEqual({ id: 'branch-1', isActive: false });
    });
  });
});
