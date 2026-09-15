import { Module, Global } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './controllers/health.controller';
import { SettingsController } from './controllers/settings.controller';
import { FeatureFlagsController } from './controllers/feature-flags.controller';
import { AuditLogController } from './controllers/audit-log.controller';
import { SettingsService } from './settings/settings.service';
import { FeatureFlagsService } from './feature-flags/feature-flags.service';
import { OutboxService } from './outbox/outbox.service';
import { EventBusService } from './event-bus/event-bus.service';
import { StorageService } from './services/storage.service';
import { NotificationService } from './services/notification.service';
import { HealthService } from './services/health.service';
import { IdentityModule } from '../identity/identity.module';

@Global()
@Module({
  imports: [TerminusModule, IdentityModule],
  controllers: [
    HealthController,
    SettingsController,
    FeatureFlagsController,
    AuditLogController
  ],
  providers: [
    HealthService,
    SettingsService,
    FeatureFlagsService,
    OutboxService,
    EventBusService,
    StorageService,
    NotificationService
  ],
  exports: [
    HealthService,
    SettingsService,
    FeatureFlagsService,
    OutboxService,
    EventBusService,
    StorageService,
    NotificationService
  ]
})
export class SharedModule {}
