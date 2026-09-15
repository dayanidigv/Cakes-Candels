import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { RoleRepository, prisma } from '@cc-erp/database';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';

@Injectable()
export class RoleService {
  private readonly roleRepository = new RoleRepository();

  async findAll(): Promise<any> {
    return this.roleRepository.findAll();
  }

  async findOne(id: string): Promise<any> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async create(dto: CreateRoleDto): Promise<any> {
    const { permissionIds, ...rest } = dto;
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: rest
      });

      if (permissionIds && permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map(pId => ({
            roleId: role.id,
            permissionId: pId
          }))
        });
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      });
    });
  }

  async update(id: string, dto: UpdateRoleDto): Promise<any> {
    await this.findOne(id);
    const { permissionIds, ...rest } = dto;
    
    return prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: rest
      });

      if (permissionIds !== undefined) {
        await tx.rolePermission.deleteMany({
          where: { roleId: id }
        });

        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map(pId => ({
              roleId: id,
              permissionId: pId
            }))
          });
        }
      }

      return tx.role.findUnique({
        where: { id },
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      });
    });
  }

  async remove(id: string): Promise<any> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const assignedCount = await this.roleRepository.countAssignedUsers(id);
    if (assignedCount > 0) {
      throw new BadRequestException(
        'Cannot delete role because it is assigned to users. First unassign it or set it inactive.'
      );
    }

    return this.roleRepository.delete(id);
  }
}
