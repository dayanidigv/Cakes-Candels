import { Test, TestingModule } from '@nestjs/testing';
import { PermissionService } from './permission.service';

const mockPermissionRepository = {
  findAll: jest.fn(),
};

jest.mock('@cc-erp/database', () => ({
  PermissionRepository: jest.fn().mockImplementation(() => mockPermissionRepository),
}));

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionService],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate to the repository and return all permissions', async () => {
      const permissions = [{ id: 'perm-1', name: 'users:read' }, { id: 'perm-2', name: 'users:write' }];
      mockPermissionRepository.findAll.mockResolvedValue(permissions);

      const result = await service.findAll();

      expect(mockPermissionRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(permissions);

      // NOTE (tenant-scoping): Permission has no organizationId column and
      // PermissionRepository.findAll() has no where clause at all — the permission
      // catalogue is global by design (mirrors Role, see role.service.spec.ts).
    });

    it('should propagate repository errors', async () => {
      mockPermissionRepository.findAll.mockRejectedValue(new Error('db unavailable'));

      await expect(service.findAll()).rejects.toThrow('db unavailable');
    });
  });
});
