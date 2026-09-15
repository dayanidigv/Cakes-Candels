import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AuditLogRepository } from '@cc-erp/database';
import { AuthGuard } from '../../../common/guards';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(AuthGuard)
export class AuditLogController {
  private readonly auditLogRepository = new AuditLogRepository();

  @Get()
  @ApiOperation({ summary: 'Get live transaction audit logs' })
  async findAll(@Query('limit') limit?: string): Promise<any> {
    const take = limit ? parseInt(limit, 10) : 50;
    return this.auditLogRepository.findAll(isNaN(take) ? 50 : take);
  }
}
