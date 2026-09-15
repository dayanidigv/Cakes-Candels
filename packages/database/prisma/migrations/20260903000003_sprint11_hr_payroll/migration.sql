-- CreateEnums for Sprint 11 HR & Payroll
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');
CREATE TYPE "EmploymentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED');
CREATE TYPE "AttendanceStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'CHECKED_OUT', 'FINALIZED');
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATING', 'CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'PAID', 'CLOSED');
CREATE TYPE "PayslipStatus" AS ENUM ('GENERATED', 'APPROVED', 'ISSUED');

-- AlterTable Designation
ALTER TABLE "Designation" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Designation" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Designation" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "Designation" ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1;

-- CreateTable department
CREATE TABLE "department" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "managerId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" UUID,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable employee
CREATE TABLE "employee" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "assignedBranchId" UUID NOT NULL,
    "departmentId" UUID,
    "designationId" UUID,
    "userId" UUID,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "dateOfJoining" TIMESTAMP(3) NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "status" "EmploymentStatus" NOT NULL DEFAULT 'DRAFT',
    "bankAccountNo" TEXT,
    "bankIfscCode" TEXT,
    "panNumber" TEXT,
    "pfAccountNo" TEXT,
    "esiNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" UUID,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable shift_master
CREATE TABLE "shift_master" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 15,
    "breakDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable employee_shift
CREATE TABLE "employee_shift" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "shiftMasterId" UUID NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable attendance_log
CREATE TABLE "attendance_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "workDate" DATE NOT NULL,
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "hoursWorked" DECIMAL(5,2),
    "overtimeHours" DECIMAL(5,2) DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "source" TEXT NOT NULL DEFAULT 'POS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable attendance_correction_request
CREATE TABLE "attendance_correction_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "workDate" DATE NOT NULL,
    "requestedIn" TIMESTAMP(3),
    "requestedOut" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_correction_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable leave_type
CREATE TABLE "leave_type" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "annualDays" INTEGER NOT NULL,
    "isCarryForward" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable leave_policy
CREATE TABLE "leave_policy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "maxContinuousDays" INTEGER NOT NULL DEFAULT 14,
    "noticeDaysRequired" INTEGER NOT NULL DEFAULT 1,
    "encashable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable employee_leave_balance
CREATE TABLE "employee_leave_balance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "allocated" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL,

    CONSTRAINT "employee_leave_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable leave_request
CREATE TABLE "leave_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable leave_transaction
CREATE TABLE "leave_transaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "leaveTypeId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable salary_component
CREATE TABLE "salary_component" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable salary_structure
CREATE TABLE "salary_structure" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conveyance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "specialAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pfContribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "esiContribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable payroll_period
CREATE TABLE "payroll_period" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable payroll_run
CREATE TABLE "payroll_run" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "payrollPeriodId" UUID NOT NULL,
    "runNumber" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "totalGrossPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNetPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "financeExpenseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable payroll_item
CREATE TABLE "payroll_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payrollRunId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "presentDays" INTEGER NOT NULL,
    "lossOfPayDays" INTEGER NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "basePay" DECIMAL(12,2) NOT NULL,
    "allowances" DECIMAL(12,2) NOT NULL,
    "grossPay" DECIMAL(12,2) NOT NULL,
    "pfDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "esiDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable payroll_detail
CREATE TABLE "payroll_detail" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payrollItemId" UUID NOT NULL,
    "componentCode" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payroll_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable payslip
CREATE TABLE "payslip" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payrollItemId" UUID NOT NULL,
    "payslipNumber" TEXT NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'GENERATED',
    "pdfHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslip_pkey" PRIMARY KEY ("id")
);

-- Unique constraints & indexes
CREATE UNIQUE INDEX IF NOT EXISTS "department_organizationId_code_key" ON "department"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "department_organizationId_idx" ON "department"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "employee_userId_key" ON "employee"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "employee_organizationId_employeeCode_key" ON "employee"("organizationId", "employeeCode");
CREATE INDEX IF NOT EXISTS "employee_organizationId_idx" ON "employee"("organizationId");
CREATE INDEX IF NOT EXISTS "employee_assignedBranchId_idx" ON "employee"("assignedBranchId");
CREATE INDEX IF NOT EXISTS "employee_status_idx" ON "employee"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "shift_master_organizationId_code_key" ON "shift_master"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "shift_master_organizationId_idx" ON "shift_master"("organizationId");

