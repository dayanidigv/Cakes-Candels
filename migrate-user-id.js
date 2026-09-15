const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      walk(path.join(dir, file), fileList);
    } else if (file.endsWith('.ts')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const apiSrc = path.join(__dirname, 'apps/api/src');
const files = walk(apiSrc);

let filesModified = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;

  // Change user.id to user.userId
  if (content.includes('user.id')) {
    content = content.replace(/user\.id/g, 'user.userId');
    changed = true;
  }
  if (content.includes('user?.id')) {
    content = content.replace(/user\?\.id/g, 'user?.userId');
    changed = true;
  }
  
  // Change user.sub to user.userId
  if (content.includes('user.sub')) {
    content = content.replace(/user\.sub/g, 'user.userId');
    changed = true;
  }
  if (content.includes('user?.sub')) {
    content = content.replace(/user\?\.sub/g, 'user?.userId');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf-8');
    filesModified++;
  }
}

console.log(`Cleaned up user.id / user.sub in ${filesModified} files.`);
