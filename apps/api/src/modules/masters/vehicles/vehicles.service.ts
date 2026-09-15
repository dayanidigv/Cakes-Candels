import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateVehicleDto } from './dto/create-vehicles.dto';
import { UpdateVehicleDto } from './dto/update-vehicles.dto';

@Injectable()
export class VehicleService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { registrationNumber: { contains: search, mode: 'insensitive' } }, { driverName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.vehicle.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicle.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<any> {
    return prisma.vehicle.findUnique({ where: { id } });
  }

  async create(data: CreateVehicleDto, userId: string): Promise<any> {
    try { return await prisma.vehicle.create({ data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_VEHICLE', message: 'Vehicle already exists.' });
      throw error;
    }
  }

  async update(id: string, data: UpdateVehicleDto, userId: string): Promise<any> {
    try { return await prisma.vehicle.update({ where: { id }, data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_VEHICLE', message: 'Vehicle already exists.' });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: userId, isActive: false } });
  }
}
