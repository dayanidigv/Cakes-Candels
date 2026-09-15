import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { REDIS_CLIENT } from '../../../common/providers/redis.provider';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import * as bcrypt from 'bcrypt';

const mockUserRepository = {
  findAll: jest.fn(),
  count: jest.fn(),
  findById: jest.fn(),
  existsByUsername: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  assignRole: jest.fn(),
  removeRole: jest.fn(),
  assignBranch: jest.fn(),
};

jest.mock('@cc-erp/database', () => ({
  UserRepository: jest.fn().mockImplementation(() => mockUserRepository),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let redis: { del: jest.Mock };

  const userWithRoles = {
    id: 'user-1',
    username: 'jdoe',
    fullName: 'John Doe',
    email: 'jdoe@example.com',
    isActive: true,
    branchId: 'branch-1',
    branch: { id: 'branch-1', name: 'Main Branch' },
    createdAt: new Date(),
    updatedAt: new Date(),
    userRoles: [
      { role: { name: 'CASHIER', rolePermissions: [{ permission: { name: 'pos:write' } }] } },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    redis = { del: jest.fn().mockResolvedValue(1) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: REDIS_CLIENT, useValue: redis }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should paginate and forward branchId and organizationId as tenant filters', async () => {
      mockUserRepository.findAll.mockResolvedValue([userWithRoles]);
      mockUserRepository.count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        branchId: 'branch-1',
        organizationId: 'org-1',
      });

      expect(mockUserRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        branchId: 'branch-1',
        organizationId: 'org-1',
      });
      expect(mockUserRepository.count).toHaveBeenCalledWith('branch-1', 'org-1');
      expect(result).toEqual(
        expect.objectContaining({ items: [userWithRoles], total: 1, page: 1, limit: 20 })
      );
    });

    it('should cap the page size at 100', async () => {
      mockUserRepository.findAll.mockResolvedValue([]);
      mockUserRepository.count.mockResolvedValue(0);

      await service.findAll({ limit: 500 });

      expect(mockUserRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException when the user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('should return the user with flattened roles and deduplicated permissions', async () => {
      mockUserRepository.findById.mockResolvedValue(userWithRoles);

      const result = await service.findById('user-1');

      expect(result.roles).toEqual(['CASHIER']);
      expect(result.permissions).toEqual(['pos:write']);
      expect(result.branch).toEqual({ id: 'branch-1', name: 'Main Branch' });
    });
  });

  describe('create', () => {
    it('should throw ConflictException when the username is already taken', async () => {
      mockUserRepository.existsByUsername.mockResolvedValue(true);

      await expect(
        service.create({
          username: 'jdoe',
          password: 'SecurePass1!',
          fullName: 'John Doe',
          branchId: 'branch-1',
        } as any)
      ).rejects.toThrow(ConflictException);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should hash the password and create the user when the username is free', async () => {
      mockUserRepository.existsByUsername.mockResolvedValue(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      mockUserRepository.create.mockResolvedValue({
        id: 'user-2',
        username: 'new.user',
        fullName: 'New User',
      });

      const result = await service.create({
        username: 'new.user',
        password: 'SecurePass1!',
        fullName: 'New User',
        branchId: 'branch-1',
      } as any);

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'new.user', passwordHash: 'hashed-pw' })
      );
      expect(result).toEqual({ id: 'user-2', username: 'new.user', fullName: 'New User' });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when the user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', { fullName: 'X' } as any)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should only update the provided fields', async () => {
      mockUserRepository.findById.mockResolvedValue(userWithRoles);
      mockUserRepository.update.mockResolvedValue({
        id: 'user-1',
        username: 'jdoe',
        fullName: 'Updated Name',
      });

      await service.update('user-1', { fullName: 'Updated Name' } as any);

      expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', {
        fullName: 'Updated Name',
      });
    });

    it('should hash the password when a new one is provided', async () => {
      mockUserRepository.findById.mockResolvedValue(userWithRoles);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-pw');
      mockUserRepository.update.mockResolvedValue(userWithRoles);

      await service.update('user-1', { password: 'NewSecurePass1!' } as any);

      expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', {
        passwordHash: 'new-hashed-pw',
      });
    });
  });

  describe('softDelete', () => {
    it('should throw NotFoundException when the user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.softDelete('missing', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('should soft-delete the user', async () => {
      mockUserRepository.findById.mockResolvedValue(userWithRoles);
      mockUserRepository.softDelete.mockResolvedValue(undefined);

      const result = await service.softDelete('user-1', 'admin-1');

      expect(mockUserRepository.softDelete).toHaveBeenCalledWith('user-1', 'admin-1');
      expect(result).toEqual({ deleted: true, id: 'user-1' });
    });
  });

  describe('assignRole', () => {
    it('should throw NotFoundException when the user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.assignRole('missing', { roleId: 'role-1' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should assign the role and invalidate the permissions cache', async () => {
      mockUserRepository.findById.mockResolvedValue(userWithRoles);
      mockUserRepository.assignRole.mockResolvedValue(undefined);

      const result = await service.assignRole('user-1', { roleId: 'role-1' });

      expect(mockUserRepository.assignRole).toHaveBeenCalledWith('user-1', 'role-1');
      expect(redis.del).toHaveBeenCalledWith(PermissionsGuard.getCacheKey('user-1'));
      expect(result).toEqual({ userId: 'user-1', roleId: 'role-1', assigned: true });
    });
  });

  describe('removeRole', () => {
    it('should throw NotFoundException when the user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.removeRole('missing', 'role-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when the role was not assigned', async () => {
      mockUserRepository.findById.mockResolvedValue(userWithRoles);
      mockUserRepository.removeRole.mockRejectedValue(new Error('not found'));

      await expect(service.removeRole('user-1', 'role-1')).rejects.toThrow(BadRequestException);
    });

    it('should remove the role and invalidate the permissions cache', async () => {
      mockUserRepository.findById.mockResolvedValue(userWithRoles);
      mockUserRepository.removeRole.mockResolvedValue(undefined);

      const result = await service.removeRole('user-1', 'role-1');

      expect(redis.del).toHaveBeenCalledWith(PermissionsGuard.getCacheKey('user-1'));
      expect(result).toEqual({ userId: 'user-1', roleId: 'role-1', removed: true });
    });
  });

  describe('assignBranch', () => {
    it('should throw NotFoundException when the user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.assignBranch('missing', { branchId: 'branch-2' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should assign the branch', async () => {
      mockUserRepository.findById.mockResolvedValue(userWithRoles);
      mockUserRepository.assignBranch.mockResolvedValue(undefined);

      const result = await service.assignBranch('user-1', { branchId: 'branch-2' });

      expect(mockUserRepository.assignBranch).toHaveBeenCalledWith('user-1', 'branch-2');
      expect(result).toEqual({ userId: 'user-1', branchId: 'branch-2', assigned: true });
    });
  });
});
