# YAMINI FLOW — Product Requirements Document

## Overview
YAMINI FLOW is an enterprise-grade Distribution Intelligence Platform (ERP) that connects Super Admin (Arpan), Dealers, CNF Personnel, and Suppliers through one intelligent ecosystem. The platform automates the full distribution cycle — inventory, procurement, orders, and reporting — while treating Tally as the master accounting source of truth.

## Original Problem Statement
YAMINI FLOW V2 — enterprise ERP with modules: Authentication, RBAC, Dealer/CNF/Supplier/Admin portals, Inventory Engine, Procurement Engine, Tally Sync Engine, Analytics, AI Insights, Notifications, Audit Logs, Settings. Brand: Deep Navy / Yamini Orange. Stack (adapted to Emergent): React + FastAPI + MongoDB (originally spec'd Next.js/Node).

## User Choices
- Stack: React + FastAPI + MongoDB (Emergent default)
- Scope for MVP: All four portals (Admin, Dealer, CNF, Supplier)
- Auth: JWT email+password
- AI: Emergent Universal LLM Key (Claude Sonnet 4.6)
- Tally: Mock architecture with sync-log endpoints (real integration deferred)

## Personas
1. **Super Admin (Arpan)** — Full control, sees all modules
2. **CNF Personnel** — Field ops manager over multiple dealers, sees analytics + AI
3. **Dealer** — Places orders, tracks fulfilment, downloads invoices
4. **Supplier** — Receives POs, updates delivery status

## Architecture
- **Backend**: FastAPI, modular routers (`auth`, `catalog`, `partners`, `orders`, `procurement`, `ops`), MongoDB via motor. Emergent LLM key for Claude AI.
- **Frontend**: React + Tailwind + shadcn/ui + Recharts + Phosphor Icons. Role-based sidebar; protected routes.
- **Auth**: JWT with httpOnly cookies + Authorization Bearer fallback, bcrypt hashing, brute-force lockout, admin seed on startup.
- **Fonts**: Outfit (display) + IBM Plex Sans (body) + JetBrains Mono (numbers).

## Modules Implemented (v2.0, 2026-07-15)
1. **Authentication + RBAC** — Login, /me, logout, admin seed, 4 demo accounts pre-seeded
2. **Dashboard** — Role-aware KPIs, revenue trend, top products/dealers, state-wise sales, low-stock alerts
3. **Products** — Full CRUD, search, filters, category
4. **Warehouses** — CRUD across 3 seeded warehouses
5. **Inventory Engine** — On-hand/reserved/available per warehouse × product, live stock ledger, safety-stock status
6. **Orders** — Dealer places orders, automatic stock reservation, deficit tracking, admin status transitions (pending → approved → shipped → delivered)
7. **Dealer Browse & Cart** — SKU catalogue with add-to-cart, checkout to /api/orders
8. **Invoices** — Auto-generated from approved+ orders
9. **Procurement Engine** — Deficit calculator (safety + pending demand - available), urgency ranking, bulk PO generation grouped by supplier
10. **Purchase Orders** — CRUD + status transitions (draft → sent → confirmed → received)
11. **Dealers / Suppliers / MNP** — Full CRUD (admin only), search, edit
12. **Tally Sync Engine (Mock)** — Manual sync per module, sync logs, health status, per-module status cards
13. **AI Insights** — Claude Sonnet 4.6 via emergentintegrations; 6 preset topics + freeform, history persistence
14. **Analytics** — Revenue vs Orders trend, State distribution, Dealer performance table
15. **Notifications** — Per-user + per-role, mark-all-read, drop-down in header
16. **Audit Logs** — Immutable trail of every order/PO/inventory/tally-sync event
17. **Settings** — Company info, Tally endpoint, auto-sync configuration

## Test Credentials
See `/app/memory/test_credentials.md`.

## Backlog / Next Steps (P1)
- Real MSG91 OTP integration for production deployment
- Actual Tally XML/ODBC integration when on-prem endpoint is available
- Wallet & credit-limit workflow for dealers
- Bulk CSV/Excel export on all data tables
- Push notifications via Firebase / socket-based real-time updates
- Mobile-native app for dealers/MNP
- Advanced supplier scorecard (on-time delivery %, defect rate)
- Multi-currency + multi-language support
- Warehouse transfers module
- Barcode/QR scanning workflow

## P2 (later phases)
- Redis feature-flag (>500 dealers)
- Kafka-based event bus
- Dedicated warehouse role
- Advanced RBAC per-permission (rather than role-based)
