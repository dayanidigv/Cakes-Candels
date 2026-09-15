# SPRINT 12.4 — EXPENSE STATE MACHINE & WORKFLOW SPECIFICATION

## 1. Expense Lifecycle State Machine

An expense moves through a strict, deterministic state machine governed by role authorization and financial posting guards.

```
                        ┌──────────────┐
                        │    DRAFT     │
                        └──────┬───────┘
                               │ submit()
                               ▼
                        ┌──────────────┐
             ┌──────────┤  SUBMITTED   ├──────────┐
             │          └──────┬───────┘          │
             │ reject()        │ approve()        │ cancel()
             ▼                 ▼                  ▼
      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
      │   REJECTED   │  │   APPROVED   │  │  CANCELLED   │
      └──────────────┘  └──────┬───────┘  └──────────────┘
                               │ postToGL()
                               ▼
                        ┌──────────────┐
                        │    POSTED    │
                        └──────┬───────┘
                               │ reverse()
                               ▼
                        ┌──────────────┐
                        │  CANCELLED   │
                        │ (GL Reversed)│
                        └──────────────┘
```

---

## 2. Transition Matrix & Guard Invariants

| From State | Action / Transition | To State | Allowed Roles | Guard Condition |
| :--- | :--- | :--- | :--- | :--- |
| `[None]` | `create()` | `DRAFT` | Branch Staff, Accountant, Store Manager | Valid accounts, positive amounts. |
| `DRAFT` | `submit()` | `SUBMITTED` | Expense Creator, Store Manager | Total amount $\ge 0$, valid date, required attachments if threshold exceeded. |
| `SUBMITTED` | `approve()` | `APPROVED` | Finance Manager, Branch Auditor, Super Admin | User must have approval permission. User cannot approve their own expense if segregation is required. |
| `SUBMITTED` | `reject()` | `REJECTED` | Finance Manager, Auditor | Non-empty `rejectionReason` required. |
| `REJECTED` | `editAndResubmit()` | `SUBMITTED` | Expense Creator | Updates fields and moves back to review. |
| `APPROVED` | `postToGL()` | `POSTED` | Accountant, Finance Manager, System | Period for `expenseDate` is `OPEN`. Accounts active & leaf. Atomic posting via `FinancePostingEngine`. |
| `DRAFT` / `SUBMITTED` / `APPROVED` | `cancel()` | `CANCELLED` | Expense Creator, Finance Manager | Expense not yet posted. |
| `POSTED` | `reverseAndCancel()` | `CANCELLED` | Finance Manager, Super Admin | Triggers `FinancePostingEngine` counter-journal reversal. Original GL entry marked `REVERSED`. |

---

## 3. Detailed Guard Logic & Failure Modes

### 3.1 Direct Transition Violation
- `DRAFT` cannot move directly to `POSTED` without explicit approval (unless policy designates auto-approval for petty amounts $\le \text{threshold}$).
- `REJECTED` cannot move directly to `APPROVED` without resubmission.

### 3.2 Immutability in POSTED State
Once an expense reaches `POSTED`:
- `baseAmount`, `taxAmount`, `totalAmount` CANNOT be edited.
- `expenseAccountId` and `paymentAccountId` CANNOT be edited.
- `branchId` and `expenseDate` CANNOT be edited.
- To correct a posted expense, the user must execute `reverseAndCancel()`, creating a reversing GL entry, and file a new corrected expense.

### 3.3 Concurrency & CAS Protection
- All transitions execute with optimistic locking or transactional Compare-And-Swap (`WHERE id = $1 AND status = 'APPROVED'`).
- 100 simultaneous calls to `postToGL()` will result in exactly **1 successful GL post**, with the remaining 99 recognizing the `POSTED` state.
