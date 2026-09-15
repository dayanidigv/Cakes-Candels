import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { LoyaltyService } from './loyalty.service';
import { Customer360Service } from './customer360.service';
import { RfmEngineService } from './rfm-engine.service';
import { CustomerHealthService } from './customer-health.service';
import { CustomerClvService } from './customer-clv.service';
import { SegmentationService } from './segmentation.service';
import { AutomationEngineService } from './automation-engine.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../../common/guards/branch-scope.guard';

@Controller('crm')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchScopeGuard)
export class CrmController {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly customer360Service: Customer360Service,
    private readonly rfmEngineService: RfmEngineService,
    private readonly customerHealthService: CustomerHealthService,
    private readonly customerClvService: CustomerClvService,
    private readonly segmentationService: SegmentationService,
    private readonly automationEngineService: AutomationEngineService,
  ) {}

  @Get('dashboard')
  async getDashboardStats(@Request() req: any) {
    return this.customer360Service.getDashboardStats({
      userBranchId: req.user?.branchId,
      scope: req.user?.scope,
    });
  }

  @Get('customers')
  async searchCustomers(
    @Query('search') search?: string,
    @Query('healthStatus') healthStatus?: string,
    @Query('rfmSegment') rfmSegment?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.customer360Service.searchCustomers({
      search,
      healthStatus,
      rfmSegment,
      page,
      limit,
      scopeOptions: {
        userBranchId: req?.user?.branchId,
        scope: req?.user?.scope,
      },
    });
  }

  @Get('segments')
  async getSegments() {
    await this.segmentationService.initDefaultSegments();
    return prisma.crmSegment.findMany({
      include: {
        _count: { select: { customers: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Get('automations')
  async getAutomations() {
    return prisma.crmAutomation.findMany({
      include: {
        runs: {
          orderBy: { executedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('customers/:id/360')
  async getCustomer360(@Param('id') id: string, @Request() req: any) {
    return this.customer360Service.getCustomer360(id, {
      userBranchId: req.user?.branchId,
      scope: req.user?.scope,
    });
  }

  @Post('customers/:id/activities')
  async logActivity(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.customer360Service.logActivity(id, {
      ...dto,
      performedBy: req.user?.sub,
    });
  }

  @Post('customers/:id/rfm/recalculate')
  async recalculateRfm(@Param('id') id: string) {
    return this.rfmEngineService.recalculateRfmForCustomer(id);
  }

  @Post('customers/:id/health/recalculate')
  async recalculateHealth(@Param('id') id: string) {
    return this.customerHealthService.recalculateHealthScore(id);
  }

  @Post('customers/:id/clv/recalculate')
  async recalculateClv(@Param('id') id: string) {
    return this.customerClvService.recalculateClv(id);
  }

  @Post('customers/:id/segments/evaluate')
  async evaluateSegments(@Param('id') id: string) {
    return this.segmentationService.evaluateSegmentsForCustomer(id);
  }

  @Post('automations/trigger')
  async triggerAutomation(@Body() dto: any) {
    return this.automationEngineService.processEvent(dto);
  }

  @Post('loyalty/redeem')
  async redeemPoints(@Body() dto: { customerId: string; points: number; orderId?: string }) {
    return this.loyaltyService.redeemPoints(prisma, dto.customerId, dto.points, dto.orderId);
  }
}
