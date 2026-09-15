import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BranchScopeGuard } from '../../../common/guards/branch-scope.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { DesignationService } from '../services/designation.service';
import type { RequestingUser } from '../services/employee.service';
import { CreateDesignationDto, UpdateDesignationDto } from '../dto/designation.dto';

@ApiTags('HR — Designations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BranchScopeGuard, PermissionsGuard)
@Controller('hr/designations')
export class DesignationController {
  constructor(private readonly designationService: DesignationService) {}

  @Get()
  @RequirePermissions('hr:employee:read')
  @ApiOperation({ summary: 'List all designations in organization' })
  async getDesignations(@CurrentUser() user: RequestingUser) {
    const data = await this.designationService.findAll(user);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('hr:employee:read')
  @ApiOperation({ summary: 'Get designation details' })
  async getDesignation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.designationService.findById(id, user);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Create designation' })
  async createDesignation(
    @Body() dto: CreateDesignationDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.designationService.create(dto, user);
    return { success: true, message: 'Designation created successfully', data };
  }

  @Patch(':id')
  @RequirePermissions('hr:employee:write')
  @ApiOperation({ summary: 'Update designation' })
  async updateDesignation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDesignationDto,
    @CurrentUser() user: RequestingUser,
  ) {
    const data = await this.designationService.update(id, dto, user);
    return { success: true, message: 'Designation updated successfully', data };
  }
}
