import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuditInterceptor } from '../../../common/interceptors/audit.interceptor';

@ApiTags('Masters - Category')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('masters/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:write')
  @ApiOperation({ summary: 'Create Category' })
  create(@Body() createDto: CreateCategoryDto, @CurrentUser() user: any) {
    return this.categoryService.create(user.organizationId, createDto);
  }

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get all categories (flat)' })
  findAll(@CurrentUser() user: any) {
    return this.categoryService.findAll(user.organizationId);
  }

  @Get('tree')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get category hierarchy tree (for storefront/POS navigation)' })
  findTree(@CurrentUser() user: any) {
    return this.categoryService.findTree(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get Category by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.categoryService.findById(user.organizationId, id);
  }

  @Patch(':id')
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:write')
  @ApiOperation({ summary: 'Update Category' })
  update(@Param('id') id: string, @Body() updateDto: UpdateCategoryDto, @CurrentUser() user: any) {
    return this.categoryService.update(user.organizationId, id, updateDto);
  }

  @Delete(':id')
  @UseInterceptors(AuditInterceptor)
  @RequirePermissions('masters:delete')
  @ApiOperation({ summary: 'Delete Category' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.categoryService.remove(user.organizationId, id, user.sub);
  }
}
