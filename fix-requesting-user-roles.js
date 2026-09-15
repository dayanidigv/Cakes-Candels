const fs = require('fs');

const files = [
  'apps/api/src/modules/finance/services/posting-engine.service.ts',
  'apps/api/src/modules/hr/services/employee.service.ts',
  'apps/api/src/modules/finance/services/fiscal-calendar.service.ts',
  'apps/api/src/modules/finance/services/account.service.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/role\?:\s*string;/, 'role?: string;\n  roles?: string[];');
  fs.writeFileSync(file, content, 'utf-8');
}
console.log('Fixed RequestingUser roles properties in 4 files');
