import { prisma, Role, Prisma } from '../client/index';

export type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: {
    rolePermissions: {
      include: {
        permission: true
      }
    }
  }
}>;

export class RoleRepository {
  async findAll(): Promise<RoleWithPermissions[]> {
    return prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<RoleWithPermissions | null> {
    return prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  async create(data: Prisma.RoleCreateInput): Promise<Role> {
    return prisma.role.create({ data });
  }

  async update(id: string, data: Prisma.RoleUpdateInput): Promise<Role> {
    return prisma.role.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<Role> {
    return prisma.role.delete({
      where: { id }
    });
  }

  async countAssignedUsers(roleId: string): Promise<number> {
    return prisma.userRole.count({
      where: { roleId }
    });
  }

  async linkPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await prisma.rolePermission.deleteMany({
      where: { roleId }
    });

    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map(pId => ({
          roleId,
          permissionId: pId
        }))
      });
    }
  }
}
