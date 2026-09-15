-- CreateEnum
CREATE TYPE "public"."JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateTable
CREATE TABLE "public"."journal_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "postingDate" DATE NOT NULL,
    "documentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceModule" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" UUID NOT NULL,
    "sourceReference" TEXT,
    "referenceNumber" TEXT,
    "status" "public"."JournalEntryStatus" NOT NULL DEFAULT 'POSTED',
    "description" TEXT NOT NULL,
    "totalDebit" DECIMAL(14,2) NOT NULL,
    "totalCredit" DECIMAL(14,2) NOT NULL,
    "reversalEntryId" UUID,
    "createdById" UUID NOT NULL,
    "postedById" UUID,
    "postedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."journal_entry_line" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journalEntryId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "branchId" UUID,
    "debitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "journal_entry_organizationId_entryNumber_key" ON "public"."journal_entry"("organizationId", "entryNumber");
CREATE UNIQUE INDEX "journal_entry_reversalEntryId_key" ON "public"."journal_entry"("reversalEntryId");
CREATE UNIQUE INDEX "org_source_event_unique" ON "public"."journal_entry"("organizationId", "sourceModule", "sourceEntityType", "sourceEntityId", "sourceReference");
CREATE INDEX "journal_entry_organizationId_postingDate_idx" ON "public"."journal_entry"("organizationId", "postingDate");
CREATE INDEX "journal_entry_organizationId_status_idx" ON "public"."journal_entry"("organizationId", "status");
CREATE INDEX "journal_entry_sourceModule_sourceEntityId_idx" ON "public"."journal_entry"("sourceModule", "sourceEntityId");

CREATE INDEX "journal_entry_line_journalEntryId_idx" ON "public"."journal_entry_line"("journalEntryId");
CREATE INDEX "journal_entry_line_accountId_idx" ON "public"."journal_entry_line"("accountId");
CREATE INDEX "journal_entry_line_branchId_idx" ON "public"."journal_entry_line"("branchId");

-- AddForeignKeys
ALTER TABLE "public"."journal_entry" ADD CONSTRAINT "journal_entry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."journal_entry" ADD CONSTRAINT "journal_entry_reversalEntryId_fkey" FOREIGN KEY ("reversalEntryId") REFERENCES "public"."journal_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."journal_entry_line" ADD CONSTRAINT "journal_entry_line_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "public"."journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."journal_entry_line" ADD CONSTRAINT "journal_entry_line_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."journal_entry_line" ADD CONSTRAINT "journal_entry_line_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
