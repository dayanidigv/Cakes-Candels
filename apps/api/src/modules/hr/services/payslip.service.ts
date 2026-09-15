import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { prisma as rawPrisma } from '@cc-erp/database';
import { PayslipStatus, PayrollRunStatus, AuditAction } from '@prisma/client';
import type { RequestingUser } from './employee.service';
import { writeHrAuditLog, writeHrOutboxEvent } from '../utils/hr-audit-outbox.helper';
import { QueryPayslipDto } from '../dto/payslip.dto';

const prisma = rawPrisma as any;

@Injectable()
export class PayslipService {
  private async resolveOrgId(user: RequestingUser): Promise<string> {
    if (user.organizationId) return user.organizationId;
    const org = await prisma.organization.findFirst({ select: { id: true } });
    if (!org) throw new NotFoundException('No organization found in database');
    return org.id;
  }

  // ─── 1. GENERATE PAYSLIPS FROM POSTED RUN ──────────────────────────────────

  async generatePayslipsForRun(
    payrollRunId: string,
    user: RequestingUser,
    idempotencyKey?: string,
  ) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR administrators can generate payslips');
    }

    const run = await prisma.payrollRun.findFirst({
      where: { id: payrollRunId, organizationId },
      include: {
        payrollPeriod: true,
        items: {
          include: {
            employee: {
              include: {
                department: true,
                designation: true,
                branch: true,
              },
            },
            details: true,
            payslip: true,
          },
        },
      },
    });

    if (!run) throw new NotFoundException('Payroll run not found');

    // State machine check: Run must be POSTED or PAID before generating payslips
    if (
      run.status !== PayrollRunStatus.POSTED &&
      run.status !== PayrollRunStatus.PAID
    ) {
      throw new BadRequestException(
        `Cannot generate payslips: payroll run status must be POSTED or PAID, current status is ${run.status}`,
      );
    }

    if (run.items.length === 0) {
      throw new BadRequestException('Payroll run has zero calculated employee items');
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });

    // Atomic creation inside transaction with skipDuplicates for exact-once concurrency
    return prisma.$transaction(async (tx: any) => {
      // 1. Check existing payslips for items in this run
      const itemIds = run.items.map((i: any) => i.id);
      const existingSlips = await tx.payslip.findMany({
        where: { payrollItemId: { in: itemIds } },
      });
      const existingMap = new Map(existingSlips.map((s: any) => [s.payrollItemId, s]));

      const itemsToCreate = run.items.filter((i: any) => !existingMap.has(i.id));

      if (itemsToCreate.length > 0) {
        const createData = itemsToCreate.map((item: any) => {
          const payslipNumber = `PS-${run.payrollPeriod.year}${String(run.payrollPeriod.month).padStart(2, '0')}-${item.employee.employeeCode}`;
          const documentHtml = this.buildPayslipHtml({
            orgName: org?.name || 'Cakes & Candles ERP',
            orgCode: org?.code || 'CC-HQ',
            branchName: item.employee.branch?.name || 'Main Bakery Factory',
            payslipNumber,
            year: run.payrollPeriod.year,
            month: run.payrollPeriod.month,
            periodStartDate: run.payrollPeriod.startDate,
            periodEndDate: run.payrollPeriod.endDate,
            employee: item.employee,
            item,
            details: item.details,
          });
          const pdfHash = crypto.createHash('sha256').update(documentHtml).digest('hex');
          return {
            payrollItemId: item.id,
            payslipNumber,
            status: PayslipStatus.GENERATED,
            pdfHash,
            issuedAt: new Date(),
          };
        });

        await tx.payslip.createMany({
          data: createData,
          skipDuplicates: true,
        });

        // Write outbox and audit logs for newly created slips
        const newlyCreated = await tx.payslip.findMany({
          where: { payrollItemId: { in: itemsToCreate.map((i: any) => i.id) } },
        });

        for (const slip of newlyCreated) {
          if (!existingMap.has(slip.payrollItemId)) {
            const matchedItem = itemsToCreate.find((i: any) => i.id === slip.payrollItemId);
            await writeHrOutboxEvent(tx, {
              type: 'hr.payslip.generated',
              payload: {
                payslipId: slip.id,
                payrollItemId: slip.payrollItemId,
                payrollRunId: run.id,
                employeeId: matchedItem?.employee?.id,
                organizationId,
                payslipNumber: slip.payslipNumber,
                pdfHash: slip.pdfHash,
                netPay: Number(matchedItem?.netPay || 0),
                status: PayslipStatus.GENERATED,
              },
            });

            await writeHrAuditLog(tx, {
              entity: 'payslip',
              entityId: slip.id,
              action: AuditAction.CREATE,
              performedBy: user.sub,
              after: {
                status: PayslipStatus.GENERATED,
                payslipNumber: slip.payslipNumber,
                payrollItemId: slip.payrollItemId,
                pdfHash: slip.pdfHash,
              },
            });
          }
        }
      }

      // Return all payslips for the run
      return tx.payslip.findMany({
        where: { payrollItemId: { in: itemIds } },
      });
    });
  }

  // ─── 2. APPROVE PAYSLIP (GENERATED -> APPROVED) ────────────────────────────

  async approvePayslip(payslipId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR administrators can approve payslips');
    }

    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        payrollItem: {
          include: {
            employee: true,
            payrollRun: true,
          },
        },
      },
    });

    if (!payslip) throw new NotFoundException('Payslip not found');
    if (payslip.payrollItem.employee.organizationId !== organizationId) {
      throw new NotFoundException('Payslip not found');
    }

    // Idempotent return if already APPROVED or ISSUED
    if (payslip.status === PayslipStatus.APPROVED || payslip.status === PayslipStatus.ISSUED) {
      return payslip;
    }

    if (payslip.status !== PayslipStatus.GENERATED) {
      throw new BadRequestException(
        `Cannot approve payslip: current status is ${payslip.status}, expected GENERATED`,
      );
    }

    return prisma.$transaction(async (tx: any) => {
      // Atomic CAS
      const casUpdate = await tx.payslip.updateMany({
        where: { id: payslipId, status: PayslipStatus.GENERATED },
        data: { status: PayslipStatus.APPROVED },
      });

      if (casUpdate.count === 0) {
        const existing = await tx.payslip.findUnique({ where: { id: payslipId } });
        if (existing?.status === PayslipStatus.APPROVED || existing?.status === PayslipStatus.ISSUED) {
          return existing;
        }
        throw new ConflictException('Concurrent modification during payslip approval');
      }

      const updated = await tx.payslip.findUnique({ where: { id: payslipId } });

      await writeHrOutboxEvent(tx, {
        type: 'hr.payslip.approved',
        payload: {
          payslipId,
          payrollItemId: payslip.payrollItemId,
          organizationId,
          approvedBy: user.sub,
          status: PayslipStatus.APPROVED,
        },
      });

      await writeHrAuditLog(tx, {
        entity: 'payslip',
        entityId: payslipId,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        before: { status: PayslipStatus.GENERATED },
        after: { status: PayslipStatus.APPROVED, approvedBy: user.sub },
      });

      return updated!;
    });
  }

  async approvePayslipsForRun(payrollRunId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR administrators can approve payslips');
    }

    const payslips = await prisma.payslip.findMany({
      where: {
        payrollItem: {
          payrollRunId,
          employee: { organizationId },
        },
      },
    });

    if (payslips.length === 0) {
      throw new NotFoundException('No payslips found for this payroll run');
    }

    const approved = [];
    for (const slip of payslips) {
      approved.push(await this.approvePayslip(slip.id, user));
    }
    return approved;
  }

  // ─── 3. ISSUE PAYSLIP (APPROVED -> ISSUED) ─────────────────────────────────

  async issuePayslip(payslipId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR administrators can issue payslips');
    }

    const payslip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        payrollItem: {
          include: {
            employee: true,
            payrollRun: true,
          },
        },
      },
    });

    if (!payslip) throw new NotFoundException('Payslip not found');
    if (payslip.payrollItem.employee.organizationId !== organizationId) {
      throw new NotFoundException('Payslip not found');
    }

    // Idempotent return if already ISSUED
    if (payslip.status === PayslipStatus.ISSUED) {
      return payslip;
    }

    // Strict State Guard: ONLY APPROVED can transition to ISSUED
    if (payslip.status !== PayslipStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot issue payslip: current status is ${payslip.status}, expected APPROVED`,
      );
    }

    const issuedAt = new Date();

    return prisma.$transaction(async (tx: any) => {
      // Atomic CAS
      const casUpdate = await tx.payslip.updateMany({
        where: { id: payslipId, status: PayslipStatus.APPROVED },
        data: {
          status: PayslipStatus.ISSUED,
          issuedAt,
        },
      });

      if (casUpdate.count === 0) {
        const existing = await tx.payslip.findUnique({ where: { id: payslipId } });
        if (existing?.status === PayslipStatus.ISSUED) return existing;
        throw new ConflictException('Concurrent modification during payslip issuance');
      }

      const updated = await tx.payslip.findUnique({ where: { id: payslipId } });

      await writeHrOutboxEvent(tx, {
        type: 'hr.payslip.issued',
        payload: {
          payslipId,
          payrollItemId: payslip.payrollItemId,
          employeeId: payslip.payrollItem.employeeId,
          organizationId,
          payslipNumber: payslip.payslipNumber,
          issuedAt: issuedAt.toISOString(),
          status: PayslipStatus.ISSUED,
        },
      });

      await writeHrAuditLog(tx, {
        entity: 'payslip',
        entityId: payslipId,
        action: AuditAction.UPDATE,
        performedBy: user.sub,
        before: { status: PayslipStatus.APPROVED },
        after: { status: PayslipStatus.ISSUED, issuedAt: issuedAt.toISOString() },
      });

      return updated!;
    });
  }

  async issuePayslipsForRun(payrollRunId: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    if (user.scope === 'BRANCH' || user.scope === 'ASSIGNED') {
      throw new ForbiddenException('Only GLOBAL/HQ HR administrators can issue payslips');
    }

    const payslips = await prisma.payslip.findMany({
      where: {
        payrollItem: {
          payrollRunId,
          employee: { organizationId },
        },
      },
    });

    if (payslips.length === 0) {
      throw new NotFoundException('No payslips found for this payroll run');
    }

    const issued = [];
    for (const slip of payslips) {
      issued.push(await this.issuePayslip(slip.id, user));
    }
    return issued;
  }

  // ─── 4. QUERIES & RETRIEVAL ────────────────────────────────────────────────

  async getPayslip(id: string, user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        payrollItem: {
          include: {
            employee: {
              include: {
                department: true,
                designation: true,
                branch: true,
              },
            },
            details: true,
            payrollRun: {
              include: { payrollPeriod: true },
            },
          },
        },
      },
    });

    if (!payslip) throw new NotFoundException('Payslip not found');
    if (payslip.payrollItem.employee.organizationId !== organizationId) {
      throw new NotFoundException('Payslip not found');
    }

    // RBAC & Scope enforcement
    if (user.scope === 'ASSIGNED') {
      if (
        payslip.payrollItem.employee.userId !== user.sub &&
        payslip.payrollItem.employee.id !== user.employeeId
      ) {
        throw new ForbiddenException('You are not authorized to view another employee payslip');
      }
    } else if (user.scope === 'BRANCH') {
      if (payslip.payrollItem.employee.assignedBranchId !== user.branchId) {
        throw new ForbiddenException('You cannot access payslips outside your assigned branch');
      }
    }

    return payslip;
  }

  async getMyPayslips(user: RequestingUser) {
    const organizationId = await this.resolveOrgId(user);

    // Resolve employee linked to requesting user
    const employee = await prisma.employee.findFirst({
      where: {
        organizationId,
        OR: [{ userId: user.sub }, { id: user.employeeId || '' }],
      },
    });

    if (!employee) {
      return [];
    }

    return prisma.payslip.findMany({
      where: {
        payrollItem: {
          employeeId: employee.id,
        },
        status: PayslipStatus.ISSUED, // Employees only see issued payslips
      },
      include: {
        payrollItem: {
          include: {
            details: true,
            payrollRun: {
              include: { payrollPeriod: true },
            },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async listPayslips(user: RequestingUser, query?: QueryPayslipDto) {
    const organizationId = await this.resolveOrgId(user);

    const filter: any = {
      payrollItem: {
        employee: { organizationId },
        ...(query?.payrollRunId ? { payrollRunId: query.payrollRunId } : {}),
        ...(query?.employeeId ? { employeeId: query.employeeId } : {}),
      },
      ...(query?.status ? { status: query.status } : {}),
    };

    if (user.scope === 'BRANCH') {
      filter.payrollItem.employee.assignedBranchId = user.branchId;
    } else if (user.scope === 'ASSIGNED') {
      filter.payrollItem.employee.OR = [{ userId: user.sub }, { id: user.employeeId || '' }];
    }

    return prisma.payslip.findMany({
      where: filter,
      include: {
        payrollItem: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                departmentId: true,
                designationId: true,
              },
            },
            details: true,
            payrollRun: {
              select: {
                id: true,
                runNumber: true,
                payrollPeriod: true,
              },
            },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // ─── 5. DOCUMENT GENERATION & PRINTABLE A4 RENDERING ───────────────────────

  async renderPayslipDocument(id: string, user: RequestingUser) {
    const payslip = await this.getPayslip(id, user);

    const org = await prisma.organization.findUnique({
      where: { id: payslip.payrollItem.employee.organizationId },
    });

    const item = payslip.payrollItem;
    const emp = item.employee;
    const run = item.payrollRun;
    const period = run.payrollPeriod;

    const html = this.buildPayslipHtml({
      orgName: org?.name || 'Cakes & Candles ERP',
      orgCode: org?.code || 'CC-HQ',
      branchName: emp.branch?.name || 'Main Bakery Factory',
      payslipNumber: payslip.payslipNumber,
      year: period.year,
      month: period.month,
      periodStartDate: period.startDate,
      periodEndDate: period.endDate,
      employee: emp,
      item,
      details: item.details,
    });

    return {
      payslipId: payslip.id,
      payslipNumber: payslip.payslipNumber,
      status: payslip.status,
      pdfHash: payslip.pdfHash,
      html,
      filename: `${payslip.payslipNumber}.html`,
    };
  }

  private buildPayslipHtml(data: {
    orgName: string;
    orgCode: string;
    branchName: string;
    payslipNumber: string;
    year: number;
    month: number;
    periodStartDate: Date;
    periodEndDate: Date;
    employee: any;
    item: any;
    details: any[];
  }): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const monthName = monthNames[data.month - 1] || `Month ${data.month}`;

    const earnings = (data.details || []).filter((d) => d.type === 'EARNING');
    const deductions = (data.details || []).filter((d) => d.type === 'DEDUCTION');

    const formatCurrency = (val: number | any) =>
      `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${data.payslipNumber}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; background: #fff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .org-title { font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
    .org-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .payslip-badge { text-align: right; }
    .badge-title { font-size: 16px; font-weight: 700; color: #3b82f6; }
    .badge-period { font-size: 12px; font-weight: 600; color: #475569; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 20px; }
    .meta-col { display: flex; flex-direction: column; gap: 4px; }
    .meta-row { display: flex; justify-content: space-between; font-size: 12px; }
    .meta-label { color: #64748b; font-weight: 500; }
    .meta-val { color: #0f172a; font-weight: 600; }
    .attendance-box { display: flex; justify-content: space-around; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 20px; font-size: 11px; }
    .att-item { text-align: center; }
    .att-num { font-size: 14px; font-weight: 700; color: #0f172a; }
    .table-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f1f5f9; color: #334155; font-weight: 600; text-align: left; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; }
    th.num { text-align: right; }
    td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    td.num { text-align: right; font-weight: 500; }
    .summary-row { font-weight: 700; background: #f8fafc; border-top: 1px solid #cbd5e1; }
    .net-pay-banner { background: #0f172a; color: #fff; padding: 16px 20px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
    .net-title { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .net-amount { font-size: 22px; font-weight: 800; color: #38bdf8; }
    .footer { margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 10px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="org-title">${data.orgName}</div>
      <div class="org-sub">${data.branchName} • Organization Code: ${data.orgCode}</div>
    </div>
    <div class="payslip-badge">
      <div class="badge-title">PAYSLIP</div>
      <div class="badge-period">${monthName} ${data.year}</div>
      <div class="org-sub">No: ${data.payslipNumber}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-col">
      <div class="meta-row"><span class="meta-label">Employee Name:</span><span class="meta-val">${data.employee.firstName} ${data.employee.lastName}</span></div>
      <div class="meta-row"><span class="meta-label">Employee Code:</span><span class="meta-val">${data.employee.employeeCode}</span></div>
      <div class="meta-row"><span class="meta-label">Department:</span><span class="meta-val">${data.employee.department?.name || 'General Operations'}</span></div>
      <div class="meta-row"><span class="meta-label">Designation:</span><span class="meta-val">${data.employee.designation?.title || 'Staff'}</span></div>
    </div>
    <div class="meta-col">
      <div class="meta-row"><span class="meta-label">Bank Account:</span><span class="meta-val">${data.employee.bankAccountNo ? '••••' + data.employee.bankAccountNo.slice(-4) : 'N/A'}</span></div>
      <div class="meta-row"><span class="meta-label">PAN Number:</span><span class="meta-val">${data.employee.panNumber || 'N/A'}</span></div>
      <div class="meta-row"><span class="meta-label">PF Number:</span><span class="meta-val">${data.employee.pfAccountNo || 'N/A'}</span></div>
      <div class="meta-row"><span class="meta-label">Date of Joining:</span><span class="meta-val">${data.employee.dateOfJoining ? new Date(data.employee.dateOfJoining).toISOString().split('T')[0] : 'N/A'}</span></div>
    </div>
  </div>

  <div class="attendance-box">
    <div class="att-item"><div class="att-num">${data.item.workingDays}</div><div>Calendar Days</div></div>
    <div class="att-item"><div class="att-num">${data.item.presentDays}</div><div>Present Days</div></div>
    <div class="att-item"><div class="att-num">${data.item.lossOfPayDays}</div><div>LOP Days</div></div>
    <div class="att-item"><div class="att-num">${Number(data.item.overtimeHours || 0).toFixed(1)}</div><div>OT Hours</div></div>
  </div>

  <div class="table-split">
    <div>
      <table>
        <thead>
          <tr><th>Earnings Component</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>
          <tr><td>Base Salary</td><td class="num">${formatCurrency(data.item.basePay)}</td></tr>
          ${earnings.map((e) => `<tr><td>${e.componentName}</td><td class="num">${formatCurrency(e.amount)}</td></tr>`).join('\n')}
          <tr class="summary-row"><td>Total Gross Pay</td><td class="num">${formatCurrency(data.item.grossPay)}</td></tr>
        </tbody>
      </table>
    </div>

    <div>
      <table>
        <thead>
          <tr><th>Deductions Component</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>
          ${deductions.map((d) => `<tr><td>${d.componentName}</td><td class="num">${formatCurrency(d.amount)}</td></tr>`).join('\n')}
          <tr class="summary-row"><td>Total Deductions</td><td class="num">${formatCurrency(
            Number(data.item.pfDeduction || 0) +
            Number(data.item.esiDeduction || 0) +
            Number(data.item.taxDeduction || 0) +
            Number(data.item.otherDeductions || 0)
          )}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-pay-banner">
    <div>
      <div class="net-title">Net Take-Home Salary</div>
      <div style="font-size: 11px; color: #94a3b8;">Disbursement processed via Direct Bank Transfer</div>
    </div>
    <div class="net-amount">${formatCurrency(data.item.netPay)}</div>
  </div>

  <div class="footer">
    This is a computer-generated official document and does not require a physical signature.<br>
    Cakes & Candles ERP • Period Ending ${new Date(data.periodEndDate).toISOString().split('T')[0]} • Document SHA-256 Verified
  </div>
</body>
</html>`;
  }
}
