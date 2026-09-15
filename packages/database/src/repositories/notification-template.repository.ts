import { prisma, NotificationTemplate, Prisma } from '../client/index';

export class NotificationTemplateRepository {
  async findAll(): Promise<NotificationTemplate[]> {
    return prisma.notificationTemplate.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<NotificationTemplate | null> {
    return prisma.notificationTemplate.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async create(data: Prisma.NotificationTemplateCreateInput): Promise<NotificationTemplate> {
    return prisma.notificationTemplate.create({ data });
  }

  async update(id: string, data: Prisma.NotificationTemplateUpdateInput): Promise<NotificationTemplate> {
    return prisma.notificationTemplate.update({
      where: { id },
      data
    });
  }

  async delete(id: string, deletedBy?: string): Promise<NotificationTemplate> {
    return prisma.notificationTemplate.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false
      }
    });
  }
}
