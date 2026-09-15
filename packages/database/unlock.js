const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.user.updateMany({
    where: { username: 'admin' },
    data: { failedLoginAttempts: 0, lockedUntil: null, status: 'ACTIVE' }
  });
  console.log("Unlocked admin");
}
run().catch(console.error).finally(() => prisma.$disconnect());
