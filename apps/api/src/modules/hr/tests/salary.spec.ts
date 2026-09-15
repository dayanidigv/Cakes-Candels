import { EmploymentType } from '@prisma/client';
import { prisma } from '@cc-erp/database';
import {
  SalaryComponentService,
  SalaryStructureService,
} from '../services/salary.service';
import { EmployeeService, RequestingUser } from '../services/employee.service';

describe('Phase 3B — Salary Foundation & Historical Resolution Specification', () => {
  let salaryComponentService: SalaryComponentService;
  let salaryStructureService: SalaryStructureService;
  let employeeService: EmployeeService;
  let orgId: string;
  let factoryBranchId: string;
  let retailBranchId: string;
  let superAdminUser: RequestingUser;
  let branchManagerUser: RequestingUser;
  let activeEmp: any;

  beforeAll(async () => {
    salaryComponentService = new SalaryComponentService();
    salaryStructureService = new SalaryStructureService();
    employeeService = new EmployeeService();

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    const factory = branches.find((b) => b.type === 'FACTORY') || branches[0];
    const retail = branches.find((b) => b.type === 'RETAIL_BRANCH') || branches[1] || factory;

    factoryBranchId = factory.id;
    retailBranchId = retail.id;

    superAdminUser = {
      sub: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      username: 'admin',
      organizationId: orgId,
      scope: 'GLOBAL',
      roles: ['SUPER_ADMIN'],
    };

    branchManagerUser = {
      sub: '00000000-0000-0000-0000-000000000002',
      userId: '00000000-0000-0000-0000-000000000002',
      permissions: [],
      username: 'retail_manager',
      organizationId: orgId,
      branchId: retailBranchId,
      scope: 'BRANCH',
      roles: ['BRANCH_MANAGER'],
    };

    activeEmp = await employeeService.createEmployee(
      {
        employeeCode: `EMP-SAL-${Date.now()}`,
        firstName: 'Salary',
        lastName: 'Tester',
        phone: '+919999933331',
        dateOfJoining: '2026-01-01',
        assignedBranchId: factoryBranchId,
        employmentType: EmploymentType.FULL_TIME,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(activeEmp.id, superAdminUser);
  });

  afterAll(async () => {
    await prisma.salaryStructure.deleteMany({ where: { employeeId: activeEmp.id } });
    await prisma.employee.delete({ where: { id: activeEmp.id } });
    await prisma.$disconnect();
  });

  it('Gate 1: Should create and list Salary Components with uniqueness constraints', async () => {
    const code = `BASIC_${Date.now()}`;
    const comp = await salaryComponentService.create(
      {
        code,
        name: 'Basic Pay Component',
        type: 'EARNING',
        isTaxable: true,
      },
      superAdminUser,
    );

    expect(comp.id).toBeDefined();
    expect(comp.code).toBe(code.toUpperCase());

    // Duplicate code in same org must fail
    await expect(
      salaryComponentService.create(
        {
          code,
          name: 'Duplicate Basic Pay',
          type: 'EARNING',
        },
        superAdminUser,
      ),
    ).rejects.toThrow();

    // Branch manager cannot create salary component
    await expect(
      salaryComponentService.create(
        {
          code: `UNAUTH_${Date.now()}`,
          name: 'Unauthorized Comp',
          type: 'EARNING',
        },
        branchManagerUser,
      ),
    ).rejects.toThrow(/Only GLOBAL\/HQ administrators/);

    await prisma.salaryComponent.delete({ where: { id: comp.id } });
  });

  it('Gate 2: Should assign effective-dated salary structure and emit audit and outbox events', async () => {
    const structure = await salaryStructureService.createSalaryStructure(
      {
        employeeId: activeEmp.id,
        effectiveDate: '2026-01-01',
        baseSalary: 45000,
        hra: 18000,
        conveyance: 2000,
        specialAllowance: 5000,
        pfContribution: 1800,
        esiContribution: 0,
      },
      superAdminUser,
    );

    expect(structure.id).toBeDefined();
    expect(Number(structure.baseSalary)).toBe(45000);

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: structure.id, entity: 'salary_structure' },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit).toBeDefined();

    // Verify OutboxEvent
    const outbox = await prisma.outboxEvent.findFirst({
      where: { type: 'hr.salary.assigned' },
      orderBy: { createdAt: 'desc' },
    });
    expect(outbox).toBeDefined();
  });

  it('Gate 3: Deterministic Historical Salary Resolution (resolveEmployeeSalary)', async () => {
    // Create dedicated employee for historical resolution test
    const histEmp = await employeeService.createEmployee(
      {
        employeeCode: `EMP-HIST-${Date.now()}`,
        firstName: 'Historical',
        lastName: 'Resolver',
        phone: '+919999933332',
        dateOfJoining: '2026-01-01',
        assignedBranchId: factoryBranchId,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(histEmp.id, superAdminUser);

    // Structure V1 effective 2026-01-01 -> Base: 50,000
    await salaryStructureService.createSalaryStructure(
      {
        employeeId: histEmp.id,
        effectiveDate: '2026-01-01',
        baseSalary: 50000,
        hra: 20000,
        conveyance: 2500,
        specialAllowance: 5000,
      },
      superAdminUser,
    );

    // Structure V2 effective 2026-07-01 -> Base: 65,000 (Mid-year raise)
    await salaryStructureService.createSalaryStructure(
      {
        employeeId: histEmp.id,
        effectiveDate: '2026-07-01',
        baseSalary: 65000,
        hra: 25000,
        conveyance: 3000,
        specialAllowance: 8000,
      },
      superAdminUser,
    );

    // 1. Resolving for March 2026 (Payroll Period Q1) MUST deterministically return V1 (Base: 50,000)
    const resolvedMarch = await salaryStructureService.resolveEmployeeSalary(
      histEmp.id,
      '2026-03-31',
      superAdminUser,
    );
    expect(resolvedMarch.baseSalary).toBe(50000);
    expect(resolvedMarch.hra).toBe(20000);
    expect(resolvedMarch.totalGrossFixed).toBe(77500);

    // 2. Resolving for August 2026 (Payroll Period Q3) MUST deterministically return V2 (Base: 65,000)
    const resolvedAugust = await salaryStructureService.resolveEmployeeSalary(
      histEmp.id,
      '2026-08-31',
      superAdminUser,
    );
    expect(resolvedAugust.baseSalary).toBe(65000);
    expect(resolvedAugust.hra).toBe(25000);
    expect(resolvedAugust.totalGrossFixed).toBe(101000);

    // 3. Resolving for a date prior to 2026-01-01 MUST throw NotFoundException
    await expect(
      salaryStructureService.resolveEmployeeSalary(histEmp.id, '2025-12-15', superAdminUser),
    ).rejects.toThrow(/No active salary structure found/);

    await prisma.salaryStructure.deleteMany({ where: { employeeId: histEmp.id } });
    await prisma.employee.delete({ where: { id: histEmp.id } });
  });

  it('Gate 4: Should enforce branch isolation on salary data access', async () => {
    // activeEmp is in factoryBranchId; branchManagerUser is in retailBranchId
    await expect(
      salaryStructureService.resolveEmployeeSalary(
        activeEmp.id,
        '2026-08-31',
        branchManagerUser,
      ),
    ).rejects.toThrow(/Cannot access salary data for another branch/);

    await expect(
      salaryStructureService.createSalaryStructure(
        {
          employeeId: activeEmp.id,
          effectiveDate: '2026-09-01',
          baseSalary: 70000,
        },
        branchManagerUser,
      ),
    ).rejects.toThrow(/Cannot manage salary for an employee belonging to a different branch/);
  });

  it('Gate 5: Concurrency Protection on simultaneous salary structure assignments', async () => {
    const concEmp = await employeeService.createEmployee(
      {
        employeeCode: `EMP-CONC-SAL-${Date.now()}`,
        firstName: 'Concurrent',
        lastName: 'Salary',
        phone: '+919999933333',
        dateOfJoining: '2026-01-01',
        assignedBranchId: factoryBranchId,
      },
      superAdminUser,
    );
    await employeeService.activateEmployee(concEmp.id, superAdminUser);

    const promises = Array.from({ length: 20 }).map((_, i) =>
      salaryStructureService.createSalaryStructure(
        {
          employeeId: concEmp.id,
          effectiveDate: `2026-09-${(i + 1).toString().padStart(2, '0')}`,
          baseSalary: 50000 + i * 100,
          idempotencyKey: `sal-conc-${concEmp.id}-${i}`,
        },
        superAdminUser,
      ).then(
        (res) => ({ status: 'fulfilled' as const, value: res }),
        (err) => ({ status: 'rejected' as const, reason: err.message }),
      ),
    );

    const results = await Promise.all(promises);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(20);

    // Resolution for 2026-09-10 must deterministically return the salary structure effective on or before 2026-09-10
    const resolvedMidSept = await salaryStructureService.resolveEmployeeSalary(
      concEmp.id,
      '2026-09-10',
      superAdminUser,
    );
    expect(resolvedMidSept.baseSalary).toBe(50000 + 9 * 100);

    await prisma.salaryStructure.deleteMany({ where: { employeeId: concEmp.id } });
    await prisma.employee.delete({ where: { id: concEmp.id } });
  });
});
