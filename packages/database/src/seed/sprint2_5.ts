
import { PrismaClient } from '@prisma/client';

export async function seedSprint2_5(prisma: PrismaClient, orgId: string, factoryId: string, retailId: string, roleId: string) {
  console.log('--- Starting Sprint 2.5 Seeding ---');

  // 1. Product Attributes
  const attrFlavor = await prisma.productAttribute.upsert({
    where: { organizationId_name: { organizationId: orgId, name: 'Flavor' } },
    update: {},
    create: { organizationId: orgId, name: 'Flavor', type: 'TEXT' }
  });
  const attrSize = await prisma.productAttribute.upsert({
    where: { organizationId_name: { organizationId: orgId, name: 'Size' } },
    update: {},
    create: { organizationId: orgId, name: 'Size', type: 'TEXT' }
  });

  await prisma.productAttributeValue.upsert({ where: { attributeId_value: { attributeId: attrFlavor.id, value: 'Vanilla' } }, update: {}, create: { attributeId: attrFlavor.id, value: 'Vanilla' }});
  await prisma.productAttributeValue.upsert({ where: { attributeId_value: { attributeId: attrFlavor.id, value: 'Chocolate' } }, update: {}, create: { attributeId: attrFlavor.id, value: 'Chocolate' }});
  await prisma.productAttributeValue.upsert({ where: { attributeId_value: { attributeId: attrSize.id, value: '1 Kg' } }, update: {}, create: { attributeId: attrSize.id, value: '1 Kg' }});

  // 2. Tax Components (Assuming GST 18% exists)
  const gst18 = await prisma.taxRule.findUnique({ where: { organizationId_name: { organizationId: orgId, name: 'GST 18%' } } });
  if (gst18) {
    await prisma.taxComponent.upsert({ where: { taxRuleId_componentName: { taxRuleId: gst18.id, componentName: 'CGST' } }, update: {}, create: { taxRuleId: gst18.id, componentName: 'CGST', rate: 9.0 }});
    await prisma.taxComponent.upsert({ where: { taxRuleId_componentName: { taxRuleId: gst18.id, componentName: 'SGST' } }, update: {}, create: { taxRuleId: gst18.id, componentName: 'SGST', rate: 9.0 }});
  }

  // 3. Number Series
  await prisma.numberSeries.upsert({
    where: { organizationId_documentType_branchId: { organizationId: orgId, documentType: 'SO', branchId: retailId } },
    update: {},
    create: { organizationId: orgId, documentType: 'SO', prefix: 'SO-', currentNumber: 0, length: 6, branchId: retailId }
  });

  // 4. Payment Methods
  const payments = [
    { code: 'CASH', name: 'Cash', requiresReference: false },
    { code: 'UPI', name: 'UPI', requiresReference: true },
    { code: 'CARD', name: 'Credit/Debit Card', requiresReference: true }
  ];
  for (const p of payments) {
    await prisma.paymentMethod.upsert({ where: { code: p.code }, update: {}, create: p });
  }

  // 5. Designations
  const designations = [
    { title: 'Pastry Chef', department: 'Production' },
    { title: 'Store Keeper', department: 'Inventory' },
    { title: 'Cashier', department: 'Retail' }
  ];
  for (const d of designations) {
    await prisma.designation.upsert({ where: { title: d.title }, update: {}, create: d });
  }

  // 6. Reason Masters
  const reasons = [
    { type: 'DAMAGE', code: 'DMG01', description: 'Handling Damage' },
    { type: 'EXPIRY', code: 'EXP01', description: 'Expired Item' }
  ];
  for (const r of reasons) {
    await prisma.reasonMaster.upsert({ where: { type_code: { type: r.type, code: r.code } }, update: {}, create: r });
  }

  // 7. Global Settings
  const settings = [
    { key: 'timezone', value: 'Asia/Kolkata', description: 'Default timezone' },
    { key: 'currency', value: 'INR', description: 'Default currency code' },
    { key: 'cake_slice_ratio', value: '8', description: 'Slices per 1 Kg' }
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  // 8. Wastage Approval Workflow
  const ownerRole = await prisma.role.findUnique({ where: { name: 'OWNER' } });
  if (ownerRole) {
    const wastageWorkflow = await prisma.approvalWorkflow.upsert({
      where: { moduleName: 'Wastage' },
      update: {},
      create: { moduleName: 'Wastage', description: 'Approval workflow for wastage logging' }
    });

    // Replace steps to ensure OWNER is the only step
    await prisma.approvalStep.deleteMany({ where: { workflowId: wastageWorkflow.id } });
    await prisma.approvalStep.create({
      data: {
        workflowId: wastageWorkflow.id,
        stepOrder: 1,
        requiredRoleId: ownerRole.id
      }
    });
  }

  console.log('✅ Sprint 2.5 Masters Seeded!');
}
