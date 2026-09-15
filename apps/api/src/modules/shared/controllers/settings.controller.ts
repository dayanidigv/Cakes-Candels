import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { AuthGuard } from '../../../common/guards';
import { CreateOrUpdateSettingDto } from '../dto/create-or-update-setting.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system and branch settings' })
  async findAll(): Promise<any> {
    const systemSettings = await this.settingsService.getSystemSettings();
    const branchSettings = await this.settingsService.getBranchSettings();
    return {
      systemSettings,
      branchSettings
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create or update system/branch setting override' })
  async upsert(@Body() dto: CreateOrUpdateSettingDto): Promise<any> {
    if (dto.branchId) {
      await this.settingsService.setBranchSetting(dto.branchId, dto.key, dto.value);
      return this.settingsService.getBranchSettingDetail(dto.branchId, dto.key);
    } else {
      await this.settingsService.setSystemSetting(dto.key, dto.value, dto.description);
      return this.settingsService.getSystemSettingDetail(dto.key);
    }
  }
}
