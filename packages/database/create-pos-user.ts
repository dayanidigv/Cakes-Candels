import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const retail = await prisma.branch.findUnique({ where: { name: 'Anna Nagar Retail Branch' } });
  if (!retail) {
    throw new Error('Retail branch not found');
  }

  const posRole = await prisma.role.findUnique({ where: { name: 'POS_OPERATOR' } });
  if (!posRole) {
    throw new Error('POS_OPERATOR role not found');
  }

  const posHash = await bcrypt.hash('pospassword', 10);
  
  const posUser = await prisma.user.upsert({
    where: { username: 'pos' },
    update: {},
    create: {
      branchId: retail.id,
      username: 'pos',
      passwordHash: posHash,
      fullName: 'POS Operator 1',
      email: 'pos1@cakescandles.com'
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: posUser.id, roleId: posRole.id } },
    update: {},
    create: { userId: posUser.id, roleId: posRole.id }
  });

  console.log('✅ POS user created: pos / pospassword');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
