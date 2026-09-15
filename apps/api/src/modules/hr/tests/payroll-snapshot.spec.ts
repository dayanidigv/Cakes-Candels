import { PayrollRunStatus, EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';
import { SalaryStructureService } from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';
import { FinanceService } from '../../finance/finance.service';

describe('Phase 3C — Historical Payroll Snapshot & Immutability Specification', () => {
  let periodService: PayrollPeriodService;
  let runService: PayrollRunService;
  let salaryService: SalaryStructureService;
  let employeeService: EmployeeService;
  let financeService: FinanceService;
  let orgId: string;
  let factoryBranchId: string;
  let superAdminUser: RequestingUser;
  let periodMay: any;
  let snapEmp: any;

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

    // Create test period for May 2026 (31 days)
    periodMay = await periodService.createPeriod(
      { year: 2026, month: 5 },
      superAdminUser,
    );

    // Create employee with initial base salary 40,000 effective Jan 1
    snapEmp = await employeeService.createEmployee(
      {
        employeeCode: `EMP-SNAP-${Date.now()}`,
        firstName: 'Snapshot',
        lastName: 'Tester',
        phone: '+919999955551',
        dateOfJoining: '2026-01-01',
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(snapEmp.id, superAdminUser);

    await salaryService.createSalaryStructure(
      {
        employeeId: snapEmp.id,
        effectiveDate: '2026-01-01',
        baseSalary: 40000,
        hra: 16000,
        conveyance: 2000,
        specialAllowance: 4000,
      },
      superAdminUser,
    );
  });

  afterAll(async () => {
    await prisma.payrollDetail.deleteMany({ where: { payrollItem: { employeeId: snapEmp.id } } });
    await prisma.payrollItem.deleteMany({ where: { employeeId: snapEmp.id } });
    await prisma.payrollRun.deleteMany({ where: { payrollPeriodId: periodMay.id } });
    await prisma.payrollPeriod.delete({ where: { id: periodMay.id } });
    await prisma.salaryStructure.deleteMany({ where: { employeeId: snapEmp.id } });
    await prisma.employee.delete({ where: { id: snapEmp.id } });
    await prisma.$disconnect();
  });

  it('Gate 1: Historical Payroll Items & Details must remain immutable when future salary changes occur', async () => {
    // 1. Calculate May 2026 Payroll Run
    const run = await runService.createRun(
      { payrollPeriodId: periodMay.id, idempotencyKey: `snap-run-${Date.now()}` },
      superAdminUser,
    );
    await runService.calculatePayrollRun(run.id, superAdminUser);

    // Query May calculated item
    const itemsMay = await runService.getRunItems(run.id, superAdminUser);
    const empItemMay = itemsMay.find((i) => i.employeeId === snapEmp.id);
    expect(empItemMay).toBeDefined();
    const originalBasePay = Number(empItemMay?.basePay);
    const originalNetPay = Number(empItemMay?.netPay);

    // 2. Give Employee a 50% raise on July 1st 2026
    await salaryService.createSalaryStructure(
      {
        employeeId: snapEmp.id,
        effectiveDate: '2026-07-01',
        baseSalary: 60000,
        hra: 24000,
        conveyance: 3000,
        specialAllowance: 8000,
      },
      superAdminUser,
    );

    // 3. Re-query May Payroll Run item -> MUST NOT CHANGE
    const refreshedItemsMay = await runService.getRunItems(run.id, superAdminUser);
    const refreshedEmpItemMay = refreshedItemsMay.find((i) => i.employeeId === snapEmp.id);

    expect(Number(refreshedEmpItemMay?.basePay)).toBe(originalBasePay);
    expect(Number(refreshedEmpItemMay?.netPay)).toBe(originalNetPay);
  });
});
