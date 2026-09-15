import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { UserRepository } from '@cc-erp/database';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { AssignBranchDto } from '../dto/assign-branch.dto';
import { REDIS_CLIENT } from '../../../common/providers/redis.provider';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import type Redis from 'ioredis';

@Injectable()
export class UserService {
  private readonly userRepository = new UserRepository();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis
  ) {}

  async findAll(opts?: { page?: number; limit?: number; branchId?: string }) {
    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.userRepository.findAll({ skip, take: limit, branchId: opts?.branchId }),
      this.userRepository.count(opts?.branchId),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.name)
    );

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      isActive: user.isActive,
      branchId: user.branchId,
      branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
      roles,
      permissions: [...new Set(permissions)],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async create(dto: CreateUserDto) {
    const exists = await this.userRepository.existsByUsername(dto.username);
    if (exists) {
      throw new ConflictException(`Username '${dto.username}' is already taken`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.userRepository.create({
      username: dto.username,
      passwordHash,
      fullName: dto.fullName,
      email: dto.email,
      branchId: dto.branchId,
    });

    return { id: user.id, username: user.username, fullName: user.fullName };
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updateData: any = {};
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.password !== undefined) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.userRepository.update(id, updateData);
    return { id: updated.id, username: updated.username, fullName: updated.fullName };
  }

  async softDelete(id: string, deletedBy: string) {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.userRepository.softDelete(id, deletedBy);
    return { deleted: true, id };
  }

  async assignRole(userId: string, dto: AssignRoleDto) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    await this.userRepository.assignRole(userId, dto.roleId);
    // Invalidate permissions cache for this user
    await this.redis.del(PermissionsGuard.getCacheKey(userId)).catch(() => null);
    return { userId, roleId: dto.roleId, assigned: true };
  }

  async removeRole(userId: string, roleId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    try {
      await this.userRepository.removeRole(userId, roleId);
    } catch {
      throw new BadRequestException('Role was not assigned to this user');
    }
    // Invalidate permissions cache for this user
    await this.redis.del(PermissionsGuard.getCacheKey(userId)).catch(() => null);
    return { userId, roleId, removed: true };
  }

  async assignBranch(userId: string, dto: AssignBranchDto) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    await this.userRepository.assignBranch(userId, dto.branchId);
    return { userId, branchId: dto.branchId, assigned: true };
  }
}
