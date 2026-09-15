import { Injectable } from '@nestjs/common';
import { FeatureFlagRepository } from '@cc-erp/database';

@Injectable()
export class FeatureFlagsService {
  private readonly featureFlagRepository = new FeatureFlagRepository();

  async isEnabled(key: string, branchId?: string): Promise<boolean> {
    if (branchId) {
      const branchFlag = await this.featureFlagRepository.findUnique(key, branchId);
      if (branchFlag) {
        return branchFlag.isEnabled;
      }
    }

    const flag = await this.featureFlagRepository.findUnique(key, null);
    return flag ? flag.isEnabled : false;
  }

  async getFeatureFlags(): Promise<any[]> {
    return this.featureFlagRepository.findAll();
  }

  async getFeatureFlagDetail(key: string, branchId?: string): Promise<any> {
    return this.featureFlagRepository.findUnique(key, branchId || null);
  }

  async setFlag(key: string, isEnabled: boolean, branchId?: string): Promise<void> {
    await this.featureFlagRepository.upsert(key, isEnabled, branchId || null);
  }
}
