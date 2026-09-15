import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from './feature-flags.service';

// FeatureFlagsService instantiates `new FeatureFlagRepository()` itself (no DI), so we mock the
// repository class exported from @cc-erp/database rather than the prisma client directly.
jest.mock('@cc-erp/database', () => ({
  FeatureFlagRepository: jest.fn().mockImplementation(() => ({
    findAll: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  })),
}));

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let repo: { findAll: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureFlagsService],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
    repo = (service as any).featureFlagRepository;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isEnabled', () => {
    it('should prefer a branch-specific flag when one exists', async () => {
      repo.findUnique.mockResolvedValueOnce({ isEnabled: true });

      const result = await service.isEnabled('CUSTOM_CAKE', 'branch-1');

      expect(result).toBe(true);
      expect(repo.findUnique).toHaveBeenCalledWith('CUSTOM_CAKE', 'branch-1');
      expect(repo.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should fall back to the global flag when no branch-specific flag exists', async () => {
      repo.findUnique
        .mockResolvedValueOnce(null) // branch lookup
        .mockResolvedValueOnce({ isEnabled: true }); // global lookup

      const result = await service.isEnabled('CUSTOM_CAKE', 'branch-1');

      expect(result).toBe(true);
      expect(repo.findUnique).toHaveBeenNthCalledWith(1, 'CUSTOM_CAKE', 'branch-1');
      expect(repo.findUnique).toHaveBeenNthCalledWith(2, 'CUSTOM_CAKE', null);
    });

    it('should look up only the global flag when no branchId is given', async () => {
      repo.findUnique.mockResolvedValueOnce({ isEnabled: false });

      const result = await service.isEnabled('CUSTOM_CAKE');

      expect(result).toBe(false);
      expect(repo.findUnique).toHaveBeenCalledWith('CUSTOM_CAKE', null);
      expect(repo.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should default to false when no flag record exists anywhere', async () => {
      repo.findUnique.mockResolvedValue(null);

      const result = await service.isEnabled('UNKNOWN_FLAG');

      expect(result).toBe(false);
    });
  });

  describe('getFeatureFlags', () => {
    it('should return all flags from the repository', async () => {
      repo.findAll.mockResolvedValue([{ key: 'CUSTOM_CAKE', isEnabled: true }]);

      const result = await service.getFeatureFlags();

      expect(result).toEqual([{ key: 'CUSTOM_CAKE', isEnabled: true }]);
    });
  });

  describe('getFeatureFlagDetail', () => {
    it('should pass branchId through, defaulting to null', async () => {
      repo.findUnique.mockResolvedValue({ key: 'X', isEnabled: true });

      await service.getFeatureFlagDetail('X');
      expect(repo.findUnique).toHaveBeenCalledWith('X', null);

      await service.getFeatureFlagDetail('X', 'branch-1');
      expect(repo.findUnique).toHaveBeenCalledWith('X', 'branch-1');
    });
  });

  describe('setFlag', () => {
    it('should upsert with the given key/value/branch', async () => {
      await service.setFlag('CUSTOM_CAKE', true, 'branch-1');

      expect(repo.upsert).toHaveBeenCalledWith('CUSTOM_CAKE', true, 'branch-1');
    });

    it('should default branchId to null when omitted', async () => {
      await service.setFlag('CUSTOM_CAKE', false);

      expect(repo.upsert).toHaveBeenCalledWith('CUSTOM_CAKE', false, null);
    });
  });
});
