import { Controller, Get, Post, Body, Query, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { GrnService } from './grn.service';
import { CreateGrnDto } from './dto/procurement.dto';

@ApiTags('Procurement - GRN (Sprint 6)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('procurement/grn')
export class GrnController {
  constructor(private readonly service: GrnService) {}

  @Post()
  @RequirePermissions('procurement:write')
  @UseInterceptors(AuditInterceptor)
  @ApiOperation({ summary: 'Create Goods Receipt Note (GRN)' })
  async createGrn(@Body() dto: CreateGrnDto, @Request() req) {
    const data = await this.service.createGrn(dto, req.user?.sub);
    return { success: true, message: 'GRN created and goods received into inventory', data };
  }

  @Get()
  @RequirePermissions('procurement:read')
  @ApiOperation({ summary: 'List GRNs' })
  async getGrns(@Query() query: any) {
    const data = await this.service.getGrns(query);
    return { success: true, data };
  }
}
