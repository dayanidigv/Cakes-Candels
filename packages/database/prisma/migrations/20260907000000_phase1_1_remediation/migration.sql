-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'EXPIRE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('STOREFRONT', 'POS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('PICKUP', 'DELIVERY', 'DINE_IN');

-- CreateEnum
CREATE TYPE "PosShiftStatus" AS ENUM ('OPEN', 'ACTIVE', 'CLOSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "CustomCakeStatus" AS ENUM ('DRAFT', 'QUOTED', 'ADVANCE_PENDING', 'CONFIRMED', 'SCHEDULED', 'IN_PRODUCTION', 'BAKING', 'ICING', 'DECORATION', 'QC', 'READY', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'QC_FAILED');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('PACKED', 'DISPATCHED', 'ON_THE_WAY', 'REACHED_BRANCH', 'RECEIVED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "SalesOrderStatus_new" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'READY', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'PAYMENT_FAILED', 'RETURNED', 'REFUNDED');
ALTER TABLE "public"."sales_order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "sales_order" ALTER COLUMN "status" TYPE "SalesOrderStatus_new" USING ("status"::text::"SalesOrderStatus_new");
ALTER TYPE "SalesOrderStatus" RENAME TO "SalesOrderStatus_old";
ALTER TYPE "SalesOrderStatus_new" RENAME TO "SalesOrderStatus";
DROP TYPE "public"."SalesOrderStatus_old";
ALTER TABLE "sales_order" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "Designation" ALTER COLUMN "title" DROP NOT NULL;

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "attendance_correction_request" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "attendance_log" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "custom_cake_order" DROP COLUMN "designUrl",
ADD COLUMN     "advanceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "balanceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "decorationNotes" TEXT,
ADD COLUMN     "designImages" JSONB,
ADD COLUMN     "filling" TEXT,
ADD COLUMN     "icing" TEXT,
ADD COLUMN     "layers" INTEGER DEFAULT 1,
ADD COLUMN     "messageOnCake" TEXT,
ADD COLUMN     "qcApprovedAt" TIMESTAMP(3),
ADD COLUMN     "qcApprovedBy" UUID,
ADD COLUMN     "qcNotes" TEXT,
ADD COLUMN     "quoteAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "readyPhotoUrl" TEXT,
ADD COLUMN     "shape" TEXT DEFAULT 'ROUND',
ADD COLUMN     "status" "CustomCakeStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "deliveryOrPickup" SET DEFAULT 'DELIVERY';

-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "assignedBranchId" UUID,
ADD COLUMN     "assignedStaffId" UUID,
ADD COLUMN     "customerType" TEXT NOT NULL DEFAULT 'RETAIL',
ADD COLUMN     "healthScore" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "healthStatus" TEXT NOT NULL DEFAULT 'HEALTHY',
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "lastOrderAt" TIMESTAMP(3),
ADD COLUMN     "lifetimeValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "organizationId" UUID,
ADD COLUMN     "rfmFrequency" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "rfmMonetary" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "rfmRecency" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "rfmSegment" TEXT NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "department" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "employee" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "employee_leave_balance" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "employee_shift" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fiscal_period" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fiscal_year" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "journal_entry" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "journal_entry_line" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leave_policy" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leave_request" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leave_transaction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leave_type" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "loyalty_transaction" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedBy" UUID,
DROP COLUMN "type",
ADD COLUMN     "type" "LoyaltyTransactionType" NOT NULL;

-- AlterTable
ALTER TABLE "payroll_detail" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payroll_item" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payroll_period" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payroll_run" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payslip" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "production_order" ADD COLUMN     "customCakeOrderId" UUID;

-- AlterTable
ALTER TABLE "salary_component" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "salary_structure" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sales_order" ADD COLUMN     "channel" "SalesChannel" NOT NULL DEFAULT 'STOREFRONT',
ADD COLUMN     "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'PICKUP',
ADD COLUMN     "organizationId" UUID NOT NULL,
ADD COLUMN     "posShiftId" UUID;

-- AlterTable
ALTER TABLE "shift_master" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "crm_activity" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "activityType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "outcome" TEXT,
    "performedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_segment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "rulesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_segment_mapping" (
    "customerId" UUID NOT NULL,
    "segmentId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_segment_mapping_pkey" PRIMARY KEY ("customerId","segmentId")
);

