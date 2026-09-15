const fs = require('fs');

const fixFile = (file) => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\$\{organizationId\}/g, '${organizationId}::uuid');
  content = content.replace(/\$\{createOrderDto\.branchId\}/g, '${createOrderDto.branchId}::uuid');
  content = content.replace(/\$\{ns\.id\}/g, '${ns.id}::uuid');
  fs.writeFileSync(file, content);
  console.log('Fixed', file);
};

fixFile('apps/api/src/modules/production/production.service.ts');
fixFile('apps/api/src/modules/sales/billing/billing.service.ts');
fixFile('apps/api/src/modules/sales/orders/orders.service.ts');
