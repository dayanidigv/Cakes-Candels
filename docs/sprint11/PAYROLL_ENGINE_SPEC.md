# 🧮 SPRINT 11 — PAYROLL CALCULATION ENGINE SPECIFICATION

> **Module**: `PayrollCalculationEngine` (`apps/api/src/modules/hr/payroll/`)  
> **Status**: BACKEND-AUTHORITATIVE MATHEMATICAL SPECIFICATION  

---

## 1. Authoritative Calculation Formulas

The **Payroll Engine** executes all calculations on the backend inside PostgreSQL database transactions (`prisma.$transaction`).

### 1.1 Gross Earnings Formula

$$\text{GrossPay} = \text{EarnedBase} + \text{EarnedAllowances} + \text{OvertimePay} + \text{Bonus}$$

Where:
- $\text{EarnedBase} = \left( \frac{\text{BaseSalary}}{\text{WorkingDaysInPeriod}} \right) \times (\text{WorkingDaysInPeriod} - \text{LOPDays})$
- $\text{EarnedAllowances} = \left( \frac{\text{FixedAllowances}}{\text{WorkingDaysInPeriod}} \right) \times (\text{WorkingDaysInPeriod} - \text{LOPDays})$
- $\text{OvertimePay} = \text{OvertimeHours} \times \left( \frac{\text{BaseSalary}}{\text{WorkingDaysInPeriod} \times 8} \times 1.5 \right)$

---

### 1.2 Deductions Formula

$$\text{TotalDeductions} = \text{PFDeduction} + \text{ESIDeduction} + \text{ProfessionalTax} + \text{TDS} + \text{AdvanceRepayments}$$

Where:
- $\text{PFDeduction} = \min(\text{EarnedBase}, 15000) \times 12\%$
- $\text{ESIDeduction} = \begin{cases} \text{GrossPay} \times 0.75\% & \text{if } \text{GrossPay} \le 21000 \\ 0 & \text{otherwise} \end{cases}$
- $\text{ProfessionalTax} = \text{Statutory Slab}(\text{GrossPay})$

---

### 1.3 Net Payable Pay

$$\text{NetPay} = \text{GrossPay} - \text{TotalDeductions}$$

> **Invariant Constraint**: $\text{NetPay} \ge 0$. If deductions exceed gross earnings due to excessive advances, $\text{NetPay}$ is capped at 0 and the remaining unrecovered advance balance is rolled forward to subsequent periods.

---

## 2. Calculation Pipeline Lifecycle

```text
 ┌─────────────────────────────────────────────────────────────┐
 │ STEP 1: INITIALIZE PAYROLL RUN (Draft State)               │
 │ Verify idempotencyKey & Acquire Lock                       │
 └──────────────────────────────┬──────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────┐
 │ STEP 2: AGGREGATE ATTENDANCE & LEAVE (Cut-off Date)         │
 │ Fetch Present Days, LOP Days, OT Hours per Employee         │
 └──────────────────────────────┬──────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────┐
 │ STEP 3: EXECUTE MATHEMATICAL ENGINE                         │
 │ Compute GrossPay, Statutory Deductions, NetPay              │
 └──────────────────────────────┬──────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────┐
 │ STEP 4: GENERATE PAYROLL RUN ITEMS                          │
 │ Insert PayrollItem records in single DB Transaction         │
 └──────────────────────────────┬──────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────┐
 │ STEP 5: APPROVAL WORKFLOW & FINANCE POSTING                 │
 │ Submit to Approval Engine → Post Expense to Finance Domain  │
 └─────────────────────────────────────────────────────────────┘
```

---

## 3. Financial Integration with Finance Domain (S08)

Upon transitioning `PayrollRun.status` to `PAID`, the payroll service calls `FinanceService.postExpense()`:

```typescript
const expensePayload = {
  organizationId: payrollRun.organizationId,
  category: 'SALARIES_AND_WAGES',
  amount: payrollRun.totalNetPay,
  paymentMethod: 'BANK_TRANSFER',
  referenceNumber: payrollRun.runNumber,
  description: `Payroll Salary Disbursement for Period ${payrollPeriod.year}-${payrollPeriod.month}`,
};
```

This creates an immutable `Expense` entry in the **Finance Domain**, preserving single financial truth.
