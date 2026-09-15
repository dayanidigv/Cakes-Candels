const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  let category = await prisma.category.findFirst({ where: { name: 'Cakes' } });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: 'Cakes',
        isActive: true,
      }
    });
  }

  let taxRule = await prisma.taxRule.findFirst();
  if (!taxRule) {
    taxRule = await prisma.taxRule.create({ data: { name: 'GST 18%', rate: 18, type: 'PERCENTAGE', isActive: true } });
  }

  let uom = await prisma.unitOfMeasure.findFirst();
  if (!uom) {
    uom = await prisma.unitOfMeasure.create({ data: { name: 'Each', symbol: 'EA', allowDecimal: false, isActive: true } });
  }

  const product = await prisma.product.create({
    data: {
      name: 'Premium Red Velvet',
      code: 'PRD_RV_01',
      description: 'Delicious Red Velvet cake.',
      category: { connect: { id: category.id } },
      taxRule: { connect: { id: taxRule.id } },
      baseUom: { connect: { id: uom.id } },
      productType: 'MANUFACTURED',
      salesUom: 'EA',
      isActive: true,
      variants: {
        create: [
          {
            name: '1kg Red Velvet',
            sku: 'SKU_RV_1KG',
            barcode: 'BC_RV_1KG',
            mrp: 750,
            salePrice: 700,
            isActive: true,
          }
        ]
      }
    },
    include: { variants: true }
  });

  const branch = await prisma.branch.findFirst();
  if (branch && product.variants[0]) {
    await prisma.stockBalance.create({
      data: {
        locationId: branch.id,
        variantId: product.variants[0].id,
        quantity: 100,
      }
    });
  }
  
  console.log("CREATED", product.name);
}
run();
