import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { FinanceModule } from '../finance/finance.module';

// Controllers
import { EmployeeController } from './controllers/employee.controller';
import { DepartmentController } from './controllers/department.controller';
import { DesignationController } from './controllers/designation.controller';
import { ShiftController } from './controllers/shift.controller';
import { AttendanceController } from './controllers/attendance.controller';
import { LeaveController } from './controllers/leave.controller';
import { SalaryController } from './controllers/salary.controller';
import { PayrollController } from './controllers/payroll.controller';
import { PayslipController } from './controllers/payslip.controller';

// Services
import { EmployeeService } from './services/employee.service';
import { DepartmentService } from './services/department.service';
import { DesignationService } from './services/designation.service';
import { ShiftService } from './services/shift.service';
import { AttendanceService } from './services/attendance.service';
import {
  LeaveService,
  LeaveTypeService,
  LeavePolicyService,
  LeaveAllocationService,
} from './services/leave.service';
import {
  SalaryComponentService,
  SalaryStructureService,
} from './services/salary.service';
import { PayrollPeriodService } from './services/payroll-period.service';
import { PayrollCalculationEngine } from './services/payroll-calculation.engine';
import { PayrollRunService } from './services/payroll-run.service';
import { PayslipService } from './services/payslip.service';

@Module({
  imports: [ConfigModule, FinanceModule],
  controllers: [
    EmployeeController,
    DepartmentController,
    DesignationController,
    ShiftController,
    AttendanceController,
    LeaveController,
    SalaryController,
    PayrollController,
    PayslipController,
  ],
  providers: [
    EmployeeService,
    DepartmentService,
    DesignationService,
    ShiftService,
    AttendanceService,
    LeaveService,
    LeaveTypeService,
    LeavePolicyService,
    LeaveAllocationService,
    SalaryComponentService,
    SalaryStructureService,
    PayrollPeriodService,
    PayrollCalculationEngine,
    PayrollRunService,
    PayslipService,
  ],
  exports: [
    EmployeeService,
    DepartmentService,
    DesignationService,
    ShiftService,
    AttendanceService,
    LeaveService,
    LeaveTypeService,
    LeavePolicyService,
    LeaveAllocationService,
    SalaryComponentService,
    SalaryStructureService,
    PayrollPeriodService,
    PayrollCalculationEngine,
    PayrollRunService,
    PayslipService,
  ],
})
export class HrModule {}
