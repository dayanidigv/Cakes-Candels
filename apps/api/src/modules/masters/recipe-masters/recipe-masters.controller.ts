import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, Query, Request } from '@nestjs/common';
import { RecipeMasterService } from './recipe-masters.service';
import { CreateRecipeMasterDto } from './dto/create-recipe-masters.dto';
import { UpdateRecipeMasterDto } from './dto/update-recipe-masters.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';
import { CreateRecipeVersionDto } from './dto/create-recipe-version.dto';
import { UpdateRecipeVersionDto } from './dto/update-recipe-version.dto';

import { RolesGuard } from '../../../common/guards/roles.guard';

@ApiTags('RecipeMaster (Advanced Masters)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
@Controller('masters/recipe-masters')
export class RecipeMasterController {
  constructor(private readonly service: RecipeMasterService) {}

  @Post()
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Create new RecipeMaster' })
  async create(@Body() createDto: CreateRecipeMasterDto, @Request() req) {
    const data = await this.service.create(createDto, req.user?.sub);
    return { success: true, message: 'RecipeMaster created successfully', data };
  }

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'List RecipeMaster with pagination and search' })
  async findAll(@Query() query: any) {
    const data = await this.service.findAll(query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get RecipeMaster by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Update RecipeMaster' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateRecipeMasterDto, @Request() req) {
    const data = await this.service.update(id, updateDto, req.user?.sub);
    return { success: true, message: 'RecipeMaster updated successfully', data };
  }

  @Delete(':id')
  @RequirePermissions('masters:delete')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Soft delete RecipeMaster' })
  async remove(@Param('id') id: string, @Request() req) {
    const data = await this.service.remove(id, req.user?.sub);
    return { success: true, message: 'RecipeMaster deleted successfully', data };
  }

  @Post(':id/versions')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Add a version to a RecipeMaster' })
  async addVersion(@Param('id') id: string, @Body() createDto: CreateRecipeVersionDto, @Request() req) {
    const data = await this.service.addVersion(id, createDto, req.user?.sub);
    return { success: true, message: 'Version added successfully', data };
  }

  @Patch(':id/versions/:versionId')
  @RequirePermissions('masters:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Update a RecipeVersion' })
  async updateVersion(@Param('id') id: string, @Param('versionId') versionId: string, @Body() updateDto: UpdateRecipeVersionDto, @Request() req) {
    const data = await this.service.updateVersion(id, versionId, updateDto, req.user?.sub);
    return { success: true, message: 'Version updated successfully', data };
  }

  @Delete(':id/versions/:versionId')
  @RequirePermissions('masters:delete')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Soft delete a RecipeVersion' })
  async removeVersion(@Param('id') id: string, @Param('versionId') versionId: string, @Request() req) {
    const data = await this.service.removeVersion(id, versionId, req.user?.sub);
    return { success: true, message: 'Version deleted successfully', data };
  }
}
