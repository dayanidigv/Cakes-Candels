import { Injectable, ConflictException } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { CreateNotificationTemplateDto } from './dto/create-notification-templates.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-templates.dto';

@Injectable()
export class NotificationTemplateService {
  
  async findAll(query: any): Promise<any> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const search = query.search || '';
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { type: { contains: search, mode: 'insensitive' } }, { eventName: { contains: search, mode: 'insensitive' } }, { subject: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.notificationTemplate.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.notificationTemplate.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<any> {
    return prisma.notificationTemplate.findUnique({ where: { id } });
  }

  async create(data: CreateNotificationTemplateDto, userId: string): Promise<any> {
    try { return await prisma.notificationTemplate.create({ data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_NOTIFICATIONTEMPLATE', message: 'NotificationTemplate already exists.' });
      throw error;
    }
  }

  async update(id: string, data: UpdateNotificationTemplateDto, userId: string): Promise<any> {
    try { return await prisma.notificationTemplate.update({ where: { id }, data: data as any }); } 
    catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException({ success: false, errorCode: 'DUPLICATE_NOTIFICATIONTEMPLATE', message: 'NotificationTemplate already exists.' });
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    return prisma.notificationTemplate.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: userId, isActive: false } });
  }
}
