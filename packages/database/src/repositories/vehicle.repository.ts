import { prisma, Vehicle, Prisma } from '../client/index';

export class VehicleRepository {
  async findAll(): Promise<Vehicle[]> {
    return prisma.vehicle.findMany({
      where: { deletedAt: null },
      orderBy: { registrationNumber: 'asc' }
    });
  }

  async findById(id: string): Promise<Vehicle | null> {
    return prisma.vehicle.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.VehicleCreateInput): Promise<Vehicle> {
    return prisma.vehicle.create({ data });
  }

  async update(id: string, data: Prisma.VehicleUpdateInput): Promise<Vehicle> {
    return prisma.vehicle.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<Vehicle> {
    return prisma.vehicle.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
