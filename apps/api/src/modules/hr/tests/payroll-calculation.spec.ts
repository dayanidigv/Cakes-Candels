import { PayrollCalculationEngine } from '../services/payroll-calculation.engine';

describe('Phase 3C — Payroll Formula Engine & Golden Scenario Specification', () => {
  let engine: PayrollCalculationEngine;

  beforeAll(() => {
    engine = new PayrollCalculationEngine();
  });

  it('Gate 1: GOLDEN SCENARIO — Authoritative Formula Compliance (PAYROLL_ENGINE_SPEC.md)', () => {
    // Exact Golden Input per Specification
    const input = {
      employeeId: '00000000-0000-0000-0000-000000000099',
      employeeCode: 'EMP-GOLDEN-01',
      workingDaysInPeriod: 30,
      presentDays: 26,
      approvedLeaveDays: 2,
      overtimeHours: 10,
      salary: {
        baseSalary: 30000.0,
        hra: 12000.0,
        conveyance: 3000.0,
        specialAllowance: 5000.0,
      },
    };

    const result = engine.calculate(input);

    // 1. Attendance / LOP
    expect(result.workingDays).toBe(30);
    expect(result.presentDays).toBe(26);
    expect(result.lossOfPayDays).toBe(2); // 30 - (26 + 2)

    // 2. Base Pay Earned: (30000 / 30) * 28 = 28,000.00
    expect(result.basePay).toBe(28000.0);

    // 3. Allowances Prorated: (20000 / 30) * 28 = 18,666.67
    expect(result.allowances).toBe(18666.67);

    // 4. Overtime Pay: 10 * (30000 / 240 * 1.5) = 10 * 187.50 = 1,875.00
    const otDetail = result.details.find((d) => d.componentCode === 'OVERTIME');
    expect(otDetail?.amount).toBe(1875.0);

    // 5. Gross Pay: 28000 + 18666.67 + 1875 = 48,541.67
    expect(result.grossPay).toBe(48541.67);

    // 6. Statutory Deductions
    // PF: min(28000, 15000) * 12% = 1800.00
    expect(result.pfDeduction).toBe(1800.0);

    // ESI: Gross > 21000 -> 0.00
    expect(result.esiDeduction).toBe(0.0);

    // Professional Tax: Gross > 20000 -> 200.00
    expect(result.taxDeduction).toBe(200.0);

    // Total Deductions: 1800 + 0 + 200 = 2,000.00
    expect(result.totalDeductions).toBe(2000.0);

    // 7. Net Pay: 48541.67 - 2000.00 = 46,541.67
    expect(result.netPay).toBe(46541.67);

    // 8. Invariant: NetPay >= 0
    expect(result.netPay).toBeGreaterThanOrEqual(0);
  });

  it('Gate 2: ESI Applicability — Should compute 0.75% when Gross <= 21,000', () => {
    const input = {
      employeeId: '00000000-0000-0000-0000-000000000098',
      employeeCode: 'EMP-LOW-INCOME',
      workingDaysInPeriod: 30,
      presentDays: 30,
      approvedLeaveDays: 0,
      overtimeHours: 0,
      salary: {
        baseSalary: 12000.0,
        hra: 4000.0,
        conveyance: 1000.0,
        specialAllowance: 1000.0, // Gross = 18,000
      },
    };

    const result = engine.calculate(input);
    expect(result.grossPay).toBe(18000.0);

    // ESI: 18000 * 0.0075 = 135.00
    expect(result.esiDeduction).toBe(135.0);

    // PT for 18000 is 150.00 (slab 15001 - 20000)
    expect(result.taxDeduction).toBe(150.0);

    // PF: 12000 * 0.12 = 1440.00
    expect(result.pfDeduction).toBe(1440.0);

    // Total Deductions: 1440 + 135 + 150 = 1725.00
    expect(result.totalDeductions).toBe(1725.0);

    // Net: 18000 - 1725 = 16,275.00
    expect(result.netPay).toBe(16275.0);
  });

  it('Gate 3: Determinism — Identical inputs MUST yield bit-for-bit identical calculation results', () => {
    const input = {
      employeeId: '00000000-0000-0000-0000-000000000097',
      employeeCode: 'EMP-DET-TEST',
      workingDaysInPeriod: 31,
      presentDays: 25,
      approvedLeaveDays: 3,
      overtimeHours: 5,
      salary: {
        baseSalary: 45000.0,
        hra: 18000.0,
        conveyance: 2000.0,
        specialAllowance: 5000.0,
      },
    };

    const run1 = engine.calculate(input);
    const run2 = engine.calculate(input);

    expect(run1).toEqual(run2);
    expect(run1.netPay).toBe(run2.netPay);
    expect(run1.grossPay).toBe(run2.grossPay);
  });
});
