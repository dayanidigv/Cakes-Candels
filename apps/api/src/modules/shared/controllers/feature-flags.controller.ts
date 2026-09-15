import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { AuthGuard } from '../../../common/guards';
import { SetFeatureFlagDto } from '../dto/set-feature-flag.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@Controller('feature-flags')
@UseGuards(AuthGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all feature flags' })
  async findAll(): Promise<any> {
    return this.featureFlagsService.getFeatureFlags();
  }

  @Post()
  @ApiOperation({ summary: 'Create or update feature flag toggle' })
  async setFlag(@Body() dto: SetFeatureFlagDto): Promise<any> {
    await this.featureFlagsService.setFlag(dto.key, dto.isEnabled, dto.branchId);
    return this.featureFlagsService.getFeatureFlagDetail(dto.key, dto.branchId);
  }
}
