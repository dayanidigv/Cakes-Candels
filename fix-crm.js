const fs = require('fs');
const file = 'apps/api/src/modules/sales/crm/crm-phase2-e2e-certification.spec.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/organizationId: "org-id"/g, "organizationId: orgAId");
fs.writeFileSync(file, content);
console.log('Fixed crm-phase2-e2e-certification.spec.ts');
