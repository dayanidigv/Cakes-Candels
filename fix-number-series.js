const fs = require('fs');
const files = [
  'apps/api/src/modules/production/production.service.ts',
  'apps/api/src/modules/sales/billing/billing.service.ts',
  'apps/api/src/modules/sales/orders/orders.service.ts'
];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/"number_series"/g, '"NumberSeries"');
  fs.writeFileSync(f, content);
  console.log('Fixed', f);
});
