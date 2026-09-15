import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CrmService } from './crm.service';

@ApiTags('CRM & Loyalty')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly service: CrmService) {}

  // ─── CUSTOMERS ──────────────────────────────────────────────────────────────

  @Get('customers')
  @ApiOperation({ summary: 'Search all customers with loyalty profile' })
  async getAllCustomers(@Query('search') search?: string) {
    const data = await this.service.getAllCustomers(search);
    return { success: true, data };
  }

  @Get('customers/phone/:phone')
  @ApiOperation({ summary: 'Get customer by phone number with loyalty data' })
  async getByPhone(@Param('phone') phone: string) {
    const data = await this.service.getCustomerByPhone(phone);
    return { success: true, data };
  }

  @Get('customers/:id/loyalty')
  @ApiOperation({ summary: 'Get customer loyalty point balance' })
  async getLoyalty(@Param('id') id: string) {
    const data = await this.service.getLoyaltyBalance(id);
    return { success: true, data: { points: data } };
  }

  // ─── BIRTHDAY / ANNIVERSARY ─────────────────────────────────────────────────

  @Get('birthdays/today')
  @ApiOperation({ summary: "Get today's birthday customers for campaign automation" })
  async todayBirthdays() {
    const data = await this.service.getTodaysBirthdayCustomers();
    return { success: true, data };
  }

  @Get('anniversaries/today')
  @ApiOperation({ summary: "Get today's anniversary customers" })
  async todayAnniversaries() {
    const data = await this.service.getTodaysAnniversaryCustomers();
    return { success: true, data };
  }

  // ─── CAMPAIGNS ──────────────────────────────────────────────────────────────

  @Get('campaigns')
  @ApiOperation({ summary: 'List all marketing campaigns' })
  async getCampaigns() {
    const data = await this.service.getCampaigns();
    return { success: true, data };
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create and queue a new marketing campaign' })
  async createCampaign(@Body() body: { name: string; channel: string; templateContent: string; segmentFilter?: string }) {
    const data = await this.service.createCampaign(body);
    return { success: true, message: 'Campaign queued successfully', data };
  }

  // ─── SEGMENTS ───────────────────────────────────────────────────────────────

  @Get('segments')
  @ApiOperation({ summary: 'Get loyalty segment tier definitions' })
  getSegments() {
    const data = this.service.getSegments();
    return { success: true, data };
  }
}
