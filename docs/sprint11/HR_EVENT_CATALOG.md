# 📢 SPRINT 11 — HR & PAYROLL OUTBOX EVENT CATALOG

> **Integration Architecture**: Uses existing S01 Outbox Pattern (`OutboxEvent`)  

---

## 1. Event Catalog Summary

| Event Name | Trigger Condition | Payload Key | Consumers |
| :--- | :--- | :--- | :--- |
| `hr.employee.created` | New employee onboarded | `employeeId` | CRM, POS, AuditLog |
| `hr.attendance.recorded` | Biometric check-in/out | `attendanceLogId` | Roster Engine |
| `hr.attendance.corrected` | Correction approved | `correctionRequestId` | Payroll Engine |
| `hr.leave.approved` | Manager approves leave | `leaveRequestId` | Shift Roster, Payroll Engine |
| `hr.payroll.calculated` | Payroll run calculated | `payrollRunId` | HR Review Dashboard |
| `hr.payroll.approved` | Payroll run approved | `payrollRunId` | Approval Engine |
| `hr.payroll.paid` | Payroll run status = PAID | `payrollRunId` | **Finance Domain** (Expense Posting) |

---

## 2. Event Payload Schemes

### `hr.payroll.paid`

```json
{
  "eventId": "evt-77189283-990a",
  "eventType": "hr.payroll.paid",
  "aggregateId": "run-2026-09-01",
  "payload": {
    "payrollRunId": "550e8400-e29b-41d4-a716-446655440000",
    "organizationId": "org-cakes-candles",
    "year": 2026,
    "month": 9,
    "totalNetPay": 485000.00,
    "financeExpenseCategory": "SALARIES_AND_WAGES",
    "paidAt": "2026-09-30T18:00:00.000Z"
  },
  "occurredAt": "2026-09-30T18:00:00.000Z"
}
```
