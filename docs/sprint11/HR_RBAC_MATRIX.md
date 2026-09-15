# 🛡️ SPRINT 11 — HR & PAYROLL RBAC & ISOLATION MATRIX

> **Target Release**: Sprint 11  
> **Guards**: `JwtAuthGuard`, `PermissionsGuard`, `BranchScopeGuard`  

---

## 1. Scope Hierarchy

```text
GLOBAL    ──────> Access all Organizations & Branches (Super Admin / HQ HR Director)
FACTORY   ──────> Access Central Factory Production Staff (Factory HR Manager)
BRANCH    ──────> Access Assigned Branch Staff (Branch Store Manager)
ASSIGNED  ──────> Access Self & Direct Subordinates (Employee Self-Service / Shift Supervisor)
```

---

## 2. Granular HR Permissions Catalog

| Permission Key | Description | Target Operations |
| :--- | :--- | :--- |
| `hr:employee:read` | View employee directory and 360 profile | `GET /hr/employees`, `GET /hr/employees/:id/360` |
| `hr:employee:write` | Create, update employee master records | `POST /hr/employees`, `PUT /hr/employees/:id` |
| `hr:attendance:read` | View attendance logs and rosters | `GET /hr/attendance` |
| `hr:attendance:write` | Ingest attendance / log punch | `POST /hr/attendance/log` |
| `hr:attendance:correct` | Approve attendance corrections | `POST /hr/attendance/corrections/:id/approve` |
| `hr:leave:read` | View leave balances and requests | `GET /hr/leaves` |
| `hr:leave:write` | Submit leave requests | `POST /hr/leaves/request` |
| `hr:leave:approve` | Approve / Reject leave requests | `POST /hr/leaves/requests/:id/approve` |
| `hr:payroll:read` | View salary structures and payroll runs | `GET /hr/payroll/runs` |
| `hr:payroll:run` | Execute payroll calculation engine | `POST /hr/payroll/runs/calculate` |
| `hr:payroll:approve` | Approve payroll run for payment | `POST /hr/payroll/runs/:id/approve` |

---

## 3. Role Access Matrix

| Role | Scope | Employee Master | Attendance | Leave Approval | Payroll Run | Financial Post |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **System Admin** | `GLOBAL` | READ / WRITE | READ / WRITE | READ / APPROVE | READ / RUN / APPROVE | YES |
| **HR Director** | `GLOBAL` | READ / WRITE | READ / WRITE | READ / APPROVE | READ / RUN / APPROVE | YES |
| **Factory HR** | `FACTORY` | READ / WRITE | READ / WRITE | READ / APPROVE | READ / RUN | NO |
| **Branch Manager** | `BRANCH` | READ | READ / LOG | READ / APPROVE | READ | NO |
| **Shift Supervisor** | `ASSIGNED` | READ (Self/Sub) | LOG | READ | NO | NO |
| **Staff Employee** | `ASSIGNED` | READ (Self) | LOG (Self) | WRITE (Self) | READ (Own Payslip) | NO |
