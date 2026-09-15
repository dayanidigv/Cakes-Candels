# SPRINT 12.4 — EXPENSE DOMAIN MODEL SPECIFICATION

## 1. Overview & Core Philosophy

The Expense Subledger in Cakes & Candles ERP manages operational overheads, store utilities, factory consumables, repair & maintenance, petty cash disbursements, and vendor-billed operational expenses.

### Authoritative Architecture Invariant
The Expense domain is strictly an **operational subledger**. It records business facts, approvals, attachments, and payment details, but **does NOT maintain an independent accounting ledger**.

```
Operational Expense Flow:
┌─────────────────────────────────────────────────────────────┐
│                       Expense Entity                        │
│   (Draft -> Submitted -> Approved -> Posted / Cancelled)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ Atomic Posting
┌─────────────────────────────────────────────────────────────┐
│                    FinancePostingEngine                     │
│    (Period check, active COA validation, balance check)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        General Ledger                       │
│           JournalEntry + JournalEntryLine (GL Truth)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Entities & Schema Blueprint

### 2.1 Enum Definitions

```prisma
enum ExpenseStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
  POSTED
  CANCELLED
}

enum ExpensePaymentType {
  CASH
  PETTY_CASH
  BANK_TRANSFER
  UPI
  CREDIT_CARD
  PAYABLE_VENDOR
}

enum TaxType {
  NONE
  GST_5
  GST_12
  GST_18
  GST_28
}
```

### 2.2 Expense Model (`model Expense`)

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | `@id @default(uuid())` | Primary key UUID |
| `organizationId` | String | `organizationId` | Multi-tenant root isolation |
| `expenseNumber` | String | `@unique` | Human-readable sequence (e.g. `EXP-202604-00001`) |
| `branchId` | String | Foreign Key | Branch or factory where expense was incurred |
| `expenseAccountId` | String | Foreign Key | Debit COA Account (`type: EXPENSE`, `isPostable: true`) |
| `paymentAccountId` | String | Foreign Key | Credit COA Account (`type: ASSET / LIABILITY`) |
| `vendorId` | String? | Optional FK | Optional vendor reference for external supplier bills |
| `status` | ExpenseStatus | `@default(DRAFT)` | Lifecycle status |
| `paymentType` | ExpensePaymentType | Required | Payment method used / scheduled |
| `expenseDate` | DateTime | Required | Incurred date (drives fiscal period resolution) |
| `dueDate` | DateTime? | Optional | Payment due date if credit purchase |
| `invoiceNumber` | String? | Optional | Vendor invoice / receipt number |
| `baseAmount` | Decimal(15,2) | Required | Net expense before tax |
| `taxType` | TaxType | `@default(NONE)` | GST tax rate category |
| `taxAmount` | Decimal(15,2) | `@default(0.00)` | Computed or verified GST tax amount |
| `totalAmount` | Decimal(15,2) | Required | Gross total (`baseAmount + taxAmount`) |
| `currency` | String | `@default("INR")` | Transaction currency |
| `description` | String | Required | Business justification / memo |
| `attachmentUrl` | String? | Optional | Receipt / invoice scan artifact |
| `idempotencyKey` | String? | `@unique` | Client-supplied duplicate protection key |
| `journalEntryId` | String? | `@unique` | 1-to-1 link to authoritative GL `JournalEntry` |
| `submittedById` | String? | Optional | User ID who submitted for approval |
| `submittedAt` | DateTime? | Optional | Submission timestamp |
| `approvedById` | String? | Optional | Auditor / Manager who approved |
| `approvedAt` | DateTime? | Optional | Approval timestamp |
| `rejectionReason` | String? | Optional | Rejection justification memo |
| `postedById` | String? | Optional | Finance user who triggered GL posting |
| `postedAt` | DateTime? | Optional | GL posting timestamp |
| `cancelledById` | String? | Optional | User who cancelled |
| `cancelledAt` | DateTime? | Optional | Cancellation timestamp |
| `cancelReason` | String? | Optional | Reason for cancellation |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Record update timestamp |

---

## 3. Expense Category Configuration (`model ExpenseCategoryMapping`)

Allows organization administrators to configure standard operational expense categories mapped to active Chart of Accounts leaf accounts and default tax rates.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | UUID Primary Key |
| `organizationId` | String | Multi-tenant root isolation |
| `name` | String | Category display name (e.g. `Rent & Facilities`, `Store Utilities`) |
| `code` | String | Unique code (e.g. `RENT`, `UTILITIES`, `DIESEL`) |
| `defaultExpenseAccountId` | String | Default COA Account ID |
| `defaultTaxType` | TaxType | Default GST tax rate |
| `requiresApproval` | Boolean | Whether expenses > threshold require manager approval |
| `approvalThreshold` | Decimal(15,2) | Auto-approval ceiling |
| `isActive` | Boolean | Active status |

---

## 4. Multi-Tenant & Referential Integrity Invariants

1. **Organization Isolation**: Every `Expense` belongs to exactly one `Organization`. Cross-tenant queries are blocked.
2. **Branch Attribution**: `branchId` must belong to the same `organizationId`.
3. **COA Relationship Integrity**:
   - `expenseAccountId` must belong to `organizationId`, have `type = EXPENSE`, `isActive = true`, `isPostable = true`.
   - `paymentAccountId` must belong to `organizationId`, have `type IN (ASSET, LIABILITY)`, `isActive = true`, `isPostable = true`.
4. **Duplicate Invoice Protection**: Unique composite index on `[organizationId, vendorId, invoiceNumber]` prevents accidental double-entry of supplier invoices.
