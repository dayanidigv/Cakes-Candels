const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const branch = await prisma.branch.findFirst();
  console.log("BRANCH_ID=", branch?.id);
}
run();
