# 🏛️ FINANCE DOMAIN MODEL SPECIFICATION
## Comprehensive Data Model & Chart of Accounts Blueprint

> **Sprint**: Sprint 12 — Finance & Accounting  
> **Status**: FROZEN (Phase 12.1)  
> **Classification**: Database & Domain Schema Contract  

---

## 1. Domain Model Entities & Enums

### 1.1 Enumerations

```prisma
enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

enum AccountCategory {
  // Assets
  CASH_AND_EQUIVALENTS
  BANK
  ACCOUNTS_RECEIVABLE
  INVENTORY_RAW_MATERIALS
  INVENTORY_WIP
  INVENTORY_FINISHED_GOODS
  FIXED_ASSETS
  ACCUMULATED_DEPRECIATION
  OTHER_CURRENT_ASSETS
  
  // Liabilities
  ACCOUNTS_PAYABLE
  GRN_CLEARING
  PAYROLL_PAYABLE
  STATUTORY_PAYABLE
  TAX_PAYABLE
  SHORT_TERM_LOANS
  OTHER_CURRENT_LIABILITIES
  
  // Equity
  OWNERS_EQUITY
  RETAINED_EARNINGS
  CURRENT_YEAR_EARNINGS
  
  // Revenue
  SALES_REVENUE_RETAIL
  SALES_REVENUE_CUSTOM
  SALES_RETURNS_ALLOWANCES
  OTHER_INCOME
  
  // Expense
  COST_OF_GOODS_SOLD
  SALARY_AND_WAGES
  OPERATING_EXPENSE_RENT
  OPERATING_EXPENSE_UTILITIES
  OPERATING_EXPENSE_MAINTENANCE
  OPERATING_EXPENSE_LOGISTICS
  INVENTORY_WASTAGE
  DEPRECIATION_EXPENSE
  FINANCE_CHARGES
  MISCELLANEOUS_EXPENSE
}

enum BalanceType {
  DEBIT
  CREDIT
}

enum FiscalPeriodStatus {
  OPEN
  CLOSED
  LOCKED
}

enum JournalEntryStatus {
  DRAFT
  POSTED
  REVERSED
}

enum BillStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  PAID
  PARTIALLY_PAID
  CANCELLED
}

enum ExpenseStatus {
  DRAFT
  SUBMITTED
  APPROVED
  POSTED
  REJECTED
}
```

---

### 1.2 Entity Specifications

#### 1. Account (`account`)
Represents an individual ledger account in the Chart of Accounts.
```prisma
model Account {
  id             String          @id @default(uuid()) @db.Uuid
  organizationId String          @db.Uuid
  organization   Organization    @relation(fields: [organizationId], references: [id])
  
  code           String          // Unique code: e.g. "11100"
  name           String          // e.g. "Main Cash Till"
  type           AccountType
  category       AccountCategory
  normalBalance  BalanceType     // DEBIT or CREDIT
  
  parentId       String?         @db.Uuid
  parent         Account?        @relation("AccountHierarchy", fields: [parentId], references: [id])
  children       Account[]       @relation("AccountHierarchy")
  
  isPostable     Boolean         @default(true) // Leaf accounts are postable
  isSystem       Boolean         @default(false) // Core system accounts cannot be deleted
  isActive       Boolean         @default(true)
  
  journalLines   JournalEntryLine[]
  
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  deletedAt      DateTime?
  deletedBy      String?         @db.Uuid

  @@unique([organizationId, code])
  @@index([organizationId, type])
  @@index([organizationId, category])
  @@map("account")
}
```

#### 2. FiscalYear & FiscalPeriod (`fiscal_year`, `fiscal_period`)
Manages accounting calendars and strict monthly closing locks.
```prisma
model FiscalYear {
  id             String         @id @default(uuid()) @db.Uuid
  organizationId String         @db.Uuid
  organization   Organization   @relation(fields: [organizationId], references: [id])
  
  name           String         // e.g. "FY 2026-2027"
  startDate      DateTime       @db.Date
  endDate        DateTime       @db.Date
  isClosed       Boolean        @default(false)
  
  periods        FiscalPeriod[]
  
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@unique([organizationId, name])
  @@map("fiscal_year")
}

model FiscalPeriod {
  id             String             @id @default(uuid()) @db.Uuid
  fiscalYearId   String             @db.Uuid
  fiscalYear     FiscalYear         @relation(fields: [fiscalYearId], references: [id])
  
  periodNumber   Int                // 1 to 12
  name           String             // e.g. "April 2026"
  startDate      DateTime           @db.Date
  endDate        DateTime           @db.Date
  status         FiscalPeriodStatus @default(OPEN)
  
  closedAt       DateTime?
  closedBy       String?            @db.Uuid
  
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  @@unique([fiscalYearId, periodNumber])
  @@map("fiscal_period")
}
```

