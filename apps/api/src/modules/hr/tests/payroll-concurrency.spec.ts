import { PayrollRunStatus, EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';

describe('Phase 3C — Payroll Concurrency & Race Condition Suite', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let periodJune: any;
  let concEmp: any;

  beforeAll(async () => {
    periodService = new PayrollPeriodService();
    salaryService = new SalaryStructureService();
    employeeService = new EmployeeService();
    financeService = new FinanceService();
    runService = new PayrollRunService(new PayrollCalculationEngine(), salaryService, financeService);

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    factoryBranchId = branches[0]?.id;

    superAdminUser = {
      sub: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      username: 'admin',
      organizationId: orgId,
      scope: 'GLOBAL',
      roles: ['SUPER_ADMIN'],
    };

    periodJune = await periodService.createPeriod(
      { year: 2026, month: 6 },
      superAdminUser,
    );

    concEmp = await employeeService.createEmployee(
      {
        employeeCode: `EMP-CONC-PAY-${Date.now()}`,
        firstName: 'Conc',
        lastName: 'Payroll',
        phone: '+919999966661',
        dateOfJoining: '2026-01-01',
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(concEmp.id, superAdminUser);

    await salaryService.createSalaryStructure(
      {
        employeeId: concEmp.id,
        effectiveDate: '2026-01-01',
        baseSalary: 35000,
        hra: 14000,
        conveyance: 2000,
        specialAllowance: 3000,
      },
      superAdminUser,
    );
  });

  afterAll(async () => {
    await prisma.payrollDetail.deleteMany({ where: { payrollItem: { employeeId: concEmp.id } } });
    await prisma.payrollItem.deleteMany({ where: { employeeId: concEmp.id } });
    await prisma.payrollRun.deleteMany({ where: { payrollPeriodId: periodJune.id } });
    await prisma.payrollPeriod.delete({ where: { id: periodJune.id } });
    await prisma.salaryStructure.deleteMany({ where: { employeeId: concEmp.id } });
    await prisma.employee.delete({ where: { id: concEmp.id } });
    await prisma.$disconnect();
  });

  it('Gate 1: 50 concurrent creation attempts for the same period -> Exactly ONE PayrollRun created', async () => {
    const key = `run-conc-${periodJune.id}`;

    const promises = Array.from({ length: 50 }).map(() =>
      runService.createRun(
        { payrollPeriodId: periodJune.id, idempotencyKey: key },
        superAdminUser,
      ).then(
        (res) => ({ status: 'fulfilled' as const, value: res }),
        (err) => ({ status: 'rejected' as const, reason: err.message }),
      ),
    );

    const results = await Promise.all(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(50);

    const runsInDb = await prisma.payrollRun.findMany({
      where: { payrollPeriodId: periodJune.id },
    });
    expect(runsInDb.length).toBe(1);
  });

  it('Gate 2: 50 concurrent calculation attempts on the same run -> Single deterministic result', async () => {
    const run = await prisma.payrollRun.findFirst({ where: { payrollPeriodId: periodJune.id } });
    if (!run) throw new Error('No run found');

    const promises = Array.from({ length: 50 }).map(() =>
      runService.calculatePayrollRun(run.id, superAdminUser).then(
        (res) => ({ status: 'fulfilled' as const, value: res }),
        (err) => ({ status: 'rejected' as const, reason: err.message }),
      ),
    );

    const results = await Promise.all(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const completedRun = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    expect(completedRun?.status).toBe(PayrollRunStatus.CALCULATED);

    // Verify exactly 1 payrollItem for concEmp
    const items = await prisma.payrollItem.findMany({
      where: { payrollRunId: run.id, employeeId: concEmp.id },
    });
    expect(items.length).toBe(1);
  });
});
