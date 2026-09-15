# 📡 FINANCE EVENT CATALOG
## Canonical Transactional Outbox Events & Payload Contracts

> **Sprint**: Sprint 12 — Finance & Accounting  
> **Status**: FROZEN (Phase 12.1)  
> **Classification**: Event Contract Specification  

---

## 1. Event Publishing Architecture
All financial events MUST be published via the transactional **Outbox Pattern** inside the same database transaction as the financial ledger mutation.

```text
Database Transaction BEGIN
    ├── Insert / Update Financial Entities
    ├── Create JournalEntry & JournalEntryLines
    ├── Write OutboxEvent (status = 'PENDING')
    └── Write AuditLog
Database Transaction COMMIT
```

---

## 2. Event Catalog & Payload Schemas

### 2.1 `finance.account.created` / `finance.account.updated`
Published when an account in the Chart of Accounts is created or updated.
```json
{
  "eventId": "uuid",
  "type": "finance.account.created",
  "organizationId": "uuid",
  "timestamp": "2026-09-03T12:00:00.000Z",
  "payload": {
    "accountId": "uuid",
    "code": "11100",
    "name": "Main Cash Till",
    "type": "ASSET",
    "category": "CASH_AND_EQUIVALENTS",
    "normalBalance": "DEBIT",
    "isPostable": true,
    "isSystem": false
  }
}
```

### 2.2 `finance.period.closed` / `finance.period.reopened`
Published when a fiscal period status transitions.
```json
{
  "eventId": "uuid",
  "type": "finance.period.closed",
  "organizationId": "uuid",
  "timestamp": "2026-09-03T12:00:00.000Z",
  "payload": {
    "fiscalYearId": "uuid",
    "fiscalPeriodId": "uuid",
    "periodNumber": 1,
    "periodName": "April 2026",
    "closedBy": "uuid",
    "closedAt": "2026-09-03T12:00:00.000Z"
  }
}
```

### 2.3 `finance.journal.posted`
Published on every successful General Ledger posting.
```json
{
  "eventId": "uuid",
  "type": "finance.journal.posted",
  "organizationId": "uuid",
  "timestamp": "2026-09-03T12:00:00.000Z",
  "payload": {
    "journalEntryId": "uuid",
    "entryNumber": "JE-202604-0001",
    "postingDate": "2026-04-30",
    "sourceModule": "PAYROLL",
    "sourceEntityType": "PAYROLL_RUN",
    "sourceEntityId": "uuid",
    "totalDebit": 150000.00,
    "totalCredit": 150000.00,
    "lineCount": 3,
    "postedBy": "uuid"
  }
}
```

### 2.4 `finance.journal.reversed`
Published when a General Ledger entry is reversed.
```json
{
  "eventId": "uuid",
  "type": "finance.journal.reversed",
  "organizationId": "uuid",
  "timestamp": "2026-09-03T12:00:00.000Z",
  "payload": {
    "originalJournalEntryId": "uuid",
    "originalEntryNumber": "JE-202604-0001",
    "reversalJournalEntryId": "uuid",
    "reversalEntryNumber": "JE-202604-0002",
    "reason": "Correcting double-posting dispute",
    "reversedBy": "uuid"
  }
}
```

### 2.5 `finance.ap.bill.posted` / `finance.supplier.payment.posted`
Published for Accounts Payable invoice creation and payment settlement.
```json
{
  "eventId": "uuid",
  "type": "finance.ap.bill.posted",
  "organizationId": "uuid",
  "timestamp": "2026-09-03T12:00:00.000Z",
  "payload": {
    "billId": "uuid",
    "billNumber": "BILL-2026-0001",
    "supplierId": "uuid",
    "totalAmount": 45000.00,
    "taxAmount": 8100.00,
    "journalEntryId": "uuid"
  }
}
```

### 2.6 `finance.pos.settlement.posted`
Published when a POS cash register session is closed and approved.
```json
{
  "eventId": "uuid",
  "type": "finance.pos.settlement.posted",
  "organizationId": "uuid",
  "timestamp": "2026-09-03T12:00:00.000Z",
  "payload": {
    "registerId": "uuid",
    "branchId": "uuid",
    "closingBalance": 25400.00,
    "variance": -50.00,
    "journalEntryId": "uuid",
    "approvedBy": "uuid"
  }
}
```
