import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';

@ApiTags('Masters - Brand')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('masters/brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:write')
  @ApiOperation({ summary: 'Create Brand' })
  create(@Body() createDto: CreateBrandDto) {
    return this.brandService.create(createDto);
  }

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get all brands' })
  findAll() {
    return this.brandService.findAll();
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get Brand by ID' })
  findOne(@Param('id') id: string) {
    return this.brandService.findById(id);
  }

  @Patch(':id')
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:write')
  @ApiOperation({ summary: 'Update Brand' })
  update(@Param('id') id: string, @Body() updateDto: UpdateBrandDto) {
    return this.brandService.update(id, updateDto);
  }

  @Delete(':id')
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:delete')
  @ApiOperation({ summary: 'Delete Brand' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.brandService.remove(id, user.sub);
  }
}