#### 3. JournalEntry & JournalEntryLine (`journal_entry`, `journal_entry_line`)
The authoritative General Ledger recording double-entry financial transactions.
```prisma
model JournalEntry {
  id               String             @id @default(uuid()) @db.Uuid
  organizationId   String             @db.Uuid
  organization     Organization       @relation(fields: [organizationId], references: [id])
  
  entryNumber      String             // Unique: e.g. "JE-202604-0001"
  postingDate      DateTime           @db.Date
  documentDate     DateTime           @default(now())
  
  sourceModule     String             // "PROCUREMENT", "SALES", "PAYROLL", "EXPENSE", "POS", "MANUAL"
  sourceEntityType String             // "PURCHASE_ORDER", "GRN", "SALES_ORDER", "PAYROLL_RUN", "EXPENSE"
  sourceEntityId   String             @db.Uuid
  sourceReference  String?            // External/human readable ref: e.g. "RUN-202605-01"
  
  status           JournalEntryStatus @default(POSTED)
  description      String
  
  totalDebit       Decimal            @db.Decimal(14, 2)
  totalCredit      Decimal            @db.Decimal(14, 2)
  
  reversalEntryId  String?            @unique @db.Uuid
  reversedByEntry  JournalEntry?      @relation("JournalReversal", fields: [reversalEntryId], references: [id])
  reversalOf       JournalEntry?      @relation("JournalReversal")
  
  lines            JournalEntryLine[]
  
  createdById      String             @db.Uuid
  postedById       String?            @db.Uuid
  postedAt         DateTime           @default(now())
  
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  @@unique([organizationId, entryNumber])
  @@unique([organizationId, sourceModule, sourceEntityId], name: "org_source_unique")
  @@index([organizationId, postingDate])
  @@index([organizationId, status])
  @@map("journal_entry")
}

model JournalEntryLine {
  id             String       @id @default(uuid()) @db.Uuid
  journalEntryId String       @db.Uuid
  journalEntry   JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  
  accountId      String       @db.Uuid
  account        Account      @relation(fields: [accountId], references: [id])
  
  branchId       String?      @db.Uuid
  branch         Branch?      @relation(fields: [branchId], references: [id])
  
  debitAmount    Decimal      @default(0) @db.Decimal(14, 2)
  creditAmount   Decimal      @default(0) @db.Decimal(14, 2)
  
  description    String?
  metadata       Json?        // Additional dimensions (cost center, tax code, etc.)

  @@index([journalEntryId])
  @@index([accountId])
  @@index([branchId])
  @@map("journal_entry_line")
}
```

