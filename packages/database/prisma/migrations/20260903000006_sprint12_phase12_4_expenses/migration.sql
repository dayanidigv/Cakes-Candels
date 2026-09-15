-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpensePaymentType" AS ENUM ('CASH', 'PETTY_CASH', 'BANK_TRANSFER', 'UPI', 'CREDIT_CARD', 'PAYABLE_VENDOR');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('NONE', 'GST_5', 'GST_12', 'GST_18', 'GST_28');

-- CreateTable
CREATE TABLE "expense" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "branchId" UUID NOT NULL,
    "expenseAccountId" UUID NOT NULL,
    "paymentAccountId" UUID NOT NULL,
    "vendorId" UUID,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentType" "ExpensePaymentType" NOT NULL,
    "expenseDate" DATE NOT NULL,
    "dueDate" DATE,
    "invoiceNumber" TEXT,
    "baseAmount" DECIMAL(14,2) NOT NULL,
    "taxType" "TaxType" NOT NULL DEFAULT 'NONE',
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "idempotencyKey" TEXT,
    "journalEntryId" UUID,
    "submittedById" UUID,
    "submittedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_category_mapping" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "defaultExpenseAccountId" UUID,
    "defaultTaxType" "TaxType" NOT NULL DEFAULT 'NONE',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvalThreshold" DECIMAL(14,2) NOT NULL DEFAULT 1000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_category_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_idempotencyKey_key" ON "expense"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "expense_journalEntryId_key" ON "expense"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_organizationId_expenseNumber_key" ON "expense"("organizationId", "expenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "expense_organizationId_vendorId_invoiceNumber_key" ON "expense"("organizationId", "vendorId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "expense_organizationId_expenseDate_idx" ON "expense"("organizationId", "expenseDate");

-- CreateIndex
CREATE INDEX "expense_organizationId_status_idx" ON "expense"("organizationId", "status");

-- CreateIndex
CREATE INDEX "expense_branchId_idx" ON "expense"("branchId");

-- CreateIndex
CREATE INDEX "expense_expenseAccountId_idx" ON "expense"("expenseAccountId");

-- CreateIndex
CREATE INDEX "expense_paymentAccountId_idx" ON "expense"("paymentAccountId");

-- CreateIndex
CREATE INDEX "expense_journalEntryId_idx" ON "expense"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_category_mapping_organizationId_code_key" ON "expense_category_mapping"("organizationId", "code");

-- CreateIndex
CREATE INDEX "expense_category_mapping_organizationId_idx" ON "expense_category_mapping"("organizationId");

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_category_mapping" ADD CONSTRAINT "expense_category_mapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_category_mapping" ADD CONSTRAINT "expense_category_mapping_defaultExpenseAccountId_fkey" FOREIGN KEY ("defaultExpenseAccountId") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
