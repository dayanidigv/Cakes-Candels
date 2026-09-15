import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { OutboxService } from '../outbox/outbox.service';

@Injectable()
export class EventBusService {
  private eventSubject = new Subject<{ name: string; payload: any }>();
  
  constructor(private readonly outboxService: OutboxService) {}

  get stream$() {
    return this.eventSubject.asObservable();
  }

  async publish(name: string, type: 'DOMAIN' | 'INTEGRATION' | 'NOTIFICATION', payload: any, tx?: any) {
    await this.outboxService.publishEvent(name, type, payload, tx);
    this.eventSubject.next({ name, payload });
    console.log(`[EventBus] Published event: ${name}`);
  }
}
