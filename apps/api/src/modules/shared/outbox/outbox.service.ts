import { Injectable } from '@nestjs/common';
import { prisma, Event } from '@cc-erp/database';

@Injectable()
export class OutboxService {
  async publishEvent(name: string, type: 'DOMAIN' | 'INTEGRATION' | 'NOTIFICATION', payload: any, tx?: any): Promise<Event> {
    const db = tx || prisma;
    
    const event = await db.event.create({
      data: {
        name,
        type,
        payload
      }
    });

    await db.eventQueue.create({
      data: {
        eventId: event.id,
        status: 'PENDING'
      }
    });

    return event;
  }
}
