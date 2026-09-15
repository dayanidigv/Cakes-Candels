# 17. Project Estimation Specification

This document compiles the quantitative estimates, complexity sizing, budgeting indicators, risk vectors, and delivery models for the Cakes & Candles ERP platform.

---

## 1. Executive Summary
The Cakes & Candles ERP is modeled as a multi-portal, offline-capable enterprise platform. Based on the completed BRS, DB schema, API spec, and UI sitemaps, the project is structured to deliver immediate operational value using a phased release model.

---

## 2. Scope Summary
* **Target Delivery**: Multi-location inventory ledger, central factory recipe/production run scheduler, branch POS checkouts, custom design workflows, CRM template automation, logistics manifests, and cost-center accounting.
* **Target Platforms**: 10-inch POS checkout tablets, 15-inch KDS kitchen touchscreens, desktop administration views, and mobile driver apps.

---

## 3. Total Screens Count
As mapped in the [08_UI_Sitemap.md](file:///Applications/XAMPP/xamppfiles/htdocs/Cakes&Candels/discovery/08_UI_Sitemap.md), the system comprises a total of **53 dedicated interfaces** across 8 portals:
* **Owner Portal**: 12 Screens
* **Factory Portal**: 10 Screens
* **Branch Portal**: 8 Screens
* **Logistics Portal**: 6 Screens
* **CRM Portal**: 7 Screens
* **HR Portal**: 5 Screens
* **Finance Portal**: 5 Screens

---

## 4. Total Modules Count
The platform contains **8 operational modules**:
1. Authentication & RBAC Administration
2. Product & Category Catalog
3. Multi-warehouse Inventory Governance (Ledger & Transfers)
4. Factory Operations & KDS
5. POS Retail Commerce (Billing & Register Close)
6. Logistics & Manifest Dispatches
7. CRM, WhatsApp Campaigns & Loyalty
8. Finance, Cost-Center overheads & HR Administration

---

## 5. Total APIs Count
The backend specification defines **28 REST API endpoints** categorized by domain controllers:
* Auth / Organization: 4 endpoints
* Products: 3 endpoints
* Inventory / Ledger / Wastages: 6 endpoints
* Manufacturing / Recipes / Yields: 4 endpoints
* POS Commerce: 3 endpoints
* Logistics: 2 endpoints
* CRM / Campaigns: 2 endpoints
* Custom Cakes: 2 endpoints
* HR / Attendance: 2 endpoints

---

## 6. Database Complexity Analysis
* **Table Count**: 37 tables mapped across MVP and Phase 2.
* **Key Constraints**: Strict immutability constraints on `inventory_transaction` and cash balance logs.
* **Procedural Logic**: Automated triggers update cached `stock_balance` tables.

---

## 7. Recommended MVP Release Plan
To maximize early business returns and align with Laya's Cakes & Candles priorities (POS billing, then CRM, B2B, and marketing), the 24-week timeline is split into three releases:

### Release A: MVP Core (Weeks 1 - 12)
* **Goal**: Establish stable billing, inventory governance, and factory planning.
* **Modules**: Auth, RBAC, Product Master, Inventory Ledger, Manufacturing, POS, Dispatch preparation, and daily closing reports.

### Release B: Version 2 (Weeks 13 - 18)
* **Goal**: Launch custom cake pipelines and CRM automation.
* **Modules**: Custom cake kanbans, S3 design uploads, CRM loyalty, and WhatsApp campaign triggers.

### Release C: Version 3 (Weeks 19 - 24)
* **Goal**: Establish back-office HR and Finance logs.
* **Modules**: Expense logs, employee shift attendances, leave tracking, and cost-center P&L charts.

---

## 8. Multi-Scenario Estimation Matrix

| Parameter Scenario | Timeline | Core Team Size | Estimated Budget Range |
| --- | :---: | :---: | :---: |
| **Aggressive** | 18 Weeks | 5 Resources (Shared roles) | $75,000 - $90,000 |
| **Realistic (Recommended)** | 24 Weeks | 7 Resources (Standard layout) | $110,000 - $130,000 |
| **Conservative** | 30 Weeks | 8 Resources (Heavy QA focus) | $145,000 - $165,000 |

---

## 9. Infrastructure Cost Estimate (Cloud Run AWS)
Estimated monthly AWS running costs for 6 branches + 1 central factory:

| Service Area | Component Context | Monthly Cost (USD) |
| --- | --- | :---: |
| **Database** | Multi-AZ RDS PostgreSQL (db.t4g.medium) | $120.00 |
| **App Containers** | ECS Fargate Node/React API Servers | $180.00 |
| **Caching & Queues**| ElastiCache Redis Cluster | $45.00 |
| **Storage** | S3 bucket (Designs references & logs assets) | $15.00 |
| **Network & CDN** | CloudFront, Route53, NAT Gateway | $90.00 |
| **Total** | *Estimated monthly cloud overhead* | **$450.00 / Month** |

---

## 10. Risk Assessment

* **R-01: Branch network outages during rush hours**
  - *Mitigation*: The `web-pos` app features IndexedDB offline capabilities to allow uninterrupted checkouts.
* **R-02: Recipe variance and yield reporting integrity**
  - *Mitigation*: Implement touch KDS yield screens requiring chefs to submit actual output before sealing plans.
* **R-03: Inventory discrepancies from B2B branch transfers**
  - *Mitigation*: Require recipient branch managers to click "Acknowledge incoming" to verify transits.

---

## 11. Assumptions
1. Client provides WhatsApp Business API accounts and credentials.
2. POS terminal tablet hardware runs Chrome or Safari engines.
3. Stable power backup is available at Pudupalayam central factory kitchen.
