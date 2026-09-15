import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.updateMany({
    data: {
      lockedUntil: null,
      failedLoginAttempts: 0,
    },
  });
  console.log('Unlocked all accounts.');
  
  const users = await prisma.user.findMany({ select: { username: true }});
  console.log('Users:', users.map(u => u.username));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
