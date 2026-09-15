# 14. Non-Functional Requirements (NFR)

This document establishes the performance, availability, security, auditability, scalability, and compliance requirements for the Cakes & Candles ERP platform.

---

## 1. Performance Requirements

### A. POS Retail Commerce
* **POS Search Response**: `< 500ms` for local SKU and barcode scans.
* **Add Product To Cart**: `< 300ms` UI render delay.
* **Generate Invoice & Tax Calculation**: `< 2s` from checkout trigger to PDF serialization.
* **Print Receipt**: `< 3s` from billing completion to local printer output feed.

### B. Inventory & Transfers
* **Stock Search**: `< 1s` for branch-wide catalog queries.
* **Transfer Sheet Creation**: `< 2s` to commit items to transit states and build manifests.
* **Inventory Dashboard Load**: `< 3s` to compile multi-warehouse status tables.

### C. Manufacturing & KDS
* **Create Production Plan**: `< 3s` to complete recipe explosions and schedule batch runs.
* **Load KDS touchscreens Queue**: `< 2s` to render and refresh active kitchen queues.

---

## 2. Availability Requirements
* **System SLA**: `99.5%` annual uptime on core cloud APIs.
* **Planned Downtime**: Restricted to monthly maintenance windows on **Sundays, 11:00 PM to 01:00 AM IST**.
* **High Availability**: Decoupled deployment utilizing AWS Multi-AZ RDS replication.

---

## 2.1 Business Continuity Requirements
* **CRM Service Decoupling**: Factory operations (Planner, KDS runs, yield logs) must continue functioning normally even if the CRM or messaging campaigns engine fails.
* **POS Service Decoupling**: Retail branch checkout must operate and invoice customers normally even if reporting modules or analytics pipelines are offline.
* **Logistics Decoupling**: Dispatch builders, manifests generation, and transit drivers workflows must remain functional even if business analytics charts are unreachable.
* **Core Dependency Rules**: Core transactional domains (POS, Inventory Ledger, Manufacturing) must have zero runtime dependencies on secondary, non-critical modules (CRM, HR, Analytics snapshots).

---

## 3. Scalability Requirements
The system is architected to scale from current operations to future franchise expansion parameters without architectural rewrites:

| Parameter | Current Scale | Target Scale (Future Proof) |
| --- | --- | --- |
| **Factories** | 1 Factory | 5 Factories |
| **Retail Branches** | 6 Branches | 50+ Branches |
| **Active System Users** | 15 Users | 500+ Concurrent Users |
| **Registered Customers** | 5,000 Customers | 500,000 Customers |
| **Annual POS Invoices** | 50,000 Transactions | 5,000,000 Transactions |

---

## 4. Security Requirements

### Authentication
* All routes protected by JSON Web Tokens (JWT) containing a 15-minute access lifetime.
* Refresh tokens (7-day lifetime) stored in `HTTPOnly` secure cookies.
* Idle session timeout locks the register screens after **15 minutes of inactivity**.

### Password Policy
* Minimum 8 characters.
* Must contain at least one uppercase letter, one lowercase letter, one number, and one special character.

### Authorization & RBAC
* Dynamic permission checks enforced at both API routing middleware and frontend UI component wrappers matching the [07_Permission_Matrix.md](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/discovery/07_Permission_Matrix.md).

### Data Encryption
* Enforce HTTPS (TLS 1.3 only).
* Sensitive variables (secrets, passwords) encrypted using bcrypt or AWS KMS.

---

## 5. Audit Requirements
Every write action, void request, stock adjustment, and finance release must write a log record containing:
* **Who**: User UUID.
* **When**: Timestamp.
* **What**: Table name, action code (INSERT, UPDATE, VOID).
* **Identity Context**: IP Address, Client browser user agent, device metadata.
* **Data Diff**: `old_value` JSON map vs `new_value` JSON map.

---

## 6. Backup & Recovery

### Backup Policy
* Daily incremental database snapshots scheduled at **02:00 AM IST**.
* Complete weekly logical database dumps stored in geographically separated cold storage.

### Retention Policy
* Backups retained for **30 days**.

### Recovery Metrics
* **RTO (Recovery Time Objective)**: Maximum **4 hours** to restore full service from catastrophic data center failures.
* **RPO (Recovery Point Objective)**: Maximum **24 hours** of data loss in worst-case disaster recovery scenarios.

---

## 7. Offline Requirements (POS Offline Mode)
* **Local Operation**: If internet connectivity drops, the POS application must support full billing, cart modification, and payment processing.
* **Duration Capacity**: POS terminal must operate fully offline for up to **24 hours**.
* **Auto-Sync**: Background worker checks connection state every 30 seconds and posts queued local records once online.

---

## 8. Notification Requirements
The system must push automated notifications to appropriate channels:
* **WhatsApp**: Used for Custom Cake ready statuses, receipt confirmations, and CRM birthday campaign alerts.
* **Email**: Used for PO dispatches to suppliers and daily closing audits sent to Owner.
* **In-App Alerts**: Live WebSocket warnings for low stock levels and pending transfer approvals.

---

## 9. Reporting Requirements
* **Standard Reports**: Daily sales, monthly expense sheets, branch scrap analysis.
* **File Formats**: Direct downloads in PDF, Microsoft Excel (XLSX), and raw CSV.

---

## 10. Monitoring Requirements
* **API Metrics**: Automatic tracing of errors (4xx/5xx counts) via Sentry or CloudWatch.
* **Queue Checks**: BullMQ dashboard monitoring active/failed sync queues.
* **Hardware Health**: Alert triggers when RDS database CPU exceeds 80%.

---

## 11. Compliance Requirements
* **GST Compliance**: Automated tax splits, dynamic SGST/CGST invoicing columns.
* **Soft Deletes**: Product records flag `is_active` to false; physical deletion from database tables is prohibited to maintain ledger coherence.
* **Immutable Ledgers**: Transactions inside `inventory_transaction` and cash log books are strictly append-only.

---

## 12. Browser Support
* **Google Chrome**: Latest 3 versions (Desktop & Android/iOS tablets).
* **Microsoft Edge**: Latest 2 versions (Desktop).
* **Safari**: Latest 2 versions (Desktop & iPad OS).

---

## 13. Device Support
* **Desktop**: Owner dashboard, HR shift planners, Factory planners, and Finance registers.
* **Tablet POS**: 10-inch retail checkouts.
* **KDS Setup**: 15"+ high-contrast kitchen touchscreens.
* **Mobile**: Driver logistics app, employee punch-in widgets.
