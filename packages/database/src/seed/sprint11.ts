import { PrismaClient } from '@prisma/client';

export async function seedSprint11(prisma: PrismaClient, organizationId: string, factoryId: string, retailId: string) {
  console.log('🌱 Seeding Sprint 11 HR & Payroll Master Data...');

  // 1. Departments
  const deptData = [
    { code: 'HR', name: 'Human Resources', description: 'HR and People Management' },
    { code: 'PROD', name: 'Bakery Production', description: 'Central Factory Production' },
    { code: 'OPS', name: 'Store Operations', description: 'Retail Branch Operations' },
    { code: 'LOG', name: 'Logistics & Dispatch', description: 'Fleet and Delivery Drivers' },
    { code: 'FIN', name: 'Finance & Accounting', description: 'Financial Accounting' },
  ];

  const departments: Record<string, any> = {};
  for (const dept of deptData) {
    departments[dept.code] = await prisma.department.upsert({
      where: { organizationId_code: { organizationId, code: dept.code } },
      update: {},
      create: { ...dept, organizationId },
    });
  }
  console.log('✅ HR Departments seeded (5 departments)');

  // 2. Designations
  const desigData = [
    { code: 'HRM', name: 'HR Manager', level: 4, title: 'HR Manager' },
    { code: 'MBK', name: 'Master Baker', level: 3, title: 'Master Baker' },
    { code: 'CHF', name: 'Pastry Chef', level: 2, title: 'Pastry Chef' },
    { code: 'STM', name: 'Store Manager', level: 4, title: 'Store Manager' },
    { code: 'CSH', name: 'POS Cashier', level: 1, title: 'POS Cashier' },
    { code: 'DRV', name: 'Delivery Driver', level: 1, title: 'Delivery Driver' },
  ];

  const designations: Record<string, any> = {};
  for (const desig of desigData) {
    let existing = await prisma.designation.findFirst({
      where: { OR: [{ code: desig.code }, { title: desig.title }] },
    });
    if (!existing) {
      existing = await prisma.designation.create({
        data: { organizationId, code: desig.code, name: desig.name, title: desig.title, level: desig.level },
      });
    } else {
      existing = await prisma.designation.update({
        where: { id: existing.id },
        data: { organizationId, code: desig.code, name: desig.name, level: desig.level },
      });
    }
    designations[desig.code] = existing;
  }
  console.log('✅ HR Designations seeded (6 designations)');

  // 3. Shifts
  const shiftData = [
    { code: 'SHF-GEN', name: 'General Shift', startTime: '09:00', endTime: '18:00', gracePeriodMinutes: 15, breakDurationMinutes: 60 },
    { code: 'SHF-MOR', name: 'Morning Production Shift', startTime: '06:00', endTime: '14:00', gracePeriodMinutes: 10, breakDurationMinutes: 45 },
    { code: 'SHF-EVE', name: 'Evening Retail Shift', startTime: '14:00', endTime: '22:00', gracePeriodMinutes: 15, breakDurationMinutes: 45 },
  ];

  for (const shift of shiftData) {
    await prisma.shiftMaster.upsert({
      where: { organizationId_code: { organizationId, code: shift.code } },
      update: {},
      create: { ...shift, organizationId },
    });
  }
  console.log('✅ Shift Masters seeded (3 shifts)');

  // 4. Leave Types & Policies
  const leaveTypeData = [
    { code: 'PL', name: 'Paid Leave', annualDays: 15, isCarryForward: true },
    { code: 'CL', name: 'Casual Leave', annualDays: 10, isCarryForward: false },
    { code: 'SL', name: 'Sick Leave', annualDays: 7, isCarryForward: false },
  ];

  for (const lt of leaveTypeData) {
    const leaveType = await prisma.leaveType.upsert({
      where: { organizationId_code: { organizationId, code: lt.code } },
      update: {},
      create: { ...lt, organizationId },
    });

    const existingPolicy = await prisma.leavePolicy.findFirst({
      where: { organizationId, leaveTypeId: leaveType.id },
    });

    if (!existingPolicy) {
      await prisma.leavePolicy.create({
        data: {
          organizationId,
          leaveTypeId: leaveType.id,
          maxContinuousDays: lt.code === 'PL' ? 14 : 3,
          noticeDaysRequired: lt.code === 'PL' ? 3 : 0,
          encashable: lt.code === 'PL',
        },
      });
    }
  }
  console.log('✅ Leave Types & Policies seeded (PL, CL, SL)');

  // 5. Salary Components
  const componentData = [
    { code: 'BASIC', name: 'Basic Salary', type: 'EARNING', isTaxable: true },
    { code: 'HRA', name: 'House Rent Allowance', type: 'EARNING', isTaxable: true },
    { code: 'CONV', name: 'Conveyance Allowance', type: 'EARNING', isTaxable: true },
    { code: 'SPALLOW', name: 'Special Allowance', type: 'EARNING', isTaxable: true },
    { code: 'PF_DED', name: 'Provident Fund Deduction', type: 'STATUTORY', isTaxable: false },
    { code: 'ESI_DED', name: 'ESI Deduction', type: 'STATUTORY', isTaxable: false },
  ];

  for (const comp of componentData) {
    await prisma.salaryComponent.upsert({
      where: { organizationId_code: { organizationId, code: comp.code } },
      update: {},
      create: { ...comp, organizationId },
    });
  }
  console.log('✅ Salary Components seeded (Earnings & Statutory Deductions)');

  // 6. Sample Employees
  const employeeData = [
    {
      employeeCode: 'EMP001',
      firstName: 'Alice',
      lastName: 'Baker',
      email: 'alice.baker@cakescandles.com',
      phone: '+919876543220',
      assignedBranchId: factoryId,
      departmentId: departments['PROD']?.id,
      designationId: designations['MBK']?.id,
      employmentType: 'FULL_TIME' as const,
      status: 'ACTIVE' as const,
      dateOfJoining: new Date('2024-01-15'),
      bankAccountNo: '123456789012',
      bankIfscCode: 'SBIN0001234',
    },
    {
      employeeCode: 'EMP002',
      firstName: 'Bob',
      lastName: 'Cashier',
      email: 'bob.cashier@cakescandles.com',
      phone: '+919876543221',
      assignedBranchId: retailId,
      departmentId: departments['OPS']?.id,
      designationId: designations['CSH']?.id,
      employmentType: 'FULL_TIME' as const,
      status: 'ACTIVE' as const,
      dateOfJoining: new Date('2024-02-01'),
      bankAccountNo: '987654321098',
      bankIfscCode: 'HDFC0004321',
    },
    {
      employeeCode: 'EMP003',
      firstName: 'Charlie',
      lastName: 'Driver',
      email: 'charlie.driver@cakescandles.com',
      phone: '+919876543222',
      assignedBranchId: factoryId,
      departmentId: departments['LOG']?.id,
      designationId: designations['DRV']?.id,
      employmentType: 'CONTRACT' as const,
      status: 'ACTIVE' as const,
      dateOfJoining: new Date('2024-03-10'),
      bankAccountNo: '555444333222',
      bankIfscCode: 'ICIC0005555',
    },
  ];

  for (const emp of employeeData) {
    const employee = await prisma.employee.upsert({
      where: { organizationId_employeeCode: { organizationId, employeeCode: emp.employeeCode } },
      update: {},
      create: { ...emp, organizationId },
    });

    // Seed sample salary structure for active employees
    const existingStructure = await prisma.salaryStructure.findFirst({
      where: { employeeId: employee.id, isActive: true },
    });

    if (!existingStructure) {
      await prisma.salaryStructure.create({
        data: {
          employeeId: employee.id,
          effectiveDate: new Date('2024-01-01'),
          baseSalary: 25000,
          hra: 10000,
          conveyance: 3000,
          specialAllowance: 5000,
          pfContribution: 1800,
          esiContribution: 325,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Sample Employees & Salary Structures seeded (3 employees)');
}
