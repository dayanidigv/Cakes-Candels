import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@cc-erp/database';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendNotification(dto: { recipient: string; type: 'WHATSAPP' | 'EMAIL' | 'SMS' | 'PUSH'; content: string }): Promise<any> {
    this.logger.log(`[NotificationService Stub] Queueing notification to ${dto.recipient} (${dto.type})`);
    
    return prisma.notificationQueue.create({
      data: {
        recipient: dto.recipient,
        type: dto.type,
        content: dto.content,
        status: 'PENDING',
        attempts: 0
      }
    });
  }
}
