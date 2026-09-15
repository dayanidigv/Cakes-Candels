import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomCakesService } from './custom-cakes.service';

@ApiTags('Custom Cake Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('custom-cakes')
export class CustomCakesController {
  constructor(private readonly service: CustomCakesService) {}

  @Post()
  @ApiOperation({ summary: 'Book a new custom cake order — validates layer weight rules and 24hr delivery advance' })
  async create(
    @Request() req,
    @Body() body: {
      customerName: string;
      mobileNumber: string;
      branchId: string;
      flavor: string;
      shape?: string;
      cakeType: string;
      weightKg: number;
      eggless: boolean;
      creamType?: string;
      specialInstructions?: string;
      designImageUrl?: string;
      deliveryDatetime: string;
      deliveryType: 'PICKUP' | 'DELIVERY';
      advancePayment: number;
    },
  ) {
    const data = await this.service.create({ ...body, createdBy: req.user?.sub });
    return { success: true, message: 'Custom cake order booked successfully', data };
  }

  @Get()
  @ApiOperation({ summary: 'List custom cake orders with optional status and branch filter' })
  async findAll(@Query('status') status?: string, @Query('branchId') branchId?: string) {
    const data = await this.service.findAll(status, branchId);
    return { success: true, data };
  }

  @Get('pipeline/summary')
  @ApiOperation({ summary: 'Get count of orders in each pipeline stage' })
  async getPipelineSummary() {
    const data = await this.service.getPipelineSummary();
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get custom cake order details' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { success: true, data };
  }

  @Patch(':id/advance')
  @ApiOperation({ summary: 'Advance order to next pipeline stage: BOOKED→APPROVED→BAKING→DECORATING→QC→READY→DELIVERED' })
  async advanceStatus(@Param('id') id: string, @Body() body: { chefNotes?: string }) {
    const data: any = await this.service.advanceStatus(id, body.chefNotes);
    return { success: true, message: `Order advanced to ${data.status}`, data };
  }

  @Patch(':id/assign-chef')
  @ApiOperation({ summary: 'Assign a chef to a custom cake order' })
  async assignChef(@Param('id') id: string, @Body() body: { chefId: string }) {
    const data = await this.service.assignChef(id, body.chefId);
    return { success: true, message: 'Chef assigned', data };
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a custom cake order (cannot cancel DELIVERED orders)' })
  async cancel(@Param('id') id: string, @Body() body: { reason: string }) {
    const data = await this.service.cancel(id, body.reason);
    return { success: true, message: 'Order cancelled', data };
  }
}
