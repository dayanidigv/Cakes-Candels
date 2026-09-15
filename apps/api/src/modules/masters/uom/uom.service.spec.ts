import { Test, TestingModule } from '@nestjs/testing';
import { UomService } from './uom.service';
import { prisma } from '@cc-erp/database';
import { Decimal } from '@prisma/client/runtime/library';

describe('UomService Conversions', () => {
  let service: UomService;
  
  let kgId: string;
  let gId: string;
  let lId: string;
  let mlId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UomService],
    }).compile();

    service = module.get<UomService>(UomService);

    // Fetch existing seed data UOMs for testing
    const org = await prisma.organization.findFirst();
    const orgId = org ? org.id : '11111111-1111-1111-1111-111111111111';
    const kg = await prisma.unitOfMeasure.findUnique({ where: { organizationId_symbol: { organizationId: orgId, symbol: 'kg' } } });
    const g = await prisma.unitOfMeasure.findUnique({ where: { organizationId_symbol: { organizationId: orgId, symbol: 'g' } } });
    const l = await prisma.unitOfMeasure.findUnique({ where: { organizationId_symbol: { organizationId: orgId, symbol: 'L' } } });
    const ml = await prisma.unitOfMeasure.findUnique({ where: { organizationId_symbol: { organizationId: orgId, symbol: 'ml' } } });
    
    kgId = kg.id;
    gId = g.id;
    lId = l.id;
    mlId = ml.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should convert 1 kg to 1000 g', async () => {
    const result = await service.convert(new Decimal(1), kgId, gId);
    expect(result.toNumber()).toBe(1000);
  });

  it('should convert 1000 g to 1 kg', async () => {
    const result = await service.convert(new Decimal(1000), gId, kgId);
    expect(result.toNumber()).toBe(1);
  });

  it('should return same quantity if units match', async () => {
    const result = await service.convert(new Decimal(5.5), kgId, kgId);
    expect(result.toNumber()).toBe(5.5);
  });

  it('should throw when converting kg to L (incompatible family)', async () => {
    await expect(service.convert(new Decimal(1), kgId, lId)).rejects.toThrow();
  });
  
  it('should convert large quantities precisely using Decimal', async () => {
    // Decimal prevents floating point error
    const result = await service.convert(new Decimal('9999999.99'), kgId, gId);
    expect(result.toString()).toBe('9999999990');
  });
});
