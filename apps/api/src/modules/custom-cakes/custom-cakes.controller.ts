import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { prisma, CustomCakeStatus } from '@cc-erp/database';
import { CustomCakesService } from '../sales/custom-cakes/custom-cakes.service';

// Business Rules from FRS:
// 1 Layer -> min 1.0 kg
// 2 Layer -> min 1.5 kg
// 3 Layer -> min 3.0 kg
// Delivery must be > 24hrs in future
const LAYER_MIN_WEIGHT: Record<string, number> = {
  '1': 1.0,
  '2': 1.5,
  '3': 3.0,
};

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
      cakeType: string; // '1' | '2' | '3' layers
      weightKg: number;
      eggless: boolean;
      creamType?: string;
      specialInstructions?: string;
      designImageUrl?: string;
      deliveryDatetime: string;
      deliveryType: 'PICKUP' | 'DELIVERY';
      quoteAmount: number;
      advancePayment: number;
    },
  ) {
    // ─── Business Rule Validations ─────────────────────────────────────────────
    const minWeight = LAYER_MIN_WEIGHT[body.cakeType] ?? 1.0;
    if (body.weightKg < minWeight) {
      throw new BadRequestException(
        `Minimum weight for ${body.cakeType}-layer cake is ${minWeight} kg. Provided: ${body.weightKg} kg`
      );
    }
    if (body.weightKg > 25) {
      throw new BadRequestException('Maximum cake weight is 25 kg');
    }

    const scheduledAt = new Date(body.deliveryDatetime);
    const hoursAhead = (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursAhead < 24) {
      throw new BadRequestException('Delivery date must be at least 24 hours in the future');
    }

    if (!body.quoteAmount || body.quoteAmount <= 0) {
      throw new BadRequestException('A quote amount is required to book a custom cake order');
    }

    // Find/create customer
    let customer = await prisma.customer.findUnique({ where: { phone: body.mobileNumber } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { phone: body.mobileNumber, fullName: body.customerName },
      });
    }

    const advancePercentage = (body.advancePayment / body.quoteAmount) * 100;
    const eggless = body.eggless ? 'Eggless order.' : '';
    const specialInstructions = [eggless, body.specialInstructions].filter(Boolean).join(' ') || undefined;

    // NOTE: the global TransformInterceptor already wraps every controller return value
    // in {success, message, data} - do not wrap again here (the previous version of this
    // controller did, which meant the frontend's single-level unwrap always received the
    // wrapper object instead of the real payload, e.g. the orders list always rendered empty).
    return this.service.createQuote(req.user?.sub, req.user?.organizationId, {
      customerId: customer.id,
      branchId: body.branchId,
      flavour: body.flavor,
      weight: body.weightKg,
      shape: body.shape,
      layers: Number(body.cakeType) || 1,
      icing: body.creamType,
      designImages: body.designImageUrl ? [body.designImageUrl] : [],
      deliveryOrPickup: body.deliveryType,
      scheduledAt,
      quoteAmount: body.quoteAmount,
      advancePercentage,
      specialInstructions,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List custom cake orders with optional status and branch filter' })
  async findAll(@Request() req, @Query('status') status?: CustomCakeStatus, @Query('branchId') branchId?: string) {
    return this.service.findAll(req.user?.organizationId, status, branchId);
  }

  @Get('pipeline/summary')
  @ApiOperation({ summary: 'Get count of orders in each pipeline stage' })
  async getPipelineSummary(@Request() req) {
    return this.service.getPipelineSummary(req.user?.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get custom cake order details' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user?.organizationId);
  }

  @Patch(':id/advance')
  @ApiOperation({ summary: 'Advance order to the next stage in the standard production pipeline' })
  async advanceStatus(@Param('id') id: string, @Request() req) {
    return this.service.advanceToNextStage(id, req.user?.sub);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a custom cake order (cannot cancel DELIVERED/COMPLETED orders)' })
  async cancel(@Param('id') id: string, @Body() body: { reason: string }, @Request() req) {
    return this.service.transitionStatus(id, CustomCakeStatus.CANCELLED, undefined, req.user?.sub, body.reason);
  }

  // NOTE: chef assignment was previously exposed here via a fictional assignedChefId
  // field that does not exist on CustomCakeOrder. The schema links kitchen work through
  // CustomCakeOrder.productionOrders (ProductionOrder[]) instead, so assigning a chef is
  // a production-module operation, not a field update on the cake order itself. Not
  // implemented here - needs proper integration with the production module.
}