#### 4. SupplierBill & SupplierPayment (`supplier_bill`, `supplier_payment`)
Accounts Payable operational subledger.
```prisma
model SupplierBill {
  id             String            @id @default(uuid()) @db.Uuid
  organizationId String            @db.Uuid
  organization   Organization      @relation(fields: [organizationId], references: [id])
  
  billNumber     String            // e.g. "BILL-2026-0001"
  supplierId     String            @db.Uuid
  supplier       Supplier          @relation(fields: [supplierId], references: [id])
  
  poId           String?           @db.Uuid
  po             PurchaseOrder?    @relation(fields: [poId], references: [id])
  grnId          String?           @db.Uuid
  grn            GoodsReceiptNote? @relation(fields: [grnId], references: [id])
  
  billDate       DateTime          @db.Date
  dueDate        DateTime          @db.Date
  status         BillStatus        @default(DRAFT)
  
  subtotal       Decimal           @db.Decimal(12, 2)
  taxAmount      Decimal           @default(0) @db.Decimal(12, 2)
  totalAmount    Decimal           @db.Decimal(12, 2)
  paidAmount     Decimal           @default(0) @db.Decimal(12, 2)
  
  journalEntryId String?           @unique @db.Uuid
  
  payments       SupplierPayment[]
  
  createdById    String            @db.Uuid
  approvedById   String?           @db.Uuid
  approvedAt     DateTime?
  
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@unique([organizationId, billNumber])
  @@index([supplierId])
  @@index([status])
  @@map("supplier_bill")
}

model SupplierPayment {
  id             String        @id @default(uuid()) @db.Uuid
  organizationId String        @db.Uuid
  organization   Organization  @relation(fields: [organizationId], references: [id])
  
  paymentNumber  String        // e.g. "PAY-2026-0001"
  supplierId     String        @db.Uuid
  supplier       Supplier      @relation(fields: [supplierId], references: [id])
  
  billId         String        @db.Uuid
  bill           SupplierBill  @relation(fields: [billId], references: [id])
  
  amount         Decimal       @db.Decimal(12, 2)
  paymentMethod  String        // "BANK_TRANSFER", "NEFT", "RTGS", "CHEQUE", "CASH"
  reference      String?       // UTR number / Cheque number
  paymentDate    DateTime      @db.Date
  
  journalEntryId String?       @unique @db.Uuid
  
  createdById    String        @db.Uuid
  createdAt      DateTime      @default(now())

  @@unique([organizationId, paymentNumber])
  @@index([supplierId])
  @@index([billId])
  @@map("supplier_payment")
}
```

#### 5. Expense (`expense`)
Formalized operational expense tracking with automated GL posting.
```prisma
model Expense {
  id              String        @id @default(uuid()) @db.Uuid
  organizationId  String        @db.Uuid
  organization    Organization  @relation(fields: [organizationId], references: [id])
  
  branchId        String?       @db.Uuid
  branch          Branch?       @relation(fields: [branchId], references: [id])
  
  category        String        // "RENT", "ELECTRICITY", "DIESEL", "WATER", "PETTY_CASH", "MAINTENANCE", "SALARY"
  amount          Decimal       @db.Decimal(12, 2)
  description     String?
  receiptUrl      String?
  status          ExpenseStatus @default(APPROVED)
  
  journalEntryId  String?       @unique @db.Uuid
  
  sourceModule    String?       // e.g. "HR_PAYROLL" for salary disbursements
  sourceEntityId  String?       @db.Uuid
  
  createdById     String        @db.Uuid
  approvedById    String?       @db.Uuid
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([organizationId, category])
  @@index([branchId])
  @@map("expense")
}
```

---

## 2. Standard Bakery Chart of Accounts (Initial Seeding Blueprint)

