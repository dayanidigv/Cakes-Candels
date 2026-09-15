import { prisma, Prisma, User, UserStatus } from '../client/index';

export type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: true;
      };
    };
  };
}>;

export type UserWithPermissions = Prisma.UserGetPayload<{
  include: {
    branch: true;
    userRoles: {
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true;
              };
            };
          };
        };
      };
    };
  };
}>;

export class UserRepository {
  async findById(id: string): Promise<UserWithPermissions | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        branch: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true }
                }
              }
            }
          }
        }
      }
    });
  }

  async findByUsername(username: string): Promise<UserWithRoles | null> {
    return prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: {
          include: { role: true }
        }
      }
    });
  }

  async findAll(opts?: { skip?: number; take?: number; branchId?: string }): Promise<User[]> {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (opts?.branchId) where.branchId = opts.branchId;
    return prisma.user.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        userRoles: { include: { role: { select: { id: true, name: true } } } }
      },
      skip: opts?.skip ?? 0,
      take: opts?.take ?? 50,
      orderBy: { createdAt: 'desc' }
    }) as any;
  }

  async count(branchId?: string) {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (branchId) where.branchId = branchId;
    return prisma.user.count({ where });
  }

  async create(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedBy: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, isActive: false, status: UserStatus.DELETED }
    });
  }

  async assignRole(userId: string, roleId: string) {
    return prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId }
    });
  }

  async removeRole(userId: string, roleId: string) {
    return prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } }
    });
  }

  async assignBranch(userId: string, branchId: string): Promise<User> {
    return prisma.user.update({ where: { id: userId }, data: { branchId } });
  }

  async incrementFailedAttempts(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } }
    });
  }

  async resetFailedAttempts(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null }
    });
  }

  async lockAccount(userId: string, until: Date): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: until, status: UserStatus.LOCKED }
    });
  }

  async updateStatus(userId: string, status: UserStatus): Promise<User> {
    const data: Prisma.UserUncheckedUpdateInput = { status };
    if (status === UserStatus.ACTIVE) {
      data.isActive = true;
      data.lockedUntil = null;
      data.failedLoginAttempts = 0;
    } else {
      data.isActive = false;
    }
    return prisma.user.update({ where: { id: userId }, data });
  }

  async activateUser(userId: string): Promise<User> {
    return this.updateStatus(userId, UserStatus.ACTIVE);
  }

  async suspendUser(userId: string): Promise<User> {
    return this.updateStatus(userId, UserStatus.SUSPENDED);
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await prisma.user.count({ where: { username } });
    return count > 0;
  }
}
