# SPRINT 12.4 — EXPENSE ACCOUNTING & POSTING RULES

## 1. Accounting Principles

All operational expenses must be recorded under standard double-entry accrual/cash accounting rules using the active Chart of Accounts.

### Key Rules:
1. **Expenses are Debited**: Increases in operational expense accounts (`type = EXPENSE`, `normalBalance = DEBIT`).
2. **Input GST is Debited (if applicable)**: Recoverable input tax is debited to the Input GST Asset account (`type = ASSET`, `normalBalance = DEBIT`).
3. **Payment/Payable is Credited**:
   - Cash / Bank paid immediately $\to$ Credit Cash/Bank Asset account (`normalBalance = DEBIT`).
   - Credit purchase from vendor $\to$ Credit Accounts Payable Liability account (`normalBalance = CREDIT`).
4. **Balancing Invariant**:
   $$\sum \text{Debits} = \text{Base Expense} + \text{Input GST} = \text{Total Amount} = \sum \text{Credits}$$

---

## 2. Standard Posting Patterns

### Pattern A: Direct Cash/Bank Expense without GST
*Example: Petty cash for branch cleaning supplies (₹500)*
```text
DR  52600 - Repair & Maintenance / Supplies       ₹500.00
    CR 11100 - Petty Cash Account                         ₹500.00
------------------------------------------------------------------
Total Debits: ₹500.00   |   Total Credits: ₹500.00 (BALANCED)
```

### Pattern B: Store Utility Bill with GST (Paid via Bank)
*Example: Electricity Bill ₹5,000 + 18% GST (₹900) = ₹5,900*
```text
DR  52200 - Electricity & Utilities Expense       ₹5,000.00
DR  11510 - Input CGST Receivable (9%)              ₹450.00
DR  11520 - Input SGST Receivable (9%)              ₹450.00
    CR 11200 - HDFC Bank Current Account                 ₹5,900.00
------------------------------------------------------------------
Total Debits: ₹5,900.00  |  Total Credits: ₹5,900.00 (BALANCED)
```

### Pattern C: Vendor Maintenance Invoice on Credit (Payable)
*Example: Oven repair by Vendor 'ABC Services' ₹10,000 (Due in 15 days)*
```text
DR  52600 - Repair & Maintenance Expense         ₹10,000.00
    CR 21100 - Accounts Payable (Vendor)                ₹10,000.00
------------------------------------------------------------------
Total Debits: ₹10,000.00 |  Total Credits: ₹10,000.00 (BALANCED)
```

---

## 3. Integration with `FinancePostingEngine`

When `ExpenseService.postExpenseToGL(expenseId, user)` is executed, the service constructs a `PostJournalCommandDto`:

```typescript
const command: PostJournalCommandDto = {
  postingDate: expense.expenseDate.toISOString().slice(0, 10),
  documentDate: expense.expenseDate.toISOString().slice(0, 10),
  sourceModule: 'FINANCE',
  sourceEntityType: 'EXPENSE',
  sourceEntityId: expense.id,
  sourceReference: expense.expenseNumber,
  description: `Expense: ${expense.description} (${expense.expenseNumber})`,
  lines: [
    // 1. Debit Base Expense
    {
      accountId: expense.expenseAccountId,
      branchId: expense.branchId,
      debitAmount: Number(expense.baseAmount),
      creditAmount: 0,
      description: expense.description,
    },
    // 2. Debit Input GST if taxAmount > 0
    ...(expense.taxAmount > 0
      ? [
          {
            accountId: inputTaxAccountId,
            branchId: expense.branchId,
            debitAmount: Number(expense.taxAmount),
            creditAmount: 0,
            description: `Input GST on ${expense.expenseNumber}`,
          },
        ]
      : []),
    // 3. Credit Payment / Payable Account
    {
      accountId: expense.paymentAccountId,
      branchId: expense.branchId,
      debitAmount: 0,
      creditAmount: Number(expense.totalAmount),
      description: `Payment for ${expense.expenseNumber}`,
    },
  ],
};
```

---

## 4. Reversal Accounting Rules

When a posted expense is reversed:
1. `JournalService.reverseJournal()` generates an exact counter-journal with reversed debits and credits:
   - Credit Expense Account
   - Credit Input Tax Account
   - Debit Cash / Payable Account
2. The reversal is posted in the currently `OPEN` fiscal period for the reversal date.
3. The original journal is marked `REVERSED` and linked to the counter-journal.
4. The expense status transitions to `CANCELLED`.