| Code | Account Name | Type | Category | Normal Balance | Postable | System Protected |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **10000** | **ASSETS** | `ASSET` | `CASH_AND_EQUIVALENTS` | `DEBIT` | ❌ No | 🔒 Yes |
| 11100 | Main Petty Cash / POS Till | `ASSET` | `CASH_AND_EQUIVALENTS` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 11200 | Bank Operating Account (HDFC/ICICI) | `ASSET` | `BANK` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 11300 | Payment Gateway Clearing (Razorpay) | `ASSET` | `CASH_AND_EQUIVALENTS` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 12000 | Accounts Receivable | `ASSET` | `ACCOUNTS_RECEIVABLE` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 13100 | Raw Materials Inventory | `ASSET` | `INVENTORY_RAW_MATERIALS` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 13200 | Work In Progress (WIP) | `ASSET` | `INVENTORY_WIP` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 13300 | Finished Goods Inventory | `ASSET` | `INVENTORY_FINISHED_GOODS` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 14100 | Input CGST Tax Credit | `ASSET` | `OTHER_CURRENT_ASSETS` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 14200 | Input SGST Tax Credit | `ASSET` | `OTHER_CURRENT_ASSETS` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 14300 | Input IGST Tax Credit | `ASSET` | `OTHER_CURRENT_ASSETS` | `DEBIT` | ✅ Yes | 🔒 Yes |
| **20000** | **LIABILITIES** | `LIABILITY` | `ACCOUNTS_PAYABLE` | `CREDIT` | ❌ No | 🔒 Yes |
| 21000 | Accounts Payable (Suppliers) | `LIABILITY` | `ACCOUNTS_PAYABLE` | `CREDIT` | ✅ Yes | 🔒 Yes |
| 21100 | Statutory Payables (PF / ESI / PT) | `LIABILITY` | `STATUTORY_PAYABLE` | `CREDIT` | ✅ Yes | 🔒 Yes |
| 21200 | Employee Payroll Payable | `LIABILITY` | `PAYROLL_PAYABLE` | `CREDIT` | ✅ Yes | 🔒 Yes |
| 21300 | GRN Clearing / Unbilled Payables | `LIABILITY` | `GRN_CLEARING` | `CREDIT` | ✅ Yes | 🔒 Yes |
| 22100 | Output CGST Payable | `LIABILITY` | `TAX_PAYABLE` | `CREDIT` | ✅ Yes | 🔒 Yes |
| 22200 | Output SGST Payable | `LIABILITY` | `TAX_PAYABLE` | `CREDIT` | ✅ Yes | 🔒 Yes |
| 22300 | Output IGST Payable | `LIABILITY` | `TAX_PAYABLE` | `CREDIT` | ✅ Yes | 🔒 Yes |
| **30000** | **EQUITY** | `EQUITY` | `OWNERS_EQUITY` | `CREDIT` | ❌ No | 🔒 Yes |
| 31000 | Owner's Capital / Share Capital | `EQUITY` | `OWNERS_EQUITY` | `CREDIT` | ✅ Yes | 🔒 Yes |
| 32000 | Retained Earnings | `EQUITY` | `RETAINED_EARNINGS` | `CREDIT` | ✅ Yes | 🔒 Yes |
| **40000** | **REVENUE** | `REVENUE` | `SALES_REVENUE_RETAIL` | `CREDIT` | ❌ No | 🔒 Yes |
| 41000 | Sales Revenue — Retail Storefront | `REVENUE` | `SALES_REVENUE_RETAIL` | `CREDIT` | ✅ Yes | 🔒 Yes |
| 42000 | Sales Revenue — Custom Cakes | `REVENUE` | `SALES_REVENUE_CUSTOM` | `CREDIT` | ✅ Yes | 🔒 Yes |
| 49000 | Sales Returns & Allowances | `REVENUE` | `SALES_RETURNS_ALLOWANCES` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 49500 | POS Cash Overage Income | `REVENUE` | `OTHER_INCOME` | `CREDIT` | ✅ Yes | 🔒 Yes |
| **50000** | **EXPENSES** | `EXPENSE` | `COST_OF_GOODS_SOLD` | `DEBIT` | ❌ No | 🔒 Yes |
| 50100 | Cost of Goods Sold (COGS) | `EXPENSE` | `COST_OF_GOODS_SOLD` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 51000 | Salaries & Wages Expense | `EXPENSE` | `SALARY_AND_WAGES` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 52100 | Rent Expense | `EXPENSE` | `OPERATING_EXPENSE_RENT` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 52200 | Electricity & Utilities Expense | `EXPENSE` | `OPERATING_EXPENSE_UTILITIES` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 52300 | Diesel & Generator Fuel Expense | `EXPENSE` | `OPERATING_EXPENSE_UTILITIES` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 52400 | Water Supply Expense | `EXPENSE` | `OPERATING_EXPENSE_UTILITIES` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 52500 | Internet & Telecom Expense | `EXPENSE` | `OPERATING_EXPENSE_UTILITIES` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 52600 | Repair & Maintenance Expense | `EXPENSE` | `OPERATING_EXPENSE_MAINTENANCE` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 53000 | Inventory Wastage & Spoilage Expense | `EXPENSE` | `INVENTORY_WASTAGE` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 59000 | POS Cash Shortage Expense | `EXPENSE` | `MISCELLANEOUS_EXPENSE` | `DEBIT` | ✅ Yes | 🔒 Yes |
| 59100 | Payment Gateway Processing Fees | `EXPENSE` | `FINANCE_CHARGES` | `DEBIT` | ✅ Yes | 🔒 Yes |
