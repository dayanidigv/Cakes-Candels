# 07. Role-Based Access Control & Permissions Matrix

This document defines the Cakes & Candles ERP permissions structure, outlining system roles, access levels, validation controls, and audit trails.

---

## 1. System Roles (Level 1)
The system supports 10 specialized operational roles:
1. **SUPER_ADMIN**: Absolute system control.
2. **OWNER** (Sudha): Strategic oversight, absolute override rights, financial clearance.
3. **FACTORY_MANAGER**: Governs procurement, recipes, batch scheduling, and factory floor logs.
4. **BRANCH_MANAGER**: Manages specific retail shop inventories, local staff, and wastage approvals.
5. **CASHIER**: Counter POS checkout operator.
6. **DISPATCH_COORDINATOR**: Controls transit manifests and driver assignments.
7. **DRIVER**: Conducts delivery routes.
8. **CRM_EXECUTIVE**: Drives marketing, birthday vouchers, and customer loyalty groups.
9. **HR_EXECUTIVE**: Controls shifts, leaves, and attendance registers.
10. **ACCOUNTANT**: Petty cash, expenses, and supplier ledger entries.

---

## 2. Module Permissions (Level 2)

| Module | VIEW | CREATE | UPDATE | DELETE | APPROVE | EXPORT |
| --- | --- | --- | --- | --- | --- | --- |
| **Products** | ALL | SUPER_ADMIN, OWNER | SUPER_ADMIN, OWNER | OWNER | OWNER | OWNER |
| **Recipes** | ALL | FACTORY_MANAGER | FACTORY_MANAGER | OWNER | OWNER | OWNER |
| **Procurement**| FACTORY, ACCT | FACTORY_MANAGER | FACTORY_MANAGER | ❌ | OWNER | OWNER |
| **Inventory** | ALL | MGR, FACTORY | MGR, FACTORY | ❌ | OWNER, MGR | ALL |
| **Logistics** | ALL | DISPATCH | DISPATCH | ❌ | DISPATCH | DISPATCH |
| **POS Orders** | ALL | CASHIER, MGR | MGR (Request) | ❌ | OWNER | OWNER |
| **Custom Cakes**| ALL | CASHIER, MGR | MGR, CHEF | ❌ | CHEF | MGR |
| **CRM/Loyalty**| ALL | CRM_EXECUTIVE | CRM_EXECUTIVE | ❌ | CRM_EXECUTIVE| OWNER |
| **HR / Shifts** | ALL | HR_EXECUTIVE | HR_EXECUTIVE | ❌ | HR, OWNER | HR |
| **Finance** | OWNER, ACCT | ACCOUNTANT | ACCOUNTANT | ❌ | OWNER | OWNER |

*Note: `❌` indicates that deletion is completely disabled at the database level for that module.*

---

## 3. Approval Workflows (Level 3)

### A. POS Bill Void Workflow
Prevents cash theft at registers by requiring manager validation.
```text
Cashier (Initiates Void Request on POS)
  ↓
System locks invoice (Status: PENDING_VOID)
  ↓
Owner (Sudha) reviews notification and enters authorization credential
  ↓
Invoice Voided (Ledger status updated; compensating inventory transaction written)
```

### B. Wastage Logging Workflow
Differentiates between normal spoilages and shrinkage theft.
```text
Branch Staff / Cashier (Logs item, quantity & reason)
  ↓
Stock moved to quarantine (Stock Reservation: WASTE_STAGED)
  ↓
Branch Manager inspects and clicks "Acknowledge"
  ↓
Owner (Sudha) reviews Consolidated Waste Queue and clicks "Approve Write-off"
  ↓
System processes write-off (Deducted from stock ledger: WASTE_WRITE_OFF)
```

### C. Supplier Payment Release Workflow
```text
Accountant (Logs invoice matching GRN and requests payout)
  ↓
Ledger status: PENDING_PAYMENT
  ↓
Owner (Sudha) reviews matching metrics (PO vs. GRN vs. Invoice)
  ↓
Owner signs off and releases funds
  ↓
Supplier Ledger updated to status: PAID
```

---

## 4. Inventory Governance Permissions (Level 4)

| Action | Cashier | Branch Manager | Factory Manager | Owner (Sudha) |
| --- | --- | --- | --- | --- |
| **Transfer Stock** | ❌ | Request (To-Branch) | Request / Approve | Approve / Override |
| **Create Adjustment** | ❌ | Request | Approve | Approve / Override |
| **Mark Expired** | ❌ | Request | Approve | Approve / Override |
| **Convert Cake** | ❌ | Request / Convert | Approve | Approve / Override |

---

## 5. Financial & Transactional Restrictions (Level 5)
* **Immutable Ledgers**: Transactions inside `inventory_transaction`, `loyalty_ledger`, `supplier_ledger`, and `order_invoice` are strictly append-only.
* **No Deletes**: The system completely blocks SQL `DELETE` queries on these tables.
* **Corrections**: Errors must be fixed exclusively via compensating ledger transactions (e.g. `RETURN` or `CORRECTION` rows).

---

## 6. Branch Data Visibility (Level 6)
* **Cashier & Branch Manager**: 
  - Restricts POS queries, inventory logs, and expense reports strictly to their assigned branch location ID.
  - Cannot query data from other retail locations or the central factory.
* **Factory Manager**:
  - Restricts queries to the Pudupalayam central factory and Transit Hub datasets.
* **Owner (Sudha) & Accountants**:
  - Unrestricted query parameters across all 6 branches and central factory datasets.

---

## 7. Audit Trail Policy (Level 7)
Every write operation (`INSERT`, `UPDATE`, compensating transaction) on sensitive tables must record an audit row to an immutable `audit_log` table:

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_user(id),
    action_type VARCHAR(20), -- INSERT, UPDATE, VOID
    target_table VARCHAR(100),
    target_row_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
*Note: This schema is created as a system trigger at database level to guarantee operational safety.*
