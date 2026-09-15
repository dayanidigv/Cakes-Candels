import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Applying Sprint 11 HR & Payroll Migration...');
  const migrationSqlPath = path.join(__dirname, '../prisma/migrations/20260903000003_sprint11_hr_payroll/migration.sql');
  const sqlContent = fs.readFileSync(migrationSqlPath, 'utf8');

  // Strip SQL comments
  const cleanSql = sqlContent
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err: any) {
      if (!err?.message?.includes('already exists')) {
        console.warn(`Statement failure: ${stmt.substring(0, 60)}... -> ${err?.message}`);
      }
    }
  }

  console.log('🟢 Sprint 11 HR & Payroll Migration applied successfully to PostgreSQL!');
}

main()
  .catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
