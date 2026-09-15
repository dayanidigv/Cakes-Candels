import { prisma, Organization, Prisma } from '../client/index';

export class OrganizationRepository {
  async findAll(): Promise<Organization[]> {
    return prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<Organization | null> {
    return prisma.organization.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return prisma.organization.create({ data });
  }

  async update(id: string, data: Prisma.OrganizationUpdateInput): Promise<Organization> {
    return prisma.organization.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<Organization> {
    return prisma.organization.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    });
  }
}
