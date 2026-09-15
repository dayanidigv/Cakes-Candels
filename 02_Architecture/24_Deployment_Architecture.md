# 24. Deployment & Infrastructure Architecture

This document details Laya's Cakes & Candles ERP hosting infrastructure, environment splits, CI/CD pipeline triggers, and backup recovery architectures.

---

## 1. AWS Topography

```text
               +-------------------------------------------------+
               |                   CloudFront                    |
               |         (Static SPA Hosting & CDN caches)       |
               +-------------------------------------------------+
                                        │
                                        ▼
               +-------------------------------------------------+
               |            Application Load Balancer            |
               |                (ALB Target Groups)              |
               +-------------------------------------------------+
                                        │
                                        ▼
               +-------------------------------------------------+
               |              NestJS API (ECS Fargate)           |
               |          (Hosted inside Private Subnets)        |
               +-------------------------------------------------+
                                  │           │
                     ┌────────────┘           └────────────┐
                     ▼                                     ▼
       +----------------------------+        +----------------------------+
       |   ElastiCache Redis Clust  |        |    Multi-AZ PostgreSQL     |
       |  (Cache & BullMQ Brokers)  |        |    (Transactional DB RDS)  |
       +----------------------------+        +----------------------------+
```

### Topography Elements
* **CloudFront**: Edge serving static resources for `web-admin`, `web-pos`, and `web-kds`. Reduces latency at retail stores.
* **AWS ALB (Application Load Balancer)**: Decouples SSL handshake and distributes payload queries to target ECS service pools.
* **AWS ECS (Elastic Container Service) on Fargate**: Serves container instances of our modular NestJS monolith. Placed inside private subnets with NAT gateways.
* **Amazon ElastiCache for Redis**: Key-value cache and message broker broker engine.
* **Amazon RDS PostgreSQL (Multi-AZ)**: Enforces read-write replica groups to ensure database availability.

---

## 2. Environments

* **Local**: Local Docker Compose environment running PostgreSQL, Redis, and hot-reload developer containers.
* **Dev**: Auto-deployed on git push to `dev` branch. Used for developer validation checks.
* **UAT (User Acceptance Testing)**: Runs on dedicated staging subnets. Used by Owner (Sudha) and branch managers to verify features before deployment.
* **Production**: Protected environment mapping active locations data. Deployments require PM approvals.

---

## 3. CI/CD Pipeline Workflow (GitHub Actions)

```text
Developers push code to main branch
           │
   [Trigger GitHub Action]
           │
  1. Install dependencies & Run Linters
  2. Execute Vitest Unit & Integration tests
  3. Build Docker container image (Multistage build)
  4. Push Image to Amazon ECR (Elastic Container Registry)
  5. Deploy container revisions update task to ECS Fargate
```

---

## 4. Backup Strategy

* **Daily Snapshot**: AWS RDS automatic backups scheduled at **02:00 AM IST** with a retention window of **30 days**.
* **Weekly Backups**: Logical database dumps exported to AWS S3 bucket with versioning locks and Lifecycle policies archiving archives to AWS Glacier after 90 days.
* **Monthly Archives**: Static snapshots kept offline in localized cold archives.
