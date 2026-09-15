import { PartialType } from '@nestjs/swagger';
import { CreateApprovalWorkflowDto } from './create-approval-workflows.dto';

export class UpdateApprovalWorkflowDto extends PartialType(CreateApprovalWorkflowDto) {}
