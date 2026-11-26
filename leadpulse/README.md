# LeadPulse — Communication Workflow Intelligence Engine

LeadPulse is a production-grade backend system designed to manage customer communication workflows, lead prioritization, SLA monitoring, and automated follow-ups.

## 🚀 Tech Stack

- **Node.js & Express.js** — Core API Framework
- **PostgreSQL & Prisma ORM** — Relational Database & Type-safe Data Access
- **Redis & BullMQ** — Distributed Job Queues & Background Processing
- **Socket.IO** — Real-time Updates & Event Broadcasting
- **Docker** — Containerization & Deployment
- **JWT** — Secure Authentication & RBAC
- **Winston** — Structured Logging

## 🏗️ Architecture

LeadPulse follows a scalable **Modular Architecture**:
- **Controllers** — Handle HTTP requests and input validation.
- **Services** — Contain business logic (Scoring, SLA, Workflows).
- **Repositories** — Abstract database access using Prisma.
- **Queues & Workers** — Handle asynchronous tasks like follow-up reminders.
- **Middleware** — Authentication, Authorization, Logging, and Error Handling.

## 📋 Core Features

1. **Lead Management** — Full CRUD with status transitions (NEW → CLOSED).
2. **Conversation Timeline** — Audit trail for calls, messages, and notes.
3. **Scoring Engine** — Rule-based lead prioritization (HOT/WARM/COLD).
4. **SLA Monitoring** — Tracks response times and alerts on breaches.
5. **Real-Time Updates** — Instant notifications via WebSockets.
6. **Observability** — Metrics dashboard and structured logs.

## 🚦 Getting Started

### 1. Setup Environment
Copy `.env.example` to `.env` and configure your credentials.

### 2. Docker Setup (Recommended)
```bash
docker-compose up -d
```

### 3. Local Development
```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### 4. API Documentation
Once running, visit: `http://localhost:3000/api-docs`

## 📊 Queue Architecture

- **Workflow Queue** — Handles lead-specific jobs (Score recalculation, inactivity checks).
- **SLA Queue** — Monitor response times and triggers alerts.

## 🛡️ Scaling Considerations

- **Redis Caching** — Implement caching for frequent metric lookups.
- **Horizontal Scaling** — Stateless API servers can be scaled behind a load balancer.
- **Worker Isolation** — Run BullMQ workers on separate instances to prevent CPU contention.

---
Built with ❤️ by LeadPulse Team
