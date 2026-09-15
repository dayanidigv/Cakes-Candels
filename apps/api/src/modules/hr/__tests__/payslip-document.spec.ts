import { EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';
import { PayslipService } from '../services/payslip.service';

describe('Phase 3E — Payslip Document Rendering & Integrity Specification', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let payslipService: PayslipService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let periodMay27: any;
  let docEmp: any;
  let targetSlip: any;

  async function cleanupRun(runId: string) {
    await prisma.payslip.deleteMany({ where: { payrollItem: { payrollRunId: runId } } });
    await prisma.payrollDetail.deleteMany({ where: { payrollItem: { payrollRunId: runId } } });
    await prisma.payrollItem.deleteMany({ where: { payrollRunId: runId } });
    await prisma.payrollRun.delete({ where: { id: runId } }).catch(() => null);
  }

  beforeAll(async () => {
    periodService = new PayrollPeriodService();
    salaryService = new SalaryStructureService();
    employeeService = new EmployeeService();
    financeService = new FinanceService();
    runService = new PayrollRunService(new PayrollCalculationEngine(), salaryService, financeService);
    payslipService = new PayslipService();

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    const factory = branches.find((b) => b.type === 'FACTORY') || branches[0];
    factoryBranchId = factory.id;

    superAdminUser = {
      sub: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      username: 'admin',
      organizationId: orgId,
      branchId: factoryBranchId,
      roles: ['SUPER_ADMIN', 'HR_DIRECTOR'],
      scope: 'GLOBAL',
    };

    // Clean up May 2027 period
    const existing = await prisma.payrollPeriod.findMany({
      where: { organizationId: orgId, year: 2027, month: 5 },
    });
    for (const p of existing) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: p.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: p.id } }).catch(() => null);
    }

    periodMay27 = await periodService.createPeriod(
      {
        year: 2027,
        month: 5,
        startDate: '2027-05-01T00:00:00.000Z',
        endDate: '2027-05-31T23:59:59.999Z',
      },
      superAdminUser,
    );

    const empCode = `EMP-DOC-${Date.now().toString().slice(-4)}`;
    docEmp = await employeeService.createEmployee(
      {
        employeeCode: empCode,
        firstName: 'Leonardo',
        lastName: 'DaVinci',
        phone: `+9186${Date.now().toString().slice(-8)}`,
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
        dateOfJoining: '2027-01-01',
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(docEmp.id, superAdminUser);
    await salaryService.createSalaryStructure(
      {
        employeeId: docEmp.id,
        effectiveDate: '2027-01-01',
        baseSalary: 70000,
        hra: 28000,
        conveyance: 5000,
        specialAllowance: 12000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    for (let day = 1; day <= 22; day++) {
      const dayStr = day.toString().padStart(2, '0');
      await prisma.attendanceLog.create({
        data: {
          organizationId: orgId,
          branchId: factoryBranchId,
          employeeId: docEmp.id,
          workDate: new Date(`2027-05-${dayStr}T00:00:00.000Z`),
          checkInTime: new Date(`2027-05-${dayStr}T09:00:00.000Z`),
          checkOutTime: new Date(`2027-05-${dayStr}T18:00:00.000Z`),
          hoursWorked: 9,
          status: 'CHECKED_OUT',
          source: 'POS',
        },
      });
    }

    const run = await runService.createRun(
      { payrollPeriodId: periodMay27.id, idempotencyKey: `ps-doc-run-${Date.now()}` },
      superAdminUser,
    );
    await runService.calculatePayrollRun(run.id, superAdminUser);
    await runService.submitForApproval(run.id, superAdminUser);
    await runService.approvePayrollRun(run.id, superAdminUser);
    await runService.postPayrollToFinance(run.id, superAdminUser);
    const slips = await payslipService.generatePayslipsForRun(run.id, superAdminUser);
    targetSlip = slips.find((s: any) => s.payslipNumber.includes(docEmp.employeeCode)) || slips[0];
    await payslipService.approvePayslip(targetSlip.id, superAdminUser);
    await payslipService.issuePayslip(targetSlip.id, superAdminUser);
  });

  afterAll(async () => {
    if (periodMay27?.id) {
      const runs = await prisma.payrollRun.findMany({ where: { payrollPeriodId: periodMay27.id } });
      for (const r of runs) await cleanupRun(r.id);
      await prisma.payrollPeriod.delete({ where: { id: periodMay27.id } }).catch(() => null);
    }
    if (docEmp?.id) {
      await prisma.attendanceLog.deleteMany({ where: { employeeId: docEmp.id } });
      await prisma.salaryStructure.deleteMany({ where: { employeeId: docEmp.id } });
      await prisma.employee.delete({ where: { id: docEmp.id } }).catch(() => null);
    }
  });

  it('should render a production-quality printable A4 document with corporate branding', async () => {
    const doc = await payslipService.renderPayslipDocument(targetSlip.id, superAdminUser);

    expect(doc.html).toContain('Cakes & Candles');
    expect(doc.html).toContain('PAYSLIP');
    expect(doc.html).toContain(targetSlip.payslipNumber);
    expect(doc.html).toContain('Leonardo DaVinci');
    expect(doc.html).toContain('Net Take-Home Salary');
    expect(doc.html).toContain('₹');
    expect(doc.filename).toBe(`${targetSlip.payslipNumber}.html`);
  });

  it('should maintain cryptographic hash integrity between stored pdfHash and rendered document', async () => {
    const doc = await payslipService.renderPayslipDocument(targetSlip.id, superAdminUser);
    expect(doc.pdfHash).toBe(targetSlip.pdfHash);
  });
});
