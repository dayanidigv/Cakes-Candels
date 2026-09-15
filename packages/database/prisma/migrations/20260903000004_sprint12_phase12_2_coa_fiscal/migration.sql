-- CreateEnum
CREATE TYPE "public"."AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "public"."AccountCategory" AS ENUM (
  'CASH_AND_EQUIVALENTS', 'BANK', 'ACCOUNTS_RECEIVABLE', 'INVENTORY_RAW_MATERIALS', 'INVENTORY_WIP',
  'INVENTORY_FINISHED_GOODS', 'FIXED_ASSETS', 'ACCUMULATED_DEPRECIATION', 'OTHER_CURRENT_ASSETS',
  'ACCOUNTS_PAYABLE', 'GRN_CLEARING', 'PAYROLL_PAYABLE', 'STATUTORY_PAYABLE', 'TAX_PAYABLE',
  'SHORT_TERM_LOANS', 'OTHER_CURRENT_LIABILITIES', 'OWNERS_EQUITY', 'RETAINED_EARNINGS',
  'CURRENT_YEAR_EARNINGS', 'SALES_REVENUE_RETAIL', 'SALES_REVENUE_CUSTOM', 'SALES_RETURNS_ALLOWANCES',
  'OTHER_INCOME', 'COST_OF_GOODS_SOLD', 'SALARY_AND_WAGES', 'OPERATING_EXPENSE_RENT',
  'OPERATING_EXPENSE_UTILITIES', 'OPERATING_EXPENSE_MAINTENANCE', 'OPERATING_EXPENSE_LOGISTICS',
  'INVENTORY_WASTAGE', 'DEPRECIATION_EXPENSE', 'FINANCE_CHARGES', 'MISCELLANEOUS_EXPENSE'
);

-- CreateEnum
CREATE TYPE "public"."BalanceType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "public"."FiscalPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateTable
CREATE TABLE "public"."account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."AccountType" NOT NULL,
    "category" "public"."AccountCategory" NOT NULL,
    "normalBalance" "public"."BalanceType" NOT NULL,
    "parentId" UUID,
    "isPostable" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" UUID,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fiscal_year" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_year_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fiscal_period" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fiscalYearId" UUID NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "public"."FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_period_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "account_organizationId_code_key" ON "public"."account"("organizationId", "code");
CREATE INDEX "account_organizationId_type_idx" ON "public"."account"("organizationId", "type");
CREATE INDEX "account_organizationId_category_idx" ON "public"."account"("organizationId", "category");
CREATE INDEX "account_parentId_idx" ON "public"."account"("parentId");

CREATE UNIQUE INDEX "fiscal_year_organizationId_name_key" ON "public"."fiscal_year"("organizationId", "name");
CREATE INDEX "fiscal_year_organizationId_idx" ON "public"."fiscal_year"("organizationId");

CREATE UNIQUE INDEX "fiscal_period_fiscalYearId_periodNumber_key" ON "public"."fiscal_period"("fiscalYearId", "periodNumber");
CREATE INDEX "fiscal_period_fiscalYearId_idx" ON "public"."fiscal_period"("fiscalYearId");
CREATE INDEX "fiscal_period_status_idx" ON "public"."fiscal_period"("status");

-- AddForeignKeys
ALTER TABLE "public"."account" ADD CONSTRAINT "account_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."account" ADD CONSTRAINT "account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."fiscal_year" ADD CONSTRAINT "fiscal_year_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."fiscal_period" ADD CONSTRAINT "fiscal_period_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "public"."fiscal_year"("id") ON DELETE CASCADE ON UPDATE CASCADE;
