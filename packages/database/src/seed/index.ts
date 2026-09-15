import { prisma } from '../client/index';
import * as bcrypt from 'bcrypt';
import { seedSprint2_5 } from './sprint2_5';
import { seedSprint3 } from './sprint3';
import { seedSprint11 } from './sprint11';

async function main() {
  console.log('🌱 Start seeding database...');

  // ── 1. Organization ────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { name: 'Cakes & Candles Co.' },
    update: {},
    create: { code: 'CC001', name: 'Cakes & Candles Co.', taxIdentifier: 'GSTIN1234567890', website: 'https://cakesandcandles.com' }
  });
  console.log(`✅ Organization: ${org.name}`);

  // ── 2. Branches ────────────────────────────────────────────────────────
  const factory = await prisma.branch.upsert({
    where: { name: 'Central Factory' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Central Factory',
      type: 'FACTORY',
      address: '123 Factory Lane, Industrial Zone',
      phone: '+919876543210',
      gstin: 'GSTIN1234567890'
    }
  });

  const retail = await prisma.branch.upsert({
    where: { name: 'Anna Nagar Retail Branch' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Anna Nagar Retail Branch',
      type: 'RETAIL_BRANCH',
      address: '456 Retail Boulevard, Anna Nagar',
      phone: '+919876543211',
      gstin: 'GSTIN1234567891'
    }
  });
  console.log(`✅ Branches: ${factory.name}, ${retail.name}`);

  // ── 3. POS Register ───────────────────────────────────────────────────
  await prisma.pOSRegister.upsert({
    where: { deviceIdentifier: 'AnnaNagarReg1-UUID-Placeholder' },
    update: {},
    create: {
      branchId: retail.id,
      name: 'Anna Nagar Register 1',
      deviceIdentifier: 'AnnaNagarReg1-UUID-Placeholder'
    }
  });
  console.log('✅ POS Register seeded');

  // ── 4. Permissions (Full Sprint 1 Set) ────────────────────────────────
  const permissionsData = [
    // User management
    { name: 'users:read',         description: 'List and view system users' },
    { name: 'users:write',        description: 'Create and update system users' },
    { name: 'users:delete',       description: 'Soft-delete system users' },
    // Role management
    { name: 'roles:read',         description: 'List and view roles' },
    { name: 'roles:write',        description: 'Create and update roles' },
    { name: 'roles:delete',       description: 'Delete roles' },
    // Organization management
    { name: 'organizations:read',  description: 'View organizations' },
    { name: 'organizations:write', description: 'Create and update organizations' },
    // Branch management
    { name: 'branches:read',      description: 'View branches' },
    { name: 'branches:write',     description: 'Create and update branches' },
    // POS Registers
    { name: 'registers:read',     description: 'View POS registers' },
    { name: 'registers:write',    description: 'Create and update POS registers' },
    // Settings
    { name: 'settings:read',      description: 'Read system settings' },
    { name: 'settings:write',     description: 'Update system settings' },
    // Feature flags
    { name: 'flags:read',         description: 'View feature flags' },
    { name: 'flags:write',        description: 'Toggle feature flags' },
    // Audit
    { name: 'audit:read',         description: 'View audit logs' },
    // Master Data
    { name: 'masters:read',       description: 'View master data (taxes, UOM, categories, etc.)' },
    { name: 'masters:write',      description: 'Create and update master data' },
    { name: 'masters:delete',     description: 'Delete master data' },
    // Inventory (reserved for Sprint 3+)
    { name: 'inventory:read',     description: 'Read stock levels' },
    { name: 'inventory:write',    description: 'Create and update inventory' },
  ];

  const permissions: Record<string, any> = {};
  for (const item of permissionsData) {
    permissions[item.name] = await prisma.permission.upsert({
      where: { name: item.name },
      update: {},
      create: item
    });
  }
  console.log(`✅ ${Object.keys(permissions).length} Permissions seeded`);

  // ── 5. Roles ──────────────────────────────────────────────────────────
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: { name: 'SUPER_ADMIN', type: 'SUPER_ADMIN', description: 'System-wide super administrator' }
  });

  const ownerRole = await prisma.role.upsert({
    where: { name: 'OWNER' },
    update: {},
    create: { name: 'OWNER', type: 'SUPER_ADMIN', description: 'Business owner with full visibility' }
  });

  const branchManagerRole = await prisma.role.upsert({
    where: { name: 'BRANCH_MANAGER' },
    update: {},
    create: { name: 'BRANCH_MANAGER', type: 'BRANCH_MANAGER', description: 'Branch manager' }
  });

  const posOperatorRole = await prisma.role.upsert({
    where: { name: 'POS_OPERATOR' },
    update: {},
    create: { name: 'POS_OPERATOR', type: 'POS_OPERATOR', description: 'POS terminal operator' }
  });
  console.log('✅ Roles seeded');

  // ── 6. Role Permissions ───────────────────────────────────────────────
  const superAdminPermissions = Object.keys(permissions); // all
  const ownerPermissions = Object.keys(permissions); // all
  const branchManagerPermissions = [
    'users:read', 'roles:read', 'branches:read', 'registers:read',
    'settings:read', 'flags:read', 'audit:read', 'inventory:read'
  ];
  const posOperatorPermissions = ['inventory:read', 'registers:read'];

  const rolePermissionSets = [
    { role: superAdminRole, perms: superAdminPermissions },
    { role: ownerRole, perms: ownerPermissions },
    { role: branchManagerRole, perms: branchManagerPermissions },
    { role: posOperatorRole, perms: posOperatorPermissions },
  ];

  for (const { role, perms } of rolePermissionSets) {
    for (const permKey of perms) {
      if (!permissions[permKey]) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissions[permKey].id } },
        update: {},
        create: { roleId: role.id, permissionId: permissions[permKey].id }
      });
    }
  }
  console.log('✅ Role Permissions linked');

  // ── 7. Users ──────────────────────────────────────────────────────────
  // admin: password = adminpassword
  const adminHash = await bcrypt.hash('adminpassword', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      branchId: factory.id,
      username: 'admin',
      passwordHash: adminHash,
      fullName: 'System Administrator',
      email: 'admin@cakescandles.com'
    }
  });

  // owner: password = ownerpassword
  const ownerHash = await bcrypt.hash('ownerpassword', 10);
  const ownerUser = await prisma.user.upsert({
    where: { username: 'owner' },
    update: {},
    create: {
      branchId: factory.id,
      username: 'owner',
      passwordHash: ownerHash,
      fullName: 'Business Owner',
      email: 'owner@cakescandles.com'
    }
  });

  // manager: password = managerpassword
  const managerHash = await bcrypt.hash('managerpassword', 10);
  const managerUser = await prisma.user.upsert({
    where: { username: 'manager' },
    update: {},
    create: {
      branchId: retail.id,
      username: 'manager',
      passwordHash: managerHash,
      fullName: 'Anna Nagar Manager',
      email: 'manager@cakescandles.com'
    }
  });
  console.log('✅ Users seeded (admin, owner, manager)');

  // ── 8. User Roles ─────────────────────────────────────────────────────
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: superAdminRole.id }
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: ownerUser.id, roleId: ownerRole.id } },
    update: {},
    create: { userId: ownerUser.id, roleId: ownerRole.id }
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: managerUser.id, roleId: branchManagerRole.id } },
    update: {},
    create: { userId: managerUser.id, roleId: branchManagerRole.id }
  });
  console.log('✅ User Roles linked');

  // ── 9. System Settings ────────────────────────────────────────────────
  const settingsData = [
    { key: 'tax.gst_rate', value: '18', description: 'Standard GST rate in percentage' },
    { key: 'receipt.footer', value: 'Thank you for shopping with Cakes & Candles!', description: 'Receipt footer text' },
    { key: 'receipt.header', value: 'Cakes & Candles Co.', description: 'Receipt header text' },
    { key: 'currency.code', value: 'INR', description: 'Base currency' },
    { key: 'currency.symbol', value: '₹', description: 'Currency symbol' },
    { key: 'order.min_advance_days', value: '2', description: 'Minimum advance days for custom cake orders' },
  ];
  for (const s of settingsData) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log('✅ System Settings seeded');

  // ── 10. Feature Flags ─────────────────────────────────────────────────
  // Global flags (branchId = null)
  const globalFlags = [
    { key: 'LOYALTY_POINTS', isEnabled: false },
    { key: 'ONLINE_ORDERS', isEnabled: false },
    { key: 'MULTI_CURRENCY', isEnabled: false },
  ];
  for (const flag of globalFlags) {
    const existing = await prisma.featureFlag.findFirst({ where: { key: flag.key, branchId: null } });
    if (existing) {
      await prisma.featureFlag.update({ where: { id: existing.id }, data: { isEnabled: flag.isEnabled } });
    } else {
      await prisma.featureFlag.create({ data: { key: flag.key, isEnabled: flag.isEnabled, branchId: null } });
    }
  }

  // Branch flags
  const branchFlags = [
    { branchId: retail.id, key: 'CUSTOM_CAKE', isEnabled: true },
    { branchId: retail.id, key: 'WALK_IN_ORDERS', isEnabled: true },
  ];
  for (const flag of branchFlags) {
    const existing = await prisma.featureFlag.findFirst({ where: { key: flag.key, branchId: flag.branchId } });
    if (existing) {
      await prisma.featureFlag.update({ where: { id: existing.id }, data: { isEnabled: flag.isEnabled } });
    } else {
      await prisma.featureFlag.create({ data: flag });
    }
  }
  console.log('✅ Feature Flags seeded');

  // ── 11. Sprint 2 Master Data ──────────────────────────────────────────
  // Tax Rules with CGST + SGST components
  const gst5 = await prisma.taxRule.upsert({ where: { organizationId_name: { organizationId: org.id, name: 'GST 5%' } }, update: {}, create: { organizationId: org.id, name: 'GST 5%', rate: 5.0, hsn: '1905', effectiveFrom: new Date('2024-01-01') } });
  const gst12 = await prisma.taxRule.upsert({ where: { organizationId_name: { organizationId: org.id, name: 'GST 12%' } }, update: {}, create: { organizationId: org.id, name: 'GST 12%', rate: 12.0, hsn: '1905', effectiveFrom: new Date('2024-01-01') } });
  const gst18 = await prisma.taxRule.upsert({ where: { organizationId_name: { organizationId: org.id, name: 'GST 18%' } }, update: {}, create: { organizationId: org.id, name: 'GST 18%', rate: 18.0, isDefault: true, hsn: '2106', effectiveFrom: new Date('2024-01-01') } });
  const gst0 = await prisma.taxRule.upsert({ where: { organizationId_name: { organizationId: org.id, name: 'GST 0%' } }, update: {}, create: { organizationId: org.id, name: 'GST 0%', rate: 0.0, hsn: '0000' } });
  // Tax components (CGST + SGST split)
  for (const [rule, half] of [[gst5, 2.5], [gst12, 6.0], [gst18, 9.0]] as [any, number][]) {
    await prisma.taxComponent.upsert({ where: { taxRuleId_componentName: { taxRuleId: rule.id, componentName: 'CGST' } }, update: {}, create: { taxRuleId: rule.id, componentName: 'CGST', rate: half } });
    await prisma.taxComponent.upsert({ where: { taxRuleId_componentName: { taxRuleId: rule.id, componentName: 'SGST' } }, update: {}, create: { taxRuleId: rule.id, componentName: 'SGST', rate: half } });
  }
  console.log('✅ Tax Rules (GST 0/5/12/18%) + CGST/SGST Components seeded');

  // UOMs and Conversions
  const kgUom = await prisma.unitOfMeasure.upsert({ where: { organizationId_symbol: { organizationId: org.id, symbol: 'kg' } }, update: {}, create: { organizationId: org.id, name: 'Kilogram', symbol: 'kg', allowDecimal: true } });
  const gUom = await prisma.unitOfMeasure.upsert({ where: { organizationId_symbol: { organizationId: org.id, symbol: 'g' } }, update: {}, create: { organizationId: org.id, name: 'Gram', symbol: 'g', allowDecimal: false, baseUnitId: kgUom.id, conversionFactor: 0.001 } });
  const lUom = await prisma.unitOfMeasure.upsert({ where: { organizationId_symbol: { organizationId: org.id, symbol: 'L' } }, update: {}, create: { organizationId: org.id, name: 'Liter', symbol: 'L', allowDecimal: true } });
  const mlUom = await prisma.unitOfMeasure.upsert({ where: { organizationId_symbol: { organizationId: org.id, symbol: 'ml' } }, update: {}, create: { organizationId: org.id, name: 'Milliliter', symbol: 'ml', allowDecimal: false, baseUnitId: lUom.id, conversionFactor: 0.001 } });
  const pcsUom = await prisma.unitOfMeasure.upsert({ where: { organizationId_symbol: { organizationId: org.id, symbol: 'pcs' } }, update: {}, create: { organizationId: org.id, name: 'Pieces', symbol: 'pcs', allowDecimal: false } });
  await prisma.unitOfMeasure.upsert({ where: { organizationId_symbol: { organizationId: org.id, symbol: 'dz' } }, update: {}, create: { organizationId: org.id, name: 'Dozen', symbol: 'dz', allowDecimal: false, baseUnitId: pcsUom.id, conversionFactor: 12 } });
  await prisma.unitOfMeasure.upsert({ where: { organizationId_symbol: { organizationId: org.id, symbol: 'box' } }, update: {}, create: { organizationId: org.id, name: 'Box', symbol: 'box', allowDecimal: false } });
  console.log('✅ UOMs + Conversions seeded (kg/g, L/ml, pcs/dozen)');

  // Category Tree: Level 1 → Level 2
  const catCakes = await prisma.category.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Cakes' } },
    update: {},
    create: { organizationId: org.id, name: 'Cakes', description: 'All cake products', slug: 'cakes', icon: '🎂', color: '#FFB6C1', displayOrder: 1, showInPos: true, showInStore: true }
  });
  const catPastries = await prisma.category.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Pastries' } },
    update: {},
    create: { organizationId: org.id, name: 'Pastries', description: 'Pastries and bread items', slug: 'pastries', icon: '🥐', color: '#FFDEAD', displayOrder: 2, showInPos: true, showInStore: true }
  });
  const catBeverages = await prisma.category.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Beverages' } },
    update: {},
    create: { organizationId: org.id, name: 'Beverages', description: 'Drinks and beverages', slug: 'beverages', icon: '☕', color: '#87CEFA', displayOrder: 3, showInPos: true, showInStore: true }
  });
  const catRaw = await prisma.category.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Raw Materials' } },
    update: {},
    create: { organizationId: org.id, name: 'Raw Materials', description: 'Ingredients for production', slug: 'raw-materials', icon: '🌾', color: '#F5DEB3', displayOrder: 10, showInPos: false, showInStore: false }
  });
  // Sub-categories
  const subCatBirthday = await prisma.category.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Birthday Cakes' } },
    update: { parentId: catCakes.id },
    create: { organizationId: org.id, parentId: catCakes.id, name: 'Birthday Cakes', slug: 'birthday-cakes', displayOrder: 1, showInPos: true, showInStore: true }
  });
  await prisma.category.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Designer Cakes' } },
    update: { parentId: catCakes.id },
    create: { organizationId: org.id, parentId: catCakes.id, name: 'Designer Cakes', slug: 'designer-cakes', displayOrder: 2, showInPos: true, showInStore: true }
  });
  await prisma.category.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Eggless Cakes' } },
    update: { parentId: catCakes.id },
    create: { organizationId: org.id, parentId: catCakes.id, name: 'Eggless Cakes', slug: 'eggless-cakes', displayOrder: 3, showInPos: true, showInStore: true }
  });
  await prisma.category.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Croissants' } },
    update: { parentId: catPastries.id },
    create: { organizationId: org.id, parentId: catPastries.id, name: 'Croissants', slug: 'croissants', displayOrder: 1, showInPos: true, showInStore: true }
  });
  await prisma.category.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Coffee' } },
    update: { parentId: catBeverages.id },
    create: { organizationId: org.id, parentId: catBeverages.id, name: 'Coffee', slug: 'coffee', displayOrder: 1, showInPos: true, showInStore: true }
  });
  console.log('✅ Category tree seeded (3 roots + 5 sub-categories)');

  const brands = [
    { name: 'Cakes & Candles In-house', description: 'Our own products' },
    { name: 'Amul', description: 'Dairy products' },
    { name: 'Nestle', description: 'Chocolates and compounds' },
  ];
  for (const b of brands) {
    await prisma.brand.upsert({ where: { organizationId_name: { organizationId: org.id, name: b.name } }, update: {}, create: { ...b, organizationId: org.id } });
  }
  
  const suppliers = [
    { code: 'SUP001', name: 'Dairy Best Ltd', contactPerson: 'Ravi Kumar', phone: '9876543210', gst: '29ABCDE1234F1Z5', status: 'ACTIVE', preferredSupplier: true },
    { code: 'SUP002', name: 'PackWell Packaging', contactPerson: 'Sonia Sharma', phone: '9876543211', gst: '29ABCDE1234F1Z6', status: 'ACTIVE', preferredSupplier: false },
  ];
  for (const s of suppliers) {
    await prisma.supplier.upsert({ where: { organizationId_code: { organizationId: org.id, code: s.code } }, update: {}, create: { ...s, organizationId: org.id } });
  }

  // Storage Locations
  const locations = [
    { branchId: factory.id, name: 'Main Ingredients Warehouse', locationCode: 'F-MAIN-01', temperatureType: 'AMBIENT' },
    { branchId: factory.id, name: 'Cold Room 1', locationCode: 'F-COLD-01', temperatureType: 'REFRIGERATED' },
    { branchId: retail.id, name: 'Display Fridge', locationCode: 'R-FRDG-01', temperatureType: 'REFRIGERATED' },
    { branchId: retail.id, name: 'Backroom Shelf', locationCode: 'R-BACK-01', temperatureType: 'AMBIENT' },
  ];
  for (const l of locations) {
    await prisma.storageLocation.upsert({
      where: { branchId_name: { branchId: l.branchId, name: l.name } },
      update: {},
      create: l
    });
  }
  console.log('✅ Sprint 2 Master Data seeded (Taxes, UOMs, Categories, Brands, Suppliers, Storage)');

  // ── 12. Sprint 2.5 Advanced Masters ────────────────────────────────────
  await seedSprint2_5(prisma, org.id, factory.id, retail.id, superAdminRole.id);

  // ── 13. Sprint 3 Product Masters ───────────────────────────────────────
  await seedSprint3(prisma, org.id, factory.id);

  // ── 14. Sprint 11 HR & Payroll Master Data ─────────────────────────────
  await seedSprint11(prisma, org.id, factory.id, retail.id);

  console.log('\n🎉 Seeding completed successfully!\n');
  console.log('Credentials:');
  console.log('  admin / adminpassword → SUPER_ADMIN');
  console.log('  owner / ownerpassword → OWNER');
  console.log('  manager / managerpassword → BRANCH_MANAGER');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
