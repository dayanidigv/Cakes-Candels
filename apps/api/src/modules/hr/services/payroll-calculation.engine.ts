import { Injectable } from '@nestjs/common';

export interface EmployeeCalculationInput {
  employeeId: string;
  employeeCode: string;
  workingDaysInPeriod: number;
  presentDays: number;
  approvedLeaveDays: number;
  overtimeHours: number;
  salary: {
    baseSalary: number;
    hra: number;
    conveyance: number;
    specialAllowance: number;
    pfContribution?: number;
    esiContribution?: number;
  };
}

export interface PayrollComponentDetail {
  componentCode: string;
  componentName: string;
  type: 'EARNING' | 'DEDUCTION';
  amount: number;
}

export interface CalculatedEmployeePayroll {
  employeeId: string;
  workingDays: number;
  presentDays: number;
  lossOfPayDays: number;
  overtimeHours: number;
  basePay: number;
  allowances: number;
  grossPay: number;
  pfDeduction: number;
  esiDeduction: number;
  taxDeduction: number; // Professional Tax
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  details: PayrollComponentDetail[];
}

@Injectable()
export class PayrollCalculationEngine {
  /**
   * Helper to round monetary amounts deterministically to 2 decimal places.
   * Avoids floating-point artifacts.
   */
  private roundMoney(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  /**
   * Computes statutory Professional Tax slab per Indian compliance specifications:
   * - Gross <= 15000 -> 0
   * - 15001 to 20000 -> 150
   * - > 20000 -> 200
   */
  private computeProfessionalTax(grossPay: number): number {
    if (grossPay <= 15000) return 0;
    if (grossPay <= 20000) return 150;
    return 200;
  }

  /**
   * Authoritative calculation implementation of PAYROLL_ENGINE_SPEC.md formulas.
   */
  calculate(input: EmployeeCalculationInput): CalculatedEmployeePayroll {
    const {
      employeeId,
      workingDaysInPeriod,
      presentDays,
      approvedLeaveDays,
      overtimeHours,
      salary,
    } = input;

    const payableDays = Math.min(workingDaysInPeriod, presentDays + approvedLeaveDays);
    const lossOfPayDays = Math.max(0, workingDaysInPeriod - payableDays);
    const effectiveWorkingDays = workingDaysInPeriod - lossOfPayDays;

    // 1. Earned Base Salary
    const earnedBase = workingDaysInPeriod > 0
      ? this.roundMoney((salary.baseSalary / workingDaysInPeriod) * effectiveWorkingDays)
      : 0;

    // 2. Prorated Allowances
    const earnedHra = workingDaysInPeriod > 0
      ? this.roundMoney((salary.hra / workingDaysInPeriod) * effectiveWorkingDays)
      : 0;

    const earnedConveyance = workingDaysInPeriod > 0
      ? this.roundMoney((salary.conveyance / workingDaysInPeriod) * effectiveWorkingDays)
      : 0;

    const earnedSpecialAllowance = workingDaysInPeriod > 0
      ? this.roundMoney((salary.specialAllowance / workingDaysInPeriod) * effectiveWorkingDays)
      : 0;

    const totalEarnedAllowances = this.roundMoney(earnedHra + earnedConveyance + earnedSpecialAllowance);

    // 3. Overtime Pay: OvertimeHours * (BaseSalary / (WorkingDaysInPeriod * 8) * 1.5)
    let overtimePay = 0;
    if (overtimeHours > 0 && workingDaysInPeriod > 0) {
      const hourlyBaseRate = salary.baseSalary / (workingDaysInPeriod * 8);
      const otHourlyRate = hourlyBaseRate * 1.5;
      overtimePay = this.roundMoney(overtimeHours * otHourlyRate);
    }

    // 4. Gross Pay = EarnedBase + EarnedAllowances + OvertimePay
    const grossPay = this.roundMoney(earnedBase + totalEarnedAllowances + overtimePay);

    // 5. Deductions
    // PF: min(EarnedBase, 15000) * 12%
    const pfWageBase = Math.min(earnedBase, 15000);
    const pfDeduction = this.roundMoney(pfWageBase * 0.12);

    // ESI: GrossPay * 0.75% if GrossPay <= 21000, else 0
    const esiDeduction = grossPay <= 21000
      ? this.roundMoney(grossPay * 0.0075)
      : 0;

    // Professional Tax
    const professionalTax = this.computeProfessionalTax(grossPay);

    const otherDeductions = 0;
    const totalDeductions = this.roundMoney(pfDeduction + esiDeduction + professionalTax + otherDeductions);

    // 6. Net Pay = max(0, GrossPay - TotalDeductions)
    const netPay = Math.max(0, this.roundMoney(grossPay - totalDeductions));

    // 7. Breakdown component snapshot details
    const details: PayrollComponentDetail[] = [
      { componentCode: 'BASIC', componentName: 'Basic Salary', type: 'EARNING', amount: earnedBase },
      { componentCode: 'HRA', componentName: 'House Rent Allowance', type: 'EARNING', amount: earnedHra },
      { componentCode: 'CONVEYANCE', componentName: 'Conveyance Allowance', type: 'EARNING', amount: earnedConveyance },
      { componentCode: 'SPECIAL_ALLOWANCE', componentName: 'Special Allowance', type: 'EARNING', amount: earnedSpecialAllowance },
    ];

    if (overtimePay > 0) {
      details.push({
        componentCode: 'OVERTIME',
        componentName: 'Overtime Wages',
        type: 'EARNING',
        amount: overtimePay,
      });
    }

    if (pfDeduction > 0) {
      details.push({
        componentCode: 'PF',
        componentName: 'Provident Fund (Employee)',
        type: 'DEDUCTION',
        amount: pfDeduction,
      });
    }

    if (esiDeduction > 0) {
      details.push({
        componentCode: 'ESI',
        componentName: 'ESI (Employee)',
        type: 'DEDUCTION',
        amount: esiDeduction,
      });
    }

    if (professionalTax > 0) {
      details.push({
        componentCode: 'PT',
        componentName: 'Professional Tax',
        type: 'DEDUCTION',
        amount: professionalTax,
      });
    }

    return {
      employeeId,
      workingDays: workingDaysInPeriod,
      presentDays,
      lossOfPayDays,
      overtimeHours,
      basePay: earnedBase,
      allowances: totalEarnedAllowances,
      grossPay,
      pfDeduction,
      esiDeduction,
      taxDeduction: professionalTax,
      otherDeductions,
      totalDeductions,
      netPay,
      details,
    };
  }
}
