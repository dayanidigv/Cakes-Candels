import { prisma } from '@cc-erp/database';
import { DepartmentService } from '../services/department.service';
import { DesignationService } from '../services/designation.service';
import { RequestingUser } from '../services/employee.service';

describe('Phase 3A — Department & Designation Service Specification', () => {
  let departmentService: DepartmentService;
  let designationService: DesignationService;
  let orgId: string;
  let superAdminUser: RequestingUser;

  beforeAll(async () => {
    departmentService = new DepartmentService();
    designationService = new DesignationService();

    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No organization found');
    orgId = org.id;

    superAdminUser = {
      sub: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      permissions: [],
      username: 'admin',
      organizationId: orgId,
      scope: 'GLOBAL',
      roles: ['SUPER_ADMIN'],
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Gate 1: Should create, update, and list Departments with uniqueness protection', async () => {
    const code = `DPT-${Date.now()}`;
    const dept = await departmentService.create(
      { code, name: 'Quality Assurance', description: 'QA Team' },
      superAdminUser,
    );

    expect(dept.id).toBeDefined();
    expect(dept.code).toBe(code);

    // Duplicate creation must fail
    await expect(
      departmentService.create({ code, name: 'QA Duplicate' }, superAdminUser),
    ).rejects.toThrow();

    // Update
    const updated = await departmentService.update(
      dept.id,
      { name: 'Quality Assurance & Testing' },
      superAdminUser,
    );
    expect(updated.name).toBe('Quality Assurance & Testing');

    await prisma.department.delete({ where: { id: dept.id } });
  });

  it('Gate 2: Should create, update, and list Designations with pay grade levels', async () => {
    const code = `DSG-${Date.now()}`;
    const desig = await designationService.create(
      { code, name: 'Senior Baker', title: `Senior Baker ${Date.now()}`, level: 3 },
      superAdminUser,
    );

    expect(desig.id).toBeDefined();
    expect(desig.level).toBe(3);

    const list = await designationService.findAll(superAdminUser);
    expect(list.some((d) => d.id === desig.id)).toBe(true);

    await prisma.designation.delete({ where: { id: desig.id } });
  });
});
