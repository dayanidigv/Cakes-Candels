import { prisma, SystemSetting, BranchSetting, Prisma } from '../client/index';

export class SystemSettingRepository {
  async findAllSystem(): Promise<SystemSetting[]> {
    return prisma.systemSetting.findMany({
      orderBy: { key: 'asc' }
    });
  }

  async findAllBranch(): Promise<BranchSetting[]> {
    return prisma.branchSetting.findMany({
      orderBy: { key: 'asc' }
    });
  }

  async findSystemSettingByKey(key: string): Promise<SystemSetting | null> {
    return prisma.systemSetting.findUnique({
      where: { key }
    });
  }

  async findBranchSettingByKey(branchId: string, key: string): Promise<BranchSetting | null> {
    return prisma.branchSetting.findUnique({
      where: {
        branchId_key: {
          branchId,
          key
        }
      }
    });
  }

  async upsertSystemSetting(key: string, value: string, description?: string): Promise<SystemSetting> {
    return prisma.systemSetting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description }
    });
  }

  async upsertBranchSetting(branchId: string, key: string, value: string): Promise<BranchSetting> {
    return prisma.branchSetting.upsert({
      where: {
        branchId_key: {
          branchId,
          key
        }
      },
      update: { value },
      create: { branchId, key, value }
    });
  }
}
