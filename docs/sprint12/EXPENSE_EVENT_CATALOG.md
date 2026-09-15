# SPRINT 12.4 — EXPENSE EVENT CATALOG

## 1. Event Definitions

All events are emitted transactionally using the `OutboxEvent` table and published asynchronously for downstream consumers (audit log, notifications, BI pipelines).

| Event Name | Trigger | Payload Schema |
| :--- | :--- | :--- |
| `finance.expense.created` | When an expense draft is created | `{ expenseId, expenseNumber, organizationId, branchId, baseAmount, totalAmount, expenseAccountId, createdById }` |
| `finance.expense.submitted` | When an expense is submitted for review | `{ expenseId, expenseNumber, organizationId, branchId, totalAmount, submittedById, submittedAt }` |
| `finance.expense.approved` | When an expense is approved by an auditor | `{ expenseId, expenseNumber, organizationId, totalAmount, approvedById, approvedAt }` |
| `finance.expense.rejected` | When an expense is rejected | `{ expenseId, expenseNumber, organizationId, rejectedById, rejectionReason }` |
| `finance.expense.posted` | When an approved expense is posted to GL | `{ expenseId, expenseNumber, organizationId, journalEntryId, entryNumber, totalAmount, postedById, postedAt }` |
| `finance.expense.cancelled` | When an expense is cancelled or reversed | `{ expenseId, expenseNumber, organizationId, journalEntryId, reversalJournalId, cancelledById, cancelReason }` |

---

## 2. Event Reliability & Invariants

1. **Transactional Integrity**: Every event is written in the exact same database transaction as the expense status change. If the database transaction aborts, the event is rolled back.
2. **Idempotent Consumers**: Events carry unique `eventId` and `expenseId` to allow consumers to deduplicate.
3. **Correlation**: `finance.expense.posted` explicitly carries `journalEntryId` and `entryNumber` to maintain direct traceability to the General Ledger.
