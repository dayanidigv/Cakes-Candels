import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';

// SettingsService instantiates `new SystemSettingRepository()` itself (no DI), so we mock the
// repository class exported from @cc-erp/database rather than the prisma client directly.
jest.mock('@cc-erp/database', () => ({
  SystemSettingRepository: jest.fn().mockImplementation(() => ({
    findAllSystem: jest.fn(),
    findAllBranch: jest.fn(),
    findSystemSettingByKey: jest.fn(),
    findBranchSettingByKey: jest.fn(),
    upsertSystemSetting: jest.fn(),
    upsertBranchSetting: jest.fn(),
  })),
}));

describe('SettingsService', () => {
  let service: SettingsService;
  let repo: {
    findAllSystem: jest.Mock;
    findAllBranch: jest.Mock;
    findSystemSettingByKey: jest.Mock;
    findBranchSettingByKey: jest.Mock;
    upsertSystemSetting: jest.Mock;
    upsertBranchSetting: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SettingsService],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    repo = (service as any).systemSettingRepository;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSystemSettings', () => {
    it('should return all system settings from the repository', async () => {
      repo.findAllSystem.mockResolvedValue([{ key: 'tax.gst_rate', value: '18' }]);

      const result = await service.getSystemSettings();

      expect(result).toEqual([{ key: 'tax.gst_rate', value: '18' }]);
      expect(repo.findAllSystem).toHaveBeenCalled();
    });
  });

  describe('getBranchSettings', () => {
    it('should return all branch settings from the repository', async () => {
      repo.findAllBranch.mockResolvedValue([{ branchId: 'b1', key: 'receipt.header', value: 'Cakes & Candles' }]);

      const result = await service.getBranchSettings();

      expect(result).toEqual([{ branchId: 'b1', key: 'receipt.header', value: 'Cakes & Candles' }]);
    });
  });

  describe('getSystemSetting', () => {
    it('should return the setting value when found', async () => {
      repo.findSystemSettingByKey.mockResolvedValue({ key: 'tax.gst_rate', value: '18' });

      const result = await service.getSystemSetting('tax.gst_rate');

      expect(result).toBe('18');
      expect(repo.findSystemSettingByKey).toHaveBeenCalledWith('tax.gst_rate');
    });

    it('should return null when the setting does not exist', async () => {
      repo.findSystemSettingByKey.mockResolvedValue(null);

      const result = await service.getSystemSetting('missing.key');

      expect(result).toBeNull();
    });
  });

  describe('getBranchSetting', () => {
    it('should return the branch-scoped setting value when found', async () => {
      repo.findBranchSettingByKey.mockResolvedValue({ value: 'custom header' });

      const result = await service.getBranchSetting('branch-1', 'receipt.header');

      expect(result).toBe('custom header');
      expect(repo.findBranchSettingByKey).toHaveBeenCalledWith('branch-1', 'receipt.header');
    });

    it('should return null when no branch setting exists', async () => {
      repo.findBranchSettingByKey.mockResolvedValue(null);

      const result = await service.getBranchSetting('branch-1', 'missing.key');

      expect(result).toBeNull();
    });
  });

  describe('setSystemSetting', () => {
    it('should upsert with key/value/description', async () => {
      await service.setSystemSetting('tax.gst_rate', '18', 'GST rate');

      expect(repo.upsertSystemSetting).toHaveBeenCalledWith('tax.gst_rate', '18', 'GST rate');
    });
  });

  describe('setBranchSetting', () => {
    it('should upsert a branch-scoped setting', async () => {
      await service.setBranchSetting('branch-1', 'receipt.header', 'New Header');

      expect(repo.upsertBranchSetting).toHaveBeenCalledWith('branch-1', 'receipt.header', 'New Header');
    });
  });
});
