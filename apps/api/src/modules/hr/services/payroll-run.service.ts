import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@cc-erp/database';
import { PayrollRunStatus, AuditAction, AttendanceStatus, LeaveRequestStatus } from '@prisma/client';
import { CreatePayrollRunDto, QueryPayrollRunDto } from '../dto/payroll.dto';
import { writeHrAuditLog, writeHrOutboxEvent } from '../utils/hr-audit-outbox.helper';
import { PayrollCalculationEngine } from './payroll-calculation.engine';
import { SalaryStructureService } from './salary.service';
import { FinanceService } from '../../finance/finance.service';
import type { RequestingUser } from './employee.service';

@Injectable()
export class PayrollRunService {
  constructor(
    private readonly calculationEngine: PayrollCalculationEngine,
    private readonly salaryStructureService: SalaryStructureService,
    private readonly financeService: FinanceService,
  ) {}

  private async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub }, select: { organizationId: true } });
    if (!dbUser?.organizationId) throw new ForbiddenException('No organization assigned');
    return dbUser.organizationId;
  }

  // ─── INITIALIZE PAYROLL RUN ────────────────────────────────────────────────

  async createRun(dto: CreatePayrollRunDto, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR administrators can initialize payroll runs');
    }

    const period = await prisma.payrollPeriod.findFirst({
      where: { id: dto.payrollPeriodId, organizationId },
    });
    if (!period) throw new NotFoundException('Payroll period not found');
    if (period.status !== 'OPEN') {
      throw new BadRequestException('Cannot create a payroll run for a closed period');
    }

    const idempotencyKey =
      dto.idempotencyKey || `run-${organizationId}-${period.year}-${period.month}`;

    const existingRun = await prisma.payrollRun.findFirst({
      where: { organizationId, idempotencyKey },
    });
    if (existingRun) {
      return existingRun;
    }

    const runNumber = `PAY-${period.year}${period.month.toString().padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    try {
      const created = await prisma.$transaction(async (tx) => {
        const run = await tx.payrollRun.create({
          data: {
            organizationId,
            payrollPeriodId: dto.payrollPeriodId,
            runNumber,
            status: PayrollRunStatus.DRAFT,
            idempotencyKey,
            totalEmployees: 0,
            totalGrossPay: 0,
            totalDeductions: 0,
            totalNetPay: 0,
          },
        });

        await writeHrAuditLog(tx, {
          entity: 'payroll_run',
          entityId: run.id,
          action: AuditAction.CREATE,
          performedBy: user.sub,
          after: { runNumber, payrollPeriodId: dto.payrollPeriodId, status: PayrollRunStatus.DRAFT },
        });

        return run;
      });

      return created;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const existing = await prisma.payrollRun.findFirst({
          where: { organizationId, idempotencyKey },
        });
        if (existing) return existing;
        throw new ConflictException('Payroll run creation conflict');
      }
      throw error;
    }
  }

  // ─── EXECUTE PAYROLL CALCULATION ENGINE ────────────────────────────────────

  async calculatePayrollRun(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Insufficient permissions to calculate payroll');
    }

    const run = await prisma.payrollRun.findFirst({
      where: { id, organizationId },
      include: { payrollPeriod: true },
    });

    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== PayrollRunStatus.DRAFT && run.status !== PayrollRunStatus.CALCULATED) {
      throw new BadRequestException(`Cannot calculate payroll in status: ${run.status}`);
    }

    // Atomic CAS transition: DRAFT/CALCULATED -> CALCULATING
    const casUpdate = await prisma.payrollRun.updateMany({
      where: { id, status: { in: [PayrollRunStatus.DRAFT, PayrollRunStatus.CALCULATED] } },
      data: { status: PayrollRunStatus.CALCULATING },
    });

    if (casUpdate.count === 0) {
      throw new ConflictException('Payroll run is already being calculated concurrently');
    }

    try {
      const period = run.payrollPeriod;
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(23, 59, 59, 999);

      // Determine working days in period (calendar days in period)
      const diffTime = Math.abs(periodEnd.getTime() - periodStart.getTime());
      const workingDaysInPeriod = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Fetch eligible active employees
      const employeeFilter: any = {
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
      };

      if (user.scope === 'BRANCH' && user.branchId) {
        employeeFilter.assignedBranchId = user.branchId;
      }

      const eligibleEmployees = await prisma.employee.findMany({
        where: employeeFilter,
        orderBy: { employeeCode: 'asc' },
      });

      if (eligibleEmployees.length === 0) {
        throw new BadRequestException('No eligible active employees found for payroll calculation');
      }

      const calculatedItems = [];
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      for (const emp of eligibleEmployees) {
        // 1. Resolve attendance punches in period
        const attendanceLogs = await prisma.attendanceLog.findMany({
          where: {
            employeeId: emp.id,
            workDate: { gte: periodStart, lte: periodEnd },
            status: { in: [AttendanceStatus.FINALIZED, AttendanceStatus.CHECKED_OUT] },
          },
        });

        const presentDays = attendanceLogs.length;
        const overtimeHours = attendanceLogs.reduce(
          (sum, log) => sum + (Number(log.overtimeHours) || 0),
          0,
        );

        // 2. Resolve approved leaves in period
        const approvedLeaves = await prisma.leaveRequest.findMany({
          where: {
            employeeId: emp.id,
            status: LeaveRequestStatus.APPROVED,
            startDate: { lte: periodEnd },
            endDate: { gte: periodStart },
          },
        });

        let approvedLeaveDays = 0;
        for (const leave of approvedLeaves) {
          const lStart = Math.max(leave.startDate.getTime(), periodStart.getTime());
          const lEnd = Math.min(leave.endDate.getTime(), periodEnd.getTime());
          const days = Math.round((lEnd - lStart) / 86400000) + 1;
          approvedLeaveDays += Math.max(0, days);
        }

        // 3. Resolve effective salary structure on period end date
        let salary: any;
        try {
          salary = await this.salaryStructureService.resolveEmployeeSalary(
            emp.id,
            period.endDate,
            user,
          );
        } catch {
          salary = {
            baseSalary: 0,
            hra: 0,
            conveyance: 0,
            specialAllowance: 0,
            pfContribution: 0,
            esiContribution: 0,
          };
        }

        // 4. Calculate employee breakdown
        const calculated = this.calculationEngine.calculate({
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          workingDaysInPeriod,
          presentDays,
          approvedLeaveDays,
          overtimeHours,
          salary,
        });

        totalGross += calculated.grossPay;
        totalDeductions += calculated.totalDeductions;
        totalNet += calculated.netPay;

        calculatedItems.push(calculated);
      }

      // Round totals
      totalGross = Math.round(totalGross * 100) / 100;
      totalDeductions = Math.round(totalDeductions * 100) / 100;
      totalNet = Math.round(totalNet * 100) / 100;

      // Persist in single transaction with existence verification
      const updatedRun = await prisma.$transaction(async (tx) => {
        // Delete previous items & details for recalculation safety
        await tx.payrollItem.deleteMany({ where: { payrollRunId: id } });

        let processedCount = 0;
        let finalGross = 0;
        let finalDeductions = 0;
        let finalNet = 0;

        for (const item of calculatedItems) {
          // Verify employee still exists in DB
          const empExists = await tx.employee.findUnique({
            where: { id: item.employeeId },
            select: { id: true },
          });

          if (empExists) {
            await tx.payrollItem.create({
              data: {
                payrollRunId: id,
                employeeId: item.employeeId,
                workingDays: item.workingDays,
                presentDays: item.presentDays,
                lossOfPayDays: item.lossOfPayDays,
                overtimeHours: item.overtimeHours,
                basePay: item.basePay,
                allowances: item.allowances,
                grossPay: item.grossPay,
                pfDeduction: item.pfDeduction,
                esiDeduction: item.esiDeduction,
                taxDeduction: item.taxDeduction,
                otherDeductions: item.otherDeductions,
                netPay: item.netPay,
                details: {
                  create: item.details.map((d) => ({
                    componentCode: d.componentCode,
                    componentName: d.componentName,
                    type: d.type,
                    amount: d.amount,
                  })),
                },
              },
            });
            processedCount++;
            finalGross += item.grossPay;
            finalDeductions += item.totalDeductions;
            finalNet += item.netPay;
          }
        }

        const completedRun = await tx.payrollRun.update({
          where: { id },
          data: {
            status: PayrollRunStatus.CALCULATED,
            totalEmployees: processedCount,
            totalGrossPay: Math.round(finalGross * 100) / 100,
            totalDeductions: Math.round(finalDeductions * 100) / 100,
            totalNetPay: Math.round(finalNet * 100) / 100,
          },
        });

        await writeHrOutboxEvent(tx, {
          type: 'hr.payroll.calculated',
          payload: {
            payrollRunId: id,
            organizationId,
            totalEmployees: processedCount,
            totalGrossPay: finalGross,
            totalNetPay: finalNet,
          },
        });

        await writeHrAuditLog(tx, {
          entity: 'payroll_run',
          entityId: id,
          action: AuditAction.UPDATE,
          performedBy: user.sub,
          after: {
            status: PayrollRunStatus.CALCULATED,
            totalEmployees: processedCount,
            totalNetPay: finalNet,
          },
        });

        return completedRun;
      });

      return updatedRun;
    } catch (error) {
      // Revert status to DRAFT on calculation failure
      await prisma.payrollRun.update({
        where: { id },
        data: { status: PayrollRunStatus.DRAFT },
      }).catch(() => null);
      throw error;
    }
  }

  async recalculatePayrollRun(id: string, user: RequestingUser) {
    return this.calculatePayrollRun(id, user);
  }

  // ─── APPROVAL SUBMISSION ───────────────────────────────────────────────────

  async submitForApproval(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR administrators can submit payroll for approval');
    }

    const run = await prisma.payrollRun.findFirst({
      where: { id, organizationId },
      include: { items: true },
    });

    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status !== PayrollRunStatus.CALCULATED) {
      throw new BadRequestException(
        `Cannot submit payroll for approval: current status is ${run.status}`,
      );
    }

    if (run.items.length === 0) {
      throw new BadRequestException('Cannot submit payroll run with zero calculated items');
    }

    const hasNegativeNetPay = run.items.some((item) => Number(item.netPay) < 0);
    if (hasNegativeNetPay) {
      throw new BadRequestException('Payroll contains invalid negative net pay values');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.payrollRun.update({
        where: { id },
        data: { status: PayrollRunStatus.PENDING_APPROVAL },
      });

      await writeHrAuditLog(tx, {
        entity: 'payroll_run',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        before: { status: PayrollRunStatus.CALCULATED },
        after: { status: PayrollRunStatus.PENDING_APPROVAL },
      });

      return result;
    });

    return updated;
  }

  // ─── APPROVAL ENGINE SIGN-OFF (Phase 3D) ──────────────────────────────────

  async approvePayrollRun(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR or Finance administrators can approve payroll');
    }

    const run = await prisma.payrollRun.findFirst({
      where: { id, organizationId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');

    if (run.status === PayrollRunStatus.APPROVED) {
      return run; // Idempotent approval
    }

    if (run.status !== PayrollRunStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Cannot approve payroll run: current status is ${run.status}, expected PENDING_APPROVAL`,
      );
    }

    const approvedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      // Atomic CAS transition: PENDING_APPROVAL -> APPROVED
      const casUpdate = await tx.payrollRun.updateMany({
        where: { id, status: PayrollRunStatus.PENDING_APPROVAL },
        data: {
          status: PayrollRunStatus.APPROVED,
          approvedBy: user.sub,
          approvedAt,
        },
      });

      if (casUpdate.count === 0) {
        const existing = await tx.payrollRun.findUnique({ where: { id } });
        if (existing?.status === PayrollRunStatus.APPROVED) return existing;
        throw new ConflictException('Concurrent modification during payroll approval');
      }

      const completed = await tx.payrollRun.findUnique({
        where: { id },
        include: { payrollPeriod: true },
      });

      await writeHrOutboxEvent(tx, {
        type: 'hr.payroll.approved',
        payload: {
          payrollRunId: id,
          organizationId,
          approvedBy: user.sub,
          approvedAt: approvedAt.toISOString(),
          totalNetPay: Number(run.totalNetPay),
        },
      });

      await writeHrAuditLog(tx, {
        entity: 'payroll_run',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        before: { status: PayrollRunStatus.PENDING_APPROVAL },
        after: {
          status: PayrollRunStatus.APPROVED,
          approvedBy: user.sub,
          approvedAt,
        },
      });

      return completed!;
    });

    return updated;
  }

  // ─── FINANCE POSTING & GENERAL LEDGER INTEGRATION (Phase 3D) ───────────────

  async postPayrollToFinance(id: string, user: RequestingUser, idempotencyKey?: string) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ Finance or HR administrators can post payroll to Finance');
    }

    const run = await prisma.payrollRun.findFirst({
      where: { id, organizationId },
      include: { payrollPeriod: true, items: true },
    });

    if (!run) throw new NotFoundException('Payroll run not found');

    // 1. Idempotency Check: if already POSTED or PAID, return existing run immediately
    if (run.status === PayrollRunStatus.POSTED || run.status === PayrollRunStatus.PAID) {
      return run;
    }

    // 2. Strict State Machine Guard: only APPROVED can transition to POSTED
    if (run.status !== PayrollRunStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot post payroll to Finance: status must be APPROVED, current status is ${run.status}`,
      );
    }

    if (run.items.length === 0) {
      throw new BadRequestException('Cannot post payroll with zero items');
    }

    // 3. Mathematical Reconciliation (Gross = Net + Deductions)
    const grossNum = Number(run.totalGrossPay);
    const deductionsNum = Number(run.totalDeductions);
    const netNum = Number(run.totalNetPay);
    const calculatedNet = Math.round((grossNum - deductionsNum) * 100) / 100;
    const providedNet = Math.round(netNum * 100) / 100;
    if (Math.abs(calculatedNet - providedNet) > 0.05) {
      throw new BadRequestException(
        `Payroll reconciliation mismatch: Gross (${grossNum}) - Deductions (${deductionsNum}) != Net (${netNum})`,
      );
    }

    // 4. Atomic CAS execution inside single database transaction
    return prisma.$transaction(async (tx) => {
      // Atomic CAS Guard: exactly ONE worker wins the transition APPROVED -> POSTED
      const casUpdate = await tx.payrollRun.updateMany({
        where: { id, status: PayrollRunStatus.APPROVED },
        data: { status: PayrollRunStatus.POSTED },
      });

      if (casUpdate.count === 0) {
        // Race condition: another concurrent worker already posted this run
        const alreadyPosted = await tx.payrollRun.findUnique({
          where: { id },
          include: { payrollPeriod: true, items: true },
        });
        if (
          alreadyPosted &&
          (alreadyPosted.status === PayrollRunStatus.POSTED ||
            alreadyPosted.status === PayrollRunStatus.PAID)
        ) {
          return alreadyPosted;
        }
        throw new ConflictException('Payroll run is already being processed or not in APPROVED state');
      }

      // 5. Post Expense into Finance Domain (S08)
      await this.financeService.postPayrollExpense({
        organizationId,
        payrollRunId: run.id,
        runNumber: run.runNumber,
        periodYear: run.payrollPeriod.year,
        periodMonth: run.payrollPeriod.month,
        totalGrossPay: grossNum,
        totalDeductions: deductionsNum,
        totalNetPay: netNum,
        performedBy: user.sub,
        tx,
      });

      // Generate valid UUID for financeExpenseId
      const { randomUUID } = require('crypto');
      const financeExpenseId = randomUUID();

      const postedRun = await tx.payrollRun.update({
        where: { id },
        data: {
          status: PayrollRunStatus.POSTED,
          financeExpenseId,
        },
        include: { payrollPeriod: true, items: true },
      });

      // 6. Transactional Outbox Event (hr.payroll.paid / hr.payroll.posted)
      await writeHrOutboxEvent(tx, {
        type: 'hr.payroll.paid',
        payload: {
          payrollRunId: id,
          organizationId,
          year: run.payrollPeriod.year,
          month: run.payrollPeriod.month,
          totalGrossPay: grossNum,
          totalDeductions: deductionsNum,
          totalNetPay: netNum,
          financeExpenseId,
          financeExpenseCategory: 'SALARY',
          runNumber: run.runNumber,
          postedAt: new Date().toISOString(),
        },
      });

      // 7. Transactional Audit Log
      await writeHrAuditLog(tx, {
        entity: 'payroll_run',
        entityId: id,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        before: { status: PayrollRunStatus.APPROVED },
        after: {
          status: PayrollRunStatus.POSTED,
          financeExpenseId,
          totalNetPay: netNum,
          runNumber: run.runNumber,
        },
      });

      return postedRun;
    });
  }

  // ─── QUERIES ───────────────────────────────────────────────────────────────

  async getRun(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    const run = await prisma.payrollRun.findFirst({
      where: { id, organizationId },
      include: {
        payrollPeriod: true,
        _count: { select: { items: true } },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  async listRuns(user: RequestingUser, query?: QueryPayrollRunDto) {
    const organizationId = await this.resolveOrgId(user);
    return prisma.payrollRun.findMany({
      where: {
        organizationId,
        ...(query?.payrollPeriodId ? { payrollPeriodId: query.payrollPeriodId } : {}),
        ...(query?.status ? { status: query.status } : {}),
      },
      include: {
        payrollPeriod: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRunItems(runId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);
    const run = await prisma.payrollRun.findFirst({ where: { id: runId, organizationId } });
    if (!run) throw new NotFoundException('Payroll run not found');

    const itemFilter: any = { payrollRunId: runId };
    if (user.scope === 'BRANCH' && user.branchId) {
      itemFilter.employee = { assignedBranchId: user.branchId };
    }

    return prisma.payrollItem.findMany({
      where: itemFilter,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, departmentId: true, designationId: true },
        },
        details: true,
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });
  }
}
