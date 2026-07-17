# Yamini Flow — Privacy & Data Protection Architecture

---

## 1. Data Collected & Purpose

- **Account Data**: Email address, hashed password, enterprise portal role, registration timestamp.
- **Enterprise Ledger Assets**: Orders, purchase orders, client inventories, custom catalog profiles.
- **Integration Metadata**: Sync logs, manual correlation parameters, and system events.

---

## 2. Encryption & Storage Protocols

- **In-Transit**: All API traffic strictly encrypted using TLS 1.3 with HSTS headers.
- **At-Rest**: MongoDB cluster disk volumes encrypted using AES-256. Sensitive credentials and secrets loaded purely via secure environment variables.

---

## 3. Retention & Deletion Process

- **Active Business Data**: Retained while the enterprise subscription/account remains active.
- **Audit Logs**: Automatically purged after 90 days via MongoDB TTL indexes.
- **Right to Erasure (GDPR / DPDP Compliance)**: Tenant administrators can trigger an automated deletion workflow that purges all database collections and transactions associated with their ID within 72 hours.
