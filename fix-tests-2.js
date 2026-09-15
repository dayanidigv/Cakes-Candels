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
  if (!file.endsWith('.spec.ts')) return;
  
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Fix branch mocks
  if (content.match(/\{ id: 'b1' \}/)) {
    content = content.replace(/\{ id: 'b1' \}/g, "{ id: 'b1', organizationId: 'org-id' }");
    changed = true;
  }
  if (content.match(/branch: \{\s*findUnique:.*?\}/)) {
      content = content.replace(/branch:\s*\{\s*findUnique:\s*jest\.fn\(\)\.mockResolvedValue\(\{\s*id:\s*'b1'/g, "branch: { findUnique: jest.fn().mockResolvedValue({ id: 'b1', organizationId: 'org-id'");
      changed = true;
  }

  // Fix variant isActive mock
  if (content.match(/isActive:\s*false/)) {
      // do nothing if specifically testing inactive
  } else if (content.match(/mockResolvedValue\(\{ id: 'v1'/)) {
      content = content.replace(/mockResolvedValue\(\{ id: 'v1'/g, "mockResolvedValue({ id: 'v1', isActive: true");
      changed = true;
  }
  
  if (content.match(/return \{ id: 'v1'/)) {
      content = content.replace(/return \{ id: 'v1'/g, "return { id: 'v1', isActive: true");
      changed = true;
  }

  // Add missing mocks in txMock
  if (content.includes('const txMock = {')) {
    if (!content.includes('productVariant:')) {
      content = content.replace(/const txMock = \{/g, "const txMock = { productVariant: { findUnique: jest.fn().mockResolvedValue({ id: 'v1', isActive: true }) }, recipeVersion: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', ingredients: [{ variantId: 'v1', quantity: 1 }] }) }, numberSeries: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', currentNumber: 1 }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, $queryRaw: jest.fn().mockResolvedValue([{ id: 'n1', currentNumber: 1 }]), $executeRaw: jest.fn().mockResolvedValue(1), ");
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
