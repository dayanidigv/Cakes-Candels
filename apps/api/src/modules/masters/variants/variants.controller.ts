import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { VariantsService } from './variants.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Product Variants (Master)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('masters/variants')
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Get()
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'List all variants' })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(@Query('search') search?: string) {
    return this.variantsService.findAll(search);
  }

  @Get(':id')
  @RequirePermissions('masters:read')
  @ApiOperation({ summary: 'Get variant by ID' })
  findOne(@Param('id') id: string) {
    return this.variantsService.findOne(id);
  }
}
