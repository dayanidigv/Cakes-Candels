import { PrismaClient } from '@prisma/client';

export async function seedSprint3(prisma: PrismaClient, orgId: string, factoryId: string) {
  console.log('--- Starting Sprint 3 Seeding (Product Master) ---');

  // 1. Fetch dependencies
  const category = await prisma.category.findUnique({ where: { organizationId_name: { organizationId: orgId, name: 'Cakes' } } });
  const brand = await prisma.brand.findUnique({ where: { organizationId_name: { organizationId: orgId, name: 'Cakes & Candles In-house' } } });
  const uom = await prisma.unitOfMeasure.findUnique({ where: { organizationId_symbol: { organizationId: orgId, symbol: 'kg' } } });
  const uomPc = await prisma.unitOfMeasure.findUnique({ where: { organizationId_symbol: { organizationId: orgId, symbol: 'pcs' } } });
  const taxRule = await prisma.taxRule.findUnique({ where: { organizationId_name: { organizationId: orgId, name: 'GST 18%' } } });

  if (!category || !brand || !uom || !uomPc || !taxRule) {
    console.error('Missing Sprint 2 dependencies for Sprint 3 Seed');
    return;
  }

  // 2. Create Base Product
  const product = await prisma.product.upsert({
    where: { organizationId_sku: { organizationId: orgId, sku: 'BFC-BASE' } },
    update: {},
    create: {
      organizationId: orgId,
      type: 'VARIANT_PARENT',
      sku: 'BFC-BASE',
      name: 'Black Forest Cake',
      description: 'Signature Black Forest Cake',
      categoryId: category.id,
      brandId: brand.id,
      taxRuleId: taxRule.id,
      uomId: uomPc.id, // Sold in pieces
      isPerishable: true,
      shelfLifeDays: 3,
    },
  });

  // 3. Create Variants
  const variantsData = [
    {
      sku: 'BFC-0.5KG',
      name: 'Black Forest Cake - 0.5 Kg',
      barcode: '890123456001',
      costPrice: 200.0,
      mrp: 500.0,
      sellingPrice: 450.0,
    },
    {
      sku: 'BFC-1.0KG',
      name: 'Black Forest Cake - 1.0 Kg',
      barcode: '890123456002',
      costPrice: 380.0,
      mrp: 900.0,
      sellingPrice: 850.0,
    }
  ];

  for (const v of variantsData) {
    const variant = await prisma.productVariant.upsert({
      where: { organizationId_sku: { organizationId: orgId, sku: v.sku } },
      update: {},
      create: {
        organizationId: orgId,
        productId: product.id,
        sku: v.sku,
        name: v.name,
        barcode: v.barcode,
      }
    });

    await prisma.productPricing.upsert({
      where: { variantId: variant.id },
      update: {},
      create: {
        variantId: variant.id,
        costPrice: v.costPrice,
        mrp: v.mrp,
        sellingPrice: v.sellingPrice,
      }
    });
  }

  console.log('✅ Sprint 3 Product Masters Seeded!');
}
