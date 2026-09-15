import { prisma, FeatureFlag, Prisma } from '../client/index';

export class FeatureFlagRepository {
  async findAll(): Promise<FeatureFlag[]> {
    return prisma.featureFlag.findMany({
      orderBy: { key: 'asc' }
    });
  }

  async findUnique(key: string, branchId: string | null): Promise<FeatureFlag | null> {
    if (branchId) {
      return prisma.featureFlag.findUnique({
        where: {
          branchId_key: {
            branchId,
            key
          }
        }
      });
    }
    return prisma.featureFlag.findFirst({
      where: {
        key,
        branchId: null
      }
    });
  }

  async upsert(key: string, isEnabled: boolean, branchId: string | null): Promise<FeatureFlag> {
    const targetBranchId = branchId || null;
    const existing = await prisma.featureFlag.findFirst({
      where: {
        key,
        branchId: targetBranchId
      }
    });

    if (existing) {
      return prisma.featureFlag.update({
        where: { id: existing.id },
        data: { isEnabled }
      });
    } else {
      return prisma.featureFlag.create({
        data: {
          key,
          isEnabled,
          branchId: targetBranchId
        }
      });
    }
  }
}