CREATE INDEX IF NOT EXISTS "employee_shift_employeeId_idx" ON "employee_shift"("employeeId");

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_log_employeeId_workDate_key" ON "attendance_log"("employeeId", "workDate");
CREATE INDEX IF NOT EXISTS "attendance_log_organizationId_idx" ON "attendance_log"("organizationId");
CREATE INDEX IF NOT EXISTS "attendance_log_branchId_idx" ON "attendance_log"("branchId");
CREATE INDEX IF NOT EXISTS "attendance_log_workDate_idx" ON "attendance_log"("workDate");

CREATE INDEX IF NOT EXISTS "attendance_correction_request_employeeId_idx" ON "attendance_correction_request"("employeeId");
CREATE INDEX IF NOT EXISTS "attendance_correction_request_status_idx" ON "attendance_correction_request"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "leave_type_organizationId_code_key" ON "leave_type"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "leave_type_organizationId_idx" ON "leave_type"("organizationId");

CREATE INDEX IF NOT EXISTS "leave_policy_organizationId_idx" ON "leave_policy"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "employee_leave_balance_employeeId_leaveTypeId_year_key" ON "employee_leave_balance"("employeeId", "leaveTypeId", "year");
CREATE INDEX IF NOT EXISTS "employee_leave_balance_employeeId_idx" ON "employee_leave_balance"("employeeId");

CREATE INDEX IF NOT EXISTS "leave_request_organizationId_idx" ON "leave_request"("organizationId");
CREATE INDEX IF NOT EXISTS "leave_request_employeeId_idx" ON "leave_request"("employeeId");
CREATE INDEX IF NOT EXISTS "leave_request_status_idx" ON "leave_request"("status");

CREATE INDEX IF NOT EXISTS "leave_transaction_employeeId_idx" ON "leave_transaction"("employeeId");

CREATE UNIQUE INDEX IF NOT EXISTS "salary_component_organizationId_code_key" ON "salary_component"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "salary_component_organizationId_idx" ON "salary_component"("organizationId");

CREATE INDEX IF NOT EXISTS "salary_structure_employeeId_idx" ON "salary_structure"("employeeId");

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_period_organizationId_year_month_key" ON "payroll_period"("organizationId", "year", "month");
CREATE INDEX IF NOT EXISTS "payroll_period_organizationId_idx" ON "payroll_period"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_run_idempotencyKey_key" ON "payroll_run"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_run_organizationId_runNumber_key" ON "payroll_run"("organizationId", "runNumber");
CREATE INDEX IF NOT EXISTS "payroll_run_organizationId_idx" ON "payroll_run"("organizationId");
CREATE INDEX IF NOT EXISTS "payroll_run_status_idx" ON "payroll_run"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_item_payrollRunId_employeeId_key" ON "payroll_item"("payrollRunId", "employeeId");
CREATE INDEX IF NOT EXISTS "payroll_item_payrollRunId_idx" ON "payroll_item"("payrollRunId");
CREATE INDEX IF NOT EXISTS "payroll_item_employeeId_idx" ON "payroll_item"("employeeId");

CREATE INDEX IF NOT EXISTS "payroll_detail_payrollItemId_idx" ON "payroll_detail"("payrollItemId");

CREATE UNIQUE INDEX IF NOT EXISTS "payslip_payrollItemId_key" ON "payslip"("payrollItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "payslip_payslipNumber_key" ON "payslip"("payslipNumber");

-- Foreign Keys
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "department" ADD CONSTRAINT "department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee" ADD CONSTRAINT "employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee" ADD CONSTRAINT "employee_assignedBranchId_fkey" FOREIGN KEY ("assignedBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee" ADD CONSTRAINT "employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee" ADD CONSTRAINT "employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee" ADD CONSTRAINT "employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_shift" ADD CONSTRAINT "employee_shift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_shift" ADD CONSTRAINT "employee_shift_shiftMasterId_fkey" FOREIGN KEY ("shiftMasterId") REFERENCES "shift_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_log" ADD CONSTRAINT "attendance_log_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_correction_request" ADD CONSTRAINT "attendance_correction_request_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_policy" ADD CONSTRAINT "leave_policy_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_leave_balance" ADD CONSTRAINT "employee_leave_balance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_leave_balance" ADD CONSTRAINT "employee_leave_balance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_transaction" ADD CONSTRAINT "leave_transaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_transaction" ADD CONSTRAINT "leave_transaction_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "salary_structure" ADD CONSTRAINT "salary_structure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_run" ADD CONSTRAINT "payroll_run_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_item" ADD CONSTRAINT "payroll_item_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_item" ADD CONSTRAINT "payroll_item_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_detail" ADD CONSTRAINT "payroll_detail_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "payroll_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payslip" ADD CONSTRAINT "payslip_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "payroll_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
