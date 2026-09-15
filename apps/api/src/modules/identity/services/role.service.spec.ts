import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RoleService } from './role.service';
import { prisma } from '@cc-erp/database';

const mockRoleRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  countAssignedUsers: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@cc-erp/database', () => ({
  RoleRepository: jest.fn().mockImplementation(() => mockRoleRepository),
  RoleType: { BRANCH_MANAGER: 'BRANCH_MANAGER' },
  prisma: {
    role: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    rolePermission: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => cb(prisma)),
  },
}));

describe('RoleService', () => {
  let service: RoleService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoleService],
    }).compile();

    service = module.get<RoleService>(RoleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate to the repository', async () => {
      mockRoleRepository.findAll.mockResolvedValue([{ id: 'role-1' }]);

      const result = await service.findAll();

      expect(result).toEqual([{ id: 'role-1' }]);

      // NOTE (tenant-scoping): Role has no organizationId column in the schema and
      // RoleRepository.findAll() has no scoping filter at all — every role in the system
      // is global/shared across organizations. This appears to be an intentional design
      // (RBAC role catalogue is system-wide), but is worth confirming since Permission
      // follows the same unscoped pattern (see permission.service.spec.ts).
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when the role does not exist', async () => {
      mockRoleRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('should return the role when found', async () => {
      mockRoleRepository.findById.mockResolvedValue({ id: 'role-1', name: 'CASHIER' });

      const result = await service.findOne('role-1');

      expect(result).toEqual({ id: 'role-1', name: 'CASHIER' });
    });
  });

  describe('create', () => {
    it('should create the role and link permissions inside a transaction', async () => {
      (prisma.role.create as jest.Mock).mockResolvedValue({ id: 'role-1' });
      (prisma.rolePermission.createMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 'role-1',
        rolePermissions: [],
      });

      const dto = {
        name: 'BRANCH_MANAGER',
        type: 'BRANCH_MANAGER' as any,
        permissionIds: ['perm-1', 'perm-2'],
      };

      await service.create(dto);

      expect(prisma.role.create).toHaveBeenCalledWith({
        data: { name: 'BRANCH_MANAGER', type: 'BRANCH_MANAGER' },
      });
      expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          { roleId: 'role-1', permissionId: 'perm-1' },
          { roleId: 'role-1', permissionId: 'perm-2' },
        ],
      });
    });

    it('should skip linking permissions when none are provided', async () => {
      (prisma.role.create as jest.Mock).mockResolvedValue({ id: 'role-2' });
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({ id: 'role-2', rolePermissions: [] });

      await service.create({ name: 'CASHIER', type: 'BRANCH_MANAGER' as any });

      expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when the role does not exist', async () => {
      mockRoleRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', {})).rejects.toThrow(NotFoundException);
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it('should replace linked permissions when permissionIds is provided', async () => {
      mockRoleRepository.findById.mockResolvedValue({ id: 'role-1' });
      (prisma.role.update as jest.Mock).mockResolvedValue({ id: 'role-1' });
      (prisma.rolePermission.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.rolePermission.createMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({ id: 'role-1', rolePermissions: [] });

      await service.update('role-1', { permissionIds: ['perm-3'] });

      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-1' } });
      expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [{ roleId: 'role-1', permissionId: 'perm-3' }],
      });
    });

    it('should leave existing permissions untouched when permissionIds is omitted', async () => {
      mockRoleRepository.findById.mockResolvedValue({ id: 'role-1' });
      (prisma.role.update as jest.Mock).mockResolvedValue({ id: 'role-1' });
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({ id: 'role-1', rolePermissions: [] });

      await service.update('role-1', { name: 'RENAMED' });

      expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
      expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when the role does not exist', async () => {
      mockRoleRepository.findById.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when the role is still assigned to users', async () => {
      mockRoleRepository.findById.mockResolvedValue({ id: 'role-1' });
      mockRoleRepository.countAssignedUsers.mockResolvedValue(3);

      await expect(service.remove('role-1')).rejects.toThrow(BadRequestException);
      expect(mockRoleRepository.delete).not.toHaveBeenCalled();
    });

    it('should delete the role when unassigned', async () => {
      mockRoleRepository.findById.mockResolvedValue({ id: 'role-1' });
      mockRoleRepository.countAssignedUsers.mockResolvedValue(0);
      mockRoleRepository.delete.mockResolvedValue({ id: 'role-1' });

      const result = await service.remove('role-1');

      expect(mockRoleRepository.delete).toHaveBeenCalledWith('role-1');
      expect(result).toEqual({ id: 'role-1' });
    });
  });
});
