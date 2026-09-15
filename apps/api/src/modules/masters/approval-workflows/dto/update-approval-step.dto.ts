import { PartialType } from '@nestjs/swagger';
import { CreateApprovalStepDto } from './create-approval-step.dto';

export class UpdateApprovalStepDto extends PartialType(CreateApprovalStepDto) {}
