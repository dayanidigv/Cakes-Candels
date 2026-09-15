import { prisma, Designation, Prisma } from '../client/index';

export class DesignationRepository {
  async findAll(): Promise<Designation[]> {
    return prisma.designation.findMany({
      where: { deletedAt: null },
      orderBy: { title: 'asc' }
    });
  }

  async findById(id: string): Promise<Designation | null> {
    return prisma.designation.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.DesignationCreateInput): Promise<Designation> {
    return prisma.designation.create({ data });
  }

  async update(id: string, data: Prisma.DesignationUpdateInput): Promise<Designation> {
    return prisma.designation.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<Designation> {
    return prisma.designation.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
