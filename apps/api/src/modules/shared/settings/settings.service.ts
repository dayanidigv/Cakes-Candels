import { Injectable } from '@nestjs/common';
import { SystemSettingRepository } from '@cc-erp/database';

@Injectable()
export class SettingsService {
  private readonly systemSettingRepository = new SystemSettingRepository();

  async getSystemSettings(): Promise<any[]> {
    return this.systemSettingRepository.findAllSystem();
  }

  async getBranchSettings(): Promise<any[]> {
    return this.systemSettingRepository.findAllBranch();
  }

  async getSystemSettingDetail(key: string): Promise<any> {
    return this.systemSettingRepository.findSystemSettingByKey(key);
  }

  async getBranchSettingDetail(branchId: string, key: string): Promise<any> {
    return this.systemSettingRepository.findBranchSettingByKey(branchId, key);
  }

  async getSystemSetting(key: string): Promise<string | null> {
    const setting = await this.systemSettingRepository.findSystemSettingByKey(key);
    return setting ? setting.value : null;
  }

  async getBranchSetting(branchId: string, key: string): Promise<string | null> {
    const setting = await this.systemSettingRepository.findBranchSettingByKey(branchId, key);
    return setting ? setting.value : null;
  }

  async setSystemSetting(key: string, value: string, description?: string): Promise<void> {
    await this.systemSettingRepository.upsertSystemSetting(key, value, description);
  }

  async setBranchSetting(branchId: string, key: string, value: string): Promise<void> {
    await this.systemSettingRepository.upsertBranchSetting(branchId, key, value);
  }
}
