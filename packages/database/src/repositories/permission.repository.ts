import { prisma, Permission } from '../client/index';

export class PermissionRepository {
  async findAll(): Promise<Permission[]> {
    return prisma.permission.findMany({
      orderBy: { name: 'asc' }
    });
  }
}
