import { Module } from '@nestjs/common';
import { IdentityModule } from '../../identity/identity.module';
import { ApprovalWorkflowService } from './approval-workflows.service';
import { ApprovalWorkflowController } from './approval-workflows.controller';

@Module({
  imports: [IdentityModule],
  controllers: [ApprovalWorkflowController],
  providers: [ApprovalWorkflowService],
  exports: [ApprovalWorkflowService]
})
export class ApprovalWorkflowModule {}
