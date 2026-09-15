import { prisma, POSRegister, Prisma } from '../client/index';

export type POSRegisterWithBranch = Prisma.POSRegisterGetPayload<{
  include: { branch: true }
}>;

export class POSRegisterRepository {
  async findAll(organizationId: string): Promise<POSRegisterWithBranch[]> {
    return prisma.pOSRegister.findMany({
      where: { branch: { organizationId } },
      include: { branch: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string, organizationId: string): Promise<POSRegisterWithBranch | null> {
    return prisma.pOSRegister.findFirst({
      where: { id, branch: { organizationId } },
      include: { branch: true }
    });
  }

  async create(data: Prisma.POSRegisterUncheckedCreateInput): Promise<POSRegister> {
    return prisma.pOSRegister.create({ data });
  }

  async update(id: string, data: Prisma.POSRegisterUncheckedUpdateInput): Promise<POSRegister> {
    return prisma.pOSRegister.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<POSRegister> {
    return prisma.pOSRegister.delete({
      where: { id }
    });
  }
}