-- CreateTable
CREATE TABLE "crm_automation" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "conditionsJson" JSONB,
    "actionType" TEXT NOT NULL,
    "actionConfig" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_automation_run" (
    "id" UUID NOT NULL,
    "automationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "executionLog" JSONB,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_automation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_shift" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "cashierId" UUID NOT NULL,
    "status" "PosShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openingCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(12,2),
    "actualCash" DECIMAL(12,2),
    "variance" DECIMAL(12,2),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "approvedBy" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_shift_cash_movement" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_shift_cash_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_offline_sync_record" (
    "id" UUID NOT NULL,
    "offlineTransactionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "branchId" UUID NOT NULL,
    "salesOrderId" UUID,
    "payload" JSONB NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_offline_sync_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intent" (
    "id" UUID NOT NULL,
    "salesOrderId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gateway" TEXT NOT NULL,
    "clientSecret" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "dispatchNumber" TEXT NOT NULL,
    "vehicleId" UUID,
    "driverUserId" UUID,
    "fromBranchId" UUID NOT NULL,
    "toBranchId" UUID NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'PACKED',
    "notes" TEXT,
    "expectedDeliveryAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_item" (
    "id" UUID NOT NULL,
    "dispatchId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantityDispatched" DECIMAL(12,4) NOT NULL,
    "quantityReceived" DECIMAL(12,4),
    "batchId" UUID,
    "damageNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_activity_customerId_idx" ON "crm_activity"("customerId");

-- CreateIndex
CREATE INDEX "crm_activity_activityType_idx" ON "crm_activity"("activityType");

-- CreateIndex
CREATE UNIQUE INDEX "crm_segment_name_key" ON "crm_segment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "crm_segment_code_key" ON "crm_segment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "crm_automation_run_idempotencyKey_key" ON "crm_automation_run"("idempotencyKey");

-- CreateIndex
CREATE INDEX "crm_automation_run_automationId_customerId_idx" ON "crm_automation_run"("automationId", "customerId");

-- CreateIndex
CREATE INDEX "pos_shift_branchId_cashierId_idx" ON "pos_shift"("branchId", "cashierId");

-- CreateIndex
CREATE INDEX "pos_shift_status_idx" ON "pos_shift"("status");

-- CreateIndex
CREATE INDEX "pos_shift_cash_movement_shiftId_idx" ON "pos_shift_cash_movement"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_offline_sync_record_offlineTransactionId_key" ON "pos_offline_sync_record"("offlineTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_offline_sync_record_idempotencyKey_key" ON "pos_offline_sync_record"("idempotencyKey");

-- CreateIndex
CREATE INDEX "pos_offline_sync_record_branchId_deviceId_idx" ON "pos_offline_sync_record"("branchId", "deviceId");

-- CreateIndex
CREATE INDEX "pos_offline_sync_record_syncStatus_idx" ON "pos_offline_sync_record"("syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_dispatchNumber_key" ON "dispatch"("dispatchNumber");

-- CreateIndex
CREATE INDEX "dispatch_organizationId_idx" ON "dispatch"("organizationId");

-- CreateIndex
CREATE INDEX "dispatch_status_idx" ON "dispatch"("status");

-- CreateIndex
CREATE INDEX "dispatch_fromBranchId_idx" ON "dispatch"("fromBranchId");

-- CreateIndex
CREATE INDEX "dispatch_toBranchId_idx" ON "dispatch"("toBranchId");

-- CreateIndex
CREATE INDEX "custom_cake_order_status_idx" ON "custom_cake_order"("status");

-- CreateIndex
CREATE INDEX "customer_organizationId_idx" ON "customer"("organizationId");

-- CreateIndex
CREATE INDEX "customer_assignedBranchId_idx" ON "customer"("assignedBranchId");

-- CreateIndex
CREATE INDEX "customer_healthStatus_idx" ON "customer"("healthStatus");

-- CreateIndex
CREATE INDEX "customer_rfmSegment_idx" ON "customer"("rfmSegment");

-- CreateIndex
CREATE INDEX "loyalty_transaction_customerId_idx" ON "loyalty_transaction"("customerId");

-- CreateIndex
CREATE INDEX "loyalty_transaction_type_idx" ON "loyalty_transaction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_transaction_orderId_type_key" ON "loyalty_transaction"("orderId", "type");

-- CreateIndex
CREATE INDEX "sales_order_organizationId_idx" ON "sales_order"("organizationId");

-- CreateIndex
CREATE INDEX "sales_order_posShiftId_idx" ON "sales_order"("posShiftId");

-- AddForeignKey
ALTER TABLE "production_order" ADD CONSTRAINT "production_order_customCakeOrderId_fkey" FOREIGN KEY ("customCakeOrderId") REFERENCES "custom_cake_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_assignedBranchId_fkey" FOREIGN KEY ("assignedBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activity" ADD CONSTRAINT "crm_activity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_mapping" ADD CONSTRAINT "customer_segment_mapping_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_segment_mapping" ADD CONSTRAINT "customer_segment_mapping_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "crm_segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_automation_run" ADD CONSTRAINT "crm_automation_run_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "crm_automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_automation_run" ADD CONSTRAINT "crm_automation_run_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_posShiftId_fkey" FOREIGN KEY ("posShiftId") REFERENCES "pos_shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shift" ADD CONSTRAINT "pos_shift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shift_cash_movement" ADD CONSTRAINT "pos_shift_cash_movement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "pos_shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_offline_sync_record" ADD CONSTRAINT "pos_offline_sync_record_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intent" ADD CONSTRAINT "payment_intent_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_item" ADD CONSTRAINT "dispatch_item_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_item" ADD CONSTRAINT "dispatch_item_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "org_source_event_unique" RENAME TO "journal_entry_organizationId_sourceModule_sourceEntityType__key";

