import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, Query, Request } from '@nestjs/common';
import { ApprovalWorkflowService } from './approval-workflows.service';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflows.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflows.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';
import { CreateApprovalStepDto } from './dto/create-approval-step.dto';
import { UpdateApprovalStepDto } from './dto/update-approval-step.dto';

import { RolesGuard } from '../../../common/guards/roles.guard';

@ApiTags('ApprovalWorkflow (Advanced Masters)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
@Controller('masters/approval-workflows')
export class ApprovalWorkflowController {
  constructor(private readonly service: ApprovalWorkflowService) {}

  @Post()
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Create new ApprovalWorkflow' })
  async create(@Body() createDto: CreateApprovalWorkflowDto, @Request() req) {
    const data = await this.service.create(createDto, req.user?.sub);
    return { success: true, message: 'ApprovalWorkflow created successfully', data };
  }

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'List ApprovalWorkflow with pagination and search' })
  async findAll(@Query() query: any) {
    const data = await this.service.findAll(query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get ApprovalWorkflow by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Update ApprovalWorkflow' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateApprovalWorkflowDto, @Request() req) {
    const data = await this.service.update(id, updateDto, req.user?.sub);
    return { success: true, message: 'ApprovalWorkflow updated successfully', data };
  }

  @Delete(':id')
  @RequirePermissions('masters:delete')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Soft delete ApprovalWorkflow' })
  async remove(@Param('id') id: string, @Request() req) {
    const data = await this.service.remove(id, req.user?.sub);
    return { success: true, message: 'ApprovalWorkflow deleted successfully', data };
  }

  @Post(':id/steps')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Add a step to an ApprovalWorkflow' })
  async addStep(@Param('id') id: string, @Body() createDto: CreateApprovalStepDto, @Request() req) {
    const data = await this.service.addStep(id, createDto, req.user?.sub);
    return { success: true, message: 'Step added successfully', data };
  }

  @Patch(':id/steps/:stepId')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Update an ApprovalStep' })
  async updateStep(@Param('id') id: string, @Param('stepId') stepId: string, @Body() updateDto: UpdateApprovalStepDto, @Request() req) {
    const data = await this.service.updateStep(id, stepId, updateDto, req.user?.sub);
    return { success: true, message: 'Step updated successfully', data };
  }

  @Delete(':id/steps/:stepId')
  @RequirePermissions('masters:delete')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Soft delete an ApprovalStep' })
  async removeStep(@Param('id') id: string, @Param('stepId') stepId: string, @Request() req) {
    const data = await this.service.removeStep(id, stepId, req.user?.sub);
    return { success: true, message: 'Step deleted successfully', data };
  }
}
