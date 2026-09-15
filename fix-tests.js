const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      walk(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  });
}

walk('apps/api/src', file => {
  if (!file.endsWith('.ts')) return;
  
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Fix createOrder calls in specs
  if (file.includes('.spec.ts') || file.includes('custom-cakes.service.ts')) {
    if (content.match(/ordersService\.createOrder\([^,]+, \{/)) {
      content = content.replace(/ordersService\.createOrder\(([^,]+), \{/g, 'ordersService.createOrder($1, "org-id", {');
      changed = true;
    }
  }

  // Fix SalesOrder mocks
  if (file.includes('.spec.ts') || file.includes('custom-cakes.service.ts')) {
    if (content.match(/orderNumber:[^,]+,[\s]*customerId:[^,]+,[\s]*branchId:/)) {
      content = content.replace(/(orderNumber:[^,]+,[\s]*customerId:[^,]+,[\s]*branchId:[^,]+,)/g, '$1 organizationId: "org-id",');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
